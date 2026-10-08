"""
Attendance Recalculation Service.
Allows bulk recalculation of date ranges with impact preview, skipping locked days.
"""

from datetime import date, timedelta
from typing import Any
import calendar

from ..models import Employee, AttendanceDay, AttendanceAuditLog, StaffMember
from inventory.models import Store
from .attendance import rebuild_day


def recalculate_attendance(
    store: Store,
    employee: Employee | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    preview_only: bool = False,
    actor: StaffMember | None = None,
    reason: str = ""
) -> dict[str, Any]:
    """
    Recalculates attendance for unlocked days across a date range.
    If preview_only=True, simulates rebuild without saving, returning an impact summary.
    """
    today = date.today()
    if not from_date:
        from_date = today.replace(day=1)
    if not to_date:
        _, last_day = calendar.monthrange(today.year, today.month)
        to_date = today.replace(day=last_day)

    # Validate date bounds
    if from_date > to_date:
        raise ValueError("from_date must not be after to_date.")
    if (to_date - from_date).days > 366:
        raise ValueError(
            "Recalculation range cannot exceed 366 days. Use smaller date windows."
        )

    employees = [employee] if employee else list(Employee.objects.filter(store=store, is_active=True))


    total_evaluated = 0
    days_changed = 0
    locked_skipped = 0
    changes_preview = []

    curr_date = from_date
    while curr_date <= to_date:
        for emp in employees:
            total_evaluated += 1
            existing = AttendanceDay.objects.filter(employee=emp, business_date=curr_date).first()

            if existing and existing.is_locked:
                locked_skipped += 1
                continue

            # Capture state before
            old_status = existing.status if existing else 'none'
            old_fraction = str(existing.day_fraction_paid) if existing else '0.00'
            old_worked = existing.worked_minutes if existing else 0

            if preview_only:
                # Rebuild in rollback atomic transaction to measure difference
                from django.db import transaction
                try:
                    with transaction.atomic():
                        new_day = rebuild_day(emp, curr_date, force=False)
                        new_status = new_day.status
                        new_fraction = str(new_day.day_fraction_paid)
                        new_worked = new_day.worked_minutes
                        raise ValueError("ROLLBACK_SIMULATION")
                except ValueError as e:
                    if str(e) != "ROLLBACK_SIMULATION":
                        raise e
            else:
                new_day = rebuild_day(emp, curr_date, force=False)
                new_status = new_day.status
                new_fraction = str(new_day.day_fraction_paid)
                new_worked = new_day.worked_minutes

            if old_status != new_status or old_fraction != new_fraction or old_worked != new_worked:
                days_changed += 1
                changes_preview.append({
                    'employee_id': emp.id,
                    'employee_code': emp.employee_code,
                    'employee_name': emp.name,
                    'business_date': curr_date.isoformat(),
                    'old_status': old_status,
                    'new_status': new_status,
                    'old_worked_minutes': old_worked,
                    'new_worked_minutes': new_worked,
                    'old_day_fraction': old_fraction,
                    'new_day_fraction': new_fraction,
                })

        curr_date += timedelta(days=1)

    if not preview_only and days_changed > 0:
        AttendanceAuditLog.objects.create(
            action='attendance_recalculate',
            actor=actor,
            target_type='Store',
            target_id=str(store.id),
            before_state={'from_date': from_date.isoformat(), 'to_date': to_date.isoformat()},
            after_state={'days_changed': days_changed, 'locked_skipped': locked_skipped},
            reason=reason or f"Bulk recalculation from {from_date} to {to_date}"
        )

    return {
        'from_date': from_date.isoformat(),
        'to_date': to_date.isoformat(),
        'total_evaluated': total_evaluated,
        'days_changed': days_changed,
        'locked_skipped': locked_skipped,
        'is_preview': preview_only,
        'changes_preview': changes_preview,
    }
