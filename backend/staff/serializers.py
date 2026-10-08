import zoneinfo
from rest_framework import serializers
from inventory.serializers import StoreSerializer, SectionSerializer
from inventory.models import Store, Section
from .models import (
    StaffRole, StaffMember, ALL_MODULE_KEYS,
    Employee, EmployeeStoreAssignment, RFIDCard, KioskDevice,
    Shift, EmployeeShiftAssignment, Punch, UnknownTap,
    AttendanceDay, AttendanceSession, Holiday,
    LeaveType, LeaveRequest, LeaveBalanceEntry,
    HRSetting, AttendanceAuditLog,
    SalaryStructure, PayrollRun, SalaryStatement, SalaryLine,
    PayrollAdjustment, EmployeeLedgerEntry, FinanceEvent,
    StaffPasswordResetRequest, EmployeeTask
)


class StaffRoleSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    is_head_cashier = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffRole
        fields = [
            'id',
            'name',
            'description',
            'is_owner',
            'allowed_modules',
            'can_access_inventory',
            'can_adjust_stock',
            'can_access_billing',
            'can_access_staff',
            'cashier_role',
            'is_head_cashier',
            'inventory_scope',
            'member_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'member_count', 'is_head_cashier', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.members.count()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.is_owner:
            ret['allowed_modules'] = list(ALL_MODULE_KEYS)
            ret['cashier_role'] = 'head_cashier'
            ret['inventory_scope'] = 'full'
        elif not ret.get('allowed_modules'):
            # Fall back to legacy boolean flags if allowed_modules wasn't populated
            legacy = []
            if instance.can_access_inventory:
                legacy.append('inventory')
            if instance.can_access_billing:
                legacy.append('billing')
            if instance.can_access_staff:
                legacy.append('staff')
            ret['allowed_modules'] = legacy
        return ret

    def create(self, validated_data):
        allowed_modules = validated_data.get('allowed_modules', [])
        validated_data['can_access_inventory'] = 'inventory' in allowed_modules
        validated_data['can_access_billing'] = 'billing' in allowed_modules
        validated_data['can_access_staff'] = 'staff' in allowed_modules
        if not validated_data.get('can_access_billing'):
            validated_data['cashier_role'] = 'cashier'
        if not ('inventory' in allowed_modules):
            validated_data['inventory_scope'] = 'full'
        return super().create(validated_data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        if request and self.instance:
            from staff.services.auth import get_current_staff
            staff = get_current_staff(request)
            # A user cannot edit their own role or store or is_active (anti privilege escalation)
            if staff and staff.id == self.instance.id:
                if 'role' in attrs and attrs['role'] != self.instance.role:
                    raise serializers.ValidationError({'role': 'You cannot change your own role.'})
                if 'store' in attrs and attrs['store'] != self.instance.store:
                    raise serializers.ValidationError({'store': 'You cannot change your own store location.'})
                if 'is_active' in attrs and attrs['is_active'] != self.instance.is_active:
                    raise serializers.ValidationError({'is_active': 'You cannot deactivate your own account.'})
        return attrs

    def update(self, instance, validated_data):
        if 'allowed_modules' in validated_data:
            allowed = validated_data['allowed_modules']
            validated_data['can_access_inventory'] = 'inventory' in allowed
            validated_data['can_access_billing'] = 'billing' in allowed
            validated_data['can_access_staff'] = 'staff' in allowed
            if not ('billing' in allowed):
                validated_data['cashier_role'] = 'cashier'
            if not ('inventory' in allowed):
                validated_data['inventory_scope'] = 'full'
        return super().update(instance, validated_data)


class StaffMemberSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        if request and self.instance:
            from staff.services.auth import get_current_staff
            staff = get_current_staff(request)
            if staff and staff.id == self.instance.id:
                if 'role' in attrs and attrs['role'] != self.instance.role:
                    raise serializers.ValidationError({'role': 'You cannot change your own role.'})
                if 'store' in attrs and attrs['store'] != self.instance.store:
                    raise serializers.ValidationError({'store': 'You cannot change your own store location.'})
                if 'is_active' in attrs and attrs['is_active'] != self.instance.is_active:
                    raise serializers.ValidationError({'is_active': 'You cannot deactivate your own account.'})
        return attrs
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={'input_type': 'password'},
        help_text="Provide password to set or reset."
    )
    role_details = StaffRoleSerializer(source='role', read_only=True)
    role = serializers.PrimaryKeyRelatedField(queryset=StaffRole.objects.all())
    store_details = StoreSerializer(source='store', read_only=True)
    store = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.all(),
        required=False,
        allow_null=True
    )
    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True,
        help_text="Assigned store section or department (optional, at most 1 section)."
    )
    section_details = SectionSerializer(source='section', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    section_color = serializers.CharField(source='section.color', read_only=True, allow_null=True)
    section_code = serializers.CharField(source='section.code', read_only=True, allow_null=True)
    phone = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Contact phone number."
    )
    photo = serializers.ImageField(
        required=False,
        allow_null=True,
        help_text="Staff profile photograph."
    )
    join_date = serializers.DateField(
        required=False,
        allow_null=True,
        help_text="Date the staff member officially joined the organization."
    )
    is_owner = serializers.BooleanField(read_only=True)
    is_head_cashier = serializers.BooleanField(read_only=True)
    cashier_role = serializers.CharField(read_only=True)
    effective_inventory_scope = serializers.CharField(read_only=True)
    is_section_restricted = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffMember
        fields = [
            'id',
            'staff_id',
            'name',
            'password',
            'role',
            'role_details',
            'store',
            'store_details',
            'section',
            'section_name',
            'section_color',
            'section_code',
            'section_details',
            'phone',
            'photo',
            'join_date',
            'inventory_scope',
            'effective_inventory_scope',
            'is_section_restricted',
            'is_active',
            'is_owner',
            'is_head_cashier',
            'cashier_role',
            'session_token',
            'last_login',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'is_owner',
            'is_head_cashier',
            'cashier_role',
            'effective_inventory_scope',
            'is_section_restricted',
            'section_name',
            'section_color',
            'section_code',
            'section_details',
            'session_token',
            'last_login',
            'created_at',
            'updated_at',
        ]

    def validate_phone(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Contact phone number cannot be blank.")
        val_str = str(value).strip()
        import re
        if re.search(r'[a-zA-Z]', val_str):
            raise serializers.ValidationError("Phone number cannot contain letters or alphabetic characters.")
        digits = re.sub(r'\D', '', val_str)
        if len(digits) < 10 or len(digits) > 15:
            raise serializers.ValidationError("Phone number must contain between 10 and 15 digits.")
        if len(digits) == 10:
            return f"+91 {digits[:5]} {digits[5:]}"
        elif len(digits) == 12 and digits.startswith('91'):
            return f"+91 {digits[2:7]} {digits[7:]}"
        elif val_str.startswith('+'):
            return f"+{digits}"
        return val_str

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        if 'section' in data:
            val = data.get('section')
            if val == '' or val == '0' or val == 0 or val == 'none' or val == 'null':
                data['section'] = None
        if 'photo' in data:
            val = data.get('photo')
            if val == '' or val == 'none' or val == 'null' or val is False:
                data['photo'] = None
        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Fallback to linked Employee profile for photo/phone/join_date if not set directly on StaffMember
        if not ret.get('photo') and hasattr(instance, 'employee_profile') and instance.employee_profile and instance.employee_profile.photo:
            try:
                ret['photo'] = instance.employee_profile.photo.url
            except Exception:
                pass
        if not ret.get('phone') and hasattr(instance, 'employee_profile') and instance.employee_profile and instance.employee_profile.phone:
            ret['phone'] = instance.employee_profile.phone
        if hasattr(instance, 'employee_profile') and instance.employee_profile and instance.employee_profile.join_date:
            ret['join_date'] = instance.employee_profile.join_date.isoformat()
        elif instance.created_at:
            ret['join_date'] = instance.created_at.date().isoformat()
        return ret

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        join_date = validated_data.pop('join_date', None)
        if not password:
            raise serializers.ValidationError({'password': 'Password is required for new staff.'})

        photo = validated_data.get('photo')
        if photo and hasattr(photo, 'file'):
            from inventory.services import convert_image_to_webp
            try:
                validated_data['photo'] = convert_image_to_webp(photo)
            except Exception:
                pass

        member = StaffMember(**validated_data)
        member.set_password(password)
        member.save()
        if join_date is not None:
            member._temp_join_date = join_date
        return member

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        join_date = validated_data.pop('join_date', None)
        if join_date is not None:
            instance._temp_join_date = join_date
        if 'photo' in validated_data and validated_data['photo'] is None:
            if instance.photo:
                try:
                    instance.photo.delete(save=False)
                except Exception:
                    pass
            instance.photo = None
        else:
            photo = validated_data.get('photo')
            if photo and hasattr(photo, 'file'):
                from inventory.services import convert_image_to_webp
                if instance.photo:
                    try:
                        instance.photo.delete(save=False)
                    except Exception:
                        pass
                try:
                    validated_data['photo'] = convert_image_to_webp(photo)
                except Exception:
                    pass

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password and str(password).strip():
            instance.set_password(str(password).strip())
        instance.save()
        return instance


class StaffLoginSerializer(serializers.Serializer):
    staff_id = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    store_id = serializers.IntegerField(required=False, allow_null=True)


# ============================================================================
# STAGE 1: HR & ATTENDANCE SERIALIZERS
# ============================================================================


class RFIDCardSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)

    class Meta:
        model = RFIDCard
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'card_uid',
            'status',
            'assigned_at',
            'deactivated_at',
            'reason',
        ]
        read_only_fields = ['id', 'assigned_at', 'deactivated_at']


class ShiftSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    start_time_12h = serializers.SerializerMethodField()
    end_time_12h = serializers.SerializerMethodField()
    time_range_12h = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            'id',
            'store',
            'store_name',
            'name',
            'start_time',
            'end_time',
            'start_time_12h',
            'end_time_12h',
            'time_range_12h',
            'is_overnight',
            'grace_late_minutes',
            'grace_early_leave_minutes',
            'min_minutes_full_day',
            'min_minutes_half_day',
            'break_allowance_minutes',
            'is_default_for_store',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_start_time_12h(self, obj):
        if obj.start_time:
            return obj.start_time.strftime('%I:%M %p')
        return None

    def get_end_time_12h(self, obj):
        if obj.end_time:
            return obj.end_time.strftime('%I:%M %p')
        return None

    def get_time_range_12h(self, obj):
        s = self.get_start_time_12h(obj)
        e = self.get_end_time_12h(obj)
        if s and e:
            return f"{s} - {e}"
        return ""


class EmployeeShiftAssignmentSerializer(serializers.ModelSerializer):
    shift_name = serializers.CharField(source='shift.name', read_only=True)

    class Meta:
        model = EmployeeShiftAssignment
        fields = [
            'id',
            'employee',
            'shift',
            'shift_name',
            'weekly_off_days',
            'from_date',
            'to_date',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class EmployeeStoreAssignmentSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = EmployeeStoreAssignment
        fields = [
            'id',
            'employee',
            'store',
            'store_name',
            'from_date',
            'to_date',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class EmployeeSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    phone = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Contact phone number."
    )
    photo = serializers.ImageField(
        required=False,
        allow_null=True,
        help_text="Employee profile photograph."
    )
    active_card_uid = serializers.SerializerMethodField()
    active_shift = serializers.SerializerMethodField()
    weekly_off_days = serializers.SerializerMethodField()
    # Expose role & section from the linked StaffMember (Staff & Roles system)
    # These are the authoritative values; designation/department are supplementary free-text.
    role_name = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id',
            'store',
            'store_name',
            'employee_code',
            'name',
            'phone',
            'photo',
            'join_date',
            'exit_date',
            'department',
            'designation',
            'is_active',
            'notes',
            'active_card_uid',
            'active_shift',
            'weekly_off_days',
            'role_name',
            'section',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_active_card_uid(self, obj):
        card = obj.rfid_cards.filter(status=RFIDCard.STATUS_ACTIVE).first()
        return card.card_uid if card else None

    def get_active_shift(self, obj):
        from .services.punch import get_effective_shift
        from datetime import date
        shift = get_effective_shift(obj, date.today())
        if shift:
            start_12h = shift.start_time.strftime('%I:%M %p')
            end_12h = shift.end_time.strftime('%I:%M %p')
            return {
                'id': shift.id,
                'name': shift.name,
                'shift_name': shift.name,
                'start_time': start_12h,
                'end_time': end_12h,
                'start_time_24': shift.start_time.strftime('%H:%M'),
                'end_time_24': shift.end_time.strftime('%H:%M'),
                'time_range': f"{start_12h} - {end_12h}",
            }
        return None

    def get_weekly_off_days(self, obj):
        from datetime import date
        from .services.settings import get_setting
        from .services.punch import models_q_to_date
        today = date.today()
        assignment = obj.shift_assignments.filter(
            from_date__lte=today
        ).filter(
            models_q_to_date(today)
        ).order_by('-from_date').first()
        if assignment and assignment.weekly_off_days is not None:
            return assignment.weekly_off_days
        return get_setting('default_weekly_off_days', obj, default=[6])

    def get_role_name(self, obj):
        """Returns the role name from the linked StaffMember (Staff & Roles), or None."""
        if obj.staff_member and obj.staff_member.role:
            return obj.staff_member.role.name
        return None

    def get_section(self, obj):
        """Returns the section/department from the linked StaffMember (Staff & Roles), or None."""
        if obj.staff_member and obj.staff_member.section:
            return obj.staff_member.section.name
        return obj.department or None

    def create(self, validated_data):
        photo = validated_data.get('photo')
        if photo and hasattr(photo, 'file'):
            from inventory.services import convert_image_to_webp
            try:
                validated_data['photo'] = convert_image_to_webp(photo)
            except Exception:
                pass
        return super().create(validated_data)

    def update(self, instance, validated_data):
        photo = validated_data.get('photo')
        if photo and hasattr(photo, 'file'):
            from inventory.services import convert_image_to_webp
            if instance.photo:
                try:
                    instance.photo.delete(save=False)
                except Exception:
                    pass
            try:
                validated_data['photo'] = convert_image_to_webp(photo)
            except Exception:
                pass
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if not ret.get('photo') and instance.staff_member and instance.staff_member.photo:
            try:
                ret['photo'] = instance.staff_member.photo.url
            except Exception:
                pass
        if not ret.get('phone') and instance.staff_member and instance.staff_member.phone:
            ret['phone'] = instance.staff_member.phone
        return ret




class KioskDeviceSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    raw_token = serializers.CharField(read_only=True)

    class Meta:
        model = KioskDevice
        fields = [
            'id',
            'store',
            'store_name',
            'name',
            'is_active',
            'last_seen_at',
            'created_at',
            'raw_token',
        ]
        read_only_fields = ['id', 'last_seen_at', 'created_at', 'raw_token']


class PunchSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    device_name = serializers.CharField(source='device.name', read_only=True)
    voided_by_name = serializers.CharField(source='voided_by.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Punch
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'store',
            'store_name',
            'device',
            'device_name',
            'card_uid_snapshot',
            'punched_at',
            'source',
            'is_void',
            'void_reason',
            'voided_by_name',
            'created_by_name',
            'note',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class UnknownTapSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = UnknownTap
        fields = [
            'id',
            'card_uid',
            'device',
            'device_name',
            'store',
            'store_name',
            'reason',
            'at',
        ]
        read_only_fields = ['id', 'at']


class AttendanceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceSession
        fields = ['id', 'in_at', 'out_at', 'duration_minutes']


class AttendanceDaySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    phone = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    override_by_name = serializers.CharField(source='override_by.name', read_only=True)
    sessions = AttendanceSessionSerializer(many=True, read_only=True)
    role_name = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    first_in_time = serializers.SerializerMethodField()
    last_out_time = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceDay
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'phone',
            'role_name',
            'section',
            'department',
            'photo_url',
            'store',
            'store_name',
            'business_date',
            'shift_snapshot',
            'first_in',
            'last_out',
            'first_in_time',
            'last_out_time',
            'worked_minutes',
            'break_minutes',
            'late_minutes',
            'early_leave_minutes',
            'overtime_minutes',
            'status',
            'flags',
            'day_fraction_paid',
            'late_penalty',
            'override_status',
            'override_by_name',
            'override_reason',
            'is_locked',
            'sessions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_first_in_time(self, obj):
        if not obj.first_in:
            return None
        tz_str = (obj.store.timezone if obj.store and obj.store.timezone else None) or 'Asia/Kolkata'
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
            return obj.first_in.astimezone(tz).strftime('%H:%M')
        except Exception:
            return obj.first_in.strftime('%H:%M')

    def get_last_out_time(self, obj):
        if not obj.last_out:
            return None
        tz_str = (obj.store.timezone if obj.store and obj.store.timezone else None) or 'Asia/Kolkata'
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
            return obj.last_out.astimezone(tz).strftime('%H:%M')
        except Exception:
            return obj.last_out.strftime('%H:%M')

    def get_role_name(self, obj):
        if obj.employee and obj.employee.staff_member and obj.employee.staff_member.role:
            return obj.employee.staff_member.role.name
        return None

    def get_section(self, obj):
        if obj.employee and obj.employee.staff_member and obj.employee.staff_member.section:
            return obj.employee.staff_member.section.name
        return None

    def get_phone(self, obj):
        if obj.employee:
            if obj.employee.phone:
                return obj.employee.phone
            if obj.employee.staff_member and obj.employee.staff_member.phone:
                return obj.employee.staff_member.phone
        return ""

    def get_photo_url(self, obj):
        if obj.employee:
            if obj.employee.photo:
                try:
                    return obj.employee.photo.url
                except Exception:
                    pass
            if obj.employee.staff_member and obj.employee.staff_member.photo:
                try:
                    return obj.employee.staff_member.photo.url
                except Exception:
                    pass
        return None


class HolidaySerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = Holiday
        fields = ['id', 'store', 'store_name', 'date', 'name', 'is_paid']


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = [
            'id',
            'name',
            'code',
            'is_paid',
            'annual_quota_days',
            'allows_half_day',
            'carry_forward',
            'allow_negative_balance',
        ]


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'leave_type',
            'leave_type_name',
            'leave_type_code',
            'from_date',
            'to_date',
            'half_day',
            'half_day_period',
            'days_count',
            'status',
            'reason',
            'decided_by_name',
            'decision_notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'days_count', 'status', 'decided_by_name', 'created_at', 'updated_at']


class LeaveBalanceEntrySerializer(serializers.ModelSerializer):
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)

    class Meta:
        model = LeaveBalanceEntry
        fields = [
            'id',
            'employee',
            'leave_type',
            'leave_type_code',
            'year',
            'amount',
            'kind',
            'ref',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class HRSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = HRSetting
        fields = ['id', 'level', 'store', 'employee', 'key', 'value']


class AttendanceAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True)

    class Meta:
        model = AttendanceAuditLog
        fields = [
            'id',
            'action',
            'actor_name',
            'target_type',
            'target_id',
            'before_state',
            'after_state',
            'reason',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SalaryStructureSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)

    class Meta:
        model = SalaryStructure
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'mode',
            'amount',
            'overtime_rate',
            'from_date',
            'to_date',
            'note',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        from_date = attrs.get('from_date') or (self.instance.from_date if self.instance else None)
        to_date = attrs.get('to_date') if 'to_date' in attrs else (self.instance.to_date if self.instance else None)
        if from_date and to_date and from_date > to_date:
            raise serializers.ValidationError({"to_date": "Effective end date cannot be earlier than start date."})
        return attrs


class SalaryLineSerializer(serializers.ModelSerializer):
    line_type_display = serializers.CharField(source='get_line_type_display', read_only=True)

    class Meta:
        model = SalaryLine
        fields = [
            'id',
            'statement',
            'line_type',
            'line_type_display',
            'code',
            'label',
            'quantity',
            'rate',
            'amount',
            'formula_text',
            'source_ref',
        ]
        read_only_fields = ['id']


class SalaryStatementSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    designation = serializers.CharField(source='employee.designation', read_only=True)
    role_name = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    lines = SalaryLineSerializer(many=True, read_only=True)

    class Meta:
        model = SalaryStatement
        fields = [
            'id',
            'payroll_run',
            'employee',
            'employee_name',
            'employee_code',
            'role_name',
            'section',
            'department',
            'designation',
            'mode',
            'gross',
            'total_deductions',
            'total_additions',
            'net',
            'days_summary',
            'rules_snapshot',
            'is_included',
            'exclusion_reason',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_role_name(self, obj):
        if obj.employee and obj.employee.staff_member and obj.employee.staff_member.role:
            return obj.employee.staff_member.role.name
        return None

    def get_section(self, obj):
        if obj.employee and obj.employee.staff_member and obj.employee.staff_member.section:
            return obj.employee.staff_member.section.name
        return None


class PayrollRunSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    finalized_by_name = serializers.CharField(source='finalized_by.name', read_only=True)
    reopened_by_name = serializers.CharField(source='reopened_by.name', read_only=True)
    statements_count = serializers.SerializerMethodField()
    total_gross = serializers.SerializerMethodField()
    total_net = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = [
            'id',
            'store',
            'store_name',
            'year',
            'month',
            'status',
            'generated_at',
            'finalized_at',
            'finalized_by_name',
            'reopened_at',
            'reopened_by_name',
            'reopen_reason',
            'rules_snapshot',
            'statements_count',
            'total_gross',
            'total_net',
        ]
        read_only_fields = ['id', 'generated_at', 'finalized_at', 'reopened_at']

    def get_statements_count(self, obj):
        return obj.statements.count()

    def get_total_gross(self, obj):
        from decimal import Decimal
        from django.db.models import Sum
        val = obj.statements.filter(is_included=True).aggregate(s=Sum('gross'))['s'] or Decimal('0.00')
        return str(val)

    def get_total_net(self, obj):
        from decimal import Decimal
        from django.db.models import Sum
        val = obj.statements.filter(is_included=True).aggregate(s=Sum('net'))['s'] or Decimal('0.00')
        return str(val)


class PayrollAdjustmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    adjustment_type_display = serializers.CharField(source='get_adjustment_type_display', read_only=True)

    class Meta:
        model = PayrollAdjustment
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'store',
            'year',
            'month',
            'adjustment_type',
            'adjustment_type_display',
            'amount',
            'label',
            'note',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class EmployeeLedgerEntrySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    is_reversed = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeLedgerEntry
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'store',
            'entry_date',
            'entry_type',
            'entry_type_display',
            'amount',
            'payment_method',
            'reference_no',
            'note',
            'related_statement',
            'reversed_entry',
            'is_reversed',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_is_reversed(self, obj):
        return hasattr(obj, 'reversal_entry') or EmployeeLedgerEntry.objects.filter(reversed_entry=obj).exists()


class FinanceEventSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = FinanceEvent
        fields = [
            'id',
            'event_type',
            'event_type_display',
            'store',
            'store_name',
            'employee',
            'employee_name',
            'year',
            'month',
            'amount',
            'source_ref',
            'status',
            'payload',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class StaffPasswordResetRequestSerializer(serializers.ModelSerializer):
    staff_member_name = serializers.CharField(source='staff_member.name', read_only=True)
    staff_member_id_str = serializers.CharField(source='staff_member.staff_id', read_only=True)
    staff_member_photo = serializers.SerializerMethodField()
    resolved_by_name = serializers.CharField(source='resolved_by.name', read_only=True, allow_null=True)

    class Meta:
        model = StaffPasswordResetRequest
        fields = [
            'id',
            'staff_member',
            'staff_member_name',
            'staff_member_id_str',
            'staff_member_photo',
            'reason',
            'status',
            'resolved_by',
            'resolved_by_name',
            'resolved_at',
            'admin_note',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'resolved_by', 'resolved_by_name', 'resolved_at', 'created_at', 'updated_at']

    def get_staff_member_photo(self, obj):
        request = self.context.get('request')
        if obj.staff_member.photo:
            url = obj.staff_member.photo.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class EmployeeTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)
    assigned_to_staff_id = serializers.CharField(source='assigned_to.staff_id', read_only=True)
    assigned_to_photo = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    section_color = serializers.CharField(source='section.color', read_only=True, allow_null=True)
    verified_by_name = serializers.CharField(source='verified_by.name', read_only=True, allow_null=True)
    is_overdue = serializers.SerializerMethodField()
    proof_image_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeTask
        fields = [
            'id',
            'assigned_to',
            'assigned_to_name',
            'assigned_to_staff_id',
            'assigned_to_photo',
            'created_by',
            'created_by_name',
            'store',
            'store_name',
            'section',
            'section_name',
            'section_color',
            'title',
            'description',
            'deadline',
            'status',
            'priority',
            'proof_image',
            'proof_image_url',
            'write_off_notes',
            'revision_notes',
            'submitted_at',
            'verified_at',
            'verified_by',
            'verified_by_name',
            'is_on_time',
            'is_overdue',
            'late_duration',
            'late_seconds',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_by_name',
            'submitted_at',
            'verified_at',
            'verified_by',
            'verified_by_name',
            'is_on_time',
            'is_overdue',
            'late_duration',
            'late_seconds',
            'created_at',
            'updated_at',
        ]

    late_duration = serializers.SerializerMethodField()
    late_seconds = serializers.SerializerMethodField()

    def get_late_seconds(self, obj):
        completion_time = obj.submitted_at or (obj.verified_at if obj.status == EmployeeTask.STATUS_VERIFIED else None)
        if not completion_time or not obj.deadline:
            return 0
        diff = (completion_time - obj.deadline).total_seconds()
        return max(0, int(diff))

    def get_late_duration(self, obj):
        seconds = self.get_late_seconds(obj)
        if seconds <= 0:
            return ""
        minutes = seconds // 60
        hours = minutes // 60
        days = hours // 24
        rem_hours = hours % 24
        rem_mins = minutes % 60

        if days > 0:
            return f"{days}d {rem_hours}h late" if rem_hours > 0 else f"{days}d late"
        if hours > 0:
            return f"{hours}h {rem_mins}m late" if rem_mins > 0 else f"{hours}h late"
        return f"{max(1, rem_mins)}m late"

    def get_assigned_to_photo(self, obj):
        request = self.context.get('request')
        if obj.assigned_to and obj.assigned_to.photo:
            try:
                url = obj.assigned_to.photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                pass
        return None

    def get_proof_image_url(self, obj):
        request = self.context.get('request')
        if obj.proof_image:
            try:
                url = obj.proof_image.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                pass
        return None

    def get_is_overdue(self, obj):
        if obj.status in [EmployeeTask.STATUS_SUBMITTED, EmployeeTask.STATUS_VERIFIED]:
            return False
        from django.utils import timezone
        return obj.deadline < timezone.now()

    def create(self, validated_data):
        proof = validated_data.get('proof_image')
        if proof and hasattr(proof, 'read'):
            try:
                from inventory.services import convert_image_to_webp
                validated_data['proof_image'] = convert_image_to_webp(proof)
            except Exception:
                pass
        return super().create(validated_data)

    def update(self, instance, validated_data):
        proof = validated_data.get('proof_image')
        if proof and hasattr(proof, 'read'):
            try:
                from inventory.services import convert_image_to_webp
                validated_data['proof_image'] = convert_image_to_webp(proof)
            except Exception:
                pass
        return super().update(instance, validated_data)


