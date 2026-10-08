"""
Daily Rules Engine and Deterministic Attendance Rebuild Service.
Takes raw punches, pairs sessions, computes work/break/late/early metrics,
evaluates data-driven penalty tiers, and derives daily attendance records.
"""

from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import Any
import zoneinfo

from django.db import transaction
from django.utils import timezone

from ..models import (
    Employee,
    Shift,
    Punch,
    AttendanceDay,
    AttendanceSession,
    Holiday,
    LeaveRequest,
    AttendanceAuditLog,
    StaffMember,
)
from inventory.models import Store
from .settings import get_setting
from .punch import get_effective_store, get_effective_shift


def rebuild_day(employee: Employee, business_date: date, force: bool = False) -> AttendanceDay:
    """
    Pure, deterministic rebuild of AttendanceDay for a given employee and business date.
    - If is_locked and not force: refuses modification.
    - Fetches all active (non-void) punches for that business_date.
    - Pairs them into chronological sessions.
    - Calculates worked_minutes, break deductions, late_minutes, early_leave_minutes.
    - Determines status by priority: Holiday / Weekly Off -> Leave -> Thresholds -> Missed Punch.
    - Respects active manual overrides until cleared.
    """
    effective_store = get_effective_store(employee, business_date)
    store_tz_str = get_setting('timezone', employee)
    try:
        tz = zoneinfo.ZoneInfo(store_tz_str)
    except Exception:
        tz = zoneinfo.ZoneInfo('Asia/Kolkata')

    # 1. Fetch or initialize AttendanceDay
    attendance_day, created = AttendanceDay.objects.get_or_create(
        employee=employee,
        business_date=business_date,
        defaults={'store': effective_store}
    )

    # 2. Refuse if locked
    if attendance_day.is_locked and not force:
        return attendance_day

    # 3. Check join / exit date bounds
    if business_date < employee.join_date or (employee.exit_date and business_date > employee.exit_date):
        attendance_day.status = AttendanceDay.STATUS_ABSENT
        attendance_day.day_fraction_paid = Decimal('0.00')
        attendance_day.worked_minutes = 0
        attendance_day.save()
        attendance_day.sessions.all().delete()
        return attendance_day

    # 4. Resolve shift for snapshot
    shift = get_effective_shift(employee, business_date)
    shift_snapshot = {}
    if shift:
        shift_snapshot = {
            'id': shift.id,
            'name': shift.name,
            'start_time': shift.start_time.strftime('%H:%M'),
            'end_time': shift.end_time.strftime('%H:%M'),
            'is_overnight': shift.is_overnight,
            'min_minutes_full_day': shift.min_minutes_full_day,
            'min_minutes_half_day': shift.min_minutes_half_day,
            'grace_late_minutes': shift.grace_late_minutes,
            'grace_early_leave_minutes': shift.grace_early_leave_minutes,
            'break_allowance_minutes': shift.break_allowance_minutes,
        }

    # 5. Fetch punches belonging to this business date
    # Determine the UTC window corresponding to this business date's shift
    early_buf = int(get_setting('early_arrival_buffer_minutes', employee))
    late_buf = int(get_setting('late_departure_buffer_minutes', employee))
    max_session_hours = float(get_setting('max_session_hours', employee))

    if shift:
        start_local = datetime.combine(business_date, shift.start_time, tzinfo=tz) - timedelta(minutes=early_buf)
        if shift.is_overnight:
            end_local = datetime.combine(business_date + timedelta(days=1), shift.end_time, tzinfo=tz) + timedelta(minutes=late_buf)
        else:
            end_local = datetime.combine(business_date, shift.end_time, tzinfo=tz) + timedelta(minutes=late_buf)
    else:
        start_local = datetime.combine(business_date, time.min, tzinfo=tz)
        end_local = datetime.combine(business_date, time.max, tzinfo=tz)

    start_utc = start_local.astimezone(zoneinfo.ZoneInfo('UTC'))
    # Include any punches from the calendar business date
    day_start_utc = datetime.combine(business_date, time.min, tzinfo=tz).astimezone(zoneinfo.ZoneInfo('UTC'))
    query_start_utc = min(start_utc, day_start_utc)

    # Extend end_utc to accommodate late clock-outs for sessions started within the shift window
    cutoff_utc = start_utc + timedelta(hours=max_session_hours)
    end_utc = max(end_local.astimezone(zoneinfo.ZoneInfo('UTC')), cutoff_utc)

    punches = list(
        Punch.objects.filter(
            employee=employee,
            is_void=False,
            punched_at__gte=query_start_utc,
            punched_at__lte=end_utc
        ).order_by('punched_at')
    )


    # 6. Pair punches into sessions
    auto_close_grace = int(get_setting('auto_close_grace_minutes', employee))
    missed_punch_policy = get_setting('missed_punch_policy', employee)
    now_utc = timezone.now()

    sessions_data = []
    flags = []
    i = 0
    while i < len(punches):
        in_punch = punches[i]
        out_punch = punches[i + 1] if (i + 1 < len(punches)) else None

        if out_punch:
            duration = int((out_punch.punched_at - in_punch.punched_at).total_seconds() / 60)
            sessions_data.append({
                'in_at': in_punch.punched_at,
                'out_at': out_punch.punched_at,
                'duration_minutes': max(0, duration)
            })
            i += 2
        else:
            # Open session
            session_age_hours = (now_utc - in_punch.punched_at).total_seconds() / 3600
            is_past_shift = False
            if shift:
                shift_end_dt = datetime.combine(business_date, shift.end_time, tzinfo=tz)
                if shift.is_overnight:
                    shift_end_dt += timedelta(days=1)
                is_past_shift = now_utc > (shift_end_dt.astimezone(zoneinfo.ZoneInfo('UTC')) + timedelta(minutes=auto_close_grace))

            if is_past_shift or session_age_hours > max_session_hours:
                flags.append('missed_out')
                if missed_punch_policy == 'auto_close_at_shift_end' and shift:
                    # Auto close at scheduled shift end
                    shift_end_utc = shift_end_dt.astimezone(zoneinfo.ZoneInfo('UTC'))
                    duration = max(0, int((shift_end_utc - in_punch.punched_at).total_seconds() / 60))
                    sessions_data.append({
                        'in_at': in_punch.punched_at,
                        'out_at': shift_end_utc,
                        'duration_minutes': duration
                    })
                else:
                    sessions_data.append({
                        'in_at': in_punch.punched_at,
                        'out_at': None,
                        'duration_minutes': 0
                    })
            else:
                # Active open session in progress
                current_duration = max(0, int((now_utc - in_punch.punched_at).total_seconds() / 60))
                sessions_data.append({
                    'in_at': in_punch.punched_at,
                    'out_at': None,
                    'duration_minutes': current_duration
                })
            i += 1

    # 7. Calculate Work & Break totals
    worked_minutes = sum(s['duration_minutes'] for s in sessions_data)
    first_in = sessions_data[0]['in_at'] if sessions_data else None
    last_out = None
    if sessions_data and sessions_data[-1]['out_at']:
        last_out = sessions_data[-1]['out_at']

    # Breaks = gaps between consecutive sessions
    total_break_minutes = 0
    for idx in range(len(sessions_data) - 1):
        prev_out = sessions_data[idx]['out_at']
        next_in = sessions_data[idx + 1]['in_at']
        if prev_out and next_in and next_in > prev_out:
            total_break_minutes += int((next_in - prev_out).total_seconds() / 60)

    break_allowance = int(shift.break_allowance_minutes if shift else get_setting('break_allowance_minutes', employee))
    if bool(get_setting('deduct_excess_break', employee)) and total_break_minutes > break_allowance:
        excess_break = total_break_minutes - break_allowance
        worked_minutes = max(0, worked_minutes - excess_break)

    # 7.5. Query approved leave for business date
    leave_request = LeaveRequest.objects.filter(
        employee=employee,
        from_date__lte=business_date,
        to_date__gte=business_date,
        status=LeaveRequest.STATUS_APPROVED
    ).first()

    # 8. Late arrival & Early departure calculation
    late_minutes = 0
    early_leave_minutes = 0
    late_penalty = {'kind': 'none', 'value': 0}

    if shift and first_in:
        first_in_local = first_in.astimezone(tz)
        scheduled_start = datetime.combine(business_date, shift.start_time, tzinfo=tz)
        scheduled_end = datetime.combine(
            business_date + (timedelta(days=1) if shift.is_overnight else timedelta(0)),
            shift.end_time,
            tzinfo=tz
        )

        # Handle half-day leave scheduled start / end adjustments
        if leave_request and leave_request.half_day:
            shift_dur_sec = (scheduled_end - scheduled_start).total_seconds()
            midpoint = scheduled_start + timedelta(seconds=shift_dur_sec / 2)
            if leave_request.half_day_period == LeaveRequest.HALF_DAY_FIRST:
                # Employee on leave in morning; expected to work second half
                scheduled_start = midpoint
            elif leave_request.half_day_period == LeaveRequest.HALF_DAY_SECOND:
                # Employee working in morning; expected to leave at midpoint
                scheduled_end = midpoint

        grace_late = shift.grace_late_minutes or int(get_setting('grace_late_minutes', employee))

        if first_in_local > (scheduled_start + timedelta(minutes=grace_late)):
            late_minutes = max(0, int((first_in_local - scheduled_start).total_seconds() / 60))

        # Evaluate Data-driven Late Tiers
        cutoff_min = int(get_setting('arrival_cutoff_minutes', employee))
        if get_setting('arrival_after_cutoff_half_day', employee) and late_minutes >= cutoff_min:
            late_penalty = {'kind': 'fraction_of_day', 'value': 0.5, 'reason': 'Arrival after cutoff'}
        elif late_minutes > 0:
            tiers = get_setting('late_tiers', employee) or []
            for tier in tiers:
                if tier.get('from_min', 0) <= late_minutes <= tier.get('to_min', 9999):
                    late_penalty = {
                        'kind': tier.get('penalty_kind', 'fraction_of_day'),
                        'value': tier.get('penalty_value', 0),
                        'reason': f"Late tier {tier.get('from_min')}-{tier.get('to_min')}m"
                    }
                    break

        # Early departure
        if last_out:
            last_out_local = last_out.astimezone(tz)
            grace_early = shift.grace_early_leave_minutes or int(get_setting('grace_early_leave_minutes', employee))
            early_threshold = scheduled_end - timedelta(minutes=grace_early)
            if last_out_local < early_threshold:
                early_leave_minutes = max(0, int((scheduled_end - last_out_local).total_seconds() / 60))

    # 9. Overtime calculation
    overtime_minutes = 0
    if shift and get_setting('overtime_enabled', employee) and worked_minutes > 0:
        scheduled_dur = int((datetime.combine(date.min, shift.end_time) - datetime.combine(date.min, shift.start_time)).total_seconds() / 60)
        if shift.is_overnight:
            scheduled_dur += 1440
        ot_thresh = int(get_setting('overtime_threshold_minutes', employee, default=30))
        if worked_minutes > (scheduled_dur + ot_thresh):
            count_from = get_setting('overtime_count_from', employee, default='shift_end')
            if count_from == 'after_threshold':
                overtime_minutes = (worked_minutes - scheduled_dur) - ot_thresh
            else:
                overtime_minutes = worked_minutes - scheduled_dur

            # Minimum qualifying minutes
            min_ot = int(get_setting('min_overtime_qualifying_minutes', employee, default=0))
            if min_ot > 0 and overtime_minutes < min_ot:
                overtime_minutes = 0

            # Maximum daily overtime cap (0 = unlimited)
            max_ot = int(get_setting('max_daily_overtime_minutes', employee, default=0))
            if max_ot > 0:
                overtime_minutes = min(overtime_minutes, max_ot)

    # 10. Status & Day Fraction Assignment
    min_full_day = int(shift.min_minutes_full_day if shift else get_setting('min_minutes_full_day', employee))
    min_half_day = int(shift.min_minutes_half_day if shift else get_setting('min_minutes_half_day', employee))

    # Priority A: Check Holiday
    holiday = Holiday.objects.filter(
        date=business_date
    ).filter(
        models_q_store(effective_store)
    ).first()

    # Priority B: Check Weekly Off
    # Shift assignment or store default
    shift_assignment = employee.shift_assignments.filter(
        from_date__lte=business_date
    ).filter(
        models_q_to_date(business_date)
    ).first()
    weekly_offs = shift_assignment.weekly_off_days if (shift_assignment and shift_assignment.weekly_off_days is not None) else get_setting('default_weekly_off_days', employee, default=[6])
    is_weekly_off = business_date.weekday() in (weekly_offs or [])

    status = AttendanceDay.STATUS_ABSENT
    day_fraction_paid = Decimal('0.00')

    has_worked = worked_minutes > 0 or len(punches) > 0

    if holiday and not has_worked:
        status = AttendanceDay.STATUS_HOLIDAY
        day_fraction_paid = Decimal('1.00') if holiday.is_paid else Decimal('0.00')

    elif is_weekly_off and not has_worked:
        status = AttendanceDay.STATUS_WEEKLY_OFF
        day_fraction_paid = Decimal('0.00')

    elif leave_request and not has_worked:
        status = AttendanceDay.STATUS_PAID_LEAVE if leave_request.leave_type.is_paid else AttendanceDay.STATUS_UNPAID_LEAVE
        base_fraction = Decimal('0.50') if leave_request.half_day else Decimal('1.00')
        day_fraction_paid = base_fraction if leave_request.leave_type.is_paid else Decimal('0.00')

    elif not has_worked:
        status = AttendanceDay.STATUS_ABSENT
        day_fraction_paid = Decimal('0.00')

    else:
        # Employee tapped/worked today!
        if holiday:
            flags.append('tap_on_holiday')
            mult = Decimal(str(get_setting('work_on_holiday_multiplier', employee) or 2.0))
            status = AttendanceDay.STATUS_PRESENT
            day_fraction_paid = mult
        elif is_weekly_off:
            flags.append('tap_on_off_day')
            mult = Decimal(str(get_setting('work_on_weekly_off_multiplier', employee) or 1.5))
            status = AttendanceDay.STATUS_PRESENT
            day_fraction_paid = mult
        elif leave_request and leave_request.half_day:
            # Combined approved half-day leave + working half day
            flags.append('tap_on_leave')
            leave_paid_credit = Decimal('0.50') if leave_request.leave_type.is_paid else Decimal('0.00')
            req_half_dur = min_half_day // 2
            
            # Worked portion credit (up to 0.50 day)
            worked_credit = Decimal('0.50') if worked_minutes >= req_half_dur else Decimal('0.00')
            
            # Late penalty applied to the worked portion
            if late_penalty.get('kind') == 'fraction_of_day' and worked_credit > Decimal('0.00'):
                raw_pen = Decimal(str(late_penalty.get('value', 0)))
                # If penalty is 0.5 (half day penalty on a full day), on a half day work it reduces worked credit proportionally
                pen_reduction = (raw_pen * Decimal('0.50')) if raw_pen <= Decimal('0.50') else worked_credit
                worked_credit = max(Decimal('0.00'), worked_credit - pen_reduction)

            day_fraction_paid = leave_paid_credit + worked_credit
            status = AttendanceDay.STATUS_PRESENT if worked_credit > Decimal('0.00') else (
                AttendanceDay.STATUS_PAID_LEAVE if leave_request.leave_type.is_paid else AttendanceDay.STATUS_UNPAID_LEAVE
            )
        elif leave_request:
            flags.append('tap_on_leave')
            status = AttendanceDay.STATUS_PRESENT
            day_fraction_paid = Decimal('1.00')
        elif 'missed_out' in flags and missed_punch_policy == 'require_manual_fix':
            status = AttendanceDay.STATUS_NEEDS_REVIEW
            day_fraction_paid = Decimal('0.00')
        elif 'missed_out' in flags and missed_punch_policy == 'count_as_half_day':
            status = AttendanceDay.STATUS_HALF_DAY
            day_fraction_paid = Decimal('0.50')
        elif worked_minutes >= min_full_day:
            status = AttendanceDay.STATUS_PRESENT
            day_fraction_paid = Decimal('1.00')
        elif worked_minutes >= min_half_day:
            status = AttendanceDay.STATUS_HALF_DAY
            day_fraction_paid = Decimal('0.50')
        else:
            status = AttendanceDay.STATUS_ABSENT
            day_fraction_paid = Decimal('0.00')

        # Apply late penalty fraction if applicable for standard working day
        if not (leave_request and leave_request.half_day):
            if late_penalty.get('kind') == 'fraction_of_day' and day_fraction_paid > Decimal('0.00'):
                pen_val = Decimal(str(late_penalty.get('value', 0)))
                day_fraction_paid = max(Decimal('0.00'), day_fraction_paid - pen_val)

    # 11. Preserve Manual Override if set
    if attendance_day.override_status:
        status = attendance_day.override_status
        if 'manual_override' not in flags:
            flags.append('manual_override')
        if attendance_day.first_in is not None:
            first_in = attendance_day.first_in
        if attendance_day.last_out is not None:
            last_out = attendance_day.last_out
        if attendance_day.worked_minutes is not None:
            worked_minutes = attendance_day.worked_minutes
        if attendance_day.day_fraction_paid is not None:
            day_fraction_paid = attendance_day.day_fraction_paid


    # 12. Persist AttendanceDay
    attendance_day.store = effective_store
    attendance_day.shift_snapshot = shift_snapshot
    attendance_day.first_in = first_in
    attendance_day.last_out = last_out
    attendance_day.worked_minutes = worked_minutes
    attendance_day.break_minutes = total_break_minutes
    attendance_day.late_minutes = late_minutes
    attendance_day.early_leave_minutes = early_leave_minutes
    attendance_day.overtime_minutes = overtime_minutes
    attendance_day.status = status
    attendance_day.flags = list(set(flags))
    attendance_day.day_fraction_paid = day_fraction_paid
    attendance_day.late_penalty = late_penalty
    attendance_day.save()

    # 13. Rebuild AttendanceSession records
    attendance_day.sessions.all().delete()
    for s in sessions_data:
        AttendanceSession.objects.create(
            attendance_day=attendance_day,
            in_at=s['in_at'],
            out_at=s['out_at'],
            duration_minutes=s['duration_minutes']
        )

    return attendance_day


def models_q_store(store: Store):
    from django.db.models import Q
    return Q(store__isnull=True) | Q(store=store)


def models_q_to_date(on_date: date):
    from django.db.models import Q
    return Q(to_date__isnull=True) | Q(to_date__gte=on_date)


def override_day_status(
    attendance_day: AttendanceDay,
    new_status: str,
    actor: StaffMember,
    reason: str
) -> AttendanceDay:
    """
    Applies a manual status override with audit logging.
    """
    if attendance_day.is_locked:
        raise PermissionError("Cannot modify a locked attendance day. The payroll for this month has been finalized.")

    if not reason or not reason.strip():
        raise ValueError("A reason is mandatory when overriding daily attendance status.")

    before_status = attendance_day.status
    attendance_day.override_status = new_status
    attendance_day.override_by = actor
    attendance_day.override_reason = reason.strip()
    attendance_day.status = new_status
    if 'manual_override' not in attendance_day.flags:
        attendance_day.flags.append('manual_override')

    # Update day_fraction_paid based on override status
    if new_status == AttendanceDay.STATUS_PRESENT:
        attendance_day.day_fraction_paid = Decimal('1.00')
    elif new_status == AttendanceDay.STATUS_HALF_DAY:
        attendance_day.day_fraction_paid = Decimal('0.50')
    elif new_status in (AttendanceDay.STATUS_ABSENT, AttendanceDay.STATUS_NEEDS_REVIEW):
        attendance_day.day_fraction_paid = Decimal('0.00')

    attendance_day.save()

    # Audit Log
    AttendanceAuditLog.objects.create(
        action='status_override',
        actor=actor,
        target_type='AttendanceDay',
        target_id=str(attendance_day.id),
        before_state={'status': before_status},
        after_state={'status': new_status, 'override_status': new_status},
        reason=reason.strip()
    )

    return attendance_day


def clear_day_override(
    attendance_day: AttendanceDay,
    actor: StaffMember,
    reason: str
) -> AttendanceDay:
    """
    Clears manual status override, restores superseded raw punches, voids manual punches,
    and triggers automatic day rebuild.
    """
    if attendance_day.is_locked:
        raise PermissionError("Cannot modify a locked attendance day. The payroll for this month has been finalized.")

    import zoneinfo
    from django.utils import timezone as dj_timezone

    tz_str = get_setting('timezone', attendance_day.employee) or 'Asia/Kolkata'
    try:
        store_tz = zoneinfo.ZoneInfo(tz_str)
    except Exception:
        store_tz = dj_timezone.get_current_timezone()

    b_date = attendance_day.business_date
    day_start_utc = datetime.combine(b_date, time.min, tzinfo=store_tz).astimezone(zoneinfo.ZoneInfo('UTC'))
    day_end_utc = datetime.combine(b_date + timedelta(days=1), time.max, tzinfo=store_tz).astimezone(zoneinfo.ZoneInfo('UTC'))

    # 1. Unvoid raw punches previously superseded by manual attendance update
    Punch.objects.filter(
        employee=attendance_day.employee,
        void_reason="Superseded by manual attendance update",
        punched_at__gte=day_start_utc,
        punched_at__lte=day_end_utc
    ).exclude(source=Punch.SOURCE_MANUAL).update(is_void=False, void_reason="")

    # 2. Void any manual punches recorded for this day
    Punch.objects.filter(
        employee=attendance_day.employee,
        source=Punch.SOURCE_MANUAL,
        is_void=False,
        punched_at__gte=day_start_utc,
        punched_at__lte=day_end_utc
    ).update(is_void=True, void_reason=reason or "Cleared manual override", voided_by=actor)

    before_status = attendance_day.status
    attendance_day.override_status = None
    attendance_day.override_by = None
    attendance_day.override_reason = ""
    if 'manual_override' in attendance_day.flags:
        attendance_day.flags.remove('manual_override')
    attendance_day.save()

    # Audit Log
    AttendanceAuditLog.objects.create(
        action='override_clear',
        actor=actor,
        target_type='AttendanceDay',
        target_id=str(attendance_day.id),
        before_state={'override_status': before_status},
        after_state={'override_status': None},
        reason=reason or "Cleared manual override"
    )

    return rebuild_day(attendance_day.employee, attendance_day.business_date, force=True)



def void_punch(
    punch: Punch,
    actor: StaffMember,
    reason: str
) -> AttendanceDay:
    """
    Marks a punch as void (immutable fact preserved) and triggers day rebuild.
    """
    if not reason or not reason.strip():
        raise ValueError("A reason is mandatory when voiding an attendance punch.")

    # Check if target attendance day is locked
    store_tz = get_setting('timezone', punch.employee)
    shift = get_effective_shift(punch.employee, punch.punched_at.date())
    early_buf = int(get_setting('early_arrival_buffer_minutes', punch.employee))
    late_buf = int(get_setting('late_departure_buffer_minutes', punch.employee))

    from .punch import determine_business_date_and_window
    business_date, *_ = determine_business_date_and_window(
        punch.punched_at, shift, store_tz, early_buf, late_buf
    )

    existing_day = AttendanceDay.objects.filter(employee=punch.employee, business_date=business_date).first()
    if existing_day and existing_day.is_locked:
        raise PermissionError("Cannot void a punch for a locked attendance day. The payroll for this month has been finalized.")

    punch.is_void = True
    punch.void_reason = reason.strip()
    punch.voided_by = actor
    punch.save(update_fields=['is_void', 'void_reason', 'voided_by'])

    # Audit Log
    AttendanceAuditLog.objects.create(
        action='punch_void',
        actor=actor,
        target_type='Punch',
        target_id=str(punch.id),
        before_state={'is_void': False},
        after_state={'is_void': True, 'void_reason': reason.strip()},
        reason=reason.strip()
    )

    return rebuild_day(punch.employee, business_date, force=True)


def add_manual_punch(
    employee: Employee,
    store: Store,
    punched_at: datetime,
    actor: StaffMember,
    note: str
) -> tuple[Punch, AttendanceDay]:
    """
    Creates an authorized manual punch and rebuilds the affected day.
    """
    if not note or not note.strip():
        raise ValueError("A note or explanation is required when adding a manual punch.")

    # Determine business date & verify lock
    store_tz = get_setting('timezone', employee)
    shift = get_effective_shift(employee, punched_at.date())
    early_buf = int(get_setting('early_arrival_buffer_minutes', employee))
    late_buf = int(get_setting('late_departure_buffer_minutes', employee))

    from .punch import determine_business_date_and_window
    business_date, *_ = determine_business_date_and_window(
        punched_at, shift, store_tz, early_buf, late_buf
    )

    existing_day = AttendanceDay.objects.filter(employee=employee, business_date=business_date).first()
    if existing_day and existing_day.is_locked:
        raise PermissionError("Cannot add a manual punch for a locked attendance day. The payroll for this month has been finalized.")

    card_snapshot = employee.active_card.card_uid if employee.active_card else 'MANUAL_PUNCH'

    punch = Punch.objects.create(
        employee=employee,
        store=store,
        card_uid_snapshot=card_snapshot,
        punched_at=punched_at,
        source=Punch.SOURCE_MANUAL,
        created_by=actor,
        note=note.strip()
    )

    # Audit Log
    AttendanceAuditLog.objects.create(
        action='punch_create',
        actor=actor,
        target_type='Punch',
        target_id=str(punch.id),
        before_state=None,
        after_state={'punched_at': punched_at.isoformat(), 'source': 'manual'},
        reason=note.strip()
    )

    attendance_day = rebuild_day(employee, business_date, force=True)
    return punch, attendance_day


def record_manual_day_attendance(
    employee: Employee,
    business_date: date,
    actor: StaffMember,
    reason: str,
    status: str = None,
    in_time_str: str = None,
    out_time_str: str = None,
    worked_minutes: int = None,
) -> AttendanceDay:
    """
    Manually records or updates attendance for an employee on a business date
    with exact in/out times or worked minutes, audit trail, clean session preservation,
    and automatic late/overtime recalculation.
    """
    if not reason or not reason.strip():
        raise ValueError("A reason is mandatory when manually editing attendance.")

    existing_day = AttendanceDay.objects.filter(employee=employee, business_date=business_date).first()
    if existing_day and existing_day.is_locked:
        raise PermissionError("Cannot edit attendance for a locked month. Payroll has already been finalized.")

    import zoneinfo
    from django.utils import timezone as dj_timezone

    tz_str = get_setting('timezone', employee) or 'Asia/Kolkata'
    try:
        store_tz = zoneinfo.ZoneInfo(tz_str)
    except Exception:
        store_tz = dj_timezone.get_current_timezone()

    card_snapshot = employee.active_card.card_uid if employee.active_card else 'MANUAL_ENTRY'
    target_store = get_effective_store(employee, business_date)

    # Full business day boundaries in UTC for managing conflicting punches
    day_start_utc = datetime.combine(business_date, time.min, tzinfo=store_tz).astimezone(zoneinfo.ZoneInfo('UTC'))
    day_end_utc = datetime.combine(business_date + timedelta(days=1), time.max, tzinfo=store_tz).astimezone(zoneinfo.ZoneInfo('UTC'))

    target_status = status or (existing_day.status if existing_day else AttendanceDay.STATUS_PRESENT)
    is_working = target_status in (AttendanceDay.STATUS_PRESENT, AttendanceDay.STATUS_HALF_DAY)


    shift = get_effective_shift(employee, business_date)
    shift_snapshot = {}
    if shift:
        shift_snapshot = {
            'name': shift.name,
            'start_time': shift.start_time.strftime('%H:%M') if shift.start_time else None,
            'end_time': shift.end_time.strftime('%H:%M') if shift.end_time else None,
            'is_overnight': shift.is_overnight,
        }

    if existing_day:
        day = existing_day
    else:
        day = AttendanceDay(
            employee=employee,
            business_date=business_date,
            store=target_store,
            shift_snapshot=shift_snapshot,
            flags=[]
        )


    before_status = day.status
    before_worked = day.worked_minutes

    if in_time_str and out_time_str and is_working:
        in_t = datetime.strptime(in_time_str.strip()[:5], '%H:%M').time()
        out_t = datetime.strptime(out_time_str.strip()[:5], '%H:%M').time()

        in_dt = datetime.combine(business_date, in_t).replace(tzinfo=store_tz)
        out_dt = datetime.combine(business_date, out_t).replace(tzinfo=store_tz)
        if out_dt < in_dt:
            out_dt += timedelta(days=1)

        # Void prior punches for this business date window so they don't produce fragmented sessions
        Punch.objects.filter(
            employee=employee,
            is_void=False,
            punched_at__gte=day_start_utc,
            punched_at__lte=day_end_utc
        ).update(is_void=True, void_reason="Superseded by manual attendance update", voided_by=actor)

        # Create manual In and Out punches for immutable audit trail
        Punch.objects.create(
            employee=employee,
            store=target_store,
            card_uid_snapshot=card_snapshot,
            punched_at=in_dt,
            source=Punch.SOURCE_MANUAL,
            created_by=actor,
            note=f"{reason.strip()} (Manual In)"
        )
        Punch.objects.create(
            employee=employee,
            store=target_store,
            card_uid_snapshot=card_snapshot,
            punched_at=out_dt,
            source=Punch.SOURCE_MANUAL,
            created_by=actor,
            note=f"{reason.strip()} (Manual Out)"
        )

        calc_dur = max(0, int((out_dt - in_dt).total_seconds() / 60))
        day.first_in = in_dt
        day.last_out = out_dt
        day.worked_minutes = worked_minutes if (worked_minutes is not None and worked_minutes > 0) else calc_dur
        day.break_minutes = 0

        # Late & early leave calculation against shift
        late_minutes = 0
        early_leave_minutes = 0
        overtime_minutes = 0
        if shift:
            sched_start = datetime.combine(business_date, shift.start_time, tzinfo=store_tz)
            if shift.is_overnight:
                sched_end = datetime.combine(business_date + timedelta(days=1), shift.end_time, tzinfo=store_tz)
            else:
                sched_end = datetime.combine(business_date, shift.end_time, tzinfo=store_tz)

            grace_late = shift.grace_late_minutes or int(get_setting('grace_late_minutes', employee))
            late_threshold = sched_start + timedelta(minutes=grace_late)
            if in_dt > late_threshold:
                late_minutes = max(0, int((in_dt - sched_start).total_seconds() / 60))

            grace_early = shift.grace_early_leave_minutes or int(get_setting('grace_early_leave_minutes', employee))
            early_threshold = sched_end - timedelta(minutes=grace_early)
            if out_dt < early_threshold:
                early_leave_minutes = max(0, int((sched_end - out_dt).total_seconds() / 60))

            if get_setting('overtime_enabled', employee) and day.worked_minutes > 0:
                scheduled_dur = int((sched_end - sched_start).total_seconds() / 60)
                ot_thresh = int(get_setting('overtime_threshold_minutes', employee, default=30))
                if day.worked_minutes > (scheduled_dur + ot_thresh):
                    count_from = get_setting('overtime_count_from', employee, default='shift_end')
                    if count_from == 'after_threshold':
                        ot_m = (day.worked_minutes - scheduled_dur) - ot_thresh
                    else:
                        ot_m = day.worked_minutes - scheduled_dur
                    min_ot = int(get_setting('min_overtime_qualifying_minutes', employee, default=0))
                    if min_ot > 0 and ot_m < min_ot:
                        ot_m = 0
                    max_ot = int(get_setting('max_daily_overtime_minutes', employee, default=0))
                    if max_ot > 0:
                        ot_m = min(ot_m, max_ot)
                    overtime_minutes = max(0, ot_m)

        day.late_minutes = late_minutes
        day.early_leave_minutes = early_leave_minutes
        day.overtime_minutes = overtime_minutes
        day.store = target_store
        day.shift_snapshot = shift_snapshot

    else:
        # Non-working status (absent, weekly_off, holiday, leave, etc.)
        Punch.objects.filter(
            employee=employee,
            source=Punch.SOURCE_MANUAL,
            is_void=False,
            punched_at__gte=day_start_utc,
            punched_at__lte=day_end_utc
        ).update(is_void=True, void_reason=f"Voided: attendance updated to {target_status}", voided_by=actor)

        day.first_in = None
        day.last_out = None
        day.worked_minutes = worked_minutes if (worked_minutes is not None and is_working) else 0
        day.break_minutes = 0
        day.late_minutes = 0
        day.early_leave_minutes = 0
        day.overtime_minutes = 0
        day.store = target_store
        day.shift_snapshot = shift_snapshot

    day.status = target_status
    day.override_status = target_status
    day.override_by = actor
    day.override_reason = reason.strip()
    if not day.flags:
        day.flags = []
    if 'manual_override' not in day.flags:
        day.flags.append('manual_override')

    if target_status == AttendanceDay.STATUS_PRESENT:
        day.day_fraction_paid = Decimal('1.00')
    elif target_status == AttendanceDay.STATUS_HALF_DAY:
        day.day_fraction_paid = Decimal('0.50')

    elif target_status == AttendanceDay.STATUS_PAID_LEAVE:
        day.day_fraction_paid = Decimal('1.00')
    elif target_status in (AttendanceDay.STATUS_ABSENT, AttendanceDay.STATUS_UNPAID_LEAVE, AttendanceDay.STATUS_NEEDS_REVIEW):
        day.day_fraction_paid = Decimal('0.00')
    elif target_status in (AttendanceDay.STATUS_WEEKLY_OFF, AttendanceDay.STATUS_HOLIDAY):
        day.day_fraction_paid = Decimal('0.00')

    day.save()

    # Recreate clean session
    day.sessions.all().delete()
    if is_working and day.first_in and day.last_out:
        AttendanceSession.objects.create(
            attendance_day=day,
            in_at=day.first_in,
            out_at=day.last_out,
            duration_minutes=day.worked_minutes
        )

    # Audit Log
    AttendanceAuditLog.objects.create(
        action='manual_attendance_edit',
        actor=actor,
        target_type='AttendanceDay',
        target_id=str(day.id),
        before_state={'status': before_status, 'worked_minutes': before_worked},
        after_state={
            'status': day.status,
            'worked_minutes': day.worked_minutes,
            'first_in': day.first_in.isoformat() if day.first_in else None,
            'last_out': day.last_out.isoformat() if day.last_out else None,
        },
        reason=reason.strip()
    )

    return day



