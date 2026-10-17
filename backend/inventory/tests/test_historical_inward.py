import json
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Item, Customer, SaleOrder, SaleOrderItem, DailyRegisterShift
from staff.models import StaffMember, StaffRole


class HistoricalInwardProductionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Test Bhopal Store")

        self.role = StaffRole.objects.create(name="Owner", is_owner=True)
        self.staff = StaffMember.objects.create(
            name="Salman Owner",
            store=self.store,
            role=self.role,
            is_active=True
        )
        self.client.force_authenticate(user=None)
        # Mock authenticated session header if needed by get_current_staff
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer mock_token_{self.staff.id}")

        from inventory.services import adjust_stock
        from inventory.models import StockMovement

        # Catalog items initialized through stock ledger
        self.item1 = Item.objects.create(
            store=self.store,
            name="Dart Mini AT217",
            uid="24439",
            selling_price=Decimal("289.00"),
            cost_price=Decimal("150.00"),
        )
        adjust_stock(item=self.item1, change=10, reason=StockMovement.REASON_RESTOCK, performed_by=self.staff)

        self.item2 = Item.objects.create(
            store=self.store,
            name="MOON BALL 7CM",
            uid="25461",
            selling_price=Decimal("49.00"),
            cost_price=Decimal("20.00"),
        )
        adjust_stock(item=self.item2, change=50, reason=StockMovement.REASON_RESTOCK, performed_by=self.staff)

    def test_strict_catalog_verification_gate_rejects_missing_item(self):
        """
        Verify that commit-historical-batch rejects any bill containing an item
        that does not exist in the store's inventory database.
        """
        payload = {
            "store_id": self.store.id,
            "batch_datetime": "2026-10-10T12:00:00",
            "deduct_inventory_stock": False,
            "bills": [
                {
                    "bill_index": 1,
                    "customer_phone": "9893042523",
                    "payment_method": "card",
                    "total_amount": 338.00,
                    "items": [
                        {
                            "item_id": self.item1.id,
                            "item_uid": self.item1.uid,
                            "item_name": self.item1.name,
                            "quantity": 1,
                            "unit_price": 289.00,
                            "total_price": 289.00
                        },
                        {
                            "item_id": 999999,  # Non-existent item ID
                            "item_uid": "NON_EXISTENT_UID",
                            "item_name": "Ghost Item",
                            "quantity": 1,
                            "unit_price": 49.00,
                            "total_price": 49.00
                        }
                    ]
                }
            ]
        }

        url = reverse("sale-order-commit-historical-batch")
        response = self.client.post(url, data=json.dumps(payload), content_type="application/json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Production Gate Rejection", response.data.get("error", ""))
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_valid_historical_batch_commit_and_shift_isolation(self):
        """
        Verify that a batch with verified items commits properly,
        sets is_backdated=True and created_at=batch_dt, and is 100% EXCLUDED
        from active DailyRegisterShift live expected cash!
        """
        # 1. Open an active cashier shift for today
        shift = DailyRegisterShift.objects.create(
            store=self.store,
            cashier=self.staff,
            cashier_name=self.staff.name,
            opening_cash=Decimal("1000.00"),
            status=DailyRegisterShift.STATUS_OPEN,
            opened_at=timezone.now()
        )

        # 2. Commit a historical backdated CASH bill from 2 days ago
        batch_dt_str = "2026-10-10T14:30:00"
        payload = {
            "store_id": self.store.id,
            "batch_datetime": batch_dt_str,
            "deduct_inventory_stock": True,
            "sheet_reference": "10/10/26 Kitchen Utility Board",
            "bills": [
                {
                    "bill_index": 1,
                    "customer_phone": "9893042523",
                    "payment_method": "cash",
                    "items": [
                        {
                            "item_id": self.item1.id,
                            "item_uid": self.item1.uid,
                            "item_name": self.item1.name,
                            "quantity": 1,
                            "unit_price": 289.00,
                            "total_price": 289.00
                        },
                        {
                            "item_id": self.item2.id,
                            "item_uid": self.item2.uid,
                            "item_name": self.item2.name,
                            "quantity": 2,
                            "unit_price": 49.00,
                            "total_price": 98.00
                        }
                    ]
                }
            ]
        }

        url = reverse("sale-order-commit-historical-batch")
        response = self.client.post(url, data=json.dumps(payload), content_type="application/json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SaleOrder.objects.count(), 1)

        order = SaleOrder.objects.first()
        self.assertTrue(order.is_backdated)
        self.assertEqual(order.total_amount, Decimal("387.00"))
        self.assertEqual(order.payment_method, "cash")
        self.assertEqual(order.customer_phone, "9893042523")
        self.assertEqual(order.items.count(), 2)

        # Ensure created_at equals the manual batch date (2026-10-10)
        self.assertEqual(order.created_at.year, 2026)
        self.assertEqual(order.created_at.month, 10)
        self.assertEqual(order.created_at.day, 10)
        self.assertTrue(order.inventory_deducted)

        # Inventory deduction invariant: items must have stock decremented
        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        self.assertEqual(self.item1.quantity, 9)   # 10 - 1
        self.assertEqual(self.item2.quantity, 48)  # 50 - 2

        # 3. CRITICAL PRODUCTION INVARIANT:
        # Check active register shift live summary. The ₹387.00 cash from the past bill
        # MUST NOT be included in today's live shift cash sales or expected cash!
        shift_url = f"/api/inventory/register-shifts/current-shift/?store={self.store.id}"
        shift_resp = self.client.get(shift_url)

        self.assertEqual(shift_resp.status_code, status.HTTP_200_OK)
        live_shift = shift_resp.data.get("shift", {})

        # Cash sales for today's shift must remain 0.00
        self.assertEqual(Decimal(str(live_shift.get("cash_sales_amount", 0))), Decimal("0.00"))
        # Expected cash in drawer must equal opening cash (1000.00), NOT 1387.00!
        self.assertEqual(Decimal(str(live_shift.get("expected_cash", 0))), Decimal("1000.00"))

    def test_historical_batch_rejects_deductions_exceeding_stock(self):
        """
        Verify that commit-historical-batch rejects any batch where stock deduction
        exceeds current inventory, preventing negative stock.
        """
        # self.item1 has 10 units
        payload = {
            "store_id": self.store.id,
            "batch_datetime": "2026-10-10T12:00:00",
            "deduct_inventory_stock": True,
            "bills": [
                {
                    "bill_index": 1,
                    "customer_phone": "9893042523",
                    "payment_method": "cash",
                    "total_amount": 2890.00,
                    "items": [
                        {
                            "item_id": self.item1.id,
                            "item_uid": self.item1.uid,
                            "item_name": self.item1.name,
                            "quantity": 15,  # 15 > 10 available
                            "unit_price": 289.00,
                            "total_price": 4335.00
                        }
                    ]
                }
            ]
        }

        url = reverse("sale-order-commit-historical-batch")
        response = self.client.post(url, data=json.dumps(payload), content_type="application/json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("negative inventory", response.data.get("error", "").lower())
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.quantity, 10)  # Stock untouched
        self.assertEqual(SaleOrder.objects.count(), 0)
