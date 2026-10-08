"""
3-Tier Hierarchical HR Settings Framework:
Resolution Order: Employee override -> Store setting -> Global default.
"""

from typing import Any
from datetime import date
from ..models import HRSetting, Employee, AttendanceAuditLog
from inventory.models import Store


GLOBAL_HR_DEFAULTS: dict[str, Any] = {
    'timezone': 'Asia/Kolkata',
    'debounce_seconds': 60,
    'max_session_hours': 16,
    'early_arrival_buffer_minutes': 120,
    'late_departure_buffer_minutes': 180,
    'missed_punch_policy': 'require_manual_fix',  # require_manual_fix | auto_close_at_shift_end | count_as_half_day
    'auto_close_grace_minutes': 120,
    'break_allowance_minutes': 60,
    'deduct_excess_break': True,
    'min_minutes_full_day': 480,
    'min_minutes_half_day': 240,
    'grace_late_minutes': 15,
    'grace_early_leave_minutes': 15,
    'late_tiers': [
        {'from_min': 16, 'to_min': 30, 'penalty_kind': 'fraction_of_day', 'penalty_value': 0.25},
        {'from_min': 31, 'to_min': 60, 'penalty_kind': 'fraction_of_day', 'penalty_value': 0.50},
        {'from_min': 61, 'to_min': 999, 'penalty_kind': 'fraction_of_day', 'penalty_value': 1.00},
    ],
    'late_marks_threshold_rule': {
        'monthly_count': 3,
        'penalty_kind': 'fraction_of_day',
        'penalty_value': 0.50,
    },
    'arrival_after_cutoff_half_day': True,
    'arrival_cutoff_minutes': 60,
    'overtime_enabled': False,
    'overtime_threshold_minutes': 30,                # Extra buffer in minutes after scheduled shift before OT begins
    'overtime_count_from': 'shift_end',              # 'shift_end' (count all minutes past shift once threshold met) | 'after_threshold' (count only minutes exceeding threshold)
    'overtime_rate_mode': 'multiplier',              # 'multiplier' (multiply standard hourly pay) | 'fixed' (use fixed default hourly rate)
    'overtime_default_hourly_rate': 0.0,             # Default fixed hourly rate (₹/hr) when overtime_rate_mode is 'fixed'
    'overtime_hourly_rate_multiplier': 1.5,           # Multiplier on hourly rate when overtime_rate_mode is 'multiplier'
    'max_daily_overtime_minutes': 240,               # Maximum allowed daily overtime minutes (e.g. 240 = 4 hrs, 0 = no cap)
    'min_overtime_qualifying_minutes': 15,           # Minimum overtime minutes required to qualify for OT
    'overtime_requires_approval': False,             # Requires manager review/approval before settlement
    'work_on_weekly_off_rule': 'extra_day_multiplier',  # ignore | extra_day_multiplier | comp_off
    'work_on_weekly_off_multiplier': 1.5,
    'default_weekly_off_days': [6],                 # List of weekday numbers [0..6] (0=Mon, 6=Sun), [] for 7-day working
    'work_on_holiday_rule': 'extra_day_multiplier',  # ignore | extra_day_multiplier | comp_off
    'work_on_holiday_multiplier': 2.0,
    'paid_leave_counts_as_present': True,
    'leave_overlap_holiday_counts': False,  # Holiday during leave does not consume leave balance
    'leave_overlap_weekly_off_counts': False, # Weekly off during leave does not consume leave balance
    'auto_approve_leave': False,
    # Stage 2: Payroll & Salary Calculation settings
    'monthly_divisor_mode': 'actual_calendar_days',  # actual_calendar_days | fixed_30 | working_days
    'daily_workers_paid_weekly_off': False,          # Whether daily wage workers get paid on weekly off without punches
    'daily_workers_paid_holiday': True,              # Whether daily wage workers get paid on public holidays
    'allow_negative_net_salary': False,              # Clamps net salary at 0.00 if deductions exceed earnings
    'warn_negative_ledger_payout': True,             # Requires confirmation if a payout would make employee balance negative
    'payouts_affect_cash_accounts': False,           # Future-proof toggle for direct cash account reduction
}


def get_setting(key: str, entity: Employee | Store | None = None, on_date: date | None = None, default: Any = None) -> Any:
    """
    Resolves a setting value following the 3-tier hierarchy:
    1. Employee-level override (if entity is an Employee)
    2. Store-level setting (if entity is an Employee with store or Store)
    3. Global DB setting (level='global')
    4. Code-defined default in GLOBAL_HR_DEFAULTS or provided default
    """
    store_obj = None

    # 1. Check Employee-level override
    if isinstance(entity, Employee):
        store_obj = entity.store
        emp_setting = HRSetting.objects.filter(
            level=HRSetting.LEVEL_EMPLOYEE,
            employee=entity,
            key=key
        ).first()
        if emp_setting is not None:
            return emp_setting.value

    elif isinstance(entity, Store):
        store_obj = entity

    # 2. Check Store-level setting
    if store_obj is not None:
        store_setting = HRSetting.objects.filter(
            level=HRSetting.LEVEL_STORE,
            store=store_obj,
            key=key
        ).first()
        if store_setting is not None:
            return store_setting.value

        # Fallback to Store.timezone if key is 'timezone'
        if key == 'timezone' and getattr(store_obj, 'timezone', None):
            return store_obj.timezone

    # 3. Check Global-level DB setting
    global_setting = HRSetting.objects.filter(
        level=HRSetting.LEVEL_GLOBAL,
        key=key
    ).first()
    if global_setting is not None:
        return global_setting.value

    # 4. Fallback to hardcoded default or provided default
    val = GLOBAL_HR_DEFAULTS.get(key)
    return val if val is not None else default


def get_all_settings(entity: Employee | Store | None = None, on_date: date | None = None) -> dict[str, Any]:
    """
    Returns the complete dictionary of resolved settings for an entity.
    """
    result = dict(GLOBAL_HR_DEFAULTS)

    # Apply global DB overrides
    for s in HRSetting.objects.filter(level=HRSetting.LEVEL_GLOBAL):
        result[s.key] = s.value

    store_obj = entity.store if isinstance(entity, Employee) else (entity if isinstance(entity, Store) else None)

    # Apply store DB overrides
    if store_obj is not None:
        if getattr(store_obj, 'timezone', None):
            result['timezone'] = store_obj.timezone
        for s in HRSetting.objects.filter(level=HRSetting.LEVEL_STORE, store=store_obj):
            result[s.key] = s.value

    # Apply employee DB overrides
    if isinstance(entity, Employee):
        for s in HRSetting.objects.filter(level=HRSetting.LEVEL_EMPLOYEE, employee=entity):
            result[s.key] = s.value

    return result


get_all_settings_for_store = get_all_settings


def set_setting(
    key: str,
    value: Any,
    level: str = HRSetting.LEVEL_STORE,
    store: Store | None = None,
    employee: Employee | None = None,
    actor: Any | None = None,
    reason: str = ""
) -> HRSetting:
    """
    Saves or updates a setting with validation and writes an audit log entry.
    """
    valid, errors = validate_settings_schema({key: value})
    if not valid:
        raise ValueError("; ".join(errors))

    setting, created = HRSetting.objects.get_or_create(
        level=level,
        store=store if level == HRSetting.LEVEL_STORE else None,
        employee=employee if level == HRSetting.LEVEL_EMPLOYEE else None,
        key=key,
        defaults={'value': value}
    )

    before_value = None if created else setting.value

    if not created:
        setting.value = value
        setting.save()

    # Sync Store.timezone if updating store-level timezone
    if key == 'timezone' and store is not None and isinstance(value, str):
        store.timezone = value
        store.save(update_fields=['timezone'])

    # Audit Log
    target_id = f"store_{store.id}" if store else (f"emp_{employee.id}" if employee else "global")
    AttendanceAuditLog.objects.create(
        action='setting_update',
        actor=actor,
        target_type='HRSetting',
        target_id=f"{target_id}:{key}",
        before_state={'value': before_value},
        after_state={'value': value},
        reason=reason or f"Updated {key} at {level} level"
    )

    return setting


def validate_settings_schema(settings_dict: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Strict validation of settings types and logical constraints.
    Returns (is_valid, list_of_errors).
    """
    errors: list[str] = []

    for key, val in settings_dict.items():
        if key in ('debounce_seconds', 'auto_close_grace_minutes', 'break_allowance_minutes',
                    'grace_late_minutes', 'grace_early_leave_minutes', 'arrival_cutoff_minutes',
                    'early_arrival_buffer_minutes', 'late_departure_buffer_minutes',
                    'overtime_threshold_minutes', 'max_daily_overtime_minutes',
                    'min_overtime_qualifying_minutes'):
            if not isinstance(val, int) or val < 0:
                errors.append(f"{key} must be a non-negative integer.")

        elif key in ('min_minutes_full_day', 'min_minutes_half_day'):
            if not isinstance(val, int) or val <= 0:
                errors.append(f"{key} must be a positive integer.")

        elif key == 'max_session_hours':
            if not isinstance(val, (int, float)) or val <= 0 or val > 24:
                errors.append("max_session_hours must be between 1 and 24.")

        elif key == 'missed_punch_policy':
            if val not in ('require_manual_fix', 'auto_close_at_shift_end', 'count_as_half_day'):
                errors.append(f"Invalid missed_punch_policy: {val}")

        elif key == 'work_on_weekly_off_rule':
            if val not in ('ignore', 'extra_day_multiplier', 'comp_off'):
                errors.append(f"Invalid work_on_weekly_off_rule: {val}")

        elif key == 'work_on_holiday_rule':
            if val not in ('ignore', 'extra_day_multiplier', 'comp_off'):
                errors.append(f"Invalid work_on_holiday_rule: {val}")

        elif key == 'overtime_count_from':
            if val not in ('shift_end', 'after_threshold'):
                errors.append(f"Invalid overtime_count_from: {val}. Must be 'shift_end' or 'after_threshold'.")

        elif key == 'overtime_rate_mode':
            if val not in ('multiplier', 'fixed'):
                errors.append(f"Invalid overtime_rate_mode: {val}. Must be 'multiplier' or 'fixed'.")

        elif key in ('work_on_weekly_off_multiplier', 'work_on_holiday_multiplier',
                     'overtime_hourly_rate_multiplier', 'overtime_default_hourly_rate'):
            if not isinstance(val, (int, float)) or val < 0.0:
                errors.append(f"{key} must be a non-negative number.")

        elif key == 'monthly_divisor_mode':
            if val not in ('actual_calendar_days', 'fixed_30', 'working_days'):
                errors.append(f"Invalid monthly_divisor_mode: {val}. Must be actual_calendar_days, fixed_30, or working_days.")

        elif key in ('overtime_enabled', 'overtime_requires_approval', 'arrival_after_cutoff_half_day',
                     'deduct_excess_break', 'paid_leave_counts_as_present', 'leave_overlap_holiday_counts',
                     'leave_overlap_weekly_off_counts',
                     'auto_approve_leave', 'daily_workers_paid_weekly_off', 'daily_workers_paid_holiday',
                     'allow_negative_net_salary', 'warn_negative_ledger_payout', 'payouts_affect_cash_accounts'):
            if not isinstance(val, bool):
                errors.append(f"{key} must be a boolean.")

        elif key == 'default_weekly_off_days':
            if not isinstance(val, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in val):
                errors.append("default_weekly_off_days must be a list of weekday integers between 0 (Monday) and 6 (Sunday).")

        elif key == 'late_tiers':
            if not isinstance(val, list):
                errors.append("late_tiers must be a list of tier definitions.")
            else:
                for idx, tier in enumerate(val):
                    if not isinstance(tier, dict):
                        errors.append(f"late_tiers[{idx}] must be a dictionary.")
                        continue
                    if 'from_min' not in tier or 'to_min' not in tier or 'penalty_kind' not in tier:
                        errors.append(f"late_tiers[{idx}] must include from_min, to_min, penalty_kind.")
                    if tier.get('penalty_kind') not in ('fraction_of_day', 'fixed_amount', 'none'):
                        errors.append(f"late_tiers[{idx}] penalty_kind must be fraction_of_day, fixed_amount, or none.")

    # Cross-field constraints
    min_full = settings_dict.get('min_minutes_full_day')
    min_half = settings_dict.get('min_minutes_half_day')
    if min_full is not None and min_half is not None:
        if min_half >= min_full:
            errors.append("min_minutes_half_day must be strictly less than min_minutes_full_day.")

    return len(errors) == 0, errors
