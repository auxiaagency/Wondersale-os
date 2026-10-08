from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Item, Category, SaleOrder, SaleOrderItem, CounterPayout, DailyRegisterShift
from staff.models import StaffRole, StaffMember


class RegisterShiftManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Store
        self.store = Store.objects.create(name='Downtown Branch', city='Metro City')

        # Staff
        self.role = StaffRole.objects.create(name='Cashier Tier', cashier_role='cashier')
        self.cashier = StaffMember.objects.create(
            staff_id='CASH_TEST',
            name='John Cashier',
            role=self.role,
            store=self.store
        )

        # Inventory Item
        self.item = Item.objects.create(
            uid='ITEM-001',
            name='Cotton T-Shirt',
            cost_price=Decimal('200.00'),
            selling_price=Decimal('500.00'),
            store=self.store
        )

    def test_open_shift_and_current_shift_flow(self):
        """Test opening day-start shift float and checking live status."""
        # 1. Open shift with ₹2,000 float
        open_res = self.client.post('/api/inventory/register-shifts/open-shift/', {
            'store': self.store.id,
            'opening_cash': '2000.00',
            'opening_notes': '10x100, 2x500 notes float',
            'cashier_name': 'John Cashier'
        }, format='json')
        self.assertEqual(open_res.status_code, status.HTTP_201_CREATED)



        shift_id = open_res.data['id']
        self.assertEqual(open_res.data['status'], 'open')
        self.assertEqual(float(open_res.data['opening_cash']), 2000.00)
        self.assertTrue(open_res.data['shift_number'].startswith('REG-'))

        # 2. Check current shift endpoint
        cur_res = self.client.get(f'/api/inventory/register-shifts/current-shift/?store={self.store.id}')
        self.assertEqual(cur_res.status_code, status.HTTP_200_OK)
        self.assertTrue(cur_res.data['has_open_shift'])
        self.assertEqual(cur_res.data['shift']['id'], shift_id)
        self.assertEqual(cur_res.data['shift']['live_cash_sales'], 0.0)
        self.assertEqual(cur_res.data['shift']['live_cash_payouts'], 0.0)
        self.assertEqual(cur_res.data['shift']['live_expected_cash'], 2000.00)

        # 3. Simulate Cash Sale of ₹1,500
        SaleOrder.objects.create(
            invoice_number='INV-TEST-99',
            store=self.store,
            customer_phone='9999999999',
            subtotal=Decimal('1500.00'),
            total_amount=Decimal('1500.00'),
            amount_paid=Decimal('1500.00'),
            payment_method='cash',
            status='completed'
        )

        # 4. Simulate Counter Cash Payout of ₹300 for tea/refreshment
        CounterPayout.objects.create(
            payout_number='PAY-TEST-99',
            store=self.store,
            amount=Decimal('300.00'),
            payment_method='cash',
            category='daily_expense',
            paid_to='Tea Vendor',
            paid_by_name='John Cashier'
        )

        # 5. Check live calculation on current shift
        cur_res2 = self.client.get(f'/api/inventory/register-shifts/current-shift/?store={self.store.id}')
        self.assertEqual(cur_res2.status_code, status.HTTP_200_OK)
        # Expected = 2000 + 1500 - 300 = 3200
        self.assertEqual(cur_res2.data['shift']['live_cash_sales'], 1500.00)
        self.assertEqual(cur_res2.data['shift']['live_cash_payouts'], 300.00)
        self.assertEqual(cur_res2.data['shift']['live_expected_cash'], 3200.00)

        # 6. Close Shift at Day-End with ₹3,200 counted (Exact match)
        close_res = self.client.post(f'/api/inventory/register-shifts/{shift_id}/close-shift/', {
            'closing_cash_counted': '3200.00',
            'closing_notes': 'Day-end drawer counted, balanced perfectly.',
            'closed_by_name': 'John Cashier'
        }, format='json')
        self.assertEqual(close_res.status_code, status.HTTP_200_OK)
        self.assertEqual(close_res.data['status'], 'closed')
        self.assertEqual(float(close_res.data['closing_cash_counted']), 3200.00)
        self.assertEqual(float(close_res.data['expected_cash']), 3200.00)
        self.assertEqual(float(close_res.data['cash_difference']), 0.00)

    def test_close_shift_with_discrepancy(self):
        """Test shift close when counted cash is short or over."""
        # Open shift with ₹1,000 float
        shift = DailyRegisterShift.objects.create(
            shift_number='REG-TEST-001',
            store=self.store,
            cashier_name='John Cashier',
            opening_cash=Decimal('1000.00'),
            status='open'
        )

        # Cash sale ₹500 -> Expected = ₹1,500
        SaleOrder.objects.create(
            invoice_number='INV-TEST-002',
            store=self.store,
            customer_phone='9999999999',
            subtotal=Decimal('500.00'),
            total_amount=Decimal('500.00'),
            amount_paid=Decimal('500.00'),
            payment_method='cash',
            status='completed'
        )

        # Counted ₹1,450 (Shortage of -₹50)
        close_res = self.client.post(f'/api/inventory/register-shifts/{shift.id}/close-shift/', {
            'closing_cash_counted': '1450.00',
            'closing_notes': 'Short ₹50 due to change discrepancy',
            'closed_by_name': 'John Cashier'
        }, format='json')
        self.assertEqual(close_res.status_code, status.HTTP_200_OK)
        self.assertEqual(float(close_res.data['cash_difference']), -50.00)
