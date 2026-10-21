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


class OwnerExpenseRecord(models.Model):
    """
    Centralized Expense, Purchase & Shipment Tracking Ledger.
    Accessible to authorized staff (e.g. Accounts access).
    Completely isolated from store accounting P&L/operating balances.
    Tracks:
      - Expense / Stock Order / Bill details
      - Payment status (Unpaid, Partial, Paid)
      - Delivery / Shipment status (Pending, Shipped, Delivered, Not Applicable)
      - Bill attachment (Image / PDF)
    """
    STATUS_UNPAID = 'unpaid'
    STATUS_PARTIAL = 'partial'
    STATUS_PAID = 'paid'
    STATUS_CHOICES = [
        (STATUS_UNPAID, 'Unpaid / Outstanding'),
        (STATUS_PARTIAL, 'Partially Paid'),
        (STATUS_PAID, 'Fully Paid'),
    ]

    DELIVERY_PENDING = 'pending'
    DELIVERY_SHIPPED = 'in_transit'
    DELIVERY_DELIVERED = 'delivered'
    DELIVERY_NA = 'not_applicable'
    DELIVERY_CHOICES = [
        (DELIVERY_PENDING, 'Awaiting Shipment / Arrival'),
        (DELIVERY_SHIPPED, 'In Transit / Dispatched'),
        (DELIVERY_DELIVERED, 'Received / Delivered'),
        (DELIVERY_NA, 'Not Applicable'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer / NEFT'),
        ('upi', 'UPI / QR Scan'),
        ('cheque', 'Cheque'),
        ('card', 'Debit / Credit Card'),
        ('other', 'Other'),
    ]

    CATEGORY_CHOICES = [
        ('stock_order', 'Stock / Inventory Order'),
        ('raw_materials', 'Raw Materials / Goods'),
        ('store_supplies', 'Store & Packaging Supplies'),
        ('rent', 'Store Rent & Lease'),
        ('utilities', 'Electricity, Water & Utilities'),
        ('repairs', 'Repairs & Maintenance'),
        ('logistics', 'Freight, Courier & Logistics'),
        ('marketing', 'Marketing & Promotion'),
        ('salary', 'Staff Salaries / Advance'),
        ('equipment', 'Tools, Machinery & Equipment'),
        ('personal', 'Owner Personal Expense'),
        ('other', 'Other Expense'),
    ]

    record_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique sequence code, e.g. EXP-REC-202610-0001"
    )
    title = models.CharField(
        max_length=255,
        help_text="Title or description of purchase/expense"
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='other',
        db_index=True
    )
    vendor_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Supplier, vendor, payee or transporter name"
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total bill / invoice amount in ₹"
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Amount paid so far in ₹"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_UNPAID,
        db_index=True
    )

    # Delivery & Shipment tracking
    delivery_status = models.CharField(
        max_length=30,
        choices=DELIVERY_CHOICES,
        default=DELIVERY_NA,
        db_index=True,
        help_text="Shipment / physical delivery arrival status"
    )
    received_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when shipment arrived and was confirmed delivered"
    )
    received_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_expense_records'
    )
    received_by_name = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )
    delivery_notes = models.TextField(
        blank=True,
        default='',
        help_text="Tracking number, courier details, or package inspection notes"
    )

    # Payment details
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True,
        default=''
    )
    payment_account = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Source account (e.g. HDFC Current A/C, Cash Box, GPay)"
    )
    payment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date payment was settled"
    )
    payment_reference = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="UTR, Cheque number, Transaction ID or receipt ref"
    )
    payment_notes = models.TextField(
        blank=True,
        default=''
    )

    # Bill / invoice document attachment (JPG, PNG, PDF, etc.)
    bill_file = models.FileField(
        upload_to='expense_ledger_bills/%Y/%m/',
        null=True,
        blank=True,
        help_text="Uploaded invoice, photo or PDF bill"
    )

    # Scheduling & Association
    expense_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date purchase was ordered or expense incurred"
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Payment due date (triggers overdue badge if unpaid)"
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owner_expense_records',
        help_text="Optional branch tag for filtering"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="General notes or product order checklist"
    )

    # Auditing / tracking
    recorded_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_owner_expense_records'
    )
    recorded_by_name = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )
    last_updated_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_owner_expense_records'
    )
    last_updated_by_name = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expense_date', '-created_at']
        verbose_name = 'Expense Ledger Record'
        verbose_name_plural = 'Expense Ledger Records'

    @property
    def outstanding_amount(self) -> Decimal:
        diff = self.total_amount - self.paid_amount
        return max(Decimal('0.00'), diff)

    def save(self, *args, **kwargs):
        # Auto-compute status based on amounts
        if self.paid_amount >= self.total_amount and self.total_amount > Decimal('0.00'):
            self.status = self.STATUS_PAID
        elif self.paid_amount > Decimal('0.00'):
            self.status = self.STATUS_PARTIAL
        else:
            self.status = self.STATUS_UNPAID

        # Auto-generate record sequence code if empty
        if not self.record_number:
            from datetime import date
            today = self.expense_date or date.today()
            prefix = f"REC-{today.strftime('%Y%m')}-"
            last_record = OwnerExpenseRecord.objects.filter(
                record_number__startswith=prefix
            ).order_by('-record_number').first()

            if last_record and last_record.record_number:
                try:
                    last_num = int(last_record.record_number.split('-')[-1])
                    seq = last_num + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.record_number = f"{prefix}{seq:04d}"

        if self.recorded_by and not self.recorded_by_name:
            self.recorded_by_name = self.recorded_by.name

        super().save(*args, **kwargs)


class ExpenseAttachment(models.Model):
    """
    Multiple Bill / Document Attachments for an Expense Record.
    Supports photos (JPG, PNG, WebP) and PDFs simultaneously.
    """
    expense_record = models.ForeignKey(
        OwnerExpenseRecord,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(
        upload_to='expense_ledger_bills/%Y/%m/',
        help_text="Uploaded document or photo file"
    )
    file_name = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )
    file_type = models.CharField(
        max_length=50,
        blank=True,
        default=''
    )
    file_size = models.PositiveIntegerField(
        default=0,
        help_text="File size in bytes"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at', 'id']
        verbose_name = 'Expense Attachment'
        verbose_name_plural = 'Expense Attachments'

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            import os
            self.file_name = os.path.basename(self.file.name)
        if self.file and hasattr(self.file, 'size') and not self.file_size:
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)



