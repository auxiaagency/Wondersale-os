"""
Synchronization and Demo Seeding Services for Staff & Employee Management.
Handles:
1. Syncing Employee records from existing StaffMember (Staff & Roles app).
2. Seeding comprehensive realistic demo payroll data for manual testing.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any
import calendar

from django.db import transaction
from django.utils import timezone

from ..models import (
    Employee,
    EmployeeStoreAssignment,
    EmployeeShiftAssignment,
    Shift,
    RFIDCard,
    AttendanceDay,
    AttendanceSession,
    SalaryStructure,
    PayrollRun,
    SalaryStatement,
    SalaryLine,
    PayrollAdjustment,
    EmployeeLedgerEntry,
    FinanceEvent,
    StaffMember,
)
from inventory.models import Store
from .settings import get_setting


def sync_single_staff_member(sm: StaffMember) -> Employee:
    """
    Instantly synchronizes a single StaffMember into the Employee directory.
    Creates or updates the Employee record, store assignment, phone, photo, department, and designation.
    """
    if sm.is_owner or (sm.role and (sm.role.is_owner or sm.role.name.lower() == 'owner')):
        Employee.objects.filter(staff_member=sm).delete()
        return None

    with transaction.atomic():
        emp = Employee.objects.filter(staff_member=sm).first()
        if not emp and sm.staff_id:
            emp = Employee.objects.filter(employee_code=sm.staff_id).first()
            if emp:
                emp.staff_member = sm

        target_store = sm.store or Store.objects.first()
        if not target_store:
            target_store, _ = Store.objects.get_or_create(
                name='Default Store',
                defaults={'address': 'Main Location'}
            )

        sec_name = sm.section.name if hasattr(sm.section, 'name') else (str(sm.section) if sm.section else '')
        dept_name = sec_name or (sm.role.name if sm.role else 'General')
        desig_name = sm.role.name if sm.role else 'Staff'

        custom_join_date = getattr(sm, '_temp_join_date', None)

        if not emp:
            code = sm.staff_id or f"EMP-{sm.id:04d}"
            if Employee.objects.filter(employee_code=code).exists():
                code = f"EMP-{sm.id:04d}-{timezone.now().strftime('%S')}"

            emp = Employee.objects.create(
                staff_member=sm,
                store=target_store,
                employee_code=code,
                name=sm.name,
                phone=sm.phone or '',
                photo=sm.photo or None,
                department=dept_name,
                designation=desig_name,
                join_date=custom_join_date or (sm.created_at.date() if sm.created_at else timezone.now().date()),
                is_active=sm.is_active,
            )
        else:
            emp.name = sm.name
            emp.is_active = sm.is_active
            if custom_join_date:
                emp.join_date = custom_join_date
            if sm.phone is not None:
                emp.phone = sm.phone
            if sm.photo:
                emp.photo = sm.photo
            if target_store:
                emp.store = target_store
            if sec_name:
                emp.department = sec_name
            elif not emp.department:
                emp.department = dept_name
            if sm.role:
                emp.designation = sm.role.name
            emp.save()

        # Update store assignment
        if target_store:
            has_active = EmployeeStoreAssignment.objects.filter(
                employee=emp,
                store=target_store,
                to_date__isnull=True
            ).exists()
            if not has_active:
                EmployeeStoreAssignment.objects.create(
                    employee=emp,
                    store=target_store,
                    from_date=emp.join_date or timezone.now().date(),
                    to_date=None,
                )
        return emp


def sync_employees_from_staff_members(store: Store | None = None) -> dict[str, Any]:
    """
    Synchronizes Employee directory records from existing StaffMember records.
    Matches primarily on staff_member OneToOne link, then on employee_code == staff_id.
    Ensures every staff member has an operational Employee profile with active store assignment.
    """
    staff_qs = StaffMember.objects.all()
    if store:
        staff_qs = staff_qs.filter(store=store)

    # Strictly exclude owners from Employee management sync
    staff_qs = staff_qs.exclude(role__is_owner=True).exclude(role__name__iexact='owner')

    created_count = 0
    updated_count = 0

    with transaction.atomic():
        # Clean up any existing Employee records for owners
        Employee.objects.filter(staff_member__role__is_owner=True).delete()
        Employee.objects.filter(staff_member__role__name__iexact='owner').delete()
        Employee.objects.filter(designation__iexact='owner').delete()

        for sm in staff_qs:
            # 1. Try finding existing Employee linked to this StaffMember
            emp = Employee.objects.filter(staff_member=sm).first()

            # 2. Or matching on employee_code == staff_id
            if not emp and sm.staff_id:
                emp = Employee.objects.filter(employee_code=sm.staff_id).first()
                if emp:
                    emp.staff_member = sm

            sec_name = sm.section.name if hasattr(sm.section, 'name') else (str(sm.section) if sm.section else '')
            dept_name = sec_name or (sm.role.name if sm.role else 'General')
            desig_name = sm.role.name if sm.role else 'Staff'
            target_store = sm.store or store or Store.objects.first()
            if not target_store:
                target_store, _ = Store.objects.get_or_create(
                    name='Default Store',
                    defaults={'address': 'Main Location'}
                )

            # 3. If still not found, create new Employee
            if not emp:
                code = sm.staff_id or f"EMP-{sm.id:04d}"
                # Ensure code uniqueness
                if Employee.objects.filter(employee_code=code).exists():
                    code = f"EMP-{sm.id:04d}-{timezone.now().strftime('%S')}"

                emp = Employee.objects.create(
                    staff_member=sm,
                    store=target_store,
                    employee_code=code,
                    name=sm.name,
                    phone=sm.phone or '',
                    photo=sm.photo or None,
                    department=dept_name,
                    designation=desig_name,
                    join_date=sm.created_at.date() if sm.created_at else timezone.now().date(),
                    is_active=sm.is_active,
                )
                created_count += 1
            else:
                emp.name = sm.name
                emp.is_active = sm.is_active
                if sm.phone:
                    emp.phone = sm.phone
                if sm.photo:
                    emp.photo = sm.photo
                if target_store:
                    emp.store = target_store
                if sec_name:
                    emp.department = sec_name
                elif not emp.department:
                    emp.department = dept_name
                if sm.role:
                    emp.designation = sm.role.name
                emp.save()
                updated_count += 1

            # Ensure active Store Assignment matches sm.store
            if target_store:
                has_active = EmployeeStoreAssignment.objects.filter(
                    employee=emp,
                    store=target_store,
                    to_date__isnull=True
                ).exists()
                if not has_active:
                    EmployeeStoreAssignment.objects.create(
                        employee=emp,
                        store=target_store,
                        from_date=emp.join_date or timezone.now().date(),
                        to_date=None,
                    )

    return {
        'created': created_count,
        'updated': updated_count,
        'total': created_count + updated_count,
    }


def seed_demo_payroll_data(store: Store, actor: StaffMember | None = None) -> dict[str, Any]:
    """
    Seeds rich, realistic demo data for the specified store:
    - 5 realistic Employees with RFID cards and shift assignments.
    - Salary structures (Monthly and Daily).
    - 1 full month of AttendanceDay records (full days, half days, lates, overtime, holidays).
    - PayrollRun (generated and finalized).
    - Itemized SalaryStatements & SalaryLines.
    - PayrollAdjustments (bonus, fine, incentive).
    - EmployeeLedgerEntries (Accruals, Advances, Payouts) with verified running balances.
    - Associated OperatingExpense in accounting.
    """
    today = timezone.now().date()
    # Choose previous month so we can build a complete finalized month
    if today.month == 1:
        target_year = today.year - 1
        target_month = 12
    else:
        target_year = today.year
        target_month = today.month - 1

    _, last_day = calendar.monthrange(target_year, target_month)
    month_start = date(target_year, target_month, 1)
    month_end = date(target_year, target_month, last_day)

    # 1. Ensure Default Store Shift
    shift, _ = Shift.objects.get_or_create(
        store=store,
        name='Store General Shift',
        defaults={
            'start_time': '09:00:00',
            'end_time': '18:00:00',
            'is_overnight': False,
            'grace_late_minutes': 15,
            'grace_early_leave_minutes': 15,
            'min_minutes_full_day': 480,
            'min_minutes_half_day': 240,
            'break_allowance_minutes': 60,
            'is_default_for_store': True,
        }
    )

    demo_profiles = [
        {
            'code': 'DEMO-001',
            'name': 'Aarav Sharma',
            'designation': 'Store Manager',
            'department': 'Management',
            'mode': SalaryStructure.MODE_MONTHLY,
            'amount': Decimal('32000.00'),
            'rfid': 'DEMO01A1',
            'late_days': [4, 18],
            'half_days': [],
            'absent_days': [],
            'ot_hours': 6,
            'payout_amount': Decimal('25000.00'),
            'advance_amount': Decimal('0.00'),
            'adjustment': {'type': 'bonus', 'amount': Decimal('2000.00'), 'label': 'Monthly Store Performance Bonus'},
        },
        {
            'code': 'DEMO-002',
            'name': 'Priya Patel',
            'designation': 'Senior Cashier & Accounts',
            'department': 'Billing',
            'mode': SalaryStructure.MODE_MONTHLY,
            'amount': Decimal('22000.00'),
            'rfid': 'DEMO02B2',
            'late_days': [2, 11, 23], # 3 late marks -> threshold rule applies
            'half_days': [14],
            'absent_days': [],
            'ot_hours': 2,
            'payout_amount': Decimal('20000.00'),
            'advance_amount': Decimal('3000.00'),
            'adjustment': {'type': 'fine', 'amount': Decimal('500.00'), 'label': 'Cash Register Discrepancy Fine'},
        },
        {
            'code': 'DEMO-003',
            'name': 'Rohan Das',
            'designation': 'Floor Supervisor',
            'department': 'Sales',
            'mode': SalaryStructure.MODE_MONTHLY,
            'amount': Decimal('20000.00'),
            'rfid': 'DEMO03C3',
            'late_days': [],
            'half_days': [],
            'absent_days': [8, 9], # 2 days absent
            'ot_hours': 0,
            'payout_amount': Decimal('15000.00'),
            'advance_amount': Decimal('2000.00'),
            'adjustment': {'type': 'incentive', 'amount': Decimal('1200.00'), 'label': 'Upselling Incentive (Footwear)'},
        },
        {
            'code': 'DEMO-004',
            'name': 'Vikram Singh',
            'designation': 'Inventory Assistant',
            'department': 'Logistics',
            'mode': SalaryStructure.MODE_DAILY,
            'amount': Decimal('750.00'), # ₹750 per day
            'rfid': 'DEMO04D4',
            'late_days': [5],
            'half_days': [20],
            'absent_days': [12],
            'ot_hours': 4,
            'payout_amount': Decimal('14000.00'),
            'advance_amount': Decimal('1500.00'),
            'adjustment': None,
        },
        {
            'code': 'DEMO-005',
            'name': 'Neha Verma',
            'designation': 'Customer Support Representative',
            'department': 'Support',
            'mode': SalaryStructure.MODE_MONTHLY,
            'amount': Decimal('18500.00'),
            'rfid': 'DEMO05E5',
            'late_days': [],
            'half_days': [],
            'absent_days': [],
            'ot_hours': 0,
            'payout_amount': Decimal('18500.00'),
            'advance_amount': Decimal('0.00'),
            'adjustment': None,
        },
    ]

    seeded_employees = []

    with transaction.atomic():
        # Clear existing demo run if present
        PayrollRun.objects.filter(store=store, year=target_year, month=target_month).delete()

        for prof in demo_profiles:
            emp, _ = Employee.objects.get_or_create(
                employee_code=prof['code'],
                defaults={
                    'store': store,
                    'name': prof['name'],
                    'department': prof['department'],
                    'designation': prof['designation'],
                    'join_date': date(target_year, 1, 1),
                    'is_active': True,
                    'phone': '9876543210',
                }
            )
            seeded_employees.append(emp)

            # Store Assignment
            EmployeeStoreAssignment.objects.get_or_create(
                employee=emp,
                store=store,
                to_date__isnull=True,
                defaults={'from_date': date(target_year, 1, 1)}
            )

            # Shift Assignment
            EmployeeShiftAssignment.objects.get_or_create(
                employee=emp,
                to_date__isnull=True,
                defaults={
                    'shift': shift,
                    'weekly_off_days': [6], # Sunday off
                    'from_date': date(target_year, 1, 1),
                }
            )

            # RFID Card
            RFIDCard.objects.get_or_create(
                card_uid=prof['rfid'],
                defaults={'employee': emp, 'status': 'active'}
            )

            # Salary Structure
            SalaryStructure.objects.filter(employee=emp, to_date__isnull=True).delete()
            SalaryStructure.objects.create(
                employee=emp,
                mode=prof['mode'],
                amount=prof['amount'],
                overtime_rate=Decimal('120.00') if prof['mode'] == SalaryStructure.MODE_MONTHLY else Decimal('90.00'),
                from_date=date(target_year, 1, 1),
                to_date=None,
                note="Demo initial salary structure"
            )

            # Generate AttendanceDay records for each day of target month
            AttendanceDay.objects.filter(
                employee=emp,
                business_date__gte=month_start,
                business_date__lte=month_end
            ).delete()

            for day_num in range(1, last_day + 1):
                b_date = date(target_year, target_month, day_num)
                is_sunday = (b_date.weekday() == 6)

                if is_sunday:
                    status = AttendanceDay.STATUS_WEEKLY_OFF
                    fraction = Decimal('1.00')
                    worked_min = 0
                    late_min = 0
                    ot_min = 0
                elif day_num in prof['absent_days']:
                    status = AttendanceDay.STATUS_ABSENT
                    fraction = Decimal('0.00')
                    worked_min = 0
                    late_min = 0
                    ot_min = 0
                elif day_num in prof['half_days']:
                    status = AttendanceDay.STATUS_HALF_DAY
                    fraction = Decimal('0.50')
                    worked_min = 240
                    late_min = 0
                    ot_min = 0
                else:
                    status = AttendanceDay.STATUS_PRESENT
                    fraction = Decimal('1.00')
                    worked_min = 480
                    late_min = 25 if day_num in prof['late_days'] else 0
                    ot_min = 60 if (day_num == 15 and prof['ot_hours'] > 0) else 0

                late_penalty = {'kind': 'fraction_of_day', 'value': 0.25} if late_min > 0 else {'kind': 'none', 'value': 0}

                AttendanceDay.objects.create(
                    employee=emp,
                    store=store,
                    business_date=b_date,
                    status=status,
                    worked_minutes=worked_min,
                    late_minutes=late_min,
                    overtime_minutes=ot_min,
                    day_fraction_paid=fraction,
                    late_penalty=late_penalty,
                    is_locked=True, # Will be finalized
                )

            # Manual Adjustment if configured
            if prof['adjustment']:
                PayrollAdjustment.objects.filter(
                    employee=emp,
                    store=store,
                    year=target_year,
                    month=target_month
                ).delete()

                PayrollAdjustment.objects.create(
                    employee=emp,
                    store=store,
                    year=target_year,
                    month=target_month,
                    adjustment_type=prof['adjustment']['type'],
                    amount=prof['adjustment']['amount'],
                    label=prof['adjustment']['label'],
                    created_by=actor,
                )

    # Now run payroll calculation & finalization
    from .payroll import generate_draft_payroll, finalize_payroll
    from .ledger import add_entry

    payroll_run = generate_draft_payroll(
        store=store,
        year=target_year,
        month=target_month,
        actor=actor,
        proceed_with_needs_review=True
    )

    finalize_payroll(payroll_run=payroll_run, actor=actor)

    # Add demo payouts and advances to ledger
    with transaction.atomic():
        for prof in demo_profiles:
            emp = Employee.objects.get(employee_code=prof['code'])

            # 1. Advance taken during the month (negative)
            if prof['advance_amount'] > Decimal('0.00'):
                add_entry(
                    employee=emp,
                    store=store,
                    entry_type=EmployeeLedgerEntry.ENTRY_ADVANCE,
                    amount=-prof['advance_amount'],
                    entry_date=date(target_year, target_month, 10),
                    payment_method='cash',
                    reference_no=f"ADV-{target_year}{target_month:02d}-{emp.id}",
                    note=f"Mid-month advance request approved for {emp.name}",
                    actor=actor
                )

            # 2. Payout disbursed after finalization (negative)
            if prof['payout_amount'] > Decimal('0.00'):
                statement = SalaryStatement.objects.filter(payroll_run=payroll_run, employee=emp).first()
                add_entry(
                    employee=emp,
                    store=store,
                    entry_type=EmployeeLedgerEntry.ENTRY_PAYOUT,
                    amount=-prof['payout_amount'],
                    entry_date=date(target_year, target_month, last_day),
                    payment_method='bank_transfer',
                    reference_no=f"SAL-PAY-{target_year}{target_month:02d}-{emp.id}",
                    note=f"Monthly salary disbursement for {emp.name}",
                    related_statement=statement,
                    actor=actor
                )

    return {
        'status': 'success',
        'message': f"Demo payroll data successfully seeded for {store.name} ({target_year}-{target_month:02d}).",
        'payroll_run_id': payroll_run.id,
        'employees_count': len(seeded_employees),
        'year': target_year,
        'month': target_month,
    }
