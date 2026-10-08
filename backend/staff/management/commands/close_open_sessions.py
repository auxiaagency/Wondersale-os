from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from staff.models import AttendanceSession, AttendanceDay, Employee
from staff.services.settings import get_setting
from staff.services.attendance import rebuild_day


class Command(BaseCommand):
    help = "Nightly job to flag abandoned open sessions as missed_out and apply missed-punch policy."

    def handle(self, *args, **options):
        now_utc = timezone.now()
        self.stdout.write(f"Running open sessions closer at {now_utc.isoformat()}...")

        open_sessions = AttendanceSession.objects.filter(out_at__isnull=True).select_related(
            'attendance_day',
            'attendance_day__employee',
            'attendance_day__store'
        )

        flagged_count = 0
        for session in open_sessions:
            day = session.attendance_day
            emp = day.employee
            max_hours = float(get_setting('max_session_hours', emp))
            age_hours = (now_utc - session.in_at).total_seconds() / 3600

            if age_hours >= max_hours or (now_utc.date() > day.business_date):
                # Trigger rebuild which evaluates auto-close grace and missed_out
                rebuild_day(emp, day.business_date, force=True)
                flagged_count += 1

        self.stdout.write(self.style.SUCCESS(f"Finished. Evaluated and processed {flagged_count} open sessions."))
