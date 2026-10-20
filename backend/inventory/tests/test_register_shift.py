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

    def test_cashier_shift_isolation_and_cross_closing_prevention(self):
        """Ensure Cashier A's shift is not visible or closable by Cashier B."""
        cashier_b = StaffMember.objects.create(
            staff_id='CASH_TEST_2',
            name='Alice Cashier',
            role=self.role,
            store=self.store
        )

        # 1. Cashier A opens a shift
        open_res = self.client.post('/api/inventory/register-shifts/open-shift/', {
            'store': self.store.id,
            'opening_cash': '1000.00',
            'opening_notes': 'Morning register float'
        }, format='json', HTTP_X_STAFF_ID=self.cashier.staff_id)
        self.assertEqual(open_res.status_code, status.HTTP_201_CREATED)
        shift_a_id = open_res.data['id']
        self.assertEqual(open_res.data['cashier'], self.cashier.id)

        # 2. Cashier A checks current shift -> sees active shift
        cur_a = self.client.get(
            f'/api/inventory/register-shifts/current-shift/?store={self.store.id}',
            HTTP_X_STAFF_ID=self.cashier.staff_id
        )
        self.assertEqual(cur_a.status_code, status.HTTP_200_OK)
        self.assertTrue(cur_a.data['has_open_shift'])
        self.assertEqual(cur_a.data['shift']['id'], shift_a_id)

        # 3. Cashier B checks current shift -> should NOT see Cashier A's shift
        cur_b = self.client.get(
            f'/api/inventory/register-shifts/current-shift/?store={self.store.id}',
            HTTP_X_STAFF_ID=cashier_b.staff_id
        )
        self.assertEqual(cur_b.status_code, status.HTTP_200_OK)
        self.assertFalse(cur_b.data['has_open_shift'])
        self.assertIsNone(cur_b.data['shift'])

        # 4. Cashier B attempts to close Cashier A's shift -> 403 Forbidden
        close_b_attempt = self.client.post(
            f'/api/inventory/register-shifts/{shift_a_id}/close-shift/',
            {'closing_cash_counted': '1000.00', 'closing_notes': 'Unauthorized close attempt'},
            format='json',
            HTTP_X_STAFF_ID=cashier_b.staff_id
        )
        self.assertEqual(close_b_attempt.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('permission', close_b_attempt.data['error'].lower())

        # 5. Cashier A can close their own shift
        close_a = self.client.post(
            f'/api/inventory/register-shifts/{shift_a_id}/close-shift/',
            {'closing_cash_counted': '1000.00', 'closing_notes': 'End of shift'},
            format='json',
            HTTP_X_STAFF_ID=self.cashier.staff_id
        )
        self.assertEqual(close_a.status_code, status.HTTP_200_OK)
        self.assertEqual(close_a.data['status'], 'closed')

    def test_owner_can_close_cashier_shift(self):
        """Ensure Store Owner / Head Cashier has administrative privilege to close another cashier's shift."""
        owner_role = StaffRole.objects.create(name='Owner', is_owner=True)
        owner_staff = StaffMember.objects.create(
            staff_id='OWNER_01',
            name='Store Boss',
            role=owner_role,
            store=self.store
        )

        # Cashier A opens a shift
        open_res = self.client.post('/api/inventory/register-shifts/open-shift/', {
            'store': self.store.id,
            'opening_cash': '1500.00',
        }, format='json', HTTP_X_STAFF_ID=self.cashier.staff_id)
        shift_id = open_res.data['id']

        # Owner closes Cashier A's shift -> succeeds
        close_res = self.client.post(
            f'/api/inventory/register-shifts/{shift_id}/close-shift/',
            {'closing_cash_counted': '1500.00', 'closing_notes': 'Manager audit close'},
            format='json',
            HTTP_X_STAFF_ID=owner_staff.staff_id
        )
        self.assertEqual(close_res.status_code, status.HTTP_200_OK)
        self.assertEqual(close_res.data['status'], 'closed')

    def test_shift_cash_sales_isolated_per_cashier(self):
        """Ensure Cashier A's register drawer only sums Cashier A's sales, not Cashier B's sales."""
        cashier_b = StaffMember.objects.create(
            staff_id='CASH_TEST_B',
            name='Bob Cashier',
            role=self.role,
            store=self.store
        )

        # Cashier A opens shift
        open_a = self.client.post('/api/inventory/register-shifts/open-shift/', {
            'store': self.store.id,
            'opening_cash': '500.00'
        }, format='json', HTTP_X_STAFF_ID=self.cashier.staff_id)
        shift_a_id = open_a.data['id']

        # Sale by Cashier A: ₹800
        SaleOrder.objects.create(
            invoice_number='INV-CASH-A',
            store=self.store,
            cashier=self.cashier,
            customer_phone='9999999991',
            subtotal=Decimal('800.00'),
            total_amount=Decimal('800.00'),
            amount_paid=Decimal('800.00'),
            payment_method='cash',
            status='completed'
        )

        # Sale by Cashier B: ₹1200
        SaleOrder.objects.create(
            invoice_number='INV-CASH-B',
            store=self.store,
            cashier=cashier_b,
            customer_phone='9999999992',
            subtotal=Decimal('1200.00'),
            total_amount=Decimal('1200.00'),
            amount_paid=Decimal('1200.00'),
            payment_method='cash',
            status='completed'
        )

        # Current shift for Cashier A should only count 500 + 800 = 1300
        cur_a = self.client.get(
            f'/api/inventory/register-shifts/current-shift/?store={self.store.id}',
            HTTP_X_STAFF_ID=self.cashier.staff_id
        )
        self.assertEqual(cur_a.data['shift']['live_cash_sales'], 800.00)
        self.assertEqual(cur_a.data['shift']['live_expected_cash'], 1300.00)

        # Shift billing orders endpoint should also only return Cashier A's orders
        orders_a = self.client.get(
            f'/api/inventory/sales/?store={self.store.id}&current_shift=true&register_shift={shift_a_id}',
            HTTP_X_STAFF_ID=self.cashier.staff_id
        )
        self.assertEqual(orders_a.status_code, status.HTTP_200_OK)
        order_list = orders_a.data if isinstance(orders_a.data, list) else orders_a.data.get('results', [])
        order_invoices = [o['invoice_number'] for o in order_list]
        self.assertIn('INV-CASH-A', order_invoices)
        self.assertNotIn('INV-CASH-B', order_invoices)

    def test_edit_sale_order_item_rate_and_discount_in_open_shift(self):
        """Verify modifying line item selling price and bill discount in open shift preserves audit integrity."""
        from inventory.models import Item, SaleOrderItem, StockMovement

        # Open shift
        open_res = self.client.post('/api/inventory/register-shifts/open-shift/', {
            'store': self.store.id,
            'opening_cash': '1000.00',
        }, format='json', HTTP_X_STAFF_ID=self.cashier.staff_id)
        self.assertEqual(open_res.status_code, status.HTTP_201_CREATED)

        item = Item.objects.create(
            name='Test Cream',
            store=self.store,
            selling_price=Decimal('200.00'),
            cost_price=Decimal('100.00'),
            quantity=10
        )

        # Initial sale: 2 units @ ₹200 = ₹400
        order = SaleOrder.objects.create(
            invoice_number='INV-DISC-TEST',
            store=self.store,
            cashier=self.cashier,
            subtotal=Decimal('400.00'),
            tax_amount=Decimal('0.00'),
            discount_amount=Decimal('0.00'),
            total_amount=Decimal('400.00'),
            amount_paid=Decimal('400.00'),
            payment_method='cash',
            status='completed'
        )
        SaleOrderItem.objects.create(
            sale_order=order,
            item=item,
            item_name=item.name,
            quantity=2,
            unit_selling_price=Decimal('200.00'),
            total_price=Decimal('400.00')
        )
        StockMovement.objects.create(
            item=item,
            change=-2,
            reason=StockMovement.REASON_SALE,
            note=f"POS Sale #{order.invoice_number}"
        )

        # Update order: change rate from ₹200 to ₹180, and add ₹30 discount
        # New expected subtotal = 2 * 180 = 360, total = 360 - 30 = 330
        patch_res = self.client.patch(f'/api/inventory/sales/{order.id}/', {
            'payment_method': 'cash',
            'discount_amount': '30.00',
            'notes': 'Given price discount on cream',
            'items': [
                {
                    'item_id': item.id,
                    'quantity': 2,
                    'unit_selling_price': '180.00',
                }
            ]
        }, format='json', HTTP_X_STAFF_ID=self.cashier.staff_id)

        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.subtotal, Decimal('360.00'))
        self.assertEqual(order.discount_amount, Decimal('30.00'))
        self.assertEqual(order.total_amount, Decimal('330.00'))
        self.assertEqual(order.amount_paid, Decimal('330.00'))

    def test_same_shift_bills_are_editable_closed_shift_bills_are_locked(self):
        """
        Bills created during the current open shift must be editable (is_editable=True).
        Bills from a closed shift must be permanently locked (is_editable=False).
        Return/exchange invoices are always locked regardless of shift status.
        """
        from inventory.serializers import SaleOrderSerializer

        # --- Open a shift for this cashier ---
        shift = DailyRegisterShift.objects.create(
            shift_number='REG-LOCK-TEST-001',
            store=self.store,
            cashier=self.cashier,
            cashier_name=self.cashier.name,
            opening_cash=Decimal('1000.00'),
            status='open',
        )

        # Bill created during the open shift (stamped with FK)
        order_in_shift = SaleOrder.objects.create(
            invoice_number='INV-LOCK-001',
            store=self.store,
            cashier=self.cashier,
            cashier_name=self.cashier.name,
            customer_phone='9876543210',
            subtotal=Decimal('600.00'),
            total_amount=Decimal('600.00'),
            amount_paid=Decimal('600.00'),
            payment_method='cash',
            status='completed',
            register_shift=shift,
        )

        serializer = SaleOrderSerializer(order_in_shift)
        self.assertTrue(
            serializer.data['is_editable'],
            "Bill in the same open shift must be editable"
        )

        # Return/exchange invoices must always be locked
        return_order = SaleOrder.objects.create(
            invoice_number='RET-LOCK-001',
            store=self.store,
            cashier=self.cashier,
            cashier_name=self.cashier.name,
            customer_phone='9876543210',
            subtotal=Decimal('600.00'),
            total_amount=Decimal('600.00'),
            amount_paid=Decimal('0.00'),
            payment_method='cash',
            status='refunded',
            return_reference='INV-LOCK-001',
            register_shift=shift,
        )
        ret_serializer = SaleOrderSerializer(return_order)
        self.assertFalse(
            ret_serializer.data['is_editable'],
            "Return/refund invoice must always be locked"
        )

        # Close the shift
        shift.status = 'closed'
        shift.save(update_fields=['status', 'updated_at'])

        # Refresh the order — shift is now closed, must be locked
        order_in_shift.refresh_from_db()
        serializer2 = SaleOrderSerializer(order_in_shift)
        self.assertFalse(
            serializer2.data['is_editable'],
            "Bill from a closed shift must be permanently locked"
        )

    def test_legacy_order_without_fk_falls_back_to_cashier_scoped_shift(self):
        """
        Legacy orders (register_shift=None) must still be editable when
        the cashier has a current open shift that covers the order's created_at.
        """
        from inventory.serializers import SaleOrderSerializer
        from django.utils import timezone as dj_timezone
        from datetime import timedelta

        shift = DailyRegisterShift.objects.create(
            shift_number='REG-LEGACY-001',
            store=self.store,
            cashier=self.cashier,
            cashier_name=self.cashier.name,
            opening_cash=Decimal('500.00'),
            status='open',
        )

        # Legacy order: no register_shift FK, created_at is after shift opened
        legacy_order = SaleOrder.objects.create(
            invoice_number='INV-LEGACY-001',
            store=self.store,
            cashier=self.cashier,
            cashier_name=self.cashier.name,
            customer_phone='9876543211',
            subtotal=Decimal('300.00'),
            total_amount=Decimal('300.00'),
            amount_paid=Decimal('300.00'),
            payment_method='cash',
            status='completed',
            register_shift=None,  # simulating legacy order without FK
        )

        serializer = SaleOrderSerializer(legacy_order)
        self.assertTrue(
            serializer.data['is_editable'],
            "Legacy order without FK should be editable if cashier's shift is open and order is within shift window"
        )
