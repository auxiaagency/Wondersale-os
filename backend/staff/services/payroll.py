"""
Payroll Calculation and Processing Service.
Handles:
1. Itemized salary calculation for Monthly and Daily wage employees.
2. Draft payroll run generation with explainable SalaryLines.
3. Payroll finalization with attendance locking, ledger accruals, and accounting sync.
4. Safe payroll reopening with atomic reversals.
"""

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
import calendar

from django.db import transaction
from django.utils import timezone

from ..models import (
    Employee,
    EmployeeStoreAssignment,
    SalaryStructure,
    PayrollRun,
    SalaryStatement,
    SalaryLine,
    PayrollAdjustment,
    EmployeeLedgerEntry,
    AttendanceDay,
    StaffMember,
)
from inventory.models import Store
from .settings import get_setting, get_all_settings_for_store
from .stage2_interface import get_month_attendance, lock_month, unlock_month
from .ledger import add_entry, reverse_entry
from .finance import sync_payroll_to_accounting, reverse_payroll_in_accounting


def _quantize(val: Any) -> Decimal:
    if val is None:
        return Decimal('0.00')
    return Decimal(str(val)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_employee_salary(
    employee: Employee,
    year: int,
    month: int,
    rules_snapshot: dict[str, Any] | None = None,
    store=None,
) -> dict[str, Any]:
    """
    Computes complete, explainable itemized salary statement and lines for an employee in a given month.
    Pass store to correctly scope OT override lookups in multi-store setups.
    """
    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    # 1. Retrieve active SalaryStructure for this month
    structure = (
        SalaryStructure.objects.filter(
            employee=employee,
            from_date__lte=month_end,
        )
        .filter(to_date__isnull=True) | SalaryStructure.objects.filter(
            employee=employee,
            from_date__lte=month_end,
            to_date__gte=month_start,
        )
    ).order_by('-from_date').first()

    if not structure:
        return {
            'has_structure': False,
            'mode': 'NONE',
            'gross': Decimal('0.00'),
            'total_deductions': Decimal('0.00'),
            'total_additions': Decimal('0.00'),
            'net': Decimal('0.00'),
            'lines': [],
            'days_summary': {},
        }

    # 2. Get attendance data from Stage 1 interface
    att = get_month_attendance(employee, year, month)
    counts = att['counts']

    # 3. Resolve settings
    divisor_mode = (
        (rules_snapshot or {}).get('monthly_divisor_mode')
        or get_setting('monthly_divisor_mode', employee)
        or 'actual'
    )
    daily_workers_paid_weekly_off = (
        (rules_snapshot or {}).get('daily_workers_paid_weekly_off')
        if rules_snapshot and 'daily_workers_paid_weekly_off' in rules_snapshot
        else get_setting('daily_workers_paid_weekly_off', employee, default=False)
    )
    daily_workers_paid_holiday = (
        (rules_snapshot or {}).get('daily_workers_paid_holiday')
        if rules_snapshot and 'daily_workers_paid_holiday' in rules_snapshot
        else get_setting('daily_workers_paid_holiday', employee, default=True)
    )
    ot_multiplier = _quantize(
        (rules_snapshot or {}).get('overtime_hourly_rate_multiplier')
        or get_setting('overtime_hourly_rate_multiplier', employee, default=1.5)
    )
    ot_mode = (
        (rules_snapshot or {}).get('overtime_rate_mode')
        or get_setting('overtime_rate_mode', employee, default='multiplier')
    )
    ot_default_fixed_rate = _quantize(
        (rules_snapshot or {}).get('overtime_default_hourly_rate')
        or get_setting('overtime_default_hourly_rate', employee, default=0.0)
    )
    ot_requires_approval = (
        (rules_snapshot or {}).get('overtime_requires_approval')
        if rules_snapshot and 'overtime_requires_approval' in rules_snapshot
        else get_setting('overtime_requires_approval', employee, default=False)
    )
    allow_negative_net = (
        (rules_snapshot or {}).get('allow_negative_net_salary')
        if rules_snapshot and 'allow_negative_net_salary' in rules_snapshot
        else get_setting('allow_negative_net_salary', employee, default=False)
    )

    # 4. Determine Divisor and Daily/Hourly Rates
    if divisor_mode == 'fixed_30':
        divisor = Decimal('30')
    elif divisor_mode == 'working_days':
        divisor = Decimal(str(last_day - counts.get('weekly_off', 0)))
        if divisor <= 0:
            divisor = Decimal(str(last_day))
    else:
        divisor = Decimal(str(last_day))

    base_amount = _quantize(structure.amount)

    if structure.mode == SalaryStructure.MODE_MONTHLY:
        daily_rate = _quantize(base_amount / divisor)
    else:
        daily_rate = base_amount

    # Standard 8-hour workday for hourly rate conversion
    hourly_rate = _quantize(daily_rate / Decimal('8'))

    # Overtime rate
    if structure.overtime_rate and structure.overtime_rate > Decimal('0.00'):
        ot_rate = _quantize(structure.overtime_rate)
    elif ot_mode == 'fixed' and ot_default_fixed_rate > Decimal('0.00'):
        ot_rate = ot_default_fixed_rate
    else:
        ot_rate = _quantize(hourly_rate * ot_multiplier)

    lines: list[dict[str, Any]] = []

    # 5. Calculate Earnings
    if structure.mode == SalaryStructure.MODE_MONTHLY:
        # Check pro-rating if employee joined mid-month or structure started mid-month
        effective_start = max(month_start, structure.from_date)
        if employee.join_date:
            effective_start = max(effective_start, employee.join_date)
        effective_end = min(month_end, structure.to_date or month_end)

        is_prorated = (effective_start > month_start or effective_end < month_end)

        if is_prorated:
            active_days = max(0, (effective_end - effective_start).days + 1)
            prorated_base = _quantize(daily_rate * Decimal(str(active_days)))
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'BASIC_PRORATED',
                'label': f"Basic Monthly Salary (Pro-rated {effective_start.strftime('%d %b')} - {effective_end.strftime('%d %b')})",
                'quantity': Decimal(str(active_days)),
                'rate': daily_rate,
                'amount': prorated_base,
                'formula_text': f"₹{daily_rate}/day × {active_days} days",
                'source_ref': 'base_prorated',
            })
        else:
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'BASIC',
                'label': 'Basic Monthly Salary',
                'quantity': Decimal('1.00'),
                'rate': base_amount,
                'amount': base_amount,
                'formula_text': f"Fixed monthly salary (divisor: {divisor_mode})",
                'source_ref': 'base_monthly',
            })

        # Monthly Deductions for Absent, Half Day, Unpaid Leave
        if counts.get('absent', 0) > 0:
            qty = Decimal(str(counts['absent']))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_DEDUCTION,
                'code': 'DED_ABSENT',
                'label': f"Absent Days Cut ({counts['absent']} day{'s' if counts['absent'] > 1 else ''})",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'attendance_absent',
            })

        if counts.get('half_day', 0) > 0:
            qty = _quantize(Decimal(str(counts['half_day'])) * Decimal('0.50'))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_DEDUCTION,
                'code': 'DED_HALF_DAY',
                'label': f"Half Day Deductions ({counts['half_day']} occurrence{'s' if counts['half_day'] > 1 else ''})",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{counts['half_day']} × 0.5 = {qty} days × ₹{daily_rate}/day",
                'source_ref': 'attendance_half_day',
            })

        if counts.get('unpaid_leave', 0) > 0:
            qty = Decimal(str(counts['unpaid_leave']))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_DEDUCTION,
                'code': 'DED_UNPAID_LEAVE',
                'label': f"Unpaid Leave / LOP ({counts['unpaid_leave']} day{'s' if counts['unpaid_leave'] > 1 else ''})",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'attendance_lop',
            })

    else:
        # DAILY Wage Mode
        # 1. Worked full days
        present_count = counts.get('present', 0)
        if present_count > 0:
            qty = Decimal(str(present_count))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'DAILY_PRESENT',
                'label': f"Present Days Worked ({present_count} days)",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'daily_present',
            })

        # 2. Worked half days
        half_count = counts.get('half_day', 0)
        if half_count > 0:
            qty = _quantize(Decimal(str(half_count)) * Decimal('0.50'))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'DAILY_HALF',
                'label': f"Half Days Worked ({half_count} times = {qty} days)",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'daily_half',
            })

        # 3. Paid leaves
        paid_leave_count = counts.get('paid_leave', 0)
        if paid_leave_count > 0:
            qty = Decimal(str(paid_leave_count))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'DAILY_PAID_LEAVE',
                'label': f"Paid Leave ({paid_leave_count} days)",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'daily_paid_leave',
            })

        # 4. Weekly Off if configured as paid for daily workers
        if daily_workers_paid_weekly_off and counts.get('weekly_off', 0) > 0:
            qty = Decimal(str(counts['weekly_off']))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'DAILY_WEEKLY_OFF',
                'label': f"Weekly Off Pay ({counts['weekly_off']} days)",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'daily_weekly_off',
            })

        # 5. Public Holidays if configured as paid for daily workers
        if daily_workers_paid_holiday and counts.get('holiday', 0) > 0:
            qty = Decimal(str(counts['holiday']))
            amt = _quantize(qty * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_EARNING,
                'code': 'DAILY_HOLIDAY',
                'label': f"Paid Holiday ({counts['holiday']} days)",
                'quantity': qty,
                'rate': daily_rate,
                'amount': amt,
                'formula_text': f"{qty} days × ₹{daily_rate}/day",
                'source_ref': 'daily_holiday',
            })

    # 6. Overtime Earning (both modes) - respect ot_override_minutes
    # Recompute from actual AttendanceDay records to use manager overrides.
    # Filter by store when provided to avoid cross-store OT accumulation.
    from django.db.models import Sum as _Sum
    _, month_last_day = calendar.monthrange(year, month)
    ot_days_filter = dict(
        employee=employee,
        business_date__gte=date(year, month, 1),
        business_date__lte=date(year, month, month_last_day),
        status__in=[AttendanceDay.STATUS_PRESENT, 'half_day'],
    )
    if store is not None:
        ot_days_filter['store'] = store
    ot_days = AttendanceDay.objects.filter(**ot_days_filter)
    tot_ot_min = 0
    for ot_day in ot_days:
        effective_ot = (
            ot_day.ot_override_minutes
            if ot_day.ot_override_minutes is not None
            else ot_day.overtime_minutes
        )
        if effective_ot:
            if ot_requires_approval and not ot_day.ot_verified:
                continue
            tot_ot_min += effective_ot

    if tot_ot_min > 0:
        ot_hours = _quantize(Decimal(str(tot_ot_min)) / Decimal('60.0'))
        ot_amt = _quantize(ot_hours * ot_rate)
        lines.append({
            'line_type': SalaryLine.TYPE_EARNING,
            'code': 'OVERTIME',
            'label': f"Overtime ({tot_ot_min} mins = {ot_hours} hrs)",
            'quantity': ot_hours,
            'rate': ot_rate,
            'amount': ot_amt,
            'formula_text': f"{ot_hours} hrs × ₹{ot_rate}/hr",
            'source_ref': 'attendance_overtime',
        })

    # 7. Late Penalties Deductions
    daily_penalties = att.get('daily_penalties', [])
    for p in daily_penalties:
        pval = Decimal(str(p['penalty'].get('value', 0)))
        if pval > 0:
            p_amt = _quantize(pval * daily_rate)
            lines.append({
                'line_type': SalaryLine.TYPE_DEDUCTION,
                'code': 'DED_LATE_DAILY',
                'label': f"Late Arrival Cut ({p['business_date']}: {p['late_minutes']}m)",
                'quantity': pval,
                'rate': daily_rate,
                'amount': p_amt,
                'formula_text': f"{pval} day fraction × ₹{daily_rate}/day",
                'source_ref': f"late_daily_{p['business_date']}",
            })

    # Monthly Late Rule Threshold Penalty
    m_late_rule = att.get('monthly_late_rule', {})
    if m_late_rule.get('triggered') and m_late_rule.get('penalty'):
        p_info = m_late_rule['penalty']
        pval = Decimal(str(p_info.get('penalty_value', 0.5)))
        p_amt = _quantize(pval * daily_rate)
        lines.append({
            'line_type': SalaryLine.TYPE_DEDUCTION,
            'code': 'DED_LATE_THRESHOLD',
            'label': f"Late Marks Threshold Penalty ({p_info.get('actual_count')} arrivals >= {p_info.get('threshold')})",
            'quantity': pval,
            'rate': daily_rate,
            'amount': p_amt,
            'formula_text': f"{p_info.get('rule_name')}: {pval} day cut × ₹{daily_rate}/day",
            'source_ref': 'late_monthly_threshold',
        })

    # 8. Monthly Payroll Adjustments (bonuses, fines, incentives)
    adjustments = PayrollAdjustment.objects.filter(
        employee=employee,
        year=year,
        month=month
    )
    for adj in adjustments:
        adj_amount = _quantize(adj.amount)
        if adj.adjustment_type in [PayrollAdjustment.TYPE_BONUS, PayrollAdjustment.TYPE_INCENTIVE]:
            lines.append({
                'line_type': SalaryLine.TYPE_ADDITION,
                'code': f"ADJ_{adj.adjustment_type.upper()}",
                'label': f"{adj.label} ({adj.get_adjustment_type_display()})",
                'quantity': Decimal('1.00'),
                'rate': adj_amount,
                'amount': adj_amount,
                'formula_text': f"Manual adjustment: {adj.note or adj.label}",
                'source_ref': f"adj_{adj.id}",
            })
        else:
            lines.append({
                'line_type': SalaryLine.TYPE_DEDUCTION,
                'code': f"ADJ_{adj.adjustment_type.upper()}",
                'label': f"{adj.label} ({adj.get_adjustment_type_display()})",
                'quantity': Decimal('1.00'),
                'rate': adj_amount,
                'amount': adj_amount,
                'formula_text': f"Manual adjustment: {adj.note or adj.label}",
                'source_ref': f"adj_{adj.id}",
            })

    # 9. Compute Aggregates
    gross = Decimal('0.00')
    total_deductions = Decimal('0.00')
    total_additions = Decimal('0.00')

    for line in lines:
        if line['line_type'] == SalaryLine.TYPE_EARNING:
            gross += line['amount']
        elif line['line_type'] == SalaryLine.TYPE_DEDUCTION:
            total_deductions += line['amount']
        elif line['line_type'] == SalaryLine.TYPE_ADDITION:
            total_additions += line['amount']

    net = gross - total_deductions + total_additions
    if not allow_negative_net and net < Decimal('0.00'):
        net = Decimal('0.00')

    return {
        'has_structure': True,
        'mode': structure.mode,
        'structure_id': structure.id,
        'gross': _quantize(gross),
        'total_deductions': _quantize(total_deductions),
        'total_additions': _quantize(total_additions),
        'net': _quantize(net),
        'lines': lines,
        'days_summary': counts,
    }


def generate_draft_payroll(
    store: Store,
    year: int,
    month: int,
    actor: StaffMember | None = None,
    proceed_with_needs_review: bool = False
) -> PayrollRun:
    """
    Generates or recalculates draft PayrollRun and SalaryStatements for a store.
    """
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    with transaction.atomic():
        # Check if already finalized
        existing_run = PayrollRun.objects.filter(store=store, year=year, month=month).first()
        if existing_run and existing_run.status == PayrollRun.STATUS_FINALIZED:
            raise ValueError(
                f"Payroll for {store.name} ({year}-{month:02d}) is already finalized. "
                "Reopen it first if you need to recalculate."
            )

        # Check for unreviewed attendance days
        unreviewed_count = AttendanceDay.objects.filter(
            store=store,
            business_date__gte=start_date,
            business_date__lte=end_date,
            status=AttendanceDay.STATUS_NEEDS_REVIEW
        ).count()

        if unreviewed_count > 0 and not proceed_with_needs_review:
            raise ValueError(
                f"Cannot generate payroll: {unreviewed_count} attendance day(s) have 'Needs Review' status. "
                "Please review them or check 'Proceed with unresolved days'."
            )

        # Snapshot HR settings for this store
        rules_snapshot = get_all_settings_for_store(store)

        if existing_run:
            payroll_run = existing_run
            payroll_run.rules_snapshot = rules_snapshot
            payroll_run.status = PayrollRun.STATUS_DRAFT
            payroll_run.save()
            # Clear previous draft statements and lines
            payroll_run.statements.all().delete()
        else:
            payroll_run = PayrollRun.objects.create(
                store=store,
                year=year,
                month=month,
                status=PayrollRun.STATUS_DRAFT,
                rules_snapshot=rules_snapshot,
            )

        # Fetch active employees assigned to this store during this month
        assignments = EmployeeStoreAssignment.objects.filter(
            store=store,
            from_date__lte=end_date,
        ).filter(to_date__isnull=True) | EmployeeStoreAssignment.objects.filter(
            store=store,
            from_date__lte=end_date,
            to_date__gte=start_date,
        )
        assigned_emp_ids = set(assignments.values_list('employee_id', flat=True).distinct())
        direct_emp_ids = set(Employee.objects.filter(store=store, is_active=True).values_list('id', flat=True))
        all_emp_ids = assigned_emp_ids.union(direct_emp_ids)
        employees = Employee.objects.filter(id__in=all_emp_ids, is_active=True).order_by('employee_code')

        for emp in employees:
            salary_data = calculate_employee_salary(emp, year, month, rules_snapshot, store=store)
            if not salary_data['has_structure']:
                continue

            # Subtract any INTERIM_WAGE_CREDIT already posted for this employee this month
            # so the final payroll shows only the REMAINING payable.
            from django.db.models import Sum as _ISum, Q as _IQ
            month_start_d = date(year, month, 1)
            month_end_d = date(year, month, last_day)

            # Match interim wage credits by attendance settlement_ref or entry_date within the month
            month_settlement_refs = list(
                AttendanceDay.objects.filter(
                    employee=emp,
                    store=store,
                    business_date__gte=month_start_d,
                    business_date__lte=month_end_d,
                    is_settled=True,
                ).exclude(settlement_ref='').values_list('settlement_ref', flat=True).distinct()
            )

            already_settled = EmployeeLedgerEntry.objects.filter(
                employee=emp,
                store=store,
                entry_type=EmployeeLedgerEntry.ENTRY_INTERIM_WAGE_CREDIT,
                reversal_entry__isnull=True,
            ).filter(
                _IQ(reference_no__in=month_settlement_refs) |
                _IQ(entry_date__gte=month_start_d, entry_date__lte=month_end_d)
            ).aggregate(total=_ISum('amount'))['total'] or Decimal('0.00')
            already_settled = _quantize(already_settled)

            # Build final lines with already-settled deduction
            all_lines = list(salary_data['lines'])
            if already_settled > Decimal('0.00'):
                all_lines.append({
                    'line_type': SalaryLine.TYPE_DEDUCTION,
                    'code': 'DED_INTERIM_SETTLED',
                    'label': f"Already Settled (Interim Wage Credits)",
                    'quantity': Decimal('1.00'),
                    'rate': already_settled,
                    'amount': already_settled,
                    'formula_text': f"Previously disbursed in interim settlements this month",
                    'source_ref': 'interim_settled',
                })

            # Recompute net from final lines
            gross = Decimal('0.00')
            total_deductions = Decimal('0.00')
            total_additions = Decimal('0.00')
            for line in all_lines:
                if line['line_type'] == SalaryLine.TYPE_EARNING:
                    gross += line['amount']
                elif line['line_type'] == SalaryLine.TYPE_DEDUCTION:
                    total_deductions += line['amount']
                elif line['line_type'] == SalaryLine.TYPE_ADDITION:
                    total_additions += line['amount']
            net = _quantize(gross - total_deductions + total_additions)
            if net < Decimal('0.00'):
                net = Decimal('0.00')

            statement = SalaryStatement.objects.create(
                payroll_run=payroll_run,
                employee=emp,
                mode=salary_data['mode'],
                gross=_quantize(gross),
                total_deductions=_quantize(total_deductions),
                total_additions=_quantize(total_additions),
                net=net,
                days_summary=salary_data['days_summary'],
                rules_snapshot=rules_snapshot,
                is_included=True,
            )

            lines_to_create = [
                SalaryLine(
                    statement=statement,
                    line_type=l['line_type'],
                    code=l['code'],
                    label=l['label'],
                    quantity=l['quantity'],
                    rate=l['rate'],
                    amount=l['amount'],
                    formula_text=l['formula_text'],
                    source_ref=l['source_ref'],
                )
                for l in all_lines
            ]
            SalaryLine.objects.bulk_create(lines_to_create)

        return payroll_run


def finalize_payroll(
    payroll_run: PayrollRun,
    actor: StaffMember | None = None
) -> PayrollRun:
    """
    Finalizes a draft PayrollRun:
    - Locks the attendance month.
    - Accrues payable balances on the EmployeeLedger.
    - Dispatches accounting expense sync.
    - Idempotent: if already finalized, returns current state safely.
    """
    _, last_day = calendar.monthrange(payroll_run.year, payroll_run.month)
    month_end = date(payroll_run.year, payroll_run.month, last_day)

    import zoneinfo
    tz_name = getattr(payroll_run.store, 'timezone', None) or 'Asia/Kolkata'
    try:
        store_tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        store_tz = zoneinfo.ZoneInfo('Asia/Kolkata')
    today = timezone.now().astimezone(store_tz).date()

    if today <= month_end:
        next_allowed_date = month_end + timedelta(days=1)
        raise ValueError(
            f"Cannot finalize payroll for {calendar.month_name[payroll_run.month]} {payroll_run.year}: "
            f"the month is still ongoing. Payroll can only be finalized once the month has concluded "
            f"(on or after {next_allowed_date.strftime('%B %d, %Y')})."
        )

    with transaction.atomic():
        # Concurrency lock on run
        run = PayrollRun.objects.select_for_update().get(pk=payroll_run.pk)
        if run.status == PayrollRun.STATUS_FINALIZED:
            return run

        # Capture manual exclusions
        excluded_ids = set(run.statements.filter(is_included=False).values_list('employee_id', flat=True))

        # Re-sync draft statements to ensure latest attendance, adjustments and interim settlements are incorporated
        generate_draft_payroll(store=run.store, year=run.year, month=run.month, proceed_with_needs_review=True)
        run.refresh_from_db()
        if excluded_ids:
            run.statements.filter(employee_id__in=excluded_ids).update(is_included=False)

        # 1. Lock all attendance days for this store & month
        lock_month(store=run.store, year=run.year, month=run.month, actor=actor)

        # 2. Mark payroll as finalized
        run.status = PayrollRun.STATUS_FINALIZED
        run.finalized_at = timezone.now()
        run.finalized_by = actor
        run.save()

        # 3. Post SALARY_ACCRUAL ledger entry for each included statement
        for stmt in run.statements.filter(is_included=True):
            # Check if an accrual entry already exists for this statement
            if not EmployeeLedgerEntry.objects.filter(related_statement=stmt, entry_type=EmployeeLedgerEntry.ENTRY_SALARY_ACCRUAL).exists():
                add_entry(
                    employee=stmt.employee,
                    store=run.store,
                    entry_type=EmployeeLedgerEntry.ENTRY_SALARY_ACCRUAL,
                    amount=stmt.net, # Positive: store owes staff
                    entry_date=month_end,
                    payment_method='accrual',
                    reference_no=f"PR-{run.id}-STMT-{stmt.id}",
                    note=f"Monthly salary accrual for {calendar.month_name[run.month]} {run.year}",
                    related_statement=stmt,
                    actor=actor,
                )

        # 4. Sync accrual to Accounting OperatingExpense
        sync_payroll_to_accounting(run)

        return run


def reopen_payroll(
    payroll_run: PayrollRun,
    actor: StaffMember | None = None,
    reason: str = ''
) -> PayrollRun:
    """
    Safely reopens a finalized payroll run:
    - Atomically reverses all generated SALARY_ACCRUAL ledger entries.
    - Unlocks attendance days for the month.
    - Reverses accounting expense entry.
    - Sets payroll run status back to draft.
    """
    with transaction.atomic():
        run = PayrollRun.objects.select_for_update().get(pk=payroll_run.pk)
        if run.status != PayrollRun.STATUS_FINALIZED:
            raise ValueError("Only finalized payroll runs can be reopened.")

        # 1. Reverse all related salary accrual ledger entries
        for stmt in run.statements.all():
            accrual_entries = EmployeeLedgerEntry.objects.filter(
                related_statement=stmt,
                entry_type=EmployeeLedgerEntry.ENTRY_SALARY_ACCRUAL
            )
            for acc in accrual_entries:
                if not EmployeeLedgerEntry.objects.filter(reversed_entry=acc).exists():
                    reverse_entry(
                        entry_id=acc.id,
                        reason=f"Payroll reopened: {reason or 'Administrative recalculation'}",
                        actor=actor
                    )

        # 2. Unlock attendance days
        unlock_month(store=run.store, year=run.year, month=run.month, actor=actor)

        # 3. Reverse in accounting
        reverse_payroll_in_accounting(run)

        # 4. Set status back to draft
        run.status = PayrollRun.STATUS_DRAFT
        run.reopened_at = timezone.now()
        run.reopened_by = actor
        run.reopen_reason = reason
        run.save()

        return run
