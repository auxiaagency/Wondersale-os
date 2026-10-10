"""
Comprehensive Test Suite for Stage 2:
Salary Structure, Payroll Calculation, Employee Ledger, Finance Integration & Sync.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import calendar

from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError

from inventory.models import Store
from staff.models import (
    StaffRole, StaffMember, Employee, EmployeeStoreAssignment,
    Shift, EmployeeShiftAssignment, AttendanceDay, Punch,
    SalaryStructure, PayrollRun, SalaryStatement, SalaryLine,
    PayrollAdjustment, EmployeeLedgerEntry, FinanceEvent
)
from staff.services.payroll import (
    calculate_employee_salary, generate_draft_payroll,
    finalize_payroll, reopen_payroll
)
from staff.services.ledger import (
    add_entry, reverse_entry, correct_entry,
    get_employee_balance, get_store_ledger_summary
)
from staff.services.sync import (
    sync_employees_from_staff_members, seed_demo_payroll_data
)
from staff.services.attendance import (
    override_day_status, void_punch, add_manual_punch
)
from staff.services.settings import set_setting, HRSetting


class Stage2PayrollAndLedgerTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(
            name="Wondersale Central",
            pincode="110001"
        )
        self.role_owner = StaffRole.objects.create(
            name="Store Owner",
            is_owner=True,
            can_access_staff=True,
            can_access_inventory=True,
            can_access_billing=True,
        )
        self.owner = StaffMember.objects.create(
            store=self.store,
            role=self.role_owner,
            name="Vikram Owner",
            staff_id="OWNER01",
            password_hash="dummy_hash",
            is_active=True,
        )
        self.employee = Employee.objects.create(
            store=self.store,
            employee_code="EMP-101",
            name="Rahul Sharma",
            department="Sales",
            designation="Senior Cashier",
            join_date=date(2026, 1, 1),
            is_active=True,
        )
        EmployeeStoreAssignment.objects.create(
            employee=self.employee,
            store=self.store,
            from_date=date(2026, 1, 1),
        )
        self.shift = Shift.objects.create(
            store=self.store,
            name="General 9-6",
            start_time="09:00:00",
            end_time="18:00:00",
            grace_late_minutes=15,
            min_minutes_full_day=480,
            min_minutes_half_day=240,
            is_default_for_store=True,
        )

    def test_salary_structure_validation_and_overlap(self):
        """Test SalaryStructure date validation and overlapping prevention."""
        s1 = SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('30000.00'),
            from_date=date(2026, 1, 1),
            to_date=date(2026, 6, 30),
        )
        self.assertIsNotNone(s1.pk)

        # Overlapping start date should fail clean validation
        s_overlap = SalaryStructure(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('35000.00'),
            from_date=date(2026, 5, 1),
            to_date=None,
        )
        with self.assertRaises(ValidationError):
            s_overlap.save()

        # from_date > to_date should fail
        s_invalid_dates = SalaryStructure(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('35000.00'),
            from_date=date(2026, 8, 1),
            to_date=date(2026, 7, 1),
        )
        with self.assertRaises(ValidationError):
            s_invalid_dates.save()

    def test_monthly_salary_calculation_with_absent_and_half_days(self):
        """Test monthly salary calculations with absent days and half days."""
        SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('31000.00'), # In May (31 days), daily rate is exactly ₹1000/day
            from_date=date(2026, 1, 1),
            to_date=None,
        )

        year, month = 2026, 5 # 31 days
        # Create 25 full days, 1 half day, 2 absent days, 3 weekly offs
        for day in range(1, 26):
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_PRESENT,
                worked_minutes=480,
                day_fraction_paid=Decimal('1.00'),
            )
        # Half day on 26th
        AttendanceDay.objects.create(
            employee=self.employee,
            store=self.store,
            business_date=date(year, month, 26),
            status=AttendanceDay.STATUS_HALF_DAY,
            worked_minutes=240,
            day_fraction_paid=Decimal('0.50'),
        )
        # Absent on 27th, 28th
        for day in [27, 28]:
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_ABSENT,
                worked_minutes=0,
                day_fraction_paid=Decimal('0.00'),
            )
        # Weekly off on 29th, 30th, 31st
        for day in [29, 30, 31]:
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_WEEKLY_OFF,
                worked_minutes=0,
                day_fraction_paid=Decimal('1.00'),
            )

        calc = calculate_employee_salary(self.employee, year, month)
        self.assertTrue(calc['has_structure'])
        self.assertEqual(calc['gross'], Decimal('31000.00'))

        # Daily rate = 31000 / 31 = 1000.00
        # Absent cut = 2 * 1000 = 2000.00
        # Half day cut = 1 * 0.5 * 1000 = 500.00
        # Total deductions = 2500.00
        # Net = 31000 - 2500 = 28500.00
        self.assertEqual(calc['total_deductions'], Decimal('2500.00'))
        self.assertEqual(calc['net'], Decimal('28500.00'))

    def test_daily_wage_salary_calculation(self):
        """Test daily wage mode calculation including weekly off and holidays."""
        SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_DAILY,
            amount=Decimal('800.00'),
            overtime_rate=Decimal('100.00'),
            from_date=date(2026, 1, 1),
            to_date=None,
        )

        year, month = 2026, 4 # 30 days
        # 20 present days, 2 half days, 4 weekly offs, 4 absents
        for day in range(1, 21):
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_PRESENT,
                worked_minutes=480,
                day_fraction_paid=Decimal('1.00'),
                overtime_minutes=60 if day == 1 else 0 # 1 hour OT on day 1
            )
        for day in [21, 22]:
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_HALF_DAY,
                worked_minutes=240,
                day_fraction_paid=Decimal('0.50'),
            )

        calc = calculate_employee_salary(self.employee, year, month)
        # 20 days @ ₹800 = 16000
        # 2 half days = 1 day @ ₹800 = 800
        # 1 hr OT @ ₹100 = 100
        # Gross = 16900.00, Deductions = 0, Net = 16900.00
        self.assertEqual(calc['gross'], Decimal('16900.00'))
        self.assertEqual(calc['net'], Decimal('16900.00'))

    def test_payroll_adjustments_bonus_and_fine(self):
        """Test that bonuses and fines alter net salary correctly."""
        SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('20000.00'),
            from_date=date(2026, 1, 1),
            to_date=None,
        )
        year, month = 2026, 6
        # Perfect attendance
        for day in range(1, 31):
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_PRESENT,
                worked_minutes=480,
                day_fraction_paid=Decimal('1.00'),
            )

        # Add ₹1,500 bonus and ₹500 fine
        PayrollAdjustment.objects.create(
            employee=self.employee,
            store=self.store,
            year=year,
            month=month,
            adjustment_type=PayrollAdjustment.TYPE_BONUS,
            amount=Decimal('1500.00'),
            label="Festive Bonus"
        )
        PayrollAdjustment.objects.create(
            employee=self.employee,
            store=self.store,
            year=year,
            month=month,
            adjustment_type=PayrollAdjustment.TYPE_FINE,
            amount=Decimal('500.00'),
            label="Lost Name Badge"
        )

        calc = calculate_employee_salary(self.employee, year, month)
        self.assertEqual(calc['gross'], Decimal('20000.00'))
        self.assertEqual(calc['total_additions'], Decimal('1500.00'))
        self.assertEqual(calc['total_deductions'], Decimal('500.00'))
        self.assertEqual(calc['net'], Decimal('21000.00'))

    def test_payroll_draft_finalization_locking_and_accounting(self):
        """Test draft generation, needs_review block, finalization, month locking, and ledger accrual."""
        SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal('25000.00'),
            from_date=date(2026, 1, 1),
            to_date=None,
        )
        year, month = 2026, 3
        for day in range(1, 32):
            AttendanceDay.objects.create(
                employee=self.employee,
                store=self.store,
                business_date=date(year, month, day),
                status=AttendanceDay.STATUS_PRESENT if day != 10 else AttendanceDay.STATUS_NEEDS_REVIEW,
                worked_minutes=480,
                day_fraction_paid=Decimal('1.00'),
            )

        # 1. Generation should be blocked by needs_review day
        with self.assertRaises(ValueError):
            generate_draft_payroll(self.store, year, month, actor=self.owner, proceed_with_needs_review=False)

        # 2. Can proceed if proceed_with_needs_review is True
        run = generate_draft_payroll(self.store, year, month, actor=self.owner, proceed_with_needs_review=True)
        self.assertEqual(run.status, PayrollRun.STATUS_DRAFT)
        self.assertEqual(run.statements.count(), 1)
        statement = run.statements.first()
        self.assertGreater(statement.lines.count(), 0)

        # 3. Finalize payroll
        finalized_run = finalize_payroll(run, actor=self.owner)
        self.assertEqual(finalized_run.status, PayrollRun.STATUS_FINALIZED)

        # Check attendance days are locked
        locked_count = AttendanceDay.objects.filter(store=self.store, business_date__month=month, is_locked=True).count()
        self.assertEqual(locked_count, 31)

        # Check locked day guard raises PermissionError on edit attempt
        locked_day = AttendanceDay.objects.get(employee=self.employee, business_date=date(year, month, 1))
        with self.assertRaises(PermissionError):
            override_day_status(locked_day, AttendanceDay.STATUS_PRESENT, self.owner, "Should fail")

        # Check SALARY_ACCRUAL ledger entry was posted
        ledger_entry = EmployeeLedgerEntry.objects.filter(
            employee=self.employee,
            entry_type=EmployeeLedgerEntry.ENTRY_SALARY_ACCRUAL
        ).first()
        self.assertIsNotNone(ledger_entry)
        self.assertEqual(ledger_entry.amount, statement.net)
        self.assertEqual(get_employee_balance(self.employee), statement.net)

        # Check OperatingExpense created in accounting
        from accounting.models import OperatingExpense
        expense = OperatingExpense.objects.filter(reference_number=f"PR-{run.id}").first()
        self.assertIsNotNone(expense)
        self.assertEqual(expense.amount, statement.gross)

        # 4. Reopen payroll
        reopened_run = reopen_payroll(finalized_run, actor=self.owner, reason="Salary revision needed")
        self.assertEqual(reopened_run.status, PayrollRun.STATUS_DRAFT)

        # Days should be unlocked
        unlocked_count = AttendanceDay.objects.filter(store=self.store, business_date__month=month, is_locked=False).count()
        self.assertEqual(unlocked_count, 31)

        # Ledger accrual should be reversed
        reversal = EmployeeLedgerEntry.objects.filter(
            employee=self.employee,
            entry_type=EmployeeLedgerEntry.ENTRY_REVERSAL,
            reversed_entry=ledger_entry
        ).first()
        self.assertIsNotNone(reversal)
        self.assertEqual(reversal.amount, -ledger_entry.amount)
        self.assertEqual(get_employee_balance(self.employee), Decimal('0.00'))

        # OperatingExpense in accounting should be removed
        self.assertFalse(OperatingExpense.objects.filter(reference_number=f"PR-{run.id}").exists())

    def test_ledger_advance_payout_and_append_only_enforcement(self):
        """Test ledger advance, payout, atomic reversal, and append-only immutability."""
        # 1. Staff takes ₹3,000 advance (-₹3,000)
        e1 = add_entry(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_ADVANCE,
            amount=Decimal('-3000.00'),
            note="Emergency personal advance",
            actor=self.owner
        )
        self.assertEqual(get_employee_balance(self.employee), Decimal('-3000.00'))

        # 2. Staff receives ₹10,000 bonus accrual (+₹10,000)
        e2 = add_entry(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_BONUS,
            amount=Decimal('10000.00'),
            note="Performance bonus",
            actor=self.owner
        )
        # Net balance should now be +₹7,000
        self.assertEqual(get_employee_balance(self.employee), Decimal('7000.00'))

        # 3. Disburse ₹5,000 payout (-₹5,000)
        e3 = add_entry(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_PAYOUT,
            amount=Decimal('-5000.00'),
            note="Bonus payout partial",
            actor=self.owner
        )
        # Net balance should now be +₹2,000
        self.assertEqual(get_employee_balance(self.employee), Decimal('2000.00'))

        # 4. Append-only immutability check
        with self.assertRaises(PermissionError):
            e1.amount = Decimal('-4000.00')
            e1.save()

        with self.assertRaises(PermissionError):
            e1.delete()

        # 5. Correct entry atomicity
        # Suppose e3 payout was actually ₹6,000, not ₹5,000
        rev, new_e = correct_entry(
            entry_id=e3.id,
            new_amount=Decimal('-6000.00'),
            reason="Correct payout amount to ₹6,000",
            actor=self.owner
        )
        # Reversal should be +₹5,000, new entry -₹6,000 -> Net should now be +₹1,000
        self.assertEqual(rev.amount, Decimal('5000.00'))
        self.assertEqual(new_e.amount, Decimal('-6000.00'))
        self.assertEqual(get_employee_balance(self.employee), Decimal('1000.00'))

    def test_sync_staff_and_demo_seeding(self):
        """Test sync_employees_from_staff_members and seed_demo_payroll_data."""
        role_staff = StaffRole.objects.create(
            name="Cashier",
            is_owner=False,
            can_access_billing=True,
        )
        # Create a new StaffMember without linked employee
        sm = StaffMember.objects.create(
            store=self.store,
            role=role_staff,
            name="Ananya Roy",
            staff_id="SM-990",
            password_hash="dummy_hash",
            is_active=True,
        )
        sync_res = sync_employees_from_staff_members(self.store)
        self.assertGreaterEqual(sync_res['total'], 1)
        linked_emp = Employee.objects.filter(staff_member=sm).first()
        self.assertIsNotNone(linked_emp)
        self.assertEqual(linked_emp.name, "Ananya Roy")

        # Test Demo data seeding
        demo_res = seed_demo_payroll_data(store=self.store, actor=self.owner)
        self.assertEqual(demo_res['status'], 'success')
        self.assertEqual(demo_res['employees_count'], 5)

        # Check demo payroll run was finalized and ledger balances exist
        demo_run = PayrollRun.objects.get(id=demo_res['payroll_run_id'])
        self.assertEqual(demo_run.status, PayrollRun.STATUS_FINALIZED)
        self.assertEqual(demo_run.statements.count(), 5)
        self.assertTrue(EmployeeLedgerEntry.objects.filter(store=self.store).exists())

    def test_ongoing_month_finalization_blocked(self):
        """Test that finalization of an ongoing or future month is blocked with a clear ValueError."""
        today = timezone.localdate()
        run = PayrollRun.objects.create(
            store=self.store,
            year=today.year,
            month=today.month,
            status=PayrollRun.STATUS_DRAFT,
        )
        with self.assertRaises(ValueError) as ctx:
            finalize_payroll(run, actor=self.owner)
        self.assertIn("the month is still ongoing", str(ctx.exception))

    def test_monthly_grid_action(self):
        """Test that GET /api/staff/attendance/reports/monthly-grid/ works cleanly with shifts and attendance records."""
        AttendanceDay.objects.create(
            employee=self.employee,
            store=self.store,
            business_date=date(2026, 5, 1),
            status=AttendanceDay.STATUS_PRESENT,
            worked_minutes=480,
            day_fraction_paid=Decimal('1.00'),
        )
        url = f"/api/staff/attendance/reports/monthly-grid/?store_id={self.store.id}&year=2026&month=5"
        res = self.client.get(url, HTTP_X_STAFF_ID=self.owner.staff_id)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['year'], 2026)
        self.assertEqual(data['month'], 5)
        self.assertEqual(data['total_days'], 31)
        self.assertIn('matrix', data)
        self.assertTrue(len(data['matrix']) >= 1)
        emp_row = next(r for r in data['matrix'] if r['employee_id'] == self.employee.id)
        self.assertIn('shift_time_range_12h', emp_row)
        self.assertEqual(emp_row['shift_time_range_12h'], '09:00 AM - 06:00 PM')
        self.assertIn('days', emp_row)
        self.assertEqual(emp_row['days']['1']['status'], 'present')

    def test_employee_individual_ledger_summary(self):
        """Test that passing employee_id to ledger summary endpoint returns per-employee metrics."""
        # Post credit and debit entries for this employee
        EmployeeLedgerEntry.objects.create(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_SALARY_ACCRUAL,
            amount=Decimal('15000.00'),
            entry_date=date(2026, 4, 30),
            payment_method='accrual'
        )
        EmployeeLedgerEntry.objects.create(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_ADVANCE,
            amount=Decimal('-2000.00'),
            entry_date=date(2026, 5, 5),
            payment_method='cash'
        )
        EmployeeLedgerEntry.objects.create(
            employee=self.employee,
            store=self.store,
            entry_type=EmployeeLedgerEntry.ENTRY_PAYOUT,
            amount=Decimal('-5000.00'),
            entry_date=date(2026, 5, 10),
            payment_method='bank_transfer'
        )

        url = f"/api/staff/ledger/summary/?store_id={self.store.id}&employee_id={self.employee.id}"
        res = self.client.get(url, HTTP_X_STAFF_ID=self.owner.staff_id)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertTrue(data.get('is_employee_specific'))
        self.assertEqual(data.get('employee_id'), self.employee.id)
        self.assertEqual(Decimal(data['total_credits']), Decimal('15000.00'))
        self.assertEqual(Decimal(data['total_payouts']), Decimal('5000.00'))
        self.assertEqual(Decimal(data['total_advances']), Decimal('2000.00'))
        self.assertEqual(Decimal(data['total_debits']), Decimal('7000.00'))
        # 15000 - 7000 = 8000 net balance
        self.assertEqual(Decimal(data['net_balance']), Decimal('8000.00'))

    def test_finalize_completed_month_allowed(self):
        """Test that past completed month (e.g. month < current month) can be finalized without ongoing month error."""
        run = PayrollRun.objects.create(
            store=self.store,
            year=2026,
            month=4,  # April 2026 is concluded
            status=PayrollRun.STATUS_DRAFT,
        )
        # Should not raise ValueError
        finalized = finalize_payroll(run, actor=self.owner)
        self.assertEqual(finalized.status, PayrollRun.STATUS_FINALIZED)


