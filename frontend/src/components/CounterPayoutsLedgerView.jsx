import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Receipt,
  Download,
  Printer,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Eye,
  AlertCircle,
  Truck,
  Building2,
  Coffee,
  Wrench,
  Zap,
  RotateCcw,
  UserCheck,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Calendar,
  Filter,
} from 'lucide-react';
import { getCounterPayouts, getCounterPayoutsPage, getCounterPayoutsSummary, deleteCounterPayout } from '../api';
import TimelineRangeSelector from './TimelineRangeSelector';

export const COUNTER_PAYOUT_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'stock_purchase', label: 'Stock Delivery / Purchase', icon: Package, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  { id: 'freight_delivery', label: 'Freight & Courier / Transport', icon: Truck, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'store_maintenance', label: 'Store Repairs & Maintenance', icon: Wrench, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  { id: 'daily_expense', label: 'Tea & Daily Refreshments', icon: Coffee, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { id: 'utility_bill', label: 'Electricity / Utilities', icon: Zap, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  { id: 'customer_refund', label: 'Customer Return Refund', icon: RotateCcw, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  { id: 'staff_salary_payout', label: 'Staff Salary Payout', icon: UserCheck, color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.12)' },
  { id: 'other', label: 'Other Counter Expense', icon: Tag, color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
];

export const PAYMENT_METHODS = [
  { id: 'all', label: 'All Payment Modes' },
  { id: 'cash', label: 'Cash Drawer', icon: Banknote, color: '#10B981' },
  { id: 'upi', label: 'UPI / Online QR', icon: QrCode, color: '#38BDF8' },
  { id: 'card', label: 'Debit / Credit Card', icon: CreditCard, color: '#818CF8' },
  { id: 'bank_transfer', label: 'Bank Transfer / NEFT', icon: Building2, color: '#F59E0B' },
  { id: 'other', label: 'Other', icon: Tag, color: '#64748B' },
];

export default function CounterPayoutsLedgerView({
  activeStoreId = '',
  isCombined = false,
  currentUser = null,
  stores = [],
  currencySymbol = 'Rs.',
  timelineRange = null,
  onTimelineRangeChange = null,
}) {
  const isOwner = currentUser?.is_owner || false;
  const showBranchColumn = isCombined || activeStoreId === 'all' || activeStoreId.includes(',') || (stores && stores.length > 1);

  const [payouts, setPayouts] = useState([]);
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

  // Modal States
  const [selectedPayoutForSlip, setSelectedPayoutForSlip] = useState(null);
  const [copiedVoucher, setCopiedVoucher] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Server-side Pagination
  const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  // Table Drag-to-Scroll Refs
  const tableContainerRef = useRef(null);
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0, hasDragged: false });

  // Sync external timeline changes
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

  const handleTimelineChange = useCallback((newRange) => {
    setSelectedTimelineRange(newRange);
    setPage(1);
    if (onTimelineRangeChange) {
      onTimelineRangeChange(newRange);
    }
  }, [onTimelineRangeChange]);

  // Map frontend sortBy to backend ordering param
  const orderingParam = useMemo(() => {
    if (sortBy === 'date_asc') return 'paid_at';
    if (sortBy === 'amount_desc') return '-amount';
    if (sortBy === 'amount_asc') return 'amount';
    return '-paid_at';
  }, [sortBy]);

  // Build query filter params for backend
  const buildFilterParams = useCallback(() => {
    const params = {};
    if (activeStoreId && activeStoreId !== 'all') {
      params.store_id = activeStoreId;
    }
    if (categoryFilter && categoryFilter !== 'all') {
      params.category = categoryFilter;
    }
    if (paymentMethodFilter && paymentMethodFilter !== 'all') {
      params.payment_method = paymentMethodFilter;
    }
    if (selectedTimelineRange) {
      if (!selectedTimelineRange.isAllTime && selectedTimelineRange.startDate) {
        params.start_date = selectedTimelineRange.startDate;
      }
      if (!selectedTimelineRange.isAllTime && selectedTimelineRange.endDate) {
        params.end_date = selectedTimelineRange.endDate;
      }
    }
    return params;
  }, [activeStoreId, categoryFilter, paymentMethodFilter, selectedTimelineRange]);

  // Debounced search query trigger
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Payouts from API with server-side pagination
  const loadPayouts = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const baseParams = buildFilterParams();
      if (debouncedSearch.trim()) {
        baseParams.search = debouncedSearch.trim();
      }
      const pageParams = {
        ...baseParams,
        page: targetPage,
        page_size: pageSize,
        ordering: orderingParam,
      };

      const res = await getCounterPayoutsPage(pageParams);
      if (res && typeof res === 'object' && Array.isArray(res.results)) {
        setPayouts(res.results);
        setTotalCount(res.count || 0);
      } else {
        const list = Array.isArray(res) ? res : [];
        setPayouts(list);
        setTotalCount(list.length);
      }
    } catch (err) {
      console.error('Failed to load counter payouts:', err);
      setError(err?.message || 'Failed to load counter payouts');
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams, debouncedSearch, page, pageSize, orderingParam]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  // Aliases for seamless rendering
  const filteredPayouts = payouts;

  // Load KPI Metrics via database aggregation
  const [metrics, setMetrics] = useState({
    totalDisbursed: 0,
    count: 0,
    cashTotal: 0,
    digitalTotal: 0,
    topCatLabel: 'None',
    topCatAmt: 0,
  });

  const loadMetrics = useCallback(async () => {
    try {
      const baseParams = buildFilterParams();
      if (debouncedSearch.trim()) {
        baseParams.search = debouncedSearch.trim();
      }
      const summary = await getCounterPayoutsSummary(baseParams);
      if (summary) {
        const topCatMeta = COUNTER_PAYOUT_CATEGORIES.find((c) => c.id === summary.top_category);
        setMetrics({
          totalDisbursed: summary.total_disbursed || 0,
          count: summary.total_count || 0,
          cashTotal: summary.cash_total || 0,
          digitalTotal: summary.digital_total || 0,
          topCatLabel: topCatMeta ? topCatMeta.label : (summary.top_category || 'None'),
          topCatAmt: summary.top_category_amount || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load payout metrics summary:', err);
    }
  }, [buildFilterParams, debouncedSearch]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Total pages derived from backend count
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Current page records from backend
  const paginatedPayouts = payouts;

  // Drag-to-Scroll Handlers
  const handleTableMouseDown = (e) => {
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

  // Export to CSV
  const handleExportCsv = async () => {
    if (totalCount === 0 || exportingCsv) return;
    setExportingCsv(true);
    setExportProgress(15);

    const timer = setInterval(() => {
      setExportProgress((prev) => (prev < 80 ? prev + 15 : prev));
    }, 70);

    try {
      const exportParams = {
        ...buildFilterParams(),
        ordering: orderingParam,
      };
      if (debouncedSearch.trim()) {
        exportParams.search = debouncedSearch.trim();
      }

      const res = await getCounterPayouts(exportParams);
      const allRows = Array.isArray(res) ? res : (res?.results || []);

      const headers = [
        'Voucher Number',
        'Date',
        'Time',
        'Branch / Store',
        'Register Shift',
        'Paid To (Payee)',
        'Paid By (Cashier/Staff)',
        'Category',
        'Payment Method',
        'Amount',
        'Bill / LR Reference',
        'Reason / Purpose',
      ];

      const rows = allRows.map((p) => {
        const dt = new Date(p.paid_at || p.created_at);
        const dStr = dt.toLocaleDateString('en-IN');
        const tStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const amt = parseFloat(p.amount) || 0;
        const shiftStr = p.register_shift_number
          ? `${p.register_shift_number}${p.is_post_close ? ' (Post-Close)' : ''}`
          : p.register_shift
          ? `Shift #${p.register_shift}`
          : 'Unassigned';

        return [
          `"${p.payout_number || ''}"`,
          `"${dStr}"`,
          `"${tStr}"`,
          `"${(p.store_name || 'Main Branch').replace(/"/g, '""')}"`,
          `"${shiftStr.replace(/"/g, '""')}"`,
          `"${(p.paid_to || '').replace(/"/g, '""')}"`,
          `"${(p.paid_by_name || 'Cashier').replace(/"/g, '""')}"`,
          `"${(p.category_display || p.category || '').replace(/"/g, '""')}"`,
          `"${(p.payment_method_display || p.payment_method || '').toUpperCase()}"`,
          amt.toFixed(2),
          `"${(p.receipt_number || '').replace(/"/g, '""')}"`,
          `"${(p.reason || '').replace(/"/g, '""')}"`,
        ];
      });

      // Summary row
      rows.push([
        '"TOTAL"',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        metrics.totalDisbursed.toFixed(2),
        '""',
        `"${metrics.count || allRows.length} Payout Vouchers Total"`,
        '""',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      link.download = `Counter_Payouts_Ledger_${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      clearInterval(timer);
      setExportProgress(100);
      setTimeout(() => {
        setExportingCsv(false);
        setExportProgress(0);
      }, 300);
    }
  };

  const handleCopyVoucher = (payoutNumber) => {
    if (!payoutNumber) return;
    navigator.clipboard.writeText(payoutNumber);
    setCopiedVoucher(payoutNumber);
    setTimeout(() => setCopiedVoucher(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 4 Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Total Disbursed */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Total Counter Disbursed
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#EF4444', letterSpacing: '-0.02em' }}>
            {currencySymbol} {metrics.totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            {metrics.count} on-counter disbursement vouchers
          </div>
        </div>

        {/* Card 2: Cash Drawer Impact */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Cash Drawer Payouts
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <Banknote size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10B981', letterSpacing: '-0.02em' }}>
            {currencySymbol} {metrics.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Direct cash register drawer outlays
          </div>
        </div>

        {/* Card 3: Digital & Online QR */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              UPI &amp; Digital Payouts
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38BDF8',
              }}
            >
              <QrCode size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.02em' }}>
            {currencySymbol} {metrics.digitalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            UPI QR, Cards &amp; Bank Transfers
          </div>
        </div>

        {/* Card 4: Top Category Outlay */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Top Payout Purpose
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8B5CF6',
              }}
            >
              <Package size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metrics.topCatLabel}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            {currencySymbol} {metrics.topCatAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disbursed
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Top Row: Search & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #94A3B8)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by Voucher #, Payee, Staff, Reason, Bill Ref..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input, #0B0E17)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
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
              onClick={loadPayouts}
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
              title="Refresh Counter Payouts"
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
              title="Export filtered counter payouts to CSV"
            >
              {exportingCsv ? (
                <>
                  <Loader2 size={13} className="animate-spin" style={{ flexShrink: 0 }} />
                  <span>{exportProgress > 0 ? `Exporting (${exportProgress}%)...` : 'Exporting...'}</span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: '4px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: `${Math.max(10, Math.min(100, exportProgress || 15))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #EF4444, #F87171)',
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

        {/* Bottom Row: Category, Payment Mode, Timeline, and Sort Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Universal Timeline Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Period:</span>
            <TimelineRangeSelector
              value={selectedTimelineRange}
              defaultUnit="month"
              defaultCount={1}
              onChange={handleTimelineChange}
              allowFuture={false}
              showXAxis={false}
              isAllTime={selectedTimelineRange?.isAllTime || false}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #0B0E17)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.80rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {COUNTER_PAYOUT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Payment Mode:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #0B0E17)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.80rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input, #0B0E17)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.80rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="amount_desc">Amount (Highest First)</option>
              <option value="amount_asc">Amount (Lowest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div
        style={{
          borderRadius: '14px',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Table Container with Horizontal Drag-to-Scroll */}
        <div
          ref={tableContainerRef}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onMouseUp={handleTableMouseUp}
          onMouseLeave={handleTableMouseUp}
          style={{
            overflowX: 'auto',
            cursor: isDraggingTable ? 'grabbing' : 'default',
            userSelect: isDraggingTable ? 'none' : 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: '920px',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-surface-hover, #F8FAFC)',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  color: 'var(--text-secondary, #94A3B8)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Voucher # / Date</th>
                {showBranchColumn && <th style={{ padding: '12px 16px' }}>Branch</th>}
                <th style={{ padding: '12px 16px' }}>Register Shift</th>
                <th style={{ padding: '12px 16px' }}>Payee &amp; Staff</th>
                <th style={{ padding: '12px 16px' }}>Category &amp; Reason</th>
                <th style={{ padding: '12px 16px' }}>Ref / Challan</th>
                <th style={{ padding: '12px 16px' }}>Mode</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Voucher Slip</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showBranchColumn ? 9 : 8} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Loading counter payouts...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={showBranchColumn ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#EF4444' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={18} />
                      <span>{error}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPayouts.length === 0 ? (
                <tr>
                  <td colSpan={showBranchColumn ? 9 : 8} style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Receipt size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                    <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      No counter payouts found
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                      {searchQuery || categoryFilter !== 'all' || paymentMethodFilter !== 'all'
                        ? 'Try clearing or relaxing some of your search filters.'
                        : 'No on-counter expense disbursements recorded for this period.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPayouts.map((p) => {
                  const categoryMeta = COUNTER_PAYOUT_CATEGORIES.find((c) => c.id === p.category) || {
                    label: p.category_display || p.category || 'Expense',
                    color: '#64748B',
                    bg: 'rgba(100, 116, 139, 0.12)',
                  };

                  const paymentMeta = PAYMENT_METHODS.find((pm) => pm.id === p.payment_method) || {
                    label: p.payment_method_display || p.payment_method || 'Cash',
                    color: '#10B981',
                  };

                  const dt = new Date(p.paid_at || p.created_at);
                  const isCopied = copiedVoucher === p.payout_number;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, rgba(255,255,255,0.03))')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Voucher # and Date */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              color: '#EF4444',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {p.payout_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyVoucher(p.payout_number)}
                            title="Copy voucher number"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              color: isCopied ? '#10B981' : 'var(--text-muted, #94A3B8)',
                            }}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                          {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Store / Branch Column */}
                      {showBranchColumn && (
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                              color: '#60A5FA',
                            }}
                          >
                            <Building2 size={12} />
                            {p.store_name || 'Main Branch'}
                          </span>
                        </td>
                      )}

                      {/* Register Shift Column */}
                      <td style={{ padding: '12px 16px' }}>
                        {p.register_shift_number || p.register_shift ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 7px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                width: 'fit-content',
                              }}
                              title={`Drawer Shift: ${p.register_shift_number || `Shift #${p.register_shift}`}`}
                            >
                              <Clock size={11} />
                              {p.register_shift_number || `Shift #${p.register_shift}`}
                            </span>
                            {p.is_post_close && (
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  fontWeight: 700,
                                  color: '#F59E0B',
                                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  width: 'fit-content',
                                }}
                              >
                                Post-Close
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Payee and Staff */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.paid_to}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                          Recorded by: {p.paid_by_name || 'Cashier'}
                        </div>
                      </td>

                      {/* Category and Reason */}
                      <td style={{ padding: '12px 16px', maxWidth: '260px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: categoryMeta.bg || 'rgba(100, 116, 139, 0.12)',
                            color: categoryMeta.color || '#64748B',
                          }}
                        >
                          {p.category_display || categoryMeta.label}
                        </span>
                        <div
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={p.reason}
                        >
                          {p.reason || 'Counter expense'}
                        </div>
                      </td>

                      {/* Bill / LR Reference */}
                      <td style={{ padding: '12px 16px' }}>
                        {p.receipt_number ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.76rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-surface-hover, rgba(255,255,255,0.06))',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {p.receipt_number}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Mode */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: paymentMeta.color || 'var(--text-primary)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {p.payment_method_display || paymentMeta.label}
                        </span>
                      </td>

                      {/* Amount */}
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.96rem',
                          color: '#EF4444',
                        }}
                      >
                        {currencySymbol} {parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Actions: Print Slip */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPayoutForSlip(p)}
                          className="btn btn-secondary"
                          style={{
                            padding: '5px 9px',
                            fontSize: '0.74rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                          }}
                          title="View & Print 80mm Payout Voucher Slip"
                        >
                          <Printer size={13} />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            backgroundColor: 'var(--bg-surface-hover, #F8FAFC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, totalCount)} of {totalCount} entries
            </span>

            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input, #0B0E17)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                color: 'var(--text-primary)',
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              {PAGE_SIZE_OPTIONS.map((sz) => (
                <option key={sz} value={sz}>
                  {sz} per page
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
              }}
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
              }}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span style={{ fontSize: '0.80rem', fontWeight: 600, padding: '0 8px', color: 'var(--text-primary)' }}>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.4 : 1,
              }}
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.4 : 1,
              }}
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 80mm Bixolon Thermal Payout Slip Modal */}
      {selectedPayoutForSlip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={() => setSelectedPayoutForSlip(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              borderRadius: '16px',
              border: '1px solid var(--border-color, #D1D5DB)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thermal Print Area */}
            <div
              id="printable-counter-payout-voucher"
              style={{
                width: '100%',
                padding: '22px 18px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
                color: '#000000',
                fontSize: '0.72rem',
                lineHeight: 1.35,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <img
                  src="/assets/logo.svg"
                  alt="Wondersale Logo"
                  style={{ height: '44px', width: 'auto', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }}
                />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
                  WONDER SALE
                </h2>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.5px', color: '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
                  {selectedPayoutForSlip.store_name || 'MAIN BRANCH'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '6px', textAlign: 'center', fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                *** COUNTER PAYOUT VOUCHER ***
              </div>

              {/* Voucher Meta */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>VOUCHER NO:</span>
                  <strong>{selectedPayoutForSlip.payout_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>DATE &amp; TIME:</span>
                  <span>{new Date(selectedPayoutForSlip.paid_at || selectedPayoutForSlip.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>PAYMENT MODE:</span>
                  <strong style={{ textTransform: 'uppercase' }}>{selectedPayoutForSlip.payment_method_display || selectedPayoutForSlip.payment_method}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CASHIER / STAFF:</span>
                  <span>{selectedPayoutForSlip.paid_by_name || 'Cashier'}</span>
                </div>
                {(selectedPayoutForSlip.register_shift_number || selectedPayoutForSlip.register_shift) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>DRAWER SHIFT:</span>
                    <span>
                      {selectedPayoutForSlip.register_shift_number || `Shift #${selectedPayoutForSlip.register_shift}`}
                      {selectedPayoutForSlip.is_post_close ? ' (POST-CLOSE)' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Payee & Reason */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>PAID TO (RECEIVER):</strong></div>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, paddingLeft: '4px' }}>
                  {selectedPayoutForSlip.paid_to}
                </div>

                <div style={{ marginTop: '4px' }}><strong>CATEGORY / PURPOSE:</strong></div>
                <div style={{ paddingLeft: '4px' }}>
                  {selectedPayoutForSlip.category_display || selectedPayoutForSlip.category}
                </div>

                {selectedPayoutForSlip.receipt_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>BILL / LR REF #:</span>
                    <strong>{selectedPayoutForSlip.receipt_number}</strong>
                  </div>
                )}

                <div style={{ marginTop: '4px' }}><strong>REASON / PARTICULARS:</strong></div>
                <div style={{ paddingLeft: '4px', fontStyle: 'italic', lineHeight: 1.3 }}>
                  {selectedPayoutForSlip.reason || 'On-counter expense payment'}
                </div>
              </div>

              {/* Amount Box */}
              <div style={{ padding: '10px 0', borderBottom: '1px dashed #000000', textAlign: 'center' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 800 }}>AMOUNT DISBURSED:</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#000000', marginTop: '2px' }}>
                  ₹{parseFloat(selectedPayoutForSlip.amount).toFixed(2)}
                </div>
              </div>

              {/* Signatures */}
              <div style={{ paddingTop: '22px', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Cashier Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Receiver Signature</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.64rem', color: '#6B7280' }}>
                STORE AUDIT COPY &bull; WONDERSALE POS
              </div>
            </div>

            {/* Modal Actions */}
            <div
              className="no-print"
              style={{
                padding: '12px 18px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  borderColor: '#EF4444',
                  fontWeight: 800,
                  padding: '9px',
                  color: '#FFFFFF',
                }}
              >
                <Printer size={15} />
                <span>Print Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPayoutForSlip(null)}
                className="btn btn-secondary"
                style={{ padding: '9px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
