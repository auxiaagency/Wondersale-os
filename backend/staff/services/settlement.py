"""
Interim Payroll Settlement Service.

Provides:
1. calculate_unfinalized_summary() - Preview of unsettled wages for current month
2. get_overtime_pending_verification() - List OT days needing manager approval
3. bulk_verify_overtime() - Manager approves/overrides OT minutes per day
4. settle_interim_payroll() - Atomic interim settlement with cash drawer integration
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
import calendar

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import (
    Employee, EmployeeStoreAssignment, SalaryStructure,
    AttendanceDay, EmployeeLedgerEntry, StaffMember,
)
from inventory.models import Store, DailyRegisterShift, CounterPayout
from .settings import get_setting
from .ledger import add_entry


def _quantize(val):
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_settlement_ref():
    today_str = timezone.now().strftime("%Y%m%d")
    prefix = f"ISETL-{today_str}-"
    existing = (
        AttendanceDay.objects
        .filter(settlement_ref__startswith=prefix)
        .values_list("settlement_ref", flat=True)
        .order_by("-settlement_ref")
        .first()
    )
    if existing:
        try:
            seq = int(existing.split("-")[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def _calculate_daily_rate(structure, year, month):
    _, last_day = calendar.monthrange(year, month)
    base_amount = _quantize(structure.amount)
    if structure.mode == SalaryStructure.MODE_DAILY:
        return base_amount
    divisor_mode = get_setting("monthly_divisor_mode", structure.employee) or "actual"
    divisor = Decimal("30") if divisor_mode == "fixed_30" else Decimal(str(last_day))
    if divisor <= 0:
        divisor = Decimal(str(last_day))
    return _quantize(base_amount / divisor)


def _get_ot_rate(structure, daily_rate):
    if structure and structure.overtime_rate and structure.overtime_rate > Decimal("0.00"):
        return _quantize(structure.overtime_rate)
    emp = structure.employee if structure else None
    ot_mode = get_setting("overtime_rate_mode", emp, default="multiplier")
    if ot_mode == "fixed":
        fixed_rate = get_setting("overtime_default_hourly_rate", emp, default=0.0)
        if fixed_rate and float(fixed_rate) > 0:
            return _quantize(Decimal(str(fixed_rate)))
    ot_multiplier = _quantize(Decimal(str(get_setting("overtime_hourly_rate_multiplier", emp, default=1.5))))
    hourly_rate = _quantize(daily_rate / Decimal("8"))
    return _quantize(hourly_rate * ot_multiplier)


def _get_active_structure(employee, year, month):
    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)
    return (
        SalaryStructure.objects.filter(employee=employee, from_date__lte=month_end)
        .filter(to_date__isnull=True)
        | SalaryStructure.objects.filter(
            employee=employee, from_date__lte=month_end, to_date__gte=month_start
        )
    ).order_by("-from_date").first()


def _get_employees_for_store(store, year, month):
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)
    assignment_ids = set(
        EmployeeStoreAssignment.objects.filter(store=store, from_date__lte=end_date)
        .filter(to_date__isnull=True)
        .values_list("employee_id", flat=True)
        | EmployeeStoreAssignment.objects.filter(
            store=store, from_date__lte=end_date, to_date__gte=start_date
        ).values_list("employee_id", flat=True)
    )
    direct_ids = set(Employee.objects.filter(store=store, is_active=True).values_list("id", flat=True))
    all_ids = assignment_ids | direct_ids
    return Employee.objects.filter(id__in=all_ids, is_active=True).order_by("employee_code")


def _calculate_wage_for_days(employee, days_qs, structure, year, month):
    daily_rate = _calculate_daily_rate(structure, year, month)
    ot_rate = _get_ot_rate(structure, daily_rate)
    base_total = Decimal("0.00")
    ot_total = Decimal("0.00")
    ot_minutes_total = 0
    day_count = 0
    for day in days_qs:
        fraction = _quantize(day.day_fraction_paid)
        base_total += _quantize(fraction * daily_rate)
        day_count += 1
        ot_min = day.ot_override_minutes if day.ot_override_minutes is not None else day.overtime_minutes
        if ot_min and ot_min > 0:
            requires_approval = get_setting("overtime_requires_approval", employee, default=False)
            if not requires_approval or day.ot_verified:
                ot_hours = _quantize(Decimal(str(ot_min)) / Decimal("60"))
                ot_total += _quantize(ot_hours * ot_rate)
                ot_minutes_total += ot_min
    return {
        "total_amount": _quantize(base_total + ot_total),
        "base_amount": _quantize(base_total),
        "ot_amount": _quantize(ot_total),
        "day_count": day_count,
        "daily_rate": daily_rate,
        "ot_rate": ot_rate,
        "ot_minutes_total": ot_minutes_total,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_unfinalized_summary(store, year, month, employee_ids=None):
    """Returns per-employee unsettled wage summary."""
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)
    employees = _get_employees_for_store(store, year, month)
    if employee_ids:
        employees = employees.filter(id__in=employee_ids)
    results = []
    for emp in employees:
        structure = _get_active_structure(emp, year, month)
        if not structure:
            continue
        all_days = AttendanceDay.objects.filter(
            employee=emp, store=store,
            business_date__gte=start_date, business_date__lte=end_date,
        ).exclude(status__in=["future", "not_joined", "separated"])
        settled_days = all_days.filter(is_settled=True)
        unsettled_days = all_days.filter(is_settled=False)
        settled_calc = _calculate_wage_for_days(emp, settled_days, structure, year, month)
        unsettled_calc = _calculate_wage_for_days(emp, unsettled_days, structure, year, month)
        interim_credits = EmployeeLedgerEntry.objects.filter(
            employee=emp, store=store,
            entry_type=EmployeeLedgerEntry.ENTRY_INTERIM_WAGE_CREDIT,
            entry_date__gte=start_date, entry_date__lte=end_date,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        unverified_ot_count = unsettled_days.filter(overtime_minutes__gt=0, ot_verified=False).count()
        unreviewed_count = unsettled_days.filter(status=AttendanceDay.STATUS_NEEDS_REVIEW).count()
        results.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "employee_name": emp.name,
            "structure_mode": structure.mode,
            "daily_rate": str(unsettled_calc["daily_rate"]),
            "settled_days": settled_calc["day_count"],
            "settled_amount": str(settled_calc["total_amount"]),
            "unsettled_days": unsettled_calc["day_count"],
            "pending_amount": str(unsettled_calc["total_amount"]),
            "pending_base": str(unsettled_calc["base_amount"]),
            "pending_ot": str(unsettled_calc["ot_amount"]),
            "pending_ot_minutes": unsettled_calc["ot_minutes_total"],
            "interim_ledger_total": str(interim_credits),
            "unverified_ot_days": unverified_ot_count,
            "unreviewed_days": unreviewed_count,
            "has_pending": unsettled_calc["total_amount"] > Decimal("0.00") and unsettled_calc["day_count"] > 0,
        })
    return results


def get_overtime_pending_verification(store, year, month):
    """Returns unsettled days with OT that have not been manager-verified."""
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)
    days_qs = (
        AttendanceDay.objects.filter(
            store=store,
            business_date__gte=start_date,
            business_date__lte=end_date,
            overtime_minutes__gt=0,
            is_settled=False,
            ot_verified=False,
        )
        .select_related("employee")
        .order_by("business_date", "employee__name")
    )
    result = []
    for day in days_qs:
        structure = _get_active_structure(day.employee, year, month)
        daily_rate = _calculate_daily_rate(structure, year, month) if structure else Decimal("0.00")
        ot_rate = _get_ot_rate(structure, daily_rate) if structure else Decimal("0.00")
        ot_min = day.overtime_minutes
        ot_hours = _quantize(Decimal(str(ot_min)) / Decimal("60"))
        ot_amount = _quantize(ot_hours * ot_rate)
        shift_snap = day.shift_snapshot or {}
        scheduled_minutes = shift_snap.get("expected_work_minutes", 480)
        result.append({
            "attendance_day_id": day.id,
            "employee_id": day.employee_id,
            "employee_code": day.employee.employee_code,
            "employee_name": day.employee.name,
            "business_date": day.business_date.isoformat(),
            "first_in": day.first_in.isoformat() if day.first_in else None,
            "last_out": day.last_out.isoformat() if day.last_out else None,
            "worked_minutes": day.worked_minutes,
            "scheduled_minutes": scheduled_minutes,
            "overtime_minutes": ot_min,
            "ot_rate_per_hour": str(ot_rate),
            "ot_amount": str(ot_amount),
            "ot_override_minutes": day.ot_override_minutes,
            "status": day.status,
        })
    return result


def bulk_verify_overtime(verification_data, actor=None):
    """Manager bulk-verifies OT days. Returns {"verified": N, "zeroed": M}."""
    verified_count = 0
    zeroed_count = 0
    now = timezone.now()
    for item in verification_data:
        day_id = item.get("attendance_day_id")
        approved_min = item.get("approved_minutes")
        try:
            day = AttendanceDay.objects.get(pk=day_id, is_settled=False)
        except AttendanceDay.DoesNotExist:
            continue
        if approved_min is None:
            day.ot_verified = True
            day.ot_override_minutes = None
        else:
            approved_min = max(0, int(approved_min))
            day.ot_override_minutes = approved_min if approved_min != day.overtime_minutes else None
            day.ot_verified = True
            if approved_min == 0:
                zeroed_count += 1
        day.updated_at = now
        day.save(update_fields=["ot_verified", "ot_override_minutes", "updated_at"])
        verified_count += 1
    return {"verified": verified_count, "zeroed": zeroed_count}


def settle_interim_payroll(store, settlements, actor=None, proceed_with_unreviewed=False):
    """
    Atomically processes interim wage settlements.
    settlements = list of {employee_id, action, payment_method, register_shift_id, note}
    Returns list of result dicts.
    """
    import zoneinfo
    tz_name = getattr(store, 'timezone', None) or 'Asia/Kolkata'
    try:
        store_tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        store_tz = zoneinfo.ZoneInfo('Asia/Kolkata')
    today = timezone.now().astimezone(store_tz).date()
    results = []
    with transaction.atomic():
        settlement_ref = _generate_settlement_ref()
        now = timezone.now()
        for item in settlements:
            emp_id = item.get("employee_id")
            action = item.get("action", "ledger_only")
            payment_method = item.get("payment_method", "cash")
            register_shift_id = item.get("register_shift_id")
            note = item.get("note", "")
            try:
                emp = Employee.objects.select_for_update().get(pk=emp_id)
            except Employee.DoesNotExist:
                results.append({"employee_id": emp_id, "status": "error", "message": "Employee not found."})
                continue
            unsettled_days = list(
                AttendanceDay.objects.filter(
                    employee=emp, store=store, is_settled=False, is_locked=False,
                ).exclude(status__in=["future"]).order_by("business_date")
            )
            if not unsettled_days:
                results.append({"employee_id": emp_id, "employee_name": emp.name, "status": "skipped",
                                 "message": "No unsettled days.", "amount": "0.00"})
                continue

            if not proceed_with_unreviewed:
                unverified_ot = [
                    d for d in unsettled_days
                    if d.overtime_minutes and d.overtime_minutes > 0 and not d.ot_verified
                ]
                if unverified_ot:
                    ot_count = len(unverified_ot)
                    raise ValueError(
                        f"Cannot process interim settlement: {emp.name} has {ot_count} unverified overtime day{'s' if ot_count > 1 else ''}. "
                        "Verify overtime to pay the interim salary, or check 'Proceed if unreviewed days'."
                    )
                unreviewed_att = [
                    d for d in unsettled_days
                    if d.status == AttendanceDay.STATUS_NEEDS_REVIEW
                ]
                if unreviewed_att:
                    att_count = len(unreviewed_att)
                    raise ValueError(
                        f"Cannot process interim settlement: {emp.name} has {att_count} attendance day{'s' if att_count > 1 else ''} needing review. "
                        "Review attendance to pay the interim salary, or check 'Proceed if unreviewed days'."
                    )

            # Group days by (year, month) so each group uses its own salary structure
            from itertools import groupby
            total_amount = Decimal("0.00")
            total_days = 0
            daily_rate_for_note = Decimal("0.00")
            ctx_year, ctx_month = unsettled_days[-1].business_date.year, unsettled_days[-1].business_date.month
            month_groups = groupby(unsettled_days, key=lambda d: (d.business_date.year, d.business_date.month))
            for (g_year, g_month), g_days in month_groups:
                g_days_list = list(g_days)
                g_structure = _get_active_structure(emp, g_year, g_month)
                if not g_structure:
                    continue
                g_calc = _calculate_wage_for_days(emp, g_days_list, g_structure, g_year, g_month)
                total_amount += g_calc["total_amount"]
                total_days += g_calc["day_count"]
                daily_rate_for_note = g_calc["daily_rate"]  # use most recent month's rate in note
            total_amount = _quantize(total_amount)
            if total_amount <= Decimal("0.00"):
                results.append({"employee_id": emp_id, "employee_name": emp.name, "status": "skipped",
                                 "message": "Calculated wage is zero.", "amount": "0.00"})
                continue
            _, last_d = calendar.monthrange(ctx_year, ctx_month)
            credit_entry_date = min(today, date(ctx_year, ctx_month, last_d))
            # Post INTERIM_WAGE_CREDIT (positive: store owes employee)
            credit_entry = add_entry(
                employee=emp, store=store,
                entry_type=EmployeeLedgerEntry.ENTRY_INTERIM_WAGE_CREDIT,
                amount=total_amount,
                entry_date=credit_entry_date,
                payment_method="accrual",
                reference_no=settlement_ref,
                note=note or f"Interim wage settlement ({total_days} days, ref: {settlement_ref})",
                actor=actor,
            )
            payout_entry = None
            counter_payout = None
            if action == "pay_now":
                payout_entry = add_entry(
                    employee=emp, store=store,
                    entry_type=EmployeeLedgerEntry.ENTRY_PAYOUT,
                    amount=-total_amount,
                    entry_date=today,
                    payment_method=payment_method,
                    reference_no=settlement_ref,
                    note=note or f"Wage disbursement for {settlement_ref}",
                    actor=actor,
                )
                if payment_method == "cash" and register_shift_id:
                    try:
                        from inventory.serializers import generate_next_payout_number
                        shift = DailyRegisterShift.objects.select_for_update().get(pk=register_shift_id, store=store)
                        is_post_close = (shift.status == DailyRegisterShift.STATUS_CLOSED)
                        counter_payout = CounterPayout.objects.create(
                            payout_number=generate_next_payout_number(store),
                            store=store,
                            paid_by=actor,
                            paid_by_name=actor.name if actor else "Manager",
                            paid_to=emp.name,
                            amount=total_amount,
                            payment_method=CounterPayout.PAYMENT_CASH,
                            category=CounterPayout.CATEGORY_STAFF_PAYOUT,
                            reason=note or f"Staff wage – {settlement_ref} ({total_days} days @ Rs.{daily_rate_for_note}/day)",
                            receipt_number=settlement_ref,
                            employee=emp,
                            register_shift=shift,
                            is_post_close=is_post_close,
                        )
                        if is_post_close:
                            DailyRegisterShift.objects.filter(pk=shift.pk).update(
                                post_close_payouts_amount=shift.post_close_payouts_amount + total_amount
                            )
                        else:
                            DailyRegisterShift.objects.filter(pk=shift.pk).update(
                                cash_payouts_amount=shift.cash_payouts_amount + total_amount
                            )
                        EmployeeLedgerEntry.objects.filter(pk=payout_entry.pk).update(counter_payout=counter_payout)
                    except DailyRegisterShift.DoesNotExist:
                        pass
            day_ids = [d.id for d in unsettled_days]
            AttendanceDay.objects.filter(pk__in=day_ids).update(
                is_settled=True, settled_at=now, settlement_ref=settlement_ref,
            )
            results.append({
                "employee_id": emp_id,
                "employee_name": emp.name,
                "status": "settled",
                "settlement_ref": settlement_ref,
                "days_settled": len(unsettled_days),
                "amount": str(total_amount),
                "action": action,
                "payment_method": payment_method,
                "credit_entry_id": credit_entry.id,
                "payout_entry_id": payout_entry.id if payout_entry else None,
                "counter_payout_number": counter_payout.payout_number if counter_payout else None,
                "is_post_close": counter_payout.is_post_close if counter_payout else False,
            })
    return results
