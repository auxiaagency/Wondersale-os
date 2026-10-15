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
import { getSaleOrders, recordOrderDuePayment } from '../api';
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'returned'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

  // Receipt Modal State
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [copiedInvoice, setCopiedInvoice] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Pagination
  const LEDGER_PAGE_SIZE_OPTIONS = [50, 100, 250, 500, 1000];
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(100);

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

  // Fetch all orders for current active store
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (activeStoreId) {
        params.store = activeStoreId;
      }

      // Fetch from API
      const data = await getSaleOrders(params);
      const list = Array.isArray(data) ? data : data?.results || [];
      setOrders(list);
    } catch (err) {
      console.error('Failed to load sales orders:', err);
      setError('Unable to load orders. Please check your network connection.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Synchronize date filter with Master Timeline Range if provided
  useEffect(() => {
    if (timelineRange) {
      setSelectedTimelineRange(timelineRange);
    }
  }, [timelineRange]);

  // Unique cashiers from loaded orders for cashier filter dropdown
  const cashierOptions = useMemo(() => {
    const set = new Map();
    orders.forEach((o) => {
      const name = o.cashier_name || (o.cashier ? `Staff #${o.cashier}` : null);
      if (name && !set.has(name)) {
        set.set(name, name);
      }
    });
    return Array.from(set.values());
  }, [orders]);

  // Date boundary calculation based on selectedTimelineRange
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

  // Filtered and Sorted Orders List
  const filteredOrders = useMemo(() => {
    let list = [...orders];

    // 1. Text Search Filter (Invoice, Customer Name, Phone, Cashier)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o) => {
        const inv = (o.invoice_number || '').toLowerCase();
        const cName = (o.customer_name || o.customer_display_name || '').toLowerCase();
        const cPhone = (o.customer_phone || '').toLowerCase();
        const cashName = (o.cashier_name || '').toLowerCase();
        const itemNames = (o.items || []).map((it) => (it.item_name || '').toLowerCase()).join(' ');
        const notes = (o.notes || '').toLowerCase();

        return (
          inv.includes(q) ||
          cName.includes(q) ||
          cPhone.includes(q) ||
          cashName.includes(q) ||
          itemNames.includes(q) ||
          notes.includes(q)
        );
      });
    }

    // 2. Date Boundary Filter
    if (dateRangeBounds.start || dateRangeBounds.end) {
      list = list.filter((o) => {
        const d = (o.created_at || '').split('T')[0];
        if (!d) return true;
        if (dateRangeBounds.start && d < dateRangeBounds.start) return false;
        if (dateRangeBounds.end && d > dateRangeBounds.end) return false;
        return true;
      });
    }

    // 3. Payment Method Filter
    if (paymentMethodFilter !== 'all') {
      if (paymentMethodFilter === 'partial') {
        list = list.filter((o) => (o.payment_method || '').toLowerCase() === 'partial' || parseFloat(o.balance_due || 0) > 0);
      } else {
        list = list.filter((o) => (o.payment_method || '').toLowerCase() === paymentMethodFilter.toLowerCase());
      }
    }

    // 4. Cashier Filter
    if (cashierFilter !== 'all') {
      list = list.filter((o) => (o.cashier_name || '') === cashierFilter);
    }

    // 5. Order Status Filter
    if (statusFilter === 'completed') {
      list = list.filter((o) => o.status === 'completed' && !o.is_return && (!o.balance_due || parseFloat(o.balance_due) <= 0));
    } else if (statusFilter === 'returned') {
      list = list.filter((o) => o.status === 'returned' || o.is_return || (o.invoice_number || '').startsWith('RET-'));
    } else if (statusFilter === 'dues') {
      list = list.filter((o) => parseFloat(o.balance_due || 0) > 0 || o.payment_method === 'partial');
    }

    // 6. Sorting
    list.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === 'amount_desc') {
        return (parseFloat(b.total_amount) || 0) - (parseFloat(a.total_amount) || 0);
      }
      if (sortBy === 'amount_asc') {
        return (parseFloat(a.total_amount) || 0) - (parseFloat(b.total_amount) || 0);
      }
      return 0;
    });

    return list;
  }, [orders, searchQuery, dateRangeBounds, paymentMethodFilter, cashierFilter, statusFilter, sortBy]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setLedgerPage(1);
  }, [filteredOrders]);

  // Paginated slice of filteredOrders for the table only
  const paginatedOrders = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPageSize;
    return filteredOrders.slice(start, start + ledgerPageSize);
  }, [filteredOrders, ledgerPage, ledgerPageSize]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ledgerPageSize));
  const ledgerStartEntry = filteredOrders.length === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize + 1;
  const ledgerEndEntry = Math.min(ledgerPage * ledgerPageSize, filteredOrders.length);

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

  // Financial KPIs over filtered set (Returns correctly deducted to reflect Net Sales Turnover)
  const kpiSummary = useMemo(() => {
    let grossTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalUnits = 0;
    let totalProfit = 0;
    let salesCount = 0;
    let returnsCount = 0;

    filteredOrders.forEach((o) => {
      const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
      const amt = parseFloat(o.total_amount) || 0;
      const profit = computeOrderProfit(o);
      const itemsCount = (o.items || []).reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);

      if (isRet) {
        grossTotal -= amt; // Returns deduct from sales turnover
        returnsCount += 1;
        totalUnits -= itemsCount;
      } else {
        grossTotal += amt;
        salesCount += 1;
        totalUnits += itemsCount;
        totalDiscount += parseFloat(o.discount_amount) || 0;
        totalTax += parseFloat(o.tax_amount) || 0;
      }

      totalProfit += profit;
    });

    const netUnits = Math.max(0, totalUnits);
    // AOV calculated across sales orders, or filtered orders if only returns
    const aovOrdersCount = salesCount > 0 ? salesCount : (filteredOrders.length || 1);
    const aov = grossTotal > 0 && aovOrdersCount > 0 ? grossTotal / aovOrdersCount : 0;
    const profitMargin = grossTotal > 0 ? (totalProfit / grossTotal) * 100 : 0;

    return {
      orderCount: filteredOrders.length,
      salesCount,
      returnsCount,
      grossTotal: Math.round(grossTotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalUnits: netUnits,
      aov: Math.round(aov * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
    };
  }, [filteredOrders, computeOrderProfit]);

  // ─── Per-cashier breakdown ──────────────────────────────────────────────────
  const cashierBreakdown = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const name = o.cashier_name || 'Counter Staff';
      if (!map[name]) {
        map[name] = { name, turnover: 0, profit: 0, orders: 0, units: 0 };
      }
      const isRet = o.is_return || o.status === 'returned' || (o.invoice_number || '').startsWith('RET-');
      // Returns subtract from turnover
      const amt = parseFloat(o.total_amount) || 0;
      map[name].turnover += isRet ? -amt : amt;
      map[name].profit   += computeOrderProfit(o);
      map[name].orders   += 1;
      (o.items || []).forEach((it) => {
        map[name].units += parseInt(it.quantity, 10) || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.turnover - a.turnover);
  }, [filteredOrders, computeOrderProfit]);

  // ─── Per-payment-method breakdown & Cashier payment attribution ─────────────
  const PAYMENT_METHOD_CONFIG = useMemo(() => ({
    cash: { label: 'Cash', color: '#10B981', icon: Banknote },
    upi: { label: 'UPI / QR', color: '#38BDF8', icon: QrCode },
    card: { label: 'Card / VIP Card', color: '#818CF8', icon: CreditCard },
    due: { label: 'Pending Dues (Khata)', color: '#EC4899', icon: Receipt },
    other: { label: 'Other / Credit', color: '#F59E0B', icon: Tag },
  }), []);

  const { paymentMethodBreakdown, cashierPaymentBreakdown, paymentMethodTotals } = useMemo(() => {
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

      // Track order count for cashier
      cashierMap[cName].ordersCount += 1;

      // Calculate component breakdown
      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let dueAmt = 0;
      let otherAmt = 0;

      if (rawMethod === 'split') {
        cashAmt = (parseFloat(o.split_cash_amount) || 0) * sign;
        upiAmt = (parseFloat(o.split_upi_amount) || 0) * sign;
        // If split values are empty or sum is less than total, allocate remainder to upi or cash
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

      // Aggregate into payment breakdown
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
  }, [filteredOrders]);

  // Pie chart hover states
  const [pieCashierHovered, setPieCashierHovered] = useState(null);
  const [pieMetric, setPieMetric] = useState('revenue'); // 'revenue' | 'profit'
  const [piePaymentHovered, setPiePaymentHovered] = useState(null);

  // Export to CSV (Enhanced with Profit, Cost, Cashier Summary, and Payment Method Attributions)
  const handleExportCsv = () => {
    if (filteredOrders.length === 0 || exportingCsv) return;
    setExportingCsv(true);
    setExportProgress(15);

    const progressTimer = setInterval(() => {
      setExportProgress((prev) => {
        if (prev < 50) return prev + 15;
        if (prev < 85) return prev + 8;
        return prev;
      });
    }, 70);

    setTimeout(() => {
      try {
        // ── Section 1: Order-level ledger ──
    const headers = [
      'Invoice Number',
      'Date',
      'Time',
      'Customer Name',
      'Customer Phone',
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

    const rows = filteredOrders.map((o) => {
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

    // ── Section 2: Summary row ──
    const summaryRows = [
      [],
      ['=== SUMMARY ==='],
      [`"Total Orders & Vouchers"`, kpiSummary.orderCount],
      [`"Completed Sales"`, kpiSummary.salesCount],
      [`"Return Vouchers"`, kpiSummary.returnsCount],
      [`"Net Sales Turnover"`, kpiSummary.grossTotal.toFixed(2)],
      [`"Total Gross Profit"`, kpiSummary.totalProfit.toFixed(2)],
      [`"Overall Profit Margin"`, kpiSummary.profitMargin.toFixed(1) + '%'],
      [`"Total Discounts Given"`, kpiSummary.totalDiscount.toFixed(2)],
      [`"Total Units Sold"`, kpiSummary.totalUnits],
      [`"Average Order Value"`, kpiSummary.aov.toFixed(2)],
      [],
      ['=== CASHIER OVERALL PERFORMANCE ==='],
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
      ['=== PAYMENT METHOD BREAKDOWN (OVERALL) ==='],
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
      ['=== CASHIER PAYMENT METHOD BREAKDOWN (CASH & UPI ATTRIBUTION) ==='],
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
    a.download = `sales_ledger_with_profit_${new Date().toISOString().split('T')[0]}.csv`;
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
    }, 50);
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
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" opacity="0.7">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
          ₹{centerVal >= 1000 ? (centerVal / 1000).toFixed(1) + 'k' : centerVal.toFixed(0)}
        </text>
        {hovered && (
          <text x={cx} y={cy + 28} textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="Inter, sans-serif">
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
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" opacity="0.7">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
          ₹{centerVal >= 1000 ? (centerVal / 1000).toFixed(1) + 'k' : centerVal.toFixed(0)}
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
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Orders
            </span>
            <Receipt size={16} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Net Sales Turnover
            </span>
            <Sparkles size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34D399', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            ₹{kpiSummary.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Net revenue realized (returns deducted)
          </div>
        </div>

        {/* NET PROFIT KPI CARD (NEW) */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: `1px solid ${kpiSummary.totalProfit >= 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(239, 68, 68, 0.3)'}`,
            background: kpiSummary.totalProfit >= 0
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.02) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.09) 0%, rgba(239,68,68,0.02) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: kpiSummary.totalProfit >= 0 ? '#818CF8' : '#F87171', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Gross Profit
            </span>
            <TrendingUp size={16} color={kpiSummary.totalProfit >= 0 ? '#818CF8' : '#F87171'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpiSummary.totalProfit >= 0 ? '#A5B4FC' : '#FCA5A5', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
                background: kpiSummary.totalProfit >= 0 ? 'rgba(99,102,241,0.18)' : 'rgba(239,68,68,0.15)',
                color: kpiSummary.totalProfit >= 0 ? '#A5B4FC' : '#FCA5A5',
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
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Avg Order Value
            </span>
            <ShoppingBag size={16} color="#A78BFA" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#C4B5FD', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Discounts Given
            </span>
            <Tag size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
          backgroundColor: 'var(--bg-surface-solid, #161B2C)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
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
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-main, #0B0E17)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
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
              disabled={filteredOrders.length === 0 || exportingCsv}
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
                cursor: filteredOrders.length === 0 ? 'not-allowed' : exportingCsv ? 'wait' : 'pointer',
                opacity: filteredOrders.length === 0 ? 0.5 : exportingCsv ? 0.85 : 1,
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
                backgroundColor: 'var(--bg-main, #0B0E17)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id} style={{ backgroundColor: 'var(--bg-surface)' }}>
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
                  backgroundColor: 'var(--bg-main, #0B0E17)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--bg-surface)' }}>All Cashiers</option>
                {cashierOptions.map((c) => (
                  <option key={c} value={c} style={{ backgroundColor: 'var(--bg-surface)' }}>
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
                backgroundColor: 'var(--bg-main, #0B0E17)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ backgroundColor: 'var(--bg-surface)' }}>All Orders</option>
              <option value="completed" style={{ backgroundColor: 'var(--bg-surface)' }}>Fully Paid / Completed Only</option>
              <option value="dues" style={{ backgroundColor: 'var(--bg-surface)' }}>Pending Dues (Khata) Only</option>
              <option value="returned" style={{ backgroundColor: 'var(--bg-surface)' }}>Returned / Refunds Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1b. CASHIER PERFORMANCE SECTION (Pie Chart + Table) */}
      {cashierBreakdown.length > 0 && (
        <div
          style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(129,140,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(129,140,248,0.3)' }}>
                <Users size={17} color="#818CF8" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary, #F8FAFC)' }}>Cashier Performance Breakdown</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>Turnover &amp; profit attribution per staff member</div>
              </div>
            </div>
            {/* Metric Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-main, #0B0E17)', borderRadius: '8px', padding: '3px', gap: '2px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
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
                    background: pieMetric === m.id ? 'rgba(129,140,248,0.25)' : 'transparent',
                    color: pieMetric === m.id ? '#A5B4FC' : 'var(--text-muted, #94A3B8)',
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
                  <tr style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', color: 'var(--text-muted, #94A3B8)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                          transition: 'background 0.15s ease',
                          background: isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
                          cursor: 'default',
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>{c.orders}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>
                          ₹{c.turnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: c.profit >= 0 ? '#A5B4FC' : '#FCA5A5', fontFamily: 'monospace' }}>
                          ₹{c.profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: margin >= 0 ? 'rgba(99,102,241,0.15)' : 'rgba(239,68,68,0.13)',
                            color: margin >= 0 ? '#A5B4FC' : '#FCA5A5',
                          }}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary, #94A3B8)', fontFamily: 'monospace', fontWeight: 600 }}>
                          ₹{avgOrd.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.12))', background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', fontSize: '0.80rem' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>{kpiSummary.orderCount}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>
                      ₹{kpiSummary.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: kpiSummary.totalProfit >= 0 ? '#A5B4FC' : '#FCA5A5', fontFamily: 'monospace' }}>
                      ₹{kpiSummary.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: kpiSummary.profitMargin >= 0 ? 'rgba(99,102,241,0.18)' : 'rgba(239,68,68,0.15)',
                        color: kpiSummary.profitMargin >= 0 ? '#A5B4FC' : '#FCA5A5',
                      }}>
                        {kpiSummary.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary, #94A3B8)', fontFamily: 'monospace', fontWeight: 600 }}>
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
            backgroundColor: 'var(--bg-surface-solid, #161B2C)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(56,189,248,0.3)' }}>
                <Wallet size={17} color="#38BDF8" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary, #F8FAFC)' }}>Payment Methods &amp; Cashier Settlement Breakdown</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>Distribution of collection channels (UPI, Cash, Cards) &amp; per-cashier payment breakdown</div>
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
                      backgroundColor: 'var(--bg-main, #0B0E17)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                      fontSize: '0.74rem',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: pm.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>{pm.label}:</span>
                    <span style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 700, fontFamily: 'monospace' }}>₹{pm.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
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
                        backgroundColor: isHov ? 'rgba(255,255,255,0.06)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pm.color }} />
                        <span style={{ fontSize: '0.74rem', color: isHov ? '#F8FAFC' : 'var(--text-secondary, #94A3B8)', fontWeight: isHov ? 700 : 500 }}>
                          {pm.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: '#F8FAFC', fontWeight: 700, fontFamily: 'monospace' }}>
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
                  <tr style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', color: 'var(--text-muted, #94A3B8)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cashier</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Collected</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Banknote size={12} /> Cash (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#38BDF8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <QrCode size={12} /> UPI / QR (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#818CF8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CreditCard size={12} /> Card (₹ / %)
                      </span>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ color: '#EC4899', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                          transition: 'background 0.15s ease',
                          cursor: 'default',
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <div>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>{cp.name}</span>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>{cp.ordersCount} transactions</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace' }}>
                          ₹{cp.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#10B981' }}>
                            ₹{cp.methods.cash.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#10B981', opacity: 0.85 }}>{cashPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#38BDF8' }}>
                            ₹{cp.methods.upi.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#38BDF8', opacity: 0.85 }}>{upiPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: '#818CF8' }}>
                            ₹{cp.methods.card.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#818CF8', opacity: 0.85 }}>{cardPct}%</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: cp.methods.due > 0 ? '#EC4899' : 'var(--text-muted, #64748B)' }}>
                            ₹{cp.methods.due.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Payment Breakdown Footer */}
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.12))', background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', fontSize: '0.80rem' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace' }}>
                      ₹{paymentMethodTotals.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'cash')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#38BDF8', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'upi')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#818CF8', fontFamily: 'monospace' }}>
                      ₹{(paymentMethodBreakdown.find((p) => p.id === 'card')?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#EC4899', fontFamily: 'monospace' }}>
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
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--bg-surface-solid, #161B2C)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.15))',
        }}
      >
        <div
          ref={tableContainerRef}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onMouseUp={handleTableMouseUp}
          onMouseLeave={handleTableMouseUp}
          style={{
            overflowX: 'auto',
            cursor: isDraggingTable ? 'grabbing' : 'grab',
            userSelect: isDraggingTable ? 'none' : 'auto',
            WebkitUserSelect: isDraggingTable ? 'none' : 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left', minWidth: '1100px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  backgroundColor: 'var(--bg-main, #0B0E17)',
                  color: 'var(--text-muted, #94A3B8)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '14px 18px' }}>Invoice / Bill #</th>
                <th style={{ padding: '14px 18px' }}>Date &amp; Time</th>
                {showBranchColumn && <th style={{ padding: '14px 18px' }}>Branch</th>}
                <th style={{ padding: '14px 18px' }}>Customer</th>
                <th style={{ padding: '14px 18px' }}>Cashier / Shift</th>
                <th style={{ padding: '14px 18px' }}>Items Billed</th>
                <th style={{ padding: '14px 18px' }}>Payment Mode</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '14px 18px', textAlign: 'center' }}>Action</th>
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
              ) : filteredOrders.length === 0 ? (
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
                    pm === 'cash' ? '#10B981' :
                    pm === 'upi' ? '#38BDF8' :
                    pm === 'card' ? '#818CF8' :
                    pm === 'split' ? '#F59E0B' : '#94A3B8';

                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        if (!dragStartRef.current.hasDragged) {
                          setSelectedReceiptOrder(o);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Invoice # */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: isReturn ? '#F87171' : '#38BDF8',
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
                              color: copiedInvoice === o.invoice_number ? '#34D399' : 'var(--text-muted, #64748B)',
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
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>{dStr}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>{tStr}</div>
                      </td>

                      {/* Branch (Multi-Store / Combined View) */}
                      {showBranchColumn && (
                        <td style={{ padding: '14px 18px' }}>
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
                              color: '#60A5FA',
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
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
                          {o.customer_name || (o.customer_display_name && !o.customer_display_name.startsWith('Customer (') ? o.customer_display_name : '') || 'Walk-in Customer'}
                        </div>
                        {o.customer_phone && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={10} style={{ opacity: 0.7 }} />
                            <span>{o.customer_phone}</span>
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
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.28)',
                              color: '#38BDF8',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              maxWidth: '220px',
                            }}
                            title={`Internal Remark: ${o.notes}`}
                          >
                            <FileText size={11} color="#38BDF8" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {o.notes}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cashier */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary, #94A3B8)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} style={{ opacity: 0.6 }} />
                          <span>{o.cashier_name || 'Counter Staff'}</span>
                        </div>
                      </td>

                      {/* Items Summary */}
                      <td style={{ padding: '14px 18px', maxWidth: '240px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
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
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? 'rgba(236, 72, 153, 0.15)' : `${pmColor}18`,
                            color: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? '#EC4899' : pmColor,
                            border: pm === 'partial' || parseFloat(o.balance_due || 0) > 0 ? '1px solid rgba(236, 72, 153, 0.4)' : `1px solid ${pmColor}40`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
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
                      <td style={{ padding: '14px 18px' }}>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(236, 72, 153, 0.14)',
                              color: '#EC4899',
                              border: '1px solid rgba(236, 72, 153, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
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
                              color: isReturn ? '#F87171' : '#34D399',
                              border: `1px solid ${isReturn ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isReturn ? <RotateCcw size={10} /> : <CheckCircle2 size={10} />}
                            <span>{isReturn ? 'Returned' : 'Completed'}</span>
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.94rem',
                            color: isReturn ? '#F87171' : '#34D399',
                          }}
                        >
                          ₹{Number(o.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <div style={{ fontSize: '0.68rem', color: '#EC4899', fontWeight: 700 }}>
                            Paid: ₹{parseFloat(o.amount_paid || 0).toFixed(2)} | Due: ₹{parseFloat(o.balance_due).toFixed(2)}
                          </div>
                        ) : parseFloat(o.discount_amount) > 0 ? (
                          <div style={{ fontSize: '0.68rem', color: '#FBBF24' }}>
                            -₹{Number(o.discount_amount).toFixed(2)} discount
                          </div>
                        ) : null}
                      </td>

                      {/* Row Action (Collect Due if pending balance) */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {parseFloat(o.balance_due || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDueSettle(o, e)}
                            title={`Collect remaining due of ₹${parseFloat(o.balance_due).toFixed(2)}`}
                            style={{
                              padding: '5px 9px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(236, 72, 153, 0.15)',
                              border: '1px solid rgba(236, 72, 153, 0.4)',
                              color: '#EC4899',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
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
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-main, #0B0E17)',
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
              <strong style={{ color: 'var(--text-secondary, #94A3B8)' }}>{ledgerStartEntry}–{ledgerEndEntry}</strong>
              {' '}of{' '}
              <strong style={{ color: 'var(--text-secondary, #94A3B8)' }}>{filteredOrders.length.toLocaleString('en-IN')}</strong>
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
                  background: 'var(--bg-surface, #161B2C)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  color: 'var(--text-primary, #F8FAFC)',
                  cursor: 'pointer',
                }}
              >
                {LEDGER_PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
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
                  borderRadius: '6px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, #161B2C)', color: 'var(--text-secondary, #94A3B8)',
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
                  borderRadius: '6px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, #161B2C)', color: 'var(--text-secondary, #94A3B8)',
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
                  color: 'var(--text-primary, #F8FAFC)',
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
                  borderRadius: '6px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, #161B2C)', color: 'var(--text-secondary, #94A3B8)',
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
                  borderRadius: '6px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, #161B2C)', color: 'var(--text-secondary, #94A3B8)',
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

                const customerDisplayName = selectedReceiptOrder.customer_name || (selectedReceiptOrder.customer_display_name && !selectedReceiptOrder.customer_display_name.startsWith('Customer (') ? selectedReceiptOrder.customer_display_name : '') || 'Dear Customer';
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
                          <div>Name :- {customerDisplayName}</div>
                          <div>Mobile No: {selectedReceiptOrder.customer_phone || ''}</div>
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
                background: 'var(--bg-surface-solid, #161B2C)',
                borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
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
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: '0.74rem',
                  }}
                >
                  <FileText size={16} color="#38BDF8" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Internal Sale Remark</span>
                      <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 500 }}>(Not on printed bill)</span>
                    </div>
                    <div style={{ color: '#E2E8F0', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.35 }}>
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
              background: 'var(--bg-surface-solid, #161B2C)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--bg-main, #0B0E17)',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
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
                  <Receipt size={17} color="#EC4899" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #F8FAFC)' }}>
                    Collect Due Payment · {selectedDueOrder.invoice_number || `#ORD-${selectedDueOrder.id}`}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #94A3B8)', marginTop: 2 }}>
                    Debtor: <strong style={{ color: 'var(--text-primary, #F8FAFC)' }}>{selectedDueOrder.customer_name || selectedDueOrder.customer_display_name || 'Customer'}</strong>
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
                  color: 'var(--text-muted, #94A3B8)',
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
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '8px', background: 'var(--bg-main, #0B0E17)', borderRadius: '8px', border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Total Bill
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.total_amount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'var(--bg-main, #0B0E17)', borderRadius: '8px', border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Paid Earlier
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.amount_paid || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'rgba(236,72,153,0.12)', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.3)' }}>
                <span style={{ fontSize: '10.5px', color: '#EC4899', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                  Remaining Due
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#EC4899', fontFamily: 'monospace' }}>
                  ₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Settle Form */}
            <form onSubmit={handleConfirmDueSettle} style={{ padding: '18px 20px' }}>
              {dueSettleError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#EF4444', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleError}
                </div>
              )}
              {dueSettleSuccess && (
                <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#10B981', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleSuccess}
                </div>
              )}

              {/* Amount to Collect Input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                    Amount Being Collected Today (₹) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String(parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.35)', color: '#EC4899', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Pay Full (₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String((parseFloat(selectedDueOrder.balance_due || 0) / 2).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-main, #0B0E17)', border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))', color: 'var(--text-secondary, #94A3B8)', cursor: 'pointer', fontWeight: 600 }}
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
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-main, #0B0E17)',
                    color: 'var(--text-primary, #F8FAFC)',
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: 6 }}>
                  Payment Method Collected Via <span style={{ color: '#EF4444' }}>*</span>
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
                          border: isSel ? '1px solid #EC4899' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                          background: isSel ? 'rgba(236,72,153,0.14)' : 'var(--bg-main, #0B0E17)',
                          color: isSel ? '#EC4899' : 'var(--text-secondary, #94A3B8)',
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: 6 }}>
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
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-main, #0B0E17)',
                    color: 'var(--text-primary, #F8FAFC)',
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
                  background: 'var(--bg-main, #0B0E17)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  fontSize: '11px',
                  color: 'var(--text-muted, #94A3B8)',
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
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary, #94A3B8)',
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
                    border: '1px solid #EC4899',
                    background: '#EC4899',
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
