import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Receipt,
  FileSpreadsheet,
  Calendar,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  X,
  User,
  Phone,
  Store as StoreIcon,
  CreditCard,
  Banknote,
  QrCode,
  Split,
  Tag,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Eye,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  FileDown,
  FileText,
  Wallet,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { getSaleOrders, getSaleOrdersPage, getSaleOrdersLedgerSummary, recordOrderDuePayment, fetchCategories, fetchSuppliers, fetchSections } from '../api';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import TimelineRangeSelector from './TimelineRangeSelector';
import {
  getReceiptTermsText,
  getReceiptTermsFontSize,
  renderFormattedTerms,
  formatTermsForWhatsApp,
} from '../utils/receiptTermsSettings';
import WhatsAppIcon from './WhatsAppIcon';
import { sendWhatsAppReceipt } from '../utils/whatsappService';
import { saveReceiptAsPdf, generateReceiptPdfBlob } from '../utils/saveReceiptAsPdf';


const PAYMENT_METHODS = [
  { id: 'all', label: 'All Payment Modes' },
  { id: 'cash', label: 'Cash Only', icon: Banknote, color: '#10B981' },
  { id: 'upi', label: 'UPI / QR', icon: QrCode, color: '#38BDF8' },
  { id: 'card', label: 'Debit / Credit Card', icon: CreditCard, color: '#818CF8' },
  { id: 'split', label: 'Split Payment (Cash + UPI)', icon: Split, color: '#F59E0B' },
  { id: 'partial', label: 'Partial / Pending Dues (Khata)', icon: Receipt, color: '#EC4899' },
  { id: 'credit', label: 'Store Credit / Customer Due', icon: Tag, color: '#EC4899' },
];

export default function SalesInvoicesLedgerView({
  activeStoreId = '',
  isCombined = false,
  currentUser = null,
  stores = [],
  currencySymbol = 'Rs.',
  timelineRange = null,
  onTimelineRangeChange = null,
  minDate = '2026-09-04',
}) {
  const showBranchColumn = isCombined || activeStoreId === 'all' || activeStoreId.includes(',') || (stores && stores.length > 1);
  // Server-side paginated rows for the table
  const [orders, setOrders] = useState([]);
  // Total matching count (from backend pagination metadata)
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // KPI summary fetched from ledger-summary action (DB aggregation, filter-set aware)
  const [kpiSummary, setKpiSummary] = useState({
    orderCount: 0, salesCount: 0, returnsCount: 0,
    grossTotal: 0, totalDiscount: 0, totalTax: 0,
    totalUnits: 0, aov: 0, totalProfit: 0, profitMargin: 0,
  });
  const [kpiLoading, setKpiLoading] = useState(false);
  // Full-filter cashier & payment breakdown aggregated across entire timeline
  const [summaryCashierBreakdown, setSummaryCashierBreakdown] = useState([]);
  const [summaryPaymentBreakdown, setSummaryPaymentBreakdown] = useState([]);
  // Cashier names from backend for the filter dropdown
  const [cashierOptions, setCashierOptions] = useState([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced search to avoid firing on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value.trim()), 400);
  };

  const [selectedTimelineRange, setSelectedTimelineRange] = useState(() => {
    if (timelineRange) return timelineRange;
    const now = new Date();
    return {
      unit: 'month',
      count: 1,
      isAllTime: false,
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
  });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'returned' | 'dues'
  const [sectionFilter, setSectionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [productQuery, setProductQuery] = useState('');
  const [debouncedProductQuery, setDebouncedProductQuery] = useState('');
  const productDebounceRef = useRef(null);
  const handleProductQueryChange = (value) => {
    setProductQuery(value);
    clearTimeout(productDebounceRef.current);
    productDebounceRef.current = setTimeout(() => setDebouncedProductQuery(value.trim()), 400);
  };

  // Master metadata options loaded for category, section, and supplier filters
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      fetchCategories(),
      fetchSections({ is_active: true }),
      fetchSuppliers({ is_active: true }),
    ]).then(([catRes, secRes, supRes]) => {
      if (!isMounted) return;
      if (catRes.status === 'fulfilled') {
        const cats = Array.isArray(catRes.value) ? catRes.value : (catRes.value?.results || []);
        setCategoryOptions(cats);
      }
      if (secRes.status === 'fulfilled') {
        const secs = Array.isArray(secRes.value) ? secRes.value : (secRes.value?.results || []);
        setSectionOptions(secs);
      }
      if (supRes.status === 'fulfilled') {
        const sups = Array.isArray(supRes.value) ? supRes.value : (supRes.value?.results || []);
        setSupplierOptions(sups);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'invoice_asc' | 'invoice_desc' | 'customer_asc' | 'due_desc'

  // Receipt Modal State
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [copiedInvoice, setCopiedInvoice] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Pagination (server-side)
  const LEDGER_PAGE_SIZE_OPTIONS = [50, 100, 250, 500];
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(100);

  // Derived from backend pagination metadata
  const ledgerTotalPages = Math.max(1, Math.ceil(totalCount / ledgerPageSize));
  const ledgerStartEntry = totalCount === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize + 1;
  const ledgerEndEntry = Math.min(ledgerPage * ledgerPageSize, totalCount);

  // Table Horizontal Drag-to-Scroll Refs & State
  const tableContainerRef = useRef(null);
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0, hasDragged: false });

  const handleTableMouseDown = (e) => {
    // Only drag with primary mouse button, ignore clicks on buttons, links, inputs
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, a, textarea')) return;
    const container = tableContainerRef.current;
    if (!container) return;

    setIsDraggingTable(true);
    dragStartRef.current = {
      x: e.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
      hasDragged: false,
    };
  };

  const handleTableMouseMove = (e) => {
    if (!isDraggingTable || !tableContainerRef.current) return;
    e.preventDefault();
    const container = tableContainerRef.current;
    const x = e.pageX - container.offsetLeft;
    const walk = x - dragStartRef.current.x;
    if (Math.abs(walk) > 4) {
      dragStartRef.current.hasDragged = true;
    }
    container.scrollLeft = dragStartRef.current.scrollLeft - walk;
  };

  const handleTableMouseUp = () => {
    setIsDraggingTable(false);
  };

  // Due Settlement Modal State
  const [selectedDueOrder, setSelectedDueOrder] = useState(null);
  const [isDueSettleModalOpen, setIsDueSettleModalOpen] = useState(false);
  const [dueSettleAmount, setDueSettleAmount] = useState('');
  const [dueSettleMethod, setDueSettleMethod] = useState('cash');
  const [dueSettleNotes, setDueSettleNotes] = useState('');
  const [isSubmittingDueSettle, setIsSubmittingDueSettle] = useState(false);
  const [dueSettleError, setDueSettleError] = useState('');
  const [dueSettleSuccess, setDueSettleSuccess] = useState('');

  const handleOpenDueSettle = (order, e) => {
    e?.stopPropagation();
    setSelectedDueOrder(order);
    setDueSettleAmount(String(parseFloat(order.balance_due || 0).toFixed(2)));
    setDueSettleMethod('cash');
    setDueSettleNotes('');
    setDueSettleError('');
    setDueSettleSuccess('');
    setIsDueSettleModalOpen(true);
  };

  const handleConfirmDueSettle = async (e) => {
    e?.preventDefault();
    if (!selectedDueOrder) return;
    const amt = parseFloat(dueSettleAmount);
    if (isNaN(amt) || amt <= 0) {
      setDueSettleError('Please enter a valid payment amount greater than ₹0.');
      return;
    }
    const maxDue = parseFloat(selectedDueOrder.balance_due || 0);
    if (amt > maxDue + 0.05) {
      setDueSettleError(`Payment amount (₹${amt.toFixed(2)}) cannot exceed the balance due (₹${maxDue.toFixed(2)}).`);
      return;
    }

    setIsSubmittingDueSettle(true);
    setDueSettleError('');
    try {
      await recordOrderDuePayment(selectedDueOrder.id, {
        amount: Number(amt.toFixed(2)),
        payment_method: dueSettleMethod,
        notes: dueSettleNotes.trim() || undefined,
      });
      setDueSettleSuccess(`Successfully collected ₹${amt.toFixed(2)} via ${dueSettleMethod.toUpperCase()}! Recorded into accounts.`);
      setTimeout(() => {
        setIsDueSettleModalOpen(false);
        setSelectedDueOrder(null);
        setDueSettleSuccess('');
      }, 1400);

      loadOrders();
    } catch (err) {
      setDueSettleError(err.message || 'Failed to record due payment');
    } finally {
      setIsSubmittingDueSettle(false);
    }
  };

  // ─── Date bounds derived from timeline selector ────────────────────────────
  const dateRangeBounds = useMemo(() => {
    if (!selectedTimelineRange) return { start: '', end: '' };
    if (selectedTimelineRange.isAllTime || selectedTimelineRange.unit === 'all') {
      return { start: '', end: '' };
    }
    return {
      start: selectedTimelineRange.startDate || '',
      end: selectedTimelineRange.endDate || '',
    };
  }, [selectedTimelineRange]);

  // ─── Build shared filter params sent to both list + summary endpoints ──────
  const buildFilterParams = useCallback(() => {
    const params = {};
    if (activeStoreId) params.store = activeStoreId;
    if (dateRangeBounds.start) params['created_at__gte'] = `${dateRangeBounds.start}T00:00:00`;
    if (dateRangeBounds.end)   params['created_at__lte'] = `${dateRangeBounds.end}T23:59:59`;
    if (debouncedSearch)       params.search = debouncedSearch;
    if (debouncedProductQuery) params.product_query = debouncedProductQuery;
    if (paymentMethodFilter !== 'all') params.payment_method = paymentMethodFilter;
    if (cashierFilter !== 'all')       params.cashier_name   = cashierFilter;
    if (statusFilter !== 'all')        params.order_status   = statusFilter;
    if (sectionFilter !== 'all')       params.section        = sectionFilter;
    if (categoryFilter !== 'all')      params.category       = categoryFilter;
    if (supplierFilter !== 'all')      params.supplier       = supplierFilter;
    return params;
  }, [
    activeStoreId,
    dateRangeBounds.start,
    dateRangeBounds.end,
    debouncedSearch,
    debouncedProductQuery,
    paymentMethodFilter,
    cashierFilter,
    statusFilter,
    sectionFilter,
    categoryFilter,
    supplierFilter,
  ]);

  // ─── Sorting map (backend ordering param) ─────────────────────────────────
  const orderingParam = useMemo(() => {
    if (sortBy === 'date_asc')     return 'created_at';
    if (sortBy === 'amount_desc')  return '-total_amount';
    if (sortBy === 'amount_asc')   return 'total_amount';
    if (sortBy === 'invoice_asc')  return 'invoice_number';
    if (sortBy === 'invoice_desc') return '-invoice_number';
    if (sortBy === 'customer_asc') return 'customer_name';
    if (sortBy === 'due_desc')     return '-balance_due';
    return '-created_at'; // date_desc default
  }, [sortBy]);

  // ─── Fetch one page of orders from backend (server-side pagination) ────────
  const loadOrders = useCallback(async (page = ledgerPage) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        ...buildFilterParams(),
        page,
        page_size: ledgerPageSize,
        ordering: orderingParam,
      };
      const data = await getSaleOrdersPage(params);
      // data = { count, total_pages, current_page, page_size, results }
      setOrders(Array.isArray(data) ? data : (data?.results || []));
      setTotalCount(data?.count ?? (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error('Failed to load sales orders:', err);
      setError('Unable to load orders. Please check your network connection.');
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams, ledgerPage, ledgerPageSize, orderingParam]);

  // ─── Fetch KPI summary (aggregate totals) from backend ────────────────────
  const loadKpiSummary = useCallback(async () => {
    setKpiLoading(true);
    try {
      const params = buildFilterParams();
      const data = await getSaleOrdersLedgerSummary(params);
      const grossTotal = (data.net_total ?? data.gross_sales ?? 0);
      const aovValue   = data.aov ?? 0;
      setKpiSummary({
        orderCount:    data.order_count    ?? 0,
        salesCount:    data.sales_count    ?? 0,
        returnsCount:  data.returns_count  ?? 0,
        grossTotal:    grossTotal,
        totalDiscount: data.total_discount ?? 0,
        totalTax:      data.total_tax      ?? 0,
        totalUnits:    data.total_units    ?? 0,
        aov:           aovValue,
        totalProfit:   data.total_profit   ?? 0,
        profitMargin:  data.profit_margin  ?? 0,
      });
      // Update cashier filter dropdown from summary
      if (Array.isArray(data.cashier_names)) {
        setCashierOptions(data.cashier_names);
      }
      // Update full-filter cashier & payment method breakdowns
      if (Array.isArray(data.cashier_breakdown)) {
        setSummaryCashierBreakdown(data.cashier_breakdown);
      }
      if (Array.isArray(data.payment_method_breakdown)) {
        setSummaryPaymentBreakdown(data.payment_method_breakdown);
      }
    } catch (err) {
      console.error('Failed to load ledger summary:', err);
    } finally {
      setKpiLoading(false);
    }
  }, [buildFilterParams]);

  // ─── Trigger reload when filters change (reset to page 1) ─────────────────
  const filterSig = useMemo(() =>
    JSON.stringify([
      activeStoreId,
      dateRangeBounds,
      debouncedSearch,
      debouncedProductQuery,
      paymentMethodFilter,
      cashierFilter,
      statusFilter,
      sectionFilter,
      categoryFilter,
      supplierFilter,
    ]),
    [
      activeStoreId,
      dateRangeBounds,
      debouncedSearch,
      debouncedProductQuery,
      paymentMethodFilter,
      cashierFilter,
      statusFilter,
      sectionFilter,
      categoryFilter,
      supplierFilter,
    ]
  );

  useEffect(() => {
    setLedgerPage(1);
    loadKpiSummary();
    // loadOrders(1) called via the page effect below once ledgerPage resets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // Re-fetch when page or page size or sort changes
  useEffect(() => {
    loadOrders(ledgerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerPage, ledgerPageSize, orderingParam, filterSig]);

  // Synchronize date filter with Master Timeline Range if provided
  useEffect(() => {
    if (!timelineRange) return;
    setSelectedTimelineRange((prev) => {
      if (
        prev &&
        prev.startDate === timelineRange.startDate &&
        prev.endDate === timelineRange.endDate &&
        prev.unit === timelineRange.unit &&
        prev.count === timelineRange.count &&
        prev.isAllTime === timelineRange.isAllTime &&
        prev.granularity === timelineRange.granularity &&
        prev.label === timelineRange.label
      ) {
        return prev;
      }
      return timelineRange;
    });
  }, [timelineRange]);


  // ─── In server-side mode the table shows the current page rows directly ────
  // 'orders' IS the current page (already paginated by backend).
  // 'filteredOrders' alias kept for backward compat with CSV export helpers below.
  const filteredOrders = orders;
  // 'paginatedOrders' IS the same as 'orders' (no extra client-side slicing needed)
  const paginatedOrders = orders;

  // ─── Helper: compute gross profit for a single order ──────────────────────
  const computeOrderProfit = useCallback((o) => {
    if (!o) return 0;
    const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
    let lineProfit = 0;
    (o.items || []).forEach((it) => {
      const revenue = parseFloat(it.total_price) || 0;
      const cost    = (parseFloat(it.unit_cost_price) || 0) * (parseInt(it.quantity, 10) || 0);
      lineProfit += revenue - cost;
    });
    // Returns negate the profit (we gave goods back)
    return isRet ? -Math.abs(lineProfit) : lineProfit;
  }, []);



  // NOTE: kpiSummary is state set by loadKpiSummary() — DB-level aggregation over full filter set.
  // cashierBreakdown and paymentMethodBreakdown below are computed from the current PAGE rows only
  // (filteredOrders = current page). They update as you page through results.


  // ─── Per-cashier breakdown (DB-aggregated across entire timeline with page fallback) ──
  const cashierBreakdown = useMemo(() => {
    if (summaryCashierBreakdown && summaryCashierBreakdown.length > 0) {
      return summaryCashierBreakdown;
    }
    const map = {};
    filteredOrders.forEach((o) => {
      const name = o.cashier_name || 'Counter Staff';
      if (!map[name]) {
        map[name] = { name, turnover: 0, profit: 0, orders: 0, units: 0 };
      }
      const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
      const amt = parseFloat(o.total_amount) || 0;
      map[name].turnover += isRet ? -amt : amt;
      map[name].profit   += computeOrderProfit(o);
      map[name].orders   += 1;
      (o.items || []).forEach((it) => {
        map[name].units += parseInt(it.quantity, 10) || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.turnover - a.turnover);
  }, [summaryCashierBreakdown, filteredOrders, computeOrderProfit]);

  // ─── Per-payment-method breakdown & Cashier payment attribution ─────────────
  const PAYMENT_METHOD_CONFIG = useMemo(() => ({
    cash: { label: 'Cash', color: '#10B981', icon: Banknote },
    upi: { label: 'UPI / QR', color: '#38BDF8', icon: QrCode },
    card: { label: 'Card / VIP Card', color: '#818CF8', icon: CreditCard },
    due: { label: 'Pending Dues (Khata)', color: '#EC4899', icon: Receipt },
    other: { label: 'Other / Credit', color: '#F59E0B', icon: Tag },
  }), []);

  const { paymentMethodBreakdown, cashierPaymentBreakdown, paymentMethodTotals } = useMemo(() => {
    // If we have full-timeline summary data from the backend, build from it
    if (summaryPaymentBreakdown && summaryPaymentBreakdown.length > 0) {
      const breakdownList = summaryPaymentBreakdown.filter((item) => Math.abs(item.amount) > 0);
      const totalCollectedAll = breakdownList.reduce((sum, item) => sum + Math.max(0, item.amount), 0);

      // Cashier payment breakdown from summaryCashierBreakdown
      const cashierList = (summaryCashierBreakdown || []).map((c) => {
        const m = c.methods || { cash: 0, upi: 0, card: 0, due: 0, other: 0 };
        const total = (m.cash || 0) + (m.upi || 0) + (m.card || 0) + (m.due || 0) + (m.other || 0);
        return {
          name: c.name,
          totalCollected: total > 0 ? total : c.turnover,
          ordersCount: c.orders,
          methods: {
            cash: m.cash || 0,
            upi: m.upi || 0,
            card: m.card || 0,
            due: m.due || 0,
            other: m.other || 0,
          },
        };
      }).sort((a, b) => b.totalCollected - a.totalCollected);

      return {
        paymentMethodBreakdown: breakdownList,
        cashierPaymentBreakdown: cashierList,
        paymentMethodTotals: totalCollectedAll,
      };
    }

    // Fallback: Compute from current page rows if summary endpoint has not loaded yet
    const payMap = {
      cash: { id: 'cash', label: 'Cash', color: '#10B981', amount: 0, ordersCount: 0 },
      upi: { id: 'upi', label: 'UPI / QR', color: '#38BDF8', amount: 0, ordersCount: 0 },
      card: { id: 'card', label: 'Card / VIP Card', color: '#818CF8', amount: 0, ordersCount: 0 },
      due: { id: 'due', label: 'Pending Dues (Khata)', color: '#EC4899', amount: 0, ordersCount: 0 },
      other: { id: 'other', label: 'Other / Credit', color: '#F59E0B', amount: 0, ordersCount: 0 },
    };

    const cashierMap = {};

    filteredOrders.forEach((o) => {
      const cName = o.cashier_name || 'Counter Staff';
      if (!cashierMap[cName]) {
        cashierMap[cName] = {
          name: cName,
          totalCollected: 0,
          ordersCount: 0,
          methods: {
            cash: 0,
            upi: 0,
            card: 0,
            due: 0,
            other: 0,
          },
        };
      }

      const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
      const sign = isRet ? -1 : 1;
      const totalAmt = parseFloat(o.total_amount) || 0;
      const rawMethod = (o.payment_method || 'cash').trim().toLowerCase();

      cashierMap[cName].ordersCount += 1;

      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let dueAmt = 0;
      let otherAmt = 0;

      if (rawMethod === 'split') {
        cashAmt = (parseFloat(o.split_cash_amount) || 0) * sign;
        upiAmt = (parseFloat(o.split_upi_amount) || 0) * sign;
        if (cashAmt === 0 && upiAmt === 0) {
          cashAmt = (totalAmt / 2) * sign;
          upiAmt = (totalAmt / 2) * sign;
        }
      } else if (rawMethod === 'partial' || parseFloat(o.balance_due || 0) > 0) {
        const balDue = (parseFloat(o.balance_due) || 0) * sign;
        const paid = (parseFloat(o.amount_paid) || (totalAmt - Math.abs(balDue))) * sign;
        dueAmt = balDue;

        const initMethod = (o.initial_payment_method || 'cash').trim().toLowerCase();
        if (initMethod === 'upi' || initMethod === 'qr') {
          upiAmt = paid;
        } else if (initMethod === 'card' || initMethod === 'vip_card') {
          cardAmt = paid;
        } else {
          cashAmt = paid;
        }
      } else if (rawMethod === 'cash') {
        cashAmt = totalAmt * sign;
      } else if (rawMethod === 'upi' || rawMethod === 'qr') {
        upiAmt = totalAmt * sign;
      } else if (rawMethod === 'card' || rawMethod === 'vip_card') {
        cardAmt = totalAmt * sign;
      } else if (rawMethod === 'credit') {
        dueAmt = totalAmt * sign;
      } else {
        otherAmt = totalAmt * sign;
      }

      if (cashAmt !== 0) {
        payMap.cash.amount += cashAmt;
        payMap.cash.ordersCount += 1;
        cashierMap[cName].methods.cash += cashAmt;
      }
      if (upiAmt !== 0) {
        payMap.upi.amount += upiAmt;
        payMap.upi.ordersCount += 1;
        cashierMap[cName].methods.upi += upiAmt;
      }
      if (cardAmt !== 0) {
        payMap.card.amount += cardAmt;
        payMap.card.ordersCount += 1;
        cashierMap[cName].methods.card += cardAmt;
      }
      if (dueAmt !== 0) {
        payMap.due.amount += dueAmt;
        payMap.due.ordersCount += 1;
        cashierMap[cName].methods.due += dueAmt;
      }
      if (otherAmt !== 0) {
        payMap.other.amount += otherAmt;
        payMap.other.ordersCount += 1;
        cashierMap[cName].methods.other += otherAmt;
      }

      cashierMap[cName].totalCollected += (cashAmt + upiAmt + cardAmt + dueAmt + otherAmt);
    });

    const breakdownList = Object.values(payMap).filter((item) => Math.abs(item.amount) > 0 || item.ordersCount > 0);
    const cashierList = Object.values(cashierMap).sort((a, b) => b.totalCollected - a.totalCollected);
    const totalCollectedAll = breakdownList.reduce((sum, item) => sum + Math.max(0, item.amount), 0);

    return {
      paymentMethodBreakdown: breakdownList,
      cashierPaymentBreakdown: cashierList,
      paymentMethodTotals: totalCollectedAll,
    };
  }, [summaryPaymentBreakdown, summaryCashierBreakdown, filteredOrders]);

  // Pie chart hover states
  const [pieCashierHovered, setPieCashierHovered] = useState(null);
  const [pieMetric, setPieMetric] = useState('revenue'); // 'revenue' | 'profit'
  const [piePaymentHovered, setPiePaymentHovered] = useState(null);

  // Export to CSV (Enhanced with Profit, Cost, Cashier Summary, and Payment Method Attributions)
  const handleExportCsv = async () => {
    if (totalCount === 0 || exportingCsv) return;
    setExportingCsv(true);
    setExportProgress(10);

    const progressTimer = setInterval(() => {
      setExportProgress((prev) => {
        if (prev < 50) return prev + 12;
        if (prev < 85) return prev + 6;
        return prev;
      });
    }, 80);

    try {
      // Fetch ALL matching records (no page/page_size = unpaginated list from backend)
      const allData = await getSaleOrders({ ...buildFilterParams(), ordering: orderingParam });
      const allOrders = Array.isArray(allData) ? allData : (allData?.results || []);

      setExportProgress(60);

        // ── Section 1: Order-level ledger ──
    const headers = [
      'Invoice Number',
      'Date',
      'Time',
      'Customer Name',
      'Customer Phone',
      'Customer GSTIN',
      'Cashier',
      'Payment Method',
      'Items Count',
      'Cost of Goods Sold',
      'Subtotal',
      'Discount',
      'Tax',
      'Total Amount',
      'Gross Profit',
      'Profit Margin %',
      'Status',
    ];

    const rows = allOrders.map((o) => {
      const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
      const dt = new Date(o.created_at);
      const dStr = dt.toLocaleDateString('en-IN');
      const tStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const itemsCount = (o.items || []).reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
      const cogs = (o.items || []).reduce((acc, it) => acc + (parseFloat(it.unit_cost_price) || 0) * (parseInt(it.quantity, 10) || 0), 0);
      const profit = computeOrderProfit(o);
      const totalAmt = parseFloat(o.total_amount || 0);
      const displayTotal = isRet ? -totalAmt : totalAmt;
      const margin = totalAmt > 0 ? (profit / totalAmt) * 100 : 0;

      return [
        `"${o.invoice_number || ''}"`,
        `"${dStr}"`,
        `"${tStr}"`,
        `"${(o.customer_name || o.customer_display_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
        `"${o.customer_phone || ''}"`,
        `"${o.customer_gst_number || ''}"`,
        `"${(o.cashier_name || 'Staff').replace(/"/g, '""')}"`,
        `"${(o.payment_method || 'Cash').toUpperCase()}"`,
        isRet ? -itemsCount : itemsCount,
        (isRet ? -cogs : cogs).toFixed(2),
        parseFloat(o.subtotal || 0).toFixed(2),
        parseFloat(o.discount_amount || 0).toFixed(2),
        parseFloat(o.tax_amount || 0).toFixed(2),
        displayTotal.toFixed(2),
        profit.toFixed(2),
        margin.toFixed(1) + '%',
        `"${isRet ? 'Returned' : (o.status || 'completed')}"`,
      ];
    });

    // ── Section 2: Summary row (from server-side aggregate) ──
    const summaryRows = [
      [],
      ['=== SUMMARY ==='],
      [`"Total Orders & Vouchers"`, kpiSummary.orderCount],
      [`"Completed Sales"`, kpiSummary.salesCount],
      [`"Return Vouchers"`, kpiSummary.returnsCount],
      [`"Net Sales Turnover"`, kpiSummary.grossTotal.toFixed(2)],
      [`"Total Discounts Given"`, kpiSummary.totalDiscount.toFixed(2)],
      [`"Average Order Value"`, kpiSummary.aov.toFixed(2)],
      [],
      ['=== CASHIER OVERALL PERFORMANCE (current page) ==='],
      ['Cashier', 'Orders', 'Units Sold', 'Turnover', 'Gross Profit', 'Profit Margin %', 'Avg Order Value'],
      ...cashierBreakdown.map((c) => {
        const margin = c.turnover > 0 ? (c.profit / c.turnover) * 100 : 0;
        const aov    = c.orders > 0 ? c.turnover / c.orders : 0;
        return [
          `"${c.name}"`,
          c.orders,
          c.units,
          c.turnover.toFixed(2),
          c.profit.toFixed(2),
          margin.toFixed(1) + '%',
          aov.toFixed(2),
        ];
      }),
      [],
      ['=== PAYMENT METHOD BREAKDOWN (current page) ==='],
      ['Payment Method', 'Transactions Count', 'Amount Collected', 'Share %'],
      ...paymentMethodBreakdown.map((pm) => {
        const share = paymentMethodTotals > 0 ? ((Math.max(0, pm.amount) / paymentMethodTotals) * 100).toFixed(1) + '%' : '0.0%';
        return [
          `"${pm.label}"`,
          pm.ordersCount,
          pm.amount.toFixed(2),
          `"${share}"`,
        ];
      }),
      [],
      ['=== CASHIER PAYMENT METHOD BREAKDOWN (current page) ==='],
      ['Cashier', 'Total Collected', 'Cash Amount', 'Cash Share %', 'UPI Amount', 'UPI Share %', 'Card Amount', 'Card Share %', 'Pending Due', 'Other Amount'],
      ...cashierPaymentBreakdown.map((cp) => {
        const tot = cp.totalCollected > 0 ? cp.totalCollected : 1;
        const cashShare = cp.totalCollected > 0 ? ((Math.max(0, cp.methods.cash) / tot) * 100).toFixed(1) + '%' : '0.0%';
        const upiShare  = cp.totalCollected > 0 ? ((Math.max(0, cp.methods.upi) / tot) * 100).toFixed(1) + '%' : '0.0%';
        const cardShare = cp.totalCollected > 0 ? ((Math.max(0, cp.methods.card) / tot) * 100).toFixed(1) + '%' : '0.0%';
        return [
          `"${cp.name}"`,
          cp.totalCollected.toFixed(2),
          cp.methods.cash.toFixed(2),
          `"${cashShare}"`,
          cp.methods.upi.toFixed(2),
          `"${upiShare}"`,
          cp.methods.card.toFixed(2),
          `"${cardShare}"`,
          cp.methods.due.toFixed(2),
          cp.methods.other.toFixed(2),
        ];
      }),
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      ...summaryRows.map((r) => r.join(',')),
    ].join('\n');

    clearInterval(progressTimer);
    setExportProgress(100);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export sales ledger CSV:', err);
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setExportingCsv(false);
        setExportProgress(0);
      }, 350);
    }
  };


  const copyInvoiceNumber = (inv, e) => {
    e?.stopPropagation();
    if (!inv) return;
    navigator.clipboard.writeText(inv);
    setCopiedInvoice(inv);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [waCooldownActive, setWaCooldownActive] = useState(false);

  const handleSendWhatsApp = async (order, force = false) => {
    if (!order || isSendingWhatsApp) return;
    setIsSendingWhatsApp(true);
    showNotification?.('info', force ? 'Force dispatching bill PDF to WhatsApp...' : 'Generating bill PDF and sending directly to WhatsApp...');

    const storeObj = { id: order.store_id, name: order.store_name };
    const targetCustomer = {
      phone: order.customer_phone || (order.customer && order.customer.phone) || '',
      name: order.customer_name || (order.customer && order.customer.name) || 'Dear Customer'
    };

    let pdfBlob = null;
    const receiptEl = document.getElementById('printable-pos-receipt');
    if (receiptEl && selectedReceiptOrder && selectedReceiptOrder.id === order.id) {
      try {
        pdfBlob = await generateReceiptPdfBlob(order.invoice_number || 'bill', receiptEl);
      } catch (e) {
        console.warn('Could not capture receipt blob from DOM, fallback to backend PDF:', e);
      }
    }

    try {
      await sendWhatsAppReceipt(
        order,
        storeObj,
        targetCustomer,
        (feedback) => {
          const isReturnOrder = Boolean(
            order.is_return ||
            (order.invoice_number && String(order.invoice_number).startsWith('RET-')) ||
            order.return_reference ||
            order.status === 'refunded'
          );
          const typeLabel = isReturnOrder ? 'Return voucher' : 'Bill';
          if (feedback.success) {
            setWaCooldownActive(false);
            showNotification?.('success', feedback.message || `${typeLabel} #${order.invoice_number} sent directly to WhatsApp!`);
          } else {
            const msg = feedback.message || `Failed to send ${typeLabel.toLowerCase()} via WhatsApp.`;
            if (msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('recently')) {
              setWaCooldownActive(true);
            }
            showNotification?.('error', msg);
          }
        },
        pdfBlob,
        force
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };


  const handleCopyBillText = (order) => {
    if (!order) return;
    const itemsList =
      order.items
        ?.map((item, idx) => `${idx + 1}. ${item.item_name} (Qty: ${item.quantity} × ₹${item.unit_selling_price} = ₹${item.total_price})`)
        .join('\n') || '';
    const storeName = order.store_name || order.store_details?.name || 'Wondersale';
    const custName = order.customer_name || (order.customer_display_name && !order.customer_display_name.startsWith('Customer (') ? order.customer_display_name : '') || order.customer_phone || '';
    const isReturn = Boolean(
      order.is_return ||
      (order.invoice_number && order.invoice_number.startsWith('RET-')) ||
      order.return_reference ||
      order.status === 'refunded'
    );
    const titleLine = isReturn ? `Return Voucher #${order.invoice_number}` : `Invoice #${order.invoice_number}`;
    const totalLine = isReturn ? `Total Refund: -₹${order.total_amount} (Refunded)` : `Total: ₹${order.total_amount}`;
    const termsRaw = !isReturn ? getReceiptTermsText() : '';
    const termsSection = termsRaw ? `\n\nTERMS & CONDITIONS\n${termsRaw.replace(/\*\*/g, '')}` : '';

    const text =
      `${storeName} - ${titleLine}\n` +
      (order.return_reference ? `Original Bill: #${order.return_reference}\n` : '') +
      (custName ? `Customer: ${custName}\n` : '') +
      `Date: ${new Date(order.created_at).toLocaleString('en-IN')}\n` +
      `Items:\n${itemsList}\n` +
      `${totalLine}\n` +
      `Thank you for shopping with us!` +
      termsSection;

    navigator.clipboard?.writeText(text);
    setCopiedInvoice(order.id);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  const handleSaveAsPdf = (order = selectedReceiptOrder) => {
    if (!order) return;
    saveReceiptAsPdf(order.invoice_number || 'bill');
  };

  // ─── Donut SVG Pie Chart helper ────────────────────────────────────────────
  const CASHIER_PALETTE = [
    '#38BDF8', '#00E5A3', '#F59E0B', '#EC4899', '#818CF8',
    '#10B981', '#6366F1', '#14B8A6', '#F43F5E', '#A855F7',
  ];

  function buildArc(cx, cy, ri, ro, s, e) {
    const delta = e - s;
    const full = delta >= 2 * Math.PI - 0.001;
    const se = full ? s + 2 * Math.PI - 0.0001 : e;
    const la = delta > Math.PI ? 1 : 0;
    const x1 = cx + ro * Math.cos(s), y1 = cy + ro * Math.sin(s);
    const x2 = cx + ro * Math.cos(se), y2 = cy + ro * Math.sin(se);
    const x3 = cx + ri * Math.cos(se), y3 = cy + ri * Math.sin(se);
    const x4 = cx + ri * Math.cos(s), y4 = cy + ri * Math.sin(s);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${ro} ${ro} 0 ${la} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${ri} ${ri} 0 ${la} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
  }

  function CashierDonutChart({ data, metric }) {
    const cx = 110, cy = 110, rOuter = 90, rInner = 52;
    const vals = data.map((d) => Math.max(0, metric === 'profit' ? d.profit : d.turnover));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total === 0) return null;

    let startAngle = -Math.PI / 2;
    const slices = data.map((d, i) => {
      const share = vals[i] / total;
      const end = startAngle + share * 2 * Math.PI;
      const slice = { d: buildArc(cx, cy, rInner, rOuter, startAngle, end), color: CASHIER_PALETTE[i % CASHIER_PALETTE.length], share, item: d };
      startAngle = end;
      return slice;
    });

    const hovered = pieCashierHovered !== null ? data[pieCashierHovered] : null;
    const centerVal = hovered
      ? (metric === 'profit' ? hovered.profit : hovered.turnover)
      : (metric === 'profit' ? kpiSummary.totalProfit : kpiSummary.grossTotal);
    const centerLabel = hovered ? hovered.name.split(' ')[0] : (metric === 'profit' ? 'Profit' : 'Revenue');

    return (
      <svg width={220} height={220} viewBox="0 0 220 220">
        {slices.map((sl, i) => (
          <path
            key={i}
            d={sl.d}
            fill={sl.color}
            opacity={pieCashierHovered === null || pieCashierHovered === i ? 1 : 0.35}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
            onMouseEnter={() => setPieCashierHovered(i)}
            onMouseLeave={() => setPieCashierHovered(null)}
          />
        ))}
        {/* Centre text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" opacity="0.85">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
          {formatIndianCurrencyCompact(centerVal)}
        </text>
        {hovered && (
          <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
            {(slices[pieCashierHovered]?.share * 100).toFixed(1)}% share
          </text>
        )}
      </svg>
    );
  }

  function PaymentMethodDonutChart({ data, total }) {
    const cx = 110, cy = 110, rOuter = 90, rInner = 52;
    const vals = data.map((d) => Math.max(0, d.amount));
    const totalVal = vals.reduce((a, b) => a + b, 0) || total || 0;
    if (totalVal === 0) return null;

    let startAngle = -Math.PI / 2;
    const slices = data.map((d, i) => {
      const share = totalVal > 0 ? vals[i] / totalVal : 0;
      const end = startAngle + share * 2 * Math.PI;
      const slice = { d: buildArc(cx, cy, rInner, rOuter, startAngle, end), color: d.color, share, item: d };
      startAngle = end;
      return slice;
    });

    const hovered = piePaymentHovered !== null ? data[piePaymentHovered] : null;
    const centerVal = hovered ? hovered.amount : totalVal;
    const centerLabel = hovered ? hovered.label.split(' ')[0] : 'Payment';

    return (
      <svg width={220} height={220} viewBox="0 0 220 220">
        {slices.map((sl, i) => (
          <path
            key={i}
            d={sl.d}
            fill={sl.color}
            opacity={piePaymentHovered === null || piePaymentHovered === i ? 1 : 0.35}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
            onMouseEnter={() => setPiePaymentHovered(i)}
            onMouseLeave={() => setPiePaymentHovered(null)}
          />
        ))}
        {/* Centre text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" opacity="0.85">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
          {formatIndianCurrencyCompact(centerVal)}
        </text>
        {hovered && (
          <text x={cx} y={cy + 28} textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="Inter, sans-serif">
            {(slices[piePaymentHovered]?.share * 100).toFixed(1)}% share
          </text>
        )}
      </svg>
    );
  }

  return (
    <div className="ledger-view-root" style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
      {/* Ledger Main Content Section (Hidden completely when printing receipt) */}
      <div className="ledger-view-main-content no-print" style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
        {/* 1. TOP SUMMARY KPI CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Total Invoices */}
          <div
            style={{
              padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Orders
            </span>
            <Receipt size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {kpiSummary.orderCount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
            {kpiSummary.totalUnits.toLocaleString('en-IN')} total units billed
          </div>
        </div>

        {/* Gross Sales Turnover */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Net Sales Turnover
            </span>
            <Sparkles size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            ₹{kpiSummary.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Net revenue realized (returns deducted)
          </div>
        </div>

        {/* NET PROFIT KPI CARD */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: `1px solid ${kpiSummary.totalProfit >= 0 ? 'rgba(79, 70, 229, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            background: kpiSummary.totalProfit >= 0
              ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(79, 70, 229, 0.02) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: kpiSummary.totalProfit >= 0 ? '#4F46E5' : '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Gross Profit
            </span>
            <TrendingUp size={16} color={kpiSummary.totalProfit >= 0 ? '#4F46E5' : '#DC2626'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpiSummary.totalProfit >= 0 ? '#4F46E5' : '#DC2626', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            ₹{kpiSummary.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.70rem',
                background: kpiSummary.totalProfit >= 0 ? 'rgba(79, 70, 229, 0.14)' : 'rgba(239,68,68,0.14)',
                color: kpiSummary.totalProfit >= 0 ? '#4F46E5' : '#DC2626',
              }}
            >
              {kpiSummary.profitMargin.toFixed(1)}% margin
            </span>
            <span>on total turnover</span>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Avg Order Value
            </span>
            <ShoppingBag size={16} color="#7C3AED" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            ₹{kpiSummary.aov.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Average basket size per customer
          </div>
        </div>

        {/* Total Discounts */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Discounts Given
            </span>
            <Tag size={16} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            ₹{kpiSummary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
            VIP &amp; item promotional discounts
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH TOOLBAR (Placed above Cashier Breakdown & Orders Table) */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '16px',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Instant Search Box */}
          <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #64748B)',
              }}
            />
            <input
              type="text"
              placeholder="Search by invoice #, customer name, phone, cashier, or items..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input, #FFFFFF)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #0F172A)',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.80rem',
                padding: '8px 14px',
                height: '36px',
                cursor: 'pointer',
              }}
              title="Refresh Orders"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={totalCount === 0 || exportingCsv}
              className="btn btn-secondary"
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.80rem',
                padding: '8px 14px',
                height: '36px',
                cursor: totalCount === 0 ? 'not-allowed' : exportingCsv ? 'wait' : 'pointer',
                opacity: totalCount === 0 ? 0.5 : exportingCsv ? 0.85 : 1,
              }}
              title="Export filtered orders to CSV"
            >
              {exportingCsv ? (
                <>
                  <Loader2 size={12} className="animate-spin" style={{ flexShrink: 0 }} />
                  <span>
                    {exportProgress > 0 ? `Exporting (${exportProgress}%)...` : 'Exporting...'}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: '4px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: `${Math.max(10, Math.min(100, exportProgress || 15))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                        borderRadius: '2px',
                        transition: 'width 0.15s ease-out',
                      }}
                    />
                  </span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Export CSV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Universal Timeline Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Period:</span>
            <TimelineRangeSelector
              value={selectedTimelineRange}
              defaultUnit="month"
              defaultCount={1}
              allowAllTime={true}
              minDate={minDate}
              compact={true}
              chartType="pie_chart"
              showXAxis={false}
              onChange={(newRange) => {
                setSelectedTimelineRange(newRange);
                if (onTimelineRangeChange) {
                  onTimelineRangeChange(newRange);
                }
              }}
            />
          </div>

          {/* Payment Method Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Payment:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #FFFFFF)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #0F172A)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cashier Filter */}
          {cashierOptions.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Cashier:</span>
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>All Cashiers</option>
                {cashierOptions.map((c) => (
                  <option key={c} value={c} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #FFFFFF)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #0F172A)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>All Orders</option>
              <option value="completed" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Fully Paid / Completed Only</option>
              <option value="dues" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Pending Dues (Khata) Only</option>
              <option value="returned" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Returned / Refunds Only</option>
            </select>
          </div>

          {/* Section Filter */}
          {sectionOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Section:</span>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '160px',
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>All Sections</option>
                {sectionOptions.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          {categoryOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '170px',
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>All Categories</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Supplier Filter */}
          {supplierOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Supplier:</span>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '170px',
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>All Suppliers</option>
                {supplierOptions.map((sup) => (
                  <option key={sup.id} value={sup.id} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>
                    {sup.name || sup.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Product / Item UID Search Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Product / UID:</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Product name or UID..."
                value={productQuery}
                onChange={(e) => handleProductQueryChange(e.target.value)}
                style={{
                  padding: '6px 26px 6px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  width: '180px',
                }}
              />
              {productQuery && (
                <button
                  type="button"
                  onClick={() => handleProductQueryChange('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748B)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  title="Clear product search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #FFFFFF)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #0F172A)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="date_desc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Date: Newest First</option>
              <option value="date_asc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Date: Oldest First</option>
              <option value="amount_desc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Amount: High to Low</option>
              <option value="amount_asc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Amount: Low to High</option>
              <option value="invoice_desc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Invoice #: Descending</option>
              <option value="invoice_asc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Invoice #: Ascending</option>
              <option value="customer_asc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Customer: A to Z</option>
              <option value="due_desc" style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>Highest Balance Due</option>
            </select>
          </div>

          {/* Reset / Clear All Filters */}
          {(searchQuery || productQuery || paymentMethodFilter !== 'all' || cashierFilter !== 'all' || statusFilter !== 'all' || sectionFilter !== 'all' || categoryFilter !== 'all' || supplierFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedSearch('');
                setProductQuery('');
                setDebouncedProductQuery('');
                setPaymentMethodFilter('all');
                setCashierFilter('all');
                setStatusFilter('all');
                setSectionFilter('all');
                setCategoryFilter('all');
                setSupplierFilter('all');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: '#EF4444',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Reset all search queries and filters"
            >
              <X size={13} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* 1b. CASHIER PERFORMANCE SECTION (Pie Chart + Table) */}
      {cashierBreakdown.length > 0 && (
        <div
          style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <Users size={17} color="#4F46E5" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary, #0F172A)' }}>Cashier Performance Breakdown</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>Turnover &amp; profit attribution per staff member</div>
              </div>
            </div>
            {/* Metric Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-surface-hover, #F1F5F9)', borderRadius: '8px', padding: '3px', gap: '2px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
              {[{ id: 'revenue', label: 'Turnover' }, { id: 'profit', label: 'Profit' }].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPieMetric(m.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: pieMetric === m.id ? 'var(--card-bg, #FFFFFF)' : 'transparent',
                    color: pieMetric === m.id ? '#4F46E5' : 'var(--text-secondary, #64748B)',
                    boxShadow: pieMetric === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content: Pie + Table */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Donut Pie Chart */}
            {cashierBreakdown.length > 1 && (
              <div style={{ flexShrink: 0 }}>
                <CashierDonutChart data={cashierBreakdown} metric={pieMetric} />
              </div>
            )}

            {/* Cashier Table */}
            <div style={{ flex: 1, minWidth: '320px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', color: 'var(--text-muted, #64748B)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cashier</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Orders</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Turnover</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Margin</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Avg Order</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierBreakdown.map((c, i) => {
                    const margin  = c.turnover > 0 ? (c.profit / c.turnover) * 100 : 0;
                    const avgOrd  = c.orders > 0 ? c.turnover / c.orders : 0;
                    const color   = CASHIER_PALETTE[i % CASHIER_PALETTE.length];
                    const isHov   = pieCashierHovered === i;
                    return (
                      <tr
                        key={c.name}
                        onMouseEnter={() => setPieCashierHovered(i)}
                        onMouseLeave={() => setPieCashierHovered(null)}
                        style={{
                          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                          transition: 'background 0.15s ease',
                          background: isHov ? 'var(--bg-surface-hover, rgba(0,0,0,0.03))' : 'transparent',
                          cursor: 'default',
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>{c.orders}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                          ₹{c.turnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: c.profit >= 0 ? '#4F46E5' : '#DC2626', fontFamily: 'monospace' }}>
                          ₹{c.profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: margin >= 0 ? 'rgba(79, 70, 229, 0.12)' : 'rgba(239,68,68,0.12)',
                            color: margin >= 0 ? '#4F46E5' : '#DC2626',
                          }}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontFamily: 'monospace', fontWeight: 600 }}>
                          ₹{avgOrd.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-color, rgba(255,255,255,0.12))', background: 'var(--bg-surface-hover, rgba(0,0,0,0.02))' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary, #0F172A)', fontSize: '0.80rem' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary, #0F172A)' }}>{kpiSummary.orderCount}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                      ₹{kpiSummary.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: kpiSummary.totalProfit >= 0 ? '#4F46E5' : '#DC2626', fontFamily: 'monospace' }}>
                      ₹{kpiSummary.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: kpiSummary.profitMargin >= 0 ? 'rgba(79, 70, 229, 0.14)' : 'rgba(239,68,68,0.14)',
                        color: kpiSummary.profitMargin >= 0 ? '#4F46E5' : '#DC2626',
                      }}>
                        {kpiSummary.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontFamily: 'monospace', fontWeight: 600 }}>
                      ₹{kpiSummary.aov.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1c. METHOD OF PAYMENT BREAKDOWN SECTION (Pie Chart + Cashier Breakdown List/Table) */}
      {paymentMethodBreakdown.length > 0 && (
        <div
          style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                <Wallet size={17} color="#0284C7" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary, #0F172A)' }}>Payment Methods &amp; Cashier Settlement Breakdown</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>Distribution of collection channels (UPI, Cash, Cards) &amp; per-cashier payment breakdown</div>
              </div>
            </div>

            {/* Quick summary badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {paymentMethodBreakdown.map((pm) => {
                const share = paymentMethodTotals > 0 ? ((Math.max(0, pm.amount) / paymentMethodTotals) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={pm.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-hover, #F1F5F9)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      fontSize: '0.74rem',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: pm.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>{pm.label}:</span>
                    <span style={{ color: 'var(--text-primary, #0F172A)', fontWeight: 700, fontFamily: 'monospace' }}>₹{pm.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    <span style={{ color: pm.color, fontWeight: 800, fontSize: '0.68rem' }}>({share}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content: Pie Chart on Left + Cashier Payment Table on Right */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Donut Pie Chart for Payment Methods */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PaymentMethodDonutChart data={paymentMethodBreakdown} total={paymentMethodTotals} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', width: '100%', maxWidth: '220px' }}>
                {paymentMethodBreakdown.map((pm, idx) => {
                  const share = paymentMethodTotals > 0 ? ((Math.max(0, pm.amount) / paymentMethodTotals) * 100).toFixed(1) : '0';
                  const isHov = piePaymentHovered === idx;
                  return (
                    <div
                      key={pm.id}
                      onMouseEnter={() => setPiePaymentHovered(idx)}
                      onMouseLeave={() => setPiePaymentHovered(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isHov ? 'var(--bg-surface-hover, rgba(0,0,0,0.04))' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pm.color }} />
                        <span style={{ fontSize: '0.74rem', color: isHov ? 'var(--text-primary, #0F172A)' : 'var(--text-secondary, #475569)', fontWeight: isHov ? 700 : 500 }}>
                          {pm.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-primary, #0F172A)', fontWeight: 700, fontFamily: 'monospace' }}>
                          ₹{pm.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: pm.color, fontWeight: 700, minWidth: '34px', textAlign: 'right' }}>
                          {share}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cashier Payment Breakdown List & Table */}
            <div style={{ flex: 1, minWidth: '340px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', color: 'var(--text-muted, #64748B)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cashier</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Collected</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Banknote size={12} /> Cash (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#0284C7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <QrCode size={12} /> UPI / QR (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#4F46E5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CreditCard size={12} /> Card (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#DB2777', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Receipt size={12} /> Khata Due
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cashierPaymentBreakdown.map((cp, i) => {
                    const tot = cp.totalCollected > 0 ? cp.totalCollected : 0;
                    const cashPct = tot > 0 ? ((Math.max(0, cp.methods.cash) / tot) * 100).toFixed(1) : '0.0';
                    const upiPct  = tot > 0 ? ((Math.max(0, cp.methods.upi) / tot) * 100).toFixed(1) : '0.0';
                    const cardPct = tot > 0 ? ((Math.max(0, cp.methods.card) / tot) * 100).toFixed(1) : '0.0';
                    const color   = CASHIER_PALETTE[i % CASHIER_PALETTE.length];

                    return (
                      <tr
                        key={cp.name}
                        style={{
                          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                          transition: 'background 0.15s ease',
                          cursor: 'default',
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <div>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>{cp.name}</span>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)' }}>{cp.ordersCount} transactions</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary, #0F172A)', fontFamily: 'monospace' }}>
                          ₹{cp.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#059669' }}>
                            ₹{cp.methods.cash.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#059669', opacity: 0.85 }}>{cashPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#0284C7' }}>
                            ₹{cp.methods.upi.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#0284C7', opacity: 0.85 }}>{upiPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#4F46E5' }}>
                            ₹{cp.methods.card.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#4F46E5', opacity: 0.85 }}>{cardPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: cp.methods.due > 0 ? '#DB2777' : 'var(--text-muted, #64748B)' }}>
                            ₹{cp.methods.due.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Payment Breakdown Footer */}
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-color, rgba(255,255,255,0.12))', background: 'var(--bg-surface-hover, rgba(0,0,0,0.02))' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary, #0F172A)', fontSize: '0.80rem' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary, #0F172A)', fontFamily: 'monospace' }}>
                      ₹{paymentMethodTotals.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'cash')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0284C7', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'upi')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#4F46E5', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'card')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#DB2777', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'due')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. ORDERS TABLE LEDGER */}
      <div
        style={{
          borderRadius: '16px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.06))',
        }}
      >
        <div
          ref={tableContainerRef}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onMouseUp={handleTableMouseUp}
          onMouseLeave={handleTableMouseUp}
          className="ledger-table-scroll"
          style={{
            overflowX: 'auto',
            width: '100%',
            cursor: isDraggingTable ? 'grabbing' : 'grab',
            userSelect: isDraggingTable ? 'none' : 'auto',
            WebkitUserSelect: isDraggingTable ? 'none' : 'auto',
            scrollbarWidth: 'thin',
          }}
        >
          <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  backgroundColor: 'var(--bg-surface-hover, #F8FAFC)',
                  color: 'var(--text-muted, #64748B)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                <th
                  onClick={() => setSortBy(sortBy === 'invoice_asc' ? 'invoice_desc' : 'invoice_asc')}
                  style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                  title="Sort by Invoice Number"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Invoice / Bill #</span>
                    {sortBy === 'invoice_asc' ? <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> : sortBy === 'invoice_desc' ? <ChevronDown size={13} /> : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th
                  onClick={() => setSortBy(sortBy === 'date_desc' ? 'date_asc' : 'date_desc')}
                  style={{ padding: '12px 12px', cursor: 'pointer', userSelect: 'none' }}
                  title="Sort by Date"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Date &amp; Time</span>
                    {sortBy === 'date_desc' ? <ChevronDown size={13} /> : sortBy === 'date_asc' ? <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                {showBranchColumn && <th style={{ padding: '12px 12px' }}>Branch</th>}
                <th
                  onClick={() => setSortBy(sortBy === 'customer_asc' ? 'date_desc' : 'customer_asc')}
                  style={{ padding: '12px 12px', cursor: 'pointer', userSelect: 'none' }}
                  title="Sort by Customer Name"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Customer</span>
                    {sortBy === 'customer_asc' ? <ChevronDown size={13} /> : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ padding: '12px 12px' }}>Cashier / Shift</th>
                <th style={{ padding: '12px 12px' }}>Items Billed</th>
                <th style={{ padding: '12px 12px' }}>Payment Mode</th>
                <th style={{ padding: '12px 12px' }}>Status</th>
                <th
                  onClick={() => setSortBy(sortBy === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
                  style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  title="Sort by Total Amount"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                    <span>Total Amount</span>
                    {sortBy === 'amount_desc' ? <ChevronDown size={13} /> : sortBy === 'amount_asc' ? <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '120px', minWidth: '120px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showBranchColumn ? 10 : 9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Loading sales orders ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : totalCount === 0 ? (
                <tr>
                  <td colSpan={showBranchColumn ? 10 : 9} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-secondary, #94A3B8)' }}>
                        No invoices match the selected criteria.
                      </span>
                      <span style={{ fontSize: '0.78rem' }}>
                        Try clearing search query or adjusting the date range preset.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const dt = new Date(o.created_at);
                  const dStr = dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                  const tStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                  const itemsList = o.items || [];
                  const totalUnits = itemsList.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
                  const itemsPreview = itemsList.map((it) => `${it.quantity}x ${it.item_name || 'Item'}`).slice(0, 2).join(', ');
                  const hasMoreItems = itemsList.length > 2;

                  const isReturn = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');

                  // Payment mode color mapping
                  const pm = (o.payment_method || 'cash').toLowerCase();
                  const pmColor =
                    pm === 'cash' ? '#059669' :
                    pm === 'upi' ? '#0284C7' :
                    pm === 'card' ? '#4F46E5' :
                    pm === 'split' ? '#D97706' : '#64748B';

                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        if (!dragStartRef.current.hasDragged) {
                          setSelectedReceiptOrder(o);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, rgba(0, 0, 0, 0.03))')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Invoice # */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: isReturn ? '#DC2626' : '#0284C7',
                              fontSize: '0.86rem',
                            }}
                          >
                            {o.invoice_number || `#ORD-${o.id}`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => copyInvoiceNumber(o.invoice_number, e)}
                            title="Copy Invoice #"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedInvoice === o.invoice_number ? '#059669' : 'var(--text-muted, #64748B)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                          >
                            {copiedInvoice === o.invoice_number ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ color: 'var(--text-primary, #0F172A)', fontWeight: 600 }}>{dStr}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>{tStr}</div>
                      </td>

                      {/* Branch (Multi-Store / Combined View) */}
                      {showBranchColumn && (
                        <td style={{ padding: '12px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                              color: '#2563EB',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <StoreIcon size={12} />
                            {o.store_name || (stores.find(s => String(s.id) === String(o.store))?.name) || `Store #${o.store}`}
                          </span>
                        </td>
                      )}

                      {/* Customer */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #0F172A)' }}>
                          {o.customer_name || (o.customer_display_name && !o.customer_display_name.startsWith('Customer (') ? o.customer_display_name : '') || 'Walk-in Customer'}
                        </div>
                        {o.customer_phone && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={10} style={{ opacity: 0.7 }} />
                            <span>{o.customer_phone}</span>
                          </div>
                        )}
                        {o.customer_gst_number && (
                          <div
                            style={{
                              marginTop: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(79, 70, 229, 0.12)',
                              border: '1px solid rgba(79, 70, 229, 0.3)',
                              color: '#4F46E5',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                            title={`Customer GSTIN: ${o.customer_gst_number}`}
                          >
                            <span>GST: {o.customer_gst_number}</span>
                          </div>
                        )}
                        {o.notes && (
                          <div
                            style={{
                              marginTop: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: 'rgba(2, 132, 199, 0.12)',
                              border: '1px solid rgba(2, 132, 199, 0.28)',
                              color: '#0284C7',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              maxWidth: '220px',
                            }}
                            title={`Internal Remark: ${o.notes}`}
                          >
                            <FileText size={11} color="#0284C7" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {o.notes}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cashier */}
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary, #475569)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} style={{ opacity: 0.6 }} />
                          <span>{o.cashier_name || 'Counter Staff'}</span>
                        </div>
                      </td>

                      {/* Items Summary */}
                      <td style={{ padding: '12px 12px', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
                          {totalUnits} pcs ({itemsList.length} items)
                        </div>
                        <div
                          style={{
                            fontSize: '0.70rem',
                            color: 'var(--text-muted, #64748B)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={itemsList.map((it) => `${it.quantity}x ${it.item_name}`).join(', ')}
                        >
                          {itemsPreview}
                          {hasMoreItems && ` +${itemsList.length - 2} more`}
                        </div>
                      </td>

                      {/* Payment Mode */}
                      <td style={{ padding: '12px 12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? 'rgba(236, 72, 153, 0.15)' : `${pmColor}18`,
                            color: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? '#DB2777' : pmColor,
                            border: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? '1px solid rgba(236, 72, 153, 0.4)' : `1px solid ${pmColor}40`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {o.payment_method === 'split' ? (
                            <>
                              <Split size={11} /> Split (Cash+UPI)
                            </>
                          ) : o.payment_method === 'partial' || parseFloat(o.balance_due || 0) > 0 ? (
                            <>
                              <Receipt size={11} /> Partial / Due
                            </>
                          ) : (
                            o.payment_method || 'CASH'
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 12px' }}>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(236, 72, 153, 0.14)',
                              color: '#DB2777',
                              border: '1px solid rgba(236, 72, 153, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <AlertCircle size={10} />
                            <span>Due: ₹{parseFloat(o.balance_due).toFixed(2)}</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              backgroundColor: isReturn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: isReturn ? '#DC2626' : '#059669',
                              border: `1px solid ${isReturn ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isReturn ? <RotateCcw size={10} /> : <CheckCircle2 size={10} />}
                            <span>{isReturn ? 'Returned' : 'Completed'}</span>
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.94rem',
                            color: isReturn ? '#DC2626' : '#059669',
                          }}
                        >
                          ₹{Number(o.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <div style={{ fontSize: '0.68rem', color: '#DB2777', fontWeight: 700 }}>
                            Paid: ₹{parseFloat(o.amount_paid || 0).toFixed(2)} | Due: ₹{parseFloat(o.balance_due).toFixed(2)}
                          </div>
                        ) : parseFloat(o.discount_amount) > 0 ? (
                          <div style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 600 }}>
                            -₹{Number(o.discount_amount).toFixed(2)} discount
                          </div>
                        ) : null}
                      </td>

                      {/* Row Action (Collect Due if pending balance) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', width: '120px', minWidth: '120px' }}>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDueSettle(o, e)}
                            title={`Collect remaining due of ₹${parseFloat(o.balance_due).toFixed(2)}`}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              background: 'rgba(236, 72, 153, 0.15)',
                              border: '1px solid rgba(236, 72, 153, 0.4)',
                              color: '#DB2777',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <Wallet size={12} />
                            <span>Collect Due</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #475569)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info with pagination */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-surface-hover, #F8FAFC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Entry count & page size selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)' }}>
              Showing{' '}
              <strong style={{ color: 'var(--text-secondary, #475569)' }}>{ledgerStartEntry}–{ledgerEndEntry}</strong>
              {' '}of{' '}
              <strong style={{ color: 'var(--text-secondary, #475569)' }}>{filteredOrders.length.toLocaleString('en-IN')}</strong>
              {' '}orders · Click any row to view full invoice receipt.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748B)' }}>Rows per page:</span>
              <select
                value={ledgerPageSize}
                onChange={(e) => { setLedgerPageSize(Number(e.target.value)); setLedgerPage(1); }}
                style={{
                  height: '28px',
                  fontSize: '0.76rem',
                  padding: '0 6px',
                  minWidth: '70px',
                  borderRadius: '6px',
                  background: 'var(--card-bg, #FFFFFF)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  color: 'var(--text-primary, #0F172A)',
                  cursor: 'pointer',
                }}
              >
                {LEDGER_PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ backgroundColor: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #0F172A)' }}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Page navigation */}
          {filteredOrders.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setLedgerPage(1)}
                disabled={ledgerPage === 1}
                style={{
                  width: '28px', height: '28px', padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-secondary, #475569)',
                  cursor: ledgerPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage === 1 ? 0.4 : 1,
                }}
                title="First Page"
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                disabled={ledgerPage === 1}
                style={{
                  width: '28px', height: '28px', padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-secondary, #475569)',
                  cursor: ledgerPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage === 1 ? 0.4 : 1,
                }}
                title="Previous Page"
              >
                <ChevronLeft size={13} />
              </button>
              <span
                style={{
                  padding: '0 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #0F172A)',
                  minWidth: '80px',
                  textAlign: 'center',
                }}
              >
                Page {ledgerPage} / {ledgerTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                disabled={ledgerPage >= ledgerTotalPages}
                style={{
                  width: '28px', height: '28px', padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-secondary, #475569)',
                  cursor: ledgerPage >= ledgerTotalPages ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage >= ledgerTotalPages ? 0.4 : 1,
                }}
                title="Next Page"
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setLedgerPage(ledgerTotalPages)}
                disabled={ledgerPage >= ledgerTotalPages}
                style={{
                  width: '28px', height: '28px', padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-secondary, #475569)',
                  cursor: ledgerPage >= ledgerTotalPages ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage >= ledgerTotalPages ? 0.4 : 1,
                }}
                title="Last Page"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 4. EXACT 80MM BIXOLON SRP-330 POS THERMAL RECEIPT MODAL */}
      {selectedReceiptOrder && (
        <div
          className="receipt-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setSelectedReceiptOrder(null)}
        >
          <div
            className="receipt-modal-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '92vh',
              borderRadius: 'var(--radius-xl, 20px)',
              border: '1px solid #D1D5DB',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#FFFFFF',
              color: '#000000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Thermal Receipt Container matching exact 80mm Bixolon SRP-330 format (7.8cm - 8.0cm) */}
            <div
              id="printable-pos-receipt"
              style={{
                width: '100%',
                maxWidth: '340px',
                margin: '0 auto',
                padding: '12px 16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#000000',
                fontSize: '0.72rem',
                lineHeight: 1.35,
                boxSizing: 'border-box',
                overflowY: 'auto',
              }}
            >
              {(() => {
                const d = new Date(selectedReceiptOrder.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const dateStr = `${day}-${month}-${year}`;
                const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                const totalUnits = selectedReceiptOrder.items?.reduce((sum, it) => sum + it.quantity, 0) || selectedReceiptOrder.items?.length || 1;
                const totalMrp = selectedReceiptOrder.items?.reduce((sum, it) => {
                  const mrpVal = parseFloat(it.mrp || it.item_mrp || it.unit_mrp || it.unit_selling_price || 0);
                  return sum + mrpVal * it.quantity;
                }, 0) || parseFloat(selectedReceiptOrder.subtotal || 0);
                const totalSavings = Math.max(0, totalMrp - parseFloat(selectedReceiptOrder.total_amount || 0));
                const payMethod = (selectedReceiptOrder.payment_method || 'cash').toLowerCase();
                const totalAmtFormatted = parseFloat(selectedReceiptOrder.total_amount || 0).toFixed(2);
                const storeName = selectedReceiptOrder.store_details?.name || selectedReceiptOrder.store_name || '';
                const storeAddress = selectedReceiptOrder.store_details?.address || selectedReceiptOrder.store_address || '';
                const storePhone = selectedReceiptOrder.store_details?.phone || selectedReceiptOrder.store_phone || '';
                const storeGst = selectedReceiptOrder.store_details?.gst_number || selectedReceiptOrder.store_gst_number || '';

                const storeContactParts = [];
                if (storeAddress) storeContactParts.push(storeAddress);
                if (storePhone) storeContactParts.push(`M-${storePhone}`);
                const storeContactLine = storeContactParts.join('. ');

                const customerReceiptName = selectedReceiptOrder.customer_name || (selectedReceiptOrder.customer_display_name && !selectedReceiptOrder.customer_display_name.startsWith('Customer (') ? selectedReceiptOrder.customer_display_name : '') || '';
                const customerGstNumber = selectedReceiptOrder.customer_gst_number || '';
                const isReceiptReturn = Boolean(
                  selectedReceiptOrder.is_return ||
                  selectedReceiptOrder.invoice_number?.startsWith('RET-') ||
                  selectedReceiptOrder.return_reference ||
                  selectedReceiptOrder.status === 'refunded'
                );

                return (
                  <>
                    {/* Store Logo on Top & Tagline */}
                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                      <img
                        src="/assets/logo.svg"
                        alt="Wondersale Logo"
                        style={{ height: '62px', width: 'auto', objectFit: 'contain', margin: '0 auto 4px auto', display: 'block' }}
                      />
                      <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
                        WONDER SALE
                      </h2>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '2px', color: isReceiptReturn ? '#EF4444' : '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
                        {isReceiptReturn ? 'RETURN & REFUND VOUCHER' : 'FOR BETTER NATION'}
                      </div>
                    </div>

                    {/* Store Address & Contact */}
                    {storeContactLine ? (
                      <div style={{ textAlign: 'center', fontSize: '0.70rem', color: '#000000', paddingBottom: '6px', borderBottom: '1px dashed #000000', lineHeight: 1.35 }}>
                        <div>{storeContactLine}</div>
                      </div>
                    ) : (
                      <div style={{ borderBottom: '1px dashed #000000', marginBottom: '6px' }}></div>
                    )}

                    {/* Invoice Meta Grid */}
                    <div style={{ padding: '6px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', color: '#000000' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div><strong>{isReceiptReturn ? 'VOUCHER NO.' : 'INVOICE NO.'} {selectedReceiptOrder.invoice_number}</strong></div>
                          {isReceiptReturn && selectedReceiptOrder.return_reference && (
                            <div><strong>Original Bill:</strong> #{selectedReceiptOrder.return_reference}</div>
                          )}
                          <div>Name :- {customerReceiptName}</div>
                          <div>Mobile No: {selectedReceiptOrder.customer_phone || ''}</div>
                          {customerGstNumber ? (
                            <div>Customer GSTIN : {customerGstNumber}</div>
                          ) : null}
                          <div>GST NO : {storeGst}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                          <div>Date:{dateStr}</div>
                          <div>Time:{timeStr}</div>
                          <div style={{ textTransform: 'capitalize' }}>
                            {isReceiptReturn
                              ? 'Refund Mode'
                              : 'Payment mode'}- {
                                payMethod === 'split'
                                  ? 'Split (Cash + UPI)'
                                  : payMethod === 'vip_card' || payMethod === 'card'
                                  ? 'Card'
                                  : payMethod === 'partial'
                                  ? `Partial / Due (${(selectedReceiptOrder.initial_payment_method || 'Cash').toUpperCase()})`
                                  : (selectedReceiptOrder.payment_method || 'Cash')
                              }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table (Exact Physical Store Breakdown: Qty | MRP | Rate | Dis | Total) */}
                    <div style={{ padding: '4px 0', borderBottom: '1px dashed #000000' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px dashed #000000', color: '#000000', fontWeight: 800 }}>
                            <th style={{ width: '12%', textAlign: 'left', padding: '2px 0' }}>Qty</th>
                            <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>MRP</th>
                            <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>Rate</th>
                            <th style={{ width: '18%', textAlign: 'right', padding: '2px 0' }}>Dis</th>
                            <th style={{ width: '26%', textAlign: 'right', padding: '2px 0' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceiptOrder.items?.map((item, i) => {
                            const mrpVal = parseFloat(item.mrp || item.item_mrp || item.unit_mrp || item.unit_selling_price || 0);
                            const rateVal = parseFloat(item.unit_selling_price || 0);
                            const discountVal = Math.max(0, (mrpVal - rateVal) * item.quantity);
                            const lineTotal = parseFloat(item.total_price || (rateVal * item.quantity));
                            return (
                              <React.Fragment key={i}>
                                <tr>
                                  <td colSpan={5} style={{ paddingTop: '5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', lineHeight: 1.25 }}>
                                    {item.item_name}
                                    {(item.hsn_code_snapshot || item.hsn_code?.code) && (
                                      <span style={{ marginLeft: '6px', fontSize: '0.65rem', fontWeight: 600, color: '#4B5563', textTransform: 'none' }}>
                                        [HSN: {item.hsn_code_snapshot || item.hsn_code?.code}{item.hsn_gst_rate_snapshot ? ` @ ${item.hsn_gst_rate_snapshot}%` : ''}]
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: i < selectedReceiptOrder.items.length - 1 ? '1px dotted #E5E7EB' : 'none' }}>
                                  <td style={{ textAlign: 'left', padding: '2px 0 5px 0' }}>{item.quantity}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{mrpVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{rateVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{discountVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0', fontWeight: 800 }}>{lineTotal.toFixed(2)}</td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Side-by-Side: Payment Breakdown (Left) & Totals (Right) */}
                    <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.70rem', lineHeight: 1.45 }}>
                      {/* Left: Payment Mode Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#000000' }}>
                        <div>Cash : {payMethod === 'cash' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(selectedReceiptOrder.split_cash_amount || 0).toFixed(2) : (payMethod === 'partial' && (selectedReceiptOrder.initial_payment_method === 'cash' || !selectedReceiptOrder.initial_payment_method)) ? parseFloat(selectedReceiptOrder.amount_paid || 0).toFixed(2) : '0.00'}</div>
                        <div>Card : {payMethod === 'vip_card' || payMethod === 'card' ? totalAmtFormatted : (payMethod === 'partial' && selectedReceiptOrder.initial_payment_method === 'card') ? parseFloat(selectedReceiptOrder.amount_paid || 0).toFixed(2) : '0'}</div>
                        <div>UPI - {payMethod === 'upi' || payMethod === 'qr' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(selectedReceiptOrder.split_upi_amount || 0).toFixed(2) : (payMethod === 'partial' && selectedReceiptOrder.initial_payment_method === 'upi') ? parseFloat(selectedReceiptOrder.amount_paid || 0).toFixed(2) : '0'}</div>
                        {(payMethod === 'partial' || parseFloat(selectedReceiptOrder.balance_due || 0) > 0) && (
                          <div style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dotted #000000', fontWeight: 900, color: '#DC2626' }}>
                            DUE / KHATA: ₹{parseFloat(selectedReceiptOrder.balance_due || 0).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Right: Totals Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right', color: '#000000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                          <span>Total Qty :</span>
                          <strong>{totalUnits}</strong>
                        </div>
                        {totalSavings > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', color: '#DC2626', fontWeight: 800 }}>
                            <span>Total Saving :</span>
                            <span>{totalSavings.toFixed(totalSavings % 1 === 0 ? 0 : 2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                          <span>Total Amount :</span>
                          <span>{parseFloat(selectedReceiptOrder.subtotal || selectedReceiptOrder.total_amount).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', borderTop: '1px dashed #000000', paddingTop: '3px', marginTop: '2px' }}>
                          <span>Payable Amount :</span>
                          <span>{totalAmtFormatted}</span>
                        </div>
                        {(payMethod === 'partial' || parseFloat(selectedReceiptOrder.balance_due || 0) > 0) && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 800, color: '#059669' }}>
                              <span>Paid Amount :</span>
                              <span>₹{parseFloat(selectedReceiptOrder.amount_paid || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', color: '#DC2626', borderTop: '1px dotted #000000', paddingTop: '2px' }}>
                              <span>Balance Due :</span>
                              <span>₹{parseFloat(selectedReceiptOrder.balance_due || 0).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer Details & Cashier Info */}
                    <div style={{ paddingTop: '8px', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '2px', color: '#000000' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cashier Name - {selectedReceiptOrder.cashier_name || ''}</span>
                      </div>
                      {storeGst ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>GSTIN No - {storeGst}</span>
                        </div>
                      ) : null}
                      <div style={{ textAlign: 'center', marginTop: '10px', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.5px' }}>
                        THANK YOU AND VISIT AGAIN
                      </div>
                    </div>

                    {/* Terms & Conditions Section (Fixed Title + Configurable Clauses & Font Size) */}
                    {(() => {
                      const termsContent = getReceiptTermsText();
                      const termsFontSize = getReceiptTermsFontSize();
                      if (!termsContent) return null;
                      return (
                        <div
                          style={{
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #000000',
                            color: '#000000',
                          }}
                        >
                          <div
                            style={{
                              textAlign: 'center',
                              fontWeight: 900,
                              fontSize: '0.76rem',
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              marginBottom: '6px',
                            }}
                          >
                            TERMS &amp; CONDITIONS
                          </div>
                          <div
                            style={{
                              fontSize: termsFontSize,
                              textAlign: 'left',
                              lineHeight: 1.35,
                              color: '#111827',
                            }}
                          >
                            {renderFormattedTerms(termsContent)}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            {/* High-Contrast Receipt Action Controls */}
            <div
              className="no-print"
              style={{
                padding: '14px 18px',
                background: 'var(--card-bg, #FFFFFF)',
                borderTop: '1px solid var(--border-color, #E2E8F0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {selectedReceiptOrder.notes && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    color: 'var(--text-primary, #0F172A)',
                    fontSize: '0.74rem',
                  }}
                >
                  <FileText size={16} color="#0284C7" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Internal Sale Remark</span>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #64748B)', fontWeight: 500 }}>(Not on printed bill)</span>
                    </div>
                    <div style={{ color: 'var(--text-primary, #0F172A)', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.35, fontWeight: 500 }}>
                      {selectedReceiptOrder.notes}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(selectedReceiptOrder, false)}
                  disabled={isSendingWhatsApp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#25D366',
                    border: '1px solid #1EBE5D',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease',
                    opacity: isSendingWhatsApp ? 0.75 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSendingWhatsApp) e.currentTarget.style.background = '#1EBE5D';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSendingWhatsApp) e.currentTarget.style.background = '#25D366';
                  }}
                >
                  <WhatsAppIcon size={16} color="#FFFFFF" />
                  <span>{isSendingWhatsApp ? 'Sending...' : 'Send via WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#3B82F6',
                    border: '1px solid #2563EB',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  <Printer size={15} />
                  <span>Print 80mm</span>
                </button>
              </div>

              {/* Force Send Option (Appears when standard send is blocked by cooldown) */}
              {waCooldownActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '8px 12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#FBBF24', flex: 1, lineHeight: 1.3 }}>
                    ⏳ <strong>Cooldown active:</strong> Order was recently sent. Need to bypass cooldown?
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(selectedReceiptOrder, true)}
                    disabled={isSendingWhatsApp}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: '#F59E0B',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Force Send
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSaveAsPdf(selectedReceiptOrder)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#60A5FA',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)')}
                  title="Save receipt as a PDF file"
                >
                  <FileDown size={14} />
                  <span>Save as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReceiptOrder(null)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-secondary, #94A3B8)',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECT DUE / KHATA PAYMENT MODAL ────────────────────────── */}
      {isDueSettleModalOpen && selectedDueOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => {
            if (!isSubmittingDueSettle) setIsDueSettleModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--bg-surface-hover, #F8FAFC)',
                borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    background: 'rgba(236,72,153,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(236,72,153,0.3)',
                  }}
                >
                  <Receipt size={17} color="#DB2777" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0F172A)' }}>
                    Collect Due Payment · {selectedDueOrder.invoice_number || `#ORD-${selectedDueOrder.id}`}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748B)', marginTop: 2 }}>
                    Debtor: <strong style={{ color: 'var(--text-primary, #0F172A)' }}>{selectedDueOrder.customer_name || selectedDueOrder.customer_display_name || 'Customer'}</strong>
                    {selectedDueOrder.customer_phone && ` (${selectedDueOrder.customer_phone})`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDueSettleModalOpen(false)}
                disabled={isSubmittingDueSettle}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #64748B)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Bill Summary Banner */}
            <div
              style={{
                padding: '14px 20px',
                background: 'rgba(236,72,153,0.06)',
                borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '8px', background: 'var(--card-bg, #FFFFFF)', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Total Bill
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #0F172A)', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.total_amount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'var(--card-bg, #FFFFFF)', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Paid Earlier
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.amount_paid || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'rgba(236,72,153,0.12)', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.3)' }}>
                <span style={{ fontSize: '10.5px', color: '#DB2777', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                  Remaining Due
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#DB2777', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Settle Form */}
            <form onSubmit={handleConfirmDueSettle} style={{ padding: '18px 20px' }}>
              {dueSettleError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#DC2626', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleError}
                </div>
              )}
              {dueSettleSuccess && (
                <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#059669', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleSuccess}
                </div>
              )}

              {/* Amount to Collect Input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                    Amount Being Collected Today (₹) <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String(parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.35)', color: '#DB2777', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Pay Full (₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String((parseFloat(selectedDueOrder.balance_due || 0) / 2).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-surface-hover, #F1F5F9)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', color: 'var(--text-secondary, #475569)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      50% (₹{(parseFloat(selectedDueOrder.balance_due || 0) / 2).toFixed(2)})
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(selectedDueOrder.balance_due || 0)}
                  value={dueSettleAmount}
                  onChange={(e) => setDueSettleAmount(e.target.value)}
                  placeholder="Enter amount..."
                  required
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-input, #FFFFFF)',
                    color: 'var(--text-primary, #0F172A)',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Settlement Payment Method */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Payment Method Collected Via <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote, sub: "Drawer Cash" },
                    { id: 'upi', label: 'UPI / QR', icon: QrCode, sub: "Online Bank" },
                    { id: 'card', label: 'Card', icon: CreditCard, sub: "POS Swipe" },
                  ].map((pm) => {
                    const Icon = pm.icon;
                    const isSel = dueSettleMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setDueSettleMethod(pm.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: isSel ? '1px solid #DB2777' : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                          background: isSel ? 'rgba(236,72,153,0.14)' : 'var(--bg-surface-hover, #F8FAFC)',
                          color: isSel ? '#DB2777' : 'var(--text-secondary, #475569)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={16} />
                        <span style={{ fontSize: '12px', fontWeight: isSel ? 700 : 500 }}>{pm.label}</span>
                        <span style={{ fontSize: '9.5px', opacity: 0.7 }}>{pm.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Verified Verification Remark / Notes */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Verification Remark / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received at counter, GPay transaction #, verified by manager..."
                  value={dueSettleNotes}
                  onChange={(e) => setDueSettleNotes(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-input, #FFFFFF)',
                    color: 'var(--text-primary, #0F172A)',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Real-Time Shift & Accounting Notice */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-hover, #F1F5F9)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748B)',
                  lineHeight: 1.45,
                  marginBottom: 18,
                }}
              >
                ℹ️ <strong>Accounting Integration:</strong> This payment will be settled into today's account records. {dueSettleMethod === 'cash' ? "Because Cash was selected, this amount is directly added to today's active register shift cash drawer reconciliation." : "Bank/UPI settlements are credited directly to digital accounting registers."}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsDueSettleModalOpen(false)}
                  disabled={isSubmittingDueSettle}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary, #475569)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDueSettle}
                  style={{
                    height: 36,
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: '1px solid #DB2777',
                    background: '#DB2777',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: isSubmittingDueSettle ? 0.7 : 1,
                  }}
                >
                  <Check size={14} />
                  <span>{isSubmittingDueSettle ? 'Recording Settlement…' : 'Confirm & Collect Due'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
