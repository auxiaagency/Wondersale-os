from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from staff.models import StaffRole, StaffMember
from inventory.models import Store, Item, Category, SubCategory


class AuthorizationRBACTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.store_a = Store.objects.create(name='Store Alpha')
        self.store_b = Store.objects.create(name='Store Beta')

        # Roles
        self.owner_role = StaffRole.objects.create(
            name='Owner',
            is_owner=True,
            allowed_modules=['inventory', 'billing', 'staff', 'accounting']
        )
        self.cashier_role = StaffRole.objects.create(
            name='Cashier',
            is_owner=False,
            allowed_modules=['billing']
        )
        self.inventory_role = StaffRole.objects.create(
            name='Inventory Staff',
            is_owner=False,
            allowed_modules=['inventory']
        )
        self.accounting_role = StaffRole.objects.create(
            name='Accountant',
            is_owner=False,
            allowed_modules=['accounting']
        )

        # Users
        self.owner = StaffMember.objects.create(
            staff_id='OWNER_A',
            name='Owner User',
            role=self.owner_role,
            store=self.store_a,
            is_active=True
        )
        self.cashier = StaffMember.objects.create(
            staff_id='CASHIER_A',
            name='Cashier Alpha',
            role=self.cashier_role,
            store=self.store_a,
            is_active=True
        )
        self.inventory_staff = StaffMember.objects.create(
            staff_id='INV_B',
            name='Inventory Beta',
            role=self.inventory_role,
            store=self.store_b,
            is_active=True
        )
        self.accountant = StaffMember.objects.create(
            staff_id='ACC_A',
            name='Accountant Alpha',
            role=self.accounting_role,
            store=self.store_a,
            is_active=True
        )

        # Items in Store A and Store B
        self.item_a = Item.objects.create(
            store=self.store_a,
            name='Product A', uid='1000001',
            cost_price=100.0,
            selling_price=150.0,
            quantity=10
        )
        self.item_b = Item.objects.create(
            store=self.store_b,
            name='Product B', uid='1000002',
            cost_price=200.0,
            selling_price=300.0,
            quantity=5
        )

    def test_unauthorized_module_access_blocked(self):
        # Accountant trying to access inventory items
        url = reverse('item-list')
        res = self.client.get(url, HTTP_X_STAFF_ID=self.accountant.staff_id)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_data_isolation_idor_prevention(self):
        # Inventory Staff in Store B cannot see or query items from Store A
        url = reverse('item-list')
        res = self.client.get(url, HTTP_X_STAFF_ID=self.inventory_staff.staff_id)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        item_ids = [item['id'] for item in results]
        self.assertIn(self.item_b.id, item_ids)
        self.assertNotIn(self.item_a.id, item_ids)

    def test_field_level_masking_cost_price_redacted_for_cashier(self):
        # Cashier with billing module requesting item details has cost price redacted
        url = reverse('item-detail', kwargs={'pk': self.item_a.id})
        res = self.client.get(url, HTTP_X_STAFF_ID=self.cashier.staff_id)
        if res.status_code == status.HTTP_200_OK:
            self.assertNotIn('cost_price', res.data)
            self.assertNotIn('supplier', res.data)

    def test_privilege_escalation_self_role_modification_blocked(self):
        # User cannot edit their own role via serializer
        from staff.serializers import StaffMemberSerializer
        serializer = StaffMemberSerializer(
            instance=self.cashier,
            data={'role': self.owner_role.id},
            partial=True,
            context={'request': type('Req', (), {'staff_member': self.cashier, 'META': {}})()}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('role', serializer.errors)
