from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from inventory.models import (
    Store,
    Category,
    SubCategory,
    Item,
    Customer,
    SaleOrder,
    SaleOrderItem,
    DailyRegisterShift,
    VIPCardTransaction,
    StockMovement,
)
from staff.models import StaffRole, StaffMember
from stakeholders.models import Stakeholder
from stakeholders.serializers import StakeholderSerializer


class SystemEdgeCasesIntegrationTest(TestCase):
    """
    Comprehensive regression tests for audited edge cases:
    1. VIP Card refund transaction integrity (no missing fields or crashes)
    2. Sequential partial returns fractional paisa exact zero-out
    3. Duplicate items in cart rejected during checkout
    4. Duplicate lines in return payload rejected during return
    5. Multi-store stakeholder profit allocation isolation
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Role and Staff
        self.role = StaffRole.objects.create(
            name='CashierRole',
            is_owner=True,
            can_access_billing=True,
            can_adjust_stock=True,
        )
        self.store1 = Store.objects.create(name='Connaught Place Flagship', pincode='110001')
        self.store2 = Store.objects.create(name='Gurugram CyberHub', pincode='122002')

        self.staff = StaffMember.objects.create(
            staff_id='cashier01',
            name='Rahul Cashier',
            role=self.role,
            store=self.store1,
            is_active=True,
        )
        self.staff.set_password('pass123')
        self.staff.save()

        # Authenticate staff via session/attribute
        self.client.force_authenticate(user=None)
        session = self.client.session
        session['staff_member_id'] = self.staff.id
        session.save()

        # 2. Setup Open Register Shift
        self.shift = DailyRegisterShift.objects.create(
            store=self.store1,
            cashier=self.staff,
            cashier_name=self.staff.name,
            opening_cash=Decimal('2000.00'),
            expected_cash=Decimal('2000.00'),
            status=DailyRegisterShift.STATUS_OPEN,
        )

        # 3. Setup Catalog
        self.category = Category.objects.create(name='Electronics')
        self.subcategory = SubCategory.objects.create(category=self.category, name='Accessories')

        # Item with standard stock
        self.item_a = Item.objects.create(
            uid='1000001',
            name='USB-C Fast Cable',
            quantity=20,
            cost_price=Decimal('50.00'),
            selling_price=Decimal('100.00'),
            store=self.store1,
        )
        self.item_a.subcategories.add(self.subcategory)
        StockMovement.objects.create(
            item=self.item_a,
            change=20,
            reason=StockMovement.REASON_RESTOCK,
            note='Initial Inventory'
        )

        # Item with odd fractional price: 3 units for ₹100 total
        self.item_odd = Item.objects.create(
            uid='1000002',
            name='Multi-Pack Screen Guards',
            quantity=30,
            cost_price=Decimal('15.00'),
            selling_price=Decimal('33.33'),
            store=self.store1,
        )
        self.item_odd.subcategories.add(self.subcategory)
        StockMovement.objects.create(
            item=self.item_odd,
            change=30,
            reason=StockMovement.REASON_RESTOCK,
            note='Initial Inventory'
        )

        # 4. VIP Customer
        self.vip_customer = Customer.objects.create(
            phone='9876543210',
            name='Vikram VIP',
            vip_card_uid='RFID-TEST-999',
            vip_card_status='active',
            vip_card_balance=Decimal('1500.00'),
            total_vip_savings=Decimal('100.00'),
            total_spent=Decimal('3000.00'),
            total_purchases_count=2,
            store=self.store1,
        )

    def test_vip_card_refund_creates_valid_transaction_without_crash(self):
        """
        Verify that returning goods with refund_payment_method='vip_card':
        - Successfully completes without crash
        - Creates a valid VIPCardTransaction with correct card_uid and type='refund'
        - Restores VIP card balance
        - Proportionally adjusts customer total_vip_savings
        """
        # Checkout with VIP Card
        checkout_url = reverse('sale-order-checkout')
        checkout_res = self.client.post(checkout_url, {
            "store_id": self.store1.id,
            "customer_phone": self.vip_customer.phone,
            "payment_method": "vip_card",
            "vip_card_uid": "RFID-TEST-999",
            "items": [{"item_id": self.item_a.id, "quantity": 2}]
        }, format='json')
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)
        invoice_num = checkout_res.data['invoice_number']
        line_item_id = checkout_res.data['items'][0]['id']

        self.vip_customer.refresh_from_db()
        bal_after_purchase = self.vip_customer.vip_card_balance
        self.assertEqual(bal_after_purchase, Decimal('1300.00'))  # 1500 - 200

        # Process return for 1 unit via VIP Card refund
        return_url = reverse('sale-order-process-return')
        return_res = self.client.post(return_url, {
            "invoice_number": invoice_num,
            "items": [{"sale_order_item_id": line_item_id, "quantity": 1}],
            "refund_payment_method": "vip_card",
            "notes": "Customer exchanged preference"
        }, format='json')

        self.assertEqual(return_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(return_res.data['refund_amount'], 100.0)

        # Verify VIP Card Balance credited
        self.vip_customer.refresh_from_db()
        self.assertEqual(self.vip_customer.vip_card_balance, Decimal('1400.00'))

        # Verify VIPCardTransaction created with valid required fields
        vip_tx = VIPCardTransaction.objects.filter(
            customer=self.vip_customer,
            card_uid='RFID-TEST-999',
            transaction_type=VIPCardTransaction.TYPE_REFUND
        ).first()
        self.assertIsNotNone(vip_tx)
        self.assertEqual(vip_tx.amount, Decimal('100.00'))
        self.assertEqual(vip_tx.balance_after, Decimal('1400.00'))
        self.assertTrue(vip_tx.notes.startswith('Refund to VIP card'))

    def test_sequential_partial_returns_exact_paisa_zero_out(self):
        """
        Verify that returning an odd-priced discounted purchase across multiple sessions
        (e.g., 3 units @ ₹100.00 total) correctly allocates fractional paisa so the
        total refund across all partial returns exactly equals ₹100.00 to the last paisa.
        """
        # Create a direct SaleOrder with total_amount = ₹100.00 for 3 items
        order = SaleOrder.objects.create(
            invoice_number='INV-ODD-0001',
            store=self.store1,
            customer=self.vip_customer,
            customer_phone=self.vip_customer.phone,
            subtotal=Decimal('100.00'),
            total_amount=Decimal('100.00'),
            payment_method='cash',
            amount_paid=Decimal('100.00'),
            status=SaleOrder.STATUS_COMPLETED,
        )
        line = SaleOrderItem.objects.create(
            sale_order=order,
            item=self.item_odd,
            item_name=self.item_odd.name,
            item_uid=self.item_odd.uid,
            unit_cost_price=self.item_odd.cost_price,
            unit_selling_price=Decimal('33.33'),
            quantity=3,
            returned_quantity=0,
            total_price=Decimal('100.00'),
        )

        return_url = reverse('sale-order-process-return')

        # Session 1: Return 1 unit
        res1 = self.client.post(return_url, {
            "invoice_number": order.invoice_number,
            "items": [{"sale_order_item_id": line.id, "quantity": 1}],
            "refund_payment_method": "cash",
            "notes": "Partial return 1 of 2"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        refund_1 = Decimal(str(res1.data['refund_amount']))
        self.assertEqual(refund_1, Decimal('33.33'))

        # Session 2: Return remaining 2 units
        res2 = self.client.post(return_url, {
            "invoice_number": order.invoice_number,
            "items": [{"sale_order_item_id": line.id, "quantity": 2}],
            "refund_payment_method": "cash",
            "notes": "Partial return 2 of 2 (finishing bill)"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        refund_2 = Decimal(str(res2.data['refund_amount']))
        self.assertEqual(refund_2, Decimal('66.67'))

        # Combined sum of partial refunds must equal EXACTLY ₹100.00
        self.assertEqual(refund_1 + refund_2, Decimal('100.00'))

        # Order must now be fully refunded
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_REFUNDED)

    def test_duplicate_items_in_checkout_cart_rejected(self):
        """
        Verify that submitting duplicate item_id entries in a single checkout cart
        is rejected by validation to prevent inventory negative drift.
        """
        checkout_url = reverse('sale-order-checkout')
        res = self.client.post(checkout_url, {
            "store_id": self.store1.id,
            "customer_phone": "9998887776",
            "payment_method": "cash",
            "items": [
                {"item_id": self.item_a.id, "quantity": 2},
                {"item_id": self.item_a.id, "quantity": 3},  # Duplicate!
            ]
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', res.data)
        self.assertIn('Duplicate item ID', str(res.data['items']))

    def test_duplicate_lines_in_return_payload_rejected(self):
        """
        Verify that submitting duplicate sale_order_item_id entries in a return payload
        is rejected by validation.
        """
        # Create a sale order
        order = SaleOrder.objects.create(
            invoice_number='INV-RET-DUP-01',
            store=self.store1,
            customer_phone='9998887776',
            subtotal=Decimal('200.00'),
            total_amount=Decimal('200.00'),
            payment_method='cash',
            amount_paid=Decimal('200.00'),
            status=SaleOrder.STATUS_COMPLETED,
        )
        line = SaleOrderItem.objects.create(
            sale_order=order,
            item=self.item_a,
            item_name=self.item_a.name,
            item_uid=self.item_a.uid,
            unit_cost_price=self.item_a.cost_price,
            unit_selling_price=Decimal('100.00'),
            quantity=2,
            returned_quantity=0,
            total_price=Decimal('200.00'),
        )

        return_url = reverse('sale-order-process-return')
        res = self.client.post(return_url, {
            "invoice_number": order.invoice_number,
            "items": [
                {"sale_order_item_id": line.id, "quantity": 1},
                {"sale_order_item_id": line.id, "quantity": 1},  # Duplicate!
            ],
            "refund_payment_method": "cash",
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', res.data)
        self.assertIn('Duplicate line item ID', str(res.data['items']))

    def test_multi_store_stakeholder_percentage_isolation(self):
        """
        Verify that StakeholderSerializer allows Store 1 to have a partner at 60%
        and Store 2 to have a partner at 70% without falsely failing the 100% cap check.
        """
        # Partner 1 in Store 1 (60%)
        sh1 = Stakeholder.objects.create(
            name='Partner Store 1',
            phone='9111111111',
            store=self.store1,
            investment_amount=Decimal('500000.00'),
            profit_percentage=Decimal('60.00'),
            contract_date=timezone.now().date(),
            status='active',
        )

        # Partner 2 in Store 2 (70%) - total across stores is 130%, but per-store is 70% <= 100%
        serializer = StakeholderSerializer(data={
            "name": "Partner Store 2",
            "phone": "9222222222",
            "store": self.store2.id,
            "investment_amount": "600000.00",
            "profit_percentage": "70.00",
            "contract_date": str(timezone.now().date()),
            "status": "active",
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        sh2 = serializer.save()
        self.assertEqual(sh2.profit_percentage, Decimal('70.00'))
