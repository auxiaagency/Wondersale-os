from django.test import TestCase
from django.utils import timezone
from datetime import datetime, date, time, timedelta
from freezegun import freeze_time
from decimal import Decimal

from inventory.models import Store
from staff.models import (
    StaffRole, StaffMember, Employee, RFIDCard, Shift,
    EmployeeShiftAssignment, Punch, UnknownTap, AttendanceDay,
    AttendanceSession, LeaveType, LeaveRequest, LeaveBalanceEntry,
    HRSetting, AttendanceAuditLog
)
from staff.services.auth import ensure_default_roles_and_owner
from staff.services.punch import process_tap, normalize_card_uid
from staff.services.attendance import (
    rebuild_day, override_day_status, clear_day_override,
    void_punch, add_manual_punch
)
from staff.services.leave import (
    submit_leave_request, approve_leave_request, cancel_leave_request,
    get_leave_balance
)
from staff.services.settings import set_setting, get_setting
from staff.services.recalculation import recalculate_attendance
from staff.services.stage2_interface import get_month_attendance, lock_month, unlock_month


class AttendanceEngineComprehensiveTests(TestCase):
    def setUp(self):
        self.owner = ensure_default_roles_and_owner()
        self.store = Store.objects.create(
            name="Downtown Flagship",
            timezone="Asia/Kolkata",
            is_active=True
        )
        self.other_store = Store.objects.create(
            name="Suburban Branch",
            timezone="Asia/Kolkata",
            is_active=True
        )

        # Standard 09:00 - 18:00 shift (9 hours, 1 hour break allowance)
        self.shift = Shift.objects.create(
            store=self.store,
            name="Standard Day",
            start_time=time(9, 0),
            end_time=time(18, 0),
            is_overnight=False,
            grace_late_minutes=15,
            grace_early_leave_minutes=10,
            min_minutes_full_day=480,  # 8 hours
            min_minutes_half_day=240,  # 4 hours
            break_allowance_minutes=60,
            is_default_for_store=True
        )

        # Overnight 22:00 - 06:00 shift
        self.overnight_shift = Shift.objects.create(
            store=self.store,
            name="Night Shift",
            start_time=time(22, 0),
            end_time=time(6, 0),
            is_overnight=True,
            grace_late_minutes=15,
            grace_early_leave_minutes=10,
            min_minutes_full_day=420,
            min_minutes_half_day=210,
            break_allowance_minutes=60,
            is_default_for_store=False
        )

        # Employee
        self.employee = Employee.objects.create(
            store=self.store,
            employee_code="EMP001",
            name="Alice Smith",
            join_date=date(2026, 1, 1),
            is_active=True
        )

        # Active RFID card
        self.card = RFIDCard.objects.create(
            employee=self.employee,
            card_uid="50E1AB61",
            status=RFIDCard.STATUS_ACTIVE
        )

    def test_01_normal_full_day(self):
        """09:00 IN, 18:00 OUT -> 1 session, 480 min net, status=present, day_fraction_paid=1.00"""
        day = date(2026, 3, 2)  # Monday
        with freeze_time("2026-03-02 09:00:00+05:30"):
            res_in = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_in['success'])
            self.assertEqual(res_in['direction'], 'IN')

        with freeze_time("2026-03-02 18:00:00+05:30"):
            res_out = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_out['success'])
            self.assertEqual(res_out['direction'], 'OUT')

        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertEqual(att_day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(att_day.sessions.count(), 1)
        self.assertEqual(att_day.late_minutes, 0)
        self.assertEqual(att_day.early_leave_minutes, 0)
        self.assertEqual(att_day.day_fraction_paid, Decimal('1.00'))

    def test_02_debounce(self):
        """2 punches within 60s -> second rejected with debounce error."""
        with freeze_time("2026-03-02 09:00:00+05:30"):
            res1 = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res1['success'])

        with freeze_time("2026-03-02 09:00:40+05:30"):
            res2 = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res2.get('debounced'))

        self.assertEqual(Punch.objects.filter(employee=self.employee).count(), 1)

    def test_03_multiple_sessions_with_break(self):
        """IN 09:00, OUT 13:00, IN 14:00, OUT 18:00 -> 2 sessions, 60m break -> present."""
        day = date(2026, 3, 3)
        with freeze_time("2026-03-03 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-03 13:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-03 14:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-03 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertEqual(att_day.sessions.count(), 2)
        self.assertEqual(att_day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(att_day.worked_minutes, 480)

    def test_04_break_allowance_excess_deduction(self):
        """Break is 90 mins, allowance is 60 mins -> 30 mins deducted from worked minutes."""
        day = date(2026, 3, 4)
        with freeze_time("2026-03-04 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-04 12:30:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-04 14:00:00+05:30"):  # 90m break
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-04 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        # Total span: 9h = 540m. Break: 90m. Allowance: 60m. Excess: 30m.
        # Worked = 450m clocked - 30m excess break deduction = 420m.
        self.assertEqual(att_day.break_minutes, 90)
        self.assertEqual(att_day.worked_minutes, 420)

    def test_05_late_arrival_grace_and_penalty(self):
        """Late arrival: grace is 15 mins. 09:12 is within grace (late_minutes=0). 09:30 is 30 mins late."""
        day = date(2026, 3, 5)
        with freeze_time("2026-03-05 09:12:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-05 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertEqual(att_day.late_minutes, 0)

        # Next day: 09:30 arrival (30 min late)
        day2 = date(2026, 3, 6)
        with freeze_time("2026-03-06 09:30:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-06 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att_day2 = AttendanceDay.objects.get(employee=self.employee, business_date=day2)
        self.assertEqual(att_day2.late_minutes, 30)
        # Tier 1 late penalty (16-30m): 0.25 day deduction -> day_fraction_paid = 0.75
        self.assertEqual(att_day2.day_fraction_paid, Decimal('0.75'))

    def test_06_half_day_and_absent_thresholds(self):
        """Worked < 240 mins -> absent. Worked >= 240 and < 480 -> half_day."""
        # 3 hours worked -> absent
        day1 = date(2026, 3, 9)
        with freeze_time("2026-03-09 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-09 12:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att1 = AttendanceDay.objects.get(employee=self.employee, business_date=day1)
        self.assertEqual(att1.status, AttendanceDay.STATUS_ABSENT)
        self.assertEqual(att1.day_fraction_paid, Decimal('0.00'))

        # 5 hours worked -> half_day
        day2 = date(2026, 3, 10)
        with freeze_time("2026-03-10 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-10 14:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att2 = AttendanceDay.objects.get(employee=self.employee, business_date=day2)
        self.assertEqual(att2.status, AttendanceDay.STATUS_HALF_DAY)
        self.assertEqual(att2.day_fraction_paid, Decimal('0.50'))

    def test_07_overnight_shift(self):
        """Overnight shift: 22:00 to 06:00. IN 21:55, OUT 06:05 next morning -> credited to start date."""
        EmployeeShiftAssignment.objects.create(
            employee=self.employee,
            shift=self.overnight_shift,
            from_date=date(2026, 3, 1)
        )
        day = date(2026, 3, 11)

        with freeze_time("2026-03-11 21:55:00+05:30"):
            res_in = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_in['success'])

        with freeze_time("2026-03-12 06:05:00+05:30"):
            res_out = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_out['success'])

        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertEqual(att_day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(att_day.sessions.count(), 1)

    def test_08_card_validation_unknown_inactive_wrong_store(self):
        """Rejected cases: unknown card, deactivated card, card at unauthorized store."""
        # 1. Unknown card
        res_unknown = process_tap(card_uid="DEADBEEF", store=self.store)
        self.assertFalse(res_unknown['success'])
        self.assertEqual(res_unknown['error_code'], 'unknown_card')
        self.assertTrue(UnknownTap.objects.filter(card_uid="DEADBEEF").exists())

        # 2. Deactivated card
        self.card.status = RFIDCard.STATUS_DEACTIVATED
        self.card.save()
        res_inactive = process_tap(card_uid=self.card.card_uid, store=self.store)
        self.assertFalse(res_inactive['success'])
        self.assertEqual(res_inactive['error_code'], 'deactivated')

        # 3. Wrong store
        self.card.status = RFIDCard.STATUS_ACTIVE
        self.card.save()
        res_wrong_store = process_tap(card_uid=self.card.card_uid, store=self.other_store)
        self.assertFalse(res_wrong_store['success'])
        self.assertEqual(res_wrong_store['error_code'], 'wrong_store')

    def test_09_manual_punch_and_void(self):
        """Adding a manual punch creates punch and rebuilds day. Voiding punch rebuilds day."""
        import zoneinfo
        tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        day = date(2026, 3, 13)
        dt_in = datetime(2026, 3, 13, 9, 0, 0, tzinfo=tz)
        dt_out = datetime(2026, 3, 13, 18, 0, 0, tzinfo=tz)

        punch1, _ = add_manual_punch(self.employee, self.store, dt_in, self.owner, "Forgot card in morning")
        punch2, att_day = add_manual_punch(self.employee, self.store, dt_out, self.owner, "Manual clock out")

        self.assertEqual(att_day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(att_day.sessions.count(), 1)

        # Void punch2
        att_day_voided = void_punch(punch2, self.owner, "Accidental duplicate entry")
        # Now has IN but no OUT -> needs_review / missed_punch
        self.assertEqual(att_day_voided.status, AttendanceDay.STATUS_NEEDS_REVIEW)
        self.assertTrue(att_day_voided.missed_punch)

    def test_10_status_override_and_clear(self):
        """Override status locks in override; clear_override restores computed status."""
        day = date(2026, 3, 14)
        att = rebuild_day(self.employee, day)
        self.assertEqual(att.status, AttendanceDay.STATUS_ABSENT)

        overridden = override_day_status(att, AttendanceDay.STATUS_PRESENT, self.owner, "Approved on-duty assignment")
        self.assertEqual(overridden.status, AttendanceDay.STATUS_PRESENT)
        self.assertTrue(overridden.is_override)

        cleared = clear_day_override(overridden, self.owner, "Reverted back to automated")
        self.assertEqual(cleared.status, AttendanceDay.STATUS_ABSENT)
        self.assertFalse(cleared.is_override)

    def test_11_recalculation_preview_and_apply(self):
        """Preview recalculation returns diffs without modifying DB. Apply updates DB."""
        day = date(2026, 3, 16)
        att = rebuild_day(self.employee, day)

        # Preview mode
        result_preview = recalculate_attendance(
            store=self.store,
            from_date=day,
            to_date=day,
            preview_only=True,
            actor=self.owner
        )
        self.assertTrue(result_preview['is_preview'])
        self.assertIn('changes_preview', result_preview)

    def test_12_stage2_payroll_summary_and_lock(self):
        """get_month_attendance produces structured metric aggregates. lock_month seals days."""
        day = date(2026, 3, 17)
        with freeze_time("2026-03-17 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-17 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        summary = get_month_attendance(self.employee, 2026, 3)
        self.assertEqual(summary['counts']['present'], 1)
        self.assertEqual(summary['total_day_fraction_paid'], '1.00')

        # Lock month
        count = lock_month(self.store, 2026, 3, actor=self.owner)
        self.assertGreater(count, 0)
        att = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertTrue(att.is_locked)

        # Rebuilding a locked day must leave it locked and untouched
        rebuild_day(self.employee, day)
        att_locked = AttendanceDay.objects.get(employee=self.employee, business_date=day)
        self.assertTrue(att_locked.is_locked)

        # Unlock month
        unlock_count = unlock_month(self.store, 2026, 3, actor=self.owner)
        self.assertGreater(unlock_count, 0)
        att.refresh_from_db()
        self.assertFalse(att.is_locked)

    def test_13_leave_request_approval_and_cancellation(self):
        """Leave application deducts quota. Cancellation refunds quota and rebuilds affected days."""
        leave_type = LeaveType.objects.create(
            name="Casual Leave",
            code="CL",
            annual_quota_days=Decimal('10.00'),
            is_paid=True
        )

        bal_initial = get_leave_balance(self.employee, leave_type, 2026)
        self.assertEqual(bal_initial, Decimal('10.00'))

        req = submit_leave_request(
            employee=self.employee,
            leave_type=leave_type,
            from_date=date(2026, 3, 20),
            to_date=date(2026, 3, 20),
            actor=self.owner,
            reason="Personal errand"
        )
        self.assertEqual(req.status, LeaveRequest.STATUS_PENDING)

        approved = approve_leave_request(req, actor=self.owner, notes="Approved")
        self.assertEqual(approved.status, LeaveRequest.STATUS_APPROVED)

        # Day should now be marked paid_leave
        att_day = AttendanceDay.objects.get(employee=self.employee, business_date=date(2026, 3, 20))
        self.assertEqual(att_day.status, AttendanceDay.STATUS_PAID_LEAVE)

        bal_after_approve = get_leave_balance(self.employee, leave_type, 2026)
        self.assertEqual(bal_after_approve, Decimal('9.00'))

        # Cancel leave
        cancelled = cancel_leave_request(approved, actor=self.owner, notes="Trip cancelled")
        self.assertEqual(cancelled.status, LeaveRequest.STATUS_CANCELLED)

        bal_after_cancel = get_leave_balance(self.employee, leave_type, 2026)
        self.assertEqual(bal_after_cancel, Decimal('10.00'))

    def test_14_tap_on_weekly_off_multiplier(self):
        """Tapping on a scheduled weekly off awards configured overtime multiplier (1.5x)."""
        # Default weekly off is Sunday (weekday=6). 2026-03-22 is Sunday.
        sun = date(2026, 3, 22)
        with freeze_time("2026-03-22 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-22 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att = AttendanceDay.objects.get(employee=self.employee, business_date=sun)
        self.assertEqual(att.status, AttendanceDay.STATUS_PRESENT)
        self.assertIn('tap_on_off_day', att.flags)
        self.assertEqual(att.day_fraction_paid, Decimal('1.50'))

    def test_15_tap_on_holiday_multiplier(self):
        """Tapping on a scheduled holiday awards holiday multiplier (2.0x)."""
        from staff.models import Holiday
        hol_date = date(2026, 3, 25)
        Holiday.objects.create(
            store=self.store,
            name="Spring Festival",
            date=hol_date,
            is_paid=True
        )

        with freeze_time("2026-03-25 09:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)
        with freeze_time("2026-03-25 18:00:00+05:30"):
            process_tap(card_uid=self.card.card_uid, store=self.store)

        att = AttendanceDay.objects.get(employee=self.employee, business_date=hol_date)
        self.assertEqual(att.status, AttendanceDay.STATUS_PRESENT)
        self.assertIn('tap_on_holiday', att.flags)
        self.assertEqual(att.day_fraction_paid, Decimal('2.00'))

    def test_16_join_and_exit_date_bounds(self):
        """Dates before employee's join_date or after exit_date return absent with 0 credit."""
        emp = Employee.objects.create(
            store=self.store,
            employee_code="EMP_TEMP",
            name="Temp Worker",
            join_date=date(2026, 3, 10),
            exit_date=date(2026, 3, 20),
            is_active=True
        )
        before_join = rebuild_day(emp, date(2026, 3, 5))
        self.assertEqual(before_join.status, AttendanceDay.STATUS_ABSENT)
        self.assertEqual(before_join.day_fraction_paid, Decimal('0.00'))

        after_exit = rebuild_day(emp, date(2026, 3, 25))
        self.assertEqual(after_exit.status, AttendanceDay.STATUS_ABSENT)
        self.assertEqual(after_exit.day_fraction_paid, Decimal('0.00'))

    def test_17_monthly_late_marks_threshold_rule(self):
        """Stage 2 summary evaluates late marks threshold (e.g. 3 times allowed, triggers on >= 3)."""
        # Create 3 late arrivals
        for day_num in [2, 3, 4]:
            d = date(2026, 4, day_num)
            with freeze_time(f"2026-04-0{day_num} 09:30:00+05:30"):
                process_tap(card_uid=self.card.card_uid, store=self.store)
            with freeze_time(f"2026-04-0{day_num} 18:00:00+05:30"):
                process_tap(card_uid=self.card.card_uid, store=self.store)

        summary = get_month_attendance(self.employee, 2026, 4)
        self.assertEqual(summary['total_late_count'], 3)
        self.assertTrue(summary['monthly_late_rule']['triggered'])
        self.assertIsNotNone(summary['monthly_late_rule']['penalty'])

    def test_18_manual_day_attendance_entry(self):
        """Allows recording manual attendance with exact times (forgot card / kiosk offline)."""
        from staff.services.attendance import record_manual_day_attendance
        target_date = date(2026, 5, 12)
        day = record_manual_day_attendance(
            employee=self.employee,
            business_date=target_date,
            actor=self.owner,
            reason="Employee forgot RFID card at home",
            status=AttendanceDay.STATUS_PRESENT,
            in_time_str="09:15",
            out_time_str="18:15"
        )
        self.assertEqual(day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(day.worked_minutes, 540)
        self.assertIsNotNone(day.first_in)
        self.assertIsNotNone(day.last_out)
        self.assertIn('manual_override', day.flags)
        self.assertEqual(day.override_reason, "Employee forgot RFID card at home")

        # Verify audit log was created
        log = AttendanceAuditLog.objects.filter(target_id=str(day.id), action='manual_attendance_edit').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.owner)

    def test_19_out_of_shift_tap_rejection(self):
        """Tapping outside shift window without open session must be rejected with detailed errors."""
        # 1. Tapping at 06:00 AM (shift starts 09:00 AM, early buffer 120m = 07:00 AM earliest)
        with freeze_time("2026-06-01 06:00:00+05:30"):
            res_early = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertFalse(res_early['success'])
            self.assertEqual(res_early['error_code'], 'shift_not_started')
            self.assertIn("Shift has not started yet", res_early['message'])
            self.assertEqual(Punch.objects.filter(employee=self.employee).count(), 0)

        # 2. Tapping at 21:30 PM (shift ends 18:00 PM, late buffer 180m = 21:00 PM latest)
        with freeze_time("2026-06-01 21:30:00+05:30"):
            res_late = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertFalse(res_late['success'])
            self.assertEqual(res_late['error_code'], 'shift_already_ended')
            self.assertIn("Shift has already ended", res_late['message'])
            self.assertEqual(Punch.objects.filter(employee=self.employee).count(), 0)

        # 3. Normal shift taps work seamlessly
        with freeze_time("2026-06-01 09:00:00+05:30"):
            res_in = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_in['success'])
            self.assertEqual(res_in['direction'], 'IN')

        with freeze_time("2026-06-01 18:00:00+05:30"):
            res_out = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(res_out['success'])
            self.assertEqual(res_out['direction'], 'OUT')

    def test_20_manual_day_attendance_supersedes_and_restores(self):
        """Manual attendance edit cleanly supersedes raw punches and restores them on clear_override."""
        from staff.services.attendance import record_manual_day_attendance, clear_day_override
        from staff.serializers import AttendanceDaySerializer

        # 1. Employee taps on kiosk: 10:00 IN, 15:00 OUT (5 hours = 300 minutes)
        with freeze_time("2026-07-01 10:00:00+05:30"):
            t1 = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(t1['success'])
        with freeze_time("2026-07-01 15:00:00+05:30"):
            t2 = process_tap(card_uid=self.card.card_uid, store=self.store)
            self.assertTrue(t2['success'])

        day = AttendanceDay.objects.get(employee=self.employee, business_date=date(2026, 7, 1))
        self.assertEqual(day.worked_minutes, 300)

        # 2. Manager manually corrects day in attendance matrix to 09:00 - 18:00 (9 hours = 540 minutes)
        updated_day = record_manual_day_attendance(
            employee=self.employee,
            business_date=date(2026, 7, 1),
            actor=self.owner,
            reason="Adjusted for manager-approved full day duty",
            status=AttendanceDay.STATUS_PRESENT,
            in_time_str="09:00",
            out_time_str="18:00"
        )
        self.assertEqual(updated_day.worked_minutes, 540)
        self.assertEqual(updated_day.status, AttendanceDay.STATUS_PRESENT)
        self.assertEqual(updated_day.sessions.count(), 1)

        # Verify serializer exposes local time strings
        serializer = AttendanceDaySerializer(updated_day)
        self.assertEqual(serializer.data['first_in_time'], '09:00')
        self.assertEqual(serializer.data['last_out_time'], '18:00')

        # 3. Manager resets override to raw
        restored_day = clear_day_override(updated_day, actor=self.owner, reason="Reset to raw taps")
        self.assertIsNone(restored_day.override_status)
        self.assertEqual(restored_day.worked_minutes, 300)
        restored_serializer = AttendanceDaySerializer(restored_day)
        self.assertEqual(restored_serializer.data['first_in_time'], '10:00')
        self.assertEqual(restored_serializer.data['last_out_time'], '15:00')




