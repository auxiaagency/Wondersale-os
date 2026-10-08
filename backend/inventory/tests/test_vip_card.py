from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item, StockMovement, Customer, SaleOrder, VIPCardTransaction
from inventory.services import adjust_stock


class VIPCardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Wonder Store Bhopal", city="Bhopal")
        self.category = Category.objects.create(name="Electronics")
        self.subcategory = SubCategory.objects.create(category=self.category, name="Accessories")

        self.item = Item.objects.create(
            uid="WS-VIP-001",
            name="Fast Charging Cable",
            quantity=0,
            cost_price=Decimal("150.00"),
            selling_price=Decimal("200.00"),
            mrp=Decimal("250.00"),
            store=self.store,
        )
        self.item.subcategories.add(self.subcategory)
        adjust_stock(item=self.item, change=20, reason=StockMovement.REASON_INITIAL_IMPORT)

        self.customer = Customer.objects.create(
            store=self.store,
            phone="9876543210",
            name="Amit Verma",
        )

    def test_assign_vip_card_with_initial_credit(self):
        url = reverse('customer-assign-card', kwargs={'pk': self.customer.id})
        payload = {
            "card_uid": "RFID-AMIT-001",
            "initial_credit": "500.00"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.vip_card_uid, "RFID-AMIT-001")
        self.assertEqual(self.customer.vip_card_balance, Decimal("500.00"))
        self.assertEqual(self.customer.vip_card_status, "active")

        # Verify transaction logged
        tx = VIPCardTransaction.objects.filter(customer=self.customer, transaction_type=VIPCardTransaction.TYPE_ISSUE).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal("500.00"))
        self.assertEqual(tx.balance_after, Decimal("500.00"))

    def test_assign_duplicate_card_uid_fails(self):
        # Assign to customer 1
        self.customer.vip_card_uid = "RFID-SHARED-001"
        self.customer.save()

        # Try to assign same UID to customer 2
        cust2 = Customer.objects.create(phone="9123456780", name="Second Customer", store=self.store)
        url = reverse('customer-assign-card', kwargs={'pk': cust2.id})
        payload = {"card_uid": "RFID-SHARED-001", "initial_credit": "500.00"}
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already assigned", str(res.data))

    def test_recharge_vip_card(self):
        # Assign card first
        self.customer.vip_card_uid = "RFID-RECHARGE-001"
        self.customer.vip_card_balance = Decimal("200.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        url = reverse('customer-recharge-card', kwargs={'pk': self.customer.id})
        payload = {"amount": "1000.00", "notes": "Online Top-up"}
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.vip_card_balance, Decimal("1200.00"))

        tx = VIPCardTransaction.objects.filter(customer=self.customer, transaction_type=VIPCardTransaction.TYPE_RECHARGE).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal("1000.00"))
        self.assertEqual(tx.balance_after, Decimal("1200.00"))

    def test_lookup_customer_by_card_uid(self):
        self.customer.vip_card_uid = "RFID-LOOKUP-777"
        self.customer.save()

        url = f"{reverse('customer-lookup-card')}?card_uid=RFID-LOOKUP-777"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['phone'], "9876543210")
        self.assertEqual(res.data['vip_card_uid'], "RFID-LOOKUP-777")

    def test_checkout_with_vip_card_success(self):
        # Customer has 500 credits
        self.customer.vip_card_uid = "RFID-PAY-999"
        self.customer.vip_card_balance = Decimal("500.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        url = reverse('sale-order-checkout')
        # Total price: 2 * 200 = 400. 5% VIP discount = 20. Payable = 380.
        payload = {
            "store_id": self.store.id,
            "customer_phone": self.customer.phone,
            "payment_method": "vip_card",
            "vip_card_uid": "RFID-PAY-999",
            "discount_amount": "20.00",
            "items": [
                {"item_id": self.item.id, "quantity": 2}
            ]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.customer.refresh_from_db()
        # Balance was 500, payable was 380 -> remaining balance = 120
        self.assertEqual(self.customer.vip_card_balance, Decimal("120.00"))
        self.assertEqual(self.customer.total_vip_savings, Decimal("20.00"))

        order = SaleOrder.objects.get(invoice_number=res.data['invoice_number'])
        self.assertEqual(order.payment_method, "vip_card")
        self.assertEqual(order.vip_card_uid, "RFID-PAY-999")
        self.assertEqual(order.total_amount, Decimal("380.00"))

        # Verify debit transaction logged
        debit_tx = VIPCardTransaction.objects.filter(customer=self.customer, transaction_type=VIPCardTransaction.TYPE_DEBIT).first()
        self.assertIsNotNone(debit_tx)
        self.assertEqual(debit_tx.amount, Decimal("380.00"))
        self.assertEqual(debit_tx.balance_after, Decimal("120.00"))

    def test_checkout_fails_if_insufficient_vip_card_balance(self):
        # Customer only has 100 credits, but total bill is 400
        self.customer.vip_card_uid = "RFID-LOW-BAL"
        self.customer.vip_card_balance = Decimal("100.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": self.customer.phone,
            "payment_method": "vip_card",
            "vip_card_uid": "RFID-LOW-BAL",
            "items": [
                {"item_id": self.item.id, "quantity": 2}
            ]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient VIP Card balance", str(res.data))

    def test_checkout_fails_if_card_uid_mismatched(self):
        self.customer.vip_card_uid = "RFID-CORRECT-UID"
        self.customer.vip_card_balance = Decimal("500.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        url = reverse('sale-order-checkout')
        payload = {
            "store_id": self.store.id,
            "customer_phone": self.customer.phone,
            "payment_method": "vip_card",
            "vip_card_uid": "RFID-WRONG-UID",
            "items": [
                {"item_id": self.item.id, "quantity": 1}
            ]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not match", str(res.data))

    def test_can_change_phone_number_and_detach_vip_card(self):
        # Assign VIP card to customer
        self.customer.vip_card_uid = "RFID-DETACH-TEST"
        self.customer.vip_card_balance = Decimal("300.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        # Detach card via PATCH by setting vip_card_uid to None
        url = reverse('customer-detail', kwargs={'pk': self.customer.id})
        payload = {
            "phone": "9999999999",
            "name": "Amit Verma Updated",
            "vip_card_uid": None,
        }
        res = self.client.patch(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Confirm phone updated and card detached in DB
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.phone, "9999999999")
        self.assertIsNone(self.customer.vip_card_uid)

    def test_detach_card_action_endpoint(self):
        # Assign VIP card
        self.customer.vip_card_uid = "RFID-DETACH-ACTION"
        self.customer.vip_card_balance = Decimal("500.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        # Call detach_card action
        url = reverse('customer-detach-card', kwargs={'pk': self.customer.id})
        res = self.client.post(url, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.vip_card_uid)
        self.assertEqual(self.customer.vip_card_status, "inactive")
        self.assertEqual(self.customer.vip_card_balance, Decimal("0.00"))

    def test_edit_customer_vip_card_settings_and_balance_adjustment(self):
        self.customer.vip_card_uid = "RFID-EDIT-ORIG"
        self.customer.vip_card_balance = Decimal("200.00")
        self.customer.vip_card_status = "active"
        self.customer.save()

        # Edit VIP settings: update UID, change status to inactive, adjust balance to 600
        url = reverse('customer-detail', kwargs={'pk': self.customer.id})
        payload = {
            "phone": self.customer.phone,  # unchanged phone
            "vip_card_uid": "RFID-EDIT-NEW",
            "vip_card_status": "inactive",
            "vip_card_balance": "600.00",
        }
        res = self.client.patch(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.vip_card_uid, "RFID-EDIT-NEW")
        self.assertEqual(self.customer.vip_card_status, "inactive")
        self.assertEqual(self.customer.vip_card_balance, Decimal("600.00"))

        # Verify audit transaction created for balance adjustment (+400)
        adj_tx = VIPCardTransaction.objects.filter(
            customer=self.customer,
            card_uid="RFID-EDIT-NEW",
            amount=Decimal("400.00")
        ).first()
        self.assertIsNotNone(adj_tx)
        self.assertEqual(adj_tx.balance_after, Decimal("600.00"))

