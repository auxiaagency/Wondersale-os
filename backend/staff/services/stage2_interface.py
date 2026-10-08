"""
Stage 2 Interface Hooks for Payroll and Finance Integration.
Builds aggregated monthly metrics, rules evaluation, and month locking.
Contains NO monetary calculations (strictly structured counts, fractions, minutes, and penalties).
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any
import calendar

from ..models import Employee, AttendanceDay, AttendanceAuditLog, StaffMember
from inventory.models import Store
from .settings import get_setting


def get_month_attendance(employee: Employee, year: int, month: int) -> dict[str, Any]:
    """
    Returns complete monthly attendance summary and day-by-day records
    required for Stage 2 salary and payroll computation.
    """
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    days_qs = AttendanceDay.objects.filter(
        employee=employee,
        business_date__gte=start_date,
        business_date__lte=end_date
    ).order_by('business_date')

    days_map = {d.business_date: d for d in days_qs}

    counts = {
        'present': 0,
        'half_day': 0,
        'absent': 0,
        'paid_leave': 0,
        'unpaid_leave': 0,
        'weekly_off': 0,
        'holiday': 0,
        'needs_review': 0,
    }

    total_worked_minutes = 0
    total_overtime_minutes = 0
    total_late_count = 0
    total_day_fraction_paid = Decimal('0.00')
    late_penalties_list = []
    days_data = []

    today = date.today()
    curr = start_date
    while curr <= end_date:
        if employee.join_date and curr < employee.join_date:
            counts['not_joined'] = counts.get('not_joined', 0) + 1
            days_data.append({
                'business_date': curr.isoformat(),
                'status': 'not_joined',
                'first_in': None,
                'last_out': None,
                'worked_minutes': 0,
                'late_minutes': 0,
                'early_leave_minutes': 0,
                'overtime_minutes': 0,
                'day_fraction_paid': '0.00',
                'late_penalty': {'kind': 'none', 'value': 0},
                'flags': [],
                'is_locked': False,
            })
        elif employee.exit_date and curr > employee.exit_date:
            counts['separated'] = counts.get('separated', 0) + 1
            days_data.append({
                'business_date': curr.isoformat(),
                'status': 'separated',
                'first_in': None,
                'last_out': None,
                'worked_minutes': 0,
                'late_minutes': 0,
                'early_leave_minutes': 0,
                'overtime_minutes': 0,
                'day_fraction_paid': '0.00',
                'late_penalty': {'kind': 'none', 'value': 0},
                'flags': [],
                'is_locked': False,
            })
        else:
            d = days_map.get(curr)
            if d:
                status = d.status
                counts[status] = counts.get(status, 0) + 1
                total_worked_minutes += d.worked_minutes
                total_overtime_minutes += d.overtime_minutes
                total_day_fraction_paid += d.day_fraction_paid
                if d.late_minutes > 0:
                    total_late_count += 1
                if d.late_penalty and d.late_penalty.get('kind') != 'none':
                    late_penalties_list.append({
                        'business_date': curr.isoformat(),
                        'late_minutes': d.late_minutes,
                        'penalty': d.late_penalty
                    })

                days_data.append({
                    'business_date': curr.isoformat(),
                    'status': d.status,
                    'first_in': d.first_in.isoformat() if d.first_in else None,
                    'last_out': d.last_out.isoformat() if d.last_out else None,
                    'worked_minutes': d.worked_minutes,
                    'late_minutes': d.late_minutes,
                    'early_leave_minutes': d.early_leave_minutes,
                    'overtime_minutes': d.overtime_minutes,
                    'day_fraction_paid': str(d.day_fraction_paid),
                    'late_penalty': d.late_penalty,
                    'flags': d.flags,
                    'is_locked': d.is_locked,
                })
            elif curr > today:
                counts['future'] = counts.get('future', 0) + 1
                days_data.append({
                    'business_date': curr.isoformat(),
                    'status': 'future',
                    'first_in': None,
                    'last_out': None,
                    'worked_minutes': 0,
                    'late_minutes': 0,
                    'early_leave_minutes': 0,
                    'overtime_minutes': 0,
                    'day_fraction_paid': '0.00',
                    'late_penalty': {'kind': 'none', 'value': 0},
                    'flags': [],
                    'is_locked': False,
                })
            else:
                counts['absent'] += 1
                days_data.append({
                    'business_date': curr.isoformat(),
                    'status': AttendanceDay.STATUS_ABSENT,
                    'first_in': None,
                    'last_out': None,
                    'worked_minutes': 0,
                    'late_minutes': 0,
                    'early_leave_minutes': 0,
                    'overtime_minutes': 0,
                    'day_fraction_paid': '0.00',
                    'late_penalty': {'kind': 'none', 'value': 0},
                    'flags': [],
                    'is_locked': False,
                })
        curr = curr + timedelta(days=1)

    # Evaluate Month-level rules (e.g. N late marks threshold rule)
    monthly_rule_setting = get_setting('late_marks_threshold_rule', employee) or {}
    monthly_rule_triggered = False
    monthly_rule_penalty = None

    if monthly_rule_setting:
        thresh = monthly_rule_setting.get('monthly_count', 3)
        if total_late_count >= thresh:
            monthly_rule_triggered = True
            monthly_rule_penalty = {
                'rule_name': f"Late marks threshold ({thresh} times)",
                'threshold': thresh,
                'actual_count': total_late_count,
                'penalty_kind': monthly_rule_setting.get('penalty_kind', 'fraction_of_day'),
                'penalty_value': monthly_rule_setting.get('penalty_value', 0.50),
            }

    # Lock state: true if all days in month are locked
    is_month_locked = days_qs.exists() and not days_qs.filter(is_locked=False).exists()

    return {
        'employee_id': employee.id,
        'employee_code': employee.employee_code,
        'employee_name': employee.name,
        'year': year,
        'month': month,
        'total_calendar_days': last_day,
        'counts': counts,
        'total_worked_minutes': total_worked_minutes,
        'total_worked_hours': round(total_worked_minutes / 60, 2),
        'total_overtime_minutes': total_overtime_minutes,
        'total_late_count': total_late_count,
        'total_day_fraction_paid': str(total_day_fraction_paid),
        'daily_penalties': late_penalties_list,
        'monthly_late_rule': {
            'triggered': monthly_rule_triggered,
            'penalty': monthly_rule_penalty,
        },
        'is_locked': is_month_locked,
        'days': days_data,
    }


def lock_month(store: Store, year: int, month: int, actor: StaffMember | None = None) -> int:
    """
    Sets is_locked=True on all AttendanceDays for the store within the month.
    Used by Stage 2 when payroll is finalized.
    Enforces that month must be concluded before locking.
    """
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    today = date.today()
    if today <= end_date:
        next_month_first = end_date + timedelta(days=1)
        month_name = calendar.month_name[month]
        raise ValueError(
            f"Cannot lock attendance for {month_name} {year}: the month is still ongoing. "
            f"Attendance can only be locked once the month has concluded (on or after {next_month_first.strftime('%b %d, %Y')})."
        )

    updated_count = AttendanceDay.objects.filter(
        store=store,
        business_date__gte=start_date,
        business_date__lte=end_date
    ).update(is_locked=True)

    AttendanceAuditLog.objects.create(
        action='month_lock',
        actor=actor,
        target_type='Store',
        target_id=str(store.id),
        before_state={'is_locked': False},
        after_state={'is_locked': True, 'count': updated_count},
        reason=f"Finalized and locked attendance for {year}-{month:02d}"
    )

    return updated_count


def unlock_month(store: Store, year: int, month: int, actor: StaffMember | None = None) -> int:
    """
    Clears is_locked=False on all AttendanceDays for the store within the month.
    """
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    updated_count = AttendanceDay.objects.filter(
        store=store,
        business_date__gte=start_date,
        business_date__lte=end_date
    ).update(is_locked=False)

    AttendanceAuditLog.objects.create(
        action='month_unlock',
        actor=actor,
        target_type='Store',
        target_id=str(store.id),
        before_state={'is_locked': True},
        after_state={'is_locked': False, 'count': updated_count},
        reason=f"Unlocked attendance for {year}-{month:02d}"
    )

    return updated_count
