from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item, StockMovement, Customer, SaleOrder, SaleOrderItem, DailyRegisterShift, CounterPayout
from inventory.services import adjust_stock
from django.utils import timezone
import datetime


class BillingAndCustomerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Bhopal Main Store", city="Bhopal")
        self.category = Category.objects.create(name="Groceries")
        self.subcategory = SubCategory.objects.create(category=self.category, name="Beverages")

        # Open register shift so orders created are editable during the shift
        self.shift = DailyRegisterShift.objects.create(
            shift_number="REG-TEST-0001",
            store=self.store,
            opened_at=timezone.now() - datetime.timedelta(hours=2),
            status=DailyRegisterShift.STATUS_OPEN,
            opening_cash=Decimal("1000.00"),
            cashier_name="Cashier 1"
        )

        # In-stock item
        self.item_in_stock = Item.objects.create(
            uid="WS-10001",
            name="Tata Tea Gold 500g",
            quantity=0,
            cost_price=Decimal("200.00"),
            selling_price=Decimal("250.00"),
            mrp=Decimal("260.00"),
            store=self.store,
            location_section="Aisle 1"
        )
        self.item_in_stock.subcategories.add(self.subcategory)
        adjust_stock(
            item=self.item_in_stock,
            change=10,
            reason=StockMovement.REASON_INITIAL_IMPORT,
            note="Initial inventory"
        )

        # Zero stock item (Out of Stock)
        self.item_out_of_stock = Item.objects.create(
            uid="WS-10002",
            name="Red Label Tea 250g",
            quantity=0,
            cost_price=Decimal("110.00"),
            selling_price=Decimal("140.00"),
            mrp=Decimal("150.00"),
            store=self.store,
            location_section="Aisle 1"
        )

    def test_successful_checkout_with_phone_and_name(self):
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9876543210",
            "customer_name": "Rohan Sharma",
            "payment_method": "cash",
            "amount_paid": "500.00",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('invoice_number', response.data)
        self.assertEqual(response.data['customer_phone'], "9876543210")
        self.assertEqual(response.data['customer_name'], "Rohan Sharma")
        self.assertEqual(Decimal(str(response.data['total_amount'])), Decimal("500.00"))

        # Check stock deduction
        self.item_in_stock.refresh_from_db()
        self.assertEqual(self.item_in_stock.quantity, 8)

        # Check StockMovement audit ledger
        movement = StockMovement.objects.filter(item=self.item_in_stock, reason=StockMovement.REASON_SALE).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.change, -2)

        # Check customer record
        customer = Customer.objects.get(phone="9876543210")
        self.assertEqual(customer.name, "Rohan Sharma")
        self.assertEqual(customer.total_purchases_count, 1)
        self.assertEqual(customer.total_spent, Decimal("500.00"))

    def test_checkout_with_phone_only_name_optional(self):
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9123456780",
            "customer_name": "",  # Name is completely omitted / blank
            "payment_method": "upi",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 1}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['customer_phone'], "9123456780")

        # Verify customer created with phone and blank name
        customer = Customer.objects.get(phone="9123456780")
        self.assertEqual(customer.phone, "9123456780")
        self.assertEqual(customer.display_name, "9123456780")

    def test_strict_out_of_stock_rejection(self):
        """Zero stock items cannot be sold / checked out."""
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9998887776",
            "payment_method": "cash",
            "items": [
                {"item_id": self.item_out_of_stock.id, "quantity": 1}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Out of Stock", str(response.data))

        # Stock remains 0
        self.item_out_of_stock.refresh_from_db()
        self.assertEqual(self.item_out_of_stock.quantity, 0)

    def test_insufficient_stock_rejection(self):
        """Cannot sell more quantity than currently available in stock."""
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9998887776",
            "payment_method": "cash",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 15}  # Only 10 in stock
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", str(response.data))

    def test_customer_sorting_and_history(self):
        # Create multiple customers with different metrics
        c1 = Customer.objects.create(phone="1111111111", name="Alice", total_spent=Decimal("1500.00"), total_purchases_count=2)
        c2 = Customer.objects.create(phone="2222222222", name="Bob", total_spent=Decimal("5000.00"), total_purchases_count=5)
        c3 = Customer.objects.create(phone="3333333333", name="Charlie", total_spent=Decimal("200.00"), total_purchases_count=1)

        # 1. Sort by Most Purchases (total_spent)
        res = self.client.get(reverse('customer-list') + '?sort=most_purchases')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        phones = [c['phone'] for c in res.data]
        self.assertEqual(phones[0], "2222222222")  # Bob has highest spend (5000)

        # 2. Sort by Frequently Bought (order count)
        res = self.client.get(reverse('customer-list') + '?sort=frequently_bought')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        phones = [c['phone'] for c in res.data]
        self.assertEqual(phones[0], "2222222222")  # Bob has highest count (5)

        # 3. Search by Phone or Name
        res = self.client.get(reverse('customer-list') + '?search=Alice')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], "Alice")

        # 4. Lookup action for cashier
        res = self.client.get(reverse('customer-lookup') + '?phone=222')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['phone'], "2222222222")

    def test_checkout_with_authenticated_staff_cashier(self):
        from staff.models import StaffRole, StaffMember
        role = StaffRole.objects.create(name="POS Cashier", is_owner=False, can_access_billing=True)
        staff = StaffMember.objects.create(
            staff_id="CASHIER_99",
            name="Priya Sharma",
            role=role,
            store=self.store,
            is_active=True
        )

        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9444455555",
            "customer_name": "Deepak Verma",
            "payment_method": "card",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 1}
            ]
        }

        # Send request with staff header
        response = self.client.post(url, payload, format='json', HTTP_X_STAFF_ID="CASHIER_99")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['cashier_name'], "Priya Sharma")
        self.assertEqual(response.data['customer_phone'], "9444455555")

    def test_checkout_with_item_discount_and_unit_price_override(self):
        """Cashier overrides unit price and gives item-level discount percentage."""
        url = reverse('sale-order-checkout')
        # Original selling price = 250.00. Override = 200.00. Quantity = 2. Subtotal base = 400.00.
        # Discount = 10% -> 40.00 off -> Net line total = 360.00.
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9888877777",
            "customer_name": "Anita Gupta",
            "payment_method": "cash",
            "discount_amount": "40.00",
            "items": [
                {
                    "item_id": self.item_in_stock.id,
                    "quantity": 2,
                    "unit_price": "200.00",
                    "discount_percent": "10.00"
                }
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(response.data['total_amount'])), Decimal("360.00"))

        order = SaleOrder.objects.get(invoice_number=response.data['invoice_number'])
        self.assertEqual(order.subtotal, Decimal("400.00"))
        self.assertEqual(order.discount_amount, Decimal("40.00"))
        self.assertEqual(order.total_amount, Decimal("360.00"))

        item_row = order.items.first()
        self.assertEqual(item_row.unit_selling_price, Decimal("200.00"))
        self.assertEqual(item_row.total_price, Decimal("360.00"))

    def test_checkout_split_payment_success(self):
        """Checkout with split payment between Cash and UPI."""
        url = reverse('sale-order-checkout')
        # item unit price 250.00 * 2 = 500.00 total
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9777788888",
            "customer_name": "Split Pay Customer",
            "payment_method": "split",
            "split_cash_amount": "200.00",
            "split_upi_amount": "300.00",
            "amount_paid": "200.00",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['payment_method'], 'split')
        self.assertEqual(Decimal(str(response.data['split_cash_amount'])), Decimal("200.00"))
        self.assertEqual(Decimal(str(response.data['split_upi_amount'])), Decimal("300.00"))
        self.assertEqual(Decimal(str(response.data['total_amount'])), Decimal("500.00"))

        order = SaleOrder.objects.get(invoice_number=response.data['invoice_number'])
        self.assertEqual(order.payment_method, 'split')
        self.assertEqual(order.split_cash_amount, Decimal("200.00"))
        self.assertEqual(order.split_upi_amount, Decimal("300.00"))
        self.assertEqual(order.total_amount, Decimal("500.00"))

    def test_checkout_split_payment_with_cash_tendered_and_change(self):
        """Customer gives a 500 rupee note for a 200 rupee cash split portion."""
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9666655555",
            "customer_name": "Change Customer",
            "payment_method": "split",
            "split_cash_amount": "200.00",
            "split_upi_amount": "300.00",
            "amount_paid": "500.00",  # Tendered 500 note for 200 cash part
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(response.data['change_returned'])), Decimal("300.00"))

    def test_checkout_split_payment_mismatch_fails_validation(self):
        """Checkout fails when split cash and upi amounts do not equal total payable."""
        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9555544444",
            "payment_method": "split",
            "split_cash_amount": "150.00",
            "split_upi_amount": "200.00",  # Sum = 350, but total is 500
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("payment_method", response.data)

    def test_update_sale_order_payment_method_to_upi(self):
        """Cashier can update payment method of an order from cash to upi."""
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9999888877",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 1}]
        }
        res = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']

        detail_url = reverse('sale-order-detail', kwargs={'pk': order_id})
        patch_res = self.client.patch(detail_url, {"payment_method": "upi"}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['payment_method'], 'upi')

        # Verify database reflects the update
        order = SaleOrder.objects.get(id=order_id)
        self.assertEqual(order.payment_method, 'upi')

    def test_update_sale_order_payment_method_to_split(self):
        """Cashier can update payment method to split with valid amounts."""
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9999888866",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 2}] # Total 500
        }
        res = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']

        detail_url = reverse('sale-order-detail', kwargs={'pk': order_id})
        patch_res = self.client.patch(detail_url, {
            "payment_method": "split",
            "split_cash_amount": "200.00",
            "split_upi_amount": "300.00"
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['payment_method'], 'split')
        self.assertEqual(Decimal(str(patch_res.data['split_cash_amount'])), Decimal('200.00'))
        self.assertEqual(Decimal(str(patch_res.data['split_upi_amount'])), Decimal('300.00'))

    def test_filter_sale_orders_by_since_and_cashier(self):
        """Sales endpoint filters correctly by since timestamp and cashier ID."""
        order = SaleOrder.objects.create(
            invoice_number="INV-FILTER-001",
            store=self.store,
            customer_phone="9988776655",
            customer_name="Test Customer",
            subtotal=Decimal('250.00'),
            total_amount=Decimal('250.00'),
            payment_method='cash',
            status='completed'
        )

        list_url = reverse('sale-order-list')
        res = self.client.get(list_url, {'store': self.store.id, 'phone': '9988776655'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Future timestamp filter returns empty
        future = (timezone.now() + datetime.timedelta(hours=2)).isoformat()
        res_future = self.client.get(list_url, {'store': self.store.id, 'since': future})
        self.assertEqual(res_future.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_future.data), 0)

    def test_update_sale_order_items_and_stock_ledger(self):
        """
        Cashier can edit items in a sale order during an active shift:
        - Reducing quantity returns stock to inventory and records adjustment ledger entry.
        - Increasing quantity/adding item deducts stock and records sale ledger entry.
        - Totals and customer spend are recalculated accurately.
        """
        # Create second in-stock item
        item2 = Item.objects.create(
            uid="WS-10003",
            name="Green Tea 100g",
            quantity=0,
            cost_price=Decimal("80.00"),
            selling_price=Decimal("100.00"),
            mrp=Decimal("120.00"),
            store=self.store
        )
        adjust_stock(item=item2, change=5, reason=StockMovement.REASON_INITIAL_IMPORT)

        # 1. Checkout 2 units of item_in_stock (initial: 10 units, after checkout: 8 units)
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9811223344",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 2}]
        }
        res = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']

        self.item_in_stock.refresh_from_db()
        self.assertEqual(self.item_in_stock.quantity, 8)
        cust = Customer.objects.get(phone="9811223344")
        self.assertEqual(cust.total_spent, Decimal("500.00"))

        # 2. Capture initial StockMovement
        initial_mv = StockMovement.objects.filter(
            item=self.item_in_stock,
            reason=StockMovement.REASON_SALE
        ).first()
        self.assertIsNotNone(initial_mv)
        self.assertEqual(initial_mv.change, -2)
        original_created_at = initial_mv.created_at

        # 3. Edit order: Reduce item_in_stock from 2 to 1, and add 2 units of item2
        # Expected:
        # - In-place editing: initial_mv.change becomes -1, created_at is preserved!
        # - No excess REASON_RETURN entries created in ledger!
        # - 1 unit of item_in_stock returned to inventory (stock 8 -> 9)
        # - 2 units of item2 deducted from inventory (stock 5 -> 3)
        # - New total: (1 * 250.00) + (2 * 100.00) = 450.00
        detail_url = reverse('sale-order-detail', kwargs={'pk': order_id})
        edit_payload = {
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 1, "unit_selling_price": "250.00"},
                {"item_id": item2.id, "quantity": 2, "unit_selling_price": "100.00"}
            ],
            "payment_method": "upi"
        }
        patch_res = self.client.patch(detail_url, edit_payload, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(patch_res.data['total_amount'])), Decimal("450.00"))
        self.assertEqual(patch_res.data['payment_method'], "upi")

        # Verify stock updates
        self.item_in_stock.refresh_from_db()
        self.assertEqual(self.item_in_stock.quantity, 9)  # 1 restored!

        item2.refresh_from_db()
        self.assertEqual(item2.quantity, 3)  # 2 deducted!

        # Verify StockMovement ledger entries: NO REASON_RETURN entries created!
        return_mv_count = StockMovement.objects.filter(
            reason=StockMovement.REASON_RETURN
        ).count()
        self.assertEqual(return_mv_count, 0)

        # Verify initial movement was updated IN-PLACE with timestamp intact
        initial_mv.refresh_from_db()
        self.assertEqual(initial_mv.change, -1)
        self.assertEqual(initial_mv.created_at, original_created_at)

        deduct_mv = StockMovement.objects.filter(
            item=item2,
            reason=StockMovement.REASON_SALE
        ).first()
        self.assertIsNotNone(deduct_mv)
        self.assertEqual(deduct_mv.change, -2)

        # Verify customer spend recalculated
        cust.refresh_from_db()
        self.assertEqual(cust.total_spent, Decimal("450.00"))

    def test_closed_shift_immutability_rejection(self):
        """
        Once a register shift is closed, all sales from that shift are permanently locked/immutable.
        Any attempt to edit payment method or items is rejected with a 400 validation error.
        """
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9877001122",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 1}]
        }
        res = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']

        # Now close the register shift
        self.shift.status = DailyRegisterShift.STATUS_CLOSED
        self.shift.closed_at = timezone.now()
        self.shift.save()

        # Attempt to edit payment method
        detail_url = reverse('sale-order-detail', kwargs={'pk': order_id})
        patch_res = self.client.patch(detail_url, {"payment_method": "upi"}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("locked/immutable", str(patch_res.data))

        # Attempt to edit items
        patch_items_res = self.client.patch(detail_url, {
            "items": [{"item_id": self.item_in_stock.id, "quantity": 2}]
        }, format='json')
        self.assertEqual(patch_items_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("locked/immutable", str(patch_items_res.data))

    def test_current_shift_filter_excludes_historical_and_closed_orders(self):
        """
        GET /api/inventory/sales/?current_shift=true only returns orders processed
        during the currently open shift. Historical orders and orders when shift is closed are excluded.
        """
        # 1. Place order in current shift
        checkout_url = reverse('sale-order-checkout')
        res = self.client.post(checkout_url, {
            "store_id": self.store.id,
            "customer_phone": "9988776655",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 1}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_order_id = res.data['id']

        # 2. Query with current_shift=true
        list_url = reverse('sale-order-list')
        res_shift = self.client.get(list_url, {"store": self.store.id, "current_shift": "true"})
        self.assertEqual(res_shift.status_code, status.HTTP_200_OK)
        order_ids = [o['id'] for o in res_shift.data]
        self.assertIn(new_order_id, order_ids)

        # 3. Simulate historical order prior to shift opening
        past_order = SaleOrder.objects.create(
            store=self.store,
            customer_phone="1122334455",
            subtotal=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            status=SaleOrder.STATUS_COMPLETED
        )
        SaleOrder.objects.filter(id=past_order.id).update(created_at=self.shift.opened_at - datetime.timedelta(hours=5))

        res_shift2 = self.client.get(list_url, {"store": self.store.id, "current_shift": "true"})
        shift_ids = [o['id'] for o in res_shift2.data]
        self.assertNotIn(past_order.id, shift_ids)
        self.assertIn(new_order_id, shift_ids)

        # 4. If shift is closed, current_shift=true returns 0 orders
        self.shift.status = DailyRegisterShift.STATUS_CLOSED
        self.shift.save()

        res_closed = self.client.get(list_url, {"store": self.store.id, "current_shift": "true"})
        self.assertEqual(res_closed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_closed.data), 0)

    def test_lookup_for_return(self):
        """
        Verify looking up an invoice by number returns bill metadata and remaining returnable quantities.
        """
        checkout_url = reverse('sale-order-checkout')
        res = self.client.post(checkout_url, {
            "store_id": self.store.id,
            "customer_phone": "9876543210",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 2}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        inv_num = res.data['invoice_number']

        lookup_url = reverse('sale-order-lookup-for-return')

        # 1. Successful lookup
        lookup_res = self.client.get(lookup_url, {"invoice_number": inv_num})
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(lookup_res.data['invoice_number'], inv_num)
        self.assertEqual(lookup_res.data['total_returnable_units'], 2)
        self.assertFalse(lookup_res.data['is_fully_returned'])
        self.assertEqual(len(lookup_res.data['items']), 1)
        self.assertEqual(lookup_res.data['items'][0]['returnable_quantity'], 2)

        # 2. Non-existent invoice lookup
        bad_res = self.client.get(lookup_url, {"invoice_number": "INV-NONEXISTENT"})
        self.assertEqual(bad_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_process_return_workflow(self):
        """
        Complete return workflow verification:
        - Return 1 unit of a 2-unit purchase
        - Stock is restored via StockMovement (reason='return', change=+1, timestamp=NOW)
        - If refund method is cash, CounterPayout is created and active shift drawer cash is deducted
        - Returnable quantity decreases
        - Returning beyond available quantity is rejected
        - Returning final unit updates order status to 'refunded'
        """
        # 1. Checkout 2 units
        checkout_url = reverse('sale-order-checkout')
        res = self.client.post(checkout_url, {
            "store_id": self.store.id,
            "customer_phone": "9812345678",
            "payment_method": "cash",
            "items": [{"item_id": self.item_in_stock.id, "quantity": 2}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        inv_num = res.data['invoice_number']
        line_item_id = res.data['items'][0]['id']

        self.item_in_stock.refresh_from_db()
        self.assertEqual(self.item_in_stock.quantity, 8)

        # 2. Process return for 1 unit with cash refund
        process_url = reverse('sale-order-process-return')
        return_payload = {
            "invoice_number": inv_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 1}],
            "refund_payment_method": "cash",
            "notes": "Defective item returned"
        }
        return_res = self.client.post(process_url, return_payload, format='json')
        self.assertEqual(return_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(return_res.data['refund_amount'], 250.0)
        ret_order = return_res.data['return_order']
        self.assertTrue(ret_order['invoice_number'].startswith('RET-'))
        self.assertEqual(ret_order['status'], 'refunded')

        # 3. Verify stock restored by +1
        self.item_in_stock.refresh_from_db()
        self.assertEqual(self.item_in_stock.quantity, 9)

        # 4. Verify StockMovement entry
        return_mv = StockMovement.objects.filter(
            item=self.item_in_stock,
            reason=StockMovement.REASON_RETURN
        ).first()
        self.assertIsNotNone(return_mv)
        self.assertEqual(return_mv.change, 1)

        # 5. Verify CounterPayout created to deduct cash drawer
        payout = CounterPayout.objects.filter(
            category=CounterPayout.CATEGORY_REFUND,
            payment_method=CounterPayout.PAYMENT_CASH
        ).first()
        self.assertIsNotNone(payout)
        self.assertEqual(payout.amount, Decimal("250.00"))

        # 6. Verify lookup shows 1 unit returnable remaining
        lookup_url = reverse('sale-order-lookup-for-return')
        lookup_res = self.client.get(lookup_url, {"invoice_number": inv_num})
        self.assertEqual(lookup_res.data['total_returnable_units'], 1)
        self.assertFalse(lookup_res.data['is_fully_returned'])

        # 7. Attempting to return 2 units should fail
        fail_res = self.client.post(process_url, {
            "invoice_number": inv_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 2}],
            "refund_payment_method": "cash"
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 8. Return the remaining 1 unit
        final_return_res = self.client.post(process_url, {
            "invoice_number": inv_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 1}],
            "refund_payment_method": "cash"
        }, format='json')
        self.assertEqual(final_return_res.status_code, status.HTTP_201_CREATED)

        # Original order is now fully refunded
        # 9. Test payment method validation:
        # Cannot refund to Card if original order was Cash
        card_refund_res = self.client.post(process_url, {
            "invoice_number": inv_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 1}],
            "refund_payment_method": "card"
        }, format='json')
        # Since order is fully returned and not paid by card, it should reject
        self.assertEqual(card_refund_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 10. Cannot refund to VIP card if customer has no VIP card
        vip_refund_res = self.client.post(process_url, {
            "invoice_number": inv_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 1}],
            "refund_payment_method": "vip_card"
        }, format='json')
        self.assertEqual(vip_refund_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 11. Verify is_return field on serializers
        self.assertTrue(ret_order['is_return'])
        self.assertFalse(res.data.get('is_return', False))

    def test_partial_payment_checkout_dues_and_settlement(self):
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9876500000",
            "customer_name": "Arjun Verma",
            "payment_method": "partial",
            "amount_paid": "200.00",
            "initial_payment_method": "cash",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}  # 2 * 250 = 500
            ]
        }

        response = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.data['id']
        self.assertEqual(response.data['status'], SaleOrder.STATUS_PARTIAL)
        self.assertEqual(Decimal(str(response.data['total_amount'])), Decimal("500.00"))
        self.assertEqual(Decimal(str(response.data['amount_paid'])), Decimal("200.00"))
        self.assertEqual(Decimal(str(response.data['balance_due'])), Decimal("300.00"))

        # Verify dues summary API
        dues_url = reverse('sale-order-dues-summary')
        dues_res = self.client.get(dues_url)
        self.assertEqual(dues_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(dues_res.data['total_due_amount'])), Decimal("300.00"))
        self.assertEqual(dues_res.data['pending_orders_count'], 1)
        self.assertEqual(dues_res.data['unique_debtors_count'], 1)

        # Record installment 1: 150 via UPI
        record_url = reverse('sale-order-record-payment', kwargs={'pk': order_id})
        rec_res1 = self.client.post(record_url, {
            "amount": "150.00",
            "payment_method": "upi",
            "notes": "Paid half remaining via GPay"
        }, format='json')
        self.assertEqual(rec_res1.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(rec_res1.data['order']['balance_due'])), Decimal("150.00"))
        self.assertEqual(Decimal(str(rec_res1.data['order']['amount_paid'])), Decimal("350.00"))
        self.assertEqual(rec_res1.data['order']['status'], SaleOrder.STATUS_PARTIAL)

        # Record installment 2: remaining 150 via Cash (settles in full)
        rec_res2 = self.client.post(record_url, {
            "amount": "150.00",
            "payment_method": "cash",
            "notes": "Final cash clearance"
        }, format='json')
        self.assertEqual(rec_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(rec_res2.data['order']['balance_due'])), Decimal("0.00"))
        self.assertEqual(Decimal(str(rec_res2.data['order']['amount_paid'])), Decimal("500.00"))
        self.assertEqual(rec_res2.data['order']['status'], SaleOrder.STATUS_COMPLETED)

        # Verify dues summary is now 0
        dues_res_after = self.client.get(dues_url)
        self.assertEqual(Decimal(str(dues_res_after.data['total_due_amount'])), Decimal("0.00"))
        self.assertEqual(dues_res_after.data['pending_orders_count'], 0)

    def test_item_stock_level_numerical_filters(self):
        items_url = reverse('item-list')

        # item_in_stock has qty 10, item_out_of_stock has qty 0
        res_min = self.client.get(items_url, {'min_stock': 5})
        self.assertEqual(res_min.status_code, status.HTTP_200_OK)
        results_min = res_min.data if isinstance(res_min.data, list) else res_min.data.get('results', [])
        item_ids_min = [it['id'] for it in results_min]
        self.assertIn(self.item_in_stock.id, item_ids_min)
        self.assertNotIn(self.item_out_of_stock.id, item_ids_min)

        res_max = self.client.get(items_url, {'max_stock': 2})
        self.assertEqual(res_max.status_code, status.HTTP_200_OK)
        results_max = res_max.data if isinstance(res_max.data, list) else res_max.data.get('results', [])
        item_ids_max = [it['id'] for it in results_max]
        self.assertIn(self.item_out_of_stock.id, item_ids_max)
        self.assertNotIn(self.item_in_stock.id, item_ids_max)

    def test_customer_dues_and_history_tracking(self):
        # 1. Customer places a partial / udhar order with 0 paid
        checkout_url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9988776655",
            "customer_name": "Suresh Patel",
            "payment_method": "partial",
            "amount_paid": "0.00",
            "items": [
                {"item_id": self.item_in_stock.id, "quantity": 2}
            ]
        }
        res = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']
        self.assertEqual(Decimal(str(res.data['balance_due'])), Decimal("500.00"))
        self.assertEqual(Decimal(str(res.data['amount_paid'])), Decimal("0.00"))

        cust = Customer.objects.get(phone="9988776655")
        
        # 2. Check Customer list serializer has total_outstanding_dues = 500.0
        cust_url = reverse('customer-detail', args=[cust.id])
        cust_res = self.client.get(cust_url)
        self.assertEqual(cust_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cust_res.data['total_outstanding_dues'], 500.0)

        # 3. Check customer history endpoint includes payments
        history_url = reverse('customer-history', args=[cust.id])
        history_res = self.client.get(history_url)
        self.assertEqual(history_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history_res.data), 1)
        self.assertEqual(history_res.data[0]['id'], order_id)
        self.assertEqual(Decimal(str(history_res.data[0]['balance_due'])), Decimal("500.00"))

        # 4. Record partial payment of 200
        rec_url = reverse('sale-order-record-payment', args=[order_id])
        rec_res = self.client.post(rec_url, {
            'amount': '200.00',
            'payment_method': 'cash',
            'notes': 'Installment 1'
        }, format='json')
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)

        # 5. Customer outstanding dues should now be 300.0
        cust_res2 = self.client.get(cust_url)
        self.assertEqual(cust_res2.data['total_outstanding_dues'], 300.0)

        # 6. Customer history now returns 1 payment transaction in order.payments
        history_res2 = self.client.get(history_url)
        self.assertEqual(len(history_res2.data[0]['payments']), 1)
        self.assertEqual(Decimal(str(history_res2.data[0]['payments'][0]['amount'])), Decimal("200.00"))

    def test_whatsapp_rate_limiting_and_protections(self):
        """Verifies that WhatsApp rate limits, order cooldowns, and daily caps are strictly enforced."""
        from django.core.cache import cache
        from inventory.whatsapp_service import (
            check_and_increment_whatsapp_limits,
            record_successful_whatsapp_send,
            ORDER_RESEND_COOLDOWN_SECONDS,
            MAX_MESSAGES_PER_PHONE_PER_HOUR,
            MAX_DAILY_WHATSAPP_MESSAGES
        )
        cache.clear()

        test_order_id = 999
        test_phone = '919876543210'

        # 1. First send check should be allowed
        allowed, msg = check_and_increment_whatsapp_limits(test_order_id, test_phone)
        self.assertTrue(allowed)
        self.assertEqual(msg, "")

        # 2. Record send success
        record_successful_whatsapp_send(test_order_id, test_phone)

        # 3. Immediate re-send of the same order without force should be blocked by cooldown
        allowed, msg = check_and_increment_whatsapp_limits(test_order_id, test_phone, force_resend=False)
        self.assertFalse(allowed)
        self.assertIn("already sent recently", msg)

        # 4. Forced resend bypasses per-order cooldown
        allowed_forced, _ = check_and_increment_whatsapp_limits(test_order_id, test_phone, force_resend=True)
        self.assertTrue(allowed_forced)

        # 5. Exceeding hourly per-phone limit should block
        phone_rate_key = f"wa_rate_phone:{test_phone}"
        cache.set(phone_rate_key, MAX_MESSAGES_PER_PHONE_PER_HOUR)
        allowed_phone_limit, err_phone = check_and_increment_whatsapp_limits(1001, test_phone, force_resend=True)
        self.assertFalse(allowed_phone_limit)
        self.assertIn("Too many messages sent to phone", err_phone)

        # 6. Exceeding daily store quota should block all outbound sends
        cache.clear()
        today_str = timezone.now().strftime('%Y-%m-%d')
        daily_count_key = f"wa_quota_daily:{today_str}"
        cache.set(daily_count_key, MAX_DAILY_WHATSAPP_MESSAGES)

        allowed_daily, err_daily = check_and_increment_whatsapp_limits(1002, '919111222333')
        self.assertFalse(allowed_daily)
        self.assertIn("daily limit reached", err_daily)

    def test_whatsapp_return_receipt_template_separation(self):
        """Verifies that return vouchers use return template with return receipt variables."""
        from django.core.cache import cache
        from unittest.mock import patch, MagicMock
        from inventory.whatsapp_service import send_whatsapp_bill_for_order

        cache.clear()

        # Create normal sale order
        sale = SaleOrder.objects.create(
            store=self.store,
            invoice_number="INV-99001",
            subtotal=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            payment_method="cash",
            customer_name="Aarav Sharma",
            customer_phone="9876543210"
        )

        # Create return order
        ret = SaleOrder.objects.create(
            store=self.store,
            invoice_number="RET-0042",
            return_reference="INV-99001",
            subtotal=Decimal("250.00"),
            total_amount=Decimal("250.00"),
            payment_method="cash",
            customer_name="Aarav Sharma",
            customer_phone="9876543210",
            status="completed"
        )

        with patch('requests.post') as mock_post:
            # Mock media upload response
            upload_response = MagicMock()
            upload_response.status_code = 200
            upload_response.json.return_value = {'id': 'media_12345'}

            # Mock message send response
            send_response = MagicMock()
            send_response.status_code = 200
            send_response.json.return_value = {'messages': [{'id': 'wamid_12345'}]}

            mock_post.side_effect = [upload_response, send_response, upload_response, send_response]

            # 1. Send normal sale bill
            success, _, _ = send_whatsapp_bill_for_order(sale, force_resend=True)
            self.assertTrue(success)
            bill_send_call = mock_post.call_args_list[1]
            bill_payload = bill_send_call.kwargs.get('json', {})
            self.assertEqual(bill_payload['template']['name'], 'bill')
            self.assertEqual(len(bill_payload['template']['components'][1]['parameters']), 6)
            self.assertEqual(bill_payload['template']['components'][1]['parameters'][1]['text'], 'INV-99001')

            # 2. Send return voucher
            success_ret, _, _ = send_whatsapp_bill_for_order(ret, force_resend=True)
            self.assertTrue(success_ret)
            ret_send_call = mock_post.call_args_list[3]
            ret_payload = ret_send_call.kwargs.get('json', {})
            self.assertEqual(ret_payload['template']['name'], 'return_receipt')
            # 7 parameters: cust_name, voucher_no, orig_bill_no, date, qty, refund_mode, refund_amt
            self.assertEqual(len(ret_payload['template']['components'][1]['parameters']), 7)
            self.assertEqual(ret_payload['template']['components'][1]['parameters'][0]['text'], 'Aarav Sharma')
            self.assertEqual(ret_payload['template']['components'][1]['parameters'][1]['text'], 'RET-0042')
            self.assertEqual(ret_payload['template']['components'][1]['parameters'][2]['text'], 'INV-99001')
            self.assertEqual(ret_payload['template']['components'][1]['parameters'][6]['text'], '250.00')

        # 3. Test fallback to "Dear Customer" when customer name is absent
        sale_no_name = SaleOrder.objects.create(
            store=self.store,
            invoice_number="INV-99002",
            subtotal=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payment_method="cash",
            customer_name="",
            customer_phone="9876543210"
        )
        with patch('requests.post') as mock_post2:
            up_resp = MagicMock(status_code=200)
            up_resp.json.return_value = {'id': 'media_99'}
            snd_resp = MagicMock(status_code=200)
            snd_resp.json.return_value = {'messages': [{'id': 'wamid_99'}]}
            mock_post2.side_effect = [up_resp, snd_resp]

            success_nn, _, _ = send_whatsapp_bill_for_order(sale_no_name, force_resend=True)
            self.assertTrue(success_nn)
            payload_nn = mock_post2.call_args_list[1].kwargs.get('json', {})
            self.assertEqual(payload_nn['template']['components'][1]['parameters'][0]['text'], 'Dear Customer')










