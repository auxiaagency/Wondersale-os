"""
Raw Tap Engine & Ingestion Service.
Handles RFID tap processing, normalization, concurrency serialization,
debounce, window checking, direction derivation, and day rebuild trigger.
"""

from datetime import datetime, date, timedelta
from typing import Any
import zoneinfo

from django.db import transaction
from django.utils import timezone

from ..models import (
    Employee,
    RFIDCard,
    KioskDevice,
    Shift,
    EmployeeShiftAssignment,
    EmployeeStoreAssignment,
    Punch,
    UnknownTap,
    AttendanceSession,
    StaffMember,
)
from inventory.models import Store
from .settings import get_setting


def normalize_card_uid(raw_uid: str) -> str:
    """
    Normalizes RFID card UID by stripping leading/trailing whitespace,
    removing colons/spaces/dashes, and converting to uppercase.
    """
    if not raw_uid:
        return ""
    clean = str(raw_uid).strip()
    # If prefixed with UID:, remove prefix
    for prefix in ('card uid:', 'card_uid:', 'uid:', 'card:', 'rfid:'):
        if clean.lower().startswith(prefix):
            clean = clean[len(prefix):].strip()
    # Remove separators (spaces, colons, dashes)
    clean = clean.replace(' ', '').replace(':', '').replace('-', '').upper()
    return clean


def get_effective_store(employee: Employee, on_date: date) -> Store:
    """
    Returns the store an employee belongs to on a specific business date,
    checking effective-dated EmployeeStoreAssignment history first.
    """
    assignment = EmployeeStoreAssignment.objects.filter(
        employee=employee,
        from_date__lte=on_date
    ).filter(
        models_q_to_date(on_date)
    ).order_by('-from_date').first()

    if assignment:
        return assignment.store
    return employee.store


def models_q_to_date(on_date: date):
    from django.db.models import Q
    return Q(to_date__isnull=True) | Q(to_date__gte=on_date)


def get_effective_shift(employee: Employee, on_date: date) -> Shift | None:
    """
    Finds the active shift for the employee on a specific business date.
    Hierarchy: Effective-dated EmployeeShiftAssignment -> Store default shift -> Any store shift.
    """
    assignment = EmployeeShiftAssignment.objects.filter(
        employee=employee,
        from_date__lte=on_date
    ).filter(
        models_q_to_date(on_date)
    ).order_by('-from_date').first()

    if assignment and assignment.shift:
        return assignment.shift

    store = get_effective_store(employee, on_date)
    default_shift = Shift.objects.filter(store=store, is_default_for_store=True).first()
    if default_shift:
        return default_shift

    return Shift.objects.filter(store=store).first()


def determine_business_date_and_window(
    punched_at_utc: datetime,
    shift: Shift | None,
    store_tz_str: str,
    early_buffer_min: int,
    late_buffer_min: int
) -> tuple[date, bool, str | None, datetime | None, datetime | None]:
    """
    Converts UTC punch to store local time and maps it to a business date and shift window.
    Returns (business_date, is_outside_window, outside_reason, window_start_dt, window_end_dt).
    outside_reason can be: 'shift_not_started' | 'shift_already_ended' | 'no_shift_scheduled' | None
    """
    try:
        tz = zoneinfo.ZoneInfo(store_tz_str)
    except Exception:
        tz = zoneinfo.ZoneInfo('Asia/Kolkata')

    local_dt = punched_at_utc.astimezone(tz)
    local_date = local_dt.date()

    if not shift:
        return local_date, True, 'no_shift_scheduled', None, None

    # Check overnight shift
    if shift.is_overnight:
        # e.g. Shift 22:00 to 06:00
        # If punch is between 00:00 and (end_time + late_buffer), it belongs to previous calendar date!
        end_dt_today = datetime.combine(local_date, shift.end_time, tzinfo=tz)
        late_boundary = end_dt_today + timedelta(minutes=late_buffer_min)
        if local_dt <= late_boundary:
            start_dt_prev = datetime.combine(local_date - timedelta(days=1), shift.start_time, tzinfo=tz)
            early_boundary_prev = start_dt_prev - timedelta(minutes=early_buffer_min)
            if local_dt < early_boundary_prev:
                return local_date - timedelta(days=1), True, 'shift_not_started', start_dt_prev, end_dt_today
            return local_date - timedelta(days=1), False, None, start_dt_prev, end_dt_today

        # Check for current date's overnight shift (starts 22:00 tonight)
        start_dt_today = datetime.combine(local_date, shift.start_time, tzinfo=tz)
        early_boundary_today = start_dt_today - timedelta(minutes=early_buffer_min)
        end_dt_tomorrow = datetime.combine(local_date + timedelta(days=1), shift.end_time, tzinfo=tz)
        late_boundary_tomorrow = end_dt_tomorrow + timedelta(minutes=late_buffer_min)

        if local_dt < early_boundary_today:
            # Between today's morning (after late_boundary) and tonight's early_boundary_today
            if local_dt.hour >= 14:
                return local_date, True, 'shift_not_started', start_dt_today, end_dt_tomorrow
            else:
                start_prev = datetime.combine(local_date - timedelta(days=1), shift.start_time, tzinfo=tz)
                return local_date - timedelta(days=1), True, 'shift_already_ended', start_prev, end_dt_today

        if local_dt > late_boundary_tomorrow:
            return local_date, True, 'shift_already_ended', start_dt_today, end_dt_tomorrow

        return local_date, False, None, start_dt_today, end_dt_tomorrow

    # Standard daytime shift
    start_dt = datetime.combine(local_date, shift.start_time, tzinfo=tz)
    end_dt = datetime.combine(local_date, shift.end_time, tzinfo=tz)
    early_boundary = start_dt - timedelta(minutes=early_buffer_min)
    late_boundary = end_dt + timedelta(minutes=late_buffer_min)

    if local_dt < early_boundary:
        return local_date, True, 'shift_not_started', start_dt, end_dt
    elif local_dt > late_boundary:
        return local_date, True, 'shift_already_ended', start_dt, end_dt

    return local_date, False, None, start_dt, end_dt


def derive_direction(employee: Employee, punched_at: datetime, max_session_hours: int) -> str:
    """
    Direction is DERIVED from state, not blindly toggled:
    If employee has an OPEN session created within the last max_session_hours,
    this tap must be an OUT; otherwise a fresh IN.
    """
    cutoff = punched_at - timedelta(hours=max_session_hours)
    open_session = AttendanceSession.objects.filter(
        attendance_day__employee=employee,
        out_at__isnull=True,
        in_at__gte=cutoff,
        in_at__lte=punched_at
    ).order_by('-in_at').first()

    if open_session:
        return 'OUT'
    return 'IN'


def _get_emp_photo_url(emp: Employee) -> str | None:
    if emp.photo:
        try:
            return emp.photo.url
        except Exception:
            pass
    if emp.staff_member and emp.staff_member.photo:
        try:
            return emp.staff_member.photo.url
        except Exception:
            pass
    return None


def _get_emp_phone(emp: Employee) -> str:
    if emp.phone:
        return emp.phone
    if emp.staff_member and emp.staff_member.phone:
        return emp.staff_member.phone
    return ""


def process_tap(
    card_uid: str,
    device: KioskDevice | None = None,
    source: str = 'kiosk',
    actor: StaffMember | None = None,
    store: Store | None = None,
    timestamp: datetime | None = None,
    preview: bool = False
) -> dict[str, Any]:
    """
    Core entrypoint for all RFID taps.
    Atomically serializes punch creation, evaluates business rules,
    and returns rich real-time feedback for Kiosk display.
    When preview=True, validates card/employee/rules and returns proposed action
    without creating a raw punch record.
    """
    now_utc = timestamp or timezone.now()
    norm_uid = normalize_card_uid(card_uid)
    target_store = device.store if device else store

    if not norm_uid:
        return {
            'success': False,
            'error_code': 'empty_uid',
            'message': 'No card UID detected.',
        }

    # 1. Card validation
    card = RFIDCard.objects.select_related('employee', 'employee__store', 'employee__staff_member').filter(
        card_uid=norm_uid,
        status=RFIDCard.STATUS_ACTIVE
    ).first()

    if not card:
        # Check if card was lost or deactivated
        archived_card = RFIDCard.objects.filter(card_uid=norm_uid).order_by('-assigned_at').first()
        reason = archived_card.status if archived_card else 'unknown_card'
        if target_store and not preview:
            UnknownTap.objects.create(
                card_uid=norm_uid,
                device=device,
                store=target_store,
                reason=reason
            )
        msg = f"Card is {archived_card.status}." if archived_card else "Card not recognized."
        return {
            'success': False,
            'error_code': reason,
            'message': msg,
            'card_uid': norm_uid,
        }

    employee = card.employee

    # 2. Employee Active Status Check
    if not employee.is_active:
        if target_store and not preview:
            UnknownTap.objects.create(
                card_uid=norm_uid,
                device=device,
                store=target_store,
                reason='inactive_employee'
            )
        return {
            'success': False,
            'error_code': 'inactive_employee',
            'message': f"Employee {employee.name} is inactive.",
            'employee_name': employee.name,
            'employee_code': employee.employee_code,
            'phone': _get_emp_phone(employee),
            'photo_url': _get_emp_photo_url(employee),
        }

    if employee.exit_date and employee.exit_date < now_utc.date():
        if target_store and not preview:
            UnknownTap.objects.create(
                card_uid=norm_uid,
                device=device,
                store=target_store,
                reason='inactive_employee'
            )
        return {
            'success': False,
            'error_code': 'employee_exited',
            'message': f"Employee {employee.name} has separated on {employee.exit_date}.",
            'employee_name': employee.name,
            'employee_code': employee.employee_code,
            'phone': _get_emp_phone(employee),
            'photo_url': _get_emp_photo_url(employee),
        }

    # 3. Store Assignment Check
    effective_store = get_effective_store(employee, now_utc.date())
    if target_store and target_store.id != effective_store.id:
        if not preview:
            UnknownTap.objects.create(
                card_uid=norm_uid,
                device=device,
                store=target_store,
                reason='wrong_store'
            )
        return {
            'success': False,
            'error_code': 'wrong_store',
            'message': f"Access Denied: {employee.name} is assigned to '{effective_store.name}', not this store.",
            'employee_name': employee.name,
            'employee_code': employee.employee_code,
            'phone': _get_emp_phone(employee),
            'photo_url': _get_emp_photo_url(employee),
        }

    punch_store = target_store or effective_store

    # 4. Atomic Transaction & Lock on Employee Row
    with transaction.atomic():
        locked_emp = Employee.objects.select_for_update().get(id=employee.id)

        # 5. Debounce check
        debounce_sec = int(get_setting('debounce_seconds', locked_emp))
        debounce_cutoff = now_utc - timedelta(seconds=debounce_sec)

        recent_punch = Punch.objects.filter(
            employee=locked_emp,
            is_void=False,
            punched_at__gte=debounce_cutoff
        ).order_by('-punched_at').first()

        if recent_punch:
            elapsed_sec = int((now_utc - recent_punch.punched_at).total_seconds())
            rem_sec = max(1, debounce_sec - elapsed_sec)
            return {
                'success': True,
                'debounced': True,
                'is_preview': preview,
                'message': f"Already recorded {elapsed_sec}s ago. Please wait {rem_sec}s before tapping again.",
                'debounce_seconds': debounce_sec,
                'debounce_remaining': rem_sec,
                'employee_name': locked_emp.name,
                'employee_code': locked_emp.employee_code,
                'phone': _get_emp_phone(locked_emp),
                'photo_url': _get_emp_photo_url(locked_emp),
                'direction': 'TAP',
                'punched_at': recent_punch.punched_at.isoformat(),
            }

        # 6. Shift & Business Date Assignment
        store_tz = get_setting('timezone', locked_emp)
        shift = get_effective_shift(locked_emp, now_utc.date())
        early_buf = int(get_setting('early_arrival_buffer_minutes', locked_emp))
        late_buf = int(get_setting('late_departure_buffer_minutes', locked_emp))

        business_date, is_outside_window, outside_reason, shift_start_dt, shift_end_dt = determine_business_date_and_window(
            now_utc, shift, store_tz, early_buf, late_buf
        )

        # 7. Direction Derivation & Open Session Lookup
        max_sess_hours = float(get_setting('max_session_hours', locked_emp))
        cutoff = now_utc - timedelta(hours=max_sess_hours)
        open_session = AttendanceSession.objects.filter(
            attendance_day__employee=locked_emp,
            out_at__isnull=True,
            in_at__gte=cutoff,
            in_at__lte=now_utc
        ).order_by('-in_at').first()

        direction = 'OUT' if open_session else 'IN'

        # 8. Shift Boundary Enforcement
        # If outside scheduled shift window AND attempting to start a new shift (no active open session), REFUSE TAP!
        if is_outside_window and not open_session:
            shift_name = shift.name if shift else 'Scheduled Shift'
            start_12h = shift.start_time.strftime('%I:%M %p') if shift and shift.start_time else ''
            end_12h = shift.end_time.strftime('%I:%M %p') if shift and shift.end_time else ''
            early_12h = (shift_start_dt - timedelta(minutes=early_buf)).strftime('%I:%M %p') if shift_start_dt else ''
            late_12h = (shift_end_dt + timedelta(minutes=late_buf)).strftime('%I:%M %p') if shift_end_dt else ''

            if outside_reason == 'shift_not_started':
                msg = f"Shift has not started yet. Your shift '{shift_name}' is from {start_12h} to {end_12h} (Earliest tap allowed: {early_12h})."
                err_code = 'shift_not_started'
            elif outside_reason == 'shift_already_ended':
                msg = f"Shift has already ended. Your shift '{shift_name}' ended at {end_12h} (Latest tap allowed: {late_12h})."
                err_code = 'shift_already_ended'
            else:
                msg = f"No scheduled shift found today for {locked_emp.name}."
                err_code = 'no_shift_scheduled'

            return {
                'success': False,
                'error_code': err_code,
                'message': msg,
                'employee_name': locked_emp.name,
                'employee_code': locked_emp.employee_code,
                'phone': _get_emp_phone(locked_emp),
                'photo_url': _get_emp_photo_url(locked_emp),
                'shift_name': shift_name,
                'shift_range_12h': f"{start_12h} - {end_12h}" if (start_12h and end_12h) else "",
                'start_time_12h': start_12h,
                'end_time_12h': end_12h,
                'early_allowed_12h': early_12h,
                'late_allowed_12h': late_12h,
            }

        if preview:
            # Preview mode: return the derived action and shift context without persisting a punch
            elapsed_minutes = int((now_utc - open_session.in_at).total_seconds() // 60) if open_session else 0
            elapsed_str = f"{elapsed_minutes // 60}h {elapsed_minutes % 60}m" if open_session else ""

            shift_range_12h = ""
            if shift and shift.start_time and shift.end_time:
                st_12h = shift.start_time.strftime('%I:%M %p')
                et_12h = shift.end_time.strftime('%I:%M %p')
                shift_range_12h = f"{st_12h} - {et_12h}"

            return {
                'success': True,
                'is_preview': True,
                'debounced': False,
                'card_uid': norm_uid,
                'employee_id': locked_emp.id,
                'employee_code': locked_emp.employee_code,
                'employee_name': locked_emp.name,
                'phone': _get_emp_phone(locked_emp),
                'department': locked_emp.department,
                'designation': locked_emp.designation,
                'photo_url': _get_emp_photo_url(locked_emp),
                'direction': direction,
                'shift_name': shift.name if shift else 'Store General Shift',
                'shift_range_12h': shift_range_12h,
                'last_in_time': open_session.in_at.isoformat() if open_session else None,
                'elapsed_minutes': elapsed_minutes if open_session else None,
                'elapsed_formatted': elapsed_str if open_session else None,
                'business_date': business_date.isoformat(),
                'is_outside_window': is_outside_window,
            }

        # 9. Create Immutable Raw Punch
        punch = Punch.objects.create(
            employee=locked_emp,
            store=punch_store,
            device=device,
            card_uid_snapshot=norm_uid,
            punched_at=now_utc,
            source=source,
            created_by=actor,
            note="Outside shift window (Clock Out)" if is_outside_window else ""
        )

        # Update Kiosk device last_seen_at
        if device:
            device.last_seen_at = now_utc
            device.save(update_fields=['last_seen_at'])

        # 10. Trigger Pure Rebuild of the Business Date
        from .attendance import rebuild_day
        attendance_day = rebuild_day(locked_emp, business_date)

    # 10. Format Output Feedback
    warnings: list[str] = []
    if is_outside_window:
        warnings.append("Tap outside scheduled shift window.")
    if 'tap_on_off_day' in attendance_day.flags:
        warnings.append("Tap on weekly off day.")
    if 'tap_on_leave' in attendance_day.flags:
        warnings.append("Tap on approved leave date.")
    if 'tap_on_holiday' in attendance_day.flags:
        warnings.append("Tap on store holiday.")
    if attendance_day.late_minutes > 0 and direction == 'IN':
        warnings.append(f"Late arrival by {attendance_day.late_minutes} min.")

    worked_hours_str = f"{attendance_day.worked_minutes // 60}h {attendance_day.worked_minutes % 60}m"

    # Overtime feedback (shown on kiosk tap-out only)
    ot_minutes = attendance_day.overtime_minutes or 0
    ot_feedback = None
    if direction == 'OUT' and ot_minutes > 0:
        ot_h = ot_minutes // 60
        ot_m = ot_minutes % 60
        if ot_h > 0:
            ot_str = f"{ot_h}h {ot_m}m overtime" if ot_m > 0 else f"{ot_h}h overtime"
        else:
            ot_str = f"{ot_m}m overtime"
        ot_feedback = {
            'overtime_minutes': ot_minutes,
            'overtime_formatted': ot_str,
            'message': f"Great job! {ot_str} recorded today.",
        }

    return {
        'success': True,
        'debounced': False,
        'punch_id': punch.id,
        'employee_id': locked_emp.id,
        'employee_code': locked_emp.employee_code,
        'employee_name': locked_emp.name,
        'phone': _get_emp_phone(locked_emp),
        'department': locked_emp.department,
        'photo_url': _get_emp_photo_url(locked_emp),
        'direction': direction,
        'punched_at': now_utc.isoformat(),
        'business_date': business_date.isoformat(),
        'status': attendance_day.status,
        'worked_minutes_today': attendance_day.worked_minutes,
        'worked_hours_formatted': worked_hours_str,
        'overtime_feedback': ot_feedback,
        'warnings': warnings,
    }
