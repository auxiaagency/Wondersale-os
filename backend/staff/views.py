from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, AuthenticationFailed
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from datetime import datetime, date, timedelta
import zoneinfo
import secrets


from .models import (
    StaffRole, StaffMember,
    Employee, EmployeeStoreAssignment, RFIDCard, KioskDevice,
    Shift, EmployeeShiftAssignment, Punch, UnknownTap,
    AttendanceDay, AttendanceSession, Holiday,
    LeaveType, LeaveRequest, LeaveBalanceEntry,
    HRSetting, AttendanceAuditLog,
    SalaryStructure, PayrollRun, SalaryStatement, SalaryLine,
    PayrollAdjustment, EmployeeLedgerEntry, FinanceEvent,
    EmployeeTask
)
from .serializers import (
    StaffRoleSerializer, StaffMemberSerializer, StaffLoginSerializer,
    EmployeeSerializer, RFIDCardSerializer, ShiftSerializer,
    EmployeeShiftAssignmentSerializer, EmployeeStoreAssignmentSerializer,
    KioskDeviceSerializer, PunchSerializer, UnknownTapSerializer,
    AttendanceDaySerializer, HolidaySerializer, LeaveTypeSerializer,
    LeaveRequestSerializer, LeaveBalanceEntrySerializer,
    HRSettingSerializer, AttendanceAuditLogSerializer,
    SalaryStructureSerializer, SalaryLineSerializer, SalaryStatementSerializer,
    PayrollRunSerializer, PayrollAdjustmentSerializer, EmployeeLedgerEntrySerializer,
    FinanceEventSerializer, EmployeeTaskSerializer
)
from .services.payroll import (
    calculate_employee_salary, generate_draft_payroll,
    finalize_payroll, reopen_payroll
)
from .services.settlement import (
    calculate_unfinalized_summary,
    get_overtime_pending_verification,
    bulk_verify_overtime,
    settle_interim_payroll,
)
from .services.ledger import (
    add_entry, reverse_entry, correct_entry,
    get_employee_balance, get_store_ledger_summary
)
from .services.finance import get_monthly_finance_summary
from .services.sync import sync_employees_from_staff_members, seed_demo_payroll_data
from .services import authenticate_staff, ensure_default_roles_and_owner
from .services.auth import get_current_staff
from .services.rate_limit import is_rate_limited, record_failed_attempt, clear_failed_attempts
from staff.models import AttendanceAuditLog
from .services.punch import process_tap, normalize_card_uid
from .services.attendance import (
    rebuild_day, override_day_status, clear_day_override,
    void_punch, add_manual_punch, record_manual_day_attendance,
    get_effective_shift
)
from .services.leave import (
    submit_leave_request, approve_leave_request, reject_leave_request,
    cancel_leave_request, get_leave_balance, run_year_end_carry_forward
)
from .services.settings import get_setting, get_all_settings, set_setting
from .services.recalculation import recalculate_attendance
from .services.stage2_interface import get_month_attendance, lock_month, unlock_month
from inventory.models import Store, DailyRegisterShift


class StaffAuthViewSet(viewsets.ViewSet):
    """Handles staff login, session validation (me), and logout."""
    authentication_classes = []

    @action(detail=False, methods=['post'], url_path='login')
    def login_action(self, request):
        # Guarantee initial roles and owner exist
        ensure_default_roles_and_owner()

        serializer = StaffLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        staff_id = serializer.validated_data['staff_id']
        password = serializer.validated_data['password']
        store_id = serializer.validated_data.get('store_id') or request.data.get('store_id') or request.data.get('store')

        # Progressive brute-force rate limit check
        is_locked, retry_after = is_rate_limited(request, staff_id)
        if is_locked:
            return Response(
                {'detail': f'Too many failed login attempts. Please try again in {retry_after} seconds.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        member = authenticate_staff(staff_id, password)
        if not member:
            record_failed_attempt(request, staff_id)
            AttendanceAuditLog.objects.create(
                action='login_failed',
                target_type='StaffMember',
                target_id=staff_id,
                reason=f'Failed login attempt from IP {request.META.get("REMOTE_ADDR")}'
            )
            return Response(
                {'detail': 'Invalid Staff ID or Password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Clear failed counts on successful authentication
        clear_failed_attempts(request, staff_id)
        AttendanceAuditLog.objects.create(
            action='login_success',
            actor=member,
            target_type='StaffMember',
            target_id=str(member.id),
            reason=f'Successful login from IP {request.META.get("REMOTE_ADDR")}'
        )

        # Enforce store assignment check:
        # If staff member is not an owner and has an assigned store, they can ONLY log into their assigned store!
        if not member.is_owner and member.store is not None:
            if store_id and str(member.store_id) != str(store_id):
                assigned_name = member.store.name
                assigned_pin = f" ({member.store.pincode})" if member.store.pincode else ""
                return Response(
                    {'detail': f'Access Denied: You are assigned to "{assigned_name}{assigned_pin}" and cannot log in to a different store location.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Store session
        if not member.session_token:
            member.rotate_session_token()
            member.save(update_fields=['session_token', 'updated_at'])

        request.session['staff_member_id'] = member.id
        request.session['staff_session_token'] = member.session_token
        if store_id:
            request.session['staff_store_id'] = int(store_id)
        elif member.store_id:
            request.session['staff_store_id'] = member.store_id
        request.session.modified = True

        data = StaffMemberSerializer(member).data
        return Response({
            'message': f'Welcome back, {member.name}!',
            'staff': data,
            'session_token': member.session_token,
        })

    @action(detail=False, methods=['get'], url_path='me')
    def me_action(self, request):
        # Ensure default owner setup
        ensure_default_roles_and_owner()

        member = get_current_staff(request)
        if not member:
            return Response(
                {'detail': 'Not authenticated.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response(StaffMemberSerializer(member).data)

    @action(detail=False, methods=['post'], url_path='logout')
    def logout_action(self, request):
        member = get_current_staff(request)
        if member:
            member.rotate_session_token()
            member.save(update_fields=['session_token', 'updated_at'])
            AttendanceAuditLog.objects.create(
                action='logout',
                actor=member,
                target_type='StaffMember',
                target_id=str(member.id),
                reason='User initiated logout'
            )
        request.session.flush()
        return Response({'message': 'Logged out successfully.'})


class OwnerOnlyMixin:
    """Restricts access exclusively to staff members with the Owner role."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # For safe Swagger / setup, ensure roles exist
        ensure_default_roles_and_owner()

        member = get_current_staff(request)
        if not member:
            raise AuthenticationFailed("Authentication required.")
        if not member.role.is_owner and not member.role.can_access_staff:
            raise PermissionDenied("Restricted area: Only the Store Owner can access this module.")


class StaffRoleViewSet(OwnerOnlyMixin, viewsets.ModelViewSet):
    """
    CRUD for Staff Roles / Categories.
    Accessible only by the Store Owner.
    """
    queryset = StaffRole.objects.all()
    serializer_class = StaffRoleSerializer


class StaffMemberViewSet(OwnerOnlyMixin, viewsets.ModelViewSet):
    """
    CRUD for Staff Members Directory.
    Accessible only by the Store Owner or authorized staff managers.
    """
    queryset = StaffMember.objects.select_related('role', 'store').all()
    serializer_class = StaffMemberSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        member = get_current_staff(self.request)
        # Non-owners only see staff members from their own store
        if member and not member.is_owner and member.store is not None:
            qs = qs.filter(store=member.store)
        return qs

    def perform_create(self, serializer):
        member = serializer.save()
        from .services.sync import sync_single_staff_member
        sync_single_staff_member(member)

    def perform_update(self, serializer):
        old_member = self.get_object()
        was_active = old_member.is_active
        member = serializer.save()
        # If deactivated, immediately terminate active sessions and invalidate tokens
        if was_active and not member.is_active:
            member.rotate_session_token()
            member.save(update_fields=['session_token', 'updated_at'])
            AttendanceAuditLog.objects.create(
                action='staff_deactivated',
                actor=get_current_staff(self.request),
                target_type='StaffMember',
                target_id=str(member.id),
                reason=f"Staff member {member.staff_id} deactivated; all sessions revoked."
            )
        from .services.sync import sync_single_staff_member
        sync_single_staff_member(member)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        current_staff = get_current_staff(request)

        # Safeguard: prevent deleting your own active account while logged in
        if current_staff and current_staff.id == instance.id:
            return Response(
                {'detail': 'You cannot delete your own active account while logged in. Please use another Owner account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Safeguard: cannot delete the last remaining Owner account
        if instance.is_owner:
            owner_count = StaffMember.objects.filter(role__is_owner=True).count()
            if owner_count <= 1:
                return Response(
                    {'detail': 'Cannot delete the last remaining Store Owner account. At least one Owner must remain in the system.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        from .services.staff_delete import delete_staff_member_completely
        staff_name = instance.name
        staff_id = instance.staff_id
        delete_staff_member_completely(instance)

        return Response({
            'message': f"Staff member '{staff_name}' ({staff_id}) and all associated records have been completely deleted from the system."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='revoke-sessions')
    def revoke_sessions(self, request, pk=None):
        """Immediately terminates all active login sessions across all devices for this staff member."""
        member = self.get_object()
        new_token = member.rotate_session_token()
        member.save(update_fields=['session_token', 'updated_at'])
        return Response({
            'message': f'All active sessions for {member.name} ({member.staff_id}) have been terminated.',
            'session_token': new_token,
        })


# ============================================================================
# STAGE 1: HR & ATTENDANCE VIEWSETS
# ============================================================================


class ManagerOrOwnerMixin:
    """
    Guarantees request is authenticated by an Owner or Store Manager with employee/staff access.
    Automatically scopes queries to the manager's assigned store location.
    """
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        ensure_default_roles_and_owner()
        member = get_current_staff(request)
        if not member:
            raise AuthenticationFailed("Authentication required.")
        is_authorized = member.is_owner or member.role.can_access_staff or ('employee_management' in (member.role.allowed_modules or []))
        if not is_authorized:
            raise PermissionDenied("Access Denied: You do not have permission to manage employees or attendance.")
        self.current_staff = member

    def get_effective_store_id(self, request):
        if hasattr(self, 'current_staff') and self.current_staff and not self.current_staff.is_owner and self.current_staff.store_id:
            return self.current_staff.store_id
        store_id = request.query_params.get('store') or request.query_params.get('store_id')
        if not store_id and hasattr(request, 'data') and isinstance(request.data, dict):
            store_id = request.data.get('store_id')
        if store_id is not None and str(store_id).strip() and str(store_id).strip() not in ('null', 'undefined'):
            try:
                return int(store_id)
            except (ValueError, TypeError):
                pass
        if hasattr(self, 'current_staff') and self.current_staff and self.current_staff.store_id:
            return self.current_staff.store_id
        first_store = Store.objects.filter(is_active=True).first()
        return first_store.id if first_store else None


class KioskTapView(APIView):
    """
    High-performance RFID Tap ingestion endpoint for USB keyboard-wedge Kiosks and ESP32 hardware devices.
    Authenticated via X-Device-Token header (or staff session for manual web testing).
    POST /api/staff/tap/
    Body: {"card_uid": "50E1AB61"}
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        token_header = request.headers.get('X-Device-Token') or request.META.get('HTTP_X_DEVICE_TOKEN')
        device = None
        actor = None
        store = None

        if token_header:
            # Search active kiosk devices and verify token
            for d in KioskDevice.objects.filter(is_active=True):
                if check_password(token_header, d.api_token_hash):
                    device = d
                    store = d.store
                    break
            if not device:
                return Response(
                    {'success': False, 'error_code': 'invalid_device_token', 'message': 'Unauthorized kiosk device.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        else:
            # Fallback to staff session / X-Staff-Id for testing or software kiosk
            member = get_current_staff(request)
            if member:
                actor = member
                store = member.store
            else:
                # If store_id passed in query or body for unauthenticated dev kiosk
                store_id = request.data.get('store_id') or request.query_params.get('store_id')
                if store_id:
                    store = Store.objects.filter(id=store_id).first()

        card_uid = request.data.get('card_uid')
        if not card_uid:
            return Response(
                {'success': False, 'error_code': 'missing_uid', 'message': 'card_uid is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Anti-replay nonce check for hardware kiosk devices
        nonce = request.headers.get('X-Kiosk-Nonce') or request.META.get('HTTP_X_KIOSK_NONCE')
        if nonce:
            from django.core.cache import cache
            nonce_key = f"kiosk_nonce:{nonce}"
            if cache.get(nonce_key):
                return Response(
                    {'success': False, 'error_code': 'replay_detected', 'message': 'Duplicate or replayed RFID tap detected.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cache.set(nonce_key, True, 300)  # 5 minutes replay cache window

        preview = bool(request.data.get('preview') or request.query_params.get('preview') in ('true', '1', True))

        result = process_tap(
            card_uid=card_uid,
            device=device,
            source='kiosk' if device else 'manual',
            actor=actor,
            store=store,
            preview=preview,
        )

        status_code = status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)


class EmployeeViewSet(ManagerOrOwnerMixin, viewsets.ModelViewSet):
    """
    CRUD and lifecycle operations for Employees.
    """
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.select_related('store', 'staff_member', 'staff_member__role').prefetch_related('rfid_cards', 'shift_assignments')
        if not self.current_staff.is_owner and self.current_staff.store_id:
            qs = qs.filter(store_id=self.current_staff.store_id)
        else:
            store_filter = self.request.query_params.get('store') or self.request.query_params.get('store_id')
            if store_filter:
                qs = qs.filter(store_id=store_filter)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(employee_code__icontains=search)

        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            qs = qs.filter(is_active=True)
        elif status_filter == 'inactive':
            qs = qs.filter(is_active=False)

        # Strictly exclude owners from Employee management & attendance
        qs = qs.exclude(staff_member__role__is_owner=True).exclude(staff_member__role__name__iexact='owner').exclude(designation__iexact='owner').exclude(department__iexact='owner')

        return qs.order_by('employee_code')

    def perform_create(self, serializer):
        emp = serializer.save()
        if emp.store:
            EmployeeStoreAssignment.objects.get_or_create(
                employee=emp,
                store=emp.store,
                to_date=None,
                defaults={'from_date': emp.join_date or timezone.now().date()}
            )
        if emp.staff_member:
            sm = emp.staff_member
            sm.name = emp.name
            if emp.phone is not None:
                sm.phone = emp.phone
            if emp.photo:
                sm.photo = emp.photo
            sm.is_active = emp.is_active
            if emp.store:
                sm.store = emp.store
            sm.save()

    def perform_update(self, serializer):
        emp = serializer.save()
        if emp.staff_member:
            sm = emp.staff_member
            sm.name = emp.name
            if emp.phone is not None:
                sm.phone = emp.phone
            if emp.photo:
                sm.photo = emp.photo
            sm.is_active = emp.is_active
            if emp.store:
                sm.store = emp.store
            sm.save()

    def perform_destroy(self, instance):
        from .services.staff_delete import delete_employee_records
        delete_employee_records(instance)

    @action(detail=True, methods=['post'], url_path='assign-card')
    def assign_card_action(self, request, pk=None):
        employee = self.get_object()
        raw_uid = request.data.get('card_uid')
        reason = request.data.get('reason', 'Card assigned by manager')

        norm_uid = normalize_card_uid(raw_uid)
        if not norm_uid:
            return Response({'detail': 'Valid card_uid is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Check if card is already assigned to a Customer as a VIP Card
        from inventory.models import Customer
        existing_vip = Customer.objects.filter(vip_card_uid__iexact=norm_uid, vip_card_status='active').first()
        if existing_vip:
            return Response(
                {
                    'detail': f"Card '{norm_uid}' is already assigned as a VIP Card to Customer {existing_vip.display_name} ({existing_vip.phone}). A card cannot be both a Customer VIP Card and an Employee Attendance Card."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Deactivate any currently active card for this employee
        active_cards = employee.rfid_cards.filter(status=RFIDCard.STATUS_ACTIVE)
        for c in active_cards:
            c.status = RFIDCard.STATUS_DEACTIVATED
            c.deactivated_at = timezone.now()
            c.reason = f"Replaced by card {norm_uid}"
            c.save()

        # 3. Ensure no other active employee card exists with this UID globally
        conflict = RFIDCard.objects.filter(card_uid=norm_uid, status=RFIDCard.STATUS_ACTIVE).first()
        if conflict:
            return Response(
                {'detail': f"Card '{norm_uid}' is already actively assigned to Employee {conflict.employee.name} ({conflict.employee.employee_code})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_card = RFIDCard.objects.create(
            employee=employee,
            card_uid=norm_uid,
            status=RFIDCard.STATUS_ACTIVE,
            reason=reason
        )

        AttendanceAuditLog.objects.create(
            action='card_assign',
            actor=self.current_staff,
            target_type='Employee',
            target_id=str(employee.id),
            before_state=None,
            after_state={'card_uid': norm_uid},
            reason=reason
        )

        return Response(RFIDCardSerializer(new_card).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='inspect-card')
    def inspect_card(self, request):
        """Universal Card Inspection endpoint: checks ownership across both Employees and Customers."""
        from inventory.card_service import inspect_card_ownership
        card_uid = request.query_params.get('card_uid', '').strip()
        data = inspect_card_ownership(card_uid)
        return Response(data, status=status.HTTP_200_OK if data.get('success') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='deactivate-card')
    def deactivate_card_action(self, request, pk=None):
        employee = self.get_object()
        card_id = request.data.get('card_id')
        reason = request.data.get('reason', 'Card deactivated')
        status_val = request.data.get('status', RFIDCard.STATUS_DEACTIVATED)

        card = employee.rfid_cards.filter(id=card_id).first() if card_id else employee.active_card
        if not card:
            return Response({'detail': 'Card not found.'}, status=status.HTTP_404_NOT_FOUND)

        card.status = status_val
        card.deactivated_at = timezone.now()
        card.reason = reason
        card.save()

        AttendanceAuditLog.objects.create(
            action='card_deactivate',
            actor=self.current_staff,
            target_type='RFIDCard',
            target_id=str(card.id),
            before_state={'status': RFIDCard.STATUS_ACTIVE},
            after_state={'status': status_val},
            reason=reason
        )

        return Response(RFIDCardSerializer(card).data)

    @action(detail=True, methods=['post'], url_path='transfer-store')
    def transfer_store_action(self, request, pk=None):
        employee = self.get_object()
        new_store_id = request.data.get('store_id')
        effective_date_str = request.data.get('effective_date')
        notes = request.data.get('notes', '')

        if not new_store_id or not effective_date_str:
            return Response({'detail': 'store_id and effective_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        new_store = Store.objects.filter(id=new_store_id).first()
        if not new_store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            effective_date = datetime.strptime(effective_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid effective_date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        # Close prior assignment
        prior_assignment = employee.store_assignments.filter(to_date__isnull=True).first()
        if prior_assignment:
            prior_assignment.to_date = effective_date - timedelta(days=1)
            prior_assignment.save()

        EmployeeStoreAssignment.objects.create(
            employee=employee,
            store=new_store,
            from_date=effective_date,
            notes=notes
        )

        old_store_id = employee.store_id
        employee.store = new_store
        employee.save(update_fields=['store'])

        AttendanceAuditLog.objects.create(
            action='employee_transfer',
            actor=self.current_staff,
            target_type='Employee',
            target_id=str(employee.id),
            before_state={'store_id': old_store_id},
            after_state={'store_id': new_store.id, 'effective_date': effective_date.isoformat()},
            reason=notes or f"Transferred to {new_store.name}"
        )

        return Response(EmployeeSerializer(employee).data)

    @action(detail=True, methods=['post'], url_path='assign-shift')
    def assign_shift_action(self, request, pk=None):
        employee = self.get_object()
        shift_id = request.data.get('shift_id')
        weekly_offs = request.data.get('weekly_off_days')
        from_str = request.data.get('from_date', date.today().isoformat())
        to_str = request.data.get('to_date')

        try:
            from_date = datetime.strptime(from_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_str, '%Y-%m-%d').date() if to_str else None
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        shift = Shift.objects.filter(id=shift_id).first() if shift_id else None

        # Close prior open assignment if overlapping
        prior = employee.shift_assignments.filter(to_date__isnull=True).first()
        if prior and prior.from_date < from_date:
            prior.to_date = from_date - timedelta(days=1)
            prior.save()

        assignment = EmployeeShiftAssignment.objects.create(
            employee=employee,
            shift=shift,
            weekly_off_days=weekly_offs,
            from_date=from_date,
            to_date=to_date
        )

        AttendanceAuditLog.objects.create(
            action='shift_assignment',
            actor=self.current_staff,
            target_type='EmployeeShiftAssignment',
            target_id=str(assignment.id),
            before_state=None,
            after_state={'shift_id': shift_id, 'from_date': from_date.isoformat()},
            reason=f"Assigned shift {shift.name if shift else 'Store Default'}"
        )

        return Response(EmployeeShiftAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['get'], url_path='month-summary')
    def month_summary_action(self, request, pk=None):
        employee = self.get_object()
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        summary = get_month_attendance(employee, year, month)
        return Response(summary)


class ShiftViewSet(ManagerOrOwnerMixin, viewsets.ModelViewSet):
    """
    CRUD for Store Shifts.
    """
    serializer_class = ShiftSerializer

    def get_queryset(self):
        qs = Shift.objects.select_related('store')
        store_id = self.get_effective_store_id(self.request)
        if store_id:
            qs = qs.filter(store_id=store_id)
        return qs.order_by('name')

    def perform_create(self, serializer):
        store_id = self.get_effective_store_id(self.request)
        store = Store.objects.get(id=store_id)
        serializer.save(store=store)


class KioskDeviceViewSet(ManagerOrOwnerMixin, viewsets.ModelViewSet):
    """
    Kiosk Device management and one-time token generation.
    """
    serializer_class = KioskDeviceSerializer

    def get_queryset(self):
        qs = KioskDevice.objects.select_related('store')
        store_id = self.get_effective_store_id(self.request)
        if store_id:
            qs = qs.filter(store_id=store_id)
        return qs.order_by('name')

    def create(self, request, *args, **kwargs):
        store_id = self.get_effective_store_id(request)
        name = request.data.get('name', 'Kiosk Device')
        raw_token = secrets.token_urlsafe(32)
        hashed_token = make_password(raw_token)

        device = KioskDevice.objects.create(
            store_id=store_id,
            name=name,
            api_token_hash=hashed_token
        )

        data = KioskDeviceSerializer(device).data
        data['raw_token'] = raw_token  # Returned once to display/copy
        return Response(data, status=status.HTTP_201_CREATED)


class DailyAttendanceViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Daily attendance sheet querying, manual punches, status overrides, and recalculation.
    """
    def list(self, request):
        raw_store = request.query_params.get('store') or request.query_params.get('store_id')
        filter_store = None
        if raw_store and str(raw_store).strip() not in ('all', 'null', 'undefined', ''):
            try:
                filter_store = int(raw_store)
            except (ValueError, TypeError):
                filter_store = None
        elif not (hasattr(self, 'current_staff') and self.current_staff and self.current_staff.is_owner):
            filter_store = self.get_effective_store_id(request)

        date_str = request.query_params.get('date', date.today().isoformat())
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            target_date = date.today()

        # Trigger on-the-fly rebuild for any active employee missing today's record
        emp_filter = {'is_active': True}
        if filter_store:
            emp_filter['store_id'] = filter_store
        employees = Employee.objects.filter(**emp_filter)
        for emp in employees:
            if not AttendanceDay.objects.filter(employee=emp, business_date=target_date).exists():
                rebuild_day(emp, target_date)

        day_filter = {'business_date': target_date}
        if filter_store:
            day_filter['store_id'] = filter_store
        qs = AttendanceDay.objects.filter(**day_filter).select_related(
            'employee', 'employee__staff_member', 'employee__staff_member__role', 'store', 'override_by'
        ).prefetch_related('sessions')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        needs_review = request.query_params.get('needs_review')
        if needs_review and needs_review.lower() == 'true':
            qs = qs.filter(status=AttendanceDay.STATUS_NEEDS_REVIEW)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(employee__name__icontains=search) | qs.filter(employee__employee_code__icontains=search)

        # Strictly exclude owners from daily attendance view
        qs = qs.exclude(employee__staff_member__role__is_owner=True).exclude(employee__staff_member__role__name__iexact='owner').exclude(employee__designation__iexact='owner').exclude(employee__department__iexact='owner')

        serializer = AttendanceDaySerializer(qs.order_by('employee__name'), many=True)
        return Response({
            'date': target_date.isoformat(),
            'store_id': filter_store,
            'records': serializer.data
        })

    @action(detail=False, methods=['post'], url_path='override')
    def override_action(self, request):
        day_id = request.data.get('attendance_day_id')
        new_status = request.data.get('status')
        reason = request.data.get('reason')

        if not day_id or not new_status or not reason:
            return Response({'detail': 'attendance_day_id, status, and reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

        day = AttendanceDay.objects.filter(id=day_id).first()
        if not day:
            return Response({'detail': 'Attendance day record not found.'}, status=status.HTTP_404_NOT_FOUND)

        updated_day = override_day_status(day, new_status, self.current_staff, reason)
        return Response(AttendanceDaySerializer(updated_day).data)

    @action(detail=False, methods=['post'], url_path='clear-override')
    def clear_override_action(self, request):
        day_id = request.data.get('attendance_day_id')
        reason = request.data.get('reason', 'Cleared override')

        day = AttendanceDay.objects.filter(id=day_id).first()
        if not day:
            return Response({'detail': 'Attendance day record not found.'}, status=status.HTTP_404_NOT_FOUND)

        updated_day = clear_day_override(day, self.current_staff, reason)
        return Response(AttendanceDaySerializer(updated_day).data)

    @action(detail=False, methods=['post'], url_path='manual-punch')
    def manual_punch_action(self, request):
        employee_id = request.data.get('employee_id')
        punched_at_str = request.data.get('punched_at')
        note = request.data.get('note')

        if not employee_id or not punched_at_str or not note:
            return Response({'detail': 'employee_id, punched_at, and note are required.'}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            punched_at = datetime.fromisoformat(punched_at_str)
            if timezone.is_naive(punched_at):
                punched_at = timezone.make_aware(punched_at)
        except ValueError:
            return Response({'detail': 'Invalid datetime format for punched_at.'}, status=status.HTTP_400_BAD_REQUEST)

        punch, day = add_manual_punch(emp, emp.store, punched_at, self.current_staff, note)
        return Response({
            'punch': PunchSerializer(punch).data,
            'attendance_day': AttendanceDaySerializer(day).data,
        })

    @action(detail=False, methods=['post'], url_path='void-punch')
    def void_punch_action(self, request):
        punch_id = request.data.get('punch_id')
        reason = request.data.get('reason')

        if not punch_id or not reason:
            return Response({'detail': 'punch_id and reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

        punch = Punch.objects.filter(id=punch_id).first()
        if not punch:
            return Response({'detail': 'Punch not found.'}, status=status.HTTP_404_NOT_FOUND)

        day = void_punch(punch, self.current_staff, reason)
        return Response({
            'punch': PunchSerializer(punch).data,
            'attendance_day': AttendanceDaySerializer(day).data,
        })

    @action(detail=False, methods=['post'], url_path='manual-entry', url_name='manual-entry')
    def manual_entry_action(self, request):
        employee_id = request.data.get('employee_id')
        date_str = request.data.get('date')
        reason = request.data.get('reason')
        status_val = request.data.get('status')
        in_time_str = request.data.get('in_time')
        out_time_str = request.data.get('out_time')
        worked_hours = request.data.get('worked_hours')

        if not employee_id or not date_str or not reason:
            return Response({'detail': 'employee_id, date, and reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        worked_minutes = None
        if worked_hours is not None and str(worked_hours).strip():
            try:
                worked_minutes = int(float(worked_hours) * 60)
            except ValueError:
                pass

        try:
            day = record_manual_day_attendance(
                employee=emp,
                business_date=target_date,
                actor=self.current_staff,
                reason=reason,
                status=status_val,
                in_time_str=in_time_str,
                out_time_str=out_time_str,
                worked_minutes=worked_minutes
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'detail': f"Server error updating attendance: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(AttendanceDaySerializer(day).data)

    @action(detail=False, methods=['post'], url_path='recalculate')
    def recalculate_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.get(id=store_id)
        from_str = request.data.get('from_date')
        to_str = request.data.get('to_date')
        preview_only = request.data.get('preview_only', False)

        from_date = datetime.strptime(from_str, '%Y-%m-%d').date() if from_str else None
        to_date = datetime.strptime(to_str, '%Y-%m-%d').date() if to_str else None

        result = recalculate_attendance(
            store=store,
            from_date=from_date,
            to_date=to_date,
            preview_only=preview_only,
            actor=self.current_staff,
            reason="Recalculation via UI"
        )
        return Response(result)


class AttendanceReportViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Who is in, Monthly Grid Heatmap, Punch Log, and Late/Early arrival reports.
    """
    @action(detail=False, methods=['get'], url_path='who-is-in')
    def who_is_in_action(self, request):
        store_id = self.get_effective_store_id(request)
        today = date.today()

        active_sessions = AttendanceSession.objects.filter(
            attendance_day__store_id=store_id,
            attendance_day__business_date=today,
            out_at__isnull=True
        ).select_related('attendance_day__employee', 'attendance_day__employee__staff_member', 'attendance_day__employee__staff_member__role', 'attendance_day').exclude(
            attendance_day__employee__staff_member__role__is_owner=True
        ).exclude(
            attendance_day__employee__staff_member__role__name__iexact='owner'
        ).exclude(
            attendance_day__employee__designation__iexact='owner'
        ).exclude(
            attendance_day__employee__department__iexact='owner'
        )

        results = []
        now_utc = timezone.now()
        for s in active_sessions:
            emp = s.attendance_day.employee
            duration = int((now_utc - s.in_at).total_seconds() / 60)
            photo_url = None
            if emp.photo:
                try:
                    photo_url = emp.photo.url
                except Exception:
                    pass
            elif emp.staff_member and emp.staff_member.photo:
                try:
                    photo_url = emp.staff_member.photo.url
                except Exception:
                    pass

            phone_val = emp.phone or (emp.staff_member.phone if emp.staff_member else '')

            role_name = None
            if emp.staff_member and emp.staff_member.role:
                role_name = emp.staff_member.role.name

            section_val = None
            if emp.staff_member:
                section_val = emp.staff_member.section or None

            results.append({
                'employee_id': emp.id,
                'employee_name': emp.name,
                'employee_code': emp.employee_code,
                'phone': phone_val,
                'department': emp.department,
                'role_name': role_name,
                'section': section_val,
                'photo_url': photo_url,
                'clock_in_time': s.in_at.isoformat(),
                'active_duration_minutes': duration,
                'active_duration_formatted': f"{duration // 60}h {duration % 60}m",
                'shift_name': s.attendance_day.shift_snapshot.get('name', 'Standard'),
            })

        return Response(results)

    @action(detail=False, methods=['get'], url_path='monthly-grid')
    def monthly_grid_action(self, request):
        store_id = self.get_effective_store_id(request)
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))

        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        employees = Employee.objects.filter(store_id=store_id, is_active=True).exclude(
            staff_member__role__is_owner=True
        ).exclude(
            staff_member__role__name__iexact='owner'
        ).exclude(
            designation__iexact='owner'
        ).exclude(
            department__iexact='owner'
        ).order_by('name')
        days_qs = AttendanceDay.objects.filter(
            store_id=store_id,
            business_date__gte=start_date,
            business_date__lte=end_date
        )

        store = Store.objects.filter(id=store_id).first()
        tz_str = (store.timezone if store and store.timezone else None) or 'Asia/Kolkata'
        try:
            store_tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            store_tz = timezone.get_current_timezone()

        lookup = {}
        for d in days_qs:
            first_in_local = d.first_in.astimezone(store_tz) if d.first_in else None
            last_out_local = d.last_out.astimezone(store_tz) if d.last_out else None
            lookup[(d.employee_id, d.business_date.day)] = {
                'id': d.id,
                'business_date': d.business_date.isoformat(),
                'status': d.status,
                'first_in': d.first_in.isoformat() if d.first_in else None,
                'last_out': d.last_out.isoformat() if d.last_out else None,
                'first_in_time': first_in_local.strftime('%H:%M') if first_in_local else None,
                'last_out_time': last_out_local.strftime('%H:%M') if last_out_local else None,
                'worked_minutes': d.worked_minutes,
                'day_fraction_paid': str(d.day_fraction_paid),
                'late_minutes': d.late_minutes,
                'is_locked': d.is_locked,
                'override_status': d.override_status,
                'override_reason': d.override_reason,
                'flags': d.flags or [],
            }

        is_month_locked = False
        if days_qs.exists() and not days_qs.filter(is_locked=False).exists():
            is_month_locked = True

        matrix = []
        for emp in employees:
            days_row = {}
            for day_num in range(1, last_day + 1):
                cur_date = date(year, month, day_num)
                if emp.join_date and cur_date < emp.join_date:
                    days_row[day_num] = {
                        'id': None,
                        'business_date': cur_date.isoformat(),
                        'status': 'not_joined',
                        'worked_minutes': 0,
                        'first_in': None,
                        'last_out': None,
                        'day_fraction_paid': '0.00',
                        'late_minutes': 0,
                        'is_locked': False,
                        'join_date': emp.join_date.strftime('%b %d, %Y'),
                    }
                elif emp.exit_date and cur_date > emp.exit_date:
                    days_row[day_num] = {
                        'id': None,
                        'business_date': cur_date.isoformat(),
                        'status': 'separated',
                        'worked_minutes': 0,
                        'first_in': None,
                        'last_out': None,
                        'day_fraction_paid': '0.00',
                        'late_minutes': 0,
                        'is_locked': False,
                        'exit_date': emp.exit_date.strftime('%b %d, %Y'),
                    }
                elif (emp.id, day_num) in lookup:
                    days_row[day_num] = lookup[(emp.id, day_num)]
                elif cur_date > today:
                    days_row[day_num] = {
                        'id': None,
                        'business_date': cur_date.isoformat(),
                        'status': 'future',
                        'worked_minutes': 0,
                        'first_in': None,
                        'last_out': None,
                        'day_fraction_paid': '0.00',
                        'late_minutes': 0,
                        'is_locked': False,
                    }
                else:
                    days_row[day_num] = {
                        'id': None,
                        'business_date': cur_date.isoformat(),
                        'status': 'absent',
                        'worked_minutes': 0,
                        'first_in': None,
                        'last_out': None,
                        'day_fraction_paid': '0.00',
                        'late_minutes': 0,
                        'is_locked': False,
                    }
            is_pre_joining = bool(emp.join_date and emp.join_date > end_date)
            is_post_exit = bool(emp.exit_date and emp.exit_date < start_date)
            shift = get_effective_shift(emp, today)
            shift_range = None
            if shift:
                shift_range = getattr(shift, 'time_range_12h', None)
                if not shift_range and shift.start_time and shift.end_time:
                    shift_range = f"{shift.start_time.strftime('%I:%M %p')} - {shift.end_time.strftime('%I:%M %p')}"

            matrix.append({
                'employee_id': emp.id,
                'employee_code': emp.employee_code,
                'employee_name': emp.name,
                'department': emp.department,
                'join_date': emp.join_date.strftime('%b %d, %Y') if emp.join_date else None,
                'exit_date': emp.exit_date.strftime('%b %d, %Y') if emp.exit_date else None,
                'is_pre_joining': is_pre_joining,
                'is_post_exit': is_post_exit,
                'shift_name': shift.name if shift else None,
                'shift_start': shift.start_time.strftime('%H:%M') if shift and shift.start_time else None,
                'shift_end': shift.end_time.strftime('%H:%M') if shift and shift.end_time else None,
                'shift_time_range_12h': shift_range,
                'days': days_row,
            })

        return Response({
            'year': year,
            'month': month,
            'total_days': last_day,
            'is_locked': is_month_locked,
            'is_ongoing': today <= end_date,
            'unlocks_at': (end_date + timedelta(days=1)).strftime('%b %d, %Y'),
            'matrix': matrix,
        })

    @action(detail=False, methods=['get'], url_path='punch-log')
    def punch_log_action(self, request):
        store_id = self.get_effective_store_id(request)
        punches_qs = Punch.objects.filter(store_id=store_id).select_related('employee', 'device', 'voided_by', 'created_by').order_by('-punched_at')[:100]
        unknown_qs = UnknownTap.objects.filter(store_id=store_id).order_by('-at')[:50]

        return Response({
            'punches': PunchSerializer(punches_qs, many=True).data,
            'unknown_taps': UnknownTapSerializer(unknown_qs, many=True).data,
        })

    @action(detail=False, methods=['get'], url_path='monthly-summary')
    def monthly_summary_action(self, request):
        store_id = self.get_effective_store_id(request)
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))

        employees = Employee.objects.filter(store_id=store_id, is_active=True).exclude(
            staff_member__role__is_owner=True
        ).exclude(
            staff_member__role__name__iexact='owner'
        ).exclude(
            designation__iexact='owner'
        ).exclude(
            department__iexact='owner'
        ).order_by('name')
        summaries = [get_month_attendance(emp, year, month) for emp in employees]

        return Response({
            'year': year,
            'month': month,
            'store_id': store_id,
            'summaries': summaries
        })

    @action(detail=False, methods=['get'], url_path='late-early')
    def late_early_action(self, request):
        store_id = self.get_effective_store_id(request)
        start_str = request.query_params.get('from_date')
        end_str = request.query_params.get('to_date')
        today = date.today()

        from_date = datetime.strptime(start_str, '%Y-%m-%d').date() if start_str else today.replace(day=1)
        to_date = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else today

        from django.db.models import Q
        records = AttendanceDay.objects.filter(
            store_id=store_id,
            business_date__gte=from_date,
            business_date__lte=to_date
        ).filter(Q(late_minutes__gt=0) | Q(early_leave_minutes__gt=0)).select_related('employee').order_by('-business_date')

        return Response(AttendanceDaySerializer(records, many=True).data)

    @action(detail=False, methods=['post'], url_path='lock-month')
    def lock_month_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        year = int(request.data.get('year'))
        month = int(request.data.get('month'))
        try:
            count = lock_month(store, year, month, actor=self.current_staff)
            return Response({'success': True, 'locked_count': count})
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='unlock-month')
    def unlock_month_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        year = int(request.data.get('year'))
        month = int(request.data.get('month'))
        count = unlock_month(store, year, month, actor=self.current_staff)
        return Response({'success': True, 'unlocked_count': count})


class LeaveViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Leave types, applications, approvals, balances, and carry-forward.
    """
    @action(detail=False, methods=['get', 'post'], url_path='types')
    def types_action(self, request):
        if request.method == 'GET':
            types = LeaveType.objects.all().order_by('name')
            if not types.exists():
                from decimal import Decimal
                default_types = [
                    LeaveType(name='Casual Leave', code='CL', is_paid=True, annual_quota_days=Decimal('12.00'), allows_half_day=True, carry_forward=False),
                    LeaveType(name='Sick Leave', code='SL', is_paid=True, annual_quota_days=Decimal('12.00'), allows_half_day=True, carry_forward=False),
                    LeaveType(name='Privilege Leave', code='PL', is_paid=True, annual_quota_days=Decimal('15.00'), allows_half_day=True, carry_forward=True),
                    LeaveType(name='Loss of Pay (LOP)', code='LOP', is_paid=False, annual_quota_days=Decimal('0.00'), allows_half_day=True, carry_forward=False, allow_negative_balance=True),
                    LeaveType(name='Compensatory Off', code='CO', is_paid=True, annual_quota_days=Decimal('0.00'), allows_half_day=True, carry_forward=False),
                ]
                LeaveType.objects.bulk_create(default_types)
                types = LeaveType.objects.all().order_by('name')
            return Response(LeaveTypeSerializer(types, many=True).data)

        # POST: create leave type (Owner or Manager)
        if not (self.current_staff.is_owner or self.current_staff.role.can_access_staff):
            raise PermissionDenied("Only store managers and owners can configure leave types.")
        serializer = LeaveTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get', 'post'], url_path='requests')
    def requests_action(self, request):
        store_id = self.get_effective_store_id(request)

        if request.method == 'GET':
            qs = LeaveRequest.objects.filter(employee__store_id=store_id).select_related('employee', 'leave_type', 'decided_by').order_by('-created_at')
            return Response(LeaveRequestSerializer(qs, many=True).data)

        # POST: Submit / Grant request
        employee_id = request.data.get('employee_id')
        leave_type_id = request.data.get('leave_type_id')
        from_str = request.data.get('from_date')
        to_str = request.data.get('to_date')
        half_day = request.data.get('half_day', False)
        half_day_period = request.data.get('half_day_period', '')
        reason = request.data.get('reason', '')
        auto_approve = request.data.get('auto_approve', True)

        emp = Employee.objects.filter(id=employee_id).first()
        lt = LeaveType.objects.filter(id=leave_type_id).first()
        if not emp or not lt:
            return Response({'detail': 'Employee and LeaveType are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from_date = datetime.strptime(from_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req = submit_leave_request(
                employee=emp,
                leave_type=lt,
                from_date=from_date,
                to_date=to_date,
                half_day=half_day,
                half_day_period=half_day_period,
                reason=reason,
                actor=self.current_staff
            )
            # When granted by management with authority, immediately approve and audit
            if auto_approve and req.status != LeaveRequest.STATUS_APPROVED:
                approve_leave_request(
                    req,
                    actor=self.current_staff,
                    notes=reason or f"Authorized and granted by {self.current_staff.name}"
                )

            return Response(LeaveRequestSerializer(req).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='requests/(?P<req_id>[^/.]+)/approve')
    def approve_action(self, request, req_id=None):
        req = LeaveRequest.objects.filter(id=req_id).first()
        if not req:
            return Response({'detail': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '')
        approved = approve_leave_request(req, actor=self.current_staff, notes=notes)
        return Response(LeaveRequestSerializer(approved).data)

    @action(detail=False, methods=['post'], url_path='requests/(?P<req_id>[^/.]+)/reject')
    def reject_action(self, request, req_id=None):
        req = LeaveRequest.objects.filter(id=req_id).first()
        if not req:
            return Response({'detail': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '')
        rejected = reject_leave_request(req, actor=self.current_staff, notes=notes)
        return Response(LeaveRequestSerializer(rejected).data)

    @action(detail=False, methods=['post'], url_path='requests/(?P<req_id>[^/.]+)/cancel')
    def cancel_action(self, request, req_id=None):
        req = LeaveRequest.objects.filter(id=req_id).first()
        if not req:
            return Response({'detail': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '')
        cancelled = cancel_leave_request(req, actor=self.current_staff, notes=notes)
        return Response(LeaveRequestSerializer(cancelled).data)

    @action(detail=False, methods=['get'], url_path='balances')
    def balances_action(self, request):
        employee_id = request.query_params.get('employee_id')
        year = int(request.query_params.get('year', date.today().year))

        if not employee_id:
            return Response({'detail': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        leave_types = LeaveType.objects.all()
        balances = []
        for lt in leave_types:
            bal = get_leave_balance(emp, lt, year)
            balances.append({
                'leave_type_id': lt.id,
                'leave_type_name': lt.name,
                'leave_type_code': lt.code,
                'annual_quota_days': str(lt.annual_quota_days),
                'balance': str(bal),
                'is_paid': lt.is_paid,
            })
        return Response(balances)


class HolidayViewSet(ManagerOrOwnerMixin, viewsets.ModelViewSet):
    """
    CRUD for Store and Global Holidays.
    """
    serializer_class = HolidaySerializer

    def get_queryset(self):
        store_id = self.get_effective_store_id(self.request)
        from django.db.models import Q
        return Holiday.objects.filter(Q(store__isnull=True) | Q(store_id=store_id)).order_by('date')

    def perform_create(self, serializer):
        store_id = self.get_effective_store_id(self.request)
        store = Store.objects.filter(id=store_id).first() if store_id else None
        holiday = serializer.save(store=store)

        # Rebuild attendance for employees in this store on this date
        from .services.attendance import rebuild_day
        employees = Employee.objects.filter(store=store, is_active=True) if store else Employee.objects.filter(is_active=True)
        for emp in employees:
            rebuild_day(emp, holiday.date, force=True)

        AttendanceAuditLog.objects.create(
            action='create_holiday',
            actor=self.current_staff,
            target_type='Holiday',
            target_id=str(holiday.id),
            before_state={},
            after_state={'date': str(holiday.date), 'name': holiday.name, 'is_paid': holiday.is_paid},
            reason=f"Added holiday '{holiday.name}' on {holiday.date}"
        )

    def perform_destroy(self, instance):
        date_val = instance.date
        store = instance.store
        holiday_name = instance.name
        instance.delete()

        # Rebuild attendance for employees on that date
        from .services.attendance import rebuild_day
        employees = Employee.objects.filter(store=store, is_active=True) if store else Employee.objects.filter(is_active=True)
        for emp in employees:
            rebuild_day(emp, date_val, force=True)

        AttendanceAuditLog.objects.create(
            action='delete_holiday',
            actor=self.current_staff,
            target_type='Holiday',
            target_id=str(date_val),
            before_state={'date': str(date_val), 'name': holiday_name},
            after_state={},
            reason=f"Deleted holiday '{holiday_name}' on {date_val}"
        )


class HRSettingsViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    HR Settings management for store configuration and preview.
    """
    def list(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first() if store_id else None
        settings_dict = get_all_settings(store)
        return Response(settings_dict)

    def create(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first() if store_id else None
        data = request.data

        errors = []
        for key, value in data.items():
            if key in ('store_id', 'store'):
                continue
            try:
                set_setting(
                    key=key,
                    value=value,
                    level=HRSetting.LEVEL_STORE if store else HRSetting.LEVEL_GLOBAL,
                    store=store,
                    actor=self.current_staff,
                    reason="Updated via HR settings page"
                )
            except ValueError as e:
                errors.append(f"{key}: {str(e)}")

        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': 'Settings saved successfully.', 'settings': get_all_settings(store)})


# ============================================================================
# STAGE 2: SALARY, PAYROLL, LEDGER & SYNC VIEWSETS
# ============================================================================


class SalaryStructureViewSet(ManagerOrOwnerMixin, viewsets.ModelViewSet):
    """
    CRUD for effective-dated SalaryStructure records.
    """
    serializer_class = SalaryStructureSerializer

    def get_queryset(self):
        store_id = self.get_effective_store_id(self.request)
        qs = SalaryStructure.objects.all().select_related('employee')
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        elif store_id:
            qs = qs.filter(employee__store_assignments__store_id=store_id, employee__store_assignments__to_date__isnull=True)
        return qs.order_by('-from_date')

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        from_date = serializer.validated_data.get('from_date')
        auto_close = self.request.data.get('auto_close_previous', True)

        if auto_close and employee and from_date:
            # If there is an existing ongoing structure starting before the new from_date,
            # automatically cap its to_date to from_date - 1 day so revisions don't clash.
            ongoing = SalaryStructure.objects.filter(
                employee=employee,
                to_date__isnull=True,
                from_date__lt=from_date
            ).first()
            if ongoing:
                ongoing.to_date = from_date - timedelta(days=1)
                ongoing.save()

        try:
            serializer.save()
        except DjangoValidationError as e:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError(drf_serializers.as_serializer_error(e))


class PayrollViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Monthly Payroll run generation, review, finalization, and reopening.
    """
    def list(self, request):
        store_id = self.get_effective_store_id(request)
        runs = PayrollRun.objects.filter(store_id=store_id).order_by('-year', '-month')
        return Response(PayrollRunSerializer(runs, many=True).data)

    def retrieve(self, request, pk=None):
        store_id = self.get_effective_store_id(request)
        run = PayrollRun.objects.filter(id=pk, store_id=store_id).first()
        if not run:
            return Response({'detail': 'Payroll run not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = PayrollRunSerializer(run).data
        statements_qs = run.statements.select_related('employee').prefetch_related('lines').order_by('employee__name')
        data['statements'] = SalaryStatementSerializer(statements_qs, many=True).data
        return Response(data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        year = int(request.data.get('year'))
        month = int(request.data.get('month'))
        proceed_with_needs_review = bool(request.data.get('proceed_with_needs_review', False))

        try:
            run = generate_draft_payroll(
                store=store,
                year=year,
                month=month,
                actor=self.current_staff,
                proceed_with_needs_review=proceed_with_needs_review,
            )
            data = PayrollRunSerializer(run).data
            statements_qs = run.statements.select_related('employee').prefetch_related('lines').order_by('employee__name')
            data['statements'] = SalaryStatementSerializer(statements_qs, many=True).data
            return Response(data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='finalize')
    def finalize_action(self, request, pk=None):
        store_id = self.get_effective_store_id(request)
        run = PayrollRun.objects.filter(id=pk, store_id=store_id).first()
        if not run:
            return Response({'detail': 'Payroll run not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            finalized = finalize_payroll(run, actor=self.current_staff)
            data = PayrollRunSerializer(finalized).data
            statements_qs = finalized.statements.select_related('employee').prefetch_related('lines').order_by('employee__name')
            data['statements'] = SalaryStatementSerializer(statements_qs, many=True).data
            return Response(data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen_action(self, request, pk=None):
        store_id = self.get_effective_store_id(request)
        run = PayrollRun.objects.filter(id=pk, store_id=store_id).first()
        if not run:
            return Response({'detail': 'Payroll run not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'Administrative recalculation')
        try:
            reopened = reopen_payroll(run, actor=self.current_staff, reason=reason)
            data = PayrollRunSerializer(reopened).data
            statements_qs = reopened.statements.select_related('employee').prefetch_related('lines').order_by('employee__name')
            data['statements'] = SalaryStatementSerializer(statements_qs, many=True).data
            return Response(data)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='statements/(?P<stmt_id>[^/.]+)')
    def statement_detail_action(self, request, pk=None, stmt_id=None):
        store_id = self.get_effective_store_id(request)
        statement = SalaryStatement.objects.filter(
            id=stmt_id,
            payroll_run_id=pk,
            payroll_run__store_id=store_id
        ).select_related('employee').prefetch_related('lines').first()

        if not statement:
            return Response({'detail': 'Statement not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(SalaryStatementSerializer(statement).data)

    @action(detail=True, methods=['post'], url_path='statements/(?P<stmt_id>[^/.]+)/toggle-inclusion')
    def toggle_inclusion_action(self, request, pk=None, stmt_id=None):
        store_id = self.get_effective_store_id(request)
        statement = SalaryStatement.objects.filter(
            id=stmt_id,
            payroll_run_id=pk,
            payroll_run__store_id=store_id
        ).first()

        if not statement:
            return Response({'detail': 'Statement not found.'}, status=status.HTTP_404_NOT_FOUND)

        if statement.payroll_run.status == PayrollRun.STATUS_FINALIZED:
            return Response({'detail': 'Cannot modify inclusion on a finalized payroll run.'}, status=status.HTTP_400_BAD_REQUEST)

        is_included = request.data.get('is_included')
        if is_included is not None:
            statement.is_included = bool(is_included)
        else:
            statement.is_included = not statement.is_included

        statement.exclusion_reason = request.data.get('exclusion_reason', '') if not statement.is_included else ''
        statement.save()
        return Response(SalaryStatementSerializer(statement).data)

    @action(detail=False, methods=['get', 'post'], url_path='adjustments')
    def adjustments_action(self, request):
        store_id = self.get_effective_store_id(request)

        if request.method == 'GET':
            qs = PayrollAdjustment.objects.filter(store_id=store_id)
            year = request.query_params.get('year')
            month = request.query_params.get('month')
            employee_id = request.query_params.get('employee_id')
            if year:
                qs = qs.filter(year=int(year))
            if month:
                qs = qs.filter(month=int(month))
            if employee_id:
                qs = qs.filter(employee_id=employee_id)
            return Response(PayrollAdjustmentSerializer(qs.select_related('employee', 'created_by'), many=True).data)

        # POST: create adjustment
        employee_id = request.data.get('employee_id')
        year = int(request.data.get('year'))
        month = int(request.data.get('month'))
        adj_type = request.data.get('adjustment_type', 'bonus')
        amount = request.data.get('amount')
        label = request.data.get('label')
        note = request.data.get('note', '')

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        adj = PayrollAdjustment.objects.create(
            employee=emp,
            store_id=store_id,
            year=year,
            month=month,
            adjustment_type=adj_type,
            amount=amount,
            label=label,
            note=note,
            created_by=self.current_staff,
        )
        return Response(PayrollAdjustmentSerializer(adj).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['delete'], url_path='adjustments/(?P<adj_id>[^/.]+)')
    def delete_adjustment_action(self, request, adj_id=None):
        store_id = self.get_effective_store_id(request)
        adj = PayrollAdjustment.objects.filter(id=adj_id, store_id=store_id).first()
        if not adj:
            return Response({'detail': 'Adjustment not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check if month payroll is finalized
        run = PayrollRun.objects.filter(store_id=store_id, year=adj.year, month=adj.month).first()
        if run and run.status == PayrollRun.STATUS_FINALIZED:
            return Response({'detail': 'Cannot delete adjustments for a finalized payroll month.'}, status=status.HTTP_400_BAD_REQUEST)

        adj.delete()
        return Response({'message': 'Adjustment deleted successfully.'})

    @action(detail=False, methods=['get'], url_path='preview')
    def preview_action(self, request):
        """
        GET /payroll/preview/?year=YYYY&month=MM
        Returns unfinalized (unsettled) wage summary per employee for the given month.
        """
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        year = int(request.query_params.get('year', date.today().year))
        month = int(request.query_params.get('month', date.today().month))
        employee_ids_raw = request.query_params.get('employee_ids')
        employee_ids = [int(x) for x in employee_ids_raw.split(',') if x.strip().isdigit()] if employee_ids_raw else None

        try:
            summary = calculate_unfinalized_summary(store, year, month, employee_ids)
            return Response({'year': year, 'month': month, 'employees': summary})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='overtime-verify')
    def overtime_verify_list_action(self, request):
        """
        GET /payroll/overtime-verify/?year=YYYY&month=MM
        Returns all unsettled attendance days with unverified overtime for manager review.
        """
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        year = int(request.query_params.get('year', date.today().year))
        month = int(request.query_params.get('month', date.today().month))

        ot_days = get_overtime_pending_verification(store, year, month)
        return Response({'year': year, 'month': month, 'ot_days': ot_days, 'count': len(ot_days)})

    @action(detail=False, methods=['post'], url_path='overtime-verify-bulk')
    def overtime_verify_bulk_action(self, request):
        """
        POST /payroll/overtime-verify-bulk/
        Body: {"verifications": [{"attendance_day_id": N, "approved_minutes": M | null}, ...]}
        Manager bulk-approves or overrides OT minutes per day.
        """
        verifications = request.data.get('verifications', [])
        if not verifications:
            return Response({'detail': 'No verification data provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = bulk_verify_overtime(verifications, actor=self.current_staff)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='settle')
    def settle_action(self, request):
        """
        POST /payroll/settle/
        Body: {
            "store_id": N,
            "settlements": [
                {
                    "employee_id": N,
                    "action": "pay_now" | "ledger_only",
                    "payment_method": "cash" | "upi" | "bank_transfer" | "other",
                    "register_shift_id": N | null,
                    "note": ""
                }
            ]
        }
        Processes atomic interim wage settlement.
        """
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        settlements = request.data.get('settlements', [])
        if not settlements:
            return Response({'detail': 'No settlements provided.'}, status=status.HTTP_400_BAD_REQUEST)

        proceed_with_unreviewed = request.data.get(
            'proceed_with_unreviewed',
            request.data.get('proceed_with_needs_review', False)
        )

        try:
            results = settle_interim_payroll(
                store,
                settlements,
                actor=self.current_staff,
                proceed_with_unreviewed=bool(proceed_with_unreviewed),
            )
            settled_count = sum(1 for r in results if r.get('status') == 'settled')
            total_amount = sum(
                float(r.get('amount', 0)) for r in results if r.get('status') == 'settled'
            )
            return Response({
                'settlements': results,
                'settled_count': settled_count,
                'total_amount': str(round(total_amount, 2)),
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='register-shifts')
    def register_shifts_action(self, request):
        """
        GET /payroll/register-shifts/?include_closed=true
        Returns available register shifts for cash payout selection.
        """
        store_id = self.get_effective_store_id(request)
        include_closed = request.query_params.get('include_closed', 'false').lower() == 'true'

        shifts_qs = DailyRegisterShift.objects.filter(store_id=store_id).order_by('-opened_at')
        if not include_closed:
            shifts_qs = shifts_qs.filter(status=DailyRegisterShift.STATUS_OPEN)
        else:
            shifts_qs = shifts_qs[:20]  # Limit to recent 20 if showing closed too

        data = [
            {
                'id': s.id,
                'shift_number': s.shift_number,
                'cashier_name': s.cashier_name,
                'status': s.status,
                'opened_at': s.opened_at.isoformat(),
                'closed_at': s.closed_at.isoformat() if s.closed_at else None,
                'opening_cash': str(s.opening_cash),
                'cash_payouts_amount': str(s.cash_payouts_amount),
                'post_close_payouts_amount': str(s.post_close_payouts_amount),
                'is_post_close': s.status == DailyRegisterShift.STATUS_CLOSED,
            }
            for s in shifts_qs
        ]
        return Response({'shifts': data})


class EmployeeLedgerViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Append-only Employee Financial Ledger management.
    """
    def list(self, request):
        store_id = self.get_effective_store_id(request)
        qs = EmployeeLedgerEntry.objects.filter(store_id=store_id).select_related('employee', 'created_by')

        employee_id = request.query_params.get('employee_id')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)

        serializer = EmployeeLedgerEntrySerializer(qs.order_by('-entry_date', '-id'), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        employee_id = request.query_params.get('employee_id')
        summary = get_store_ledger_summary(store, employee_id=employee_id)
        return Response(summary)

    @action(detail=False, methods=['get'], url_path='balance')
    def balance_action(self, request):
        employee_id = request.query_params.get('employee_id')
        if not employee_id:
            return Response({'detail': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        bal = get_employee_balance(emp)
        return Response({'employee_id': emp.id, 'employee_name': emp.name, 'balance': str(bal)})

    @action(detail=False, methods=['post'], url_path='add-entry')
    def add_entry_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        employee_id = request.data.get('employee_id')
        entry_type = request.data.get('entry_type')
        amount = request.data.get('amount')
        entry_date_str = request.data.get('entry_date')
        payment_method = request.data.get('payment_method', 'cash')
        reference_no = request.data.get('reference_no', '')
        note = request.data.get('note', '')

        emp = Employee.objects.filter(id=employee_id).first()
        if not emp or not entry_type or amount is None:
            return Response({'detail': 'employee_id, entry_type, and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date() if entry_date_str else None
        except ValueError:
            return Response({'detail': 'Invalid entry_date format.'}, status=status.HTTP_400_BAD_REQUEST)

        entry = add_entry(
            employee=emp,
            store=store,
            entry_type=entry_type,
            amount=amount,
            entry_date=entry_date,
            payment_method=payment_method,
            reference_no=reference_no,
            note=note,
            actor=self.current_staff
        )
        return Response(EmployeeLedgerEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='reverse-entry')
    def reverse_entry_action(self, request):
        entry_id = request.data.get('entry_id')
        reason = request.data.get('reason', 'Administrative reversal')
        if not entry_id:
            return Response({'detail': 'entry_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rev = reverse_entry(entry_id=entry_id, reason=reason, actor=self.current_staff)
            return Response(EmployeeLedgerEntrySerializer(rev).data, status=status.HTTP_200_OK)
        except (ValueError, PermissionError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='correct-entry')
    def correct_entry_action(self, request):
        entry_id = request.data.get('entry_id')
        new_amount = request.data.get('new_amount')
        new_entry_type = request.data.get('new_entry_type')
        new_note = request.data.get('new_note', '')
        reason = request.data.get('reason', 'Correction')

        if not entry_id or new_amount is None:
            return Response({'detail': 'entry_id and new_amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rev, new_entry = correct_entry(
                entry_id=entry_id,
                new_amount=new_amount,
                new_entry_type=new_entry_type,
                new_note=new_note,
                reason=reason,
                actor=self.current_staff
            )
            return Response({
                'reversal_entry': EmployeeLedgerEntrySerializer(rev).data,
                'new_entry': EmployeeLedgerEntrySerializer(new_entry).data,
            }, status=status.HTTP_200_OK)
        except (ValueError, PermissionError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class StaffSyncViewSet(ManagerOrOwnerMixin, viewsets.ViewSet):
    """
    Staff synchronization from Staff & Roles app, and instant Demo Data seeding.
    """
    @action(detail=False, methods=['post'], url_path='sync-staff')
    def sync_staff_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first() if store_id else None
        res = sync_employees_from_staff_members(store=store)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='seed-demo')
    def seed_demo_action(self, request):
        store_id = self.get_effective_store_id(request)
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            res = seed_demo_payroll_data(store=store, actor=self.current_staff)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# PHASE 1: EMPLOYEE PORTAL — SELF-SERVICE PROFILE + PASSWORD RESET QUEUE
# ============================================================================


class EmployeePortalView(APIView):
    """
    Self-service profile endpoint for any authenticated staff member.
    GET  /api/staff/portal/me/       — returns full own profile
    PATCH /api/staff/portal/me/      — updates allowed fields (name, phone, photo)
                                       password is NOT changeable here
    """
    authentication_classes = []

    def _get_member(self, request):
        return get_current_staff(request)

    def get(self, request):
        member = self._get_member(request)
        if not member:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(StaffMemberSerializer(member, context={'request': request}).data)

    def patch(self, request):
        member = self._get_member(request)
        if not member:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Only allow updating safe profile fields — never password, role, store, section
        ALLOWED_FIELDS = {'name', 'phone', 'photo'}
        data = {}
        for field in ALLOWED_FIELDS:
            if field in request.data:
                data[field] = request.data[field]
            elif field in request.FILES:
                data[field] = request.FILES[field]

        if not data:
            return Response({'detail': 'No updatable fields provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Convert empty string / null photo to None so serializer clears it
        if 'photo' in data and data['photo'] in ('', 'null', 'none', False):
            data['photo'] = None

        serializer = StaffMemberSerializer(
            member, data=data, partial=True, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            # Keep synced Employee record if it exists
            try:
                emp = member.employee_profile
                if emp:
                    if 'name' in data:
                        emp.name = member.name
                    if 'phone' in data:
                        emp.phone = member.phone
                    if 'photo' in data:
                        if not member.photo and emp.photo:
                            try:
                                emp.photo.delete(save=False)
                            except Exception:
                                pass
                            emp.photo = None
                        elif member.photo:
                            emp.photo = member.photo
                    emp.save()
            except Exception:
                pass
            return Response(StaffMemberSerializer(member, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OwnerStaffDirectoryView(APIView):
    """
    Owner: list all staff members as directory cards (for the owner-facing staff list in the portal).
    GET /api/staff/portal/directory/
    """
    authentication_classes = []

    def get(self, request):
        member = get_current_staff(request)
        if not member:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not member.is_owner and not member.role.can_access_staff:
            return Response({'detail': 'Owner access required.'}, status=status.HTTP_403_FORBIDDEN)

        qs = StaffMember.objects.select_related('role', 'store', 'section').filter(is_active=True).order_by('name')
        store_id = request.query_params.get('store')
        if store_id:
            qs = qs.filter(store_id=store_id)

        return Response(StaffMemberSerializer(qs, many=True, context={'request': request}).data)


class EmployeeTaskViewSet(viewsets.ModelViewSet):
    """
    Phase 2: Employee Task Assignment & Photo Proof Verification Engine.
    - Owner/Admin creates actionable tasks for staff members with strict deadlines.
    - Employees can list their tasks, mark in progress, and submit photo proof + resolution write-off notes.
    - Owners/Admins verify proof (Verify & Close or Request Revision).
    """
    serializer_class = EmployeeTaskSerializer
    authentication_classes = []

    def _get_staff(self, request):
        return get_current_staff(request)

    def get_queryset(self):
        staff = self._get_staff(self.request)
        if not staff:
            return EmployeeTask.objects.none()

        qs = EmployeeTask.objects.select_related(
            'assigned_to', 'created_by', 'store', 'section', 'verified_by'
        )

        is_manager = staff.is_owner or (staff.role and staff.role.can_access_staff)

        if not is_manager:
            # Regular employee: strictly their own assigned tasks
            qs = qs.filter(assigned_to=staff)
        else:
            # Manager / Owner: can filter by assigned_to or store
            assigned_to = self.request.query_params.get('assigned_to')
            if assigned_to:
                qs = qs.filter(assigned_to_id=assigned_to)
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(store_id=store_id)
            elif staff.store_id and not staff.is_owner:
                qs = qs.filter(store_id=staff.store_id)

        # Common filters
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        priority_param = self.request.query_params.get('priority')
        if priority_param:
            qs = qs.filter(priority=priority_param)

        section_param = self.request.query_params.get('section')
        if section_param:
            qs = qs.filter(section_id=section_param)

        search_param = self.request.query_params.get('search')
        if search_param:
            qs = qs.filter(title__icontains=search_param)

        return qs

    def create(self, request, *args, **kwargs):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (staff.is_owner or (staff.role and staff.role.can_access_staff)):
            return Response({'detail': 'Only owners or managers can create tasks.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Resolve assigned staff
        assigned_to_id = data.get('assigned_to')
        if not assigned_to_id:
            return Response({'detail': 'Assigned staff member is required.'}, status=status.HTTP_400_BAD_REQUEST)

        assigned_staff = StaffMember.objects.filter(id=assigned_to_id, is_active=True).first()
        if not assigned_staff:
            return Response({'detail': 'Selected staff member does not exist or is inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        # Default store and section from assigned staff if not provided
        if not data.get('store'):
            if assigned_staff.store_id:
                data['store'] = assigned_staff.store_id
            elif staff.store_id:
                data['store'] = staff.store_id
            else:
                first_store = Store.objects.first()
                if first_store:
                    data['store'] = first_store.id
                else:
                    return Response({'detail': 'A store location must be selected.'}, status=status.HTTP_400_BAD_REQUEST)

        if not data.get('section') and assigned_staff.section_id:
            data['section'] = assigned_staff.section_id

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        task = serializer.save(created_by=staff)
        return Response(EmployeeTaskSerializer(task, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (staff.is_owner or (staff.role and staff.role.can_access_staff)):
            return Response({'detail': 'Only owners or managers can delete tasks.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.proof_image:
            try:
                instance.proof_image.delete(save=False)
            except Exception:
                pass
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='start')
    def start_action(self, request, pk=None):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        task = self.get_object()
        if task.assigned_to_id != staff.id and not (staff.is_owner or (staff.role and staff.role.can_access_staff)):
            return Response({'detail': 'You cannot start someone else’s task.'}, status=status.HTTP_403_FORBIDDEN)
        if task.status == EmployeeTask.STATUS_PENDING:
            task.status = EmployeeTask.STATUS_IN_PROGRESS
            task.save(update_fields=['status', 'updated_at'])
        return Response(EmployeeTaskSerializer(task, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_action(self, request, pk=None):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        task = self.get_object()
        if task.assigned_to_id != staff.id and not (staff.is_owner or (staff.role and staff.role.can_access_staff)):
            return Response({'detail': 'You can only submit tasks assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        proof_image = request.FILES.get('proof_image')
        write_off_notes = request.data.get('write_off_notes', '').strip()

        if not proof_image and not task.proof_image:
            return Response({'detail': 'Mandatory photographic proof image is required to complete this task.'}, status=status.HTTP_400_BAD_REQUEST)
        if not write_off_notes and not task.write_off_notes:
            return Response({'detail': 'Mandatory write-off completion notes are required.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if proof_image:
            if task.proof_image:
                try:
                    task.proof_image.delete(save=False)
                except Exception:
                    pass
            if hasattr(proof_image, 'read'):
                try:
                    from inventory.services import convert_image_to_webp
                    proof_image = convert_image_to_webp(proof_image)
                except Exception:
                    pass
            task.proof_image = proof_image
        if write_off_notes:
            task.write_off_notes = write_off_notes

        task.status = EmployeeTask.STATUS_SUBMITTED
        task.submitted_at = now
        task.is_on_time = bool(task.deadline and now <= task.deadline)
        task.save()
        return Response(EmployeeTaskSerializer(task, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='verify')
    def verify_action(self, request, pk=None):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (staff.is_owner or (staff.role and staff.role.can_access_staff)):
            return Response({'detail': 'Only owners or managers can verify tasks.'}, status=status.HTTP_403_FORBIDDEN)

        task = self.get_object()
        action_type = request.data.get('action')
        revision_notes = request.data.get('revision_notes', '').strip()

        if action_type == 'approve':
            task.status = EmployeeTask.STATUS_VERIFIED
            task.verified_at = timezone.now()
            task.verified_by = staff
            task.save(update_fields=['status', 'verified_at', 'verified_by', 'updated_at'])
        elif action_type == 'revision_needed':
            if not revision_notes:
                return Response({'detail': 'Please provide revision feedback explaining what needs improvement.'}, status=status.HTTP_400_BAD_REQUEST)
            task.status = EmployeeTask.STATUS_REVISION_NEEDED
            task.revision_notes = revision_notes
            task.save(update_fields=['status', 'revision_notes', 'updated_at'])
        else:
            return Response({'detail': "Invalid action. Must be 'approve' or 'revision_needed'."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(EmployeeTaskSerializer(task, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats_action(self, request):
        staff = self._get_staff(request)
        if not staff:
            return Response({'detail': 'Not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)

        qs = self.get_queryset()
        total = qs.count()
        pending = qs.filter(status=EmployeeTask.STATUS_PENDING).count()
        in_progress = qs.filter(status=EmployeeTask.STATUS_IN_PROGRESS).count()
        submitted = qs.filter(status=EmployeeTask.STATUS_SUBMITTED).count()
        verified = qs.filter(status=EmployeeTask.STATUS_VERIFIED).count()
        revision_needed = qs.filter(status=EmployeeTask.STATUS_REVISION_NEEDED).count()

        evaluated = qs.filter(submitted_at__isnull=False)
        on_time_count = evaluated.filter(is_on_time=True).count()
        total_evaluated = evaluated.count()
        on_time_percentage = round((on_time_count / total_evaluated * 100), 1) if total_evaluated > 0 else 100.0

        return Response({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'submitted': submitted,
            'verified': verified,
            'revision_needed': revision_needed,
            'on_time_percentage': on_time_percentage,
        })


