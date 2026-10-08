from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from inventory.models import Store
from staff.models import Employee
from staff.services.recalculation import recalculate_attendance


class Command(BaseCommand):
    help = "Recalculates attendance for a store within a given date range."

    def add_arguments(self, parser):
        parser.add_argument('--store-id', type=int, required=True, help="ID of the store.")
        parser.add_argument('--employee-id', type=int, default=None, help="Optional specific Employee ID.")
        parser.add_argument('--from-date', type=str, required=True, help="Start date (YYYY-MM-DD).")
        parser.add_argument('--to-date', type=str, required=True, help="End date (YYYY-MM-DD).")
        parser.add_argument('--preview', action='store_true', help="Preview changes without persisting to database.")

    def handle(self, *args, **options):
        store_id = options['store_id']
        employee_id = options.get('employee_id')
        from_str = options['from_date']
        to_str = options['to_date']
        is_preview = options['preview']

        try:
            store = Store.objects.get(id=store_id)
        except Store.DoesNotExist:
            raise CommandError(f"Store with ID {store_id} does not exist.")

        employee = None
        if employee_id:
            try:
                employee = Employee.objects.get(id=employee_id)
            except Employee.DoesNotExist:
                raise CommandError(f"Employee with ID {employee_id} does not exist.")

        try:
            from_date = datetime.strptime(from_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_str, '%Y-%m-%d').date()
        except ValueError:
            raise CommandError("Dates must be formatted as YYYY-MM-DD.")

        self.stdout.write(f"Recalculating attendance for {store.name} ({from_date} to {to_date}) [Preview: {is_preview}]...")
        result = recalculate_attendance(
            store=store,
            employee=employee,
            from_date=from_date,
            to_date=to_date,
            preview_only=is_preview,
            reason="CLI recalculation"
        )

        self.stdout.write(self.style.SUCCESS(
            f"Done! Evaluated: {result['total_days_evaluated']}, "
            f"Changed: {result['days_changed']}, "
            f"Skipped (Locked): {result['locked_skipped']}"
        ))

        if result['changes_preview']:
            for ch in result['changes_preview']:
                self.stdout.write(
                    f"  - {ch['employee_name']} ({ch['business_date']}): "
                    f"{ch['old_status']} -> {ch['new_status']} "
                    f"({ch['old_worked_minutes']}m -> {ch['new_worked_minutes']}m)"
                )
