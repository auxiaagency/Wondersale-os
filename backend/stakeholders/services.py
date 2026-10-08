from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Q

from inventory.models import Store, SaleOrder, SaleOrderItem, CounterPayout
from .models import Stakeholder


STAKEHOLDER_COLORS = [
    '#EC4899',  # Pink
    '#8B5CF6',  # Purple
    '#3B82F6',  # Blue
    '#10B981',  # Emerald Green
    '#F59E0B',  # Amber
    '#06B6D4',  # Cyan
    '#EF4444',  # Red
    '#6366F1',  # Indigo
    '#14B8A6',  # Teal
    '#F97316',  # Orange
]


def get_date_range(timeframe: str, year=None, month=None, year_month=None):
    """
    Returns (start_date, end_date) for the given timeframe filter.
    Supports:
    - 'past_2_months', 'last_2_months'
    - 'last_3_months'
    - 'last_6_months'
    - 'this_year', 'ytd'
    - 'last_year'
    - 'specific_month' (using year and month or year_month)
    - 'current_month'
    - 'all_time', 'till_now'
    """
    now = timezone.now()
    timeframe = (timeframe or 'last_6_months').lower().strip()

    if year_month:
        try:
            parts = str(year_month).split('-')
            year = int(parts[0])
            month = int(parts[1])
        except Exception:
            pass

    if timeframe == 'specific_month' and year and month:
        year = int(year)
        month = int(month)
        start = datetime(year, month, 1, 0, 0, 0, tzinfo=now.tzinfo)
        if month == 12:
            end = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=now.tzinfo) - timedelta(seconds=1)
        else:
            end = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=now.tzinfo) - timedelta(seconds=1)
    elif timeframe in ('past_2_months', 'last_2_months'):
        # 1 month before current month up to now
        prev_m = now.month - 1
        prev_y = now.year
        if prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = now
    elif timeframe == 'last_3_months':
        prev_m = now.month - 2
        prev_y = now.year
        while prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = now
    elif timeframe == 'last_6_months':
        prev_m = now.month - 5
        prev_y = now.year
        while prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = now
    elif timeframe in ('this_year', 'ytd'):
        target_year = int(year) if year else now.year
        start = datetime(target_year, 1, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = now if target_year == now.year else datetime(target_year, 12, 31, 23, 59, 59, tzinfo=now.tzinfo)
    elif timeframe == 'last_year':
        target_year = (int(year) if year else now.year) - 1
        start = datetime(target_year, 1, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = datetime(target_year, 12, 31, 23, 59, 59, tzinfo=now.tzinfo)
    elif timeframe == 'current_month':
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif timeframe in ('all_time', 'till_now'):
        start = None
        end = now
    else:
        # Default to last 6 months
        prev_m = now.month - 5
        prev_y = now.year
        while prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=now.tzinfo)
        end = now

    return start, end


def calculate_period_financials(orders_qs, store_id=None, start_date=None, end_date=None):
    """
    Given a queryset of SaleOrders and store/timeframe parameters,
    computes net revenue (gross - refunds), net COGS (gross COGS - returned items COGS),
    gross margin, operating expenses (excluding customer refunds), and net distributable profit pool.
    """
    sales_qs = orders_qs.exclude(status='cancelled').exclude(invoice_number__startswith='RET-')

    # Find return vouchers in the same period and store
    returns_qs = SaleOrder.objects.filter(
        invoice_number__startswith='RET-'
    ).exclude(status='cancelled')
    if store_id:
        returns_qs = returns_qs.filter(store_id=store_id)
    if start_date:
        returns_qs = returns_qs.filter(created_at__gte=start_date)
    if end_date:
        returns_qs = returns_qs.filter(created_at__lte=end_date)

    gross_rev = sales_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_refunds = returns_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    rev = max(Decimal('0.00'), gross_rev - total_refunds)

    # Store GST Configuration
    store_obj = None
    if store_id:
        try:
            store_obj = Store.objects.filter(id=int(store_id)).first()
        except (ValueError, TypeError):
            pass
    if not store_obj:
        store_obj = Store.objects.filter(is_active=True).first()

    gst_rate = store_obj.gst_rate if store_obj else Decimal('18.00')
    gst_mode = store_obj.gst_calculation_mode if store_obj else 'all'
    enable_gst = store_obj.enable_gst if store_obj else True

    # Compute UPI sales for GST
    sales_upi = Decimal('0.00')
    for s in sales_qs:
        pm = (s.payment_method or '').lower()
        if pm == 'upi':
            sales_upi += s.total_amount
        elif pm == 'split':
            sales_upi += (s.split_upi_amount or Decimal('0.00'))

    refunds_upi = Decimal('0.00')
    for r in returns_qs:
        pm = (r.payment_method or '').lower()
        if pm == 'upi':
            refunds_upi += r.total_amount
        elif pm == 'split':
            refunds_upi += (r.split_upi_amount or Decimal('0.00'))

    net_upi_inflows = max(Decimal('0.00'), sales_upi - refunds_upi)

    if not enable_gst:
        gst_amount = Decimal('0.00')
    elif gst_mode == 'upi_only':
        gst_amount = (net_upi_inflows * (gst_rate / Decimal('100.00'))).quantize(Decimal('0.01'))
    else:
        gst_amount = (rev * (gst_rate / Decimal('100.00'))).quantize(Decimal('0.01'))

    net_rev_after_gst = max(Decimal('0.00'), rev - gst_amount)

    # Calculate net COGS from line items (restoring procurement cost of returned items)
    sales_items = SaleOrderItem.objects.filter(sale_order__in=sales_qs)
    gross_cogs = Decimal('0.00')
    for it in sales_items:
        if it.unit_cost_price and it.unit_cost_price > Decimal('0.00'):
            gross_cogs += (it.unit_cost_price * it.quantity)

    returns_items = SaleOrderItem.objects.filter(sale_order__in=returns_qs)
    returned_cogs = Decimal('0.00')
    for it in returns_items:
        if it.unit_cost_price and it.unit_cost_price > Decimal('0.00'):
            returned_cogs += (it.unit_cost_price * it.quantity)

    total_cogs = max(Decimal('0.00'), gross_cogs - returned_cogs)
    gross_profit = max(Decimal('0.00'), net_rev_after_gst - total_cogs) if total_cogs > Decimal('0.00') else net_rev_after_gst

    # Calculate Counter Operational Payouts & Operating Expenses for this period and store
    from accounting.models import OperatingExpense

    op_expenses_qs = OperatingExpense.objects.all()
    if store_id:
        op_expenses_qs = op_expenses_qs.filter(store_id=store_id)
    if start_date:
        start_d = start_date.date() if hasattr(start_date, 'date') else start_date
        op_expenses_qs = op_expenses_qs.filter(expense_date__gte=start_d)
    if end_date:
        end_d = end_date.date() if hasattr(end_date, 'date') else end_date
        op_expenses_qs = op_expenses_qs.filter(expense_date__lte=end_d)

    total_op_expenses = op_expenses_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    # Exclude customer refunds from operating expenses (they are already subtracted from Net Sales to prevent double-deduction)
    payouts_qs = CounterPayout.objects.all().exclude(category=CounterPayout.CATEGORY_REFUND)
    if store_id:
        payouts_qs = payouts_qs.filter(store_id=store_id)
    if start_date:
        payouts_qs = payouts_qs.filter(paid_at__gte=start_date)
    if end_date:
        payouts_qs = payouts_qs.filter(paid_at__lte=end_date)

    total_counter_payouts = payouts_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    total_all_payouts = total_counter_payouts + total_op_expenses

    # Net distributable profit pool = Gross Profit - All Operating Expenses & Salaries (minimum 0.00)
    net_profit = max(Decimal('0.00'), gross_profit - total_all_payouts)

    return rev, total_cogs, gross_profit, total_all_payouts, net_profit


def calculate_profit_and_revenue_for_orders(orders_qs, store_id=None, start_date=None, end_date=None):
    """Backwards-compatible helper returning (revenue, total_cogs, net_profit)."""
    rev, cogs, _, _, profit = calculate_period_financials(orders_qs, store_id=store_id, start_date=start_date, end_date=end_date)
    return rev, cogs, profit


def get_stakeholders_analytics(store_id=None, timeframe='last_6_months', year=None, month=None, year_month=None):
    """
    Calculates comprehensive profit-sharing analytics:
    - Period totals (Revenue, Gross Margin, Counter Payouts, Net Profit Pool, Payouts Disbursed)
    - Pie chart breakdown (per-stakeholder share % and calculated ₹)
    - Dynamic trend intervals (e.g. 4-week for specific month, 12 months for year, 2/3/6 months)
    """
    import calendar

    if year_month:
        try:
            parts = str(year_month).split('-')
            year = int(parts[0])
            month = int(parts[1])
        except Exception:
            pass

    store_obj = None
    if store_id:
        try:
            store_obj = Store.objects.filter(id=int(store_id)).first()
        except (ValueError, TypeError):
            pass
    if not store_obj:
        store_obj = Store.objects.filter(is_active=True).first()

    is_sh_enabled = getattr(store_obj, 'enable_stakeholders', True) if store_obj else Store.objects.filter(enable_stakeholders=True).exists()
    if not is_sh_enabled:
        return {
            'enabled': False,
            'summary': {
                'timeframe': timeframe,
                'total_revenue': Decimal('0.00'),
                'total_cogs': Decimal('0.00'),
                'gross_margin': Decimal('0.00'),
                'total_counter_payouts': Decimal('0.00'),
                'total_profit_pool': Decimal('0.00'),
                'total_payouts_disbursed': Decimal('0.00'),
                'active_stakeholders_count': 0,
                'total_stakeholder_percentage': Decimal('0.00')
            },
            'stakeholders': [],
            'trend': [],
            'distribution': []
        }

    start_date, end_date = get_date_range(timeframe, year=year, month=month, year_month=year_month)

    # Base orders queryset
    orders_qs = SaleOrder.objects.exclude(status='cancelled')
    if store_id:
        orders_qs = orders_qs.filter(store_id=store_id)
    if start_date:
        orders_qs = orders_qs.filter(created_at__gte=start_date)
    if end_date:
        orders_qs = orders_qs.filter(created_at__lte=end_date)

    total_revenue, total_cogs, gross_margin, total_counter_payouts, profit_pool = calculate_period_financials(
        orders_qs,
        store_id=store_id,
        start_date=start_date,
        end_date=end_date
    )

    # Fetch active stakeholders - strictly store-wise
    stakeholders_qs = Stakeholder.objects.all()
    if store_id:
        stakeholders_qs = stakeholders_qs.filter(store_id=store_id)

    active_stakeholders = list(stakeholders_qs.filter(status='active'))

    # Automatically accrue and update closed-months payout for stakeholders after each completed month
    now = timezone.now()
    current_month_start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=now.tzinfo)

    for s in active_stakeholders:
        c_date = s.contract_date
        contract_dt = datetime(c_date.year, c_date.month, 1, 0, 0, 0, tzinfo=now.tzinfo) if c_date else None
        closed_orders = SaleOrder.objects.exclude(
            status='cancelled'
        ).filter(
            created_at__lt=current_month_start
        )
        if s.store_id:
            closed_orders = closed_orders.filter(store_id=s.store_id)
        if contract_dt:
            closed_orders = closed_orders.filter(created_at__gte=contract_dt)

        _, _, _, _, closed_profit = calculate_period_financials(
            closed_orders,
            store_id=s.store_id,
            start_date=contract_dt,
            end_date=current_month_start
        )
        auto_accrued = round((closed_profit * s.profit_percentage) / Decimal('100.00'), 2)

        if auto_accrued > s.total_payout_paid:
            s.total_payout_paid = auto_accrued
            s.save(update_fields=['total_payout_paid'])

    total_capital_invested = sum((s.investment_amount for s in stakeholders_qs), Decimal('0.00'))
    total_payouts_disbursed = sum((s.total_payout_paid for s in stakeholders_qs), Decimal('0.00'))
    total_committed_percentage = sum((s.profit_percentage for s in active_stakeholders), Decimal('0.00'))
    retained_percentage = max(Decimal('0.00'), Decimal('100.00') - total_committed_percentage)

    # Per-stakeholder calculated profit for active period
    stakeholders_data = []
    pie_slices = []

    for idx, s in enumerate(active_stakeholders):
        color = STAKEHOLDER_COLORS[idx % len(STAKEHOLDER_COLORS)]
        pct = s.profit_percentage
        share_amount = (profit_pool * pct) / Decimal('100.00')
        revenue_share = (total_revenue * pct) / Decimal('100.00')

        stakeholders_data.append({
            'id': s.id,
            'name': s.name,
            'phone': s.phone,
            'email': s.email,
            'store_id': s.store_id,
            'store_name': s.store_name,
            'investment_amount': str(s.investment_amount),
            'profit_percentage': float(pct),
            'contract_date': str(s.contract_date),
            'total_payout_paid': str(s.total_payout_paid),
            'calculated_profit_share': str(round(share_amount, 2)),
            'calculated_revenue_share': str(round(revenue_share, 2)),
            'status': s.status,
            'color': color,
        })

        # Pie chart is purely contractual profit allocation percentage
        pie_slices.append({
            'id': s.id,
            'name': s.name,
            'percentage': float(pct),
            'color': color,
            'is_retained': False,
        })

    # Add Retained Business slice to pie chart (pure percentage)
    pie_slices.append({
        'id': 'retained',
        'name': 'Retained Company Profit',
        'percentage': float(round(retained_percentage, 2)),
        'color': '#10B981' if retained_percentage > 0 else '#64748B',
        'is_retained': True,
    })

    # Generate dynamic trend intervals based on the selected timeline
    intervals = []
    tf = (timeframe or 'last_6_months').lower().strip()

    if tf == 'specific_month' and year and month:
        y = int(year)
        m = int(month)
        _, num_days = calendar.monthrange(y, m)
        week_ranges = [
            (1, 7, "Week 1", "W1"),
            (8, 14, "Week 2", "W2"),
            (15, 21, "Week 3", "W3"),
            (22, num_days, "Week 4", "W4"),
        ]
        for d_start, d_end, label, s_label in week_ranges:
            w_start = datetime(y, m, d_start, 0, 0, 0, tzinfo=now.tzinfo)
            w_end = datetime(y, m, d_end, 23, 59, 59, tzinfo=now.tzinfo)
            intervals.append((w_start, w_end, f"{label} ({d_start}-{d_end})", s_label, f"{y}-{m:02d}-w{label[-1]}"))
    elif tf in ('past_2_months', 'last_2_months'):
        # Generate 4 intervals (bi-weekly halves across the 2 months)
        m_list = []
        for i in (1, 0):
            y = now.year
            m = now.month - i
            while m <= 0:
                m += 12
                y -= 1
            m_list.append((y, m))
        for y, m in m_list:
            _, num_days = calendar.monthrange(y, m)
            m_name = datetime(y, m, 1).strftime('%b')
            intervals.append((
                datetime(y, m, 1, 0, 0, 0, tzinfo=now.tzinfo),
                datetime(y, m, 15, 23, 59, 59, tzinfo=now.tzinfo),
                f"{m_name} 1-15",
                f"{m_name} 15",
                f"{y}-{m:02d}-h1"
            ))
            intervals.append((
                datetime(y, m, 16, 0, 0, 0, tzinfo=now.tzinfo),
                datetime(y, m, num_days, 23, 59, 59, tzinfo=now.tzinfo),
                f"{m_name} 16-{num_days}",
                f"{m_name} {num_days}",
                f"{y}-{m:02d}-h2"
            ))
    elif tf == 'last_3_months':
        for i in range(2, -1, -1):
            y = now.year
            m = now.month - i
            while m <= 0:
                m += 12
                y -= 1
            _, num_days = calendar.monthrange(y, m)
            m_start = datetime(y, m, 1, 0, 0, 0, tzinfo=now.tzinfo)
            m_end = datetime(y, m, num_days, 23, 59, 59, tzinfo=now.tzinfo)
            m_label = m_start.strftime('%b %Y')
            intervals.append((m_start, m_end, m_label, m_start.strftime('%b'), f"{y}-{m:02d}"))
    elif tf == 'last_year':
        y = (int(year) if year else now.year) - 1
        for m in range(1, 13):
            _, num_days = calendar.monthrange(y, m)
            m_start = datetime(y, m, 1, 0, 0, 0, tzinfo=now.tzinfo)
            m_end = datetime(y, m, num_days, 23, 59, 59, tzinfo=now.tzinfo)
            m_label = m_start.strftime('%b %Y')
            intervals.append((m_start, m_end, m_label, m_start.strftime('%b'), f"{y}-{m:02d}"))
    elif tf in ('this_year', 'ytd'):
        y = int(year) if year else now.year
        max_m = now.month if y == now.year else 12
        for m in range(1, max_m + 1):
            _, num_days = calendar.monthrange(y, m)
            m_start = datetime(y, m, 1, 0, 0, 0, tzinfo=now.tzinfo)
            m_end = datetime(y, m, num_days, 23, 59, 59, tzinfo=now.tzinfo)
            m_label = m_start.strftime('%b %Y')
            intervals.append((m_start, m_end, m_label, m_start.strftime('%b'), f"{y}-{m:02d}"))
    else:
        # Default: last 6 months
        for i in range(5, -1, -1):
            y = now.year
            m = now.month - i
            while m <= 0:
                m += 12
                y -= 1
            _, num_days = calendar.monthrange(y, m)
            m_start = datetime(y, m, 1, 0, 0, 0, tzinfo=now.tzinfo)
            m_end = datetime(y, m, num_days, 23, 59, 59, tzinfo=now.tzinfo)
            m_label = m_start.strftime('%b %Y')
            intervals.append((m_start, m_end, m_label, m_start.strftime('%b'), f"{y}-{m:02d}"))

    monthly_trend = []
    for int_start, int_end, int_label, s_label, period_key in intervals:
        m_orders = SaleOrder.objects.exclude(
            status='cancelled'
        ).filter(
            created_at__gte=int_start,
            created_at__lte=int_end
        )
        if store_id:
            m_orders = m_orders.filter(store_id=store_id)

        m_rev, m_cogs, m_gross, m_payouts, m_profit = calculate_period_financials(
            m_orders,
            store_id=store_id,
            start_date=int_start,
            end_date=int_end
        )

        # Stakeholders breakdown for this interval
        breakdown = []
        for s in active_stakeholders:
            s_profit = (m_profit * s.profit_percentage) / Decimal('100.00')
            s_rev = (m_rev * s.profit_percentage) / Decimal('100.00')
            breakdown.append({
                'stakeholder_id': s.id,
                'name': s.name,
                'color': s.color if hasattr(s, 'color') else STAKEHOLDER_COLORS[active_stakeholders.index(s) % len(STAKEHOLDER_COLORS)],
                'percentage': float(s.profit_percentage),
                'profit_share': float(round(s_profit, 2)),
                'revenue_share': float(round(s_rev, 2)),
            })

        monthly_trend.append({
            'month': int_label,
            'short_label': s_label,
            'year_month': period_key,
            'total_revenue': float(round(m_rev, 2)),
            'gross_margin': float(round(m_gross, 2)),
            'counter_payouts': float(round(m_payouts, 2)),
            'total_profit': float(round(m_profit, 2)),
            'stakeholder_breakdown': breakdown,
        })

    retained_profit_amount = (profit_pool * retained_percentage) / Decimal('100.00')

    return {
        'timeframe': timeframe,
        'summary': {
            'total_revenue': str(round(total_revenue, 2)),
            'total_cogs': str(round(total_cogs, 2)),
            'gross_margin': str(round(gross_margin, 2)),
            'total_counter_payouts': str(round(total_counter_payouts, 2)),
            'total_profit_pool': str(round(profit_pool, 2)),
            'total_capital_invested': str(round(total_capital_invested, 2)),
            'total_payouts_disbursed': str(round(total_payouts_disbursed, 2)),
            'active_stakeholders_count': len(active_stakeholders),
            'total_committed_percentage': float(round(total_committed_percentage, 2)),
            'retained_percentage': float(round(retained_percentage, 2)),
            'retained_profit_amount': str(round(retained_profit_amount, 2)),
        },
        'pie_chart': pie_slices,
        'monthly_trend': monthly_trend,
        'stakeholders': stakeholders_data,
    }
