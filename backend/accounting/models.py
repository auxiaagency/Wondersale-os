from decimal import Decimal
from django.db import models
from django.utils import timezone


class OperatingExpense(models.Model):
    """
    Store operating expense record.
    Tracks monthly recurring and ad-hoc overhead expenses: rent, utilities, repairs, daily supplies, logistics, etc.
    """
    CATEGORY_CHOICES = [
        ('rent', 'Store Rent & Lease'),
        ('utilities', 'Electricity, Water & Utilities'),
        ('refreshments', 'Tea, Snacks & Daily Supplies'),
        ('repairs', 'Maintenance & Repairs'),
        ('logistics', 'Freight, Courier & Logistics'),
        ('marketing', 'Advertising & Marketing'),
        ('packaging', 'Packaging, Bags & Stationery'),
        ('cleaning', 'Housekeeping & Cleaning'),
        ('software', 'Software, POS & Subscriptions'),
        ('tax_legal', 'Taxes, Licenses & Legal'),
        ('salaries', 'Staff Salaries & Payroll'),
        ('other', 'Other Operating Expense'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer / NEFT'),
        ('upi', 'UPI / QR Scan'),
        ('cheque', 'Cheque'),
        ('card', 'Debit / Credit Card'),
        ('other', 'Other'),
    ]

    voucher_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique expense voucher code, e.g. EXP-202609-0001"
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.CASCADE,
        related_name='operating_expenses',
        null=True,
        blank=True,
        help_text="Store associated with this operational expense"
    )
    title = models.CharField(
        max_length=255,
        help_text="Short title or description of the operating expense"
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='other',
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Expense amount in ₹"
    )
    expense_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date the expense was incurred"
    )
    month = models.PositiveSmallIntegerField(
        default=1,
        db_index=True,
        help_text="Calendar month (1-12)"
    )
    year = models.PositiveIntegerField(
        default=2026,
        db_index=True,
        help_text="Calendar year"
    )
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        default='cash'
    )
    paid_to = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Vendor, landlord, service provider or payee name"
    )
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Bill #, Invoice #, UTR #, or receipt reference"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Additional details, notes, or justification"
    )
    recorded_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_operating_expenses'
    )
    recorded_by_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Name of the person who logged this expense"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expense_date', '-id']
        verbose_name = 'Operating Expense'
        verbose_name_plural = 'Operating Expenses'

    def __str__(self):
        store_name = self.store.name if self.store else 'All Stores'
        return f"{self.voucher_number} - {self.title} - ₹{self.amount:,.2f} [{self.get_category_display()}] ({store_name})"

    def save(self, *args, **kwargs):
        # Auto-extract month and year from expense_date
        if self.expense_date:
            self.month = self.expense_date.month
            self.year = self.expense_date.year

        # Auto-generate voucher number if empty
        if not self.voucher_number:
            from .services import generate_next_expense_voucher_number
            self.voucher_number = generate_next_expense_voucher_number(year=self.year, month=self.month)

        if self.recorded_by and not self.recorded_by_name:
            self.recorded_by_name = self.recorded_by.name

        super().save(*args, **kwargs)


class SectionMonthlyGoal(models.Model):
    """
    Phase 4: Section Monthly Sales & Gross Profit Targets with Auto-Locking.
    Allows owners/managers to set monthly target revenue and profit for each store section.
    Automatically locks on the 3rd day of the subsequent month at 23:59:59.
    """
    section = models.ForeignKey(
        'inventory.Section',
        on_delete=models.CASCADE,
        related_name='monthly_goals',
        help_text="Target store department/section"
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.CASCADE,
        related_name='section_monthly_goals',
        null=True,
        blank=True,
        help_text="Store containing the section"
    )
    year = models.PositiveIntegerField(
        default=2026,
        db_index=True,
        help_text="Calendar year (e.g. 2026)"
    )
    month = models.PositiveSmallIntegerField(
        default=10,
        db_index=True,
        help_text="Calendar month (1-12)"
    )
    target_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Target monthly gross sales/revenue in ₹"
    )
    target_profit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Target monthly gross profit in ₹"
    )
    actual_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Frozen or computed actual gross revenue"
    )
    actual_profit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Frozen or computed actual gross profit"
    )
    is_locked = models.BooleanField(
        default=False,
        help_text="Locked permanently after the 3rd of subsequent month"
    )
    locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when goal was locked"
    )
    created_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_section_goals'
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Optional performance notes or strategy from owner"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month', 'section__name']
        unique_together = [['section', 'year', 'month']]
        verbose_name = 'Section Monthly Goal'
        verbose_name_plural = 'Section Monthly Goals'

    def __str__(self):
        sec_name = self.section.name if self.section else 'Section'
        return f"{sec_name} ({self.month:02d}/{self.year}) Target: ₹{self.target_revenue:,.2f}"

    def check_and_update_lock_status(self):
        """
        Auto-lock rule: On the 3rd day of the following month at 23:59:59,
        the goal automatically becomes immutable.
        Example: October 2026 locks on November 3rd, 2026.
        """
        if self.is_locked:
            return True

        from datetime import date
        now_date = timezone.now().date()
        # Compute lock deadline date: 4th day of next month (since it locks at 23:59:59 on the 3rd)
        next_month_year = self.year + (1 if self.month == 12 else 0)
        next_month = 1 if self.month == 12 else (self.month + 1)
        lock_trigger_date = date(next_month_year, next_month, 4)

        if now_date >= lock_trigger_date:
            self.is_locked = True
            self.locked_at = timezone.now()
            self.save(update_fields=['is_locked', 'locked_at'])
            return True
        return False

