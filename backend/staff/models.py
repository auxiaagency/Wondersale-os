from datetime import date
from decimal import Decimal
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone


ALL_MODULE_KEYS = [
    'dashboard',
    'inventory',
    'staff',
    'billing',
    'accounting',
    'stakeholders',
    'customers',
    'settings',
]


class StaffRole(models.Model):
    """
    Staff Role / Category defining permissions across system modules.
    Owner role has unrestricted administrative access.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")
    is_owner = models.BooleanField(
        default=False,
        help_text="Designates the account as an Owner with complete system privileges."
    )
    # The 8 Menu Buttons / Modules Visibility & Access Permissions
    allowed_modules = models.JSONField(
        default=list,
        blank=True,
        help_text="List of menu button module IDs this role can see and access."
    )
    can_access_inventory = models.BooleanField(
        default=False,
        help_text="Permission to view inventory and scan products."
    )
    can_adjust_stock = models.BooleanField(
        default=False,
        help_text="Permission to perform manual additions and deductions on stock."
    )
    can_access_billing = models.BooleanField(
        default=False,
        help_text="Permission to access billing/POS module (Phase 2)."
    )
    can_access_staff = models.BooleanField(
        default=False,
        help_text="Permission to view staff members and configure roles (Owner privilege)."
    )

    CASHIER_ROLE_CASHIER = 'cashier'
    CASHIER_ROLE_HEAD = 'head_cashier'
    CASHIER_ROLE_CHOICES = [
        (CASHIER_ROLE_CASHIER, 'Cashier'),
        (CASHIER_ROLE_HEAD, 'Head Cashier'),
    ]

    cashier_role = models.CharField(
        max_length=50,
        choices=CASHIER_ROLE_CHOICES,
        default=CASHIER_ROLE_CASHIER,
        blank=True,
        help_text="Designation tier when billing & pos is accessible ('cashier' vs 'head_cashier')."
    )

    INVENTORY_SCOPE_FULL = 'full'
    INVENTORY_SCOPE_SECTION = 'assigned_section'
    INVENTORY_SCOPE_CHOICES = [
        (INVENTORY_SCOPE_FULL, 'Full Store Inventory'),
        (INVENTORY_SCOPE_SECTION, 'Assigned Section Only'),
    ]

    inventory_scope = models.CharField(
        max_length=30,
        choices=INVENTORY_SCOPE_CHOICES,
        default=INVENTORY_SCOPE_FULL,
        blank=True,
        help_text="Access scope when inventory module is enabled ('full' store vs 'assigned_section' only)."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Staff Role'
        verbose_name_plural = 'Staff Roles'

    def __str__(self):
        return f"{self.name} {'(Owner)' if self.is_owner else ''}"

    @property
    def is_head_cashier(self) -> bool:
        return self.is_owner or self.cashier_role == self.CASHIER_ROLE_HEAD

    def save(self, *args, **kwargs):
        # Owners automatically have all permissions & all 8 modules enabled
        if self.is_owner:
            self.allowed_modules = ALL_MODULE_KEYS.copy()
            self.can_access_inventory = True
            self.can_adjust_stock = True
            self.can_access_billing = True
            self.can_access_staff = True
            self.cashier_role = self.CASHIER_ROLE_HEAD
            self.inventory_scope = self.INVENTORY_SCOPE_FULL
        else:
            if not self.allowed_modules:
                # Derive from booleans if empty
                mods = []
                if self.can_access_inventory:
                    mods.append('inventory')
                if self.can_access_billing:
                    mods.append('billing')
                if self.can_access_staff:
                    mods.append('staff')
                self.allowed_modules = mods
            else:
                self.can_access_inventory = 'inventory' in self.allowed_modules
                self.can_access_billing = 'billing' in self.allowed_modules
                self.can_access_staff = 'staff' in self.allowed_modules
        super().save(*args, **kwargs)


class StaffMember(models.Model):
    """
    Staff accounts table holding credentials, assigned role/category, and store location.
    All staff (cashier, employee, store manager, owner) are stored here.
    """
    staff_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Staff login ID (e.g. OWNER01, CASHIER01, admin)."
    )
    name = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255)
    role = models.ForeignKey(
        StaffRole,
        on_delete=models.PROTECT,
        related_name='members'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_members'
    )
    section = models.ForeignKey(
        'inventory.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_members',
        help_text="Assigned section/department in store (optional, at most 1 section; can be left blank)."
    )
    phone = models.CharField(
        max_length=30,
        blank=True,
        default='',
        help_text="Contact phone number."
    )
    photo = models.ImageField(
        upload_to='staff/photos/',
        blank=True,
        null=True,
        help_text="Staff profile photograph."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether this staff member can log in."
    )
    session_token = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
        help_text="Active session token. Rotated on password change or explicit revocation to invalidate old device sessions."
    )
    inventory_scope = models.CharField(
        max_length=30,
        choices=StaffRole.INVENTORY_SCOPE_CHOICES,
        default=StaffRole.INVENTORY_SCOPE_FULL,
        blank=True,
        help_text="Optional inventory scope override for this staff member (defaults to role scope if left blank)."
    )
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Staff Member'
        verbose_name_plural = 'Staff Members'

    def __str__(self):
        return f"{self.name} ({self.staff_id}) - {self.role.name}"

    def rotate_session_token(self) -> str:
        """Generates a new session token, immediately invalidating sessions on all other devices."""
        import secrets
        self.session_token = secrets.token_hex(32)
        return self.session_token

    def set_password(self, raw_password: str):
        """Sets new hashed password and rotates session token to terminate all active sessions across all devices."""
        self.password_hash = make_password(raw_password)
        self.rotate_session_token()

    def save(self, *args, **kwargs):
        if not self.session_token:
            self.rotate_session_token()
        super().save(*args, **kwargs)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)

    @property
    def is_owner(self) -> bool:
        return self.role.is_owner

    @property
    def is_head_cashier(self) -> bool:
        return self.is_owner or (self.role and self.role.is_head_cashier)

    @property
    def cashier_role(self) -> str:
        return 'head_cashier' if self.is_head_cashier else getattr(self.role, 'cashier_role', 'cashier')

    @property
    def effective_inventory_scope(self) -> str:
        if self.is_owner:
            return StaffRole.INVENTORY_SCOPE_FULL
        if self.inventory_scope and self.inventory_scope != StaffRole.INVENTORY_SCOPE_FULL:
            return self.inventory_scope
        if self.role and hasattr(self.role, 'inventory_scope') and self.role.inventory_scope:
            return self.role.inventory_scope
        return self.inventory_scope or StaffRole.INVENTORY_SCOPE_FULL

    @property
    def is_section_restricted(self) -> bool:
        """True if staff member is strictly restricted to viewing and managing their assigned section's inventory."""
        return not self.is_owner and self.effective_inventory_scope == StaffRole.INVENTORY_SCOPE_SECTION and bool(self.section_id)


# ============================================================================
# STAGE 1: EMPLOYEE MANAGEMENT, RFID ATTENDANCE, SHIFTS, LEAVE, AND AUDIT
# ============================================================================


class Employee(models.Model):
    """
    Core employee entity for internal workforce record-keeping.
    Employees do not have system login accounts unless linked to a StaffMember.
    """
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='employees',
        help_text="Current assigned primary store location."
    )
    employee_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique employee identifier code (e.g. EMP001)."
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, blank=True, default='')
    photo = models.ImageField(
        upload_to='employees/photos/',
        blank=True,
        null=True,
        help_text="Employee profile photograph."
    )
    join_date = models.DateField(help_text="Date the employee officially joined.")
    exit_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of separation or resignation (null if currently active)."
    )
    department = models.CharField(max_length=100, blank=True, default='')
    designation = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this employee is currently employed and active."
    )
    notes = models.TextField(blank=True, default='')
    staff_member = models.OneToOneField(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_profile',
        help_text="Associated staff login user account if linked."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_code']
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'
        indexes = [
            models.Index(fields=['store', 'is_active']),
        ]

    def __str__(self):
        return f"{self.employee_code} - {self.name}"

    @property
    def active_card(self):
        """Returns the currently active RFID card or None."""
        return self.rfid_cards.filter(status='active').first()


class EmployeeStoreAssignment(models.Model):
    """
    Effective-dated transfer history tracking which store an employee belonged to over time.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='store_assignments'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='employee_assignments'
    )
    from_date = models.DateField(db_index=True)
    to_date = models.DateField(null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-from_date']
        verbose_name = 'Employee Store Assignment'
        verbose_name_plural = 'Employee Store Assignments'
        indexes = [
            models.Index(fields=['employee', 'from_date', 'to_date']),
        ]

    def __str__(self):
        return f"{self.employee.name} -> {self.store.name} ({self.from_date} to {self.to_date or 'Present'})"


class RFIDCard(models.Model):
    """
    Physical RFID / NFC card assigned to an employee for attendance tapping.
    Card UID is normalized (uppercase, stripped).
    Guarantees only ONE active card per UID globally across the entire system.
    """
    STATUS_ACTIVE = 'active'
    STATUS_LOST = 'lost'
    STATUS_DEACTIVATED = 'deactivated'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_LOST, 'Lost'),
        (STATUS_DEACTIVATED, 'Deactivated'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='rfid_cards'
    )
    card_uid = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Normalized uppercase card UID without spaces (e.g. 50E1AB61)."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default='', help_text="Reason for assignment or deactivation.")

    class Meta:
        ordering = ['-assigned_at']
        verbose_name = 'RFID Card'
        verbose_name_plural = 'RFID Cards'
        constraints = [
            models.UniqueConstraint(
                fields=['card_uid'],
                condition=models.Q(status='active'),
                name='unique_active_card_uid'
            )
        ]

    def __str__(self):
        return f"Card {self.card_uid} ({self.status}) - {self.employee.name}"


class KioskDevice(models.Model):
    """
    Authorized attendance kiosk terminal or ESP32 hardware device.
    Authenticates via a hashed API token passed in X-Device-Token header.
    """
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='kiosk_devices'
    )
    name = models.CharField(max_length=100, help_text="e.g. Main Entrance Kiosk, Staff Room Tablet")
    api_token_hash = models.CharField(max_length=255, help_text="Hashed device token.")
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['store', 'name']
        verbose_name = 'Kiosk Device'
        verbose_name_plural = 'Kiosk Devices'

    def __str__(self):
        return f"{self.name} - {self.store.name}"


class Shift(models.Model):
    """
    Store shift defining scheduled working hours, grace periods, and day thresholds.
    """
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='shifts'
    )
    name = models.CharField(max_length=100, help_text="e.g. General Shift, Morning Shift, Night Shift")
    start_time = models.TimeField(help_text="Scheduled shift start time (e.g. 09:00)")
    end_time = models.TimeField(help_text="Scheduled shift end time (e.g. 18:00)")
    is_overnight = models.BooleanField(
        default=False,
        help_text="Shift spans midnight into the next calendar day."
    )
    grace_late_minutes = models.PositiveIntegerField(
        default=15,
        help_text="Minutes after start_time allowed before late marks begin."
    )
    grace_early_leave_minutes = models.PositiveIntegerField(
        default=15,
        help_text="Minutes before end_time allowed without early leave penalty."
    )
    min_minutes_full_day = models.PositiveIntegerField(
        default=480,
        help_text="Minimum worked minutes required for Full Day credit (default: 480m = 8h)."
    )
    min_minutes_half_day = models.PositiveIntegerField(
        default=240,
        help_text="Minimum worked minutes required for Half Day credit (default: 240m = 4h)."
    )
    break_allowance_minutes = models.PositiveIntegerField(
        default=60,
        help_text="Allowed break duration in minutes (default: 60m)."
    )
    is_default_for_store = models.BooleanField(
        default=False,
        help_text="Default shift for employees in this store without custom shift assignments."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['store', 'name']
        verbose_name = 'Shift'
        verbose_name_plural = 'Shifts'

    @property
    def start_time_12h(self):
        if self.start_time:
            return self.start_time.strftime('%I:%M %p')
        return None

    @property
    def end_time_12h(self):
        if self.end_time:
            return self.end_time.strftime('%I:%M %p')
        return None

    @property
    def time_range_12h(self):
        s = self.start_time_12h
        e = self.end_time_12h
        if s and e:
            return f"{s} - {e}"
        return ""

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}) [{self.store.name}]"


class EmployeeShiftAssignment(models.Model):
    """
    Effective-dated shift and weekly-off schedule for an employee.
    If shift is null, the store's default shift applies.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='shift_assignments'
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_assignments',
        help_text="Assigned shift (null = use store default)."
    )
    weekly_off_days = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="List of weekday numbers (0=Mon .. 6=Sun) for weekly off (null = store default)."
    )
    from_date = models.DateField(db_index=True)
    to_date = models.DateField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-from_date']
        verbose_name = 'Employee Shift Assignment'
        verbose_name_plural = 'Employee Shift Assignments'
        indexes = [
            models.Index(fields=['employee', 'from_date', 'to_date']),
        ]

    def __str__(self):
        shift_name = self.shift.name if self.shift else 'Store Default'
        return f"{self.employee.name}: {shift_name} ({self.from_date} to {self.to_date or 'Present'})"


class Punch(models.Model):
    """
    RAW, immutable tap log. Every physical or manual tap creates a permanent record here.
    Never edited in place: mistakes are resolved by marking is_void=True or adding a new punch.
    """
    SOURCE_KIOSK = 'kiosk'
    SOURCE_API = 'api'
    SOURCE_MANUAL = 'manual'
    SOURCE_CHOICES = [
        (SOURCE_KIOSK, 'Kiosk'),
        (SOURCE_API, 'API'),
        (SOURCE_MANUAL, 'Manual'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name='punches'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='punches'
    )
    device = models.ForeignKey(
        KioskDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='punches'
    )
    card_uid_snapshot = models.CharField(
        max_length=64,
        help_text="Snapshot of the physical card UID presented."
    )
    punched_at = models.DateTimeField(
        db_index=True,
        help_text="Server-verified UTC timestamp of the tap."
    )
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default=SOURCE_KIOSK
    )
    is_void = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Flagged true if voided by an authorized manager."
    )
    void_reason = models.TextField(blank=True, default='')
    voided_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voided_punches'
    )
    created_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_punches'
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['punched_at']
        verbose_name = 'Punch'
        verbose_name_plural = 'Punches'
        indexes = [
            models.Index(fields=['employee', 'punched_at', 'is_void']),
            models.Index(fields=['store', 'punched_at']),
        ]

    def __str__(self):
        void_str = ' [VOID]' if self.is_void else ''
        return f"{self.employee.name} @ {self.punched_at.strftime('%Y-%m-%d %H:%M:%S')}{void_str}"


class UnknownTap(models.Model):
    """
    Audit log of taps rejected at the kiosk (unknown card, inactive employee, wrong store).
    """
    card_uid = models.CharField(max_length=64, db_index=True)
    device = models.ForeignKey(KioskDevice, on_delete=models.SET_NULL, null=True, blank=True)
    store = models.ForeignKey('inventory.Store', on_delete=models.PROTECT)
    reason = models.CharField(
        max_length=50,
        help_text="Reason code: unknown_card, inactive_card, inactive_employee, wrong_store"
    )
    at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-at']
        verbose_name = 'Unknown Tap'
        verbose_name_plural = 'Unknown Taps'

    def __str__(self):
        return f"Unknown Tap {self.card_uid} ({self.reason}) @ {self.at.strftime('%Y-%m-%d %H:%M:%S')}"


class AttendanceDay(models.Model):
    """
    DERIVED, rebuildable daily attendance record.
    Computed by running rebuild_day() over raw non-void punches.
    """
    STATUS_PRESENT = 'present'
    STATUS_HALF_DAY = 'half_day'
    STATUS_ABSENT = 'absent'
    STATUS_PAID_LEAVE = 'paid_leave'
    STATUS_UNPAID_LEAVE = 'unpaid_leave'
    STATUS_WEEKLY_OFF = 'weekly_off'
    STATUS_HOLIDAY = 'holiday'
    STATUS_NEEDS_REVIEW = 'needs_review'
    STATUS_CHOICES = [
        (STATUS_PRESENT, 'Present'),
        (STATUS_HALF_DAY, 'Half Day'),
        (STATUS_ABSENT, 'Absent'),
        (STATUS_PAID_LEAVE, 'Paid Leave'),
        (STATUS_UNPAID_LEAVE, 'Unpaid Leave'),
        (STATUS_WEEKLY_OFF, 'Weekly Off'),
        (STATUS_HOLIDAY, 'Holiday'),
        (STATUS_NEEDS_REVIEW, 'Needs Review'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_days'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='attendance_days'
    )
    business_date = models.DateField(db_index=True)
    shift_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of the shift parameters in effect on this business date."
    )
    first_in = models.DateTimeField(null=True, blank=True)
    last_out = models.DateTimeField(null=True, blank=True)
    worked_minutes = models.PositiveIntegerField(default=0)
    break_minutes = models.PositiveIntegerField(default=0)
    late_minutes = models.PositiveIntegerField(default=0)
    early_leave_minutes = models.PositiveIntegerField(default=0)
    overtime_minutes = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_ABSENT,
        db_index=True
    )
    flags = models.JSONField(
        default=list,
        blank=True,
        help_text="List of string flags: missed_out, missed_in, tap_on_off_day, tap_on_leave, outside_window, manual_override"
    )
    day_fraction_paid = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Paid credit for day: 0.0 (unpaid/absent), 0.5 (half day), 1.0 (full day), or >1.0 for multipliers."
    )
    late_penalty = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured non-monetary penalty info: {'kind': 'fraction_of_day'/'none', 'value': 0.25}"
    )
    override_status = models.CharField(
        max_length=30,
        null=True,
        blank=True,
        choices=STATUS_CHOICES,
        help_text="Admin override status."
    )
    override_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    override_reason = models.TextField(blank=True, default='')
    is_locked = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Locked days cannot be recalculated or modified (used when month is finalized in Stage 2)."
    )

    # --- Interim Settlement Tracking ---
    is_settled = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True when this day's wages have been counted in an interim payroll settlement."
    )
    settled_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Timestamp when this day was included in an interim settlement."
    )
    settlement_ref = models.CharField(
        max_length=100, blank=True, default='',
        help_text="Reference number of the interim settlement (e.g. ISETL-20261001-0001)."
    )

    # --- Overtime Verification ---
    ot_verified = models.BooleanField(
        default=False,
        help_text="True when a manager has reviewed and verified the overtime minutes for this day."
    )
    ot_override_minutes = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Manager-approved OT override in minutes. If set, this takes precedence over overtime_minutes in payroll calculations."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-business_date']
        verbose_name = 'Attendance Day'
        verbose_name_plural = 'Attendance Days'
        unique_together = ('employee', 'business_date')
        indexes = [
            models.Index(fields=['store', 'business_date', 'status']),
        ]

    @property
    def is_override(self) -> bool:
        return bool(self.override_status)

    @property
    def missed_punch(self) -> bool:
        return 'missed_out' in (self.flags or []) or 'missed_in' in (self.flags or [])

    def __str__(self):
        return f"{self.employee.name} - {self.business_date}: {self.status}"


class AttendanceSession(models.Model):
    """
    DERIVED individual clocked work session within an attendance day (pair of IN and OUT).
    """
    attendance_day = models.ForeignKey(
        AttendanceDay,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    in_at = models.DateTimeField()
    out_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['in_at']
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'

    def __str__(self):
        out_str = self.out_at.strftime('%H:%M') if self.out_at else 'OPEN'
        return f"{self.in_at.strftime('%H:%M')} - {out_str} ({self.duration_minutes}m)"


class Holiday(models.Model):
    """
    Store or company-wide public holidays. If store is null, applies to all stores.
    """
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='holidays',
        help_text="Specific store (null = system-wide all stores)."
    )
    date = models.DateField(db_index=True)
    name = models.CharField(max_length=150)
    is_paid = models.BooleanField(default=True)

    class Meta:
        ordering = ['date']
        verbose_name = 'Holiday'
        verbose_name_plural = 'Holidays'
        unique_together = ('store', 'date')

    def __str__(self):
        store_label = self.store.name if self.store else 'All Stores'
        return f"{self.date}: {self.name} [{store_label}]"


class LeaveType(models.Model):
    """
    Configurable leave category (e.g. Casual Leave, Sick Leave, Earned Leave, Loss of Pay).
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True, help_text="Short code (e.g. CL, SL, EL, LOP)")
    is_paid = models.BooleanField(default=True)
    annual_quota_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('12.00'),
        help_text="Standard yearly quota allocation in days."
    )
    allows_half_day = models.BooleanField(default=True)
    carry_forward = models.BooleanField(default=False)
    allow_negative_balance = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'

    def __str__(self):
        return f"{self.name} ({self.code})"


class LeaveRequest(models.Model):
    """
    Leave application submitted for an employee.
    """
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    HALF_DAY_FIRST = 'first_half'
    HALF_DAY_SECOND = 'second_half'
    HALF_DAY_CHOICES = [
        (HALF_DAY_FIRST, 'First Half'),
        (HALF_DAY_SECOND, 'Second Half'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='requests'
    )
    from_date = models.DateField()
    to_date = models.DateField()
    half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(
        max_length=20,
        blank=True,
        default='',
        choices=HALF_DAY_CHOICES
    )
    days_count = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        help_text="Calculated days deducted (e.g. 0.5, 1.0, 3.0)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    reason = models.TextField()
    decided_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    decision_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Leave Request'
        verbose_name_plural = 'Leave Requests'
        indexes = [
            models.Index(fields=['employee', 'from_date', 'to_date', 'status']),
        ]

    def __str__(self):
        return f"{self.employee.name}: {self.leave_type.code} ({self.from_date} to {self.to_date}) - {self.status}"


class LeaveBalanceEntry(models.Model):
    """
    Append-only ledger of leave balance movements (allocation, used, adjustments, carry forward).
    Current balance = sum(amount) for that employee, leave_type, and year.
    """
    KIND_ALLOCATION = 'allocation'
    KIND_USED = 'used'
    KIND_ADJUSTMENT = 'adjustment'
    KIND_CARRY_FORWARD = 'carry_forward'
    KIND_CHOICES = [
        (KIND_ALLOCATION, 'Allocation'),
        (KIND_USED, 'Used'),
        (KIND_ADJUSTMENT, 'Adjustment'),
        (KIND_CARRY_FORWARD, 'Carry Forward'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_balance_entries'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='balance_entries'
    )
    year = models.PositiveIntegerField(db_index=True)
    amount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Positive for credits (allocations/refunds), negative for debits (used)."
    )
    kind = models.CharField(max_length=30, choices=KIND_CHOICES)
    ref = models.CharField(max_length=100, blank=True, default='', help_text="e.g. LeaveRequest #12")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Leave Balance Entry'
        verbose_name_plural = 'Leave Balance Entries'
        indexes = [
            models.Index(fields=['employee', 'leave_type', 'year']),
        ]

    def __str__(self):
        return f"{self.employee.name} - {self.leave_type.code} ({self.year}): {self.amount} [{self.kind}]"


class HRSetting(models.Model):
    """
    Hierarchical 3-tier configuration model:
    Global default (store=null, employee=null) -> Store -> Employee override.
    """
    LEVEL_GLOBAL = 'global'
    LEVEL_STORE = 'store'
    LEVEL_EMPLOYEE = 'employee'
    LEVEL_CHOICES = [
        (LEVEL_GLOBAL, 'Global'),
        (LEVEL_STORE, 'Store'),
        (LEVEL_EMPLOYEE, 'Employee'),
    ]

    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_STORE)
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='hr_settings'
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='hr_settings'
    )
    key = models.CharField(max_length=100, db_index=True)
    value = models.JSONField(default=dict)

    class Meta:
        unique_together = ('level', 'store', 'employee', 'key')
        verbose_name = 'HR Setting'
        verbose_name_plural = 'HR Settings'

    def __str__(self):
        scope = f"Employee {self.employee_id}" if self.employee_id else (f"Store {self.store_id}" if self.store_id else "Global")
        return f"{self.key} [{scope}]"


class AttendanceAuditLog(models.Model):
    """
    Immutable audit record for all manual attendance corrections, punch voiding,
    status overrides, settings updates, and leave approvals.
    """
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=50)
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    reason = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Attendance Audit Log'
        verbose_name_plural = 'Attendance Audit Logs'
        indexes = [
            models.Index(fields=['target_type', 'target_id', 'created_at']),
        ]

    def __str__(self):
        actor_name = self.actor.name if self.actor else 'System'
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.action} by {actor_name}: {self.reason[:40]}"

    def save(self, *args, **kwargs):
        if self.pk and not kwargs.get('force_insert', False):
            if AttendanceAuditLog.objects.filter(pk=self.pk).exists():
                raise PermissionError("AttendanceAuditLog is strictly append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AttendanceAuditLog is strictly append-only and cannot be deleted.")


# ============================================================================
# STAGE 2: SALARY, PAYROLL, EMPLOYEE LEDGER & FINANCE INTEGRATION
# ============================================================================


class SalaryStructure(models.Model):
    """
    Effective-dated compensation structure for an employee.
    Supports MONTHLY and DAILY modes. Overlapping active dates are prohibited.
    """
    MODE_MONTHLY = 'MONTHLY'
    MODE_DAILY = 'DAILY'
    MODE_CHOICES = [
        (MODE_MONTHLY, 'Monthly Salary'),
        (MODE_DAILY, 'Daily Wage'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='salary_structures'
    )
    mode = models.CharField(
        max_length=20,
        choices=MODE_CHOICES,
        default=MODE_MONTHLY,
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Monthly salary or Daily wage rate in ₹."
    )
    overtime_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Hourly overtime compensation rate in ₹ (null = calculate from base / multiplier)."
    )
    from_date = models.DateField(
        db_index=True,
        help_text="Effective start date (inclusive)."
    )
    to_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Effective end date (null = indefinitely active)."
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-from_date']
        verbose_name = 'Salary Structure'
        verbose_name_plural = 'Salary Structures'
        indexes = [
            models.Index(fields=['employee', 'from_date']),
        ]

    def __str__(self):
        end_str = self.to_date.strftime('%Y-%m-%d') if self.to_date else 'Present'
        return f"{self.employee.name}: {self.mode} ₹{self.amount} ({self.from_date} to {end_str})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.to_date and self.from_date > self.to_date:
            raise ValidationError("from_date cannot be later than to_date.")

        # Check overlapping ranges for the same employee
        qs = SalaryStructure.objects.filter(employee=self.employee).exclude(pk=self.pk)
        for other in qs:
            other_end = other.to_date or date(9999, 12, 31)
            this_end = self.to_date or date(9999, 12, 31)
            if not (this_end < other.from_date or self.from_date > other_end):
                raise ValidationError(f"Salary structure date range overlaps with existing structure ({other.from_date} to {other.to_date or 'Present'}).")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class PayrollRun(models.Model):
    """
    Monthly payroll run per physical store location.
    Unique per store, year, and month.
    """
    STATUS_DRAFT = 'draft'
    STATUS_FINALIZED = 'finalized'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_FINALIZED, 'Finalized'),
    ]

    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='payroll_runs'
    )
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True
    )
    generated_at = models.DateTimeField(auto_now=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finalized_payrolls'
    )
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reopened_payrolls'
    )
    reopen_reason = models.TextField(blank=True, default='')
    rules_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-year', '-month']
        verbose_name = 'Payroll Run'
        verbose_name_plural = 'Payroll Runs'
        unique_together = ('store', 'year', 'month')

    def __str__(self):
        return f"Payroll {self.store.name} - {self.year}-{self.month:02d} [{self.status.upper()}]"


class SalaryStatement(models.Model):
    """
    Calculated monthly salary statement for an employee within a PayrollRun.
    """
    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='statements'
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name='salary_statements'
    )
    mode = models.CharField(max_length=20, default='MONTHLY')
    gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_additions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    days_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of days: present, half, absent, paid_leave, unpaid_leave, offs, holidays, late_count."
    )
    rules_snapshot = models.JSONField(default=dict, blank=True)
    is_included = models.BooleanField(
        default=True,
        help_text="Flag whether this employee is included in final payout disbursement."
    )
    exclusion_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee__employee_code']
        verbose_name = 'Salary Statement'
        verbose_name_plural = 'Salary Statements'
        unique_together = ('payroll_run', 'employee')

    def __str__(self):
        return f"{self.employee.name} ({self.payroll_run}): Net ₹{self.net}"


class SalaryLine(models.Model):
    """
    Itemized salary calculation line (earnings, deductions, additions).
    Every number on the payslip must be explainable from its lines.
    """
    TYPE_EARNING = 'earning'
    TYPE_DEDUCTION = 'deduction'
    TYPE_ADDITION = 'addition'
    TYPE_CHOICES = [
        (TYPE_EARNING, 'Earning'),
        (TYPE_DEDUCTION, 'Deduction'),
        (TYPE_ADDITION, 'Addition'),
    ]

    statement = models.ForeignKey(
        SalaryStatement,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    line_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    code = models.CharField(max_length=50)
    label = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1.00'))
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    formula_text = models.TextField(blank=True, default='')
    source_ref = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        ordering = ['id']
        verbose_name = 'Salary Line'
        verbose_name_plural = 'Salary Lines'

    def __str__(self):
        return f"[{self.get_line_type_display()}] {self.label}: ₹{self.amount} ({self.formula_text})"


class PayrollAdjustment(models.Model):
    """
    Manual one-off adjustments (bonuses, fines, incentives) for an employee in a specific month.
    Editable while payroll run is draft; converted to SalaryLines upon generation.
    """
    TYPE_BONUS = 'bonus'
    TYPE_FINE = 'fine'
    TYPE_INCENTIVE = 'incentive'
    TYPE_ADVANCE_RECOVERY = 'advance_recovery'
    TYPE_OTHER = 'other'
    TYPE_CHOICES = [
        (TYPE_BONUS, 'Bonus'),
        (TYPE_FINE, 'Fine / Penalty'),
        (TYPE_INCENTIVE, 'Incentive'),
        (TYPE_ADVANCE_RECOVERY, 'Advance Recovery'),
        (TYPE_OTHER, 'Other Adjustment'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payroll_adjustments'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='payroll_adjustments'
    )
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)
    adjustment_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default=TYPE_BONUS
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    label = models.CharField(max_length=255)
    note = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Payroll Adjustment'
        verbose_name_plural = 'Payroll Adjustments'

    def __str__(self):
        return f"{self.employee.name} ({self.year}-{self.month:02d}): {self.get_adjustment_type_display()} ₹{self.amount}"


class EmployeeLedgerEntry(models.Model):
    """
    APPEND-ONLY financial ledger for employee payables and receivables.
    Sign convention:
      - Positive (+) = Store owes employee (SALARY_ACCRUAL, BONUS)
      - Negative (-) = Employee owes store (PAYOUT, ADVANCE, FINE)
    Editing is forbidden; corrections are made via atomic REVERSAL + replacement entry.
    """
    ENTRY_OPENING_BALANCE = 'OPENING_BALANCE'
    ENTRY_SALARY_ACCRUAL = 'SALARY_ACCRUAL'
    ENTRY_INTERIM_WAGE_CREDIT = 'INTERIM_WAGE_CREDIT'
    ENTRY_PAYOUT = 'PAYOUT'
    ENTRY_ADVANCE = 'ADVANCE'
    ENTRY_BONUS = 'BONUS'
    ENTRY_FINE = 'FINE'
    ENTRY_ADJUSTMENT = 'ADJUSTMENT'
    ENTRY_REVERSAL = 'REVERSAL'
    ENTRY_TYPE_CHOICES = [
        (ENTRY_OPENING_BALANCE, 'Opening Balance'),
        (ENTRY_SALARY_ACCRUAL, 'Salary Accrual (Month-End Full Run)'),
        (ENTRY_INTERIM_WAGE_CREDIT, 'Interim Wage Credit (Partial Settlement)'),
        (ENTRY_PAYOUT, 'Salary Payout (Cash/UPI Disbursement)'),
        (ENTRY_ADVANCE, 'Advance Paid'),
        (ENTRY_BONUS, 'Bonus'),
        (ENTRY_FINE, 'Fine'),
        (ENTRY_ADJUSTMENT, 'Adjustment'),
        (ENTRY_REVERSAL, 'Reversal'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name='ledger_entries'
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='employee_ledger_entries'
    )
    entry_date = models.DateField(default=timezone.now, db_index=True)
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPE_CHOICES, db_index=True)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Signed: positive = store owes staff; negative = staff owes store."
    )
    payment_method = models.CharField(max_length=30, blank=True, default='cash')
    reference_no = models.CharField(max_length=100, blank=True, default='')
    note = models.TextField(blank=True, default='')
    related_statement = models.ForeignKey(
        SalaryStatement,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ledger_entries'
    )
    reversed_entry = models.OneToOneField(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reversal_entry'
    )
    counter_payout = models.ForeignKey(
        'inventory.CounterPayout',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ledger_entries',
        help_text="Links this ledger entry to a cash drawer payout when wages were paid in cash from a register."
    )
    created_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['entry_date', 'id']
        verbose_name = 'Employee Ledger Entry'
        verbose_name_plural = 'Employee Ledger Entries'
        indexes = [
            models.Index(fields=['employee', 'entry_date']),
            models.Index(fields=['store', 'entry_date']),
        ]

    def __str__(self):
        return f"{self.employee.name} | {self.entry_date} | {self.entry_type}: ₹{self.amount}"

    def save(self, *args, **kwargs):
        # Strict append-only enforcement: existing entries cannot be modified!
        if self.pk and not kwargs.get('force_insert', False):
            # Check if pk already exists in DB
            if EmployeeLedgerEntry.objects.filter(pk=self.pk).exists():
                raise PermissionError("EmployeeLedgerEntry is append-only and cannot be updated. Use reverse_entry() or correct_entry().")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("EmployeeLedgerEntry is append-only and cannot be deleted. Use reverse_entry() or correct_entry().")


class FinanceEvent(models.Model):
    """
    Outbox event record for financial synchronization with accounting / external GL.
    """
    EVENT_SALARY_ACCRUED = 'salary_expense_accrued'
    EVENT_PAYOUT_RECORDED = 'salary_payout_recorded'
    EVENT_ADVANCE_RECORDED = 'advance_recorded'
    EVENT_SALARY_REVERSED = 'salary_reversed'
    EVENT_CHOICES = [
        (EVENT_SALARY_ACCRUED, 'Salary Expense Accrued'),
        (EVENT_PAYOUT_RECORDED, 'Salary Payout Recorded'),
        (EVENT_ADVANCE_RECORDED, 'Advance Recorded'),
        (EVENT_SALARY_REVERSED, 'Salary Reversed'),
    ]

    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES, db_index=True)
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.PROTECT,
        related_name='finance_events'
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finance_events'
    )
    year = models.PositiveIntegerField(null=True, blank=True)
    month = models.PositiveSmallIntegerField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    source_ref = models.CharField(max_length=100, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('consumed', 'Consumed')],
        default='consumed'
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Finance Event'
        verbose_name_plural = 'Finance Events'

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.event_type} - ₹{self.amount} ({self.store.name})"


# ============================================================================
# PHASE 1: EMPLOYEE PORTAL — PASSWORD RESET REQUEST QUEUE
# ============================================================================


class StaffPasswordResetRequest(models.Model):
    """
    Password reset request raised by a staff member (employee).
    Only the admin/owner can fulfil (change) the password manually.
    Employees cannot change their own password – they can only raise a request here.
    """
    STATUS_PENDING = 'pending'
    STATUS_DONE = 'done'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_DONE, 'Done'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    staff_member = models.ForeignKey(
        StaffMember,
        on_delete=models.CASCADE,
        related_name='password_reset_requests',
        help_text="Staff member who raised the request."
    )
    reason = models.TextField(
        blank=True,
        default='',
        help_text="Optional reason / note from the employee."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    resolved_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_password_requests',
        help_text="Admin who resolved this request."
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    admin_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Staff Password Reset Request'
        verbose_name_plural = 'Staff Password Reset Requests'

    def __str__(self):
        return f"PWD Reset [{self.status}] — {self.staff_member.name} ({self.staff_member.staff_id}) @ {self.created_at.strftime('%Y-%m-%d %H:%M')}"


# ============================================================================
# PHASE 2: EMPLOYEE TASK ASSIGNMENT & PHOTO PROOF VERIFICATION ENGINE
# ============================================================================


class EmployeeTask(models.Model):
    """
    Task assigned to a staff member by an owner/manager with a required deadline.
    Completion requires mandatory visual photographic proof (photo_proof)
    and mandatory resolution write-off notes before owner verification.
    """
    STATUS_PENDING = 'pending'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_SUBMITTED = 'submitted'
    STATUS_VERIFIED = 'verified'
    STATUS_REVISION_NEEDED = 'revision_needed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_SUBMITTED, 'Submitted for Verification'),
        (STATUS_VERIFIED, 'Verified & Closed'),
        (STATUS_REVISION_NEEDED, 'Revision Needed'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_NORMAL = 'normal'
    PRIORITY_HIGH = 'high'
    PRIORITY_URGENT = 'urgent'
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_URGENT, 'Urgent'),
    ]

    assigned_to = models.ForeignKey(
        StaffMember,
        on_delete=models.CASCADE,
        related_name='assigned_tasks',
        help_text="Staff member assigned to complete this task."
    )
    created_by = models.ForeignKey(
        StaffMember,
        on_delete=models.CASCADE,
        related_name='created_tasks',
        help_text="Admin / Owner who created and assigned the task."
    )
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.CASCADE,
        related_name='employee_tasks',
        help_text="Store location for this task."
    )
    section = models.ForeignKey(
        'inventory.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_tasks',
        help_text="Optional section department bound to this task."
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    deadline = models.DateTimeField(help_text="Target completion deadline.")
    status = models.CharField(
        max_length=25,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_NORMAL,
        db_index=True
    )
    proof_image = models.ImageField(
        upload_to='task_proofs/',
        null=True,
        blank=True,
        help_text="Mandatory photographic proof of completed task."
    )
    write_off_notes = models.TextField(
        blank=True,
        default='',
        help_text="Mandatory notes provided by employee upon submitting proof."
    )
    revision_notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes/feedback provided by admin if revision is requested."
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        StaffMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_tasks',
        help_text="Admin who approved/verified this task."
    )
    is_on_time = models.BooleanField(
        default=True,
        help_text="Whether submission was on or before the deadline."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['deadline', '-priority', '-created_at']
        verbose_name = 'Employee Task'
        verbose_name_plural = 'Employee Tasks'

    def __str__(self):
        return f"Task [{self.status}] {self.title} -> {self.assigned_to.name} (Deadline: {self.deadline.strftime('%Y-%m-%d %H:%M')})"

