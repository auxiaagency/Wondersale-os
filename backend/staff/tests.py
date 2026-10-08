from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from staff.models import StaffRole, StaffMember
from staff.services import ensure_default_roles_and_owner, authenticate_staff


class StaffModelAndServiceTests(TestCase):
    def setUp(self):
        self.owner = ensure_default_roles_and_owner()

    def test_default_roles_and_owner_created(self):
        self.assertIsNotNone(self.owner)
        self.assertEqual(self.owner.staff_id, 'Salman')
        self.assertTrue(self.owner.role.is_owner)
        self.assertTrue(self.owner.check_password('7869186388'))

        cashier_role = StaffRole.objects.get(name='Cashier')
        self.assertFalse(cashier_role.is_owner)
        self.assertTrue(cashier_role.can_access_inventory)
        self.assertFalse(cashier_role.can_access_staff)

    def test_authenticate_staff(self):
        # Valid credentials
        auth_success = authenticate_staff('Salman', '7869186388')
        self.assertIsNotNone(auth_success)
        self.assertEqual(auth_success.staff_id, 'Salman')
        self.assertIsNotNone(auth_success.last_login)

        # Invalid password
        auth_fail = authenticate_staff('Salman', 'wrongpass')
        self.assertIsNone(auth_fail)

        # Inactive staff
        self.owner.is_active = False
        self.owner.save()
        auth_inactive = authenticate_staff('Salman', '7869186388')
        self.assertIsNone(auth_inactive)


class StaffAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = ensure_default_roles_and_owner()

        self.cashier_role = StaffRole.objects.get(name='Cashier')
        self.cashier = StaffMember(
            staff_id='CASHIER01',
            name='Sarah Jenkins',
            role=self.cashier_role,
            is_active=True
        )
        self.cashier.set_password('cashier123')
        self.cashier.save()

    def test_login_api_success(self):
        url = reverse('staff-auth-login-action')
        response = self.client.post(url, {
            'staff_id': 'Salman',
            'password': '7869186388'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['staff']['staff_id'], 'Salman')
        self.assertTrue(response.data['staff']['is_owner'])

    def test_login_api_failure(self):
        url = reverse('staff-auth-login-action')
        response = self.client.post(url, {
            'staff_id': 'Salman',
            'password': 'badpassword'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_only_roles_management(self):
        roles_url = reverse('staff-role-list')

        # 1. Unauthenticated request -> fails with 403
        resp_unauth = self.client.get(roles_url)
        self.assertEqual(resp_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Non-owner (cashier) request -> forbidden
        resp_cashier = self.client.get(roles_url, HTTP_X_STAFF_ID='CASHIER01')
        self.assertEqual(resp_cashier.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Owner request -> success
        resp_owner = self.client.get(roles_url, HTTP_X_STAFF_ID='Salman')
        self.assertEqual(resp_owner.status_code, status.HTTP_200_OK)
        self.assertTrue(len(resp_owner.data) >= 2)

    def test_owner_can_create_new_role_and_staff(self):
        roles_url = reverse('staff-role-list')
        new_role_payload = {
            'name': 'Senior Supervisor',
            'description': 'Supervisor with inventory stock adjustment privileges.',
            'can_access_inventory': True,
            'can_adjust_stock': True,
            'can_access_billing': True,
            'can_access_staff': False
        }
        role_resp = self.client.post(roles_url, new_role_payload, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(role_resp.status_code, status.HTTP_201_CREATED)
        new_role_id = role_resp.data['id']

        # Create staff under this role
        members_url = reverse('staff-member-list')
        staff_payload = {
            'staff_id': 'SUP001',
            'name': 'Alex Rivera',
            'password': 'supervisor123',
            'role': new_role_id,
            'phone': '+91 98765 43210'
        }
        staff_resp = self.client.post(members_url, staff_payload, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(staff_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(staff_resp.data['staff_id'], 'SUP001')

        # Verify created staff can authenticate
        alex = authenticate_staff('SUP001', 'supervisor123')
        self.assertIsNotNone(alex)
        self.assertEqual(alex.role.name, 'Senior Supervisor')
        self.assertTrue(alex.role.can_adjust_stock)

    def test_allowed_modules_configuration_and_isolation(self):
        roles_url = reverse('staff-role-list')

        # 1. Owner creates a cashier role with ONLY billing button allowed
        custom_role_payload = {
            'name': 'Only Accounting Clerk',
            'description': 'Can only see accounting button in the menu.',
            'allowed_modules': ['accounting'],
            'can_adjust_stock': False,
        }
        role_resp = self.client.post(roles_url, custom_role_payload, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(role_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(role_resp.data['allowed_modules'], ['accounting'])
        self.assertFalse(role_resp.data['can_access_inventory'])
        self.assertFalse(role_resp.data['can_access_billing'])
        self.assertFalse(role_resp.data['can_access_staff'])
        role_id = role_resp.data['id']

        # 2. Create staff member under this role
        members_url = reverse('staff-member-list')
        staff_payload = {
            'staff_id': 'ACC01',
            'name': 'Only Accounting User',
            'password': 'password123',
            'role': role_id,
            'phone': '+91 98765 12345'
        }
        staff_resp = self.client.post(members_url, staff_payload, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(staff_resp.status_code, status.HTTP_201_CREATED)

        # 3. Staff logs in and inspects role_details
        login_url = reverse('staff-auth-login-action')
        login_resp = self.client.post(login_url, {
            'staff_id': 'ACC01',
            'password': 'password123'
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        staff_data = login_resp.data['staff']
        self.assertEqual(staff_data['role_details']['allowed_modules'], ['accounting'])

        # 4. Verify Owner always has all 8 modules
        owner_login_resp = self.client.post(login_url, {
            'staff_id': 'Salman',
            'password': '7869186388'
        }, format='json')
        self.assertEqual(owner_login_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(owner_login_resp.data['staff']['role_details']['allowed_modules']), 8)

        # 5. Verify direct URL/API access to inventory is forbidden for staff without inventory/billing permission
        inventory_items_url = reverse('item-list')
        inv_resp_acc_user = self.client.get(inventory_items_url, HTTP_X_STAFF_ID='ACC01')
        self.assertEqual(inv_resp_acc_user.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Verify Owner has full access to inventory items
        inv_resp_owner = self.client.get(inventory_items_url, HTTP_X_STAFF_ID='Salman')
        self.assertEqual(inv_resp_owner.status_code, status.HTTP_200_OK)

    def test_store_location_login_restriction_and_data_isolation(self):
        from inventory.models import Store, Item

        # Create two stores
        store_bhopal = Store.objects.create(name='Bhopal Main', city='Bhopal', pincode='462011')
        store_indore = Store.objects.create(name='Indore Branch', city='Indore', pincode='452010')

        # Create items in both stores
        item_bhopal = Item.objects.create(
            uid='9000101',
            name='Bhopal Shirt',
            store=store_bhopal,
            cost_price=500,
            selling_price=999,
            quantity=10
        )
        item_indore = Item.objects.create(
            uid='9000102',
            name='Indore Jeans',
            store=store_indore,
            cost_price=800,
            selling_price=1499,
            quantity=15
        )

        # Create staff assigned strictly to Bhopal
        bhopal_staff = StaffMember(
            staff_id='BHOPAL_STAFF',
            name='Ramesh Bhopal',
            role=self.cashier_role,
            store=store_bhopal,
            is_active=True
        )
        bhopal_staff.set_password('pass123')
        bhopal_staff.save()

        login_url = reverse('staff-auth-login-action')

        # 1. Staff tries to log into Indore (wrong location) -> 403 Forbidden
        wrong_login_resp = self.client.post(login_url, {
            'staff_id': 'BHOPAL_STAFF',
            'password': 'pass123',
            'store_id': store_indore.id
        }, format='json')
        self.assertEqual(wrong_login_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Access Denied', wrong_login_resp.data['detail'])

        # 2. Staff logs into Bhopal (assigned location) -> 200 OK
        correct_login_resp = self.client.post(login_url, {
            'staff_id': 'BHOPAL_STAFF',
            'password': 'pass123',
            'store_id': store_bhopal.id
        }, format='json')
        self.assertEqual(correct_login_resp.status_code, status.HTTP_200_OK)

        # 3. Staff fetches inventory items -> ONLY sees Bhopal items, NEVER Indore items
        inventory_items_url = reverse('item-list')
        inv_resp = self.client.get(inventory_items_url, HTTP_X_STAFF_ID='BHOPAL_STAFF')
        self.assertEqual(inv_resp.status_code, status.HTTP_200_OK)
        item_names = [item['name'] for item in inv_resp.data]
        self.assertIn('Bhopal Shirt', item_names)
        self.assertNotIn('Indore Jeans', item_names)

        # 4. Even if staff attempts query param store=indore -> backend still restricts to Bhopal
        inv_resp_override = self.client.get(f"{inventory_items_url}?store={store_indore.id}", HTTP_X_STAFF_ID='BHOPAL_STAFF')
        self.assertEqual(inv_resp_override.status_code, status.HTTP_200_OK)
        item_names_override = [item['name'] for item in inv_resp_override.data]
        self.assertIn('Bhopal Shirt', item_names_override)
        self.assertNotIn('Indore Jeans', item_names_override)

        # 5. Owner can log into any store location
        owner_login_resp = self.client.post(login_url, {
            'staff_id': 'Salman',
            'password': '7869186388',
            'store_id': store_indore.id
        }, format='json')
        self.assertEqual(owner_login_resp.status_code, status.HTTP_200_OK)

    def test_staff_section_optional_assignment(self):
        """Verify section field is optional, can be left blank, or assigned a custom department/section."""
        from staff.serializers import StaffMemberSerializer
        from inventory.models import Section, Store

        store = Store.objects.create(name='Test Store for Sections')
        menswear_sec = Section.objects.create(name='Menswear', store=store)
        electronics_sec = Section.objects.create(name='Electronics & Gadgets', store=store)

        # 1. Create staff with section assigned (e.g. Sales Associate in Menswear)
        staff_with_sec = StaffMember.objects.create(
            staff_id='SALES01',
            name='Rohit Sharma',
            role=self.cashier_role,
            section=menswear_sec,
            is_active=True
        )
        staff_with_sec.set_password('pass123')
        staff_with_sec.save()

        # 2. Create cashier/owner with NO section assigned (left empty)
        staff_without_sec = StaffMember.objects.create(
            staff_id='CASHIER_NO_SEC',
            name='Priya Patel',
            role=self.cashier_role,
            is_active=True
        )
        staff_without_sec.set_password('pass123')
        staff_without_sec.save()

        self.assertEqual(staff_with_sec.section, menswear_sec)
        self.assertIsNone(staff_without_sec.section)

        # 3. Test API creation via StaffMemberSerializer with and without section
        serializer_with = StaffMemberSerializer(data={
            'staff_id': 'STAFF_API_1',
            'name': 'Amit Kumar',
            'password': 'password123',
            'role': self.cashier_role.id,
            'section': electronics_sec.id,
            'phone': '+91 98765 00001'
        })
        self.assertTrue(serializer_with.is_valid(), serializer_with.errors)
        obj1 = serializer_with.save()
        self.assertEqual(obj1.section, electronics_sec)

        # Empty/omitted section for cashier/owner
        serializer_empty = StaffMemberSerializer(data={
            'staff_id': 'STAFF_API_2',
            'name': 'Kavita Roy',
            'password': 'password123',
            'role': self.cashier_role.id,
            'phone': '+91 98765 00002'
        })
        self.assertTrue(serializer_empty.is_valid(), serializer_empty.errors)
        obj2 = serializer_empty.save()
        self.assertIsNone(obj2.section)

    def test_manual_attendance_entry_api(self):
        """Test POST /api/staff/attendance/daily/manual-entry/ endpoint."""
        from inventory.models import Store
        from staff.models import Employee, AttendanceDay
        from datetime import date
        store = Store.objects.create(name="Matrix Test Store", timezone="Asia/Kolkata")
        emp = Employee.objects.create(
            store=store,
            employee_code="MAT_01",
            name="Rohan Das",
            join_date=date(2026, 1, 1),
            is_active=True
        )

        url = reverse('staff-daily-attendance-manual-entry')
        payload = {
            'employee_id': emp.id,
            'date': '2026-06-15',
            'status': 'present',
            'in_time': '09:30',
            'out_time': '18:30',
            'reason': 'System reader was offline during morning shift'
        }

        # 1. Unauthenticated fails
        resp_unauth = self.client.post(url, payload, format='json')
        self.assertEqual(resp_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Authenticated owner succeeds
        resp = self.client.post(url, payload, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['status'], 'present')
        self.assertEqual(resp.data['worked_minutes'], 540)
        self.assertIn('manual_override', resp.data['flags'])
        self.assertEqual(resp.data['override_reason'], 'System reader was offline during morning shift')

    def test_password_change_invalidates_active_sessions(self):
        login_url = reverse('staff-auth-login-action')
        me_url = reverse('staff-auth-me-action')

        # 1. Cashier logs in and receives a session token
        login_resp = self.client.post(login_url, {
            'staff_id': 'CASHIER01',
            'password': 'cashier123'
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('session_token', login_resp.data)
        old_token = login_resp.data['session_token']
        self.assertTrue(len(old_token) >= 32)

        # 2. Access 'me' endpoint with valid session token
        me_resp = self.client.get(me_url, HTTP_X_STAFF_ID='CASHIER01', HTTP_X_SESSION_TOKEN=old_token)
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)

        # 3. Owner updates Cashier's password
        member_url = reverse('staff-member-detail', args=[self.cashier.id])
        update_resp = self.client.patch(member_url, {
            'password': 'newsecretpassword999'
        }, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)

        # 4. Old device with old session token is immediately rejected with 401
        me_resp_old = self.client.get(me_url, HTTP_X_STAFF_ID='CASHIER01', HTTP_X_SESSION_TOKEN=old_token)
        self.assertEqual(me_resp_old.status_code, status.HTTP_401_UNAUTHORIZED)

        # 5. Cashier logs in with new password and receives new session token
        login_new = self.client.post(login_url, {
            'staff_id': 'CASHIER01',
            'password': 'newsecretpassword999'
        }, format='json')
        self.assertEqual(login_new.status_code, status.HTTP_200_OK)
        new_token = login_new.data['session_token']
        self.assertNotEqual(old_token, new_token)

        me_resp_new = self.client.get(me_url, HTTP_X_STAFF_ID='CASHIER01', HTTP_X_SESSION_TOKEN=new_token)
        self.assertEqual(me_resp_new.status_code, status.HTTP_200_OK)

        # 6. Admin triggers explicit session revocation for Cashier
        revoke_url = reverse('staff-member-revoke-sessions', args=[self.cashier.id])
        revoke_resp = self.client.post(revoke_url, format='json', HTTP_X_STAFF_ID='Salman')
        self.assertEqual(revoke_resp.status_code, status.HTTP_200_OK)

        # 7. Device holding previous token is now rejected with 401
        me_revoked = self.client.get(me_url, HTTP_X_STAFF_ID='CASHIER01', HTTP_X_SESSION_TOKEN=new_token)
        self.assertEqual(me_revoked.status_code, status.HTTP_401_UNAUTHORIZED)


class InterimSettlementOvertimeGuardTestCase(TestCase):
    def setUp(self):
        from decimal import Decimal
        from datetime import date
        from inventory.models import Store
        from staff.models import Employee, AttendanceDay, SalaryStructure

        self.store = Store.objects.create(name="Test Main Store", city="Bhopal", pincode="462011")
        self.employee = Employee.objects.create(
            store=self.store,
            employee_code="EMP001",
            name="Alice Smith",
            is_active=True,
            join_date=date(2026, 1, 1),
        )
        self.structure = SalaryStructure.objects.create(
            employee=self.employee,
            mode=SalaryStructure.MODE_MONTHLY,
            amount=Decimal("30000.00"),
            from_date=date(2026, 1, 1),
        )
        self.attendance_day = AttendanceDay.objects.create(
            employee=self.employee,
            store=self.store,
            business_date=date(2026, 10, 1),
            status=AttendanceDay.STATUS_PRESENT,
            day_fraction_paid=Decimal("1.0"),
            overtime_minutes=60,
            ot_verified=False,
            is_settled=False,
        )

    def test_interim_settlement_blocked_when_unverified_ot_and_flag_false(self):
        from staff.services.settlement import settle_interim_payroll

        settlements = [
            {
                "employee_id": self.employee.id,
                "action": "ledger_only",
                "payment_method": "cash",
            }
        ]
        with self.assertRaises(ValueError) as ctx:
            settle_interim_payroll(self.store, settlements, proceed_with_unreviewed=False)

        self.assertIn("unverified overtime", str(ctx.exception).lower())

    def test_interim_settlement_allowed_when_proceed_with_unreviewed_true(self):
        from staff.services.settlement import settle_interim_payroll

        settlements = [
            {
                "employee_id": self.employee.id,
                "action": "ledger_only",
                "payment_method": "cash",
            }
        ]
        results = settle_interim_payroll(self.store, settlements, proceed_with_unreviewed=True)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "settled")
        self.attendance_day.refresh_from_db()
        self.assertTrue(self.attendance_day.is_settled)

    def test_interim_settlement_allowed_once_ot_verified(self):
        from staff.services.settlement import settle_interim_payroll

        self.attendance_day.ot_verified = True
        self.attendance_day.save()

        settlements = [
            {
                "employee_id": self.employee.id,
                "action": "ledger_only",
                "payment_method": "cash",
            }
        ]
        results = settle_interim_payroll(self.store, settlements, proceed_with_unreviewed=False)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "settled")
        self.attendance_day.refresh_from_db()
        self.assertTrue(self.attendance_day.is_settled)


class EmployeeTaskTests(TestCase):
    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from inventory.models import Store, Section
        from staff.models import EmployeeTask
        from django.utils import timezone
        from datetime import timedelta

        self.client = APIClient()
        self.owner = ensure_default_roles_and_owner()
        self.store = Store.objects.create(name="Plaza Store")
        self.section = Section.objects.create(name="Toys & Games", code="TOY", store=self.store)

        cashier_role = StaffRole.objects.get(name='Cashier')
        self.employee = StaffMember.objects.create(
            staff_id="EMP01",
            name="John Worker",
            role=cashier_role,
            store=self.store,
            section=self.section,
            phone="+91 98765 43210"
        )
        self.employee.set_password("pass123")
        self.employee.save()

        self.deadline = timezone.now() + timedelta(days=2)

    def test_owner_can_create_task(self):
        self.client.credentials(HTTP_X_STAFF_ID=self.owner.staff_id)
        resp = self.client.post('/api/staff/tasks/', {
            'assigned_to': self.employee.id,
            'title': 'Organize Toy Aisle',
            'description': 'Ensure all doll boxes are facing forward.',
            'deadline': self.deadline.isoformat(),
            'priority': 'high',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['title'], 'Organize Toy Aisle')
        self.assertEqual(resp.data['status'], 'pending')
        self.assertEqual(resp.data['priority'], 'high')

    def test_employee_cannot_create_task(self):
        self.client.credentials(HTTP_X_STAFF_ID=self.employee.staff_id)
        resp = self.client.post('/api/staff/tasks/', {
            'assigned_to': self.employee.id,
            'title': 'Self Task',
            'deadline': self.deadline.isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_task_lifecycle_submit_and_verify(self):
        from staff.models import EmployeeTask
        from django.core.files.uploadedfile import SimpleUploadedFile

        task = EmployeeTask.objects.create(
            assigned_to=self.employee,
            created_by=self.owner,
            store=self.store,
            section=self.section,
            title='Restock Shelves',
            deadline=self.deadline,
        )

        # 1. Employee starts task
        self.client.credentials(HTTP_X_STAFF_ID=self.employee.staff_id)
        start_resp = self.client.post(f'/api/staff/tasks/{task.id}/start/')
        self.assertEqual(start_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(start_resp.data['status'], 'in_progress')

        # 2. Submission without photo or notes is rejected
        sub_fail = self.client.post(f'/api/staff/tasks/{task.id}/submit/', {}, format='multipart')
        self.assertEqual(sub_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Submission with photo and notes succeeds
        dummy_image = SimpleUploadedFile("proof.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", content_type="image/png")
        sub_ok = self.client.post(f'/api/staff/tasks/{task.id}/submit/', {
            'proof_image': dummy_image,
            'write_off_notes': 'All 5 shelves restocked and cleaned completely.',
        }, format='multipart')
        self.assertEqual(sub_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_ok.data['status'], 'submitted')
        self.assertTrue(sub_ok.data['is_on_time'])
        self.assertIsNotNone(sub_ok.data['submitted_at'])

        # 4. Owner verifies task
        self.client.credentials(HTTP_X_STAFF_ID=self.owner.staff_id)
        verify_resp = self.client.post(f'/api/staff/tasks/{task.id}/verify/', {
            'action': 'approve',
        }, format='json')
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_resp.data['status'], 'verified')
        self.assertEqual(verify_resp.data['verified_by_name'], self.owner.name)

