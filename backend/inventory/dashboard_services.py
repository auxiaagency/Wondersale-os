import calendar
from datetime import datetime, time, date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q, F, Avg

from inventory.models import (
    Store,
    Category,
    SubCategory,
    Item,
    SaleOrder,
    SaleOrderItem,
    StockMovement,
    ItemPriceHistory,
)


def get_dashboard_analytics(store_id=None, start_date=None, end_date=None, year=None, month=None):
    """
    Computes comprehensive retail dashboard analytics for a given date range.
    Accepts start_date/end_date (ISO strings: 'YYYY-MM-DD') as primary params,
    with year/month as backward-compatible fallback.

    1. Overall Period Overview & KPIs
    2. Best-Selling Products (by units sold and revenue)
    3. Slow-Moving / Zero-Sales Products (products not selling / dead stock)
    4. Out-of-Stock and Depleting Products (products going out of stock)
    5. Most Selling Categories & Subcategories
    6. Daily Sales Trend
    """
    now = timezone.now()

    # ── Determine Date Range ────────────────────────────────────────
    period_start = None
    period_end = None
    period_label = ''

    if start_date and end_date:
        try:
            sd = datetime.strptime(str(start_date).strip(), '%Y-%m-%d')
            ed = datetime.strptime(str(end_date).strip(), '%Y-%m-%d')
            if sd <= ed:
                period_start = timezone.make_aware(datetime(sd.year, sd.month, sd.day, 0, 0, 0))
                period_end = timezone.make_aware(datetime(ed.year, ed.month, ed.day, 23, 59, 59, 999999))
                if sd.year == ed.year and sd.month == ed.month:
                    period_label = f"{calendar.month_name[sd.month]} {sd.year}"
                else:
                    period_label = f"{sd.strftime('%b %d, %Y')} – {ed.strftime('%b %d, %Y')}"
        except (ValueError, TypeError):
            period_start = None
            period_end = None

    if period_start is None:
        # Fallback to year/month
        try:
            target_year = int(year) if year else now.year
        except (ValueError, TypeError):
            target_year = now.year
        try:
            target_month = int(month) if month else now.month
        except (ValueError, TypeError):
            target_month = now.month
        if target_month < 1 or target_month > 12:
            target_month = now.month
        _, last_day = calendar.monthrange(target_year, target_month)
        period_start = timezone.make_aware(datetime(target_year, target_month, 1, 0, 0, 0))
        period_end = timezone.make_aware(datetime(target_year, target_month, last_day, 23, 59, 59, 999999))
        period_label = f"{calendar.month_name[target_month]} {target_year}"

    days_in_period = max(1, (period_end.date() - period_start.date()).days + 1)
    today = now.date()
    if period_end.date() > today:
        elapsed_days = max(1, (min(period_end.date(), today) - period_start.date()).days + 1) if period_start.date() <= today else 0
    else:
        elapsed_days = days_in_period

    # Store context
    store_obj = None
    if store_id and str(store_id).lower() not in ('all', '', 'null', 'none'):
        try:
            store_obj = Store.objects.filter(id=int(store_id)).first()
        except (ValueError, TypeError):
            store_obj = None

    # Available years list from SaleOrder dates
    order_years = list(SaleOrder.objects.dates('created_at', 'year'))
    available_years = sorted(list({d.year for d in order_years} | {now.year, period_start.year}))

    # Base QuerySets
    orders_qs = SaleOrder.objects.filter(
        created_at__gte=period_start,
        created_at__lte=period_end
    )
    if store_obj:
        orders_qs = orders_qs.filter(store=store_obj)

    # Separate completed sales from return vouchers
    sales_qs = orders_qs.exclude(status='cancelled').exclude(invoice_number__startswith='RET-')
    returns_qs = orders_qs.exclude(status='cancelled').filter(invoice_number__startswith='RET-')

    # Sale order items in this month
    order_items_qs = SaleOrderItem.objects.filter(
        sale_order__in=sales_qs
    ).select_related('item', 'item__primary_subcategory__category', 'sale_order').prefetch_related('item__subcategories__category')

    return_items_qs = SaleOrderItem.objects.filter(
        sale_order__in=returns_qs
    ).select_related('item', 'item__primary_subcategory__category', 'sale_order').prefetch_related('item__subcategories__category')

    # All active items in store / catalog
    items_qs = Item.objects.all().select_related('primary_subcategory', 'primary_subcategory__category').prefetch_related('subcategories__category')
    if store_obj:
        items_qs = items_qs.filter(store=store_obj)

    # -------------------------------------------------------------
    # 1. OVERALL REVENUE & UNITS
    # -------------------------------------------------------------
    total_orders_count = sales_qs.count()
    gross_revenue = sales_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_refunds = returns_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_revenue = max(Decimal('0.00'), gross_revenue - total_refunds)

    # Aggregate item sales
    item_sales_map = {}
    category_sales_map = {}
    subcategory_sales_map = {}
    daily_sales_map = {}

    for line in order_items_qs:
        qty = line.quantity
        rev = line.total_price
        cost = (line.unit_cost_price or Decimal('0.00')) * qty
        profit = rev - cost

        # Daily sales map — keyed by full ISO date string for arbitrary range support
        order_day_key = line.sale_order.created_at.strftime('%Y-%m-%d')
        if order_day_key not in daily_sales_map:
            daily_sales_map[order_day_key] = {'revenue': Decimal('0.00'), 'units': 0}
        daily_sales_map[order_day_key]['revenue'] += rev
        daily_sales_map[order_day_key]['units'] += qty

        # Item sales aggregation
        item_ref_id = line.item_id or f"archived_{line.item_uid}"
        if item_ref_id not in item_sales_map:
            cat_name = "Uncategorized"
            sub_name = "General"
            cat_id = None
            sub_id = None
            stock_qty = 0

            if line.item:
                stock_qty = line.item.quantity
                primary_sub = line.item.effective_primary_subcategory
                if primary_sub:
                    sub_name = primary_sub.name
                    sub_id = primary_sub.id
                    if primary_sub.category:
                        cat_name = primary_sub.category.name
                        cat_id = primary_sub.category.id

            item_sales_map[item_ref_id] = {
                'item_id': line.item_id,
                'name': line.item_name,
                'uid': line.item_uid,
                'units_sold': 0,
                'revenue': Decimal('0.00'),
                'cost': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'current_stock': stock_qty,
                'unit_selling_price': float(line.unit_selling_price),
                'unit_cost_price': float(line.unit_cost_price),
                'category_id': cat_id,
                'category_name': cat_name,
                'subcategory_id': sub_id,
                'subcategory_name': sub_name,
            }

        item_sales_map[item_ref_id]['units_sold'] += qty
        item_sales_map[item_ref_id]['revenue'] += rev
        item_sales_map[item_ref_id]['cost'] += cost
        item_sales_map[item_ref_id]['gross_profit'] += profit

        # Category and Subcategory Aggregation
        line_cat_name = "Uncategorized"
        line_cat_id = 0
        line_sub_name = "General"
        line_sub_id = 0

        if line.item:
            psub = line.item.effective_primary_subcategory
            if psub:
                line_sub_name = psub.name
                line_sub_id = psub.id
                if psub.category:
                    line_cat_name = psub.category.name
                    line_cat_id = psub.category.id

        # Category map
        if line_cat_name not in category_sales_map:
            category_sales_map[line_cat_name] = {
                'id': line_cat_id,
                'name': line_cat_name,
                'revenue': Decimal('0.00'),
                'units_sold': 0,
                'gross_profit': Decimal('0.00'),
            }
        category_sales_map[line_cat_name]['revenue'] += rev
        category_sales_map[line_cat_name]['units_sold'] += qty
        category_sales_map[line_cat_name]['gross_profit'] += profit

        # Subcategory map
        sub_key = f"{line_cat_name}___{line_sub_name}"
        if sub_key not in subcategory_sales_map:
            subcategory_sales_map[sub_key] = {
                'id': line_sub_id,
                'name': line_sub_name,
                'category_name': line_cat_name,
                'revenue': Decimal('0.00'),
                'units_sold': 0,
                'gross_profit': Decimal('0.00'),
            }
        subcategory_sales_map[sub_key]['revenue'] += rev
        subcategory_sales_map[sub_key]['units_sold'] += qty
        subcategory_sales_map[sub_key]['gross_profit'] += profit

    # Deduct returned items from daily timeline, product metrics, and category metrics
    for line in return_items_qs:
        qty = line.quantity
        rev = line.total_price
        cost = (line.unit_cost_price or Decimal('0.00')) * qty
        profit = rev - cost

        order_day_key = line.sale_order.created_at.strftime('%Y-%m-%d')
        if order_day_key in daily_sales_map:
            daily_sales_map[order_day_key]['revenue'] = max(Decimal('0.00'), daily_sales_map[order_day_key]['revenue'] - rev)
            daily_sales_map[order_day_key]['units'] = max(0, daily_sales_map[order_day_key]['units'] - qty)

        item_ref_id = line.item_id or f"archived_{line.item_uid}"
        if item_ref_id in item_sales_map:
            item_sales_map[item_ref_id]['units_sold'] = max(0, item_sales_map[item_ref_id]['units_sold'] - qty)
            item_sales_map[item_ref_id]['revenue'] = max(Decimal('0.00'), item_sales_map[item_ref_id]['revenue'] - rev)
            item_sales_map[item_ref_id]['cost'] = max(Decimal('0.00'), item_sales_map[item_ref_id]['cost'] - cost)
            item_sales_map[item_ref_id]['gross_profit'] = max(Decimal('0.00'), item_sales_map[item_ref_id]['gross_profit'] - profit)

        line_cat_name = "Uncategorized"
        line_sub_name = "General"
        if line.item:
            psub = line.item.effective_primary_subcategory
            if psub:
                line_sub_name = psub.name
                if psub.category:
                    line_cat_name = psub.category.name

        if line_cat_name in category_sales_map:
            category_sales_map[line_cat_name]['revenue'] = max(Decimal('0.00'), category_sales_map[line_cat_name]['revenue'] - rev)
            category_sales_map[line_cat_name]['units_sold'] = max(0, category_sales_map[line_cat_name]['units_sold'] - qty)
            category_sales_map[line_cat_name]['gross_profit'] = max(Decimal('0.00'), category_sales_map[line_cat_name]['gross_profit'] - profit)

        sub_key = f"{line_cat_name}___{line_sub_name}"
        if sub_key in subcategory_sales_map:
            subcategory_sales_map[sub_key]['revenue'] = max(Decimal('0.00'), subcategory_sales_map[sub_key]['revenue'] - rev)
            subcategory_sales_map[sub_key]['units_sold'] = max(0, subcategory_sales_map[sub_key]['units_sold'] - qty)
            subcategory_sales_map[sub_key]['gross_profit'] = max(Decimal('0.00'), subcategory_sales_map[sub_key]['gross_profit'] - profit)

    total_units_sold = sum(itm['units_sold'] for itm in item_sales_map.values())
    avg_order_value = round(float(total_revenue / Decimal(total_orders_count)), 2) if total_orders_count > 0 else 0.0

    # -------------------------------------------------------------
    # 2. BEST-SELLING PRODUCTS ("which item is the best selling")
    # -------------------------------------------------------------
    best_selling_list = []
    for itm_data in item_sales_map.values():
        u_sold = itm_data['units_sold']
        rev_val = float(itm_data['revenue'])
        cost_val = float(itm_data['cost'])
        gp_val = float(itm_data['gross_profit'])
        margin_pct = round((gp_val / rev_val * 100), 1) if rev_val > 0 else 0.0
        c_stock = itm_data['current_stock']

        stock_status = 'healthy'
        if c_stock <= 0:
            stock_status = 'out_of_stock'
        elif c_stock <= 5:
            stock_status = 'low_stock'

        best_selling_list.append({
            'item_id': itm_data['item_id'],
            'name': itm_data['name'],
            'uid': itm_data['uid'],
            'units_sold': u_sold,
            'revenue': rev_val,
            'cost': cost_val,
            'gross_profit': gp_val,
            'margin_pct': margin_pct,
            'current_stock': c_stock,
            'unit_selling_price': itm_data['unit_selling_price'],
            'unit_cost_price': itm_data['unit_cost_price'],
            'category_id': itm_data['category_id'],
            'category_name': itm_data['category_name'],
            'subcategory_id': itm_data['subcategory_id'],
            'subcategory_name': itm_data['subcategory_name'],
            'stock_status': stock_status,
        })

    # Sort descending by revenue generated (primary business metric)
    best_selling_list.sort(key=lambda x: x['revenue'], reverse=True)

    # Top best-selling item
    top_best_item = best_selling_list[0] if best_selling_list else None

    # -------------------------------------------------------------
    # 3. SLOW MOVING & DEAD INVENTORY ("which products are not selling")
    # -------------------------------------------------------------
    sold_item_ids = set(order_items_qs.values_list('item_id', flat=True))
    best_selling_by_id = {b['item_id']: b for b in best_selling_list if b.get('item_id')}

    slow_moving_list = []
    total_dead_stock_capital = Decimal('0.00')

    for item in items_qs:
        units_sold = 0
        revenue_generated = 0.0

        if item.id in sold_item_ids:
            # Check how many units were sold
            match = best_selling_by_id.get(item.id)
            if match:
                units_sold = match['units_sold']
                revenue_generated = match['revenue']

        primary_sub = item.effective_primary_subcategory
        cat_name = primary_sub.category.name if primary_sub and primary_sub.category else "Uncategorized"
        sub_name = primary_sub.name if primary_sub else "General"

        # Item is classified as Slow Moving / Zero Sales if:
        # - It has stock sitting in the warehouse/store (quantity > 0) AND
        # - units_sold <= 2 in this entire month
        if item.quantity > 0 and units_sold <= 2:
            cost_price = item.cost_price or Decimal('0.00')
            tied_capital = Decimal(item.quantity) * cost_price
            if units_sold == 0:
                total_dead_stock_capital += tied_capital

            shelf_health = 'dead_stock' if units_sold == 0 else 'slow_moving'

            slow_moving_list.append({
                'item_id': item.id,
                'name': item.name,
                'uid': item.uid,
                'current_stock': item.quantity,
                'units_sold': units_sold,
                'revenue_generated': revenue_generated,
                'unit_selling_price': float(item.selling_price),
                'unit_cost_price': float(cost_price),
                'tied_up_capital': float(round(tied_capital, 2)),
                'category_name': cat_name,
                'subcategory_name': sub_name,
                'shelf_health': shelf_health,
            })

    # Sort slow moving by zero sales first, then by highest tied up capital (critical dead stock!)
    slow_moving_list.sort(key=lambda x: (1 if x['shelf_health'] == 'dead_stock' else 0, x['tied_up_capital']), reverse=True)

    zero_sales_count = sum(1 for x in slow_moving_list if x['shelf_health'] == 'dead_stock')

    # -------------------------------------------------------------
    # 4. PRODUCTS GOING OUT OF STOCK / DEPLETING ("which product is going out of stock")
    # -------------------------------------------------------------
    stock_depletion_list = []
    out_of_stock_count = 0
    low_stock_count = 0

    for item in items_qs:
        qty = item.quantity
        units_sold = 0
        match = best_selling_by_id.get(item.id)
        if match:
            units_sold = match['units_sold']

        primary_sub = item.effective_primary_subcategory
        cat_name = primary_sub.category.name if primary_sub and primary_sub.category else "Uncategorized"

        if qty == 0:
            out_of_stock_count += 1
            urgency = 'urgent'
            velocity_label = f"Sold {units_sold} in period • OUT OF STOCK" if units_sold > 0 else "Out of Stock"
            status_code = 'out_of_stock'
            stock_depletion_list.append({
                'item_id': item.id,
                'name': item.name,
                'uid': item.uid,
                'current_stock': 0,
                'units_sold': units_sold,
                'units_sold_this_month': units_sold,
                'revenue': float(round(Decimal(units_sold) * (item.selling_price or Decimal('0.00')), 2)),
                'status': status_code,
                'stock_status': status_code,
                'status_label': 'Out of Stock (0 units)',
                'velocity_label': velocity_label,
                'urgency': urgency,
                'category_name': cat_name,
                'unit_selling_price': float(item.selling_price),
            })
        elif qty <= 5:
            low_stock_count += 1
            urgency = 'urgent' if (units_sold >= 3 or qty <= 2) else 'high'
            status_code = 'critically_low'
            velocity_label = f"High Velocity: {units_sold} sold in period • Only {qty} left!" if units_sold > 0 else f"Critically Low: {qty} units left"
            stock_depletion_list.append({
                'item_id': item.id,
                'name': item.name,
                'uid': item.uid,
                'current_stock': qty,
                'units_sold': units_sold,
                'units_sold_this_month': units_sold,
                'revenue': float(round(Decimal(units_sold) * (item.selling_price or Decimal('0.00')), 2)),
                'status': status_code,
                'stock_status': status_code,
                'status_label': f'Critically Low ({qty} left)',
                'velocity_label': velocity_label,
                'urgency': urgency,
                'category_name': cat_name,
                'unit_selling_price': float(item.selling_price),
            })
        elif qty <= 10 and units_sold >= 5:
            # Rapidly depleting
            low_stock_count += 1
            urgency = 'moderate'
            status_code = 'depleting_fast'
            velocity_label = f"Fast Depletion: {units_sold} sold in period • {qty} left"
            stock_depletion_list.append({
                'item_id': item.id,
                'name': item.name,
                'uid': item.uid,
                'current_stock': qty,
                'units_sold': units_sold,
                'units_sold_this_month': units_sold,
                'revenue': float(round(Decimal(units_sold) * (item.selling_price or Decimal('0.00')), 2)),
                'status': status_code,
                'stock_status': status_code,
                'status_label': f'Depleting Fast ({qty} left)',
                'velocity_label': velocity_label,
                'urgency': urgency,
                'category_name': cat_name,
                'unit_selling_price': float(item.selling_price),
            })

    # Sort stock depletion: urgent first, then highest units sold
    urgency_order = {'urgent': 3, 'high': 2, 'moderate': 1}
    stock_depletion_list.sort(key=lambda x: (urgency_order.get(x['urgency'], 0), x['units_sold_this_month']), reverse=True)

    # -------------------------------------------------------------
    # 5. MOST SELLING CATEGORY & SUBCATEGORY ("which is the most selling category and sub category")
    # -------------------------------------------------------------
    categories_list = []
    tot_rev_float = float(total_revenue)

    for cat_name, cdata in category_sales_map.items():
        c_rev = float(cdata['revenue'])
        c_units = cdata['units_sold']
        c_gp = float(cdata['gross_profit'])
        share_pct = round((c_rev / tot_rev_float * 100), 1) if tot_rev_float > 0 else 0.0
        margin_pct = round((c_gp / c_rev * 100), 1) if c_rev > 0 else 0.0

        categories_list.append({
            'id': cdata['id'],
            'name': cat_name,
            'revenue': round(c_rev, 2),
            'units_sold': c_units,
            'gross_profit': round(c_gp, 2),
            'margin_pct': margin_pct,
            'share_of_sales_pct': share_pct,
        })

    categories_list.sort(key=lambda x: (x['revenue'], x['units_sold']), reverse=True)
    for idx, c in enumerate(categories_list, 1):
        c['rank'] = idx

    top_category = categories_list[0] if categories_list else None

    # Subcategories list
    subcategories_list = []
    for sub_key, sdata in subcategory_sales_map.items():
        s_rev = float(sdata['revenue'])
        s_units = sdata['units_sold']
        s_gp = float(sdata['gross_profit'])
        share_pct = round((s_rev / tot_rev_float * 100), 1) if tot_rev_float > 0 else 0.0

        subcategories_list.append({
            'id': sdata['id'],
            'name': sdata['name'],
            'category_name': sdata['category_name'],
            'revenue': round(s_rev, 2),
            'units_sold': s_units,
            'gross_profit': round(s_gp, 2),
            'share_of_sales_pct': share_pct,
        })

    subcategories_list.sort(key=lambda x: (x['revenue'], x['units_sold']), reverse=True)
    for idx, s in enumerate(subcategories_list, 1):
        s['rank'] = idx

    top_subcategory = subcategories_list[0] if subcategories_list else None

    # -------------------------------------------------------------
    # 6. DAILY SALES TREND (across the full date range)
    # -------------------------------------------------------------
    daily_timeline = []
    for day_offset in range(days_in_period):
        day_date = period_start.date() + timedelta(days=day_offset)
        d_key = str(day_date)
        d_data = daily_sales_map.get(d_key, {'revenue': Decimal('0.00'), 'units': 0})
        daily_timeline.append({
            'day': day_offset + 1,
            'date': d_key,
            'label': f"{calendar.month_abbr[day_date.month]} {day_date.day}",
            'revenue': float(round(d_data['revenue'], 2)),
            'units': d_data['units'],
        })

    # -------------------------------------------------------------
    # ASSEMBLE COMPLETE RESPONSE
    # -------------------------------------------------------------
    return {
        'meta': {
            'store_id': store_obj.id if store_obj else None,
            'store_name': store_obj.name if store_obj else 'All Store Branches',
            'period_start': str(period_start.date()),
            'period_end': str(period_end.date()),
            'period_label': period_label,
            'days_in_period': days_in_period,
            'elapsed_days': elapsed_days,
            'is_ongoing': period_end.date() >= today,
            'available_years': available_years,
        },
        'overview': {
            'gross_revenue': float(round(gross_revenue, 2)),
            'total_refunds': float(round(total_refunds, 2)),
            'total_revenue': float(round(total_revenue, 2)),
            'total_units_sold': total_units_sold,
            'total_orders_count': total_orders_count,
            'returns_count': returns_qs.count(),
            'average_order_value': avg_order_value,
            'total_inventory_items': items_qs.count(),
            'total_inventory_units': sum(i.quantity for i in items_qs),
            'out_of_stock_count': out_of_stock_count,
            'low_stock_count': low_stock_count,
            'zero_sales_count': zero_sales_count,
            'total_dead_stock_capital': float(round(total_dead_stock_capital, 2)),
            'best_selling_item': top_best_item,
            'top_selling_category': top_category,
            'top_selling_subcategory': top_subcategory,
        },
        'best_selling_products': best_selling_list,
        'low_selling_products': slow_moving_list,
        'stock_depletion_products': stock_depletion_list,
        'category_analytics': categories_list,
        'subcategory_analytics': subcategories_list,
        'daily_timeline': daily_timeline,
    }


def get_expiry_analytics(store_id=None):
    """
    Returns all items that have an expiry_date set, categorized by urgency:
    - expired:       already past expiry (days_until_expiry < 0)
    - expires_today: expiring today     (days_until_expiry == 0)
    - critical:      expiring in 1-7 days
    - warning:       expiring in 8-30 days
    - notice:        expiring in 31-90 days
    - ok:            expiring in 91+ days

    Sorted by days_until_expiry ascending (most urgent first).
    """
    now = timezone.now()
    today = now.date()

    store_obj = None
    if store_id and str(store_id).lower() not in ('all', '', 'null', 'none'):
        try:
            store_obj = Store.objects.filter(id=int(store_id)).first()
        except (ValueError, TypeError):
            pass

    items_qs = (
        Item.objects
        .filter(expiry_date__isnull=False)
        .select_related('primary_subcategory__category')
        .prefetch_related('subcategories__category')
    )
    if store_obj:
        items_qs = items_qs.filter(store=store_obj)

    expiry_items = []
    for item in items_qs:
        ed = item.expiry_date
        days_until = (ed - today).days

        if days_until < 0:
            urgency = 'expired'
            status_label = f'Expired {abs(days_until)} day{"s" if abs(days_until) != 1 else ""} ago'
        elif days_until == 0:
            urgency = 'expires_today'
            status_label = 'Expires Today'
        elif days_until <= 7:
            urgency = 'critical'
            status_label = f'Expires in {days_until} day{"s" if days_until != 1 else ""}'
        elif days_until <= 30:
            urgency = 'warning'
            status_label = f'Expires in {days_until} days'
        elif days_until <= 90:
            urgency = 'notice'
            status_label = f'Expires in {days_until} days'
        else:
            urgency = 'ok'
            status_label = f'Expires in {days_until} days'

        primary_sub = item.effective_primary_subcategory
        cat_name = primary_sub.category.name if primary_sub and primary_sub.category else 'Uncategorized'
        sub_name = primary_sub.name if primary_sub else 'General'
        cost = item.cost_price or Decimal('0.00')
        potential_loss = float(round(Decimal(item.quantity) * cost, 2)) if item.quantity > 0 else 0.0

        expiry_items.append({
            'item_id': item.id,
            'name': item.name,
            'uid': item.uid,
            'category_name': cat_name,
            'subcategory_name': sub_name,
            'expiry_date': str(ed),
            'days_until_expiry': days_until,
            'urgency': urgency,
            'status_label': status_label,
            'current_stock': item.quantity,
            'selling_price': float(item.selling_price),
            'cost_price': float(cost),
            'potential_loss': potential_loss,
        })

    # Sort ascending by days_until_expiry (most urgent / already expired first)
    expiry_items.sort(key=lambda x: x['days_until_expiry'])

    expired_count = sum(1 for x in expiry_items if x['urgency'] == 'expired')
    critical_count = sum(1 for x in expiry_items if x['urgency'] in ('expires_today', 'critical'))
    warning_count = sum(1 for x in expiry_items if x['urgency'] == 'warning')
    notice_count = sum(1 for x in expiry_items if x['urgency'] == 'notice')
    total_potential_loss = sum(
        x['potential_loss'] for x in expiry_items
        if x['urgency'] in ('expired', 'expires_today', 'critical')
    )

    return {
        'items': expiry_items,
        'summary': {
            'total_with_expiry': len(expiry_items),
            'expired_count': expired_count,
            'critical_count': critical_count,
            'warning_count': warning_count,
            'notice_count': notice_count,
            'total_potential_loss': round(total_potential_loss, 2),
        },
    }


def get_product_analytics(item: Item, request=None):
    """
    Computes end-to-end lifetime performance analytics for a single product:
    1. Lifetime Price Histories (Cost, Selling, MRP, Margins)
    2. Sales KPIs, Velocity & Runout Forecast
    3. Peak & Slowest Selling Periods (Best/Lowest Month, Week, Day of Week)
    4. Detailed Subcategory Comparative Analysis & Benchmarking
    5. Continuous Multi-Granularity Time-Series (Year, Month, Week, Day) starting from item.created_at
    6. Historical Ledgers (Stock movements, sales orders, price adjustments)
    """
    now = timezone.now()
    item_created_at = item.created_at
    start_date = item_created_at.date()
    end_date = now.date()

    # 1. Base Metadata
    categories = list(item.parent_categories)
    subcategories = list(item.subcategories.select_related('category').all())
    primary_sub = item.effective_primary_subcategory
    primary_cat = item.effective_primary_category

    primary_img = item.primary_image
    primary_image_url = ""
    if primary_img and primary_img.image:
        primary_image_url = request.build_absolute_uri(primary_img.image.url) if request else primary_img.image.url

    # 2. Lifetime Price History
    price_hist_qs = item.price_history.order_by('created_at')
    price_records = []
    prev_cost = None
    prev_sell = None
    for ph in price_hist_qs:
        c_val = float(ph.cost_price)
        s_val = float(ph.selling_price)
        m_val = float(ph.mrp) if ph.mrp is not None else None
        margin_val = round(s_val - c_val, 2)
        margin_pct = round((margin_val / s_val * 100), 2) if s_val > 0 else 0.0
        c_diff = round(c_val - prev_cost, 2) if prev_cost is not None else 0.0
        s_diff = round(s_val - prev_sell, 2) if prev_sell is not None else 0.0
        prev_cost = c_val
        prev_sell = s_val
        price_records.append({
            'id': ph.id,
            'timestamp': ph.created_at.isoformat(),
            'date': ph.created_at.strftime('%Y-%m-%d'),
            'time': ph.created_at.strftime('%H:%M'),
            'cost_price': c_val,
            'selling_price': s_val,
            'mrp': m_val,
            'margin': margin_val,
            'margin_pct': margin_pct,
            'cost_diff': c_diff,
            'sell_diff': s_diff,
            'reason': ph.reason,
            'note': ph.note,
            'performed_by_name': ph.performed_by_name or (ph.performed_by.name if ph.performed_by else "System"),
        })

    if not price_records:
        c_val = float(item.cost_price)
        s_val = float(item.selling_price)
        m_val = float(item.mrp) if item.mrp is not None else None
        price_records.append({
            'id': 0,
            'timestamp': item_created_at.isoformat(),
            'date': item_created_at.strftime('%Y-%m-%d'),
            'time': item_created_at.strftime('%H:%M'),
            'cost_price': c_val,
            'selling_price': s_val,
            'mrp': m_val,
            'margin': round(s_val - c_val, 2),
            'margin_pct': round(((s_val - c_val) / s_val * 100), 2) if s_val > 0 else 0.0,
            'cost_diff': 0.0,
            'sell_diff': 0.0,
            'reason': "Initial Stocking",
            'note': "Initial catalog entry",
            'performed_by_name': "System",
        })

    # 3. Sales Performance Aggregation
    sale_items = list(SaleOrderItem.objects.filter(
        item=item,
        sale_order__status='completed'
    ).select_related('sale_order', 'sale_order__cashier').order_by('sale_order__created_at'))

    total_units_sold = 0
    total_revenue = Decimal('0.00')
    total_cost = Decimal('0.00')
    total_discount = Decimal('0.00')

    monthly_sales = {}
    weekly_sales = {}
    daily_of_week_sales = {i: {'day_num': i, 'day_name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i], 'units': 0, 'revenue': Decimal('0.00'), 'discount': Decimal('0.00')} for i in range(7)}
    date_sales_map = {}
    recent_sales = []

    for si in sale_items:
        qty = si.quantity - si.returned_quantity
        if qty < 0:
            qty = 0
        rev = Decimal(str(si.unit_selling_price)) * qty
        cost = Decimal(str(si.unit_cost_price)) * qty

        # Item-level discount calculation (difference between MRP and actual Selling Price)
        mrp_val = Decimal(str(si.unit_mrp)) if si.unit_mrp is not None else Decimal(str(item.mrp or item.selling_price))
        unit_discount = max(Decimal('0.00'), mrp_val - Decimal(str(si.unit_selling_price)))
        line_discount = unit_discount * qty

        total_units_sold += qty
        total_revenue += rev
        total_cost += cost
        total_discount += line_discount

        dt = si.sale_order.created_at
        m_key = dt.strftime('%Y-%m')
        if m_key not in monthly_sales:
            monthly_sales[m_key] = {
                'key': m_key,
                'label': dt.strftime('%B %Y'),
                'year': dt.year,
                'month': dt.month,
                'units': 0,
                'revenue': Decimal('0.00'),
                'discount': Decimal('0.00'),
            }
        monthly_sales[m_key]['units'] += qty
        monthly_sales[m_key]['revenue'] += rev
        monthly_sales[m_key]['discount'] += line_discount

        w_year, w_num, _ = dt.isocalendar()
        w_key = f"{w_year}-W{w_num:02d}"
        if w_key not in weekly_sales:
            weekly_sales[w_key] = {
                'key': w_key,
                'label': f"Week {w_num}, {w_year}",
                'year': w_year,
                'week': w_num,
                'units': 0,
                'revenue': Decimal('0.00'),
                'discount': Decimal('0.00'),
            }
        weekly_sales[w_key]['units'] += qty
        weekly_sales[w_key]['revenue'] += rev
        weekly_sales[w_key]['discount'] += line_discount

        dow = dt.weekday()
        daily_of_week_sales[dow]['units'] += qty
        daily_of_week_sales[dow]['revenue'] += rev
        daily_of_week_sales[dow]['discount'] += line_discount

        d_key = dt.strftime('%Y-%m-%d')
        if d_key not in date_sales_map:
            date_sales_map[d_key] = {'units': 0, 'revenue': Decimal('0.00'), 'discount': Decimal('0.00')}
        date_sales_map[d_key]['units'] += qty
        date_sales_map[d_key]['revenue'] += rev
        date_sales_map[d_key]['discount'] += line_discount

        if len(recent_sales) < 15:
            cashier_name = ""
            if si.sale_order.cashier:
                cashier_name = getattr(si.sale_order.cashier, 'name', '') or str(si.sale_order.cashier)
            recent_sales.append({
                'order_id': si.sale_order.id,
                'invoice_number': si.sale_order.invoice_number,
                'timestamp': dt.isoformat(),
                'date': dt.strftime('%Y-%m-%d %H:%M'),
                'quantity': qty,
                'unit_price': float(si.unit_selling_price),
                'mrp': float(mrp_val),
                'discount': float(line_discount),
                'has_discount': line_discount > 0,
                'total_price': float(rev),
                'cashier_name': cashier_name or 'Cashier',
            })

    total_profit = total_revenue - total_cost
    margin_pct = round(float((total_profit / total_revenue) * 100), 2) if total_revenue > 0 else 0.0

    days_active = max(1, (end_date - start_date).days + 1)
    daily_velocity = round(total_units_sold / days_active, 2)
    weekly_velocity = round(daily_velocity * 7, 2)

    days_inventory_left = None
    if daily_velocity > 0 and item.quantity > 0:
        days_inventory_left = int(round(item.quantity / daily_velocity))

    # Best & Worst Month
    best_month = None
    worst_month = None
    if monthly_sales:
        sorted_months = sorted(monthly_sales.values(), key=lambda m: (m['units'], m['revenue']), reverse=True)
        best_month = {
            'label': sorted_months[0]['label'],
            'units': sorted_months[0]['units'],
            'revenue': float(round(sorted_months[0]['revenue'], 2)),
            'discount': float(round(sorted_months[0]['discount'], 2)),
        }
        worst_month = {
            'label': sorted_months[-1]['label'],
            'units': sorted_months[-1]['units'],
            'revenue': float(round(sorted_months[-1]['revenue'], 2)),
            'discount': float(round(sorted_months[-1]['discount'], 2)),
        }

    # Best & Worst Week
    best_week = None
    worst_week = None
    if weekly_sales:
        sorted_weeks = sorted(weekly_sales.values(), key=lambda w: (w['units'], w['revenue']), reverse=True)
        best_week = {
            'label': sorted_weeks[0]['label'],
            'units': sorted_weeks[0]['units'],
            'revenue': float(round(sorted_weeks[0]['revenue'], 2)),
            'discount': float(round(sorted_weeks[0]['discount'], 2)),
        }
        worst_week = {
            'label': sorted_weeks[-1]['label'],
            'units': sorted_weeks[-1]['units'],
            'revenue': float(round(sorted_weeks[-1]['revenue'], 2)),
            'discount': float(round(sorted_weeks[-1]['discount'], 2)),
        }

    # Best & Worst Day of Week
    sorted_dows = sorted(daily_of_week_sales.values(), key=lambda d: (d['units'], d['revenue']), reverse=True)
    best_dow = {
        'day_name': sorted_dows[0]['day_name'],
        'units': sorted_dows[0]['units'],
        'revenue': float(round(sorted_dows[0]['revenue'], 2)),
        'share_pct': round((sorted_dows[0]['units'] / total_units_sold * 100), 1) if total_units_sold > 0 else 0.0,
    }
    worst_dow = {
        'day_name': sorted_dows[-1]['day_name'],
        'units': sorted_dows[-1]['units'],
        'revenue': float(round(sorted_dows[-1]['revenue'], 2)),
        'share_pct': round((sorted_dows[-1]['units'] / total_units_sold * 100), 1) if total_units_sold > 0 else 0.0,
    }

    # Best & Worst Day (Peak Single Calendar Date)
    best_day = None
    worst_day = None
    if date_sales_map:
        sales_with_units = [d for d in date_sales_map.items() if d[1]['units'] > 0]
        if sales_with_units:
            sorted_days = sorted(sales_with_units, key=lambda x: (x[1]['units'], x[1]['revenue']), reverse=True)
            best_d_key, best_d_val = sorted_days[0]
            try:
                dt_obj = datetime.strptime(best_d_key, '%Y-%m-%d')
                lbl = dt_obj.strftime('%b %d, %Y')
            except Exception:
                lbl = best_d_key
            best_day = {
                'date': best_d_key,
                'label': lbl,
                'units': best_d_val['units'],
                'revenue': float(round(best_d_val['revenue'], 2)),
                'discount': float(round(best_d_val.get('discount', Decimal('0.00')), 2)),
            }
            worst_d_key, worst_d_val = sorted_days[-1]
            try:
                dt_w_obj = datetime.strptime(worst_d_key, '%Y-%m-%d')
                lbl_w = dt_w_obj.strftime('%b %d, %Y')
            except Exception:
                lbl_w = worst_d_key
            worst_day = {
                'date': worst_d_key,
                'label': lbl_w,
                'units': worst_d_val['units'],
                'revenue': float(round(worst_d_val['revenue'], 2)),
                'discount': float(round(worst_d_val.get('discount', Decimal('0.00')), 2)),
            }

    # 4. Detailed Subcategory Comparative Analysis
    subcategory_analysis = []
    for sc in subcategories:
        sc_items = sc.items.all()
        sc_total_items = sc_items.count()

        sc_sales = SaleOrderItem.objects.filter(
            item__subcategories=sc,
            sale_order__status='completed'
        ).exclude(sale_order__invoice_number__startswith='RET-')

        sc_total_units = sc_sales.aggregate(t=Sum('quantity'))['t'] or 0
        sc_total_revenue = float(sc_sales.aggregate(t=Sum('total_price'))['t'] or 0)

        item_sales_ranking = list(
            sc_sales.values('item_id', 'item_name')
            .annotate(units=Sum('quantity'), revenue=Sum('total_price'))
            .order_by('-units', '-revenue')
        )
        found_rank = sc_total_items
        for r_idx, r_item in enumerate(item_sales_ranking, start=1):
            if r_item['item_id'] == item.id:
                found_rank = r_idx
                break

        sc_avg_cost = float(round(sc_items.aggregate(a=Avg('cost_price'))['a'] or 0, 2))
        sc_avg_sell = float(round(sc_items.aggregate(a=Avg('selling_price'))['a'] or 0, 2))
        sc_avg_margin_pct = round(((sc_avg_sell - sc_avg_cost) / sc_avg_sell * 100), 2) if sc_avg_sell > 0 else 0.0

        item_sell = float(item.selling_price)
        item_cost = float(item.cost_price)
        item_margin_pct = round(((item_sell - item_cost) / item_sell * 100), 2) if item_sell > 0 else 0.0

        diff_price = round(item_sell - sc_avg_sell, 2)
        diff_price_pct = round((diff_price / sc_avg_sell * 100), 1) if sc_avg_sell > 0 else 0.0

        positioning = "At Par"
        if diff_price_pct > 8:
            positioning = "Premium Tier"
        elif diff_price_pct < -8:
            positioning = "Value / Budget"

        vol_share = round((total_units_sold / sc_total_units * 100), 1) if sc_total_units > 0 else 0.0
        rev_share = round((float(total_revenue) / sc_total_revenue * 100), 1) if sc_total_revenue > 0 else 0.0

        top_peers = []
        for r_item in item_sales_ranking[:4]:
            if r_item['item_id'] != item.id:
                peer_obj = Item.objects.filter(id=r_item['item_id']).first()
                if peer_obj:
                    top_peers.append({
                        'id': peer_obj.id,
                        'uid': peer_obj.uid,
                        'name': peer_obj.name,
                        'units_sold': r_item['units'],
                        'revenue': float(round(r_item['revenue'], 2)),
                        'selling_price': float(peer_obj.selling_price),
                    })
            if len(top_peers) >= 3:
                break

        is_primary = bool(primary_sub and sc.id == primary_sub.id)
        subcategory_analysis.append({
            'subcategory_id': sc.id,
            'subcategory_name': sc.name,
            'category_id': sc.category.id,
            'category_name': sc.category.name,
            'is_primary': is_primary,
            'total_items_in_subcat': sc_total_items,
            'total_subcat_units_sold': sc_total_units,
            'total_subcat_revenue': float(round(sc_total_revenue, 2)),
            'rank_in_subcategory': found_rank,
            'volume_share_pct': vol_share,
            'revenue_share_pct': rev_share,
            'subcat_avg_cost_price': sc_avg_cost,
            'subcat_avg_selling_price': sc_avg_sell,
            'subcat_avg_margin_pct': sc_avg_margin_pct,
            'item_cost_price': item_cost,
            'item_selling_price': item_sell,
            'item_margin_pct': item_margin_pct,
            'price_diff_vs_avg': diff_price,
            'price_diff_pct_vs_avg': diff_price_pct,
            'positioning': positioning,
            'top_peers': top_peers,
        })

    # 5. Continuous Multi-Granularity Time-Series
    all_movements = list(item.stock_movements.order_by('created_at'))
    movements_by_date = {}
    for sm in all_movements:
        d_str = sm.created_at.strftime('%Y-%m-%d')
        movements_by_date[d_str] = movements_by_date.get(d_str, 0) + sm.change

    # Build daily data map
    daily_records = []
    running_stock = 0
    curr_date = start_date
    delta_one_day = timedelta(days=1)

    while curr_date <= end_date:
        d_str = curr_date.strftime('%Y-%m-%d')

        # Price active as of curr_date
        active_cost = float(item.cost_price)
        active_sell = float(item.selling_price)
        for ph in price_records:
            if ph['date'] <= d_str:
                active_cost = ph['cost_price']
                active_sell = ph['selling_price']

        stock_chg = movements_by_date.get(d_str, 0)
        running_stock += stock_chg

        sales_entry = date_sales_map.get(d_str, {'units': 0, 'revenue': Decimal('0.00'), 'discount': Decimal('0.00')})
        u_sold = sales_entry['units']
        d_rev = float(round(sales_entry['revenue'], 2))
        d_disc = float(round(sales_entry.get('discount', Decimal('0.00')), 2))
        margin_val = round(active_sell - active_cost, 2)
        margin_pct_val = round((margin_val / active_sell * 100), 2) if active_sell > 0 else 0.0
        mrp_effective = float(item.mrp) if item.mrp is not None else active_sell
        has_disc = bool(d_disc > 0 or (mrp_effective > active_sell + 0.001))

        daily_records.append({
            'date': d_str,
            'curr_date': curr_date,
            'label': curr_date.strftime('%b %d, %Y'),
            'cost_price': active_cost,
            'selling_price': active_sell,
            'mrp': mrp_effective,
            'margin': margin_val,
            'margin_pct': margin_pct_val,
            'units_sold': u_sold,
            'revenue': d_rev,
            'discount': d_disc,
            'has_discount': has_disc,
            'stock_level': max(0, running_stock),
            'stock_change': stock_chg,
        })
        curr_date += delta_one_day

    # Aggregate: Day Level
    timeline_day = [
        {
            'key': r['date'],
            'label': r['curr_date'].strftime('%b %d'),
            'full_date': r['label'],
            'cost_price': r['cost_price'],
            'selling_price': r['selling_price'],
            'mrp': r['mrp'],
            'margin': r['margin'],
            'margin_pct': r['margin_pct'],
            'units_sold': r['units_sold'],
            'revenue': r['revenue'],
            'discount': r['discount'],
            'has_discount': r['has_discount'],
            'stock_level': r['stock_level'],
            'stock_change': r['stock_change'],
        }
        for r in daily_records
    ]

    # Aggregate: Week Level
    weeks_dict = {}
    for r in daily_records:
        y, w, _ = r['curr_date'].isocalendar()
        w_key = f"{y}-W{w:02d}"
        if w_key not in weeks_dict:
            weeks_dict[w_key] = {
                'key': w_key,
                'label': f"Wk {w}, '{str(y)[2:]}",
                'full_date': f"Week {w}, {y}",
                'cost_price': r['cost_price'],
                'selling_price': r['selling_price'],
                'mrp': r['mrp'],
                'margin': r['margin'],
                'margin_pct': r['margin_pct'],
                'units_sold': 0,
                'revenue': 0.0,
                'discount': 0.0,
                'has_discount': False,
                'stock_level': r['stock_level'],
                'stock_change': 0,
            }
        w_entry = weeks_dict[w_key]
        w_entry['cost_price'] = r['cost_price']
        w_entry['selling_price'] = r['selling_price']
        w_entry['mrp'] = r['mrp']
        w_entry['margin'] = r['margin']
        w_entry['margin_pct'] = r['margin_pct']
        w_entry['units_sold'] += r['units_sold']
        w_entry['revenue'] = round(w_entry['revenue'] + r['revenue'], 2)
        w_entry['discount'] = round(w_entry['discount'] + r['discount'], 2)
        if r['has_discount'] or w_entry['discount'] > 0:
            w_entry['has_discount'] = True
        w_entry['stock_level'] = r['stock_level']
        w_entry['stock_change'] += r['stock_change']

    timeline_week = list(weeks_dict.values())

    # Aggregate: Month Level
    months_dict = {}
    for r in daily_records:
        m_key = r['curr_date'].strftime('%Y-%m')
        if m_key not in months_dict:
            months_dict[m_key] = {
                'key': m_key,
                'label': r['curr_date'].strftime('%b %Y'),
                'full_date': r['curr_date'].strftime('%B %Y'),
                'cost_price': r['cost_price'],
                'selling_price': r['selling_price'],
                'mrp': r['mrp'],
                'margin': r['margin'],
                'margin_pct': r['margin_pct'],
                'units_sold': 0,
                'revenue': 0.0,
                'discount': 0.0,
                'has_discount': False,
                'stock_level': r['stock_level'],
                'stock_change': 0,
            }
        m_entry = months_dict[m_key]
        m_entry['cost_price'] = r['cost_price']
        m_entry['selling_price'] = r['selling_price']
        m_entry['mrp'] = r['mrp']
        m_entry['margin'] = r['margin']
        m_entry['margin_pct'] = r['margin_pct']
        m_entry['units_sold'] += r['units_sold']
        m_entry['revenue'] = round(m_entry['revenue'] + r['revenue'], 2)
        m_entry['discount'] = round(m_entry['discount'] + r['discount'], 2)
        if r['has_discount'] or m_entry['discount'] > 0:
            m_entry['has_discount'] = True
        m_entry['stock_level'] = r['stock_level']
        m_entry['stock_change'] += r['stock_change']

    timeline_month = list(months_dict.values())

    # Aggregate: Year Level
    years_dict = {}
    for r in daily_records:
        y_key = str(r['curr_date'].year)
        if y_key not in years_dict:
            years_dict[y_key] = {
                'key': y_key,
                'label': y_key,
                'full_date': f"Year {y_key}",
                'cost_price': r['cost_price'],
                'selling_price': r['selling_price'],
                'mrp': r['mrp'],
                'margin': r['margin'],
                'margin_pct': r['margin_pct'],
                'units_sold': 0,
                'revenue': 0.0,
                'discount': 0.0,
                'has_discount': False,
                'stock_level': r['stock_level'],
                'stock_change': 0,
            }
        y_entry = years_dict[y_key]
        y_entry['cost_price'] = r['cost_price']
        y_entry['selling_price'] = r['selling_price']
        y_entry['mrp'] = r['mrp']
        y_entry['margin'] = r['margin']
        y_entry['margin_pct'] = r['margin_pct']
        y_entry['units_sold'] += r['units_sold']
        y_entry['revenue'] = round(y_entry['revenue'] + r['revenue'], 2)
        y_entry['discount'] = round(y_entry['discount'] + r['discount'], 2)
        if r['has_discount'] or y_entry['discount'] > 0:
            y_entry['has_discount'] = True
        y_entry['stock_level'] = r['stock_level']
        y_entry['stock_change'] += r['stock_change']

    timeline_year = list(years_dict.values())

    # Recent Stock Movements
    recent_movements = []
    for sm in reversed(all_movements[-20:]):
        recent_movements.append({
            'id': sm.id,
            'timestamp': sm.created_at.isoformat(),
            'date': sm.created_at.strftime('%Y-%m-%d %H:%M'),
            'change': sm.change,
            'reason': sm.reason,
            'reason_display': sm.get_reason_display(),
            'note': sm.note,
            'performed_by_name': sm.performed_by_name or (sm.performed_by.name if sm.performed_by else 'System'),
            'performed_by_role': sm.performed_by_role or 'Staff',
        })

    # 6. Comprehensive Ranking Analysis Across Scopes & Metrics
    # Scope to current store or all items
    store_filter = Q(store=item.store) if item.store else Q()
    all_catalog_items = list(Item.objects.filter(store_filter).values('id', 'uid', 'name', 'cost_price', 'selling_price', 'quantity', 'created_at', 'supplier_id', 'supplier__name'))

    # Pre-fetch subcategories and parent categories for all items in store
    item_meta_map = {}
    for it in Item.objects.filter(store_filter).prefetch_related('subcategories__category'):
        sc_list = list(it.subcategories.all())
        item_meta_map[it.id] = {
            'subcat_ids': [sc.id for sc in sc_list],
            'subcat_names': [sc.name for sc in sc_list],
            'cat_ids': list(set(sc.category.id for sc in sc_list if sc.category)),
            'cat_names': list(set(sc.category.name for sc in sc_list if sc.category)),
        }

    # Pre-fetch completed sales by item
    catalog_sales_map = {}
    catalog_so_qs = SaleOrderItem.objects.filter(
        sale_order__status='completed',
        item__in=[it['id'] for it in all_catalog_items]
    ).exclude(sale_order__invoice_number__startswith='RET-')

    for agg in catalog_so_qs.values('item_id').annotate(
        tot_units=Sum('quantity'),
        tot_rev=Sum('total_price')
    ):
        catalog_sales_map[agg['item_id']] = {
            'units': agg['tot_units'] or 0,
            'revenue': float(agg['tot_rev'] or 0.0),
        }

    catalog_metrics = []
    for cit in all_catalog_items:
        s_data = catalog_sales_map.get(cit['id'], {'units': 0, 'revenue': 0.0})
        u_sold = s_data['units']
        rev = s_data['revenue']
        c_price = float(cit['cost_price'])
        s_price = float(cit['selling_price'])
        tot_c = c_price * u_sold
        profit = round(rev - tot_c, 2)
        m_pct = round((profit / rev * 100), 2) if rev > 0 else round(((s_price - c_price) / s_price * 100), 2) if s_price > 0 else 0.0

        c_days = max(1, (end_date - cit['created_at'].date()).days + 1)
        velocity = round(u_sold / c_days, 2)
        meta = item_meta_map.get(cit['id'], {'subcat_ids': [], 'subcat_names': [], 'cat_ids': [], 'cat_names': []})

        catalog_metrics.append({
            'id': cit['id'],
            'uid': cit['uid'],
            'name': cit['name'],
            'stock': cit['quantity'],
            'cost_price': c_price,
            'selling_price': s_price,
            'units_sold': u_sold,
            'revenue': rev,
            'profit': profit,
            'margin_pct': m_pct,
            'velocity': velocity,
            'supplier_id': cit['supplier_id'],
            'supplier_name': cit['supplier__name'] or '',
            'subcat_ids': meta['subcat_ids'],
            'subcat_names': meta['subcat_names'],
            'cat_ids': meta['cat_ids'],
            'cat_names': meta['cat_names'],
            'is_current': cit['id'] == item.id,
        })

    total_prods = max(1, len(catalog_metrics))

    def compute_group_rankings(item_pool, scope_type, scope_id=None, scope_label=""):
        pool_size = len(item_pool)
        if pool_size == 0:
            return None

        def rank_by(metric_key, ascending=False):
            sorted_pool = sorted(item_pool, key=lambda x: x[metric_key], reverse=not ascending)
            found_rank = None
            for idx, entry in enumerate(sorted_pool, start=1):
                if entry['is_current']:
                    found_rank = idx
                    break

            if found_rank is None:
                found_rank = pool_size

            current_entry = next((x for x in sorted_pool if x['is_current']), None)
            curr_val = current_entry[metric_key] if current_entry else 0

            leader = sorted_pool[0] if sorted_pool else None
            leader_val = leader[metric_key] if leader else 0
            leader_name = leader['name'] if leader else ''
            leader_uid = leader['uid'] if leader else ''

            total_metric_val = sum(x[metric_key] for x in sorted_pool)
            avg_metric_val = round(total_metric_val / pool_size, 2) if pool_size > 0 else 0

            diff_vs_avg_pct = 0.0
            if avg_metric_val > 0:
                diff_vs_avg_pct = round(((curr_val - avg_metric_val) / avg_metric_val) * 100, 1)

            top_slice = sorted_pool[:10]
            if current_entry and not any(x['is_current'] for x in top_slice):
                top_slice.append(current_entry)

            leaderboard_with_ranks = []
            for entry in top_slice:
                r_num = next((i for i, x in enumerate(sorted_pool, start=1) if x['id'] == entry['id']), 1)
                leaderboard_with_ranks.append({
                    **entry,
                    'rank': r_num,
                })

            percentile = round(((pool_size - found_rank + 1) / pool_size * 100), 1) if pool_size > 0 else 100.0

            return {
                'rank': found_rank,
                'total': pool_size,
                'percentile': percentile,
                'current_value': curr_val,
                'avg_value': avg_metric_val,
                'total_value': round(total_metric_val, 2),
                'leader_value': leader_val,
                'leader_name': leader_name,
                'leader_uid': leader_uid,
                'diff_vs_avg_pct': diff_vs_avg_pct,
                'leaderboard': leaderboard_with_ranks,
            }

        return {
            'scope_type': scope_type,
            'scope_id': scope_id,
            'scope_label': scope_label,
            'total_items': pool_size,
            'by_revenue': rank_by('revenue'),
            'by_profit': rank_by('profit'),
            'by_units': rank_by('units_sold'),
            'by_margin': rank_by('margin_pct'),
            'by_velocity': rank_by('velocity'),
            'by_stock': rank_by('stock'),
            'all_items_ranked': [
                {
                    'id': x['id'],
                    'uid': x['uid'],
                    'name': x['name'],
                    'stock': x['stock'],
                    'units_sold': x['units_sold'],
                    'revenue': x['revenue'],
                    'profit': x['profit'],
                    'margin_pct': x['margin_pct'],
                    'velocity': x['velocity'],
                    'supplier_name': x['supplier_name'],
                    'is_current': x['is_current'],
                }
                for x in sorted(item_pool, key=lambda x: x['revenue'], reverse=True)
            ],
        }

    all_scope = compute_group_rankings(catalog_metrics, 'all', None, 'All Store Products')

    categories_scopes = []
    for cat in item.parent_categories:
        cat_pool = [x for x in catalog_metrics if cat.id in x['cat_ids']]
        cat_res = compute_group_rankings(cat_pool, 'category', cat.id, cat.name)
        if cat_res:
            cat_res['category_id'] = cat.id
            cat_res['category_name'] = cat.name
            cat_res['is_primary'] = bool(primary_cat and cat.id == primary_cat.id)
            categories_scopes.append(cat_res)

    subcategories_scopes = []
    for sc in item.subcategories.all():
        sc_pool = [x for x in catalog_metrics if sc.id in x['subcat_ids']]
        sc_res = compute_group_rankings(sc_pool, 'subcategory', sc.id, sc.name)
        if sc_res:
            sc_res['subcategory_id'] = sc.id
            sc_res['subcategory_name'] = sc.name
            sc_res['category_name'] = sc.category.name if sc.category else ''
            sc_res['is_primary'] = bool(primary_sub and sc.id == primary_sub.id)
            subcategories_scopes.append(sc_res)

    supplier_scope = None
    if item.supplier:
        sup_pool = [x for x in catalog_metrics if x['supplier_id'] == item.supplier.id]
        sup_res = compute_group_rankings(sup_pool, 'supplier', item.supplier.id, item.supplier.name)
        if sup_res:
            sup_res['supplier_id'] = item.supplier.id
            sup_res['supplier_name'] = item.supplier.name
            supplier_scope = sup_res

    rankings_data = {
        'total_products': total_prods,
        'by_units': all_scope['by_units'] if all_scope else {},
        'by_revenue': all_scope['by_revenue'] if all_scope else {},
        'by_profit': all_scope['by_profit'] if all_scope else {},
        'by_margin': all_scope['by_margin'] if all_scope else {},
        'by_velocity': all_scope['by_velocity'] if all_scope else {},
        'by_stock': all_scope['by_stock'] if all_scope else {},
        'scopes': {
            'all': all_scope,
            'categories': categories_scopes,
            'subcategories': subcategories_scopes,
            'supplier': supplier_scope,
        }
    }

    cost_f = float(item.cost_price)
    sell_f = float(item.selling_price)
    qty_val = item.quantity
    stock_val_cost = round(qty_val * cost_f, 2)
    stock_val_retail = round(qty_val * sell_f, 2)
    potential_profit = round(qty_val * (sell_f - cost_f), 2)
    markup_pct = round(((sell_f - cost_f) / cost_f * 100), 2) if cost_f > 0 else 0.0

    return {
        'item': {
            'id': item.id,
            'uid': item.uid,
            'legacy_uid': item.legacy_uid,
            'name': item.name,
            'quantity': item.quantity,
            'cost_price': cost_f,
            'selling_price': sell_f,
            'mrp': float(item.mrp) if item.mrp is not None else None,
            'effective_mrp': float(item.effective_mrp),
            'current_margin': round(float(item.selling_price - item.cost_price), 2),
            'current_margin_pct': round(float((item.selling_price - item.cost_price) / item.selling_price * 100), 2) if item.selling_price > 0 else 0.0,
            'markup_pct': markup_pct,
            'stock_valuation_cost': stock_val_cost,
            'stock_valuation_retail': stock_val_retail,
            'potential_profit': potential_profit,
            'location_section': item.location_section,
            'expiry_date': item.expiry_date.isoformat() if item.expiry_date else None,
            'weight': float(item.weight) if item.weight is not None else None,
            'length': float(item.length) if item.length is not None else None,
            'width': float(item.width) if item.width is not None else None,
            'height': float(item.height) if item.height is not None else None,
            'description': item.description or "",
            'volume_cm3': item.volume_cm3,
            'volumetric_weight_kg': item.volumetric_weight_kg,
            'dimensions_display': item.dimensions_display,
            'source': item.source,
            'needs_new_barcode_printed': item.needs_new_barcode_printed,
            'created_at': item.created_at.isoformat(),
            'created_date': item.created_at.strftime('%B %d, %Y'),
            'updated_at': item.updated_at.isoformat() if hasattr(item, 'updated_at') and item.updated_at else None,
            'days_active': days_active,
            'primary_image_url': primary_image_url,
            'images_count': item.images.count(),
            'store_id': item.store_id,
            'store_name': item.store.name if item.store else '',
            'primary_subcategory': {
                'id': primary_sub.id,
                'name': primary_sub.name,
                'category_id': primary_sub.category.id if primary_sub.category else None,
                'category_name': primary_sub.category.name if primary_sub.category else 'General',
            } if primary_sub else None,
            'primary_category': {
                'id': primary_cat.id,
                'name': primary_cat.name,
            } if primary_cat else None,
            'categories': [{'id': c.id, 'name': c.name} for c in categories],
            'subcategories': [{'id': sc.id, 'name': sc.name, 'category_name': sc.category.name, 'is_primary': bool(primary_sub and sc.id == primary_sub.id)} for sc in subcategories],
        },
        'performance': {
            'total_units_sold': total_units_sold,
            'total_revenue': float(round(total_revenue, 2)),
            'total_cost': float(round(total_cost, 2)),
            'total_profit': float(round(total_profit, 2)),
            'total_discount': float(round(total_discount, 2)),
            'avg_discount_pct': round((float(total_discount) / float(total_revenue + total_discount) * 100), 1) if (total_revenue + total_discount) > 0 else 0.0,
            'margin_pct': margin_pct,
            'daily_velocity': daily_velocity,
            'weekly_velocity': weekly_velocity,
            'days_inventory_left': days_inventory_left,
            'stock_status': (
                'out_of_stock' if item.quantity <= 0
                else 'low_stock' if item.quantity <= 5
                else 'healthy'
            ),
            'best_day': best_day,
            'worst_day': worst_day,
            'lowest_day': worst_day,
            'best_month': best_month,
            'worst_month': worst_month,
            'lowest_month': worst_month,
            'best_week': best_week,
            'worst_week': worst_week,
            'lowest_week': worst_week,
            'best_day_of_week': best_dow,
            'worst_day_of_week': worst_dow,
            'lowest_day_of_week': worst_dow,
        },
        'rankings': rankings_data,
        'subcategory_analysis': subcategory_analysis,
        'price_history': price_records,
        'timeline': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'levels': {
                'year': timeline_year,
                'month': timeline_month,
                'week': timeline_week,
                'day': timeline_day,
            }
        },
        'recent_sales': recent_sales,
        'recent_movements': recent_movements,
    }
