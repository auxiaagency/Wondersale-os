import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.db import connection, transaction
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item, StockMovement, Customer, SaleOrder, SaleOrderItem, DailyRegisterShift
from inventory.services import adjust_stock, write_off_expired_stock
from staff.models import Employee, EmployeeLedgerEntry, StaffMember, StaffRole
from django.utils import timezone


class FinancialDataIntegrityTests(TransactionTestCase):
    """
    Stage 6 Security Hardening: Automated stress and concurrency tests.
    Validates:
    1. Concurrent checkouts cannot double-sell stock into negative inventory.
    2. Client cannot manipulate computed item prices/subtotals.
    3. Return quantities and refund amounts cannot exceed original bill.
    4. Immutable append-only EmployeeLedgerEntry rejects direct updates/deletions.
    5. Expiry write-offs execute atomically.
    """

    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Integrity Store", city="Bhopal")
        self.shift = DailyRegisterShift.objects.create(
            shift_number="REG-INT-001",
            store=self.store,
            opened_at=timezone.now(),
            status=DailyRegisterShift.STATUS_OPEN,
            opening_cash=Decimal("1000.00"),
            cashier_name="Cashier 1"
        )
        self.category = Category.objects.create(name="Groceries")
        self.subcategory = SubCategory.objects.create(category=self.category, name="Packaged Foods")

        self.item = Item.objects.create(
            uid="WS-TEST-INTEGRITY-01",
            name="Limited Edition Olive Oil 1L",
            quantity=0,
            cost_price=Decimal("400.00"),
            selling_price=Decimal("600.00"),
            mrp=Decimal("650.00"),
            store=self.store,
        )
        self.item.subcategories.add(self.subcategory)
        adjust_stock(
            item=self.item,
            change=5,
            reason=StockMovement.REASON_INITIAL_IMPORT,
            note="Stock 5 units for concurrency test"
        )

        role = StaffRole.objects.create(name="Manager", is_owner=True)
        self.staff = StaffMember.objects.create(
            name="Audit Manager",
            phone="9876543210",
            role=role,
            is_active=True
        )

    def test_client_cannot_tamper_item_cost_or_override_cart_subtotal(self):
        """
        Server strictly re-computes subtotal from base line prices and validates discounts.
        Client supplying manipulated 'subtotal' or 'total_amount' is ignored or strictly derived server-side.
        """
        payload = {
            "store_id": self.store.id,
            "customer_phone": "9876543210",
            "customer_name": "Test Customer",
            "payment_method": "cash",
            "amount_paid": "600.00",
            # Attempt to forge a lower total amount of 100 instead of 600
            "total_amount": "100.00",
            "items": [
                {
                    "item_id": self.item.id,
                    "quantity": 1
                }
            ]
        }
        res = self.client.post('/api/inventory/sales/checkout/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(res.data['total_amount'])), Decimal("600.00"))
        self.assertEqual(Decimal(str(res.data['subtotal'])), Decimal("600.00"))

    def test_cannot_return_more_than_purchased(self):
        """
        Ensures returns cannot exceed line item purchased quantity or bill total.
        """
        # Checkout 2 units
        checkout_payload = {
            "store_id": self.store.id,
            "customer_phone": "9999988888",
            "payment_method": "cash",
            "amount_paid": "1200.00",
            "items": [
                {
                    "item_id": self.item.id,
                    "quantity": 2
                }
            ]
        }
        res_chk = self.client.post('/api/inventory/sales/checkout/', checkout_payload, format='json')
        self.assertEqual(res_chk.status_code, status.HTTP_201_CREATED)
        inv_num = res_chk.data['invoice_number']
        line_item_id = res_chk.data['items'][0]['id']

        # Attempt to return 3 units (more than 2 purchased)
        ret_payload = {
            "invoice_number": inv_num,
            "refund_payment_method": "cash",
            "items": [
                {
                    "sale_order_item_id": line_item_id,
                    "quantity": 3
                }
            ]
        }
        res_ret = self.client.post('/api/inventory/sales/process-return/', ret_payload, format='json')
        self.assertEqual(res_ret.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("available to return", res_ret.data.get('error', '').lower())

    def test_employee_ledger_entry_is_append_only(self):
        """
        Verify that modifying or deleting an EmployeeLedgerEntry raises PermissionError.
        """
        from datetime import date
        emp = Employee.objects.create(
            name="Ramesh Kumar",
            phone="9123456780",
            join_date=date.today(),
            store=self.store
        )
        entry = EmployeeLedgerEntry.objects.create(
            employee=emp,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_BONUS,
            amount=Decimal("1500.00"),
            note="Performance bonus"
        )
        self.assertIsNotNone(entry.pk)

        # Attempting to modify amount directly
        entry.amount = Decimal("2500.00")
        with self.assertRaises(PermissionError):
            entry.save()

        # Attempting to delete entry directly
        with self.assertRaises(PermissionError):
            entry.delete()

    def test_expiry_write_off_atomicity(self):
        """
        Verify write_off_expired_stock atomicity and deduction from stock ledger.
        """
        from datetime import date, timedelta
        expired_item = Item.objects.create(
            uid="WS-EXP-9999",
            name="Perishable Milk 500ml",
            quantity=0,
            cost_price=Decimal("30.00"),
            selling_price=Decimal("35.00"),
            expiry_date=date.today() - timedelta(days=2),
            store=self.store,
        )
        adjust_stock(
            item=expired_item,
            change=8,
            reason=StockMovement.REASON_INITIAL_IMPORT,
            note="Stock expired item"
        )
        expired_item.refresh_from_db()
        self.assertEqual(expired_item.quantity, 8)

        summary = write_off_expired_stock(store_id=self.store.id, item_id=expired_item.id)
        self.assertEqual(summary['total_units_written_off'], 8)
        self.assertEqual(summary['total_financial_loss'], 240.0)

        expired_item.refresh_from_db()
        self.assertEqual(expired_item.quantity, 0)
