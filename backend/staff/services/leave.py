"""
Leave & Holidays Management Service.
Handles leave applications, quota deduction, append-only balance ledger,
cancellations, carry-forward, and automated attendance day rebuilds.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Sum

from ..models import (
    Employee,
    LeaveType,
    LeaveRequest,
    LeaveBalanceEntry,
    Holiday,
    AttendanceAuditLog,
    StaffMember,
)
from inventory.models import Store
from .settings import get_setting
from .attendance import rebuild_day, models_q_store


def calculate_leave_days_count(
    employee: Employee,
    from_date: date,
    to_date: date,
    half_day: bool = False
) -> Decimal:
    """
    Computes effective leave days, adjusting for weekly off and holiday overlap settings.
    """
    if half_day:
        return Decimal('0.50')

    effective_store = employee.store
    overlap_holiday = get_setting('leave_overlap_holiday_counts', employee)
    overlap_weekly_off = get_setting('leave_overlap_weekly_off_counts', employee)

    # Resolve weekly off days
    shift_assignment = employee.shift_assignments.filter(
        from_date__lte=from_date
    ).order_by('-from_date').first()
    weekly_offs = shift_assignment.weekly_off_days if (shift_assignment and shift_assignment.weekly_off_days is not None) else get_setting('default_weekly_off_days', employee, default=[6])

    total_days = Decimal('0.00')
    curr = from_date
    while curr <= to_date:
        # Check weekly off
        if not overlap_weekly_off and curr.weekday() in weekly_offs:
            curr += timedelta(days=1)
            continue

        # Check holiday
        if not overlap_holiday:
            is_holiday = Holiday.objects.filter(date=curr).filter(models_q_store(effective_store)).exists()
            if is_holiday:
                curr += timedelta(days=1)
                continue

        total_days += Decimal('1.00')
        curr += timedelta(days=1)

    return total_days


def get_leave_balance(employee: Employee, leave_type: LeaveType, year: int) -> Decimal:
    """
    Computes available balance from append-only LeaveBalanceEntry ledger.
    If no entries exist for the year, seeds standard annual quota.
    """
    existing_entries = LeaveBalanceEntry.objects.filter(
        employee=employee,
        leave_type=leave_type,
        year=year
    )

    if not existing_entries.exists() and leave_type.annual_quota_days > Decimal('0.00'):
        # Seed initial allocation
        LeaveBalanceEntry.objects.create(
            employee=employee,
            leave_type=leave_type,
            year=year,
            amount=leave_type.annual_quota_days,
            kind=LeaveBalanceEntry.KIND_ALLOCATION,
            ref=f"Initial allocation {year}"
        )

    total = LeaveBalanceEntry.objects.filter(
        employee=employee,
        leave_type=leave_type,
        year=year
    ).aggregate(total=Sum('amount'))['total']

    return total if total is not None else Decimal('0.00')


def submit_leave_request(
    employee: Employee,
    leave_type: LeaveType,
    from_date: date,
    to_date: date,
    half_day: bool = False,
    half_day_period: str = '',
    reason: str = '',
    actor: StaffMember | None = None
) -> LeaveRequest:
    """
    Submits a leave request with quota validation.
    Auto-approves if auto_approve_leave setting is active.
    """
    if to_date < from_date:
        raise ValueError("Leave to_date cannot be earlier than from_date.")

    days_count = calculate_leave_days_count(employee, from_date, to_date, half_day)
    if days_count <= Decimal('0.00'):
        raise ValueError("Selected range contains only holidays or weekly off days.")

    year = from_date.year
    balance = get_leave_balance(employee, leave_type, year)

    if not leave_type.allow_negative_balance and balance < days_count:
        raise ValueError(
            f"Insufficient {leave_type.name} balance. Available: {balance} days, Requested: {days_count} days."
        )

    with transaction.atomic():
        leave_req = LeaveRequest.objects.create(
            employee=employee,
            leave_type=leave_type,
            from_date=from_date,
            to_date=to_date,
            half_day=half_day,
            half_day_period=half_day_period if half_day else '',
            days_count=days_count,
            status=LeaveRequest.STATUS_PENDING,
            reason=reason.strip()
        )

        if get_setting('auto_approve_leave', employee):
            approve_leave_request(leave_req, actor=actor, notes="Auto-approved by HR system setting.")

    return leave_req


def approve_leave_request(
    leave_request: LeaveRequest,
    actor: StaffMember | None,
    notes: str = ""
) -> LeaveRequest:
    """
    Approves leave request, posts debit entry to balance ledger,
    and rebuilds affected attendance days.
    """
    if leave_request.status == LeaveRequest.STATUS_APPROVED:
        return leave_request

    with transaction.atomic():
        leave_request.status = LeaveRequest.STATUS_APPROVED
        leave_request.decided_by = actor
        leave_request.decision_notes = notes.strip()
        leave_request.save(update_fields=['status', 'decided_by', 'decision_notes'])

        # Post debit entry to ledger
        LeaveBalanceEntry.objects.create(
            employee=leave_request.employee,
            leave_type=leave_request.leave_type,
            year=leave_request.from_date.year,
            amount=-leave_request.days_count,
            kind=LeaveBalanceEntry.KIND_USED,
            ref=f"LeaveRequest #{leave_request.id}"
        )

        # Audit Log
        AttendanceAuditLog.objects.create(
            action='leave_decision',
            actor=actor,
            target_type='LeaveRequest',
            target_id=str(leave_request.id),
            before_state={'status': LeaveRequest.STATUS_PENDING},
            after_state={'status': LeaveRequest.STATUS_APPROVED},
            reason=notes or f"Approved {leave_request.leave_type.code} leave ({leave_request.days_count} days)"
        )

        # Rebuild all affected dates
        curr = leave_request.from_date
        while curr <= leave_request.to_date:
            rebuild_day(leave_request.employee, curr, force=True)
            curr += timedelta(days=1)

    return leave_request


def reject_leave_request(
    leave_request: LeaveRequest,
    actor: StaffMember | None,
    notes: str = ""
) -> LeaveRequest:
    """
    Rejects leave application.
    """
    leave_request.status = LeaveRequest.STATUS_REJECTED
    leave_request.decided_by = actor
    leave_request.decision_notes = notes.strip()
    leave_request.save(update_fields=['status', 'decided_by', 'decision_notes'])

    AttendanceAuditLog.objects.create(
        action='leave_decision',
        actor=actor,
        target_type='LeaveRequest',
        target_id=str(leave_request.id),
        before_state={'status': LeaveRequest.STATUS_PENDING},
        after_state={'status': LeaveRequest.STATUS_REJECTED},
        reason=notes or "Leave rejected by manager"
    )

    return leave_request


def cancel_leave_request(
    leave_request: LeaveRequest,
    actor: StaffMember | None,
    notes: str = ""
) -> LeaveRequest:
    """
    Cancels an approved or pending leave request.
    If already approved, credits back the deducted days to the balance ledger.
    """
    was_approved = leave_request.status == LeaveRequest.STATUS_APPROVED

    with transaction.atomic():
        leave_request.status = LeaveRequest.STATUS_CANCELLED
        leave_request.decision_notes = notes.strip()
        leave_request.save(update_fields=['status', 'decision_notes'])

        if was_approved:
            # Refund deducted days
            LeaveBalanceEntry.objects.create(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.from_date.year,
                amount=leave_request.days_count,
                kind=LeaveBalanceEntry.KIND_ADJUSTMENT,
                ref=f"Refund for cancelled LeaveRequest #{leave_request.id}"
            )

            # Rebuild affected days back to normal
            curr = leave_request.from_date
            while curr <= leave_request.to_date:
                rebuild_day(leave_request.employee, curr, force=True)
                curr += timedelta(days=1)

        AttendanceAuditLog.objects.create(
            action='leave_decision',
            actor=actor,
            target_type='LeaveRequest',
            target_id=str(leave_request.id),
            before_state={'status': LeaveRequest.STATUS_APPROVED if was_approved else LeaveRequest.STATUS_PENDING},
            after_state={'status': LeaveRequest.STATUS_CANCELLED},
            reason=notes or "Leave cancelled"
        )

    return leave_request


def run_year_end_carry_forward(store: Store, year: int, actor: StaffMember | None = None) -> list[LeaveBalanceEntry]:
    """
    Executes annual carry-forward action for eligible leave types.
    """
    created_entries = []
    employees = Employee.objects.filter(store=store, is_active=True)
    carry_types = LeaveType.objects.filter(carry_forward=True)

    with transaction.atomic():
        for emp in employees:
            for lt in carry_types:
                balance = get_leave_balance(emp, lt, year)
                if balance > Decimal('0.00'):
                    entry = LeaveBalanceEntry.objects.create(
                        employee=emp,
                        leave_type=lt,
                        year=year + 1,
                        amount=balance,
                        kind=LeaveBalanceEntry.KIND_CARRY_FORWARD,
                        ref=f"Carry-forward from {year}"
                    )
                    created_entries.append(entry)

        AttendanceAuditLog.objects.create(
            action='leave_carry_forward',
            actor=actor,
            target_type='Store',
            target_id=str(store.id),
            before_state={'year': year},
            after_state={'year': year + 1, 'entries_created': len(created_entries)},
            reason=f"Executed year-end carry forward for store {store.name} from {year} to {year + 1}"
        )

    return created_entries
