from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import (
    Store, Item, Category, SubCategory, SaleOrder, SaleOrderItem, CounterPayout, DailyRegisterShift
)
from staff.models import StaffRole, StaffMember
from accounting.services import get_monthly_financial_analysis
from inventory.dashboard_services import get_dashboard_analytics
from stakeholders.models import Stakeholder
from stakeholders.services import calculate_period_financials, get_stakeholders_analytics


class ReturnFinancialIntegrationTests(TestCase):
    """
    Validates end-to-end mathematical precision when product returns and refunds take place:
    1. Net Revenue = Gross Sales - Customer Refunds
    2. Net COGS = Gross COGS - Returned Stock Cost (restored to inventory)
    3. Gross Profit = Net Revenue - Net COGS
    4. Operating Expenses: Excludes CounterPayout(category='customer_refund') to prevent double-deduction
    5. Stakeholder Distributable Pool: Calculates on true net profit after returns
    6. Dashboard Product & Category Analytics: Decrements units sold, revenue, and profit accurately
    """

    def setUp(self):
        self.client = APIClient()

        # Store
        self.store = Store.objects.create(name='Downtown Branch', city='Sector 1', enable_gst=False)

        # Staff Roles
        self.owner_role = StaffRole.objects.create(name='Owner Role', is_owner=True)
        self.cashier_role = StaffRole.objects.create(name='Cashier Role', is_owner=False, cashier_role='cashier')

        # Staff Members
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

        # Open a register shift
        self.shift = DailyRegisterShift.objects.create(
            store=self.store,
            cashier=self.cashier,
            opening_cash=Decimal('5000.00'),
            cash_sales_amount=Decimal('0.00'),
            cash_payouts_amount=Decimal('0.00'),
            expected_cash=Decimal('5000.00'),
            status=DailyRegisterShift.STATUS_OPEN
        )

        # Product Setup: 1 Item with cost ₹500, selling price ₹1,000
        self.category = Category.objects.create(name='Electronics')
        self.subcategory = SubCategory.objects.create(name='Laptops', category=self.category)

        self.item = Item.objects.create(
            uid='ITEM-001',
            name='Gaming Laptop Mouse',
            cost_price=Decimal('500.00'),
            selling_price=Decimal('1000.00'),
            quantity=20,
            store=self.store
        )
        self.item.subcategories.add(self.subcategory)

        # Counter Payout for store expense (e.g., ₹1,000 for cleaning)
        self.cleaning_payout = CounterPayout.objects.create(
            store=self.store,
            paid_by=self.cashier,
            amount=Decimal('1000.00'),
            payment_method='cash',
            category='cleaning',
            reason='Store cleaning chemical purchase'
        )

        # Stakeholder Setup: 1 Stakeholder with 20% profit share
        self.stakeholder = Stakeholder.objects.create(
            name='Investor Partner',
            profit_percentage=Decimal('20.00'),
            investment_amount=Decimal('100000.00'),
            store=self.store,
            status='active'
        )

        # Initial Sale Order: 10 items @ ₹1,000 = ₹10,000 gross revenue
        # Cost: 10 items @ ₹500 = ₹5,000 COGS
        self.now = timezone.localtime()
        self.order = SaleOrder.objects.create(
            invoice_number='INV-2026-0001',
            store=self.store,
            cashier=self.cashier,
            subtotal=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            payment_method='cash',
            status='completed'
        )
        self.order_item = SaleOrderItem.objects.create(
            sale_order=self.order,
            item=self.item,
            item_name='Gaming Laptop Mouse',
            item_uid='ITEM-001',
            unit_selling_price=Decimal('1000.00'),
            unit_cost_price=Decimal('500.00'),
            quantity=10,
            total_price=Decimal('10000.00')
        )

    def test_pre_return_financials(self):
        """Verify baseline calculations before any return occurs."""
        analysis = get_monthly_financial_analysis(store_id=self.store.id, year=self.now.year, month=self.now.month)
        summary = analysis['summary']

        self.assertEqual(summary['total_revenue'], 10000.00)
        self.assertEqual(summary['total_cogs'], 5000.00)
        self.assertEqual(summary['gross_margin_pct'], 50.0)
        self.assertEqual(summary['total_counter_payouts'], 1000.00)
        self.assertEqual(summary['store_operating_net_profit'], 4000.00)

    def test_process_return_and_verify_financial_calculations(self):
        """
        Process a partial return of 2 units (₹2,000 cash refund):
        - Net Revenue should become ₹8,000.00
        - Net COGS should become ₹4,000.00 (restores ₹1,000 of inventory cost)
        - Gross Margin should become ₹4,000.00
        - Operating expenses should remain ₹1,000.00 (NOT ₹3,000.00 via double-deduction)
        - Net profit should become ₹3,000.00
        - Stakeholder 20% pool should be ₹600.00
        - Dashboard analytics should show 8 units sold, ₹8,000 revenue, ₹4,000 profit
        """
        # Call process_return via API
        payload = {
            'invoice_number': self.order.invoice_number,
            'refund_payment_method': 'cash',
            'items': [
                {
                    'sale_order_item_id': self.order_item.id,
                    'quantity': 2
                }
            ],
            'notes': 'Customer returned 2 units due to unopened excess'
        }
        from django.urls import reverse
        process_url = reverse('sale-order-process-return')
        res = self.client.post(process_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['refund_amount'], 2000.00)

        # Verify a return CounterPayout was created for the cash drawer
        ref_payout = CounterPayout.objects.filter(category=CounterPayout.CATEGORY_REFUND).first()
        self.assertIsNotNone(ref_payout)
        self.assertEqual(ref_payout.amount, Decimal('2000.00'))

        # -------------------------------------------------------------
        # 2. Test Monthly Financial Analysis (P&L, Categories, Timeline)
        # -------------------------------------------------------------
        m_analysis = get_monthly_financial_analysis(store_id=self.store.id, year=self.now.year, month=self.now.month)
        m_summary = m_analysis['summary']

        self.assertEqual(m_summary['gross_revenue'], 10000.00)
        self.assertEqual(m_summary['total_refunds'], 2000.00)
        self.assertEqual(m_summary['total_revenue'], 8000.00)
        self.assertEqual(m_summary['total_units_sold'], 8)
        self.assertEqual(m_summary['gross_cogs'], 5000.00)
        self.assertEqual(m_summary['returned_cogs'], 1000.00)
        self.assertEqual(m_summary['total_cogs'], 4000.00)
        self.assertEqual(m_summary['gross_profit'], 4000.00)
        self.assertEqual(m_summary['total_counter_payouts'], 1000.00)
        self.assertEqual(m_summary['store_operating_net_profit'], 3000.00)

        # Check Category list reflects net 8 units and ₹8,000 revenue
        self.assertEqual(len(m_analysis['categories']), 1)
        cat_data = m_analysis['categories'][0]
        self.assertEqual(cat_data['units_sold'], 8)
        self.assertEqual(cat_data['revenue'], 8000.00)
        self.assertEqual(cat_data['cogs'], 4000.00)
        self.assertEqual(cat_data['gross_profit'], 4000.00)

        # Check Payment Methods reflects net cash inflow = ₹8,000
        cash_method = next(m for m in m_analysis['payment_methods'] if m['method'] == 'cash')
        self.assertEqual(cash_method['amount'], 8000.00)

        # -------------------------------------------------------------
        # 3. Test Dashboard Analytics
        # -------------------------------------------------------------
        d_analytics = get_dashboard_analytics(store_id=self.store.id, year=self.now.year, month=self.now.month)
        d_overview = d_analytics['overview']

        self.assertEqual(d_overview['gross_revenue'], 10000.00)
        self.assertEqual(d_overview['total_refunds'], 2000.00)
        self.assertEqual(d_overview['total_revenue'], 8000.00)
        self.assertEqual(d_overview['total_units_sold'], 8)
        self.assertEqual(d_overview['returns_count'], 1)

        # Best selling products list
        best_product = d_analytics['best_selling_products'][0]
        self.assertEqual(best_product['units_sold'], 8)
        self.assertEqual(best_product['revenue'], 8000.00)
        self.assertEqual(best_product['gross_profit'], 4000.00)

        # -------------------------------------------------------------
        # 4. Test Stakeholder Profit Sharing
        # -------------------------------------------------------------
        sh_analytics = get_stakeholders_analytics(store_id=self.store.id, timeframe='this_month', year=self.now.year, month=self.now.month)
        sh_summary = sh_analytics['summary']

        self.assertEqual(float(sh_summary['total_revenue']), 8000.00)
        self.assertEqual(float(sh_summary['total_cogs']), 4000.00)
        self.assertEqual(float(sh_summary['gross_margin']), 4000.00)
        self.assertEqual(float(sh_summary['total_counter_payouts']), 1000.00)
        self.assertEqual(float(sh_summary['total_profit_pool']), 3000.00)

        # Partner share: 20% of ₹3,000 = ₹600
        partner = sh_analytics['stakeholders'][0]
        self.assertEqual(float(partner['calculated_profit_share']), 600.00)

    def test_return_with_discount_preserves_exact_discounted_price(self):
        """
        Verify that if an item is sold with a 5% discount:
        - Original unit selling price: ₹1,000.00
        - Sold line total for 2 units: ₹1,900.00 (₹950.00 per unit effective)
        - When returning 1 unit: refund is exactly ₹950.00 (NOT ₹1,000.00)
        - When returning both units: refund is exactly ₹1,900.00 (zeroes out the bill completely)
        """
        from django.urls import reverse

        disc_order = SaleOrder.objects.create(
            invoice_number='INV-20260911-DISC',
            store=self.store,
            cashier=self.cashier,
            customer_name='Discount Buyer',
            customer_phone='9998887776',
            subtotal=Decimal('2000.00'),
            discount_amount=Decimal('100.00'),
            total_amount=Decimal('1900.00'),
            amount_paid=Decimal('1900.00'),
            payment_method='cash',
            status='completed',
            created_at=self.now
        )
        disc_item = SaleOrderItem.objects.create(
            sale_order=disc_order,
            item=self.item,
            item_name='Pro Wireless Mouse',
            item_uid='MOU-001',
            unit_cost_price=Decimal('500.00'),
            unit_selling_price=Decimal('1000.00'),
            quantity=2,
            total_price=Decimal('1900.00')
        )

        # 1. Lookup for return should expose effective_unit_price = 950.00 and has_discount = True
        lookup_url = reverse('sale-order-lookup-for-return')
        lookup_res = self.client.get(f"{lookup_url}?invoice_number=INV-20260911-DISC")
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        line_data = lookup_res.data['items'][0]
        self.assertEqual(line_data['effective_unit_price'], 950.00)
        self.assertTrue(line_data['has_discount'])

        # 2. Return 1 unit
        process_url = reverse('sale-order-process-return')
        ret_payload = {
            'invoice_number': 'INV-20260911-DISC',
            'refund_payment_method': 'cash',
            'items': [{'sale_order_item_id': disc_item.id, 'quantity': 1}],
            'notes': 'Returning 1 of 2 mice bought with 5% discount'
        }
        ret_res = self.client.post(process_url, ret_payload, format='json')
        self.assertEqual(ret_res.status_code, status.HTTP_201_CREATED)
        # Refund must be exactly ₹950.00, NOT ₹1,000.00!
        self.assertEqual(ret_res.data['refund_amount'], 950.00)

        # Return order voucher item unit selling price should be ₹950.00
        ret_order_data = ret_res.data['return_order']
        self.assertEqual(ret_order_data['items'][0]['unit_selling_price'], '950.00')
        self.assertEqual(ret_order_data['items'][0]['total_price'], '950.00')
