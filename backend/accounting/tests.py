from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Item, Category, SubCategory, SaleOrder, SaleOrderItem, CounterPayout
from staff.models import StaffRole, StaffMember
from accounting.models import OperatingExpense
from accounting.services import (
    generate_next_expense_voucher_number,
    get_monthly_financial_analysis,
)


class AccountingManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Store
        self.store = Store.objects.create(name='Main Flagship Store', city='Downtown Sector 5', enable_gst=False)

        # Roles
        self.owner_role = StaffRole.objects.create(name='Owner Role', is_owner=True)
        self.cashier_role = StaffRole.objects.create(name='Cashier Role', is_owner=False, cashier_role='cashier')

        # Staff
        self.owner = StaffMember.objects.create(
            staff_id='OWNER01',
            name='Alice Owner',
            role=self.owner_role,
            store=self.store
        )
        self.cashier = StaffMember.objects.create(
            staff_id='CASH01',
            name='Bob Cashier',
            role=self.cashier_role,
            store=self.store
        )

        # Inventory & Sales
        self.item = Item.objects.create(
            uid='WM-001',
            name='Wireless Mouse',
            cost_price=Decimal('500.00'),
            selling_price=Decimal('1000.00'),
            store=self.store
        )

        # Completed sale order: 10 items @ ₹1000 = ₹10,000 rev, ₹5,000 COGS -> Gross Margin = ₹5,000
        self.order = SaleOrder.objects.create(
            invoice_number='INV-TEST-001',
            store=self.store,
            customer_phone='9876543210',
            subtotal=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            status='completed'
        )
        SaleOrderItem.objects.create(
            sale_order=self.order,
            item=self.item,
            item_name='Wireless Mouse',
            item_uid='WM-001',
            quantity=10,
            unit_selling_price=Decimal('1000.00'),
            unit_cost_price=Decimal('500.00'),
            total_price=Decimal('10000.00')
        )
        from datetime import datetime
        dt = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.get_current_timezone())
        SaleOrder.objects.filter(id=self.order.id).update(created_at=dt)

    def test_operating_expense_crud_and_summary(self):
        """Test Operating Expense creation, filtering by month/store, and monthly summary."""
        # 1. Create expense
        payload = {
            'store': self.store.id,
            'title': 'Monthly Electricity Bill',
            'category': 'utilities',
            'amount': '3500.00',
            'expense_date': '2026-09-05',
            'payment_method': 'bank_transfer',
            'paid_to': 'State Power Corp',
            'reference_number': 'EB-987654',
            'notes': 'Shop ground floor electricity'
        }
        res_create = self.client.post('/api/accounting/operating-expenses/', payload, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_create.data['voucher_number'].startswith('EXP-202609-'))
        self.assertEqual(res_create.data['month'], 9)
        self.assertEqual(res_create.data['year'], 2026)
        self.assertEqual(float(res_create.data['amount']), 3500.00)

        # 2. Create another expense
        payload2 = {
            'store': self.store.id,
            'title': 'Store Tea & Coffee Supplies',
            'category': 'refreshments',
            'amount': '850.00',
            'expense_date': '2026-09-07',
            'payment_method': 'cash',
            'paid_to': 'Local Grocer',
            'notes': 'Staff refreshments'
        }
        res_create2 = self.client.post('/api/accounting/operating-expenses/', payload2, format='json')
        self.assertEqual(res_create2.status_code, status.HTTP_201_CREATED)

        # 3. List expenses filtered by month
        res_list = self.client.get(f'/api/accounting/operating-expenses/?store={self.store.id}&year=2026&month=9')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data), 2)

        # 4. Monthly summary endpoint
        res_summary = self.client.get(f'/api/accounting/operating-expenses/summary/?store={self.store.id}&year=2026&month=9')
        self.assertEqual(res_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(res_summary.data['total_amount'], 4350.00)
        self.assertEqual(res_summary.data['total_count'], 2)
        self.assertEqual(res_summary.data['top_category']['category'], 'utilities')
        self.assertEqual(res_summary.data['top_category']['total_amount'], 3500.00)

    def test_monthly_financial_analysis_endpoint(self):
        """Test comprehensive monthly financial analysis endpoint with category breakdown and dual profit."""
        from stakeholders.models import Stakeholder

        # Create category and subcategory
        cat = Category.objects.create(name='Apparel')
        sub = SubCategory.objects.create(category=cat, name='Shirts')
        self.item.subcategories.add(sub)

        # Create an active stakeholder
        Stakeholder.objects.create(
            name='Investor Bob',
            profit_percentage=Decimal('10.00'),
            investment_amount=Decimal('500000.00'),
            store=self.store,
            status='active'
        )

        res = self.client.get(f'/api/accounting/financial-analysis/?store={self.store.id}&year=2026&month=9')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertIn('summary', data)
        self.assertIn('categories', data)
        self.assertIn('operating_expenses_breakdown', data)
        self.assertIn('stakeholders_breakdown', data)
        self.assertIn('timeline', data)
        self.assertIn('waterfall', data)
        self.assertIn('payment_methods', data)

        summary = data['summary']
        self.assertEqual(summary['total_revenue'], 10000.00)
        self.assertEqual(summary['gross_profit'], 5000.00)
        self.assertIn('store_operating_net_profit', summary)
        self.assertIn('final_retained_net_profit', summary)
        self.assertIn('stakeholder_contractual_share_allocated', summary)
        self.assertEqual(summary['active_stakeholders_count'], 1)

        # Check category structure
        self.assertTrue(len(data['categories']) >= 1)
        cat_item = data['categories'][0]
        self.assertEqual(cat_item['name'], 'Apparel')
        self.assertTrue(len(cat_item['subcategories']) >= 1)
        self.assertEqual(cat_item['subcategories'][0]['name'], 'Shirts')

    def test_monthly_financial_analysis_excludes_salary_counter_payout(self):
        """Verify that staff salary payouts from counter are excluded from total_non_salary_expenses to prevent double counting."""
        from datetime import datetime
        dt = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.get_current_timezone())
        # Add a staff salary counter payout
        CounterPayout.objects.create(
            payout_number='PAY-SAL-001',
            store=self.store,
            paid_by=self.cashier,
            paid_to='Staff Member',
            amount=Decimal('1500.00'),
            category=CounterPayout.CATEGORY_STAFF_PAYOUT,
            payment_method='cash',
            paid_at=dt
        )
        # Add a normal counter payout (e.g. repairs)
        CounterPayout.objects.create(
            payout_number='PAY-REP-001',
            store=self.store,
            paid_by=self.cashier,
            paid_to='Repair Guy',
            amount=Decimal('500.00'),
            category=CounterPayout.CATEGORY_MAINTENANCE,
            payment_method='cash',
            paid_at=dt
        )
        analysis = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=9)
        summary = analysis['summary']
        # total_counter_payouts should only include maintenance (₹500), NOT salary payout (₹1500)
        self.assertEqual(Decimal(str(summary['total_counter_payouts'])), Decimal('500.00'))


class StakeholdersDisablingIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name='Test Store Alpha', city='Metro Central', enable_stakeholders=True, enable_gst=False)
        self.owner_role = StaffRole.objects.create(name='Owner Role', is_owner=True)
        self.owner = StaffMember.objects.create(
            staff_id='OWN-01',
            name='Test Owner',
            role=self.owner_role,
            store=self.store
        )
        self.item = Item.objects.create(
            uid='ITEM-001',
            name='Widget Alpha',
            cost_price=Decimal('200.00'),
            selling_price=Decimal('500.00'),
            store=self.store
        )
        self.order = SaleOrder.objects.create(
            invoice_number='INV-TEST-999',
            store=self.store,
            subtotal=Decimal('5000.00'),
            total_amount=Decimal('5000.00'),
            status='completed'
        )
        SaleOrderItem.objects.create(
            sale_order=self.order,
            item=self.item,
            quantity=10,
            unit_selling_price=Decimal('500.00'),
            unit_cost_price=Decimal('200.00'),
            total_price=Decimal('5000.00')
        )
        dt = timezone.datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.get_current_timezone())
        SaleOrder.objects.filter(id=self.order.id).update(created_at=dt)

        from stakeholders.models import Stakeholder
        self.stakeholder = Stakeholder.objects.create(
            name='Partner Jane',
            profit_percentage=Decimal('20.00'),
            investment_amount=Decimal('100000.00'),
            store=self.store,
            status='active'
        )

    def test_calculations_when_stakeholders_enabled(self):
        """When enabled, 20% partner share is deducted from operating net profit."""
        analysis = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=9)
        summary = analysis['summary']

        self.assertTrue(summary['enable_stakeholders'])
        self.assertEqual(summary['gross_profit'], 3000.00)
        self.assertEqual(summary['store_operating_net_profit'], 3000.00)
        self.assertEqual(summary['total_stakeholder_percentage'], 20.0)
        self.assertEqual(summary['stakeholder_contractual_share_allocated'], 600.00)
        self.assertEqual(summary['final_retained_net_profit'], 2400.00)
        self.assertEqual(summary['active_stakeholders_count'], 1)

        # Waterfall includes stakeholder allocation
        waterfall_steps = [w['step'] for w in analysis['waterfall']]
        self.assertIn('Stakeholder Profit Share Allocation', waterfall_steps)
        self.assertIn('Final Retained Store Profit', waterfall_steps)

    def test_toggle_endpoint_and_calculations_when_disabled(self):
        """When disabled via toggle endpoint, all stakeholder deductions are eliminated cleanly."""
        # 1. Call toggle endpoint to disable
        res_toggle = self.client.post('/api/inventory/stores/toggle-stakeholders/', {
            'store_id': self.store.id,
            'enabled': False
        }, format='json')
        self.assertEqual(res_toggle.status_code, status.HTTP_200_OK)
        self.assertFalse(res_toggle.data['enabled'])

        # Verify DB persisted
        self.store.refresh_from_db()
        self.assertFalse(self.store.enable_stakeholders)

        # 2. Check financial analysis calculations
        analysis = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=9)
        summary = analysis['summary']

        self.assertFalse(summary['enable_stakeholders'])
        self.assertEqual(summary['store_operating_net_profit'], 3000.00)
        self.assertEqual(summary['total_stakeholder_percentage'], 0.0)
        self.assertEqual(summary['stakeholder_contractual_share_allocated'], 0.0)
        self.assertEqual(summary['total_stakeholder_payouts_disbursed'], 0.0)
        self.assertEqual(summary['active_stakeholders_count'], 0)
        # Crucial: Retained profit EQUALS store operating profit
        self.assertEqual(summary['final_retained_net_profit'], 3000.00)
        self.assertEqual(summary['final_retained_net_profit_margin_pct'], summary['store_operating_net_profit_margin_pct'])

        # 3. Verify waterfall flow does not contain stakeholder steps
        waterfall_steps = [w['step'] for w in analysis['waterfall']]
        self.assertNotIn('Stakeholder Profit Share Allocation', waterfall_steps)
        self.assertNotIn('Final Retained Store Profit', waterfall_steps)
        self.assertIn('Store Net Operating Profit', waterfall_steps)
        self.assertEqual(analysis['waterfall'][-1]['step'], 'Store Net Operating Profit')
        self.assertEqual(analysis['waterfall'][-1]['type'], 'final_profit')

        # 4. Verify daily timeline and monthly trend have 0 stakeholder share
        day_15 = next(d for d in analysis['timeline'] if d['day'] == 15)
        self.assertEqual(day_15['operating_profit'], 3000.00)
        self.assertEqual(day_15['stakeholder_share'], 0.0)
        self.assertEqual(day_15['retained_profit'], 3000.00)

        month_9 = next(m for m in analysis['monthly_profit_trend'] if m['month'] == 9)
        self.assertEqual(month_9['operating_profit'], 3000.00)
        self.assertEqual(month_9['retained_profit'], 3000.00)

        # 5. Verify stakeholder analytics service returns zeroed/disabled response
        from stakeholders.services import get_stakeholders_analytics
        analytics = get_stakeholders_analytics(store_id=self.store.id, year=2026, month=9)
        self.assertFalse(analytics['enabled'])
        self.assertEqual(analytics['summary']['active_stakeholders_count'], 0)
        self.assertEqual(analytics['summary']['total_profit_pool'], Decimal('0.00'))
        self.assertEqual(len(analytics['stakeholders']), 0)

        # 6. Verify creating a stakeholder is rejected when disabled
        res_create = self.client.post('/api/stakeholders/', {
            'store': self.store.id,
            'name': 'Should Fail Partner',
            'profit_percentage': '10.00',
            'investment_amount': '50000.00',
            'status': 'active'
        }, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(res_create.data.get('detail') or res_create.data.get('error') or res_create.data)
        self.assertIn('disabled', error_msg.lower())

    def test_re_enabling_stakeholders_restores_full_system(self):
        """When toggled back to enabled, the existing stakeholder partner is restored without data loss."""
        # Disable first
        self.store.enable_stakeholders = False
        self.store.save()

        # Re-enable via toggle endpoint
        res_toggle = self.client.post('/api/inventory/stores/toggle-stakeholders/', {
            'store_id': self.store.id,
            'enabled': True
        }, format='json')
        self.assertEqual(res_toggle.status_code, status.HTTP_200_OK)
        self.assertTrue(res_toggle.data['enabled'])

        # Calculations restored
        analysis = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=9)
        summary = analysis['summary']
        self.assertTrue(summary['enable_stakeholders'])
        self.assertEqual(summary['stakeholder_contractual_share_allocated'], 600.00)
        self.assertEqual(summary['final_retained_net_profit'], 2400.00)
        self.assertEqual(summary['active_stakeholders_count'], 1)

    def test_update_and_payout_rejected_when_disabled(self):
        """Updating a stakeholder or recording a payout is rejected with 400 when disabled."""
        self.store.enable_stakeholders = False
        self.store.save()

        # Try to update stakeholder
        res_update = self.client.patch(f'/api/stakeholders/{self.stakeholder.id}/', {
            'profit_percentage': '25.00'
        }, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disabled', str(res_update.data).lower())

        # Try to record payout
        res_payout = self.client.post(f'/api/stakeholders/{self.stakeholder.id}/record_payout/', {
            'amount': '500.00',
            'payout_date': '2026-09-20',
            'payment_method': 'cash'
        }, format='json')
        self.assertEqual(res_payout.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disabled', str(res_payout.data).lower())

    def test_toggle_string_boolean_edge_case(self):
        """Ensure string 'false' and 'true' from forms or query parameters are parsed accurately."""
        # String 'false'
        res = self.client.post('/api/inventory/stores/toggle-stakeholders/', {
            'store_id': self.store.id,
            'enabled': 'false'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['enabled'])
        self.store.refresh_from_db()
        self.assertFalse(self.store.enable_stakeholders)

        # String 'true'
        res2 = self.client.post('/api/inventory/stores/toggle-stakeholders/', {
            'store_id': self.store.id,
            'enabled': 'true'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data['enabled'])
        self.store.refresh_from_db()
        self.assertTrue(self.store.enable_stakeholders)

    def test_financial_analysis_edge_cases_zero_sales_and_loss(self):
        """Financial analysis handles 0 revenue, empty months, and net loss with no division by zero when disabled."""
        self.store.enable_stakeholders = False
        self.store.save()

        # Month 1 (January) with 0 sales
        analysis_empty = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=1)
        summary = analysis_empty['summary']
        self.assertFalse(summary['enable_stakeholders'])
        self.assertEqual(summary['total_revenue'], 0.0)
        self.assertEqual(summary['store_operating_net_profit'], 0.0)
        self.assertEqual(summary['final_retained_net_profit'], 0.0)
        self.assertEqual(summary['stakeholder_contractual_share_allocated'], 0.0)
        self.assertEqual(summary['final_retained_net_profit_margin_pct'], 0.0)
        self.assertEqual(summary['active_stakeholders_count'], 0)

        # Add heavy expense in January exceeding revenue -> net loss
        OperatingExpense.objects.create(
            store=self.store,
            title='Renovation',
            category='maintenance',
            amount=Decimal('50000.00'),
            expense_date=date(2026, 1, 10),
            payment_method='bank_transfer'
        )
        analysis_loss = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=1)
        s_loss = analysis_loss['summary']
        self.assertEqual(s_loss['total_non_salary_expenses'], 50000.00)
        self.assertEqual(s_loss['store_operating_net_profit'], -50000.00)
        self.assertEqual(s_loss['final_retained_net_profit'], -50000.00)
        self.assertEqual(s_loss['stakeholder_contractual_share_allocated'], 0.00)
        self.assertEqual(analysis_loss['waterfall'][-1]['step'], 'Store Net Operating Loss')
        self.assertEqual(analysis_loss['waterfall'][-1]['type'], 'final_loss')

    def test_parse_store_filter_ids(self):
        """Test parsing of various store filter parameter combinations."""
        from accounting.services import parse_store_filter_ids
        # All stores variations
        self.assertIsNone(parse_store_filter_ids(None, None))
        self.assertIsNone(parse_store_filter_ids('', None))
        self.assertIsNone(parse_store_filter_ids('all', None))
        self.assertIsNone(parse_store_filter_ids('all_stores', None))
        self.assertIsNone(parse_store_filter_ids('ALL', None))

        # Single store
        self.assertEqual(parse_store_filter_ids('1', None), [1])
        self.assertEqual(parse_store_filter_ids(1, None), [1])
        self.assertEqual(parse_store_filter_ids(None, ['5']), [5])

        # Comma-separated multiple stores
        self.assertEqual(parse_store_filter_ids('1,2,3', None), [1, 2, 3])
        self.assertEqual(parse_store_filter_ids(' 4 , 5 ', None), [4, 5])

        # List of store strings
        self.assertEqual(parse_store_filter_ids(None, ['10', '20']), [10, 20])
        self.assertEqual(parse_store_filter_ids(['10', '20'], None), [10, 20])

    def test_multi_store_and_combined_branches_analysis(self):
        """Test multi-store combined financial analysis, store breakdown, and API endpoints."""
        from datetime import datetime

        # Create Second Store
        store2 = Store.objects.create(name='Uptown Branch 2', city='North District', enable_gst=False)

        item2 = Item.objects.create(
            uid='KB-001',
            name='Mechanical Keyboard',
            cost_price=Decimal('600.00'),
            selling_price=Decimal('2000.00'),
            store=store2
        )

        order2 = SaleOrder.objects.create(
            invoice_number='INV-TEST-002',
            store=store2,
            customer_phone='9123456780',
            subtotal=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            status='completed'
        )
        SaleOrderItem.objects.create(
            sale_order=order2,
            item=item2,
            item_name='Mechanical Keyboard',
            item_uid='KB-001',
            quantity=5,
            unit_selling_price=Decimal('2000.00'),
            unit_cost_price=Decimal('600.00'),
            total_price=Decimal('10000.00')
        )
        dt = datetime(2026, 9, 16, 14, 0, 0, tzinfo=timezone.get_current_timezone())
        SaleOrder.objects.filter(id=order2.id).update(created_at=dt)

        # Operating Expenses per store
        OperatingExpense.objects.create(
            store=self.store,
            title='Main Store Wifi',
            category='utilities',
            amount=Decimal('1000.00'),
            expense_date=date(2026, 9, 10),
            payment_method='cash'
        )
        OperatingExpense.objects.create(
            store=store2,
            title='Uptown Store Maintenance',
            category='repairs',
            amount=Decimal('2500.00'),
            expense_date=date(2026, 9, 12),
            payment_method='bank_transfer'
        )

        # 1. Single Store 1 Analysis
        analysis_s1 = get_monthly_financial_analysis(store_id=self.store.id, year=2026, month=9)
        self.assertFalse(analysis_s1['is_combined'])
        self.assertEqual(analysis_s1['summary']['total_revenue'], 5000.00)
        self.assertEqual(analysis_s1['summary']['total_operating_expenses'], 1000.00)

        # 2. Single Store 2 Analysis
        analysis_s2 = get_monthly_financial_analysis(store_id=store2.id, year=2026, month=9)
        self.assertFalse(analysis_s2['is_combined'])
        self.assertEqual(analysis_s2['summary']['total_revenue'], 10000.00)
        self.assertEqual(analysis_s2['summary']['total_operating_expenses'], 2500.00)

        # 3. Multi-Store Combined Analysis (Both stores selected)
        analysis_comb = get_monthly_financial_analysis(store_id=[self.store.id, store2.id], year=2026, month=9)
        self.assertTrue(analysis_comb['is_combined'])
        self.assertEqual(analysis_comb['summary']['total_revenue'], 15000.00)
        self.assertEqual(analysis_comb['summary']['total_operating_expenses'], 3500.00)
        self.assertIn('stores_breakdown', analysis_comb)
        self.assertEqual(len(analysis_comb['stores_breakdown']), 2)

        # Check breakdown metrics
        store_names = [st['name'] for st in analysis_comb['stores_breakdown']]
        self.assertIn(self.store.name, store_names)
        self.assertIn('Uptown Branch 2', store_names)
        breakdown_by_id = {st['id']: st for st in analysis_comb['stores_breakdown']}
        self.assertEqual(breakdown_by_id[self.store.id]['revenue'], 5000.00)
        self.assertEqual(breakdown_by_id[self.store.id]['share_of_sales_pct'], 33.3)
        self.assertEqual(breakdown_by_id[store2.id]['revenue'], 10000.00)
        self.assertEqual(breakdown_by_id[store2.id]['share_of_sales_pct'], 66.7)

        # 4. All Stores Combined (store_id='all')
        analysis_all = get_monthly_financial_analysis(store_id='all', year=2026, month=9)
        self.assertTrue(analysis_all['is_combined'])
        self.assertEqual(analysis_all['summary']['total_revenue'], 15000.00)

        # 5. Test API Endpoints with multi-store filtering
        # Monthly Analysis endpoint with ?store=all
        res_api_all = self.client.get(f'/api/accounting/financial-analysis/?store=all&year=2026&month=9')
        self.assertEqual(res_api_all.status_code, status.HTTP_200_OK)
        self.assertTrue(res_api_all.data['is_combined'])
        self.assertEqual(res_api_all.data['summary']['total_revenue'], 15000.00)

        # Monthly Analysis endpoint with comma-separated store IDs ?store=1,2
        res_api_multi = self.client.get(f'/api/accounting/financial-analysis/?store={self.store.id},{store2.id}&year=2026&month=9')
        self.assertEqual(res_api_multi.status_code, status.HTTP_200_OK)
        self.assertTrue(res_api_multi.data['is_combined'])
        self.assertEqual(res_api_multi.data['summary']['total_revenue'], 15000.00)

        # Operating Expenses endpoint with ?store=all
        res_exp_all = self.client.get(f'/api/accounting/operating-expenses/?store=all&year=2026&month=9')
        self.assertEqual(res_exp_all.status_code, status.HTTP_200_OK)
        exp_results = res_exp_all.data if isinstance(res_exp_all.data, list) else res_exp_all.data.get('results', [])
        self.assertEqual(len(exp_results), 2)

        # Operating Expenses endpoint with single store
        res_exp_s1 = self.client.get(f'/api/accounting/operating-expenses/?store={self.store.id}&year=2026&month=9')
        self.assertEqual(res_exp_s1.status_code, status.HTTP_200_OK)
        exp_s1_results = res_exp_s1.data if isinstance(res_exp_s1.data, list) else res_exp_s1.data.get('results', [])
        self.assertEqual(len(exp_s1_results), 1)
        self.assertEqual(exp_s1_results[0]['store'], self.store.id)

        # Sale Orders endpoint with ?store=all
        res_ord_all = self.client.get('/api/inventory/sales/?store=all')
        self.assertEqual(res_ord_all.status_code, status.HTTP_200_OK)
        ord_results = res_ord_all.data if isinstance(res_ord_all.data, list) else res_ord_all.data.get('results', [])
        self.assertEqual(len(ord_results), 2)

        # 6. Verify Daily Timeline & Hourly Consistency in Combined Mode
        timeline = analysis_comb['timeline']
        self.assertEqual(len(timeline), 30)
        daily_gst_sum = sum(day['gst_amount'] for day in timeline)
        # Store 1 has enable_gst=False (0 tax), Store 2 has enable_gst=False (0 tax) -> sum is 0.0
        self.assertEqual(round(daily_gst_sum, 2), analysis_comb['summary']['gst_amount'])

        # Verify hourly slots exist and sum correctly for day 15
        day_15_slots = analysis_comb['hourly_by_day'].get(15, [])
        self.assertGreater(len(day_15_slots), 0)
        hourly_gross_sum = sum(s['gross_revenue'] for s in day_15_slots)
        day_15_timeline = next(d for d in timeline if d['day'] == 15)
        self.assertEqual(round(hourly_gross_sum, 2), round(day_15_timeline['gross_revenue'], 2))

        # 7. Verify Store-Scoped Stakeholder Entitlement in Combined Mode
        from stakeholders.models import Stakeholder
        sh1 = Stakeholder.objects.create(
            name='Partner Store 1',
            store=self.store,
            profit_percentage=Decimal('10.00'),
            investment_amount=Decimal('100000.00'),
            status='active'
        )
        sh2 = Stakeholder.objects.create(
            name='Partner Store 2',
            store=store2,
            profit_percentage=Decimal('20.00'),
            investment_amount=Decimal('200000.00'),
            status='active'
        )
        analysis_with_sh = get_monthly_financial_analysis(store_id=[self.store.id, store2.id], year=2026, month=9)
        sh_breakdown = {s['id']: s for s in analysis_with_sh['stakeholders_breakdown']}
        self.assertIn(sh1.id, sh_breakdown)
        self.assertIn(sh2.id, sh_breakdown)
        self.assertEqual(sh_breakdown[sh1.id]['store_name'], self.store.name)
        self.assertEqual(sh_breakdown[sh2.id]['store_name'], 'Uptown Branch 2')
        # Store 1 profit: Net rev 5000 - COGS 2000 - expenses 1000 = 2000 operating profit. 10% of 2000 = 200.
        self.assertEqual(sh_breakdown[sh1.id]['contractual_share_amount'], 200.00)
        # Store 2 profit: Net rev 10000 - COGS 3000 - expenses 2500 = 4500 operating profit. 20% of 4500 = 900.
        self.assertEqual(sh_breakdown[sh2.id]['contractual_share_amount'], 900.00)
        # Total contractual share allocated = 400 (existing Partner Bob) + 200 (sh1) + 900 (sh2) = 1500
        self.assertEqual(analysis_with_sh['summary']['stakeholder_contractual_share_allocated'], 1500.00)
        # Combined operating profit = 2000 + 4500 = 6500. Retained = 6500 - 1500 = 5000.
        self.assertEqual(analysis_with_sh['summary']['store_operating_net_profit'], 6500.00)
        self.assertEqual(analysis_with_sh['summary']['final_retained_net_profit'], 5000.00)



