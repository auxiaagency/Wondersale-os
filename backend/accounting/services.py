from decimal import Decimal
from datetime import datetime, timedelta
import calendar
from django.utils import timezone
from django.db.models import Sum, Q, Count

from inventory.models import Store, SaleOrder, SaleOrderItem, CounterPayout
from staff.models import StaffMember
from .models import OperatingExpense


def generate_next_expense_voucher_number(year: int = None, month: int = None) -> str:
    """
    Generates a collision-free sequential operating expense voucher number.
    Format: EXP-YYYYMM-0001
    """
    from .models import OperatingExpense
    now = timezone.now()
    y = year or now.year
    m = month or now.month
    prefix = f"EXP-{y:04d}{m:02d}-"

    last = OperatingExpense.objects.filter(
        voucher_number__startswith=prefix
    ).order_by('-voucher_number').first()

    if not last:
        seq = 1
    else:
        try:
            raw_seq = last.voucher_number.split('-')[-1]
            seq = int(raw_seq) + 1
        except Exception:
            seq = OperatingExpense.objects.filter(voucher_number__startswith=prefix).count() + 1

    return f"{prefix}{seq:04d}"



def parse_store_filter_ids(store_param=None, store_list=None):
    """
    Parses store query parameters into a list of integer store IDs, or None (for all stores).
    Handles:
    - None, '', 'all', 'all_stores', '0' -> None (all stores)
    - Comma-separated: '1,2' -> [1, 2]
    - List of params: ['1', '2'] -> [1, 2]
    - Single ID: '1' or 1 -> [1]
    """
    candidates = []
    if store_list and isinstance(store_list, (list, tuple)):
        for s in store_list:
            if s:
                candidates.extend(str(s).split(','))
    elif store_param:
        if isinstance(store_param, (list, tuple)):
            for s in store_param:
                if s:
                    candidates.extend(str(s).split(','))
        else:
            candidates.extend(str(store_param).split(','))

    valid_ids = []
    for c in candidates:
        c_str = str(c).strip().lower()
        if not c_str or c_str in ('all', 'all_stores', '0', 'null', 'undefined'):
            continue
        try:
            val = int(c_str)
            if val > 0 and val not in valid_ids:
                valid_ids.append(val)
        except (ValueError, TypeError):
            pass

    if not valid_ids:
        return None
    return valid_ids


def get_store_earliest_record_date(target_store_ids=None):
    """
    Returns the exact date when store records began (date object).
    Anchors to earliest recorded transaction (SaleOrder, OperatingExpense)
    or Store creation date, whichever is earliest among valid records.
    """
    if target_store_ids:
        stores_qs = Store.objects.filter(id__in=target_store_ids)
    else:
        stores_qs = Store.objects.filter(is_active=True)
    if not stores_qs.exists():
        stores_qs = Store.objects.all()

    store_dates = [st.created_at.date() for st in stores_qs if getattr(st, 'created_at', None)]
    min_store_date = min(store_dates) if store_dates else None

    # Earliest non-cancelled SaleOrder
    so_qs = SaleOrder.objects.exclude(status='cancelled')
    if target_store_ids is not None:
        so_qs = so_qs.filter(store_id__in=target_store_ids)
    if min_store_date:
        real_so = so_qs.filter(created_at__date__gte=min_store_date).order_by('created_at').first()
        first_so = real_so if real_so else so_qs.order_by('created_at').first()
    else:
        first_so = so_qs.order_by('created_at').first()

    # Earliest OperatingExpense
    exp_qs = OperatingExpense.objects.all()
    if target_store_ids is not None:
        exp_qs = exp_qs.filter(store_id__in=target_store_ids)
    if min_store_date:
        real_exp = exp_qs.filter(expense_date__gte=min_store_date).order_by('expense_date').first()
        first_exp = real_exp if real_exp else exp_qs.order_by('expense_date').first()
    else:
        first_exp = exp_qs.order_by('expense_date').first()

    candidates = []
    if first_so:
        candidates.append(first_so.created_at.date())
    if first_exp:
        candidates.append(first_exp.expense_date)
    if min_store_date:
        candidates.append(min_store_date)

    if candidates:
        return min(candidates)
    return min_store_date or timezone.now().date()


def get_monthly_financial_analysis(store_id=None, year=None, month=None, start_date=None, end_date=None, store_ids=None):
    """
    Computes comprehensive monthly financial and accounting intelligence:
    1. Executive Financial Summary (Revenue, COGS, Gross Profit, Expenses, Salaries)
    2. Dual Profit Comparison: Store Net Operating Profit (WITHOUT Stakeholders) vs Final Retained Profit (WITH Stakeholders)
    3. Category & SubCategory Sales Performance (Revenue, Profit, Margin %, Units Sold, and Individual Item breakdown)
    4. Supplier Sales Performance (Revenue, Profit, Margin %, Units Sold, and Supplied Items breakdown)
    5. Operating Expenses Distribution by Category
    6. Daily Revenue & Expense Timeline for trend charts
    7. Payment Method Distribution (Inflow & Outflow)
    8. Financial Flow Waterfall
    """
    from .models import OperatingExpense
    from stakeholders.models import Stakeholder, StakeholderPayout

    target_store_ids = parse_store_filter_ids(store_id, store_ids)
    is_combined = (target_store_ids is None or len(target_store_ids) > 1)

    if target_store_ids:
        active_stores = list(Store.objects.filter(id__in=target_store_ids))
    else:
        active_stores = list(Store.objects.filter(is_active=True))
    if not active_stores:
        active_stores = list(Store.objects.all())

    cur_tz = timezone.get_current_timezone()
    for st in active_stores:
        if getattr(st, 'timezone', None):
            try:
                import zoneinfo
                cur_tz = zoneinfo.ZoneInfo(st.timezone)
                break
            except Exception:
                pass

    now_local = timezone.now().astimezone(cur_tz)
    earliest_record_date = get_store_earliest_record_date(target_store_ids)
    target_year = int(year) if year else now_local.year
    target_month = int(month) if month else now_local.month
    if target_month < 1 or target_month > 12:
        target_month = now_local.month

    _, last_day = calendar.monthrange(target_year, target_month)
    month_start = datetime(target_year, target_month, 1, 0, 0, 0, tzinfo=cur_tz)
    month_end = datetime(target_year, target_month, last_day, 23, 59, 59, 999999, tzinfo=cur_tz)

    if start_date and end_date:
        try:
            s_dt = datetime.strptime(str(start_date)[:10], '%Y-%m-%d')
            e_dt = datetime.strptime(str(end_date)[:10], '%Y-%m-%d')
            month_start = datetime(s_dt.year, s_dt.month, s_dt.day, 0, 0, 0, tzinfo=cur_tz)
            month_end = datetime(e_dt.year, e_dt.month, e_dt.day, 23, 59, 59, 999999, tzinfo=cur_tz)
            if not year and not month:
                target_year = s_dt.year
                target_month = s_dt.month
            elif not year:
                target_year = s_dt.year
            elif not month:
                target_month = s_dt.month
            last_day = max(1, (month_end.date() - month_start.date()).days + 1)
        except Exception:
            pass

    # 1. SALES ORDERS & RETURNS (Filtered on or after store earliest record date)
    base_orders_qs = SaleOrder.objects.filter(
        created_at__gte=month_start,
        created_at__lte=month_end,
        created_at__date__gte=earliest_record_date,
    ).exclude(status='cancelled')
    if target_store_ids is not None:
        base_orders_qs = base_orders_qs.filter(store_id__in=target_store_ids)

    sales_qs = base_orders_qs.exclude(invoice_number__startswith='RET-')
    returns_qs = base_orders_qs.filter(invoice_number__startswith='RET-')

    gross_revenue = sales_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_refunds = returns_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_revenue = max(Decimal('0.00'), gross_revenue - total_refunds)
    total_orders_count = sales_qs.count()
    average_order_value = float(total_revenue / total_orders_count) if total_orders_count > 0 else 0.0

    # Store GST Configuration & Precise Inflow Calculation
    if target_store_ids and len(target_store_ids) == 1:
        store_obj = active_stores[0] if active_stores else None
        gst_rate = store_obj.gst_rate if store_obj else Decimal('18.00')
        gst_mode = store_obj.gst_calculation_mode if store_obj else 'all'
        enable_gst = store_obj.enable_gst if store_obj else True
        enable_stakeholders = getattr(store_obj, 'enable_stakeholders', True) if store_obj else (Store.objects.filter(enable_stakeholders=True).exists() if Store.objects.exists() else True)

        sales_upi = Decimal('0.00')
        sales_cash = Decimal('0.00')
        for s in sales_qs:
            pm = (s.payment_method or '').lower()
            if pm == 'upi':
                sales_upi += s.total_amount
            elif pm == 'split':
                sales_upi += (s.split_upi_amount or Decimal('0.00'))
                sales_cash += (s.split_cash_amount or Decimal('0.00'))
            else:
                sales_cash += s.total_amount

        refunds_upi = Decimal('0.00')
        refunds_cash = Decimal('0.00')
        for r in returns_qs:
            pm = (r.payment_method or '').lower()
            if pm == 'upi':
                refunds_upi += r.total_amount
            elif pm == 'split':
                refunds_upi += (r.split_upi_amount or Decimal('0.00'))
                refunds_cash += (r.split_cash_amount or Decimal('0.00'))
            else:
                refunds_cash += r.total_amount

        net_upi_inflows = max(Decimal('0.00'), sales_upi - refunds_upi)
        net_cash_inflows = max(Decimal('0.00'), sales_cash - refunds_cash)

        if not enable_gst:
            taxable_base = Decimal('0.00')
            gst_amount = Decimal('0.00')
        elif gst_mode == 'upi_only':
            taxable_base = net_upi_inflows
            gst_amount = (taxable_base * (gst_rate / Decimal('100.00'))).quantize(Decimal('0.01'))
        else:  # 'all'
            taxable_base = total_revenue
            gst_amount = (taxable_base * (gst_rate / Decimal('100.00'))).quantize(Decimal('0.01'))
    else:
        # Multiple stores or all stores combined
        enable_gst = any(getattr(s, 'enable_gst', True) for s in active_stores)
        enable_stakeholders = any(getattr(s, 'enable_stakeholders', True) for s in active_stores) if active_stores else True
        primary_store = active_stores[0] if active_stores else None
        gst_rate = primary_store.gst_rate if primary_store else Decimal('18.00')
        unique_modes = list(set(getattr(s, 'gst_calculation_mode', 'all') for s in active_stores))
        gst_mode = unique_modes[0] if len(unique_modes) == 1 else 'multi_store'

        total_taxable = Decimal('0.00')
        total_gst = Decimal('0.00')
        total_upi_inflow = Decimal('0.00')
        total_cash_inflow = Decimal('0.00')

        for st in active_stores:
            st_sales = [s for s in sales_qs if s.store_id == st.id]
            st_returns = [r for r in returns_qs if r.store_id == st.id]

            st_s_upi = Decimal('0.00')
            st_s_cash = Decimal('0.00')
            for s in st_sales:
                pm = (s.payment_method or '').lower()
                if pm == 'upi':
                    st_s_upi += s.total_amount
                elif pm == 'split':
                    st_s_upi += (s.split_upi_amount or Decimal('0.00'))
                    st_s_cash += (s.split_cash_amount or Decimal('0.00'))
                else:
                    st_s_cash += s.total_amount

            st_r_upi = Decimal('0.00')
            st_r_cash = Decimal('0.00')
            for r in st_returns:
                pm = (r.payment_method or '').lower()
                if pm == 'upi':
                    st_r_upi += r.total_amount
                elif pm == 'split':
                    st_r_upi += (r.split_upi_amount or Decimal('0.00'))
                    st_r_cash += (r.split_cash_amount or Decimal('0.00'))
                else:
                    st_r_cash += r.total_amount

            st_net_upi = max(Decimal('0.00'), st_s_upi - st_r_upi)
            st_net_cash = max(Decimal('0.00'), st_s_cash - st_r_cash)
            total_upi_inflow += st_net_upi
            total_cash_inflow += st_net_cash

            st_tot_rev = max(Decimal('0.00'), sum((s.total_amount for s in st_sales), Decimal('0.00')) - sum((r.total_amount for r in st_returns), Decimal('0.00')))
            if not getattr(st, 'enable_gst', True):
                st_tax = Decimal('0.00')
                st_g = Decimal('0.00')
            elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
                st_tax = st_net_upi
                st_g = (st_tax * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
            else:
                st_tax = st_tot_rev
                st_g = (st_tax * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))

            total_taxable += st_tax
            total_gst += st_g

        net_upi_inflows = total_upi_inflow
        net_cash_inflows = total_cash_inflow
        taxable_base = total_taxable
        gst_amount = total_gst

    net_revenue_after_gst = max(Decimal('0.00'), total_revenue - gst_amount)

    # 2. LINE ITEMS, COGS, CATEGORY/SUBCATEGORY & SUPPLIER ATTRIBUTION
    items_qs = SaleOrderItem.objects.filter(
        sale_order__in=sales_qs
    ).select_related('item', 'item__supplier', 'item__section', 'item__primary_subcategory__category', 'sale_order').prefetch_related('item__subcategories__category')

    return_items_qs = SaleOrderItem.objects.filter(
        sale_order__in=returns_qs
    ).select_related('item', 'item__supplier', 'item__section', 'item__primary_subcategory__category', 'sale_order').prefetch_related('item__subcategories__category')

    gross_cogs = Decimal('0.00')
    returned_cogs = Decimal('0.00')
    total_units_sold = 0
    daily_cogs = {}
    store_cogs_map = {st.id: Decimal('0.00') for st in active_stores}

    category_map = {}
    supplier_map = {}
    section_map = {}

    def resolve_cat_sub(line_item):
        item = line_item.item
        if not item:
            return 'General / Uncategorized', 0, 'General', 0
        primary_sub = item.effective_primary_subcategory
        if primary_sub:
            cat_name = primary_sub.category.name if primary_sub.category else 'General'
            cat_id = primary_sub.category.id if primary_sub.category else 0
            sub_name = primary_sub.name
            sub_id = primary_sub.id
        else:
            cat_name = 'General / Uncategorized'
            cat_id = 0
            sub_name = 'General'
            sub_id = 0
        return cat_name, cat_id, sub_name, sub_id

    for it in items_qs:
        qty = it.quantity
        line_rev = it.total_price
        line_cost = (it.unit_cost_price or Decimal('0.00')) * qty
        line_profit = line_rev - line_cost

        gross_cogs += line_cost
        total_units_sold += qty

        st_id = it.sale_order.store_id
        if st_id in store_cogs_map:
            store_cogs_map[st_id] += line_cost

        ord_day = (it.sale_order.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= ord_day <= last_day:
            daily_cogs[ord_day] = daily_cogs.get(ord_day, Decimal('0.00')) + line_cost

        cat_name, cat_id, sub_name, sub_id = resolve_cat_sub(it)

        if cat_name not in category_map:
            category_map[cat_name] = {
                'id': cat_id,
                'name': cat_name,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
                'subcategories': {}
            }

        cat_entry = category_map[cat_name]
        cat_entry['revenue'] += line_rev
        cat_entry['cogs'] += line_cost
        cat_entry['gross_profit'] += line_profit
        cat_entry['units_sold'] += qty

        if sub_name not in cat_entry['subcategories']:
            cat_entry['subcategories'][sub_name] = {
                'id': sub_id,
                'name': sub_name,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
                'items': {},
            }

        sub_entry = cat_entry['subcategories'][sub_name]
        sub_entry['revenue'] += line_rev
        sub_entry['cogs'] += line_cost
        sub_entry['gross_profit'] += line_profit
        sub_entry['units_sold'] += qty

        # Track Individual Item within Subcategory
        item_key = it.item.id if it.item else (it.id or 0)
        item_name = it.item.name if it.item else (it.item_name or it.description or 'Unlisted Item')
        item_barcode = getattr(it.item, 'uid', getattr(it.item, 'barcode', '')) if it.item else ''
        item_sku = getattr(it.item, 'sku', getattr(it.item, 'uid', '')) if it.item else ''
        item_sp = float(it.unit_selling_price or (it.item.selling_price if it.item else Decimal('0.00')))
        item_cp = float(it.unit_cost_price or (it.item.cost_price if it.item else Decimal('0.00')))

        if item_key not in sub_entry['items']:
            sub_entry['items'][item_key] = {
                'id': item_key,
                'name': item_name,
                'barcode': item_barcode,
                'sku': item_sku,
                'selling_price': item_sp,
                'cost_price': item_cp,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
            }
        sub_item = sub_entry['items'][item_key]
        sub_item['revenue'] += line_rev
        sub_item['cogs'] += line_cost
        sub_item['gross_profit'] += line_profit
        sub_item['units_sold'] += qty

        # Track Supplier Attribution
        sup_obj = it.item.supplier if (it.item and it.item.supplier) else None
        sup_id = sup_obj.id if sup_obj else 0
        sup_name = sup_obj.name if sup_obj else 'Direct / In-House'
        sup_contact = getattr(sup_obj, 'contact_person', '') or ''
        sup_phone = getattr(sup_obj, 'phone', '') or ''
        sup_email = getattr(sup_obj, 'email', '') or ''

        if sup_name not in supplier_map:
            supplier_map[sup_name] = {
                'id': sup_id,
                'name': sup_name,
                'contact_person': sup_contact,
                'phone': sup_phone,
                'email': sup_email,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
                'items': {},
            }
        sup_entry = supplier_map[sup_name]
        sup_entry['revenue'] += line_rev
        sup_entry['cogs'] += line_cost
        sup_entry['gross_profit'] += line_profit
        sup_entry['units_sold'] += qty

        if item_key not in sup_entry['items']:
            sup_entry['items'][item_key] = {
                'id': item_key,
                'name': item_name,
                'barcode': item_barcode,
                'sku': item_sku,
                'selling_price': item_sp,
                'cost_price': item_cp,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
            }
        sup_item = sup_entry['items'][item_key]
        sup_item['revenue'] += line_rev
        sup_item['cogs'] += line_cost
        sup_item['gross_profit'] += line_profit
        sup_item['units_sold'] += qty

        # Track Section Attribution
        sec_obj = it.item.section if (it.item and it.item.section) else None
        sec_id = sec_obj.id if sec_obj else 0
        sec_name = sec_obj.name if sec_obj else 'Unassigned / General'
        sec_code = getattr(sec_obj, 'code', '') or ''
        sec_color = getattr(sec_obj, 'color', '') or '#6B7280'

        if sec_id not in section_map:
            section_map[sec_id] = {
                'id': sec_id,
                'name': sec_name,
                'code': sec_code,
                'color': sec_color,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
                'items': {},
                'daily_rev': {},
                'daily_cogs': {},
                'daily_gp': {},
            }
        sec_entry = section_map[sec_id]
        sec_entry['revenue'] += line_rev
        sec_entry['cogs'] += line_cost
        sec_entry['gross_profit'] += line_profit
        sec_entry['units_sold'] += qty
        if 1 <= ord_day <= last_day:
            sec_entry['daily_rev'][ord_day] = sec_entry['daily_rev'].get(ord_day, Decimal('0.00')) + line_rev
            sec_entry['daily_cogs'][ord_day] = sec_entry['daily_cogs'].get(ord_day, Decimal('0.00')) + line_cost
            sec_entry['daily_gp'][ord_day] = sec_entry['daily_gp'].get(ord_day, Decimal('0.00')) + line_profit

        if item_key not in sec_entry['items']:
            sec_entry['items'][item_key] = {
                'id': item_key,
                'name': item_name,
                'barcode': item_barcode,
                'sku': item_sku,
                'selling_price': item_sp,
                'cost_price': item_cp,
                'revenue': Decimal('0.00'),
                'cogs': Decimal('0.00'),
                'gross_profit': Decimal('0.00'),
                'units_sold': 0,
            }
        sec_item = sec_entry['items'][item_key]
        sec_item['revenue'] += line_rev
        sec_item['cogs'] += line_cost
        sec_item['gross_profit'] += line_profit
        sec_item['units_sold'] += qty

    # Process returned items: deduct units, revenue, profit, and restore COGS
    for it in return_items_qs:
        qty = it.quantity
        line_rev = it.total_price
        line_cost = (it.unit_cost_price or Decimal('0.00')) * qty
        line_profit = line_rev - line_cost

        returned_cogs += line_cost
        total_units_sold = max(0, total_units_sold - qty)

        st_id = it.sale_order.store_id
        if st_id in store_cogs_map:
            store_cogs_map[st_id] = max(Decimal('0.00'), store_cogs_map[st_id] - line_cost)

        ord_day = (it.sale_order.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= ord_day <= last_day:
            daily_cogs[ord_day] = daily_cogs.get(ord_day, Decimal('0.00')) - line_cost

        cat_name, cat_id, sub_name, sub_id = resolve_cat_sub(it)

        if cat_name in category_map:
            cat_entry = category_map[cat_name]
            cat_entry['revenue'] = max(Decimal('0.00'), cat_entry['revenue'] - line_rev)
            cat_entry['cogs'] = max(Decimal('0.00'), cat_entry['cogs'] - line_cost)
            cat_entry['gross_profit'] = max(Decimal('0.00'), cat_entry['gross_profit'] - line_profit)
            cat_entry['units_sold'] = max(0, cat_entry['units_sold'] - qty)

            if sub_name in cat_entry['subcategories']:
                sub_entry = cat_entry['subcategories'][sub_name]
                sub_entry['revenue'] = max(Decimal('0.00'), sub_entry['revenue'] - line_rev)
                sub_entry['cogs'] = max(Decimal('0.00'), sub_entry['cogs'] - line_cost)
                sub_entry['gross_profit'] = max(Decimal('0.00'), sub_entry['gross_profit'] - line_profit)
                sub_entry['units_sold'] = max(0, sub_entry['units_sold'] - qty)

                item_key = it.item.id if it.item else (it.id or 0)
                if 'items' in sub_entry and item_key in sub_entry['items']:
                    sub_item = sub_entry['items'][item_key]
                    sub_item['revenue'] = max(Decimal('0.00'), sub_item['revenue'] - line_rev)
                    sub_item['cogs'] = max(Decimal('0.00'), sub_item['cogs'] - line_cost)
                    sub_item['gross_profit'] = max(Decimal('0.00'), sub_item['gross_profit'] - line_profit)
                    sub_item['units_sold'] = max(0, sub_item['units_sold'] - qty)

        sup_obj = it.item.supplier if (it.item and it.item.supplier) else None
        sup_name = sup_obj.name if sup_obj else 'Direct / In-House'
        if sup_name in supplier_map:
            sup_entry = supplier_map[sup_name]
            sup_entry['revenue'] = max(Decimal('0.00'), sup_entry['revenue'] - line_rev)
            sup_entry['cogs'] = max(Decimal('0.00'), sup_entry['cogs'] - line_cost)
            sup_entry['gross_profit'] = max(Decimal('0.00'), sup_entry['gross_profit'] - line_profit)
            sup_entry['units_sold'] = max(0, sup_entry['units_sold'] - qty)

            item_key = it.item.id if it.item else (it.id or 0)
            if 'items' in sup_entry and item_key in sup_entry['items']:
                sup_item = sup_entry['items'][item_key]
                sup_item['revenue'] = max(Decimal('0.00'), sup_item['revenue'] - line_rev)
                sup_item['cogs'] = max(Decimal('0.00'), sup_item['cogs'] - line_cost)
                sup_item['gross_profit'] = max(Decimal('0.00'), sup_item['gross_profit'] - line_profit)
                sup_item['units_sold'] = max(0, sup_item['units_sold'] - qty)

        sec_obj = it.item.section if (it.item and it.item.section) else None
        sec_id = sec_obj.id if sec_obj else 0
        if sec_id in section_map:
            sec_entry = section_map[sec_id]
            sec_entry['revenue'] = max(Decimal('0.00'), sec_entry['revenue'] - line_rev)
            sec_entry['cogs'] = max(Decimal('0.00'), sec_entry['cogs'] - line_cost)
            sec_entry['gross_profit'] = max(Decimal('0.00'), sec_entry['gross_profit'] - line_profit)
            sec_entry['units_sold'] = max(0, sec_entry['units_sold'] - qty)
            if 1 <= ord_day <= last_day:
                sec_entry['daily_rev'][ord_day] = max(Decimal('0.00'), sec_entry['daily_rev'].get(ord_day, Decimal('0.00')) - line_rev)
                sec_entry['daily_cogs'][ord_day] = max(Decimal('0.00'), sec_entry['daily_cogs'].get(ord_day, Decimal('0.00')) - line_cost)
                sec_entry['daily_gp'][ord_day] = max(Decimal('0.00'), sec_entry['daily_gp'].get(ord_day, Decimal('0.00')) - line_profit)

            item_key = it.item.id if it.item else (it.id or 0)
            if 'items' in sec_entry and item_key in sec_entry['items']:
                sec_item = sec_entry['items'][item_key]
                sec_item['revenue'] = max(Decimal('0.00'), sec_item['revenue'] - line_rev)
                sec_item['cogs'] = max(Decimal('0.00'), sec_item['cogs'] - line_cost)
                sec_item['gross_profit'] = max(Decimal('0.00'), sec_item['gross_profit'] - line_profit)
                sec_item['units_sold'] = max(0, sec_item['units_sold'] - qty)

    total_cogs = max(Decimal('0.00'), gross_cogs - returned_cogs)
    gross_profit = (net_revenue_after_gst - total_cogs) if total_cogs > 0 else net_revenue_after_gst
    gross_margin_pct = float((gross_profit / net_revenue_after_gst) * 100) if net_revenue_after_gst > Decimal('0.00') else 0.0

    # Format Category & Subcategory List with Individual Item Breakdown
    categories_list = []
    for cat_name, cat_data in category_map.items():
        sub_list = []
        for s_name, s_data in cat_data['subcategories'].items():
            s_gst = (s_data['revenue'] / total_revenue) * gst_amount if total_revenue > Decimal('0.00') else Decimal('0.00')
            s_net_rev = max(Decimal('0.00'), s_data['revenue'] - s_gst)
            s_gp = s_net_rev - s_data['cogs']
            s_margin = float((s_gp / s_net_rev) * 100) if s_net_rev > Decimal('0.00') else 0.0

            sub_items = []
            for it_id, it_data in s_data.get('items', {}).items():
                it_rev = float(it_data['revenue'])
                it_cogs = float(it_data['cogs'])
                it_gp = float(it_data['gross_profit'])
                it_margin = float((it_gp / it_rev) * 100) if it_rev > 0 else 0.0
                sub_items.append({
                    'id': it_data['id'],
                    'name': it_data['name'],
                    'barcode': it_data.get('barcode', ''),
                    'sku': it_data.get('sku', ''),
                    'selling_price': it_data.get('selling_price', 0.0),
                    'cost_price': it_data.get('cost_price', 0.0),
                    'revenue': round(it_rev, 2),
                    'cogs': round(it_cogs, 2),
                    'gross_profit': round(it_gp, 2),
                    'margin_pct': round(it_margin, 1),
                    'units_sold': it_data['units_sold'],
                })
            sub_items.sort(key=lambda x: x['revenue'], reverse=True)

            sub_list.append({
                'id': s_data['id'],
                'name': s_name,
                'revenue': float(s_data['revenue']),
                'gst_amount': float(round(s_gst, 2)),
                'net_revenue': float(round(s_net_rev, 2)),
                'cogs': float(s_data['cogs']),
                'gross_profit': float(round(s_gp, 2)),
                'margin_pct': round(s_margin, 1),
                'units_sold': s_data['units_sold'],
                'items_count': len(sub_items),
                'items': sub_items,
            })
        sub_list.sort(key=lambda x: x['revenue'], reverse=True)

        cat_gst = (cat_data['revenue'] / total_revenue) * gst_amount if total_revenue > Decimal('0.00') else Decimal('0.00')
        cat_net_rev = max(Decimal('0.00'), cat_data['revenue'] - cat_gst)
        cat_gp = cat_net_rev - cat_data['cogs']
        cat_margin = float((cat_gp / cat_net_rev) * 100) if cat_net_rev > Decimal('0.00') else 0.0
        share_of_sales = float((cat_data['revenue'] / total_revenue) * 100) if total_revenue > Decimal('0.00') else 0.0

        categories_list.append({
            'id': cat_data['id'],
            'name': cat_name,
            'revenue': float(cat_data['revenue']),
            'gst_amount': float(round(cat_gst, 2)),
            'net_revenue': float(round(cat_net_rev, 2)),
            'cogs': float(cat_data['cogs']),
            'gross_profit': float(round(cat_gp, 2)),
            'margin_pct': round(cat_margin, 1),
            'units_sold': cat_data['units_sold'],
            'share_of_sales_pct': round(share_of_sales, 1),
            'subcategories': sub_list,
        })
    categories_list.sort(key=lambda x: x['revenue'], reverse=True)

    # Format Supplier Performance List
    suppliers_list = []
    for s_name, s_data in supplier_map.items():
        s_rev = float(s_data['revenue'])
        s_cogs = float(s_data['cogs'])
        s_gp = float(s_data['gross_profit'])
        s_margin = float((s_gp / s_rev) * 100) if s_rev > 0 else 0.0
        s_share = float((s_data['revenue'] / total_revenue) * 100) if total_revenue > Decimal('0.00') else 0.0

        s_items = []
        for it_id, it_data in s_data.get('items', {}).items():
            it_rev = float(it_data['revenue'])
            it_cogs = float(it_data['cogs'])
            it_gp = float(it_data['gross_profit'])
            it_margin = float((it_gp / it_rev) * 100) if it_rev > 0 else 0.0
            s_items.append({
                'id': it_data['id'],
                'name': it_data['name'],
                'barcode': it_data.get('barcode', ''),
                'sku': it_data.get('sku', ''),
                'selling_price': it_data.get('selling_price', 0.0),
                'cost_price': it_data.get('cost_price', 0.0),
                'revenue': round(it_rev, 2),
                'cogs': round(it_cogs, 2),
                'gross_profit': round(it_gp, 2),
                'margin_pct': round(it_margin, 1),
                'units_sold': it_data['units_sold'],
            })
        s_items.sort(key=lambda x: x['revenue'], reverse=True)

        suppliers_list.append({
            'id': s_data['id'],
            'name': s_name,
            'contact_person': s_data.get('contact_person', ''),
            'phone': s_data.get('phone', ''),
            'email': s_data.get('email', ''),
            'revenue': round(s_rev, 2),
            'cogs': round(s_cogs, 2),
            'gross_profit': round(s_gp, 2),
            'margin_pct': round(s_margin, 1),
            'units_sold': s_data['units_sold'],
            'items_count': len(s_items),
            'share_of_sales_pct': round(s_share, 1),
            'items': s_items,
        })
    suppliers_list.sort(key=lambda x: x['revenue'], reverse=True)

    # Format Section Performance List
    sections_list = []
    for sec_id, sec_data in section_map.items():
        sec_name = sec_data['name']
        sec_rev = float(sec_data['revenue'])
        sec_gst = (sec_data['revenue'] / total_revenue) * gst_amount if total_revenue > Decimal('0.00') else Decimal('0.00')
        sec_net_rev = max(Decimal('0.00'), sec_data['revenue'] - sec_gst)
        sec_cogs = float(sec_data['cogs'])
        sec_gp = sec_net_rev - sec_data['cogs']
        sec_margin = float((sec_gp / sec_net_rev) * 100) if sec_net_rev > Decimal('0.00') else 0.0
        sec_share = float((sec_data['revenue'] / total_revenue) * 100) if total_revenue > Decimal('0.00') else 0.0

        sec_items = []
        for it_id, it_data in sec_data.get('items', {}).items():
            it_rev = float(it_data['revenue'])
            it_cogs = float(it_data['cogs'])
            it_gp = float(it_data['gross_profit'])
            it_margin = float((it_gp / it_rev) * 100) if it_rev > 0 else 0.0
            sec_items.append({
                'id': it_data['id'],
                'name': it_data['name'],
                'barcode': it_data.get('barcode', ''),
                'sku': it_data.get('sku', ''),
                'selling_price': it_data.get('selling_price', 0.0),
                'cost_price': it_data.get('cost_price', 0.0),
                'revenue': round(it_rev, 2),
                'cogs': round(it_cogs, 2),
                'gross_profit': round(it_gp, 2),
                'margin_pct': round(it_margin, 1),
                'units_sold': it_data['units_sold'],
            })
        sec_items.sort(key=lambda x: x['revenue'], reverse=True)

        # Build section timeline
        sec_timeline = []
        for day in range(1, last_day + 1):
            cur_date = month_start.date() + timedelta(days=day - 1)
            d_rev = sec_data.get('daily_rev', {}).get(day, Decimal('0.00'))
            d_cogs = sec_data.get('daily_cogs', {}).get(day, Decimal('0.00'))
            d_gp = sec_data.get('daily_gp', {}).get(day, Decimal('0.00'))
            sec_timeline.append({
                'day': day,
                'date': cur_date.strftime('%Y-%m-%d'),
                'label': f"{calendar.month_abbr[cur_date.month]} {cur_date.day}",
                'revenue': float(round(d_rev, 2)),
                'gross_profit': float(round(d_gp, 2)),
                'profit': float(round(d_gp, 2)),
                'cogs': float(round(d_cogs, 2)),
            })

        # Build section weeks
        sec_weeks = []
        w_start = 1
        w_idx = 1
        while w_start <= last_day:
            w_end = min(w_start + 6, last_day)
            w_days = [d for d in sec_timeline if w_start <= d['day'] <= w_end]
            if w_days:
                w_rev = sum(d['revenue'] for d in w_days)
                w_gp = sum(d['gross_profit'] for d in w_days)
                start_lbl = w_days[0]['label']
                end_lbl = w_days[-1]['label']
                sec_weeks.append({
                    'week_number': w_idx,
                    'label': f"Week {w_idx} ({start_lbl} - {end_lbl})",
                    'short_label': f"W{w_idx} ({start_lbl} - {end_lbl})",
                    'start_day': w_start,
                    'end_day': w_end,
                    'start_date': w_days[0]['date'],
                    'end_date': w_days[-1]['date'],
                    'revenue': round(w_rev, 2),
                    'gross_profit': round(w_gp, 2),
                    'profit': round(w_gp, 2),
                })
            w_start += 7
            w_idx += 1

        sections_list.append({
            'id': sec_data['id'],
            'name': sec_name,
            'code': sec_data.get('code', ''),
            'color': sec_data.get('color', '#3B82F6'),
            'revenue': round(sec_rev, 2),
            'gst_amount': float(round(sec_gst, 2)),
            'net_revenue': float(round(sec_net_rev, 2)),
            'cogs': round(sec_cogs, 2),
            'gross_profit': float(round(sec_gp, 2)),
            'margin_pct': round(sec_margin, 1),
            'units_sold': sec_data['units_sold'],
            'items_count': len(sec_items),
            'share_of_sales_pct': round(sec_share, 1),
            'share_of_sales': round(sec_share, 1),
            'items': sec_items,
            'timeline': sec_timeline,
            'weeks': sec_weeks,
            'monthly_profit_trend': [],
        })
    sections_list.sort(key=lambda x: x['revenue'], reverse=True)

    # Sync actuals with SectionMonthlyGoal for the active month/year if not locked
    try:
        from .models import SectionMonthlyGoal
        for sec_item_res in sections_list:
            sec_real_id = sec_item_res.get('id')
            if sec_real_id and sec_real_id > 0:
                goal_obj = SectionMonthlyGoal.objects.filter(
                    section_id=sec_real_id,
                    year=target_year,
                    month=target_month
                ).first()
                if goal_obj:
                    goal_obj.check_and_update_lock_status()
                    if not goal_obj.is_locked:
                        goal_obj.actual_revenue = Decimal(str(sec_item_res['revenue']))
                        goal_obj.actual_profit = Decimal(str(sec_item_res['gross_profit']))
                        goal_obj.save(update_fields=['actual_revenue', 'actual_profit'])
    except Exception:
        pass

    # 3. OPERATING EXPENSES
    if start_date and end_date:
        op_expenses_qs = OperatingExpense.objects.filter(
            expense_date__gte=month_start.date(),
            expense_date__lte=month_end.date()
        )
    else:
        op_expenses_qs = OperatingExpense.objects.filter(
            year=target_year,
            month=target_month
        )
    if target_store_ids is not None:
        op_expenses_qs = op_expenses_qs.filter(store_id__in=target_store_ids)

    # Separate salary operating expenses from general operating overheads
    salary_op_filter = (
        Q(category='salaries') |
        Q(voucher_number__startswith='EXP-PAYROLL-') |
        Q(reference_number__startswith='PR-') |
        Q(title__istartswith='Staff Payroll')
    )
    salary_op_qs = op_expenses_qs.filter(salary_op_filter)
    non_salary_op_qs = op_expenses_qs.exclude(salary_op_filter)

    total_payroll_op_expenses = salary_op_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    total_operating_expenses = non_salary_op_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    # Breakdown by expense category
    op_breakdown_map = {}
    for exp in non_salary_op_qs:
        c_id = exp.category
        c_display = exp.get_category_display()
        if c_id not in op_breakdown_map:
            op_breakdown_map[c_id] = {
                'id': c_id,
                'name': c_display,
                'total_amount': Decimal('0.00'),
                'count': 0
            }
        op_breakdown_map[c_id]['total_amount'] += exp.amount
        op_breakdown_map[c_id]['count'] += 1

    # 4. COUNTER REGISTER PAYOUTS (EXCLUDING CUSTOMER REFUNDS)
    # Exclude customer refunds (already subtracted from sales)
    all_counter_payouts_qs = CounterPayout.objects.filter(
        paid_at__gte=month_start,
        paid_at__lte=month_end
    ).exclude(category=CounterPayout.CATEGORY_REFUND)
    if target_store_ids is not None:
        all_counter_payouts_qs = all_counter_payouts_qs.filter(store_id__in=target_store_ids)

    non_salary_payouts_qs = all_counter_payouts_qs.exclude(category=CounterPayout.CATEGORY_STAFF_PAYOUT)
    total_counter_payouts = non_salary_payouts_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    # Aggregate non-salary counter payouts into category breakdown
    for cp in non_salary_payouts_qs:
        c_id = cp.category
        c_display = cp.get_category_display()
        if c_id not in op_breakdown_map:
            op_breakdown_map[c_id] = {
                'id': c_id,
                'name': c_display,
                'total_amount': Decimal('0.00'),
                'count': 0
            }
        op_breakdown_map[c_id]['total_amount'] += cp.amount
        op_breakdown_map[c_id]['count'] += 1

    # Staff salary payouts made via counter register
    # If a store has a finalized payroll OperatingExpense for this month, that payroll expense covers gross wages.
    # If a store has NO finalized payroll OperatingExpense, register staff payouts are cash wages disbursed.
    stores_with_payroll_exp = set(salary_op_qs.filter(store__isnull=False).values_list('store_id', flat=True))
    if salary_op_qs.filter(store__isnull=True).exists():
        stores_with_payroll_exp = {st.id for st in active_stores}

    staff_payouts_qs = all_counter_payouts_qs.filter(category=CounterPayout.CATEGORY_STAFF_PAYOUT)
    unfinalized_staff_payouts = staff_payouts_qs.exclude(store_id__in=stores_with_payroll_exp)
    total_unfinalized_staff_payouts = unfinalized_staff_payouts.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    total_salaries_expense = total_payroll_op_expenses + total_unfinalized_staff_payouts
    total_non_salary_expenses = total_operating_expenses + total_counter_payouts
    total_all_expenses = total_non_salary_expenses + total_salaries_expense

    if total_salaries_expense > Decimal('0.00'):
        salary_voucher_count = salary_op_qs.count() + unfinalized_staff_payouts.count()
        op_breakdown_map['salaries'] = {
            'id': 'salaries',
            'name': 'Staff Salaries & Payroll',
            'total_amount': total_salaries_expense,
            'count': salary_voucher_count,
        }

    operating_expenses_breakdown = []
    for c_id, val in op_breakdown_map.items():
        pct = float((val['total_amount'] / total_all_expenses) * 100) if total_all_expenses > Decimal('0.00') else 0.0
        operating_expenses_breakdown.append({
            'id': c_id,
            'name': val['name'],
            'amount': float(val['total_amount']),
            'count': val['count'],
            'percentage': round(pct, 1),
        })
    operating_expenses_breakdown.sort(key=lambda x: x['amount'], reverse=True)

    # ── Expired Inventory Loss (StockMovement reason='expired', at cost price) ──
    from inventory.models import StockMovement as _SM, BrokenItemReport as _BIR
    expired_movements_qs = _SM.objects.filter(
        reason=_SM.REASON_EXPIRED,
        created_at__gte=month_start,
        created_at__lte=month_end,
    )
    if target_store_ids is not None:
        expired_movements_qs = expired_movements_qs.filter(item__store_id__in=target_store_ids)
    # Each expired movement has a negative change; financial loss = abs(change) * cost_price
    total_inventory_loss_expired = Decimal('0.00')
    expired_items_count = 0
    expired_units_count = 0
    for em in expired_movements_qs.select_related('item'):
        units_lost = abs(em.change) if em.change else 0
        cost = em.item.cost_price if (em.item and em.item.cost_price) else Decimal('0.00')
        total_inventory_loss_expired += Decimal(units_lost) * cost
        if units_lost > 0:
            expired_items_count += 1
            expired_units_count += int(units_lost)
    total_inventory_loss_expired = total_inventory_loss_expired.quantize(Decimal('0.01'))

    # ── Broken / Damaged Inventory Loss (BrokenItemReport at cost price) ──
    broken_reports_qs = _BIR.objects.filter(
        created_at__gte=month_start,
        created_at__lte=month_end,
    )
    if target_store_ids is not None:
        broken_reports_qs = broken_reports_qs.filter(store_id__in=target_store_ids)

    total_inventory_loss_broken_gross = Decimal('0.00')
    total_inventory_loss_broken_fined = Decimal('0.00')
    broken_items_count = 0
    broken_units_count = 0

    broken_by_category = {}
    broken_by_section = {}
    broken_by_supplier = {}
    broken_reports_list = []

    for br in broken_reports_qs.select_related(
        'item', 'store', 'section', 'reported_by', 'fined_employee',
        'item__supplier', 'item__primary_subcategory', 'item__primary_subcategory__category'
    ):
        loss = br.total_loss or Decimal('0.00')
        units = br.quantity or 0
        fine = (br.fine_amount if br.fine_amount is not None else loss) if br.is_fined else Decimal('0.00')
        total_inventory_loss_broken_gross += loss
        total_inventory_loss_broken_fined += fine
        broken_items_count += 1
        broken_units_count += units

        # Category mapping
        cat_name = "Uncategorized"
        if br.item:
            eff_cat = getattr(br.item, 'effective_primary_category', None)
            if eff_cat:
                cat_name = eff_cat.name
            else:
                first_sub = br.item.subcategories.select_related('category').first()
                if first_sub and first_sub.category:
                    cat_name = first_sub.category.name

        if cat_name not in broken_by_category:
            broken_by_category[cat_name] = {'name': cat_name, 'loss': Decimal('0.00'), 'units': 0, 'items': []}
        broken_by_category[cat_name]['loss'] += loss
        broken_by_category[cat_name]['units'] += units
        broken_by_category[cat_name]['items'].append({
            'id': br.id,
            'item_name': br.item.name if br.item else 'Unknown',
            'item_uid': br.item.uid if br.item else '',
            'units': units,
            'loss': float(loss),
            'reason': br.reason,
            'proof_image': br.proof_image.url if br.proof_image else None,
            'created_at': br.created_at.isoformat(),
        })

        # Section mapping
        sec_name = br.section.name if br.section else (br.item.section.name if (br.item and br.item.section) else 'Unassigned')
        if sec_name not in broken_by_section:
            broken_by_section[sec_name] = {'name': sec_name, 'loss': Decimal('0.00'), 'units': 0, 'items': []}
        broken_by_section[sec_name]['loss'] += loss
        broken_by_section[sec_name]['units'] += units
        broken_by_section[sec_name]['items'].append({
            'id': br.id,
            'item_name': br.item.name if br.item else 'Unknown',
            'item_uid': br.item.uid if br.item else '',
            'units': units,
            'loss': float(loss),
            'reason': br.reason,
            'proof_image': br.proof_image.url if br.proof_image else None,
            'created_at': br.created_at.isoformat(),
        })

        # Supplier mapping
        sup_name = br.item.supplier.name if (br.item and br.item.supplier) else 'Direct / Unknown'
        if sup_name not in broken_by_supplier:
            broken_by_supplier[sup_name] = {'name': sup_name, 'loss': Decimal('0.00'), 'units': 0, 'items': []}
        broken_by_supplier[sup_name]['loss'] += loss
        broken_by_supplier[sup_name]['units'] += units
        broken_by_supplier[sup_name]['items'].append({
            'id': br.id,
            'item_name': br.item.name if br.item else 'Unknown',
            'item_uid': br.item.uid if br.item else '',
            'units': units,
            'loss': float(loss),
            'reason': br.reason,
            'proof_image': br.proof_image.url if br.proof_image else None,
            'created_at': br.created_at.isoformat(),
        })

        broken_reports_list.append({
            'id': br.id,
            'item_id': br.item_id,
            'item_name': br.item.name if br.item else 'Unknown',
            'item_uid': br.item.uid if br.item else '',
            'category_name': cat_name,
            'section_name': sec_name,
            'supplier_name': sup_name,
            'store_name': br.store.name if br.store else '',
            'quantity': units,
            'cost_price': float(br.cost_price),
            'total_loss': float(loss),
            'reason': br.reason,
            'proof_image': br.proof_image.url if br.proof_image else None,
            'reported_by_name': br.reported_by_name or (br.reported_by.name if br.reported_by else 'Staff'),
            'is_fined': bool(br.is_fined),
            'fined_employee_id': br.fined_employee_id,
            'fined_employee_name': br.fined_employee.name if br.fined_employee else None,
            'fine_amount': float(br.fine_amount) if br.fine_amount is not None else 0.0,
            'fined_at': br.fined_at.isoformat() if br.fined_at else None,
            'is_waived': bool(br.is_waived),
            'waived_at': br.waived_at.isoformat() if br.waived_at else None,
            'waived_by': br.waived_by or '',
            'created_at': br.created_at.isoformat(),
        })

    total_inventory_loss_broken_gross = total_inventory_loss_broken_gross.quantize(Decimal('0.01'))
    total_inventory_loss_broken_fined = total_inventory_loss_broken_fined.quantize(Decimal('0.01'))
    # Net operational loss absorbed by the store (fines collected from staff offset the loss)
    total_inventory_loss_broken = max(Decimal('0.00'), total_inventory_loss_broken_gross - total_inventory_loss_broken_fined).quantize(Decimal('0.01'))

    # 5. DUAL PROFIT CALCULATIONS (WITHOUT STAKEHOLDERS VS WITH STAKEHOLDERS)
    # Store Net Operating Profit (WITHOUT Stakeholders)
    # Accurately reflect true operational loss (can be negative!)
    total_salaries_disbursed = total_salaries_expense
    total_salaries_committed = total_salaries_expense
    effective_salary_expense = total_salaries_expense
    store_operating_net_profit = (
        gross_profit - total_all_expenses - total_inventory_loss_expired - total_inventory_loss_broken
    ).quantize(Decimal('0.01'))
    store_operating_net_profit_margin_pct = (
        float((store_operating_net_profit / net_revenue_after_gst) * 100)
        if net_revenue_after_gst > Decimal('0.00')
        else 0.0
    )

    # Per-Store Financial Metrics Map (for accurate multi-store attribution and store-scoped stakeholder profit shares)
    store_profit_map = {}
    for st in active_stores:
        st_s = [s for s in sales_qs if s.store_id == st.id]
        st_r = [r for r in returns_qs if r.store_id == st.id]
        st_gross = sum((s.total_amount for s in st_s), Decimal('0.00'))
        st_ref = sum((r.total_amount for r in st_r), Decimal('0.00'))
        st_net = max(Decimal('0.00'), st_gross - st_ref)
        st_orders = len(st_s)
        st_cogs = store_cogs_map.get(st.id, Decimal('0.00'))

        st_upi_s = sum((s.total_amount if (s.payment_method or '').lower() == 'upi' else (s.split_upi_amount or Decimal('0.00')) for s in st_s), Decimal('0.00'))
        st_upi_r = sum((r.total_amount if (r.payment_method or '').lower() == 'upi' else (r.split_upi_amount or Decimal('0.00')) for r in st_r), Decimal('0.00'))
        st_net_upi = max(Decimal('0.00'), st_upi_s - st_upi_r)

        if not getattr(st, 'enable_gst', True):
            st_gst_amt = Decimal('0.00')
        elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
            st_gst_amt = (st_net_upi * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
        else:
            st_gst_amt = (st_net * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))

        st_rev_after_gst = max(Decimal('0.00'), st_net - st_gst_amt)
        st_gp = (st_rev_after_gst - st_cogs) if st_cogs > 0 else st_rev_after_gst

        st_non_sal_op = non_salary_op_qs.filter(store_id=st.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        st_non_sal_cp = non_salary_payouts_qs.filter(store_id=st.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        st_sal_op = salary_op_qs.filter(store_id=st.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        if st.id not in stores_with_payroll_exp:
            st_sal_cp = staff_payouts_qs.filter(store_id=st.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        else:
            st_sal_cp = Decimal('0.00')
        st_total_exp = st_non_sal_op + st_non_sal_cp + st_sal_op + st_sal_cp

        st_expired_items = expired_movements_qs.filter(item__store_id=st.id).select_related('item')
        st_exp_loss = sum((abs(em.change) * (em.item.cost_price if (em.item and em.item.cost_price) else Decimal('0.00')) for em in st_expired_items), Decimal('0.00'))
        st_broken_items = broken_reports_qs.filter(store_id=st.id)
        st_broken_gross = sum((r.total_loss for r in st_broken_items), Decimal('0.00'))
        st_broken_fined = sum(((r.fine_amount if r.fine_amount is not None else r.total_loss) for r in st_broken_items if r.is_fined), Decimal('0.00'))
        st_broken_loss = max(Decimal('0.00'), st_broken_gross - st_broken_fined)

        st_net_profit = (st_gp - st_total_exp - st_exp_loss - st_broken_loss).quantize(Decimal('0.01'))
        st_margin = float((st_net_profit / st_rev_after_gst) * 100) if st_rev_after_gst > Decimal('0.00') else 0.0
        st_share_pct = round(float((st_net / total_revenue) * 100), 1) if total_revenue > Decimal('0.00') else 0.0

        store_profit_map[st.id] = {
            'id': st.id,
            'name': st.name,
            'code': getattr(st, 'code', '') or st.name,
            'gross_revenue': float(st_gross),
            'returns_amount': float(st_ref),
            'revenue': float(st_net),
            'orders_count': st_orders,
            'gst_amount': float(st_gst_amt),
            'net_revenue_after_gst': float(st_rev_after_gst),
            'cogs': float(st_cogs),
            'gross_profit': float(st_gp),
            'operating_expenses': float(st_total_exp),
            'salaries': float(st_sal_op + st_sal_cp),
            'expired_loss': float(st_exp_loss),
            'broken_loss': float(st_broken_loss),
            'total_inventory_loss_broken': float(st_broken_loss),
            'net_profit': float(st_net_profit),
            'operating_profit': st_net_profit,
            'net_margin_pct': round(st_margin, 1),
            'share_of_sales_pct': st_share_pct,
        }

    # Stakeholders Profit Pool & Contractual Allocations
    if not enable_stakeholders:
        sh_qs = Stakeholder.objects.none()
        total_stakeholder_percentage = Decimal('0.00')
        stakeholder_contractual_share_allocated = Decimal('0.00')
        total_stakeholder_payouts_disbursed = Decimal('0.00')
        stakeholder_breakdown = []
        final_retained_net_profit = store_operating_net_profit
        final_retained_net_profit_margin_pct = store_operating_net_profit_margin_pct
    else:
        sh_qs = Stakeholder.objects.filter(status='active')
        if target_store_ids is not None:
            sh_qs = sh_qs.filter(Q(store_id__in=target_store_ids) | Q(store__isnull=True))

        # Actual cash payouts disbursed to stakeholders in this month
        sh_payouts_qs = StakeholderPayout.objects.filter(
            payout_date__gte=month_start.date(),
            payout_date__lte=month_end.date()
        )
        if target_store_ids is not None:
            sh_payouts_qs = sh_payouts_qs.filter(stakeholder__in=sh_qs)

        total_stakeholder_payouts_disbursed = sh_payouts_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Partner breakdown list with store-scoped contractual entitlements
        stakeholder_breakdown = []
        total_allocated = Decimal('0.00')
        for sh in sh_qs:
            if not is_combined and len(active_stores) == 1:
                base_profit = store_operating_net_profit
            elif sh.store_id and sh.store_id in store_profit_map:
                base_profit = store_profit_map[sh.store_id]['operating_profit']
            else:
                base_profit = store_operating_net_profit

            # Only allocate positive profit share; partners do not draw positive payouts from operating losses
            if base_profit > Decimal('0.00'):
                sh_share_amt = (base_profit * sh.profit_percentage) / Decimal('100.00')
            else:
                sh_share_amt = Decimal('0.00')
            total_allocated += sh_share_amt
            sh_disbursed = sh_payouts_qs.filter(stakeholder=sh).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
            stakeholder_breakdown.append({
                'id': sh.id,
                'name': sh.name,
                'store_id': sh.store_id,
                'store_name': sh.store.name if sh.store else 'All Stores / Global',
                'profit_percentage': float(sh.profit_percentage),
                'contractual_share_amount': float(round(sh_share_amt, 2)),
                'payouts_disbursed_this_month': float(sh_disbursed),
                'status': sh.status,
            })
        stakeholder_breakdown.sort(key=lambda x: x['contractual_share_amount'], reverse=True)

        stakeholder_contractual_share_allocated = total_allocated
        if not is_combined and len(active_stores) == 1:
            total_stakeholder_percentage = sh_qs.aggregate(total=Sum('profit_percentage'))['total'] or Decimal('0.00')
        else:
            total_stakeholder_percentage = (
                (stakeholder_contractual_share_allocated / store_operating_net_profit * Decimal('100.00'))
                if store_operating_net_profit > Decimal('0.00') else Decimal('0.00')
            )

        # Final Retained Store Net Profit (WITH Stakeholders deducted)
        if store_operating_net_profit > Decimal('0.00'):
            final_retained_net_profit = store_operating_net_profit - stakeholder_contractual_share_allocated
        else:
            final_retained_net_profit = store_operating_net_profit
        final_retained_net_profit_margin_pct = float((final_retained_net_profit / net_revenue_after_gst) * 100) if net_revenue_after_gst > Decimal('0.00') else 0.0

    # 7. DAILY TIMELINE (1 to last_day)
    # Aggregate daily sales net of returns and per-store metrics
    daily_sales = {}
    daily_gross_sales = {}
    daily_returns_amount = {}
    daily_orders_count = {}
    daily_returns_count = {}
    daily_upi = {}
    daily_sales_by_st = {st.id: {d: Decimal('0.00') for d in range(1, last_day + 1)} for st in active_stores}
    daily_returns_by_st = {st.id: {d: Decimal('0.00') for d in range(1, last_day + 1)} for st in active_stores}
    daily_upi_s_by_st = {st.id: {d: Decimal('0.00') for d in range(1, last_day + 1)} for st in active_stores}
    daily_upi_r_by_st = {st.id: {d: Decimal('0.00') for d in range(1, last_day + 1)} for st in active_stores}

    for ord_obj in sales_qs:
        d = (ord_obj.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_sales[d] = daily_sales.get(d, Decimal('0.00')) + ord_obj.total_amount
            daily_gross_sales[d] = daily_gross_sales.get(d, Decimal('0.00')) + ord_obj.total_amount
            daily_orders_count[d] = daily_orders_count.get(d, 0) + 1
            if ord_obj.store_id in daily_sales_by_st and d in daily_sales_by_st[ord_obj.store_id]:
                daily_sales_by_st[ord_obj.store_id][d] += ord_obj.total_amount
            pm = (ord_obj.payment_method or '').lower()
            if pm == 'upi':
                daily_upi[d] = daily_upi.get(d, Decimal('0.00')) + ord_obj.total_amount
                if ord_obj.store_id in daily_upi_s_by_st and d in daily_upi_s_by_st[ord_obj.store_id]:
                    daily_upi_s_by_st[ord_obj.store_id][d] += ord_obj.total_amount
            elif pm == 'split':
                u_amt = (ord_obj.split_upi_amount or Decimal('0.00'))
                daily_upi[d] = daily_upi.get(d, Decimal('0.00')) + u_amt
                if ord_obj.store_id in daily_upi_s_by_st and d in daily_upi_s_by_st[ord_obj.store_id]:
                    daily_upi_s_by_st[ord_obj.store_id][d] += u_amt

    for ret_obj in returns_qs:
        d = (ret_obj.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_sales[d] = daily_sales.get(d, Decimal('0.00')) - ret_obj.total_amount
            daily_returns_amount[d] = daily_returns_amount.get(d, Decimal('0.00')) + ret_obj.total_amount
            daily_returns_count[d] = daily_returns_count.get(d, 0) + 1
            if ret_obj.store_id in daily_returns_by_st and d in daily_returns_by_st[ret_obj.store_id]:
                daily_returns_by_st[ret_obj.store_id][d] += ret_obj.total_amount
            pm = (ret_obj.payment_method or '').lower()
            if pm == 'upi':
                daily_upi[d] = daily_upi.get(d, Decimal('0.00')) - ret_obj.total_amount
                if ret_obj.store_id in daily_upi_r_by_st and d in daily_upi_r_by_st[ret_obj.store_id]:
                    daily_upi_r_by_st[ret_obj.store_id][d] += ret_obj.total_amount
            elif pm == 'split':
                u_amt = (ret_obj.split_upi_amount or Decimal('0.00'))
                daily_upi[d] = daily_upi.get(d, Decimal('0.00')) - u_amt
                if ret_obj.store_id in daily_upi_r_by_st and d in daily_upi_r_by_st[ret_obj.store_id]:
                    daily_upi_r_by_st[ret_obj.store_id][d] += u_amt

    # Ensure daily sales and daily cogs are not negative
    for d in range(1, last_day + 1):
        if d in daily_sales and daily_sales[d] < Decimal('0.00'):
            daily_sales[d] = Decimal('0.00')
        if d in daily_upi and daily_upi[d] < Decimal('0.00'):
            daily_upi[d] = Decimal('0.00')
        if d in daily_cogs and daily_cogs[d] < Decimal('0.00'):
            daily_cogs[d] = Decimal('0.00')

    # Aggregate daily non-salary operating expenses and payouts
    daily_expenses = {}
    for exp_obj in non_salary_op_qs:
        d = (exp_obj.expense_date - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_expenses[d] = daily_expenses.get(d, Decimal('0.00')) + exp_obj.amount

    for cp in non_salary_payouts_qs:
        d = (cp.paid_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_expenses[d] = daily_expenses.get(d, Decimal('0.00')) + cp.amount

    # Aggregate daily salaries (payroll vouchers + counter staff payouts)
    daily_salaries = {}
    for exp_obj in salary_op_qs:
        d = (exp_obj.expense_date - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_salaries[d] = daily_salaries.get(d, Decimal('0.00')) + exp_obj.amount

    for sp in unfinalized_staff_payouts:
        d = (sp.paid_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            daily_salaries[d] = daily_salaries.get(d, Decimal('0.00')) + sp.amount

    # Aggregate daily expired inventory losses
    daily_expired = {}
    for em in expired_movements_qs.select_related('item'):
        d = (em.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            u_lost = abs(em.change) if em.change else 0
            u_cost = em.item.cost_price if (em.item and em.item.cost_price) else Decimal('0.00')
            daily_expired[d] = daily_expired.get(d, Decimal('0.00')) + (Decimal(u_lost) * u_cost)

    # Aggregate daily broken inventory losses
    daily_broken = {}
    for br in broken_reports_qs:
        d = (br.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            b_loss = br.total_loss or Decimal('0.00')
            b_fine = (br.fine_amount if br.fine_amount is not None else b_loss) if br.is_fined else Decimal('0.00')
            b_net = max(Decimal('0.00'), b_loss - b_fine)
            daily_broken[d] = daily_broken.get(d, Decimal('0.00')) + b_net

    timeline = []
    effective_sh_share_rate = (
        (stakeholder_contractual_share_allocated / store_operating_net_profit)
        if store_operating_net_profit > Decimal('0.00') else Decimal('0.00')
    )

    if month_end.date() >= earliest_record_date:
        for day in range(1, last_day + 1):
            cur_date = month_start.date() + timedelta(days=day - 1)
            day_date = cur_date.strftime('%Y-%m-%d')
            d_rev = daily_sales.get(day, Decimal('0.00'))
            d_gross_s = daily_gross_sales.get(day, Decimal('0.00'))
            d_orders = daily_orders_count.get(day, 0)
            d_returns_cnt = daily_returns_count.get(day, 0)
            d_net_orders = max(0, d_orders - d_returns_cnt)
            d_ret_amt = daily_returns_amount.get(day, Decimal('0.00'))
            d_upi_val = daily_upi.get(day, Decimal('0.00'))

            if not is_combined and len(active_stores) == 1:
                st = active_stores[0]
                if not getattr(st, 'enable_gst', True):
                    d_gst = Decimal('0.00')
                elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
                    d_gst = (d_upi_val * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
                else:
                    d_gst = (d_rev * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
            else:
                d_gst = Decimal('0.00')
                for st in active_stores:
                    st_g = daily_sales_by_st.get(st.id, {}).get(day, Decimal('0.00'))
                    st_r = daily_returns_by_st.get(st.id, {}).get(day, Decimal('0.00'))
                    st_n = max(Decimal('0.00'), st_g - st_r)
                    st_us = daily_upi_s_by_st.get(st.id, {}).get(day, Decimal('0.00'))
                    st_ur = daily_upi_r_by_st.get(st.id, {}).get(day, Decimal('0.00'))
                    st_nu = max(Decimal('0.00'), st_us - st_ur)
                    if not getattr(st, 'enable_gst', True):
                        st_day_gst = Decimal('0.00')
                    elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
                        st_day_gst = (st_nu * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
                    else:
                        st_day_gst = (st_n * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
                    d_gst += st_day_gst

            d_net_rev = max(Decimal('0.00'), d_rev - d_gst)
            d_cogs = daily_cogs.get(day, Decimal('0.00'))
            d_gp = (d_net_rev - d_cogs) if d_cogs > 0 else d_net_rev
            d_exp = daily_expenses.get(day, Decimal('0.00'))
            d_sal = daily_salaries.get(day, Decimal('0.00'))
            d_exp_loss = daily_expired.get(day, Decimal('0.00'))
            d_broken_loss = daily_broken.get(day, Decimal('0.00'))
            d_total_costs = d_exp + d_sal + d_exp_loss + d_broken_loss
            d_outflows = d_cogs + d_total_costs + d_gst
            d_op_profit = (d_gp - d_total_costs).quantize(Decimal('0.01'))
            d_sh_share = (d_op_profit * effective_sh_share_rate) if d_op_profit > Decimal('0.00') else Decimal('0.00')
            d_ret_profit = d_op_profit - d_sh_share

            d_avg_sale = float(round((d_net_rev / d_orders), 2)) if d_orders > 0 else 0.0
            d_gross_avg_sale = float(round((d_gross_s / d_orders), 2)) if d_orders > 0 else 0.0

            timeline.append({
                'day': day,
                'date': day_date,
                'label': f"{calendar.month_abbr[cur_date.month]} {cur_date.day}",
                'orders_count': d_orders,
                'returns_count': d_returns_cnt,
                'net_sales_count': d_net_orders,
                'returns_amount': float(d_ret_amt),
                'avg_sale_rupees': d_avg_sale,
                'average_order_value': d_avg_sale,
                'gross_avg_sale_rupees': d_gross_avg_sale,
                'revenue': float(d_net_rev),
                'gross_sales': float(d_gross_s if d_gross_s > 0 else d_rev),
                'gross_revenue': float(d_gross_s if d_gross_s > 0 else d_rev),
                'gst_amount': float(d_gst),
                'net_revenue': float(d_net_rev),
                'net_revenue_after_gst': float(d_net_rev),
                'cogs': float(d_cogs),
                'gross_profit': float(d_gp),
                'gross_margin': float(d_gp),
                'expenses': float(d_exp),
                'salaries': float(d_sal),
                'expired_loss': float(d_exp_loss),
                'total_inventory_loss_expired': float(d_exp_loss),
                'broken_loss': float(d_broken_loss),
                'total_inventory_loss_broken': float(d_broken_loss),
                'total_outflows': float(d_outflows),
                'operating_profit': float(round(d_op_profit, 2)),
                'stakeholder_share': float(round(d_sh_share, 2)),
                'retained_profit': float(round(d_ret_profit, 2)),
            })

    # 8. PAYMENT METHOD INFLOW & OUTFLOW (NET OF REFUNDS)
    inflow_methods = {}
    for ord_obj in sales_qs:
        pm = (ord_obj.payment_method or 'other').lower()
        if pm == 'split':
            c_part = ord_obj.split_cash_amount or Decimal('0.00')
            u_part = ord_obj.split_upi_amount or Decimal('0.00')
            if c_part + u_part > Decimal('0.00'):
                inflow_methods['cash'] = inflow_methods.get('cash', Decimal('0.00')) + c_part
                inflow_methods['upi'] = inflow_methods.get('upi', Decimal('0.00')) + u_part
            else:
                inflow_methods['split'] = inflow_methods.get('split', Decimal('0.00')) + ord_obj.total_amount
        else:
            inflow_methods[pm] = inflow_methods.get(pm, Decimal('0.00')) + ord_obj.total_amount

    for ret_obj in returns_qs:
        pm = (ret_obj.payment_method or 'other').lower()
        if pm in inflow_methods:
            inflow_methods[pm] = max(Decimal('0.00'), inflow_methods[pm] - ret_obj.total_amount)

    inflow_list = [
        {'method': k, 'amount': float(v), 'percentage': round(float((v / total_revenue) * 100), 1) if total_revenue > 0 else 0.0}
        for k, v in inflow_methods.items()
    ]
    inflow_list.sort(key=lambda x: x['amount'], reverse=True)

    # 9. COMPREHENSIVE WATERFALL
    waterfall = [
        {
            'step': 'Gross Customer Sales',
            'amount': float(gross_revenue),
            'type': 'inflow',
            'description': f'{total_orders_count} retail orders placed'
        },
    ]
    if total_refunds > Decimal('0.00'):
        waterfall.append({
            'step': 'Sales Returns & Customer Refunds',
            'amount': -float(total_refunds),
            'type': 'outflow',
            'description': f'{returns_qs.count()} return vouchers issued'
        })
    if gst_amount > Decimal('0.00'):
        if is_combined and len(active_stores) > 1:
            step_gst = 'GST Output Tax Liability (Combined Branches)'
            desc_gst = f'Aggregate GST output tax liability across {len(active_stores)} branch locations (Taxable Base: ₹{float(taxable_base):,.2f})'
        elif gst_mode == 'all':
            step_gst = f'GST Output Tax Liability ({gst_rate}%)'
            desc_gst = f'{gst_rate}% GST on all product revenue (Taxable Base: ₹{float(taxable_base):,.2f})'
        else:
            step_gst = f'GST Output Tax Liability ({gst_rate}%)'
            desc_gst = f'{gst_rate}% GST on UPI payment inflows only (Taxable Base: ₹{float(taxable_base):,.2f})'

        waterfall.append({
            'step': step_gst,
            'amount': -float(gst_amount),
            'type': 'outflow_tax',
            'description': desc_gst
        })
        waterfall.append({
            'step': 'Net Sales Revenue (Ex-GST)',
            'amount': float(net_revenue_after_gst),
            'type': 'subtotal_net_rev',
            'description': 'Customer revenue retained by store after GST tax deduction'
        })

    waterfall.extend([
        {
            'step': 'Cost of Goods Sold (COGS)',
            'amount': float(total_cogs),
            'type': 'outflow',
            'description': f'Net inventory cost across {total_units_sold} sold items'
        },
        {
            'step': 'Gross Profit Margin',
            'amount': float(gross_profit),
            'type': 'subtotal',
            'description': f'{round(gross_margin_pct, 1)}% gross sales margin on net revenue'
        },
        {
            'step': 'Store Operating Overheads',
            'amount': float(total_non_salary_expenses),
            'type': 'outflow',
            'description': f'{non_salary_op_qs.count() + non_salary_payouts_qs.count()} expense vouchers & counter payouts'
        },
    ])
    if total_salaries_expense > Decimal('0.00'):
        waterfall.append({
            'step': 'Staff Salaries & Wage Payouts',
            'amount': float(total_salaries_expense),
            'type': 'outflow_salaries',
            'description': f'Staff payroll accruals and counter wage disbursements'
        })
    if total_inventory_loss_expired > Decimal('0.00'):
        waterfall.append({
            'step': 'Expired Inventory Write-Off Loss',
            'amount': float(total_inventory_loss_expired),
            'type': 'outflow_loss',
            'description': (
                f'{expired_items_count} expired product(s), {expired_units_count} unit(s) '
                f'written off at cost price'
            )
        })
    if total_inventory_loss_broken > Decimal('0.00'):
        waterfall.append({
            'step': 'Broken & Damaged Inventory Write-off',
            'amount': float(total_inventory_loss_broken),
            'type': 'outflow_loss_broken',
            'description': (
                f'{broken_items_count} broken product write-off(s), {broken_units_count} unit(s) '
                f'written off at cost price'
            )
        })
    if enable_stakeholders:
        waterfall.extend([
            {
                'step': 'Store Net Operating Profit' if store_operating_net_profit >= Decimal('0.00') else 'Store Net Operating Loss',
                'amount': float(store_operating_net_profit),
                'type': 'highlight_pre' if store_operating_net_profit >= Decimal('0.00') else 'highlight_pre_loss',
                'description': 'Store profit before stakeholder contractual deductions' if store_operating_net_profit >= Decimal('0.00') else 'Store operating deficit before partner pool'
            },
            {
                'step': 'Stakeholder Profit Share Allocation',
                'amount': float(stakeholder_contractual_share_allocated),
                'type': 'outflow_stakeholder',
                'description': f'{round(float(total_stakeholder_percentage), 1)}% contractual share across {sh_qs.count()} active partners' if store_operating_net_profit > Decimal('0.00') else 'No stakeholder profit share allocated during operating loss'
            },
            {
                'step': 'Final Retained Store Profit' if final_retained_net_profit >= Decimal('0.00') else 'Final Retained Store Loss',
                'amount': float(final_retained_net_profit),
                'type': 'final_profit' if final_retained_net_profit >= Decimal('0.00') else 'final_loss',
                'description': 'Net retained business earnings after full stakeholder allocation' if final_retained_net_profit >= Decimal('0.00') else 'Net retained business deficit after operational expenses'
            }
        ])
    else:
        waterfall.append({
            'step': 'Store Net Operating Profit' if store_operating_net_profit >= Decimal('0.00') else 'Store Net Operating Loss',
            'amount': float(store_operating_net_profit),
            'type': 'final_profit' if store_operating_net_profit >= Decimal('0.00') else 'final_loss',
            'description': 'Final net operating business earnings after all operating expenses' if store_operating_net_profit >= Decimal('0.00') else 'Final net operating business deficit after all expenses and write-offs'
        })

    # 10. YEARLY MONTHLY PROFIT & REVENUE TREND (MONTHS 1..12)
    # Allows plotting dual-line curves: Total Operating Profit vs Retained Profit
    year_start = datetime(target_year, 1, 1, 0, 0, 0, tzinfo=cur_tz)
    year_end = datetime(target_year, 12, 31, 23, 59, 59, 999999, tzinfo=cur_tz)

    # Orders for the entire year net of returns (anchored to earliest record date)
    year_base_orders = SaleOrder.objects.filter(
        created_at__gte=year_start,
        created_at__lte=year_end,
        created_at__date__gte=earliest_record_date,
    ).exclude(status='cancelled')
    if target_store_ids is not None:
        year_base_orders = year_base_orders.filter(store_id__in=target_store_ids)

    year_sales_qs = year_base_orders.exclude(invoice_number__startswith='RET-')
    year_returns_qs = year_base_orders.filter(invoice_number__startswith='RET-')

    # Aggregate monthly gross sales, returns, UPI and Cash breakdown
    year_gross_sales_map = {m: Decimal('0.00') for m in range(1, 13)}
    year_returns_map = {m: Decimal('0.00') for m in range(1, 13)}
    year_orders_count_map = {m: 0 for m in range(1, 13)}
    year_returns_count_map = {m: 0 for m in range(1, 13)}
    year_upi_sales_map = {m: Decimal('0.00') for m in range(1, 13)}
    year_upi_returns_map = {m: Decimal('0.00') for m in range(1, 13)}
    year_gross_by_st = {st.id: {m: Decimal('0.00') for m in range(1, 13)} for st in active_stores}
    year_ret_by_st = {st.id: {m: Decimal('0.00') for m in range(1, 13)} for st in active_stores}
    year_upi_s_by_st = {st.id: {m: Decimal('0.00') for m in range(1, 13)} for st in active_stores}
    year_upi_r_by_st = {st.id: {m: Decimal('0.00') for m in range(1, 13)} for st in active_stores}

    for ord_obj in year_sales_qs:
        m = ord_obj.created_at.month
        year_gross_sales_map[m] += ord_obj.total_amount
        year_orders_count_map[m] += 1
        if ord_obj.store_id in year_gross_by_st:
            year_gross_by_st[ord_obj.store_id][m] += ord_obj.total_amount
        pm = (ord_obj.payment_method or '').lower()
        if pm == 'split':
            val = (ord_obj.split_upi_amount or Decimal('0.00'))
            year_upi_sales_map[m] += val
            if ord_obj.store_id in year_upi_s_by_st:
                year_upi_s_by_st[ord_obj.store_id][m] += val
        elif pm == 'upi':
            year_upi_sales_map[m] += ord_obj.total_amount
            if ord_obj.store_id in year_upi_s_by_st:
                year_upi_s_by_st[ord_obj.store_id][m] += ord_obj.total_amount

    for ret_obj in year_returns_qs:
        m = ret_obj.created_at.month
        year_returns_map[m] += ret_obj.total_amount
        year_returns_count_map[m] += 1
        if ret_obj.store_id in year_ret_by_st:
            year_ret_by_st[ret_obj.store_id][m] += ret_obj.total_amount
        pm = (ret_obj.payment_method or '').lower()
        if pm == 'split':
            val = (ret_obj.split_upi_amount or Decimal('0.00'))
            year_upi_returns_map[m] += val
            if ret_obj.store_id in year_upi_r_by_st:
                year_upi_r_by_st[ret_obj.store_id][m] += val
        elif pm == 'upi':
            year_upi_returns_map[m] += ret_obj.total_amount
            if ret_obj.store_id in year_upi_r_by_st:
                year_upi_r_by_st[ret_obj.store_id][m] += ret_obj.total_amount

    # Aggregate monthly order COGS and Section breakdown net of returned items
    year_cogs_map = {m: Decimal('0.00') for m in range(1, 13)}
    year_sec_rev_map = {}
    year_sec_cogs_map = {}
    year_sales_items_qs = SaleOrderItem.objects.filter(sale_order__in=year_sales_qs).select_related('sale_order', 'item')
    for it in year_sales_items_qs:
        m = it.sale_order.created_at.month
        if it.unit_cost_price and it.unit_cost_price > Decimal('0.00'):
            year_cogs_map[m] += (it.unit_cost_price * it.quantity)
        sec_obj = it.item.section if (it.item and it.item.section) else None
        sec_id = sec_obj.id if sec_obj else 0
        if sec_id not in year_sec_rev_map:
            year_sec_rev_map[sec_id] = {mo: Decimal('0.00') for mo in range(1, 13)}
            year_sec_cogs_map[sec_id] = {mo: Decimal('0.00') for mo in range(1, 13)}
        year_sec_rev_map[sec_id][m] += it.total_price
        c = (it.unit_cost_price or Decimal('0.00')) * it.quantity
        year_sec_cogs_map[sec_id][m] += c

    year_returns_items_qs = SaleOrderItem.objects.filter(sale_order__in=year_returns_qs).select_related('sale_order', 'item')
    for it in year_returns_items_qs:
        m = it.sale_order.created_at.month
        if it.unit_cost_price and it.unit_cost_price > Decimal('0.00'):
            year_cogs_map[m] -= (it.unit_cost_price * it.quantity)
        sec_obj = it.item.section if (it.item and it.item.section) else None
        sec_id = sec_obj.id if sec_obj else 0
        if sec_id in year_sec_rev_map:
            year_sec_rev_map[sec_id][m] = max(Decimal('0.00'), year_sec_rev_map[sec_id][m] - it.total_price)
            c = (it.unit_cost_price or Decimal('0.00')) * it.quantity
            year_sec_cogs_map[sec_id][m] = max(Decimal('0.00'), year_sec_cogs_map[sec_id][m] - c)
    for m in range(1, 13):
        year_cogs_map[m] = max(Decimal('0.00'), year_cogs_map[m])

    # Operating expenses for the entire year
    year_op_exp_qs = OperatingExpense.objects.filter(year=target_year, expense_date__gte=earliest_record_date)
    if target_store_ids is not None:
        year_op_exp_qs = year_op_exp_qs.filter(store_id__in=target_store_ids)

    year_salary_op_qs = year_op_exp_qs.filter(salary_op_filter)
    year_non_salary_op_qs = year_op_exp_qs.exclude(salary_op_filter)

    year_op_map = {m: Decimal('0.00') for m in range(1, 13)}
    for exp in year_non_salary_op_qs:
        year_op_map[exp.month] += exp.amount

    year_salary_map = {m: Decimal('0.00') for m in range(1, 13)}
    for exp in year_salary_op_qs:
        year_salary_map[exp.month] += exp.amount

    # Counter payouts for the entire year (excluding customer refunds)
    year_payouts_qs = CounterPayout.objects.filter(
        paid_at__gte=year_start,
        paid_at__lte=year_end,
        paid_at__date__gte=earliest_record_date
    ).exclude(category=CounterPayout.CATEGORY_REFUND)
    if target_store_ids is not None:
        year_payouts_qs = year_payouts_qs.filter(store_id__in=target_store_ids)

    year_payouts_map = {m: Decimal('0.00') for m in range(1, 13)}
    for p in year_payouts_qs:
        m = p.paid_at.astimezone(cur_tz).month
        if p.category == CounterPayout.CATEGORY_STAFF_PAYOUT:
            if not year_salary_op_qs.filter(month=m, store_id=p.store_id).exists():
                year_salary_map[m] += p.amount
        else:
            year_payouts_map[m] += p.amount

    # Expired inventory losses for the entire year
    year_expired_qs = _SM.objects.filter(
        reason=_SM.REASON_EXPIRED,
        created_at__gte=year_start,
        created_at__lte=year_end,
    )
    if target_store_ids is not None:
        year_expired_qs = year_expired_qs.filter(item__store_id__in=target_store_ids)
    year_expired_map = {m: Decimal('0.00') for m in range(1, 13)}
    for em in year_expired_qs.select_related('item'):
        m = em.created_at.astimezone(cur_tz).month
        u_lost = abs(em.change) if em.change else 0
        u_cost = em.item.cost_price if (em.item and em.item.cost_price) else Decimal('0.00')
        year_expired_map[m] += Decimal(u_lost) * u_cost

    # Broken inventory losses for the entire year
    year_broken_qs = _BIR.objects.filter(
        created_at__gte=year_start,
        created_at__lte=year_end,
    )
    if target_store_ids is not None:
        year_broken_qs = year_broken_qs.filter(store_id__in=target_store_ids)
    year_broken_map = {m: Decimal('0.00') for m in range(1, 13)}
    for br in year_broken_qs:
        m = br.created_at.astimezone(cur_tz).month
        b_loss = br.total_loss or Decimal('0.00')
        b_fine = (br.fine_amount if br.fine_amount is not None else b_loss) if br.is_fined else Decimal('0.00')
        b_net = max(Decimal('0.00'), b_loss - b_fine)
        year_broken_map[m] += b_net

    monthly_profit_trend = []
    trend_start_month = 1
    if target_year < earliest_record_date.year:
        trend_start_month = 13  # Year precedes any store records
    elif target_year == earliest_record_date.year:
        trend_start_month = earliest_record_date.month

    for m in range(trend_start_month, 13):
        m_gross_sales = year_gross_sales_map[m]
        m_returns = year_returns_map[m]
        m_net_sales = max(Decimal('0.00'), m_gross_sales - m_returns)
        m_net_upi = max(Decimal('0.00'), year_upi_sales_map[m] - year_upi_returns_map[m])

        if not is_combined and len(active_stores) == 1:
            st = active_stores[0]
            if not getattr(st, 'enable_gst', True):
                m_taxable_base = Decimal('0.00')
                m_gst = Decimal('0.00')
            elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
                m_taxable_base = m_net_upi
                m_gst = (m_taxable_base * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
            else:
                m_taxable_base = m_net_sales
                m_gst = (m_taxable_base * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
        else:
            m_taxable_base = Decimal('0.00')
            m_gst = Decimal('0.00')
            for st in active_stores:
                st_g = year_gross_by_st.get(st.id, {}).get(m, Decimal('0.00'))
                st_r = year_ret_by_st.get(st.id, {}).get(m, Decimal('0.00'))
                st_n = max(Decimal('0.00'), st_g - st_r)
                st_us = year_upi_s_by_st.get(st.id, {}).get(m, Decimal('0.00'))
                st_ur = year_upi_r_by_st.get(st.id, {}).get(m, Decimal('0.00'))
                st_nu = max(Decimal('0.00'), st_us - st_ur)
                if not getattr(st, 'enable_gst', True):
                    st_tax = Decimal('0.00')
                    st_g_amt = Decimal('0.00')
                elif getattr(st, 'gst_calculation_mode', 'all') == 'upi_only':
                    st_tax = st_nu
                    st_g_amt = (st_tax * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
                else:
                    st_tax = st_n
                    st_g_amt = (st_tax * (getattr(st, 'gst_rate', Decimal('18.00')) / Decimal('100.00'))).quantize(Decimal('0.01'))
                m_taxable_base += st_tax
                m_gst += st_g_amt

        m_net_rev = max(Decimal('0.00'), m_net_sales - m_gst)
        m_cogs = year_cogs_map[m]
        m_gp = max(Decimal('0.00'), m_net_rev - m_cogs) if m_cogs > 0 else m_net_rev
        m_op_exp = year_op_map[m]
        m_payout = year_payouts_map[m]
        m_sal = year_salary_map[m]
        m_exp_loss = year_expired_map[m]
        m_broken_loss = year_broken_map[m]
        m_non_cogs_expenses = m_op_exp + m_payout + m_sal
        m_total_outflows = m_cogs + m_non_cogs_expenses + m_gst + m_exp_loss + m_broken_loss

        # Operating profit before stakeholder deduction (unclamped!)
        m_op_profit = (m_gp - m_non_cogs_expenses - m_exp_loss - m_broken_loss).quantize(Decimal('0.01'))
        # Contractual stakeholder share (positive profit only)
        m_sh_share = ((m_op_profit * total_stakeholder_percentage) / Decimal('100.00')) if m_op_profit > Decimal('0.00') else Decimal('0.00')
        # Retained profit after stakeholder deduction
        m_ret_profit = m_op_profit - m_sh_share

        m_orders = year_orders_count_map.get(m, 0)
        m_returns_cnt = year_returns_count_map.get(m, 0)
        m_net_orders = max(0, m_orders - m_returns_cnt)
        m_avg_sale = float(round((m_net_rev / m_orders), 2)) if m_orders > 0 else 0.0
        m_gross_avg_sale = float(round((m_gross_sales / m_orders), 2)) if m_orders > 0 else 0.0

        monthly_profit_trend.append({
            'month': m,
            'year': target_year,
            'date': f"{target_year}-{m:02d}-01",
            'label': calendar.month_abbr[m],
            'month_name': calendar.month_name[m],
            'orders_count': m_orders,
            'returns_count': m_returns_cnt,
            'net_sales_count': m_net_orders,
            'avg_sale_rupees': m_avg_sale,
            'average_order_value': m_avg_sale,
            'gross_avg_sale_rupees': m_gross_avg_sale,
            'revenue': float(m_net_rev),
            'gross_sales': float(m_gross_sales),
            'gross_revenue': float(m_gross_sales),
            'returns_amount': float(m_returns),
            'taxable_base': float(m_taxable_base),
            'gst_amount': float(m_gst),
            'net_revenue_after_gst': float(m_net_rev),
            'cogs': float(m_cogs),
            'gross_profit': float(m_gp),
            'operating_expenses': float(m_op_exp + m_payout),
            'counter_payouts': float(m_payout),
            'salaries': float(m_sal),
            'expired_loss': float(m_exp_loss),
            'total_inventory_loss_expired': float(m_exp_loss),
            'broken_loss': float(m_broken_loss),
            'total_inventory_loss_broken': float(m_broken_loss),
            'total_expenses': float(m_non_cogs_expenses),
            'total_outflows': float(m_total_outflows),
            'operating_profit': float(m_op_profit),
            'stakeholder_share': float(m_sh_share),
            'retained_profit': float(m_ret_profit),
            'is_selected': (m == target_month),
        })

    # Attach section 12-month trend
    for sec_dict in sections_list:
        sec_id = sec_dict.get('id', 0)
        sec_monthly_trend = []
        for m in range(1, 13):
            m_r = year_sec_rev_map.get(sec_id, {}).get(m, Decimal('0.00'))
            m_c = year_sec_cogs_map.get(sec_id, {}).get(m, Decimal('0.00'))
            m_gp = max(Decimal('0.00'), m_r - m_c)
            sec_monthly_trend.append({
                'month': m,
                'year': target_year,
                'date': f"{target_year}-{m:02d}-01",
                'label': calendar.month_abbr[m],
                'month_name': calendar.month_name[m],
                'revenue': float(round(m_r, 2)),
                'gross_profit': float(round(m_gp, 2)),
                'profit': float(round(m_gp, 2)),
                'is_selected': (m == target_month),
            })
        sec_dict['monthly_profit_trend'] = sec_monthly_trend

    # 11. WEEKS BREAKDOWN (FOR WEEK-LEVEL ZOOM)
    # Group the period days into dynamic 7-day weekly blocks
    weeks_list = []
    w_start = 1
    w_idx = 1
    while w_start <= last_day:
        w_end = min(w_start + 6, last_day)
        w_days = [d for d in timeline if w_start <= d['day'] <= w_end]
        if w_days:
            w_gross_sales = sum(d.get('gross_revenue', d.get('revenue', 0)) for d in w_days)
            w_gst = sum(d.get('gst_amount', 0) for d in w_days)
            w_net_rev = sum(d.get('net_revenue', d.get('net_revenue_after_gst', d.get('revenue', 0))) for d in w_days)
            w_cogs = sum(d['cogs'] for d in w_days)
            w_gp = sum(d['gross_profit'] for d in w_days)
            w_exp = sum(d['expenses'] for d in w_days)
            w_sal = sum(d.get('salaries', 0) for d in w_days)
            w_exp_loss = sum(d.get('expired_loss', d.get('total_inventory_loss_expired', 0)) for d in w_days)
            w_broken_loss = sum(d.get('broken_loss', d.get('total_inventory_loss_broken', 0)) for d in w_days)
            w_outflows = sum(d['total_outflows'] for d in w_days)
            w_op_profit = sum(d['operating_profit'] for d in w_days)
            w_sh_share = sum(d['stakeholder_share'] for d in w_days)
            w_ret_profit = sum(d['retained_profit'] for d in w_days)

            w_orders = sum(d.get('orders_count', 0) for d in w_days)
            w_returns = sum(d.get('returns_count', 0) for d in w_days)
            w_net_orders = max(0, w_orders - w_returns)
            w_ret_amt = sum(d.get('returns_amount', 0) for d in w_days)
            w_avg_sale = round(float(w_net_rev / w_orders), 2) if w_orders > 0 else 0.0
            w_gross_avg_sale = round(float(w_gross_sales / w_orders), 2) if w_orders > 0 else 0.0

            start_lbl = w_days[0]['label']
            end_lbl = w_days[-1]['label']
            weeks_list.append({
                'week_number': w_idx,
                'label': f"Week {w_idx} ({start_lbl} - {end_lbl})",
                'short_label': f"W{w_idx} ({start_lbl} - {end_lbl})",
                'start_day': w_start,
                'end_day': w_end,
                'start_date': w_days[0]['date'],
                'end_date': w_days[-1]['date'],
                'orders_count': w_orders,
                'returns_count': w_returns,
                'net_sales_count': w_net_orders,
                'returns_amount': round(w_ret_amt, 2),
                'avg_sale_rupees': w_avg_sale,
                'average_order_value': w_avg_sale,
                'gross_avg_sale_rupees': w_gross_avg_sale,
                'revenue': round(w_net_rev, 2),
                'gross_sales': round(w_gross_sales, 2),
                'gross_revenue': round(w_gross_sales, 2),
                'gst_amount': round(w_gst, 2),
                'net_revenue_after_gst': round(w_net_rev, 2),
                'cogs': round(w_cogs, 2),
                'gross_profit': round(w_gp, 2),
                'expenses': round(w_exp, 2),
                'salaries': round(w_sal, 2),
                'expired_loss': round(w_exp_loss, 2),
                'total_inventory_loss_expired': round(w_exp_loss, 2),
                'broken_loss': round(w_broken_loss, 2),
                'total_inventory_loss_broken': round(w_broken_loss, 2),
                'total_outflows': round(w_outflows, 2),
                'operating_profit': round(w_op_profit, 2),
                'stakeholder_share': round(w_sh_share, 2),
                'retained_profit': round(w_ret_profit, 2),
                'days': w_days,
            })
            w_idx += 1
        w_start += 7

    # 12. HOURLY BREAKDOWN PER DAY (FOR DAY-LEVEL ZOOM)
    hourly_time_slots = [
        (8, '8 AM'),
        (10, '10 AM'),
        (12, '12 PM'),
        (14, '2 PM'),
        (16, '4 PM'),
        (18, '6 PM'),
        (20, '8 PM'),
        (22, '10 PM'),
    ]
    hourly_day_map = {}
    hourly_orders_map = {}
    hourly_returns_map = {}
    hourly_returns_amt_map = {}
    hourly_gross_sales_map = {}
    for ord_obj in sales_qs:
        d = (ord_obj.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            h = ord_obj.created_at.astimezone(cur_tz).hour
            slot_idx = min(range(len(hourly_time_slots)), key=lambda i: abs(hourly_time_slots[i][0] - h))
            slot_key = hourly_time_slots[slot_idx][1]

            if d not in hourly_day_map:
                hourly_day_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
                hourly_orders_map[d] = {slot[1]: 0 for slot in hourly_time_slots}
                hourly_returns_map[d] = {slot[1]: 0 for slot in hourly_time_slots}
                hourly_returns_amt_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
                hourly_gross_sales_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
            hourly_day_map[d][slot_key] += ord_obj.total_amount
            hourly_gross_sales_map[d][slot_key] += ord_obj.total_amount
            hourly_orders_map[d][slot_key] += 1

    for ret_obj in returns_qs:
        d = (ret_obj.created_at.astimezone(cur_tz).date() - month_start.date()).days + 1
        if 1 <= d <= last_day:
            h = ret_obj.created_at.astimezone(cur_tz).hour
            slot_idx = min(range(len(hourly_time_slots)), key=lambda i: abs(hourly_time_slots[i][0] - h))
            slot_key = hourly_time_slots[slot_idx][1]

            if d not in hourly_day_map:
                hourly_day_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
                hourly_orders_map[d] = {slot[1]: 0 for slot in hourly_time_slots}
                hourly_returns_map[d] = {slot[1]: 0 for slot in hourly_time_slots}
                hourly_returns_amt_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
                hourly_gross_sales_map[d] = {slot[1]: Decimal('0.00') for slot in hourly_time_slots}
            hourly_day_map[d][slot_key] = max(Decimal('0.00'), hourly_day_map[d][slot_key] - ret_obj.total_amount)
            hourly_returns_map[d][slot_key] += 1
            hourly_returns_amt_map[d][slot_key] += ret_obj.total_amount

    hourly_by_day = {}
    for day in range(1, last_day + 1):
        day_slots = []
        d_slots_data = hourly_day_map.get(day, {})
        d_tl = timeline[day - 1] if day <= len(timeline) else None
        day_total_rev = Decimal(str(d_tl['gross_revenue'])) if d_tl else daily_sales.get(day, Decimal('0.00'))
        day_gst = Decimal(str(d_tl['gst_amount'])) if d_tl else Decimal('0.00')
        day_cogs = Decimal(str(d_tl['cogs'])) if d_tl else Decimal('0.00')
        cogs_ratio = (day_cogs / day_total_rev) if day_total_rev > Decimal('0.00') else Decimal('0.00')
        gst_ratio = (day_gst / day_total_rev) if day_total_rev > Decimal('0.00') else Decimal('0.00')

        for hr, slot_label in hourly_time_slots:
            slot_rev = d_slots_data.get(slot_label, Decimal('0.00'))
            slot_gst = (slot_rev * gst_ratio).quantize(Decimal('0.01'))
            slot_net_rev = max(Decimal('0.00'), slot_rev - slot_gst)
            slot_cogs = (slot_rev * cogs_ratio).quantize(Decimal('0.01'))
            slot_gp = max(Decimal('0.00'), slot_net_rev - slot_cogs)
            slot_op = slot_gp
            slot_sh = (slot_op * effective_sh_share_rate)
            slot_ret = max(Decimal('0.00'), slot_op - slot_sh)
            slot_outflows = slot_cogs + slot_gst

            h_orders = hourly_orders_map.get(day, {}).get(slot_label, 0)
            h_returns = hourly_returns_map.get(day, {}).get(slot_label, 0)
            h_net_orders = max(0, h_orders - h_returns)
            h_ret_amt = float(hourly_returns_amt_map.get(day, {}).get(slot_label, Decimal('0.00')))
            h_gross_rev = float(round(hourly_gross_sales_map.get(day, {}).get(slot_label, slot_rev), 2))
            h_avg_sale = round(float(slot_net_rev / h_orders), 2) if h_orders > 0 else 0.0
            h_gross_avg_sale = round(float(h_gross_rev / h_orders), 2) if h_orders > 0 else 0.0

            day_slots.append({
                'hour': hr,
                'label': slot_label,
                'orders_count': h_orders,
                'returns_count': h_returns,
                'net_sales_count': h_net_orders,
                'returns_amount': h_ret_amt,
                'avg_sale_rupees': h_avg_sale,
                'average_order_value': h_avg_sale,
                'gross_avg_sale_rupees': h_gross_avg_sale,
                'revenue': float(round(slot_net_rev, 2)),
                'gross_sales': h_gross_rev,
                'gross_revenue': h_gross_rev,
                'gst_amount': float(round(slot_gst, 2)),
                'net_revenue_after_gst': float(round(slot_net_rev, 2)),
                'cogs': float(round(slot_cogs, 2)),
                'gross_profit': float(round(slot_gp, 2)),
                'expenses': 0.0,
                'total_outflows': float(round(slot_outflows, 2)),
                'operating_profit': float(round(slot_op, 2)),
                'stakeholder_share': float(round(slot_sh, 2)),
                'retained_profit': float(round(slot_ret, 2)),
            })
        hourly_by_day[day] = day_slots

    # 13. STORE / BRANCH CONTRIBUTION BREAKDOWN
    stores_breakdown = [
        {k: v for k, v in data.items() if k != 'operating_profit'}
        for data in store_profit_map.values()
    ]
    stores_breakdown.sort(key=lambda x: x['revenue'], reverse=True)

    gst_display_str = (
        "Multi-Branch (Per-Location Rates)" if is_combined and len(active_stores) > 1
        else ("GST Exempt / Disabled" if not enable_gst
        else (f"{gst_rate}% on UPI Only" if gst_mode == 'upi_only' else f"{gst_rate}% on All Revenue"))
    )

    return {
        'period': {
            'year': target_year,
            'month': target_month,
            'month_name': calendar.month_name[target_month],
            'days_in_month': last_day,
            'start_date': month_start.isoformat(),
            'end_date': month_end.isoformat(),
        },
        'store_id': store_id,
        'selected_store_ids': target_store_ids,
        'is_combined': is_combined,
        'stores_breakdown': stores_breakdown,
        'summary': {
            'gross_revenue': float(gross_revenue),
            'gross_sales': float(gross_revenue),
            'total_refunds': float(total_refunds),
            'returns_amount': float(total_refunds),
            'total_revenue': float(total_revenue),
            'net_revenue_after_gst': float(net_revenue_after_gst),
            'gst_rate': float(gst_rate),
            'gst_mode': gst_mode,
            'gst_calculation_mode': gst_mode,
            'gst_mode_display': gst_display_str,
            'gst_calculation_mode_display': gst_display_str,
            'enable_gst': enable_gst,
            'enable_stakeholders': enable_stakeholders,
            'taxable_base': float(taxable_base),
            'gst_amount': float(gst_amount),
            'total_upi_inflows': float(net_upi_inflows),
            'total_cash_inflows': float(net_cash_inflows),
            'total_orders_count': total_orders_count,
            'returns_count': returns_qs.count(),
            'average_order_value': round(average_order_value, 2),
            'total_units_sold': total_units_sold,
            'gross_cogs': float(gross_cogs),
            'returned_cogs': float(returned_cogs),
            'total_cogs': float(total_cogs),
            'gross_profit': float(gross_profit),
            'gross_margin_pct': round(gross_margin_pct, 1),
            'total_operating_expenses': float(total_operating_expenses),
            'total_counter_payouts': float(total_counter_payouts),
            'total_non_salary_expenses': float(total_non_salary_expenses),
            'total_salaries_expense': float(total_salaries_expense),
            'total_all_expenses': float(total_all_expenses),
            'total_operating_outflows': float(total_non_salary_expenses + total_salaries_expense),

            # Expired inventory loss
            'total_inventory_loss_expired': float(total_inventory_loss_expired),
            'expired_items_count': expired_items_count,
            'expired_units_count': expired_units_count,

            # Broken inventory loss
            'total_inventory_loss_broken': float(total_inventory_loss_broken),
            'total_inventory_loss_broken_gross': float(total_inventory_loss_broken_gross),
            'total_inventory_loss_broken_fined': float(total_inventory_loss_broken_fined),
            'total_inventory_loss_broken_net': float(total_inventory_loss_broken),
            'broken_items_count': broken_items_count,
            'broken_units_count': broken_units_count,
            'broken_breakdown': {
                'total_loss': float(total_inventory_loss_broken_gross),
                'total_fined': float(total_inventory_loss_broken_fined),
                'total_net_loss': float(total_inventory_loss_broken),
                'items_count': broken_items_count,
                'units_count': broken_units_count,
                'by_category': sorted(
                    [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_category.items()],
                    key=lambda x: x['loss'], reverse=True
                ),
                'by_section': sorted(
                    [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_section.items()],
                    key=lambda x: x['loss'], reverse=True
                ),
                'by_supplier': sorted(
                    [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_supplier.items()],
                    key=lambda x: x['loss'], reverse=True
                ),
                'reports': broken_reports_list,
            },

            # Profit WITHOUT Stakeholders
            'store_operating_net_profit': float(store_operating_net_profit),
            'store_operating_net_profit_margin_pct': round(store_operating_net_profit_margin_pct, 1),

            # Stakeholders metrics
            'total_stakeholder_percentage': float(total_stakeholder_percentage),
            'stakeholder_contractual_share_allocated': float(stakeholder_contractual_share_allocated),
            'total_stakeholder_payouts_disbursed': float(total_stakeholder_payouts_disbursed),
            'active_stakeholders_count': sh_qs.count(),

            # Profit WITH Stakeholders
            'final_retained_net_profit': float(final_retained_net_profit),
            'final_retained_net_profit_margin_pct': round(final_retained_net_profit_margin_pct, 1),

            # Timeline Inception Anchor & Records presence flag
            'earliest_record_date': earliest_record_date.isoformat(),
            'has_records': bool(total_orders_count > 0 or total_operating_expenses > 0 or total_counter_payouts > 0),
        },
        'earliest_record_date': earliest_record_date.isoformat(),
        'has_records': bool(total_orders_count > 0 or total_operating_expenses > 0 or total_counter_payouts > 0),
        'categories': categories_list,
        'suppliers': suppliers_list,
        'sections': sections_list,
        'operating_expenses_breakdown': operating_expenses_breakdown,
        'broken_breakdown': {
            'total_loss': float(total_inventory_loss_broken_gross),
            'total_fined': float(total_inventory_loss_broken_fined),
            'total_net_loss': float(total_inventory_loss_broken),
            'items_count': broken_items_count,
            'units_count': broken_units_count,
            'total_units': broken_units_count,
            'by_category': sorted(
                [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_category.items()],
                key=lambda x: x['loss'], reverse=True
            ),
            'by_section': sorted(
                [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_section.items()],
                key=lambda x: x['loss'], reverse=True
            ),
            'by_supplier': sorted(
                [{'name': k, 'loss': float(v['loss']), 'units': v['units'], 'items': v['items']} for k, v in broken_by_supplier.items()],
                key=lambda x: x['loss'], reverse=True
            ),
            'reports': broken_reports_list,
            'recent_reports': broken_reports_list,
        },
        'stakeholders_breakdown': stakeholder_breakdown,
        'timeline': timeline,
        'payment_methods': inflow_list,
        'waterfall': waterfall,
        'monthly_profit_trend': monthly_profit_trend,
        'weeks': weeks_list,
        'hourly_by_day': hourly_by_day,
    }
