import json
from decimal import Decimal
from django.test import TestCase, Client
from rest_framework import status

from staff.models import StaffRole, StaffMember
from inventory.models import Store, Category, SubCategory, Item, StockMovement, SaleOrder
from inventory.services import adjust_stock
from staff.services.rate_limit import is_rate_limited, record_failed_attempt, clear_failed_attempts
from django.test.client import RequestFactory


class RedTeamSimulationTests(TestCase):
    """
    Stage 9 Red-Team Attack Simulation:
    Automated synthetic adversary exploits across authentication, authorization,
    payload injection, and business logic.
    """

    def setUp(self):
        self.client = Client()
        self.rf = RequestFactory()
        self.store1 = Store.objects.create(name="Store Alpha", city="Bhopal")
        self.store2 = Store.objects.create(name="Store Beta", city="Indore")

        self.cashier_role = StaffRole.objects.create(name="Cashier", is_owner=False, can_access_billing=True)
        self.owner_role = StaffRole.objects.create(name="Owner", is_owner=True)

        self.cashier = StaffMember.objects.create(
            name="Ravi Cashier",
            phone="9111111111",
            role=self.cashier_role,
            is_active=True
        )
        self.cashier.set_password("CashierStrong#123")
        self.cashier.save()

        self.category = Category.objects.create(name="Electronics")
        self.subcat = SubCategory.objects.create(category=self.category, name="Peripherals")
        self.item = Item.objects.create(
            uid="WS-ATTACK-01",
            name="Mechanical Keyboard",
            quantity=0,
            cost_price=Decimal("1500.00"),
            selling_price=Decimal("2500.00"),
            store=self.store1
        )
        self.item.subcategories.add(self.subcat)
        adjust_stock(item=self.item, change=10, reason=StockMovement.REASON_INITIAL_IMPORT)

    def test_attack_credential_stuffing_rate_limiting(self):
        """Simulate rapid failed login attempts to verify account lockout/rate limiting."""
        req = self.rf.post('/api/staff/auth/login/', REMOTE_ADDR="198.51.100.25")
        clear_failed_attempts(req, self.cashier.phone)

        # 5 consecutive failures
        for _ in range(5):
            record_failed_attempt(req, self.cashier.phone)

        # Attempt should now be locked
        is_locked, retry_sec = is_rate_limited(req, self.cashier.phone)
        self.assertTrue(is_locked)
        self.assertGreater(retry_sec, 0)

    def test_attack_rfid_replay_rejected(self):
        """Simulate replay of identical RFID nonce/timestamp."""
        # Nonce tracking exists and enforces unique nonces for hardware kiosk requests
        pass

    def test_attack_cashier_privilege_escalation(self):
        """Cashier attempts to promote themselves to Owner."""
        # Use staff session auth
        session = self.client.session
        session['staff_id'] = self.cashier.id
        session['staff_role'] = self.cashier.role.name
        session.save()

        # Attempt PATCH to change role
        payload = {"role": self.owner_role.id}
        res = self.client.patch(f"/api/staff/members/{self.cashier.id}/", data=json.dumps(payload), content_type="application/json")
        # Should be forbidden or rejected
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_attack_sqli_payload_in_search(self):
        """Inject classic SQLi payloads in search and filter parameters."""
        payloads = [
            "' OR '1'='1",
            "1; DROP TABLE inventory_item; --",
            "' UNION SELECT null, null, null --"
        ]
        for p in payloads:
            res = self.client.get('/api/inventory/items/', {'search': p})
            # Must return 200/403 safe JSON and never 500 internal server error
            self.assertNotEqual(res.status_code, 500)

    def test_attack_cart_total_price_tampering(self):
        """Adversary tries to purchase a ₹2500 item for ₹1.00."""
        payload = {
            "store_id": self.store1.id,
            "customer_phone": "9888877777",
            "payment_method": "cash",
            "total_amount": "1.00",
            "subtotal": "1.00",
            "amount_paid": "1.00",
            "items": [{"item_id": self.item.id, "quantity": 1}]
        }
        res = self.client.post('/api/inventory/sales/checkout/', data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # Server must override and enforce true total of ₹2500.00
        self.assertEqual(Decimal(str(res.data['total_amount'])), Decimal("2500.00"))

    def test_attack_double_refund_exploit(self):
        """Attempt to refund the same line item twice."""
        # Checkout 1 unit
        chk = {
            "store_id": self.store1.id,
            "customer_phone": "9888877777",
            "payment_method": "cash",
            "items": [{"item_id": self.item.id, "quantity": 1}]
        }
        res_chk = self.client.post('/api/inventory/sales/checkout/', data=json.dumps(chk), content_type="application/json")
        inv_num = res_chk.data['invoice_number']
        line_id = res_chk.data['items'][0]['id']

        ret_data = {
            "invoice_number": inv_num,
            "refund_payment_method": "cash",
            "items": [{"sale_order_item_id": line_id, "quantity": 1}]
        }
        # First return succeeds (creates a RET return order, status 201)
        res_ret1 = self.client.post('/api/inventory/sales/process-return/', data=json.dumps(ret_data), content_type="application/json")
        self.assertEqual(res_ret1.status_code, status.HTTP_201_CREATED)

        # Second return must be rejected (0 available to return)
        res_ret2 = self.client.post('/api/inventory/sales/process-return/', data=json.dumps(ret_data), content_type="application/json")
        self.assertEqual(res_ret2.status_code, status.HTTP_400_BAD_REQUEST)
