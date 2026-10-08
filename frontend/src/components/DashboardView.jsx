import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Package,
  AlertTriangle, AlertCircle, Flame, Calendar, ChevronLeft,
  ChevronRight, Search, Clock, Activity, Layers, ShieldAlert,
  Store as StoreIcon, BarChart3, ArrowUpDown, Users, Wallet,
  UserCheck, UserX, CheckCircle, CheckCircle2, XCircle, FileText,
  ArrowRight, DollarSign, Filter, ExternalLink, Scale, Check, X,
  ShieldCheck, Download, Receipt, CreditCard, Banknote, QrCode, Phone,
  Gavel, ZoomIn,
} from 'lucide-react';
import TimelineRangeSelector, { calculateDatesForDuration, formatDateYMD } from './TimelineRangeSelector';
import FineEmployeeModal from './FineEmployeeModal';
import {
  fetchDashboardAnalytics,
  fetchExpiryAnalytics,
  fetchStores,
  fetchDailyAttendance,
  fetchStoreLedgerSummary,
  getRegisterShifts,
  settleRegisterDiscrepancy,
  getDuesSummary,
  getSaleOrders,
  recordOrderDuePayment,
  fetchBrokenItemReports,
  markBrokenItemNoFine,
} from '../api';

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

// ─── Utility helpers ─────────────────────────────────────────────────────────
const fmtRupee = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v.toFixed(0);
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

const pct = (n) => {
  const v = Number(n || 0);
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
};

const paginate = (arr, page) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
const totalPages = (arrOrCount) => {
  const count = typeof arrOrCount === 'number' ? arrOrCount : (arrOrCount?.length || 0);
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
};

const SETTLEMENT_ACTIONS = [
  { value: 'approved_loss', label: 'Approved Store Loss / Deficit Expense', desc: 'Accept cash shortfall as operational loss' },
  { value: 'recovered_from_cashier', label: 'Recovered / Deducted from Cashier', desc: 'Cash shortfall deducted or recovered from staff member' },
  { value: 'reconciled_counting_error', label: 'Reconciled - Physical Counting / Entry Mistake', desc: 'Recount or entry typo verified and corrected' },
  { value: 'surplus_deposited', label: 'Cash Surplus - Deposited to Store Safe / Bank', desc: 'Excess drawer cash logged and transferred' },
  { value: 'waived', label: 'Waived by Management', desc: 'Discrepancy reviewed and waived by manager' },
  { value: 'other', label: 'Other Settlement Reason', desc: 'See custom explanation in audit notes' },
];

const getSettlementActionLabel = (actionKey) => {
  const match = SETTLEMENT_ACTIONS.find(a => a.value === actionKey);
  return match ? match.label : (actionKey || 'Settled / Reconciled');
};

const fmtDateTime = (dtStr) => {
  if (!dtStr) return '—';
  try {
    const d = new Date(dtStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dtStr;
  }
};

const exportLedgerCSV = (records) => {
  const headers = [
    'Shift Number',
    'Store',
    'Cashier',
    'Opened At',
    'Closed At',
    'Opening Cash Float',
    'Cash Sales',
    'Cash Payouts',
    'Expected Cash',
    'Closing Cash Counted',
    'Discrepancy (Variance)',
    'Cashier Closing Reason',
    'Settlement Status',
    'Settlement Action',
    'Settled By',
    'Settled At',
    'Settlement Notes',
  ];
  const rows = records.map(s => [
    s.shift_number || '',
    s.store_name || '',
    s.cashier_name || '',
    s.opened_at ? new Date(s.opened_at).toLocaleString('en-IN') : '',
    s.closed_at ? new Date(s.closed_at).toLocaleString('en-IN') : '',
    Number(s.opening_cash || 0).toFixed(2),
    Number(s.cash_sales_amount || 0).toFixed(2),
    Number(s.cash_payouts_amount || 0).toFixed(2),
    Number(s.expected_cash || 0).toFixed(2),
    Number(s.closing_cash_counted || 0).toFixed(2),
    Number(s.cash_difference || 0).toFixed(2),
    `"${(s.closing_notes || '').replace(/"/g, '""')}"`,
    s.is_discrepancy_settled ? 'Settled' : 'Unsettled',
    `"${getSettlementActionLabel(s.settlement_action).replace(/"/g, '""')}"`,
    `"${(s.settled_by_name || '').replace(/"/g, '""')}"`,
    s.settled_at ? new Date(s.settled_at).toLocaleString('en-IN') : '',
    `"${(s.settlement_notes || '').replace(/"/g, '""')}"`,
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `register_shift_discrepancy_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ─── Reusable Sub-Components ─────────────────────────────────────────────────
function SortButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--brand-primary)' : '1px solid var(--border-color)',
        background: active ? 'var(--brand-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children, color }) {
  const activeStyle = color
    ? { background: color + '18', borderColor: color, color: color }
    : { background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: '#fff' };

  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 11px',
        borderRadius: 'var(--radius-pill)',
        border: active ? `1px solid ${color || 'var(--brand-primary)'}` : '1px solid var(--border-color)',
        background: active ? (color ? color + '18' : 'rgba(197,34,36,0.10)') : 'transparent',
        color: active ? (color || 'var(--brand-primary)') : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ type, label }) {
  const configs = {
    // Stock status
    out_of_stock:   { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', text: label || 'Out of Stock' },
    critically_low: { bg: 'rgba(249,115,22,0.12)',  color: '#F97316', text: label || 'Critically Low' },
    depleting_fast: { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', text: label || 'Depleting Fast' },
    low_stock:      { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', text: label || 'Low Stock' },
    healthy:        { bg: 'rgba(16,185,129,0.12)',  color: '#10B981', text: label || 'Healthy' },
    // Shelf health
    dead_stock:     { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', text: label || 'Dead Stock' },
    slow_moving:    { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', text: label || 'Slow Moving' },
    moderate:       { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6', text: label || 'Moderate' },
    // Expiry
    expired:        { bg: 'rgba(239,68,68,0.14)',   color: '#EF4444', text: label || 'Expired' },
    expires_today:  { bg: 'rgba(239,68,68,0.14)',   color: '#EF4444', text: label || 'Expires Today' },
    critical:       { bg: 'rgba(249,115,22,0.12)',  color: '#F97316', text: label || 'Critical' },
    warning:        { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', text: label || 'Warning' },
    notice:         { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6', text: label || 'Notice' },
    ok:             { bg: 'rgba(16,185,129,0.12)',  color: '#10B981', text: label || 'OK' },
  };
  const cfg = configs[type] || { bg: 'var(--bg-surface)', color: 'var(--text-secondary)', text: label || type };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '3px 9px', borderRadius: 'var(--radius-pill)',
      background: cfg.bg, color: cfg.color,
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
    }}>
      {cfg.text}
    </span>
  );
}

function Paginator({ page, total, onChange }) {
  const count = typeof total === 'number' ? total : (Array.isArray(total) ? total.length : (Number(total) || 0));
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (count === 0) return null;
  const isFirst = page <= 1;
  const isLast = page >= pages;
  return (
    <div className="dash-paginator" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderTop: '1px solid var(--border-color)',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {count > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${fmtNum(count)}` : '0 items'}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={isFirst}
          style={pgBtnStyle(isFirst)}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{
          padding: '5px 12px', fontSize: '12px', color: 'var(--text-primary)',
          fontWeight: 600, background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
        }}>
          {page} / {pages}
        </span>
        <button
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={isLast}
          style={pgBtnStyle(isLast)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

const pgBtnStyle = (disabled) => ({
  width: 30, height: 30, borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  background: disabled ? 'transparent' : 'var(--bg-surface)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s ease',
});

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="dash-search-input-wrap" style={{ position: 'relative', flexShrink: 0 }}>
      <Search size={13} style={{
        position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-muted)', pointerEvents: 'none',
      }} />
      <input
        className="dash-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search…'}
        style={{
          width: 200, height: 32, paddingLeft: 28, paddingRight: 10,
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          fontSize: '12.5px', fontFamily: 'var(--font-sans)',
          outline: 'none', transition: 'border-color 0.15s ease',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
      />
    </div>
  );
}

function ModuleCard({ id, icon: Icon, title, subtitle, count, loading, error, children }) {
  return (
    <section id={id} className="dash-module-card" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Module Header */}
      <div className="dash-module-header" style={{
        padding: '18px 20px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
            background: 'rgba(197,34,36,0.10)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={17} color="var(--brand-primary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="dash-module-title" style={{
                fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: '-0.01em', margin: 0,
              }}>{title}</h2>
              {count != null && (
                <span className="dash-module-badge" style={{
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-page)', border: '1px solid var(--border-color)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
                }}>
                  {fmtNum(count)}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="dash-module-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%',
            border: '2px solid var(--border-color)', borderTopColor: 'var(--brand-primary)',
            animation: 'spin 0.8s linear infinite' }}
          />
          <p style={{ marginTop: 12, fontSize: '13px' }}>Loading data…</p>
        </div>
      ) : error ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <AlertCircle size={22} color="var(--color-danger)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function EmptyState({ message, icon: Icon = Package }) {
  return (
    <div style={{
      padding: '48px 20px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-page)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color="var(--text-muted)" />
      </div>
      <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>{message}</p>
    </div>
  );
}

// ─── Table primitives ─────────────────────────────────────────────────────────
const TH = ({ children, right, style = {} }) => (
  <th style={{
    padding: '9px 16px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: right ? 'right' : 'left',
    background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
    ...style,
  }}>{children}</th>
);
const TD = ({ children, right, mono, muted, style = {} }) => (
  <td style={{
    padding: '11px 16px', fontSize: '13px',
    color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
    textAlign: right ? 'right' : 'left',
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
    fontWeight: mono ? 500 : 400,
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap',
    ...style,
  }}>{children}</td>
);

function TableScroll({ children }) {
  return (
    <div className="dash-table-scroll" style={{ overflowX: 'auto' }}>
      <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  );
}

// ─── Main DashboardView ──────────────────────────────────────────────────────
export default function DashboardView({
  currentUser,
  selectedStore: propSelectedStore,
  onBackToLauncher,
}) {
  // ── State ──
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(propSelectedStore || 'all');
  const [rangeConfig, setRangeConfig] = useState(() => {
    const today = new Date();
    const { startDate, endDate } = calculateDatesForDuration('month', 1, today);
    return { startDate, endDate, label: '1 Month', isAllTime: false };
  });
  const [data, setData] = useState(null);
  const [expiryData, setExpiryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiryLoading, setExpiryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const rangeInitRef = useRef(false);

  // ── Per-module state ──
  // Best-Selling
  const [bsSort, setBsSort] = useState('units_sold');
  const [bsPage, setBsPage] = useState(1);
  const [bsSearch, setBsSearch] = useState('');

  // Slow-Moving
  const [smFilter, setSmFilter] = useState('all'); // all | dead | slow
  const [smSort, setSmSort] = useState('tied_capital');
  const [smPage, setSmPage] = useState(1);
  const [smSearch, setSmSearch] = useState('');

  // Fast-Moving
  const [fmSort, setFmSort] = useState('units_sold');
  const [fmPage, setFmPage] = useState(1);
  const [fmSearch, setFmSearch] = useState('');

  // Out-of-Stock
  const [oosFilter, setOosFilter] = useState('all'); // all | out | critical | depleting
  const [oosSort, setOosSort] = useState('urgency');
  const [oosPage, setOosPage] = useState(1);
  const [oosSearch, setOosSearch] = useState('');

  // Expiry
  const [exFilter, setExFilter] = useState('all'); // all | expired | critical | warning | notice | ok
  const [exSort, setExSort] = useState('days_asc');
  const [exPage, setExPage] = useState(1);
  const [exSearch, setExSearch] = useState('');

  // ── Employee Attendance Widget ──
  const [attData, setAttData] = useState([]);
  const [attLoading, setAttLoading] = useState(true);
  const [attPage, setAttPage] = useState(1);
  const [attSearch, setAttSearch] = useState('');
  const ATT_PAGE_SIZE = 6;

  // ── Employee Balance Widget ──
  const [balanceData, setBalanceData] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balancePage, setBalancePage] = useState(1);
  const [balanceSearch, setBalanceSearch] = useState('');
  const BAL_PAGE_SIZE = 6;

  // ── Register Shift Discrepancies & Ledger ──
  const [shiftDiscrepancies, setShiftDiscrepancies] = useState([]);
  const [allRegisterShifts, setAllRegisterShifts] = useState([]);
  const [shiftDiscLoading, setShiftDiscLoading] = useState(true);
  const [discSort, setDiscSort] = useState('latest'); // latest | largest | shortages | unsettled
  const [discFilter, setDiscFilter] = useState('all'); // all | unsettled | shortage | surplus | settled
  const [discSearch, setDiscSearch] = useState('');
  const [discPage, setDiscPage] = useState(1);
  const DISC_PAGE_SIZE = 5;

  // Ledger Modal
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerScope, setLedgerScope] = useState('period'); // 'period' | 'all'
  const [allTimeShifts, setAllTimeShifts] = useState([]);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('discrepancies'); // discrepancies | unsettled | settled | shortages | surpluses | all
  const [ledgerSort, setLedgerSort] = useState('latest'); // latest | largest | shortages | surpluses
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 10;

  // Settlement Modal
  const [settleModalShift, setSettleModalShift] = useState(null);
  const [settlementAction, setSettlementAction] = useState('approved_loss');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settledByName, setSettledByName] = useState(currentUser?.name || currentUser?.username || 'Store Manager');
  const [settlingLoading, setSettlingLoading] = useState(false);

  // ── Customer Dues / Khata Ledger State ──
  const [duesSummary, setDuesSummary] = useState(null);
  const [duesOrders, setDuesOrders] = useState([]);
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesSearch, setDuesSearch] = useState('');
  const [duesFilter, setDuesFilter] = useState('all'); // all | high | recent
  const [duesPage, setDuesPage] = useState(1);
  const DUES_PAGE_SIZE = 6;
  const [selectedDueOrder, setSelectedDueOrder] = useState(null);
  const [isDueSettleModalOpen, setIsDueSettleModalOpen] = useState(false);
  const [dueSettleAmount, setDueSettleAmount] = useState('');
  const [dueSettleMethod, setDueSettleMethod] = useState('cash'); // cash | upi | card
  const [dueSettleNotes, setDueSettleNotes] = useState('');
  const [isSubmittingDueSettle, setIsSubmittingDueSettle] = useState(false);
  const [dueSettleError, setDueSettleError] = useState('');
  const [dueSettleSuccess, setDueSettleSuccess] = useState('');

  // ── Damaged & Broken Items Audit State ──
  const [brokenReports, setBrokenReports] = useState([]);
  const [brokenLoading, setBrokenLoading] = useState(false);
  const [brokenError, setBrokenError] = useState(null);
  const [brokenSearch, setBrokenSearch] = useState('');
  const [brokenFilter, setBrokenFilter] = useState('all'); // all | pending | waived | fined
  const [brokenSort, setBrokenSort] = useState('date_desc'); // date_desc | loss_desc | loss_asc
  const [brokenPage, setBrokenPage] = useState(1);
  const [fineModalReport, setFineModalReport] = useState(null);
  const [brokenLightboxImage, setBrokenLightboxImage] = useState(null);
  const [brokenSuccessMsg, setBrokenSuccessMsg] = useState('');
  const [waivingReportId, setWaivingReportId] = useState(null);

  const loadBrokenReports = useCallback(async (store) => {
    setBrokenLoading(true);
    setBrokenError(null);
    try {
      const params = {};
      if (store && store !== 'all') {
        params.store = store;
      }
      const reports = await fetchBrokenItemReports(params);
      setBrokenReports(reports || []);
    } catch (err) {
      setBrokenError(err.message || 'Failed to load broken item reports.');
    } finally {
      setBrokenLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrokenReports(activeStore);
    setBrokenPage(1);
  }, [activeStore, loadBrokenReports]);

  const handleBrokenReportFineSuccess = (updatedReport, message) => {
    setBrokenSuccessMsg(message || 'Action recorded successfully!');
    setBrokenReports((prev) =>
      prev.map((r) => (r.id === updatedReport.id ? { ...r, ...updatedReport } : r))
    );
    setTimeout(() => setBrokenSuccessMsg(''), 5000);
  };

  const handleQuickNoFine = async (report) => {
    try {
      setWaivingReportId(report.id);
      const res = await markBrokenItemNoFine(report.id);
      handleBrokenReportFineSuccess(res.report, res.message || 'Marked as Store Loss. No fine applied to staff.');
    } catch (err) {
      alert(err.message || 'Failed to mark as No Fine.');
    } finally {
      setWaivingReportId(null);
    }
  };

  const brokenFiltered = useMemo(() => {
    let list = [...brokenReports];

    if (brokenFilter === 'pending' || brokenFilter === 'unfined') {
      list = list.filter((r) => !r.is_fined && !r.is_waived);
    } else if (brokenFilter === 'waived') {
      list = list.filter((r) => r.is_waived);
    } else if (brokenFilter === 'fined') {
      list = list.filter((r) => r.is_fined);
    }

    if (brokenSearch.trim()) {
      const q = brokenSearch.toLowerCase();
      list = list.filter((r) =>
        (r.item_name || '').toLowerCase().includes(q) ||
        (r.item_uid || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.reported_by_name || '').toLowerCase().includes(q) ||
        (r.fined_employee_name || '').toLowerCase().includes(q) ||
        (r.waived_by || '').toLowerCase().includes(q) ||
        (r.store_name || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (brokenSort === 'loss_desc') {
        return Number(b.total_loss || 0) - Number(a.total_loss || 0);
      }
      if (brokenSort === 'loss_asc') {
        return Number(a.total_loss || 0) - Number(b.total_loss || 0);
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return list;
  }, [brokenReports, brokenFilter, brokenSearch, brokenSort]);

  const brokenStats = useMemo(() => {
    const totalLoss = brokenReports.reduce((sum, r) => sum + Number(r.total_loss || 0), 0);
    const totalUnits = brokenReports.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const finedList = brokenReports.filter((r) => r.is_fined);
    const waivedList = brokenReports.filter((r) => r.is_waived);
    const pendingList = brokenReports.filter((r) => !r.is_fined && !r.is_waived);
    const totalFines = finedList.reduce((sum, r) => sum + Number(r.fine_amount || r.total_loss || 0), 0);
    return {
      totalLoss,
      totalUnits,
      finedCount: finedList.length,
      waivedCount: waivedList.length,
      pendingCount: pendingList.length,
      unfinedCount: pendingList.length,
      totalFines,
    };
  }, [brokenReports]);

  // ── Fetch stores ──
  useEffect(() => {
    fetchStores().then((s) => setStores(s || [])).catch(() => {});
  }, []);

  // ── Fetch main analytics ──
  const loadAnalytics = useCallback(async (store, range) => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchDashboardAnalytics(store, range.startDate, range.endDate);
      setData(d);
      setLastRefreshed(new Date());
      // Reset pages
      setBsPage(1); setSmPage(1); setFmPage(1); setOosPage(1);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch expiry ──
  const loadExpiry = useCallback(async (store) => {
    setExpiryLoading(true);
    try {
      const d = await fetchExpiryAnalytics(store);
      setExpiryData(d);
    } catch {
      setExpiryData(null);
    } finally {
      setExpiryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(activeStore, rangeConfig);
  }, [activeStore, rangeConfig, loadAnalytics]);

  useEffect(() => {
    loadExpiry(activeStore);
    setExPage(1);
  }, [activeStore, loadExpiry]);

  // ── Load employee attendance & balance data ──
  const loadEmployeeWidgets = useCallback(async (store) => {
    setAttLoading(true);
    setBalanceLoading(true);
    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;

      const [attRes, balRes] = await Promise.allSettled([
        fetchDailyAttendance({ store_id: store !== 'all' ? store : undefined, date: today }),
        fetchStoreLedgerSummary(store !== 'all' ? store : undefined),
      ]);
      if (attRes.status === 'fulfilled') {
        const val = attRes.value;
        const records = Array.isArray(val) ? val : (val?.records || val?.results || []);
        // Sort: absent/needs_review first, then half_day, then others
        const statusOrder = { absent: 0, needs_review: 1, half_day: 2, late: 3, present: 3, paid_leave: 4, unpaid_leave: 4, weekly_off: 5, holiday: 5 };
        records.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
        setAttData(records);
      }
      if (balRes.status === 'fulfilled') {
        const employees = balRes.value?.employee_balances || [];
        // Only show employees where store OWES them money (positive balance)
        const owed = employees.filter(e => parseFloat(e.balance) > 0);
        owed.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
        setBalanceData(owed);
      }
    } catch {}
    setAttLoading(false);
    setBalanceLoading(false);
  }, []);

  useEffect(() => {
    loadEmployeeWidgets(activeStore);
    setAttPage(1);
    setBalancePage(1);
  }, [activeStore, loadEmployeeWidgets]);

  // ── Load Register Shift Discrepancies ──
  const loadRegisterDiscrepancies = useCallback(async (store, range) => {
    setShiftDiscLoading(true);
    try {
      const storeParam = store !== 'all' ? store : undefined;
      const periodParams = { store: storeParam };
      if (range && !range.isAllTime) {
        if (range.startDate) periodParams.start_date = range.startDate;
        if (range.endDate) periodParams.end_date = range.endDate;
      }

      // Fetch period shifts and all-time shifts concurrently
      const [periodRes, allRes] = await Promise.all([
        getRegisterShifts(periodParams),
        getRegisterShifts({ store: storeParam }),
      ]);

      const periodList = Array.isArray(periodRes) ? periodRes : (periodRes?.results || []);
      const allList = Array.isArray(allRes) ? allRes : (allRes?.results || []);

      setAllRegisterShifts(periodList);
      setAllTimeShifts(allList);

      const discList = periodList.filter(
        (s) => s.status === 'closed' && Math.abs(parseFloat(s.cash_difference || 0)) >= 0.01
      );
      setShiftDiscrepancies(discList);
    } catch (err) {
      console.error('Failed to load register shifts:', err);
    } finally {
      setShiftDiscLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegisterDiscrepancies(activeStore, rangeConfig);
    setDiscPage(1);
    setLedgerPage(1);
  }, [activeStore, rangeConfig, loadRegisterDiscrepancies]);

  // ── Load Customer Dues / Khata Ledger ──
  const loadCustomerDues = useCallback(async (store) => {
    setDuesLoading(true);
    try {
      const storeParam = store !== 'all' ? store : undefined;
      const [summaryRes, ordersRes] = await Promise.all([
        getDuesSummary({ store: storeParam }),
        getSaleOrders({ is_due: 'true', store: storeParam }),
      ]);
      setDuesSummary(summaryRes);
      const list = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.results || []);
      setDuesOrders(list);
    } catch (err) {
      console.error('Failed to load customer dues:', err);
    } finally {
      setDuesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomerDues(activeStore);
    setDuesPage(1);
  }, [activeStore, loadCustomerDues]);

  const handleOpenDueSettle = (order) => {
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
      setDueSettleSuccess(`Successfully collected ₹${amt.toFixed(2)} via ${dueSettleMethod.toUpperCase()}! Recorded into accounts & shifts.`);
      setTimeout(() => {
        setIsDueSettleModalOpen(false);
        setSelectedDueOrder(null);
        setDueSettleSuccess('');
      }, 1400);

      loadCustomerDues(activeStore);
      loadAnalytics(activeStore, rangeConfig);
      loadRegisterDiscrepancies(activeStore, rangeConfig);
    } catch (err) {
      setDueSettleError(err.message || 'Failed to record due payment');
    } finally {
      setIsSubmittingDueSettle(false);
    }
  };

  // ── TimelineRangeSelector onChange ──
  const handleRangeChange = useCallback((rc) => {
    if (!rangeInitRef.current) {
      rangeInitRef.current = true;
      return; // skip the initial fire on mount
    }
    setRangeConfig({ startDate: rc.startDate, endDate: rc.endDate, label: rc.label, isAllTime: rc.isAllTime });
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const daysInPeriod = useMemo(() => {
    if (!data?.meta) return 30;
    return data.meta.days_in_period || 30;
  }, [data]);

  // Best-Selling list (from API)
  const bestSellersAll = useMemo(() => {
    return (data?.best_selling_products || []).filter(Boolean);
  }, [data]);

  // Slow-Moving list (from API)
  const slowMovingAll = useMemo(() => {
    return (data?.low_selling_products || []).filter(Boolean);
  }, [data]);

  // Out-of-Stock list (from API)
  const stockDepletionAll = useMemo(() => {
    return (data?.stock_depletion_products || []).filter(Boolean);
  }, [data]);

  // Fast-Movers: computed from best_selling enriched with velocity
  const fastMoversAll = useMemo(() => {
    // If viewing an active/ongoing month, divide by elapsed days up to today instead of whole future month
    const velocityDays = data?.meta?.elapsed_days && data.meta.elapsed_days > 0 ? data.meta.elapsed_days : daysInPeriod;
    return bestSellersAll
      .filter((p) => (p.units_sold || 0) > 0)
      .map((p) => ({
        ...p,
        daily_velocity: Number(((p.units_sold || 0) / velocityDays).toFixed(2)),
        est_days_left:
          p.current_stock > 0 && (p.units_sold || 0) > 0
            ? Math.round(p.current_stock / ((p.units_sold || 0) / velocityDays))
            : null,
      }))
      .sort((a, b) => b.daily_velocity - a.daily_velocity);
  }, [bestSellersAll, daysInPeriod, data]);

  // Expiry items from separate endpoint
  const expiryAll = useMemo(() => expiryData?.items || [], [expiryData]);

  // ── Module filters & sorts ────────────────────────────────────────────────

  // Best-Selling
  const bestSellersFiltered = useMemo(() => {
    let arr = bestSellersAll;
    if (bsSearch) {
      const q = bsSearch.toLowerCase();
      arr = arr.filter((p) => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q));
    }
    const key = bsSort;
    return [...arr].sort((a, b) => {
      if (key === 'units_sold') return (b.units_sold || 0) - (a.units_sold || 0);
      if (key === 'revenue') return (b.revenue || 0) - (a.revenue || 0);
      if (key === 'gross_profit') return (b.gross_profit || 0) - (a.gross_profit || 0);
      return 0;
    });
  }, [bestSellersAll, bsSearch, bsSort]);

  // Slow-Moving
  const slowMovingFiltered = useMemo(() => {
    let arr = slowMovingAll;
    if (smFilter === 'dead') arr = arr.filter((p) => (p.units_sold || 0) === 0);
    else if (smFilter === 'slow') arr = arr.filter((p) => (p.units_sold || 0) > 0);
    if (smSearch) {
      const q = smSearch.toLowerCase();
      arr = arr.filter((p) => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) => {
      if (smSort === 'tied_capital') {
        const tA = (a.current_stock || 0) * (a.cost_price || 0);
        const tB = (b.current_stock || 0) * (b.cost_price || 0);
        return tB - tA;
      }
      if (smSort === 'quantity') return (b.current_stock || 0) - (a.current_stock || 0);
      if (smSort === 'revenue') return (a.revenue || 0) - (b.revenue || 0); // ascending (least revenue worst)
      return 0;
    });
  }, [slowMovingAll, smFilter, smSearch, smSort]);

  // Fast-Movers
  const fastMoversFiltered = useMemo(() => {
    let arr = fastMoversAll;
    if (fmSearch) {
      const q = fmSearch.toLowerCase();
      arr = arr.filter((p) => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) => {
      if (fmSort === 'units_sold') return (b.units_sold || 0) - (a.units_sold || 0);
      if (fmSort === 'revenue') return (b.revenue || 0) - (a.revenue || 0);
      if (fmSort === 'velocity') return (b.daily_velocity || 0) - (a.daily_velocity || 0);
      return 0;
    });
  }, [fastMoversAll, fmSearch, fmSort]);

  // Out-of-Stock & Critically Low / Depleting Fast
  const urgencyRank = { out_of_stock: 0, critically_low: 1, depleting_fast: 2, low_stock: 3, healthy: 4 };
  const oosFiltered = useMemo(() => {
    let arr = stockDepletionAll.map((p) => {
      const stockQty = Number(p.current_stock ?? 0);
      const units = p.units_sold ?? p.units_sold_this_month ?? 0;
      const statusKey = p.stock_status || p.status || (
        stockQty <= 0 ? 'out_of_stock' :
        stockQty <= 5 ? 'critically_low' :
        units >= 5 ? 'depleting_fast' : 'low_stock'
      );
      return {
        ...p,
        current_stock: stockQty,
        stock_status: statusKey,
        units_sold: units,
        revenue: p.revenue ?? (Number(units) * Number(p.unit_selling_price || 0)),
      };
    });

    if (oosFilter === 'out') arr = arr.filter((p) => p.stock_status === 'out_of_stock' || p.current_stock <= 0);
    else if (oosFilter === 'critical') arr = arr.filter((p) => p.stock_status === 'critically_low' || (p.current_stock > 0 && p.current_stock <= 5));
    else if (oosFilter === 'depleting') arr = arr.filter((p) => p.stock_status === 'depleting_fast');

    if (oosSearch) {
      const q = oosSearch.toLowerCase();
      arr = arr.filter((p) => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q));
    }

    return [...arr].sort((a, b) => {
      if (oosSort === 'urgency') {
        return (urgencyRank[a.stock_status] ?? 5) - (urgencyRank[b.stock_status] ?? 5);
      }
      if (oosSort === 'units_sold') return (b.units_sold || 0) - (a.units_sold || 0);
      if (oosSort === 'stock') return (a.current_stock || 0) - (b.current_stock || 0);
      return 0;
    });
  }, [stockDepletionAll, oosFilter, oosSearch, oosSort]);

  // Expiry
  const urgencyOrder = { expired: 0, expires_today: 1, critical: 2, warning: 3, notice: 4, ok: 5 };
  const exFiltered = useMemo(() => {
    let arr = expiryAll;
    if (exFilter !== 'all') arr = arr.filter((p) => p.urgency === exFilter);
    if (exSearch) {
      const q = exSearch.toLowerCase();
      arr = arr.filter((p) => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) => {
      if (exSort === 'days_asc') return a.days_until_expiry - b.days_until_expiry;
      if (exSort === 'days_desc') return b.days_until_expiry - a.days_until_expiry;
      if (exSort === 'stock') return (b.current_stock || 0) - (a.current_stock || 0);
      if (exSort === 'loss') return (b.potential_loss || 0) - (a.potential_loss || 0);
      return 0;
    });
  }, [expiryAll, exFilter, exSearch, exSort]);

  const expirySummary = expiryData?.summary || {};

  // ── Shift Discrepancy calculations ──
  const discStats = useMemo(() => {
    const list = shiftDiscrepancies;
    const totalCount = list.length;
    const unsettledList = list.filter((s) => !s.is_discrepancy_settled);
    const settledList = list.filter((s) => s.is_discrepancy_settled);

    let totalShortage = 0;
    let totalSurplus = 0;
    let netVariance = 0;

    unsettledList.forEach((s) => {
      const diff = parseFloat(s.cash_difference || 0);
      netVariance += diff;
      if (diff < 0) totalShortage += Math.abs(diff);
      else if (diff > 0) totalSurplus += diff;
    });

    const shortagesCount = list.filter((s) => parseFloat(s.cash_difference || 0) < -0.01).length;
    const surplusesCount = list.filter((s) => parseFloat(s.cash_difference || 0) > 0.01).length;

    return {
      totalCount,
      unsettledCount: unsettledList.length,
      settledCount: settledList.length,
      shortagesCount,
      surplusesCount,
      netVariance,
      totalShortage,
      totalSurplus,
    };
  }, [shiftDiscrepancies]);

  const sortedAndFilteredDiscrepancies = useMemo(() => {
    let arr = [...shiftDiscrepancies];

    if (discFilter === 'unsettled') {
      arr = arr.filter((s) => !s.is_discrepancy_settled);
    } else if (discFilter === 'settled') {
      arr = arr.filter((s) => s.is_discrepancy_settled);
    } else if (discFilter === 'shortage') {
      arr = arr.filter((s) => parseFloat(s.cash_difference || 0) < -0.01);
    } else if (discFilter === 'surplus') {
      arr = arr.filter((s) => parseFloat(s.cash_difference || 0) > 0.01);
    }

    if (discSearch) {
      const q = discSearch.toLowerCase();
      arr = arr.filter((s) =>
        s.shift_number?.toLowerCase().includes(q) ||
        s.cashier_name?.toLowerCase().includes(q) ||
        s.store_name?.toLowerCase().includes(q) ||
        s.closed_by_name?.toLowerCase().includes(q) ||
        s.closing_notes?.toLowerCase().includes(q) ||
        s.settlement_notes?.toLowerCase().includes(q)
      );
    }

    return arr.sort((a, b) => {
      const diffA = parseFloat(a.cash_difference || 0);
      const diffB = parseFloat(b.cash_difference || 0);
      const absA = Math.abs(diffA);
      const absB = Math.abs(diffB);
      const dateA = new Date(a.closed_at || a.opened_at || 0).getTime();
      const dateB = new Date(b.closed_at || b.opened_at || 0).getTime();

      if (discSort === 'latest') return dateB - dateA;
      if (discSort === 'largest') return absB - absA;
      if (discSort === 'shortages') return diffA - diffB;
      if (discSort === 'unsettled') {
        if (!a.is_discrepancy_settled && b.is_discrepancy_settled) return -1;
        if (a.is_discrepancy_settled && !b.is_discrepancy_settled) return 1;
        return dateB - dateA;
      }
      return 0;
    });
  }, [shiftDiscrepancies, discFilter, discSearch, discSort]);

  // ── Shift Discrepancy Ledger list & Scope calculations ──
  const ledgerActiveSource = useMemo(() => {
    return ledgerScope === 'all' ? allTimeShifts : allRegisterShifts;
  }, [ledgerScope, allTimeShifts, allRegisterShifts]);

  const ledgerDiscrepancies = useMemo(() => {
    return ledgerActiveSource.filter((s) => s.status === 'closed' && Math.abs(parseFloat(s.cash_difference || 0)) >= 0.01);
  }, [ledgerActiveSource]);

  const ledgerStats = useMemo(() => {
    const list = ledgerActiveSource;
    const discrepancies = ledgerDiscrepancies;
    const unsettled = discrepancies.filter((s) => !s.is_discrepancy_settled);
    const settled = discrepancies.filter((s) => s.is_discrepancy_settled);
    const shortages = discrepancies.filter((s) => parseFloat(s.cash_difference || 0) < -0.01);
    const surpluses = discrepancies.filter((s) => parseFloat(s.cash_difference || 0) > 0.01);
    const netVariance = unsettled.reduce((acc, s) => acc + parseFloat(s.cash_difference || 0), 0);
    return {
      totalLogged: list.length,
      discrepancyCount: discrepancies.length,
      unsettledCount: unsettled.length,
      settledCount: settled.length,
      shortagesCount: shortages.length,
      surplusesCount: surpluses.length,
      netVariance,
    };
  }, [ledgerActiveSource, ledgerDiscrepancies]);

  const sortedAndFilteredLedger = useMemo(() => {
    let arr = [...ledgerActiveSource];

    if (ledgerFilter === 'discrepancies') {
      arr = arr.filter((s) => s.status === 'closed' && Math.abs(parseFloat(s.cash_difference || 0)) >= 0.01);
    } else if (ledgerFilter === 'unsettled') {
      arr = arr.filter((s) => s.status === 'closed' && Math.abs(parseFloat(s.cash_difference || 0)) >= 0.01 && !s.is_discrepancy_settled);
    } else if (ledgerFilter === 'settled') {
      arr = arr.filter((s) => s.status === 'closed' && s.is_discrepancy_settled);
    } else if (ledgerFilter === 'shortages') {
      arr = arr.filter((s) => s.status === 'closed' && parseFloat(s.cash_difference || 0) < -0.01);
    } else if (ledgerFilter === 'surpluses') {
      arr = arr.filter((s) => s.status === 'closed' && parseFloat(s.cash_difference || 0) > 0.01);
    }

    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      arr = arr.filter((s) =>
        s.shift_number?.toLowerCase().includes(q) ||
        s.cashier_name?.toLowerCase().includes(q) ||
        s.store_name?.toLowerCase().includes(q) ||
        s.closed_by_name?.toLowerCase().includes(q) ||
        s.closing_notes?.toLowerCase().includes(q) ||
        s.settlement_notes?.toLowerCase().includes(q) ||
        s.settled_by_name?.toLowerCase().includes(q)
      );
    }

    return arr.sort((a, b) => {
      const diffA = parseFloat(a.cash_difference || 0);
      const diffB = parseFloat(b.cash_difference || 0);
      const dateA = new Date(a.closed_at || a.opened_at || 0).getTime();
      const dateB = new Date(b.closed_at || b.opened_at || 0).getTime();

      if (ledgerSort === 'latest') return dateB - dateA;
      if (ledgerSort === 'largest') return Math.abs(diffB) - Math.abs(diffA);
      if (ledgerSort === 'shortages') return diffA - diffB;
      if (ledgerSort === 'surpluses') return diffB - diffA;
      return dateB - dateA;
    });
  }, [ledgerActiveSource, ledgerFilter, ledgerSearch, ledgerSort]);

  // ── Customer Dues / Khata sorted and filtered list ──
  const sortedAndFilteredDues = useMemo(() => {
    let arr = [...duesOrders];
    if (duesSearch.trim()) {
      const q = duesSearch.toLowerCase();
      arr = arr.filter((o) => {
        const inv = (o.invoice_number || '').toLowerCase();
        const cName = (o.customer_name || o.customer_display_name || '').toLowerCase();
        const cPhone = (o.customer_phone || '').toLowerCase();
        return inv.includes(q) || cName.includes(q) || cPhone.includes(q);
      });
    }

    if (duesFilter === 'high') {
      arr = arr.filter((o) => parseFloat(o.balance_due || 0) >= 1000);
    } else if (duesFilter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      arr = arr.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
    }

    arr.sort((a, b) => parseFloat(b.balance_due || 0) - parseFloat(a.balance_due || 0));
    return arr;
  }, [duesOrders, duesSearch, duesFilter]);

  const totalDuesPages = Math.max(1, Math.ceil(sortedAndFilteredDues.length / DUES_PAGE_SIZE));
  const pagedDues = useMemo(() => {
    return sortedAndFilteredDues.slice((duesPage - 1) * DUES_PAGE_SIZE, duesPage * DUES_PAGE_SIZE);
  }, [sortedAndFilteredDues, duesPage]);

  // ── Modal Actions ──
  const openSettleModal = (shift) => {
    setSettleModalShift(shift);
    const diff = parseFloat(shift.cash_difference || 0);
    if (shift.settlement_action) {
      setSettlementAction(shift.settlement_action);
    } else if (diff < 0) {
      setSettlementAction('approved_loss');
    } else {
      setSettlementAction('surplus_deposited');
    }
    setSettlementNotes(shift.settlement_notes || '');
    setSettledByName(shift.settled_by_name || currentUser?.name || currentUser?.username || 'Store Manager');
  };

  const handleSettleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!settleModalShift) return;
    setSettlingLoading(true);
    try {
      const updated = await settleRegisterDiscrepancy(settleModalShift.id, {
        settlement_action: settlementAction,
        settlement_notes: settlementNotes,
        settled_by_name: settledByName || (currentUser?.name || 'Manager'),
      });
      setShiftDiscrepancies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setAllRegisterShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setAllTimeShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSettleModalShift(null);
      setSettlementNotes('');
    } catch (err) {
      alert(err.message || 'Failed to settle discrepancy');
    } finally {
      setSettlingLoading(false);
    }
  };

  const handleReopenDiscrepancy = async (shiftId) => {
    if (!window.confirm('Are you sure you want to re-open this discrepancy for investigation?')) return;
    setSettlingLoading(true);
    try {
      const updated = await settleRegisterDiscrepancy(shiftId, {
        reopen: true,
        notes: 'Discrepancy re-opened from dashboard audit ledger',
      });
      setShiftDiscrepancies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setAllRegisterShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setAllTimeShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSettleModalShift(null);
    } catch (err) {
      alert(err.message || 'Failed to re-open discrepancy');
    } finally {
      setSettlingLoading(false);
    }
  };

  // ── Refresh handler ──
  const handleRefresh = () => {
    loadAnalytics(activeStore, rangeConfig);
    loadExpiry(activeStore);
    loadEmployeeWidgets(activeStore);
    loadRegisterDiscrepancies(activeStore, rangeConfig);
  };

  // ── Row style for tables ──
  const rowHover = (idx) => ({
    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-hover)',
    transition: 'background 0.12s ease',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="dash-view-root" style={{
      minHeight: '100vh',
      background: 'var(--bg-page)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .dash-row:hover td { background: var(--bg-card-hover) !important; }
      `}</style>

      {/* ── Page Header ── */}
      <div className="dash-header" style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 24px',
      }}>
        <div className="dash-header-inner" style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
          height: 64,
        }}>
          <div className="dash-header-left" style={{
            display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
          }}>
            {onBackToLauncher && (
              <button className="dash-back-btn" onClick={onBackToLauncher} style={{
                width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', flexShrink: 0,
              }}>
                <ArrowLeft size={16} />
              </button>
            )}

            <div className="dash-header-title-wrap" style={{ flex: 1, minWidth: 0 }}>
              <h1 className="dash-header-title" style={{
                fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)',
                margin: 0, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                Inventory Intelligence
              </h1>
              <p className="dash-header-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data?.meta?.store_name || 'All Store Branches'}
                {lastRefreshed && ` · Refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>

          <div className="dash-header-right" style={{
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            {/* Store selector (owner only) */}
            {currentUser?.role === 'owner' && stores.length > 1 && (
              <div className="dash-store-selector-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                <StoreIcon size={13} style={{
                  position: 'absolute', left: 9, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
                <select
                  className="dash-store-select"
                  value={activeStore}
                  onChange={(e) => setActiveStore(e.target.value)}
                  style={{
                    height: 34, paddingLeft: 28, paddingRight: 28, appearance: 'none',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    fontSize: '12.5px', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    outline: 'none', minWidth: 140,
                  }}
                >
                  <option value="all">All Stores</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <button className="dash-refresh-btn" onClick={handleRefresh} style={{
              height: 34, paddingLeft: 12, paddingRight: 14, flexShrink: 0,
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-sans)',
            }}>
              <RefreshCw size={13} />
              <span className="dash-refresh-text">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Time Range Selector ── */}
      <div className="dash-time-bar" style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px',
      }}>
        <div className="dash-time-bar-inner" style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            }}>
              <Calendar size={13} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Sales Period
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TimelineRangeSelector
                defaultUnit="month"
                defaultCount={1}
                minDate={data?.meta?.earliest_record_date || '2026-09-04'}
                compact
                onChange={handleRangeChange}
                availableUnits={['day', 'week', 'month', 'year']}
                allowAllTime
              />
            </div>
            {data?.meta && (
              <div className="dash-days-period-badge" style={{
                flexShrink: 0, fontSize: '12px', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Activity size={12} />
                <span>
                  {data.meta.is_ongoing && data.meta.elapsed_days && data.meta.elapsed_days < data.meta.days_in_period
                    ? `${data.meta.days_in_period} day month (${data.meta.elapsed_days} day${data.meta.elapsed_days > 1 ? 's' : ''} to date)`
                    : `${data.meta.days_in_period} day period`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modules ── */}
      <div className="dash-body" style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '24px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* ── TOP LEVEL: REGISTER SHIFT DISCREPANCY AUDIT WIDGET ────────── */}
        <section
          id="mod-shift-discrepancies"
          className="dash-module-card dash-shift-discrepancies-widget"
          style={{
            background: 'var(--bg-card)',
            border: discStats.unsettledCount > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: discStats.unsettledCount > 0 ? '0 4px 20px rgba(239,68,68,0.08)' : 'var(--shadow-sm)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            className="dash-module-header"
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: discStats.unsettledCount > 0
                ? 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, var(--bg-surface) 60%)'
                : 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--radius-sm)',
                  background: discStats.unsettledCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: discStats.unsettledCount > 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)',
                }}
              >
                {discStats.unsettledCount > 0 ? (
                  <AlertTriangle size={19} color="#EF4444" />
                ) : (
                  <ShieldCheck size={19} color="#10B981" />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <h2
                    className="dash-module-title"
                    style={{
                      fontSize: '15.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    Register Shift Cash Discrepancies
                  </h2>
                  {discStats.unsettledCount > 0 ? (
                    <span
                      style={{
                        padding: '2px 9px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(239,68,68,0.14)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#EF4444',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {discStats.unsettledCount} Unsettled
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '2px 9px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#10B981',
                      }}
                    >
                      All Settled / Balanced
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Day-End cashier drawer reconciliations & cash differences vs system sales · <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{rangeConfig?.isAllTime ? 'All Time' : (rangeConfig?.label || 'Selected Period')}</span>
                </p>
              </div>
            </div>

            {/* Header Right: Discrepancy KPI Summary & Ledger Trigger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 14px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Unsettled Deficit
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: discStats.totalShortage > 0 ? '#EF4444' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {discStats.totalShortage > 0 ? `-₹${discStats.totalShortage.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                  </span>
                </div>
                <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Unsettled Surplus
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: discStats.totalSurplus > 0 ? '#10B981' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {discStats.totalSurplus > 0 ? `+₹${discStats.totalSurplus.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                  </span>
                </div>
              </div>

              {/* Button to Open Complete Ledger Modal */}
              <button
                onClick={() => setIsLedgerModalOpen(true)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--brand-primary)',
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 2px 8px rgba(197,34,36,0.22)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileText size={14} />
                <span>Open Shift Discrepancy Ledger</span>
              </button>
            </div>
          </div>

          {/* Widget Controls Bar: Search, Filter Chips, Sorting */}
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip active={discFilter === 'all'} onClick={() => { setDiscFilter('all'); setDiscPage(1); }}>
                All Discrepancies ({shiftDiscrepancies.length})
              </FilterChip>
              <FilterChip
                active={discFilter === 'unsettled'}
                color="#EF4444"
                onClick={() => { setDiscFilter('unsettled'); setDiscPage(1); }}
              >
                Unsettled ({discStats.unsettledCount})
              </FilterChip>
              <FilterChip
                active={discFilter === 'shortage'}
                color="#EF4444"
                onClick={() => { setDiscFilter('shortage'); setDiscPage(1); }}
              >
                Cash Shortages ({discStats.shortagesCount})
              </FilterChip>
              <FilterChip
                active={discFilter === 'surplus'}
                color="#10B981"
                onClick={() => { setDiscFilter('surplus'); setDiscPage(1); }}
              >
                Cash Surpluses ({discStats.surplusesCount})
              </FilterChip>
              <FilterChip
                active={discFilter === 'settled'}
                color="#3B82F6"
                onClick={() => { setDiscFilter('settled'); setDiscPage(1); }}
              >
                Settled / Cleared ({discStats.settledCount})
              </FilterChip>
            </div>

            {/* Right: Search & Sorting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={discSearch}
                  onChange={(e) => { setDiscSearch(e.target.value); setDiscPage(1); }}
                  placeholder="Search cashier, shift #, reason…"
                  style={{
                    height: 32,
                    width: 220,
                    paddingLeft: 28,
                    paddingRight: 10,
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Sort:</span>
                <select
                  value={discSort}
                  onChange={(e) => { setDiscSort(e.target.value); setDiscPage(1); }}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="latest">Latest Shift First</option>
                  <option value="largest">Largest Discrepancy (Highest |₹|)</option>
                  <option value="shortages">Shortages First (Most Deficit)</option>
                  <option value="unsettled">Unsettled First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Body Content */}
          {shiftDiscLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ marginTop: 10, fontSize: '12.5px' }}>Loading shift discrepancies…</p>
            </div>
          ) : shiftDiscrepancies.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <CheckCircle2 size={24} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                All Register Shifts Balanced Perfectly
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: 460, marginInline: 'auto' }}>
                No cash discrepancies detected across closed drawer shifts. Expected cash matched counted cash.
              </p>
              <button
                onClick={() => { setLedgerFilter('all'); setIsLedgerModalOpen(true); }}
                style={{
                  height: 30,
                  padding: '0 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FileText size={13} />
                <span>View Full Shifts Ledger</span>
              </button>
            </div>
          ) : sortedAndFilteredDiscrepancies.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '13px', margin: 0 }}>No discrepancy records match your selected filter or search term.</p>
            </div>
          ) : (() => {
            const paged = sortedAndFilteredDiscrepancies.slice((discPage - 1) * DISC_PAGE_SIZE, discPage * DISC_PAGE_SIZE);
            const totalDiscPages = Math.max(1, Math.ceil(sortedAndFilteredDiscrepancies.length / DISC_PAGE_SIZE));

            return (
              <>
                <TableScroll>
                  <thead>
                    <tr>
                      <TH>Shift / Store</TH>
                      <TH>Closed At & Cashier</TH>
                      <TH right>Opening Cash</TH>
                      <TH right>Expected Drawer Cash</TH>
                      <TH right>Closing Counted</TH>
                      <TH right>Discrepancy (Variance)</TH>
                      <TH>Cashier Notes</TH>
                      <TH>Settlement Status</TH>
                      <TH style={{ textAlign: 'center' }}>Action</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s, idx) => {
                      const diff = parseFloat(s.cash_difference || 0);
                      const isShortage = diff < -0.01;
                      const isSurplus = diff > 0.01;
                      const isSettled = Boolean(s.is_discrepancy_settled);

                      return (
                        <tr key={s.id || idx} className="dash-row" style={rowHover(idx)}>
                          {/* Shift & Store */}
                          <TD>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                              {s.shift_number}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <StoreIcon size={10} />
                              <span>{s.store_name}</span>
                            </div>
                          </TD>

                          {/* Time & Cashier */}
                          <TD>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {s.closed_at ? fmtDateTime(s.closed_at) : fmtDateTime(s.opened_at)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                              Cashier: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{s.cashier_name || 'Counter'}</span>
                              {s.closed_by_name && s.closed_by_name !== s.cashier_name && (
                                <span> · Closed by {s.closed_by_name}</span>
                              )}
                            </div>
                          </TD>

                          {/* Opening Cash */}
                          <TD right mono muted style={{ fontSize: '12.5px' }}>
                            {fmtRupee(s.opening_cash)}
                          </TD>

                          {/* Expected Cash */}
                          <TD right mono style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {fmtRupee(s.expected_cash)}
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                              Sales: +{fmtRupee(s.cash_sales_amount)} · Out: -{fmtRupee(s.cash_payouts_amount)}
                            </div>
                          </TD>

                          {/* Closing Counted */}
                          <TD right mono style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fmtRupee(s.closing_cash_counted)}
                          </TD>

                          {/* Discrepancy Amount */}
                          <TD right>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-pill)',
                                background: isShortage
                                  ? 'rgba(239,68,68,0.14)'
                                  : isSurplus
                                  ? 'rgba(16,185,129,0.14)'
                                  : 'rgba(107,114,128,0.12)',
                                border: isShortage
                                  ? '1px solid rgba(239,68,68,0.3)'
                                  : isSurplus
                                  ? '1px solid rgba(16,185,129,0.3)'
                                  : '1px solid rgba(107,114,128,0.2)',
                                color: isShortage ? '#EF4444' : isSurplus ? '#10B981' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12.5px',
                              }}
                            >
                              {isShortage && <TrendingDown size={13} />}
                              {isSurplus && <TrendingUp size={13} />}
                              {isShortage
                                ? `-₹${Math.abs(diff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : isSurplus
                                ? `+₹${Math.abs(diff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '₹0.00'}
                            </div>
                            <div style={{ fontSize: '10px', color: isShortage ? '#EF4444' : isSurplus ? '#10B981' : 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                              {isShortage ? 'Cash Shortage' : isSurplus ? 'Cash Surplus' : 'Balanced'}
                            </div>
                          </TD>

                          {/* Cashier Notes */}
                          <TD style={{ maxWidth: 220, whiteSpace: 'normal' }}>
                            {s.closing_notes ? (
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--text-secondary)',
                                  background: 'var(--bg-page)',
                                  padding: '5px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  fontStyle: 'italic',
                                  lineHeight: 1.35,
                                }}
                              >
                                “{s.closing_notes}”
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None provided</span>
                            )}
                          </TD>

                          {/* Settlement Status */}
                          <TD>
                            {isSettled ? (
                              <div>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-pill)',
                                    background: 'rgba(16,185,129,0.12)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    color: '#10B981',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                  }}
                                >
                                  <CheckCircle size={11} />
                                  Settled & Cleared
                                </span>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: 3 }}>
                                  {getSettlementActionLabel(s.settlement_action)}
                                </div>
                                {s.settled_by_name && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    By {s.settled_by_name} {s.settled_at ? `· ${fmtDateTime(s.settled_at)}` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: 'rgba(239,68,68,0.12)',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  color: '#EF4444',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <AlertTriangle size={11} />
                                Requires Review
                              </span>
                            )}
                          </TD>

                          {/* Action Button */}
                          <TD style={{ textAlign: 'center' }}>
                            {isSettled ? (
                              <button
                                onClick={() => openSettleModal(s)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-secondary)',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>Audit Details</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openSettleModal(s)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--brand-primary)',
                                  background: 'var(--brand-primary)',
                                  color: '#fff',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  boxShadow: '0 1px 4px rgba(197,34,36,0.2)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={12} />
                                <span>Verify & Settle</span>
                              </button>
                            )}
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableScroll>

                {/* Paginator */}
                {totalDiscPages > 1 && (
                  <div
                    className="dash-paginator"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 20px',
                      borderTop: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Showing {Math.min((discPage - 1) * DISC_PAGE_SIZE + 1, sortedAndFilteredDiscrepancies.length)}–
                      {Math.min(discPage * DISC_PAGE_SIZE, sortedAndFilteredDiscrepancies.length)} of {sortedAndFilteredDiscrepancies.length} discrepancy shifts
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setDiscPage((p) => Math.max(1, p - 1))}
                        disabled={discPage === 1}
                        style={pgBtnStyle(discPage === 1)}
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        onClick={() => setDiscPage((p) => Math.min(totalDiscPages, p + 1))}
                        disabled={discPage === totalDiscPages}
                        style={pgBtnStyle(discPage === totalDiscPages)}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </section>

        {/* ── CUSTOMER DUES & KHATA LEDGER WIDGET ─────────────────────── */}
        <section
          id="mod-customer-dues"
          className="dash-module-card dash-customer-dues-widget"
          style={{
            background: 'var(--bg-card)',
            border: duesSummary?.total_due_amount > 0 ? '1px solid rgba(236,72,153,0.35)' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: duesSummary?.total_due_amount > 0 ? '0 4px 20px rgba(236,72,153,0.08)' : 'var(--shadow-sm)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            className="dash-module-header"
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: duesSummary?.total_due_amount > 0
                ? 'linear-gradient(90deg, rgba(236,72,153,0.08) 0%, var(--bg-surface) 60%)'
                : 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(236,72,153,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid rgba(236,72,153,0.3)',
                }}
              >
                <Receipt size={19} color="#EC4899" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <h2
                    className="dash-module-title"
                    style={{
                      fontSize: '15.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    Customer Dues &amp; Khata Ledger
                  </h2>
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: 'var(--radius-pill)',
                      background: duesSummary?.total_due_amount > 0 ? 'rgba(236,72,153,0.16)' : 'rgba(16,185,129,0.12)',
                      border: duesSummary?.total_due_amount > 0 ? '1px solid rgba(236,72,153,0.35)' : '1px solid rgba(16,185,129,0.25)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: duesSummary?.total_due_amount > 0 ? '#EC4899' : '#10B981',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {duesSummary?.pending_orders_count || 0} Open Bills
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Track customer pending balances · Collect and settle dues into today's account records &amp; register shifts
                </p>
              </div>
            </div>

            {/* Header Right: Dues KPI Summary Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 14px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Total Outstanding Due
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#EC4899', fontFamily: 'var(--font-mono)' }}>
                    ₹{Number(duesSummary?.total_due_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Unique Debtors
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {duesSummary?.unique_debtors_count || 0} Customers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip active={duesFilter === 'all'} onClick={() => { setDuesFilter('all'); setDuesPage(1); }}>
                All Dues ({duesOrders.length})
              </FilterChip>
              <FilterChip
                active={duesFilter === 'high'}
                color="#EC4899"
                onClick={() => { setDuesFilter('high'); setDuesPage(1); }}
              >
                High Dues (≥ ₹1,000)
              </FilterChip>
              <FilterChip
                active={duesFilter === 'recent'}
                color="#38BDF8"
                onClick={() => { setDuesFilter('recent'); setDuesPage(1); }}
              >
                Recent (Last 7 Days)
              </FilterChip>
            </div>

            <SearchInput
              value={duesSearch}
              onChange={(v) => { setDuesSearch(v); setDuesPage(1); }}
              placeholder="Search debtor name, mobile, bill…"
            />
          </div>

          {/* Table Body */}
          {duesLoading ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border-color)', borderTopColor: '#EC4899', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ marginTop: 10, fontSize: '12.5px' }}>Loading customer dues ledger…</p>
            </div>
          ) : sortedAndFilteredDues.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={24} color="#10B981" style={{ marginBottom: 6 }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                {duesSearch ? 'No dues matching your search.' : 'All customer accounts are clear! No pending dues.'}
              </p>
            </div>
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH>Debtor Customer</TH>
                    <TH>Invoice / Bill #</TH>
                    <TH>Store</TH>
                    <TH right>Total Bill</TH>
                    <TH right>Paid Earlier</TH>
                    <TH right>Outstanding Due</TH>
                    <TH style={{ textAlign: 'center' }}>Action</TH>
                  </tr>
                </thead>
                <tbody>
                  {pagedDues.map((order) => {
                    const custName = order.customer_name || (order.customer_display_name && !order.customer_display_name.startsWith('Customer (') ? order.customer_display_name : '') || 'Walk-in Customer';
                    const custPhone = order.customer_phone || '';
                    const totalAmt = parseFloat(order.total_amount || 0);
                    const paidAmt = parseFloat(order.amount_paid || 0);
                    const dueAmt = parseFloat(order.balance_due || 0);
                    const dStr = order.created_at ? fmtDateTime(order.created_at) : '—';

                    return (
                      <tr key={order.id} style={{ transition: 'background-color 0.15s ease' }}>
                        <TD>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {custName}
                          </div>
                          {custPhone && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Phone size={10} style={{ opacity: 0.7 }} />
                              <span>{custPhone}</span>
                            </div>
                          )}
                        </TD>

                        <TD>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8', fontSize: '12.5px' }}>
                            {order.invoice_number || `#ORD-${order.id}`}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                            {dStr}
                          </div>
                        </TD>

                        <TD>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.22)',
                            color: '#60A5FA',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}>
                            <StoreIcon size={10} />
                            {order.store_name || `Store #${order.store}`}
                          </span>
                        </TD>

                        <TD right mono muted style={{ fontSize: '12.5px' }}>
                          ₹{totalAmt.toFixed(2)}
                        </TD>

                        <TD right mono style={{ fontSize: '12.5px', color: '#10B981', fontWeight: 600 }}>
                          ₹{paidAmt.toFixed(2)}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {order.initial_payment_method || order.payment_method || 'Cash'}
                          </div>
                        </TD>

                        <TD right mono>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'rgba(236,72,153,0.14)',
                            border: '1px solid rgba(236,72,153,0.3)',
                            color: '#EC4899',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '13px',
                          }}>
                            ₹{dueAmt.toFixed(2)}
                          </div>
                        </TD>

                        <TD style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenDueSettle(order)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid #EC4899',
                              background: 'rgba(236,72,153,0.12)',
                              color: '#EC4899',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                            title="Collect remaining balance and credit to today's accounts"
                          >
                            <Wallet size={12} />
                            <span>Collect &amp; Settle</span>
                          </button>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>

              {totalDuesPages > 1 && (
                <div
                  className="dash-paginator"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 20px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Showing {Math.min((duesPage - 1) * DUES_PAGE_SIZE + 1, sortedAndFilteredDues.length)}–
                    {Math.min(duesPage * DUES_PAGE_SIZE, sortedAndFilteredDues.length)} of {sortedAndFilteredDues.length} due accounts
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setDuesPage((p) => Math.max(1, p - 1))}
                      disabled={duesPage === 1}
                      style={pgBtnStyle(duesPage === 1)}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => setDuesPage((p) => Math.min(totalDuesPages, p + 1))}
                      disabled={duesPage === totalDuesPages}
                      style={pgBtnStyle(duesPage === totalDuesPages)}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── EMPLOYEE WIDGETS ROW ─────────────────────────────────── */}
        <div className="dash-employee-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Widget 1: Today's Attendance */}
          <section className="dash-widget-section" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
          }}>
            <div className="dash-widget-header" style={{
              padding: '14px 18px 12px', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: 'rgba(59,130,246,0.10)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Users size={15} color="#3B82F6" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Today's Attendance</h2>
                  <span style={{
                    padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                    fontSize: '10px', fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>Live Today</span>
                  <span style={{
                    padding: '1px 7px', borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-page)', border: '1px solid var(--border-color)',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
                  }}>{attData.length}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Current store roster · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              </div>
              <div className="dash-widget-search" style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={attSearch} onChange={e => { setAttSearch(e.target.value); setAttPage(1); }}
                  placeholder="Search…" style={{
                    height: 28, width: 130, paddingLeft: 24, paddingRight: 8,
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    fontSize: '11.5px', fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
              </div>
            </div>
            {attLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
            ) : attData.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <UserCheck size={28} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No attendance records for today.</p>
              </div>
            ) : (() => {
              const attFiltered = attData.filter(r =>
                !attSearch || r.employee_name?.toLowerCase().includes(attSearch.toLowerCase()) || r.employee_code?.toLowerCase().includes(attSearch.toLowerCase())
              );
              const attStatusColor = { present: '#10B981', late: '#10B981', half_day: '#F59E0B', absent: '#EF4444', needs_review: '#F97316', paid_leave: '#3B82F6', unpaid_leave: '#8B5CF6', weekly_off: 'var(--text-muted)', holiday: '#06B6D4' };
              const attStatusLabel = { present: 'Present', late: 'Late', half_day: 'Half Day', absent: 'Absent', needs_review: 'Review', paid_leave: 'Leave', unpaid_leave: 'UPL', weekly_off: 'Off', holiday: 'Holiday' };
              const paged = attFiltered.slice((attPage - 1) * ATT_PAGE_SIZE, attPage * ATT_PAGE_SIZE);
              const totalAttPages = Math.max(1, Math.ceil(attFiltered.length / ATT_PAGE_SIZE));
              return (
                <>
                  <div className="dash-table-scroll" style={{ overflowX: 'auto' }}>
                    <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-page)' }}>
                          {['Employee', 'Status', 'Punch In', 'Punch Out'].map(h => (
                            <th key={h} style={{ padding: '7px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((r, i) => (
                          <tr key={r.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '9px 14px' }}>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{r.employee_name}</div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {r.employee_code}{r.role_name ? ` · ${r.role_name}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: (attStatusColor[r.status] || 'var(--text-muted)') + '18',
                                color: attStatusColor[r.status] || 'var(--text-muted)',
                                fontSize: '11px', fontWeight: 600,
                              }}>{attStatusLabel[r.status] || r.status}</span>
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: r.first_in ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {r.first_in ? new Date(r.first_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: r.last_out ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {r.last_out ? new Date(r.last_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalAttPages > 1 && (
                    <div className="dash-paginator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {Math.min((attPage - 1) * ATT_PAGE_SIZE + 1, attFiltered.length)}–{Math.min(attPage * ATT_PAGE_SIZE, attFiltered.length)} of {attFiltered.length}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setAttPage(p => Math.max(1, p - 1))} disabled={attPage === 1} style={pgBtnStyle(attPage === 1)}><ChevronLeft size={13} /></button>
                        <button onClick={() => setAttPage(p => Math.min(totalAttPages, p + 1))} disabled={attPage === totalAttPages} style={pgBtnStyle(attPage === totalAttPages)}><ChevronRight size={13} /></button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </section>

          {/* Widget 2: Salary Balance Owed */}
          <section className="dash-widget-section" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
          }}>
            <div className="dash-widget-header" style={{
              padding: '14px 18px 12px', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: 'rgba(245,158,11,0.12)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Wallet size={15} color="#F59E0B" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Salary Balance Owed</h2>
                  <span style={{
                    padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                    fontSize: '10px', fontWeight: 600, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>Live Balance</span>
                  <span style={{
                    padding: '1px 7px', borderRadius: 'var(--radius-pill)',
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                    fontSize: '11px', fontWeight: 600, color: '#F59E0B',
                  }}>{balanceData.length}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Current unpaid staff liabilities · Highest first</p>
              </div>
              <div className="dash-widget-search" style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={balanceSearch} onChange={e => { setBalanceSearch(e.target.value); setBalancePage(1); }}
                  placeholder="Search…" style={{
                    height: 28, width: 130, paddingLeft: 24, paddingRight: 8,
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    fontSize: '11.5px', fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
              </div>
            </div>
            {balanceLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
            ) : balanceData.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Wallet size={28} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>All salary balances are settled.</p>
              </div>
            ) : (() => {
              const balFiltered = balanceData.filter(r =>
                !balanceSearch || r.employee_name?.toLowerCase().includes(balanceSearch.toLowerCase()) || r.employee_code?.toLowerCase().includes(balanceSearch.toLowerCase())
              );
              const paged = balFiltered.slice((balancePage - 1) * BAL_PAGE_SIZE, balancePage * BAL_PAGE_SIZE);
              const totalBalPages = Math.max(1, Math.ceil(balFiltered.length / BAL_PAGE_SIZE));
              return (
                <>
                  <div className="dash-table-scroll" style={{ overflowX: 'auto' }}>
                    <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-page)' }}>
                          {['Employee', 'Code', 'Balance Owed'].map(h => (
                            <th key={h} style={{ padding: '7px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((r, i) => {
                          const bal = parseFloat(r.balance);
                          return (
                            <tr key={r.employee_id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '9px 14px' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{r.employee_name}</div>
                              </td>
                              <td style={{ padding: '9px 14px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {r.employee_code || '—'}
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px',
                                  color: bal > 10000 ? '#EF4444' : bal > 3000 ? '#F59E0B' : '#10B981',
                                }}>
                                  ₹{bal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalBalPages > 1 && (
                    <div className="dash-paginator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {Math.min((balancePage - 1) * BAL_PAGE_SIZE + 1, balFiltered.length)}–{Math.min(balancePage * BAL_PAGE_SIZE, balFiltered.length)} of {balFiltered.length}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setBalancePage(p => Math.max(1, p - 1))} disabled={balancePage === 1} style={pgBtnStyle(balancePage === 1)}><ChevronLeft size={13} /></button>
                        <button onClick={() => setBalancePage(p => Math.min(totalBalPages, p + 1))} disabled={balancePage === totalBalPages} style={pgBtnStyle(balancePage === totalBalPages)}><ChevronRight size={13} /></button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        </div>

        {/* ── MODULE 1: Best-Selling Products ─────────────────────────── */}
        <ModuleCard
          id="mod-best-selling"
          icon={TrendingUp}
          title="Best-Selling Products"
          subtitle={`Top performers by sales in ${rangeConfig.label || 'selected period'}`}
          count={bestSellersFiltered.length}
          loading={loading}
          error={error}
        >
          {/* Controls */}
          <div className="dash-module-controls" style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginRight: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={bsSort === 'units_sold'} onClick={() => { setBsSort('units_sold'); setBsPage(1); }}>Units Sold</SortButton>
            <SortButton active={bsSort === 'revenue'} onClick={() => { setBsSort('revenue'); setBsPage(1); }}>Revenue</SortButton>
            <SortButton active={bsSort === 'gross_profit'} onClick={() => { setBsSort('gross_profit'); setBsPage(1); }}>Gross Profit</SortButton>
            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={bsSearch} onChange={(v) => { setBsSearch(v); setBsPage(1); }} placeholder="Search products…" />
          </div>

          {bestSellersFiltered.length === 0 ? (
            <EmptyState message="No sales data found for the selected period." icon={TrendingUp} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 44 }}>#</TH>
                    <TH>Product</TH>
                    <TH>UID</TH>
                    <TH>Category</TH>
                    <TH right>Units Sold</TH>
                    <TH right>Revenue</TH>
                    <TH right>Gross Profit</TH>
                    <TH right>Margin %</TH>
                    <TH>Stock</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(bestSellersFiltered, bsPage).map((p, i) => {
                    const rank = (bsPage - 1) * PAGE_SIZE + i + 1;
                    const margin = p.revenue > 0 ? ((p.gross_profit || 0) / p.revenue) * 100 : 0;
                    const stockStatus = p.current_stock <= 0 ? 'out_of_stock'
                      : p.current_stock <= 5 ? 'critically_low'
                      : p.current_stock <= 15 ? 'low_stock' : 'healthy';
                    return (
                      <tr key={p.item_id || i} className="dash-row" style={rowHover(i)}>
                        <TD style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>
                          {rank}
                        </TD>
                        <TD style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                          {p.name}
                        </TD>
                        <TD mono muted style={{ fontSize: '11.5px' }}>{p.uid}</TD>
                        <TD muted style={{ fontSize: '12px' }}>{p.primary_category_name || p.category_name || '—'}</TD>
                        <TD right mono>{fmtNum(p.units_sold)}</TD>
                        <TD right mono style={{ fontWeight: 600 }}>{fmtCompact(p.revenue)}</TD>
                        <TD right mono style={{ color: (p.gross_profit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                          {fmtCompact(p.gross_profit)}
                        </TD>
                        <TD right mono style={{ color: margin >= 20 ? 'var(--color-success)' : margin >= 10 ? 'var(--color-warning)' : 'var(--color-danger)', fontWeight: 600 }}>
                          {margin.toFixed(1)}%
                        </TD>
                        <TD><StatusBadge type={stockStatus} label={`${fmtNum(p.current_stock)} units`} /></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={bsPage} total={bestSellersFiltered.length} onChange={setBsPage} />
            </>
          )}
        </ModuleCard>

        {/* ── MODULE 2: Slow-Moving & Dead Stock ──────────────────────── */}
        <ModuleCard
          id="mod-slow-moving"
          icon={TrendingDown}
          title="Slow-Moving & Dead Stock"
          subtitle="Products with little or no sales — capital tied up in idle inventory"
          count={slowMovingFiltered.length}
          loading={loading}
          error={error}
        >
          <div className="dash-module-controls" style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
            <FilterChip active={smFilter === 'all'} onClick={() => { setSmFilter('all'); setSmPage(1); }}>All</FilterChip>
            <FilterChip active={smFilter === 'dead'} onClick={() => { setSmFilter('dead'); setSmPage(1); }} color="#EF4444">Dead Stock</FilterChip>
            <FilterChip active={smFilter === 'slow'} onClick={() => { setSmFilter('slow'); setSmPage(1); }} color="#F59E0B">Slow Moving</FilterChip>
            <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={smSort === 'tied_capital'} onClick={() => { setSmSort('tied_capital'); setSmPage(1); }}>Tied Capital</SortButton>
            <SortButton active={smSort === 'quantity'} onClick={() => { setSmSort('quantity'); setSmPage(1); }}>Stock Qty</SortButton>
            <SortButton active={smSort === 'revenue'} onClick={() => { setSmSort('revenue'); setSmPage(1); }}>Revenue</SortButton>
            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={smSearch} onChange={(v) => { setSmSearch(v); setSmPage(1); }} placeholder="Search products…" />
          </div>

          {slowMovingFiltered.length === 0 ? (
            <EmptyState message="No slow-moving products found for the selected period." icon={Package} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 44 }}>#</TH>
                    <TH>Product</TH>
                    <TH>UID</TH>
                    <TH>Category</TH>
                    <TH right>Stock Qty</TH>
                    <TH right>Units Sold</TH>
                    <TH right>Revenue</TH>
                    <TH right>Tied Capital</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(slowMovingFiltered, smPage).map((p, i) => {
                    const rank = (smPage - 1) * PAGE_SIZE + i + 1;
                    const tiedCapital = (p.current_stock || 0) * (p.cost_price || 0);
                    const status = (p.units_sold || 0) === 0 ? 'dead_stock'
                      : (p.units_sold || 0) <= 3 ? 'slow_moving' : 'moderate';
                    return (
                      <tr key={p.item_id || i} className="dash-row" style={rowHover(i)}>
                        <TD style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>{rank}</TD>
                        <TD style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</TD>
                        <TD mono muted style={{ fontSize: '11.5px' }}>{p.uid}</TD>
                        <TD muted style={{ fontSize: '12px' }}>{p.primary_category_name || p.category_name || '—'}</TD>
                        <TD right mono style={{ fontWeight: 600 }}>{fmtNum(p.current_stock)}</TD>
                        <TD right mono style={{ color: (p.units_sold || 0) === 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {fmtNum(p.units_sold)}
                        </TD>
                        <TD right mono>{fmtCompact(p.revenue)}</TD>
                        <TD right mono style={{ fontWeight: 600, color: tiedCapital > 50000 ? 'var(--color-danger)' : tiedCapital > 10000 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                          {fmtCompact(tiedCapital)}
                        </TD>
                        <TD><StatusBadge type={status} /></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={smPage} total={slowMovingFiltered.length} onChange={setSmPage} />
            </>
          )}
        </ModuleCard>

        {/* ── MODULE 3: Fast-Moving Inventory ─────────────────────────── */}
        <ModuleCard
          id="mod-fast-moving"
          icon={Flame}
          title="Fast-Moving Inventory"
          subtitle="High-velocity products — monitor for stockout risk"
          count={fastMoversFiltered.length}
          loading={loading}
          error={error}
        >
          <div className="dash-module-controls" style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={fmSort === 'units_sold'} onClick={() => { setFmSort('units_sold'); setFmPage(1); }}>Units Sold</SortButton>
            <SortButton active={fmSort === 'velocity'} onClick={() => { setFmSort('velocity'); setFmPage(1); }}>Daily Velocity</SortButton>
            <SortButton active={fmSort === 'revenue'} onClick={() => { setFmSort('revenue'); setFmPage(1); }}>Revenue</SortButton>
            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={fmSearch} onChange={(v) => { setFmSearch(v); setFmPage(1); }} placeholder="Search products…" />
          </div>

          {fastMoversFiltered.length === 0 ? (
            <EmptyState message="No sales data found for the selected period." icon={Flame} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 44 }}>#</TH>
                    <TH>Product</TH>
                    <TH>Category</TH>
                    <TH right>Units Sold</TH>
                    <TH right>Revenue</TH>
                    <TH right>Daily Velocity</TH>
                    <TH right>Stock Left</TH>
                    <TH right>Est. Runout</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(fastMoversFiltered, fmPage).map((p, i) => {
                    const rank = (fmPage - 1) * PAGE_SIZE + i + 1;
                    const runout = p.est_days_left;
                    const runoutColor = runout === null ? 'var(--text-muted)'
                      : runout <= 7 ? '#EF4444' : runout <= 30 ? '#F59E0B' : 'var(--color-success)';
                    return (
                      <tr key={p.item_id || i} className="dash-row" style={rowHover(i)}>
                        <TD style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>{rank}</TD>
                        <TD style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</TD>
                        <TD muted style={{ fontSize: '12px' }}>{p.primary_category_name || p.category_name || '—'}</TD>
                        <TD right mono style={{ fontWeight: 600 }}>{fmtNum(p.units_sold)}</TD>
                        <TD right mono>{fmtCompact(p.revenue)}</TD>
                        <TD right mono style={{ fontWeight: 600 }}>{p.daily_velocity.toFixed(2)}/day</TD>
                        <TD right mono>{fmtNum(p.current_stock)}</TD>
                        <TD right style={{ fontWeight: 600, color: runoutColor, fontFamily: 'var(--font-mono)' }}>
                          {runout === null ? '—' : runout <= 0 ? 'OOS' : `${runout}d`}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={fmPage} total={fastMoversFiltered.length} onChange={setFmPage} />
            </>
          )}
        </ModuleCard>

        {/* ── MODULE 4: Out of Stock & Critically Low ──────────────────── */}
        <ModuleCard
          id="mod-out-of-stock"
          icon={AlertTriangle}
          title="Out of Stock & Critically Low"
          subtitle="Live inventory status — products requiring immediate restocking"
          count={oosFiltered.length}
          loading={loading}
          error={error}
        >
          <div className="dash-module-controls" style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
            <FilterChip active={oosFilter === 'all'} onClick={() => { setOosFilter('all'); setOosPage(1); }}>All</FilterChip>
            <FilterChip active={oosFilter === 'out'} onClick={() => { setOosFilter('out'); setOosPage(1); }} color="#EF4444">Out of Stock</FilterChip>
            <FilterChip active={oosFilter === 'critical'} onClick={() => { setOosFilter('critical'); setOosPage(1); }} color="#F97316">Critically Low</FilterChip>
            <FilterChip active={oosFilter === 'depleting'} onClick={() => { setOosFilter('depleting'); setOosPage(1); }} color="#F59E0B">Depleting Fast</FilterChip>
            <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={oosSort === 'urgency'} onClick={() => { setOosSort('urgency'); setOosPage(1); }}>Urgency</SortButton>
            <SortButton active={oosSort === 'units_sold'} onClick={() => { setOosSort('units_sold'); setOosPage(1); }}>Units Sold</SortButton>
            <SortButton active={oosSort === 'stock'} onClick={() => { setOosSort('stock'); setOosPage(1); }}>Stock Level</SortButton>
            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={oosSearch} onChange={(v) => { setOosSearch(v); setOosPage(1); }} placeholder="Search products…" />
          </div>

          {oosFiltered.length === 0 ? (
            <EmptyState message="No stock depletion alerts found." icon={Package} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 44 }}>#</TH>
                    <TH>Product</TH>
                    <TH>UID</TH>
                    <TH>Category</TH>
                    <TH right>Current Stock</TH>
                    <TH right>Units Sold</TH>
                    <TH right>Revenue</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(oosFiltered, oosPage).map((p, i) => {
                    const rank = (oosPage - 1) * PAGE_SIZE + i + 1;
                    return (
                      <tr key={p.item_id || i} className="dash-row" style={rowHover(i)}>
                        <TD style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>{rank}</TD>
                        <TD style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</TD>
                        <TD mono muted style={{ fontSize: '11.5px' }}>{p.uid}</TD>
                        <TD muted style={{ fontSize: '12px' }}>{p.primary_category_name || p.category_name || '—'}</TD>
                        <TD right mono style={{
                          fontWeight: 700,
                          color: p.current_stock <= 0 ? '#EF4444' : p.current_stock <= 5 ? '#F97316' : 'var(--text-primary)',
                        }}>
                          {p.current_stock <= 0 ? '0' : fmtNum(p.current_stock)}
                        </TD>
                        <TD right mono>{fmtNum(p.units_sold)}</TD>
                        <TD right mono>{fmtCompact(p.revenue)}</TD>
                        <TD><StatusBadge type={p.stock_status || (p.current_stock <= 0 ? 'out_of_stock' : p.current_stock <= 5 ? 'critically_low' : 'depleting_fast')} /></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={oosPage} total={oosFiltered.length} onChange={setOosPage} />
            </>
          )}
        </ModuleCard>

        {/* ── MODULE 5: Expired & About to Expire ─────────────────────── */}
        <ModuleCard
          id="mod-expiry"
          icon={Clock}
          title="Expired & About to Expire"
          subtitle="Live expiry status — items requiring immediate attention or disposal"
          count={exFiltered.length}
          loading={expiryLoading}
          error={null}
        >
          {/* Expiry summary pills */}
          {expirySummary.total_with_expiry > 0 && (
            <div className="dash-expiry-pills" style={{
              padding: '12px 20px', display: 'flex', gap: 10, flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)',
            }}>
              {expirySummary.expired_count > 0 && (
                <div style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>
                    {expirySummary.expired_count} Expired
                  </span>
                </div>
              )}
              {expirySummary.critical_count > 0 && (
                <div style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
                  <span style={{ fontSize: '11px', color: '#F97316', fontWeight: 700 }}>
                    {expirySummary.critical_count} Critical (≤7 days)
                  </span>
                </div>
              )}
              {expirySummary.warning_count > 0 && (
                <div style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 700 }}>
                    {expirySummary.warning_count} Warning (≤30 days)
                  </span>
                </div>
              )}
              {expirySummary.total_potential_loss > 0 && (
                <div style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(197,34,36,0.06)', border: '1px solid rgba(197,34,36,0.2)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                    Potential Loss: {fmtCompact(expirySummary.total_potential_loss)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="dash-module-controls" style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
            <FilterChip active={exFilter === 'all'} onClick={() => { setExFilter('all'); setExPage(1); }}>All</FilterChip>
            <FilterChip active={exFilter === 'expired'} onClick={() => { setExFilter('expired'); setExPage(1); }} color="#EF4444">Expired</FilterChip>
            <FilterChip active={exFilter === 'expires_today'} onClick={() => { setExFilter('expires_today'); setExPage(1); }} color="#EF4444">Today</FilterChip>
            <FilterChip active={exFilter === 'critical'} onClick={() => { setExFilter('critical'); setExPage(1); }} color="#F97316">Critical ≤7d</FilterChip>
            <FilterChip active={exFilter === 'warning'} onClick={() => { setExFilter('warning'); setExPage(1); }} color="#F59E0B">Warning ≤30d</FilterChip>
            <FilterChip active={exFilter === 'notice'} onClick={() => { setExFilter('notice'); setExPage(1); }} color="#3B82F6">Notice ≤90d</FilterChip>
            <FilterChip active={exFilter === 'ok'} onClick={() => { setExFilter('ok'); setExPage(1); }} color="#10B981">OK</FilterChip>
            <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={exSort === 'days_asc'} onClick={() => { setExSort('days_asc'); setExPage(1); }}>Earliest First</SortButton>
            <SortButton active={exSort === 'days_desc'} onClick={() => { setExSort('days_desc'); setExPage(1); }}>Latest First</SortButton>
            <SortButton active={exSort === 'stock'} onClick={() => { setExSort('stock'); setExPage(1); }}>Stock Qty</SortButton>
            <SortButton active={exSort === 'loss'} onClick={() => { setExSort('loss'); setExPage(1); }}>Potential Loss</SortButton>
            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={exSearch} onChange={(v) => { setExSearch(v); setExPage(1); }} placeholder="Search products…" />
          </div>

          {exFiltered.length === 0 ? (
            <EmptyState message="No items with expiry dates found." icon={Clock} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 44 }}>#</TH>
                    <TH>Product</TH>
                    <TH>UID</TH>
                    <TH>Category</TH>
                    <TH>Expiry Date</TH>
                    <TH right>Days</TH>
                    <TH right>Stock Qty</TH>
                    <TH right>Potential Loss</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(exFiltered, exPage).map((p, i) => {
                    const rank = (exPage - 1) * PAGE_SIZE + i + 1;
                    const days = p.days_until_expiry;
                    const daysColor = days < 0 ? '#EF4444' : days === 0 ? '#EF4444'
                      : days <= 7 ? '#F97316' : days <= 30 ? '#F59E0B'
                      : days <= 90 ? '#3B82F6' : 'var(--color-success)';
                    return (
                      <tr key={p.item_id || i} className="dash-row" style={rowHover(i)}>
                        <TD style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>{rank}</TD>
                        <TD style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</TD>
                        <TD mono muted style={{ fontSize: '11.5px' }}>{p.uid}</TD>
                        <TD muted style={{ fontSize: '12px' }}>{p.category_name || '—'}</TD>
                        <TD mono style={{ fontSize: '12.5px' }}>{p.expiry_date}</TD>
                        <TD right mono style={{ fontWeight: 700, color: daysColor }}>
                          {days < 0 ? `${days}d` : days === 0 ? '0d' : `+${days}d`}
                        </TD>
                        <TD right mono style={{ fontWeight: 600 }}>{fmtNum(p.current_stock)}</TD>
                        <TD right mono style={{
                          fontWeight: 600,
                          color: p.potential_loss > 0 ? (p.potential_loss > 50000 ? '#EF4444' : '#F59E0B') : 'var(--text-muted)',
                        }}>
                          {p.potential_loss > 0 ? fmtCompact(p.potential_loss) : '—'}
                        </TD>
                        <TD><StatusBadge type={p.urgency} label={p.status_label} /></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={exPage} total={exFiltered.length} onChange={setExPage} />
            </>
          )}
        </ModuleCard>

        {/* ── MODULE: Damaged & Broken Stock Audit ──────────────────── */}
        <ModuleCard
          id="mod-broken-items"
          icon={AlertTriangle}
          title="Damaged & Broken Stock Audit"
          subtitle="Physical merchandise damaged or broken on store floor — audit photos & staff fine ledger"
          count={brokenFiltered.length}
          loading={brokenLoading}
          error={brokenError}
        >
          {/* Summary Pills Banner */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-color)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Total Damage Loss</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#EF4444', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {fmtRupee(brokenStats.totalLoss)}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Damaged Units</span>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {fmtNum(brokenStats.totalUnits)}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '10.5px', color: '#EF4444', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Pending Decision</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#EF4444', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {fmtNum(brokenStats.pendingCount)}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '10.5px', color: '#3B82F6', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Store Loss (No Fine)</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#3B82F6', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {fmtNum(brokenStats.waivedCount)}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '10.5px', color: '#10B981', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Fined to Staff</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {fmtNum(brokenStats.finedCount)} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>({fmtRupee(brokenStats.totalFines)})</span>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {brokenSuccessMsg && (
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(16, 185, 129, 0.12)',
                borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10B981',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle size={15} />
              <span>{brokenSuccessMsg}</span>
            </div>
          )}

          {/* Controls Bar */}
          <div
            className="dash-module-controls"
            style={{
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
            <FilterChip active={brokenFilter === 'all'} onClick={() => { setBrokenFilter('all'); setBrokenPage(1); }}>All ({brokenReports.length})</FilterChip>
            <FilterChip active={brokenFilter === 'pending' || brokenFilter === 'unfined'} onClick={() => { setBrokenFilter('pending'); setBrokenPage(1); }} color="#EF4444">Needs Action ({brokenStats.pendingCount})</FilterChip>
            <FilterChip active={brokenFilter === 'waived'} onClick={() => { setBrokenFilter('waived'); setBrokenPage(1); }} color="#3B82F6">Store Loss / No Fine ({brokenStats.waivedCount})</FilterChip>
            <FilterChip active={brokenFilter === 'fined'} onClick={() => { setBrokenFilter('fined'); setBrokenPage(1); }} color="#10B981">Fined to Staff ({brokenStats.finedCount})</FilterChip>

            <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />

            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <SortButton active={brokenSort === 'date_desc'} onClick={() => { setBrokenSort('date_desc'); setBrokenPage(1); }}>Most Recent</SortButton>
            <SortButton active={brokenSort === 'loss_desc'} onClick={() => { setBrokenSort('loss_desc'); setBrokenPage(1); }}>Highest Loss</SortButton>
            <SortButton active={brokenSort === 'loss_asc'} onClick={() => { setBrokenSort('loss_asc'); setBrokenPage(1); }}>Lowest Loss</SortButton>

            <div className="dash-controls-spacer" style={{ flex: 1 }} />
            <SearchInput value={brokenSearch} onChange={(v) => { setBrokenSearch(v); setBrokenPage(1); }} placeholder="Search product, reason, staff…" />
          </div>

          {/* Table / Empty State */}
          {brokenFiltered.length === 0 ? (
            <EmptyState message="No broken or damaged inventory reports found." icon={AlertTriangle} />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <TH style={{ width: 50 }}>Proof</TH>
                    <TH>Product Name</TH>
                    <TH>UID</TH>
                    <TH right>Units</TH>
                    <TH right>Cost Price</TH>
                    <TH right>Total Loss</TH>
                    <TH>Reason / Incident</TH>
                    <TH>Branch &amp; Staff</TH>
                    <TH>Fine Status</TH>
                    <TH style={{ textAlign: 'center' }}>Action</TH>
                  </tr>
                </thead>
                <tbody>
                  {paginate(brokenFiltered, brokenPage).map((r, i) => {
                    const isFined = Boolean(r.is_fined);
                    const isWaived = Boolean(r.is_waived);
                    return (
                      <tr key={r.id || i} className="dash-row" style={rowHover(i)}>
                        {/* Proof photo thumbnail */}
                        <TD style={{ width: 50, padding: '8px 12px' }}>
                          {r.proof_image || r.proof_image_url ? (
                            <div
                              onClick={() => setBrokenLightboxImage(r.proof_image || r.proof_image_url)}
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 6,
                                overflow: 'hidden',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                position: 'relative',
                                background: '#0b0e17',
                              }}
                            >
                              <img
                                src={r.proof_image || r.proof_image_url}
                                alt="Damage"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                }}
                              >
                                <ZoomIn size={12} />
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 6,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <Package size={16} />
                            </div>
                          )}
                        </TD>

                        {/* Product */}
                        <TD style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                          <div>{r.item_name || 'Damaged Product'}</div>
                          {r.section_name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {r.section_name}
                            </div>
                          )}
                        </TD>

                        {/* UID */}
                        <TD mono muted style={{ fontSize: '11.5px' }}>{r.item_uid || '—'}</TD>

                        {/* Units */}
                        <TD right mono style={{ fontWeight: 600 }}>{fmtNum(r.quantity)}</TD>

                        {/* Cost Price */}
                        <TD right mono muted style={{ fontSize: '12px' }}>₹{Number(r.cost_price || 0).toFixed(2)}</TD>

                        {/* Total Loss */}
                        <TD right mono style={{ fontWeight: 800, color: '#EF4444' }}>
                          -₹{Number(r.total_loss || 0).toFixed(2)}
                        </TD>

                        {/* Reason */}
                        <TD style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {r.reason || 'No explanation provided.'}
                        </TD>

                        {/* Branch & Staff */}
                        <TD style={{ fontSize: '11.5px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.reported_by_name || 'Staff Member'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {r.store_name} · {fmtDateTime(r.created_at)}
                          </div>
                        </TD>

                        {/* Fine Status */}
                        <TD>
                          {isFined ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <CheckCircle2 size={11} /> Fined ₹{Number(r.fine_amount || r.total_loss).toFixed(2)} ({r.fined_employee_name || 'Staff'})
                            </span>
                          ) : isWaived ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#3B82F6',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <ShieldCheck size={11} /> Store Loss (No Fine)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              <AlertCircle size={11} /> Pending Decision
                            </span>
                          )}
                        </TD>

                        {/* Action */}
                        <TD style={{ textAlign: 'center' }}>
                          {!isFined && !isWaived ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setFineModalReport(r)}
                                title="Fine employee cost price via ledger deduction"
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#EF4444',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Gavel size={12} /> Fine Employee
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickNoFine(r)}
                                disabled={waivingReportId === r.id}
                                title="No fine to employee — absorb entirely as store operational loss"
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  color: '#3B82F6',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: waivingReportId === r.id ? 'wait' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                  opacity: waivingReportId === r.id ? 0.7 : 1,
                                }}
                              >
                                <ShieldCheck size={12} /> {waivingReportId === r.id ? 'Waiving…' : 'No Fine'}
                              </button>
                            </div>
                          ) : isWaived ? (
                            <span style={{ fontSize: '11px', color: '#3B82F6', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <ShieldCheck size={12} /> Store Absorbed ✓
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> Ledger Posted ✓
                            </span>
                          )}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
              <Paginator page={brokenPage} total={brokenFiltered.length} onChange={setBrokenPage} />
            </>
          )}
        </ModuleCard>

      </div>

      {/* ── REGISTER SHIFT DISCREPANCY & AUDIT LEDGER MODAL ──────────────── */}
      {isLedgerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsLedgerModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: 1220,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(197,34,36,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(197,34,36,0.25)',
                  }}
                >
                  <FileText size={18} color="var(--brand-primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Register Shift Discrepancy & Cash Audit Ledger
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                    Comprehensive historical log of cash drawers, physical closing counts, variance resolutions & manager audits
                  </p>
                </div>
              </div>

              {/* Header Actions: Scope Switcher, CSV Export & Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Scope Switcher Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 2,
                  gap: 2,
                }}>
                  <button
                    type="button"
                    onClick={() => { setLedgerScope('period'); setLedgerPage(1); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: 'none',
                      background: ledgerScope === 'period' ? 'var(--brand-primary)' : 'transparent',
                      color: ledgerScope === 'period' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {rangeConfig?.isAllTime ? 'All Time' : (rangeConfig?.label || 'Selected Period')} ({allRegisterShifts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLedgerScope('all'); setLedgerPage(1); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: 'none',
                      background: ledgerScope === 'all' ? 'var(--brand-primary)' : 'transparent',
                      color: ledgerScope === 'all' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All-Time History ({allTimeShifts.length})
                  </button>
                </div>

                <button
                  onClick={() => exportLedgerCSV(sortedAndFilteredLedger)}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => setIsLedgerModalOpen(false)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* KPI Summary Banner inside Modal */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                padding: '16px 24px',
                background: 'var(--bg-page)',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Shifts Logged</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {ledgerStats.totalLogged}
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Shifts with Discrepancy</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#EF4444', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {ledgerStats.discrepancyCount}
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Unsettled Discrepancies</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: ledgerStats.unsettledCount > 0 ? '#EF4444' : '#10B981', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {ledgerStats.unsettledCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>({ledgerStats.settledCount} settled)</span>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Net Discrepancy (Unsettled)</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: ledgerStats.netVariance < 0 ? '#EF4444' : ledgerStats.netVariance > 0 ? '#10B981' : 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {ledgerStats.netVariance < 0 ? `-₹${Math.abs(ledgerStats.netVariance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ledgerStats.netVariance > 0 ? `+₹${ledgerStats.netVariance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* Filter Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <FilterChip active={ledgerFilter === 'discrepancies'} onClick={() => { setLedgerFilter('discrepancies'); setLedgerPage(1); }}>
                  Discrepancies ({ledgerStats.discrepancyCount})
                </FilterChip>
                <FilterChip active={ledgerFilter === 'unsettled'} color="#EF4444" onClick={() => { setLedgerFilter('unsettled'); setLedgerPage(1); }}>
                  Unsettled ({ledgerStats.unsettledCount})
                </FilterChip>
                <FilterChip active={ledgerFilter === 'settled'} color="#10B981" onClick={() => { setLedgerFilter('settled'); setLedgerPage(1); }}>
                  Settled ({ledgerStats.settledCount})
                </FilterChip>
                <FilterChip active={ledgerFilter === 'shortages'} color="#EF4444" onClick={() => { setLedgerFilter('shortages'); setLedgerPage(1); }}>
                  Shortages ({ledgerStats.shortagesCount})
                </FilterChip>
                <FilterChip active={ledgerFilter === 'surpluses'} color="#10B981" onClick={() => { setLedgerFilter('surpluses'); setLedgerPage(1); }}>
                  Surpluses ({ledgerStats.surplusesCount})
                </FilterChip>
                <FilterChip active={ledgerFilter === 'all'} onClick={() => { setLedgerFilter('all'); setLedgerPage(1); }}>
                  All Closed Shifts ({ledgerActiveSource.filter(s => s.status === 'closed').length})
                </FilterChip>
              </div>

              {/* Right: Search and Sort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    value={ledgerSearch}
                    onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                    placeholder="Search shift #, cashier, notes…"
                    style={{
                      height: 32,
                      width: 220,
                      paddingLeft: 28,
                      paddingRight: 10,
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                    }}
                  />
                </div>

                <select
                  value={ledgerSort}
                  onChange={(e) => { setLedgerSort(e.target.value); setLedgerPage(1); }}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="latest">Latest Closed First</option>
                  <option value="largest">Largest Discrepancy (|₹|)</option>
                  <option value="shortages">Shortages (Deficit First)</option>
                  <option value="surpluses">Surpluses (Excess First)</option>
                </select>
              </div>
            </div>

            {/* Ledger Table Container */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sortedAndFilteredLedger.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                  <p style={{ fontSize: '13.5px', margin: 0 }}>No shift records found matching the selected filter or search.</p>
                </div>
              ) : (() => {
                const paged = sortedAndFilteredLedger.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE);
                const totalLedgerPages = Math.max(1, Math.ceil(sortedAndFilteredLedger.length / LEDGER_PAGE_SIZE));

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <TH>Shift # & Store</TH>
                        <TH>Timeline & Cashier</TH>
                        <TH right>Opening Cash</TH>
                        <TH right>Cash Inflow (Sales)</TH>
                        <TH right>Cash Outflow (Payouts)</TH>
                        <TH right>Expected Drawer</TH>
                        <TH right>Closing Counted</TH>
                        <TH right>Discrepancy</TH>
                        <TH>Cashier Notes</TH>
                        <TH>Settlement Audit</TH>
                        <TH style={{ textAlign: 'center' }}>Action</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((s, idx) => {
                        const diff = parseFloat(s.cash_difference || 0);
                        const isShortage = diff < -0.01;
                        const isSurplus = diff > 0.01;
                        const hasDisc = isShortage || isSurplus;
                        const isSettled = Boolean(s.is_discrepancy_settled);

                        return (
                          <tr key={s.id || idx} className="dash-row" style={rowHover(idx)}>
                            <TD>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {s.shift_number}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <StoreIcon size={10} />
                                <span>{s.store_name}</span>
                              </div>
                            </TD>

                            <TD>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {s.closed_at ? fmtDateTime(s.closed_at) : fmtDateTime(s.opened_at)}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                                Cashier: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{s.cashier_name}</span>
                              </div>
                            </TD>

                            <TD right mono muted style={{ fontSize: '12px' }}>
                              {fmtRupee(s.opening_cash)}
                            </TD>

                            <TD right mono style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                              +{fmtRupee(s.cash_sales_amount)}
                            </TD>

                            <TD right mono style={{ fontSize: '12px', color: parseFloat(s.cash_payouts_amount || 0) > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                              {parseFloat(s.cash_payouts_amount || 0) > 0 ? `-${fmtRupee(s.cash_payouts_amount)}` : '₹0'}
                            </TD>

                            <TD right mono style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {fmtRupee(s.expected_cash)}
                            </TD>

                            <TD right mono style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {fmtRupee(s.closing_cash_counted)}
                            </TD>

                            <TD right>
                              {hasDisc ? (
                                <div>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 8px',
                                      borderRadius: 'var(--radius-pill)',
                                      background: isShortage ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                                      color: isShortage ? '#EF4444' : '#10B981',
                                      fontWeight: 700,
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '12px',
                                    }}
                                  >
                                    {isShortage ? `-₹${Math.abs(diff).toFixed(2)}` : `+₹${Math.abs(diff).toFixed(2)}`}
                                  </span>
                                  <div style={{ fontSize: '9.5px', color: isShortage ? '#EF4444' : '#10B981', fontWeight: 600, marginTop: 2 }}>
                                    {isShortage ? 'Shortage' : 'Surplus'}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  Balanced (₹0)
                                </span>
                              )}
                            </TD>

                            <TD style={{ maxWidth: 180, whiteSpace: 'normal' }}>
                              {s.closing_notes ? (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.3 }}>
                                  “{s.closing_notes}”
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </TD>

                            <TD style={{ maxWidth: 200, whiteSpace: 'normal' }}>
                              {!hasDisc ? (
                                <span style={{ fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle size={12} /> Balanced
                                </span>
                              ) : isSettled ? (
                                <div>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 7px',
                                      borderRadius: 'var(--radius-pill)',
                                      background: 'rgba(16,185,129,0.12)',
                                      color: '#10B981',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <CheckCircle size={10} /> Settled
                                  </span>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                                    {getSettlementActionLabel(s.settlement_action)}
                                  </div>
                                  {s.settlement_notes && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 1 }}>
                                      Note: {s.settlement_notes}
                                    </div>
                                  )}
                                  {s.settled_by_name && (
                                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: 1 }}>
                                      By {s.settled_by_name} {s.settled_at ? `(${new Date(s.settled_at).toLocaleDateString('en-IN')})` : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '2px 7px',
                                    borderRadius: 'var(--radius-pill)',
                                    background: 'rgba(239,68,68,0.12)',
                                    color: '#EF4444',
                                    fontSize: '10.5px',
                                    fontWeight: 600,
                                  }}
                                >
                                  <AlertTriangle size={10} /> Pending Settlement
                                </span>
                              )}
                            </TD>

                            <TD style={{ textAlign: 'center' }}>
                              {hasDisc ? (
                                <button
                                  onClick={() => openSettleModal(s)}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: isSettled ? '1px solid var(--border-color)' : '1px solid var(--brand-primary)',
                                    background: isSettled ? 'var(--bg-surface)' : 'var(--brand-primary)',
                                    color: isSettled ? 'var(--text-secondary)' : '#fff',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isSettled ? 'Audit / Edit' : 'Settle'}
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer / Paginator */}
            {sortedAndFilteredLedger.length > LEDGER_PAGE_SIZE && (
              <div
                style={{
                  padding: '12px 24px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing {Math.min((ledgerPage - 1) * LEDGER_PAGE_SIZE + 1, sortedAndFilteredLedger.length)}–
                  {Math.min(ledgerPage * LEDGER_PAGE_SIZE, sortedAndFilteredLedger.length)} of {sortedAndFilteredLedger.length} shifts
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    disabled={ledgerPage === 1}
                    style={pgBtnStyle(ledgerPage === 1)}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    onClick={() => setLedgerPage((p) => Math.min(Math.ceil(sortedAndFilteredLedger.length / LEDGER_PAGE_SIZE), p + 1))}
                    disabled={ledgerPage === Math.ceil(sortedAndFilteredLedger.length / LEDGER_PAGE_SIZE)}
                    style={pgBtnStyle(ledgerPage === Math.ceil(sortedAndFilteredLedger.length / LEDGER_PAGE_SIZE))}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETTLEMENT & CLEARANCE MODAL ─────────────────────────────────── */}
      {settleModalShift && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSettleModalShift(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {settleModalShift.is_discrepancy_settled ? 'Shift Discrepancy Audit Details' : 'Verify & Settle Shift Discrepancy'}
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  {settleModalShift.shift_number} · {settleModalShift.store_name} · Cashier: {settleModalShift.cashier_name}
                </p>
              </div>
              <button
                onClick={() => setSettleModalShift(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Shift Breakdown Box */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ padding: '8px 10px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Expected Cash</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {fmtRupee(settleModalShift.expected_cash)}
                  </span>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Counted Cash</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {fmtRupee(settleModalShift.closing_cash_counted)}
                  </span>
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: parseFloat(settleModalShift.cash_difference || 0) < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    border: parseFloat(settleModalShift.cash_difference || 0) < 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: parseFloat(settleModalShift.cash_difference || 0) < 0 ? '#EF4444' : '#10B981', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    {parseFloat(settleModalShift.cash_difference || 0) < 0 ? 'Cash Shortage' : 'Cash Surplus'}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: parseFloat(settleModalShift.cash_difference || 0) < 0 ? '#EF4444' : '#10B981', fontFamily: 'var(--font-mono)' }}>
                    {parseFloat(settleModalShift.cash_difference || 0) < 0
                      ? `-₹${Math.abs(parseFloat(settleModalShift.cash_difference || 0)).toFixed(2)}`
                      : `+₹${Math.abs(parseFloat(settleModalShift.cash_difference || 0)).toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Cashier Reason / Closing Note */}
              <div style={{ background: 'var(--bg-page)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                  Cashier's Day-End Closing Statement:
                </span>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, fontStyle: 'italic' }}>
                  {settleModalShift.closing_notes ? `“${settleModalShift.closing_notes}”` : 'No statement provided by cashier at close.'}
                </p>
              </div>
            </div>

            {/* Existing Settlement Info (if settled) */}
            {settleModalShift.is_discrepancy_settled && (
              <div style={{ padding: '14px 20px', background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: '12px', fontWeight: 700, marginBottom: 4 }}>
                  <CheckCircle size={14} />
                  <span>Currently Settled & Cleared</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Action Taken: <strong style={{ color: 'var(--text-primary)' }}>{getSettlementActionLabel(settleModalShift.settlement_action)}</strong>
                </div>
                {settleModalShift.settlement_notes && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Notes: {settleModalShift.settlement_notes}
                  </div>
                )}
                {settleModalShift.settled_by_name && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 3 }}>
                    Settled by {settleModalShift.settled_by_name} on {fmtDateTime(settleModalShift.settled_at)}
                  </div>
                )}
              </div>
            )}

            {/* Settlement Action Form */}
            <form onSubmit={handleSettleSubmit} style={{ padding: '18px 20px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Resolution / Settlement Action Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={settlementAction}
                  onChange={(e) => setSettlementAction(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                >
                  {SETTLEMENT_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Verified & Settled By <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settledByName}
                  onChange={(e) => setSettledByName(e.target.value)}
                  placeholder="Manager / Auditor Name"
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Audit Notes & Settlement Explanation <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="Provide audit reasoning (e.g. verified drawer count with cashier, amount deducted, coin difference forgiven)..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {settleModalShift.is_discrepancy_settled ? (
                  <button
                    type="button"
                    onClick={() => handleReopenDiscrepancy(settleModalShift.id)}
                    disabled={settlingLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#EF4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Re-open Discrepancy
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSettleModalShift(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Cancel
                  </button>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={settlingLoading}
                    style={{
                      height: 36,
                      padding: '0 18px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--brand-primary)',
                      background: 'var(--brand-primary)',
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: 'var(--font-sans)',
                      opacity: settlingLoading ? 0.7 : 1,
                    }}
                  >
                    <Check size={14} />
                    <span>{settlingLoading ? 'Saving…' : settleModalShift.is_discrepancy_settled ? 'Update Settlement' : 'Verify & Clear Discrepancy'}</span>
                  </button>
                </div>
              </div>
            </form>
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
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg, 0 16px 40px rgba(0,0,0,0.4))',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-color)',
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
                    borderRadius: 'var(--radius-sm)',
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
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Collect Due Payment · {selectedDueOrder.invoice_number || `#ORD-${selectedDueOrder.id}`}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Debtor: <strong style={{ color: 'var(--text-primary)' }}>{selectedDueOrder.customer_name || selectedDueOrder.customer_display_name || 'Customer'}</strong>
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
                  color: 'var(--text-muted)',
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
                borderBottom: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Total Bill
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  ₹{parseFloat(selectedDueOrder.total_amount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                  Paid Earlier
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10B981', fontFamily: 'var(--font-mono)' }}>
                  ₹{parseFloat(selectedDueOrder.amount_paid || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ padding: '8px', background: 'rgba(236,72,153,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(236,72,153,0.3)' }}>
                <span style={{ fontSize: '10.5px', color: '#EC4899', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                  Remaining Due
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#EC4899', fontFamily: 'var(--font-mono)' }}>
                  ₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Settle Form */}
            <form onSubmit={handleConfirmDueSettle} style={{ padding: '18px 20px' }}>
              {dueSettleError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: '#EF4444', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleError}
                </div>
              )}
              {dueSettleSuccess && (
                <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)', color: '#10B981', fontSize: '12px', marginBottom: 14 }}>
                  {dueSettleSuccess}
                </div>
              )}

              {/* Amount to Collect Input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Amount Being Collected Today (₹) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String(parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', color: '#EC4899', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Pay Full (₹{parseFloat(selectedDueOrder.balance_due || 0).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueSettleAmount(String((parseFloat(selectedDueOrder.balance_due || 0) / 2).toFixed(2)))}
                      style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
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
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Settlement Payment Method */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
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
                          borderRadius: 'var(--radius-sm)',
                          border: isSel ? '1px solid #EC4899' : '1px solid var(--border-color)',
                          background: isSel ? 'rgba(236,72,153,0.14)' : 'var(--bg-surface)',
                          color: isSel ? '#EC4899' : 'var(--text-secondary)',
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
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
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
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
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
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
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
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
                    borderRadius: 'var(--radius-sm)',
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

      {/* ── FINE EMPLOYEE MODAL (BROKEN / DAMAGED STOCK) ─────────────── */}
      {fineModalReport && (
        <FineEmployeeModal
          report={fineModalReport}
          currencySymbol="₹"
          onClose={() => setFineModalReport(null)}
          onSuccess={handleBrokenReportFineSuccess}
        />
      )}

      {/* ── BROKEN ITEM PHOTO LIGHTBOX MODAL ─────────────────────────── */}
      {brokenLightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setBrokenLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 720,
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ZoomIn size={16} color="#EF4444" /> Broken Merchandise Visual Proof
              </span>
              <button
                type="button"
                onClick={() => setBrokenLightboxImage(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 16, background: '#0b0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '75vh' }}>
              <img
                src={brokenLightboxImage}
                alt="Enlarged damaged item proof"
                style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

