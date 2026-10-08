import sys
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from staff.models import AttendanceAuditLog, StaffMember
from inventory.models import SaleOrder, StockMovement, BrokenItemReport


class Command(BaseCommand):
    help = "Audits and reports security, financial, and operational exceptions across the system."

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help="Number of days in the past to inspect (default: 7 days)."
        )
        parser.add_argument(
            '--min-discount',
            type=float,
            default=500.0,
            help="Threshold for alerting high-value bill discounts (₹)."
        )
        parser.add_argument(
            '--min-writeoff',
            type=float,
            default=1000.0,
            help="Threshold for alerting high-value damage/expiry write-offs (₹)."
        )

    def handle(self, *args, **options):
        days = options['days']
        min_disc = Decimal(str(options['min_discount']))
        min_writeoff = Decimal(str(options['min_writeoff']))
        since = timezone.now() - timedelta(days=days)

        self.stdout.write(self.style.SUCCESS(f"=== Wondersale Security & Audit Event Review (Past {days} Days) ==="))

        # 1. Attendance & HR Administrative Audit Logs
        audit_count = AttendanceAuditLog.objects.filter(created_at__gte=since).count()
        self.stdout.write(f"\n[Audit Trail] Total administrative audit logs: {audit_count}")
        recent_audits = AttendanceAuditLog.objects.filter(created_at__gte=since).order_by('-created_at')[:5]
        for a in recent_audits:
            actor = a.actor.name if a.actor else 'System'
            self.stdout.write(f"  - [{a.created_at.strftime('%Y-%m-%d %H:%M')}] Action: {a.action} by {actor} | Target: {a.target_type} #{a.target_id}")

        # 2. High-Value Discounts (Abnormal Discounting Risk)
        high_disc_orders = SaleOrder.objects.filter(
            created_at__gte=since,
            discount_amount__gte=min_disc
        ).order_by('-discount_amount')[:10]
        self.stdout.write(f"\n[Financial Alert] Orders with high discounts (>= Rs.{min_disc}): {high_disc_orders.count()}")
        for o in high_disc_orders:
            self.stdout.write(
                f"  - Invoice #{o.invoice_number} | Discount: Rs.{o.discount_amount} | Total: Rs.{o.total_amount} | Cashier: {o.cashier_name} | Date: {o.created_at.strftime('%Y-%m-%d')}"
            )

        # 3. High-Value Damage/Broken Item Write-offs
        high_broken = BrokenItemReport.objects.filter(
            created_at__gte=since,
            total_loss__gte=min_writeoff
        ).order_by('-total_loss')[:10]
        self.stdout.write(f"\n[Inventory Alert] High-loss broken item write-offs (>= Rs.{min_writeoff}): {high_broken.count()}")
        for b in high_broken:
            self.stdout.write(
                f"  - Item: {b.item.name} | Qty: {b.quantity} | Total Loss: Rs.{b.total_loss} | Reported By: {b.reported_by_name} | Date: {b.created_at.strftime('%Y-%m-%d')}"
            )

        # 4. Inactive or Suspended Staff Access Attempts
        inactive_staff = StaffMember.objects.filter(is_active=False).count()
        self.stdout.write(f"\n[Access Control] Total inactive/deactivated staff records: {inactive_staff}")

        self.stdout.write(self.style.SUCCESS("\nAudit event review completed successfully."))
