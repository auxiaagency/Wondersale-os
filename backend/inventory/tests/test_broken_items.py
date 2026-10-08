from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError, PermissionDenied

from inventory.models import Store, Category, SubCategory, Supplier, Section, Item, StockMovement, BrokenItemReport
from inventory.services import adjust_stock, report_broken_item
from staff.models import StaffRole, StaffMember
from accounting.services import get_monthly_financial_analysis
from django.utils import timezone


class BrokenItemReportingTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(name="Flagship Bhopal", enable_stakeholders=False)
        self.section_a = Section.objects.create(name="Electronics", store=self.store)
        self.section_b = Section.objects.create(name="Apparel", store=self.store)
        self.category = Category.objects.create(name="Gadgets")
        self.supplier = Supplier.objects.create(name="Tech Distributors")

        # In-stock item (10 units, cost 150.00, sell 250.00)
        self.in_stock_item = Item.objects.create(
            uid="BROKEN-001",
            name="Wireless Headphones",
            cost_price=Decimal("150.00"),
            selling_price=Decimal("250.00"),
            store=self.store,
            section=self.section_a,
            supplier=self.supplier,
        )
        adjust_stock(self.in_stock_item, 10, StockMovement.REASON_INITIAL_IMPORT)

        # Out-of-stock item (0 units)
        self.out_of_stock_item = Item.objects.create(
            uid="BROKEN-002",
            name="Smart Watch",
            cost_price=Decimal("500.00"),
            selling_price=Decimal("900.00"),
            store=self.store,
            section=self.section_a,
            supplier=self.supplier,
        )
        # Ensure quantity is 0
        self.assertEqual(self.out_of_stock_item.quantity, 0)

        # Section-restricted staff member
        self.role_section_a = StaffRole.objects.create(
            name="Section Associate",
            inventory_scope="assigned_section"
        )
        self.staff_section_a = StaffMember.objects.create(
            name="Aman Sharma",
            staff_id="EMP-SEC-A",
            store=self.store,
            section=self.section_a,
            role=self.role_section_a,
            inventory_scope="assigned_section",
        )

        # Dummy photo proof
        self.fake_photo = SimpleUploadedFile(
            name='broken_photo.jpg',
            content=b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\xff\xd9',
            content_type='image/jpeg'
        )

    def test_cannot_report_out_of_stock_item(self):
        """Verifies reporting broken is rejected when product quantity is 0."""
        with self.assertRaises(ValidationError) as ctx:
            report_broken_item(
                item_id=self.out_of_stock_item.id,
                quantity=1,
                reason="Screen cracked during unboxing",
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,
            )
        self.assertIn("out of stock", str(ctx.exception).lower())

    def test_cannot_report_excess_quantity(self):
        """Verifies reporting more units than available stock is rejected."""
        with self.assertRaises(ValidationError) as ctx:
            report_broken_item(
                item_id=self.in_stock_item.id,
                quantity=15,  # only 10 in stock!
                reason="Water damage",
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,
            )
        self.assertIn("only 10 unit(s)", str(ctx.exception).lower())

    def test_cannot_report_zero_or_negative_quantity(self):
        """Verifies invalid quantities are rejected."""
        with self.assertRaises(ValidationError):
            report_broken_item(
                item_id=self.in_stock_item.id,
                quantity=0,
                reason="Testing zero",
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,
            )
        with self.assertRaises(ValidationError):
            report_broken_item(
                item_id=self.in_stock_item.id,
                quantity=-2,
                reason="Testing negative",
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,
            )

    def test_mandatory_proof_and_reason_enforced(self):
        """Verifies reason and photo proof are strictly required."""
        with self.assertRaises(ValidationError) as ctx_reason:
            report_broken_item(
                item_id=self.in_stock_item.id,
                quantity=1,
                reason="",  # empty
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,
            )
        self.assertIn("reason", str(ctx_reason.exception))

        with self.assertRaises(ValidationError) as ctx_photo:
            report_broken_item(
                item_id=self.in_stock_item.id,
                quantity=1,
                reason="Cracked frame",
                proof_image=None,  # missing
                performed_by=self.staff_section_a,
            )
        self.assertIn("proof_image", str(ctx_photo.exception))

    def test_section_isolation_enforced(self):
        """Verifies section-restricted staff cannot report broken item from another section."""
        item_in_b = Item.objects.create(
            uid="BROKEN-SEC-B",
            name="Denim Jacket",
            cost_price=Decimal("400.00"),
            selling_price=Decimal("800.00"),
            store=self.store,
            section=self.section_b,
        )
        adjust_stock(item_in_b, 5, StockMovement.REASON_INITIAL_IMPORT)

        with self.assertRaises(PermissionDenied):
            report_broken_item(
                item_id=item_in_b.id,
                quantity=1,
                reason="Torn fabric",
                proof_image=self.fake_photo,
                performed_by=self.staff_section_a,  # Staff bound to Section A
            )

    def test_successful_broken_item_reporting_and_stock_deduction(self):
        """Verifies happy path: stock decrements, ledger reflects reduction, and BrokenItemReport created."""
        initial_stock = self.in_stock_item.quantity
        units_broken = 2

        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=units_broken,
            reason="Dropped accidentally from shelf",
            proof_image=self.fake_photo,
            performed_by=self.staff_section_a,
        )

        self.in_stock_item.refresh_from_db()
        self.assertEqual(self.in_stock_item.quantity, initial_stock - units_broken)
        self.assertEqual(report.quantity, units_broken)
        self.assertEqual(report.cost_price, Decimal("150.00"))
        self.assertEqual(report.total_loss, Decimal("300.00"))  # 2 * 150
        self.assertEqual(report.stock_movement.reason, StockMovement.REASON_BROKEN)
        self.assertEqual(report.stock_movement.change, -units_broken)

    def test_accounting_integration_reflects_broken_loss(self):
        """Verifies that broken item losses are deducted in monthly financial analysis and appear in the waterfall."""
        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=2,
            reason="Dropped accidentally from shelf",
            proof_image=self.fake_photo,
            performed_by=self.staff_section_a,
        )

        now = timezone.now()
        analysis = get_monthly_financial_analysis(
            year=now.year,
            month=now.month,
            store_ids=[self.store.id]
        )

        summary = analysis['summary']
        self.assertEqual(summary['total_inventory_loss_broken'], 300.0)
        self.assertEqual(summary['broken_items_count'], 1)
        self.assertEqual(summary['broken_units_count'], 2)

        # Check waterfall flow
        waterfall_steps = [w['step'] for w in analysis['waterfall']]
        self.assertIn('Broken & Damaged Inventory Write-off', waterfall_steps)

        # Check broken breakdown
        broken_breakdown = analysis['broken_breakdown']
        self.assertEqual(broken_breakdown['total_loss'], 300.0)
        self.assertEqual(broken_breakdown['units_count'], 2)
        self.assertTrue(len(broken_breakdown['reports']) >= 1)

    def test_fine_employee_success_full_cost(self):
        """Verifies that fining an employee defaults to total_loss, records fine in EmployeeLedger, and reduces balance."""
        from staff.models import Employee, EmployeeLedgerEntry
        from staff.services.ledger import get_employee_balance
        from rest_framework.test import APIClient

        employee = Employee.objects.create(
            employee_code="EMP-TEST-001",
            name="Rahul Verma",
            phone="9876543210",
            store=self.store,
            join_date=timezone.now().date(),
        )
        # Starting balance is 0
        self.assertEqual(get_employee_balance(employee), Decimal("0.00"))

        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=2,
            reason="Cracked screen while loading display",
            proof_image=self.fake_photo,
            performed_by=self.staff_section_a,
        )

        client = APIClient()
        url = f"/api/inventory/broken-items/{report.id}/fine-employee/"
        response = client.post(url, {'employee_id': employee.id}, format='json')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertTrue(report.is_fined)
        self.assertEqual(report.fined_employee, employee)
        self.assertEqual(report.fine_amount, Decimal("300.00"))
        self.assertIsNotNone(report.fine_ledger_entry)
        self.assertEqual(report.fine_ledger_entry.entry_type, EmployeeLedgerEntry.ENTRY_FINE)
        self.assertEqual(report.fine_ledger_entry.amount, Decimal("-300.00"))

        # Net employee balance is now -300.00
        balance = get_employee_balance(employee)
        self.assertEqual(balance, Decimal("-300.00"))

    def test_cannot_fine_already_fined_report(self):
        """Verifies duplicate fining is strictly rejected."""
        from staff.models import Employee
        from rest_framework.test import APIClient

        employee = Employee.objects.create(
            employee_code="EMP-TEST-002",
            name="Rahul Verma",
            phone="9876543211",
            store=self.store,
            join_date=timezone.now().date(),
        )
        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=1,
            reason="Dropped on floor",
            proof_image=self.fake_photo,
        )

        client = APIClient()
        url = f"/api/inventory/broken-items/{report.id}/fine-employee/"
        res1 = client.post(url, {'employee_id': employee.id}, format='json')
        self.assertEqual(res1.status_code, 200)

        # Second attempt must fail
        res2 = client.post(url, {'employee_id': employee.id}, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already been fined', res2.data['error'])

    def test_fine_custom_amount_validation(self):
        """Verifies custom fine amount and rejects <= 0 amount."""
        from staff.models import Employee
        from rest_framework.test import APIClient

        employee = Employee.objects.create(
            employee_code="EMP-TEST-003",
            name="Sunil Kumar",
            phone="9876543212",
            store=self.store,
            join_date=timezone.now().date(),
        )
        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=1,
            reason="Scratched display",
            proof_image=self.fake_photo,
        )

        client = APIClient()
        url = f"/api/inventory/broken-items/{report.id}/fine-employee/"

        # Zero fine fails
        res_zero = client.post(url, {'employee_id': employee.id, 'fine_amount': 0}, format='json')
        self.assertEqual(res_zero.status_code, 400)

        # Custom 50% fine succeeds
        res_custom = client.post(url, {'employee_id': employee.id, 'fine_amount': '75.00', 'notes': 'Shared liability 50%'}, format='json')
        self.assertEqual(res_custom.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.fine_amount, Decimal("75.00"))
        self.assertEqual(report.fine_ledger_entry.amount, Decimal("-75.00"))

    def test_no_fine_marks_report_as_waived_store_loss(self):
        """Verifies that clicking 'No Fine' marks the report as waived/store-loss with no employee ledger deduction."""
        from rest_framework.test import APIClient

        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=1,
            reason="Customer accidentally knocked vase off table",
            proof_image=self.fake_photo,
        )

        client = APIClient()
        url = f"/api/inventory/broken-items/{report.id}/no-fine/"
        response = client.post(url, {}, format='json')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertTrue(report.is_waived)
        self.assertFalse(report.is_fined)
        self.assertIsNone(report.fined_employee)
        self.assertIsNone(report.fine_ledger_entry)

    def test_cannot_mark_no_fine_if_already_fined(self):
        """Verifies an already-fined report cannot be marked as No Fine."""
        from staff.models import Employee
        from rest_framework.test import APIClient

        employee = Employee.objects.create(
            employee_code="EMP-TEST-004",
            name="Rohit Sharma",
            store=self.store,
            join_date=timezone.now().date(),
        )
        report = report_broken_item(
            item_id=self.in_stock_item.id,
            quantity=1,
            reason="Dropped display unit",
            proof_image=self.fake_photo,
        )

        client = APIClient()
        fine_url = f"/api/inventory/broken-items/{report.id}/fine-employee/"
        res_fine = client.post(fine_url, {'employee_id': employee.id}, format='json')
        self.assertEqual(res_fine.status_code, 200)

        # Attempt no-fine should now be rejected
        no_fine_url = f"/api/inventory/broken-items/{report.id}/no-fine/"
        res_no_fine = client.post(no_fine_url, {}, format='json')
        self.assertEqual(res_no_fine.status_code, 400)
        self.assertIn('already been fined', res_no_fine.data['error'])


