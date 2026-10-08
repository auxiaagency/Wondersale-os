import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchMonthlyFinancialAnalysis } from '../api';
import GlowCurveChart, { formatIndianCurrencyCompact } from './GlowCurveChart';
import GlowBarChart from './GlowBarChart';
import CategoryPieChart from './CategoryPieChart';
import SupplierPieChart from './SupplierPieChart';
import SectionPieChart from './SectionPieChart';
import BrokenPieChart from './BrokenPieChart';
import SalesVolumeCurveChart from './SalesVolumeCurveChart';
import TimelineRangeSelector from './TimelineRangeSelector';
import { isStakeholdersEnabled, onStakeholdersSettingChange } from '../utils/stakeholdersSettings';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  Award,
  Sparkles,
  Calendar,
  Layers,
  BarChart3,
  Info,
  ShoppingBag,
  Tag,
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
  Zap,
  Coffee,
  Wrench,
  Truck,
  Megaphone,
  Package,
  CreditCard,
  ArrowRight,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Wallet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FinancialAnalysisDashboard({
  storeId,
  year = 2026,
  month = 9,
  currentUser,
  onNavigateToExpenses,
  timelineRange: propTimelineRange = null,
  onTimelineRangeChange = null,
}) {
  // Controlled active period state (supports context-aware drilldown across chosen Year, Month, Week, Day)
  const [activeYear, setActiveYear] = useState(year);
  const [activeMonth, setActiveMonth] = useState(month);
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [activeDayNum, setActiveDayNum] = useState(7);

  // Master timeline range selected by the top-level TimelineRangeSelector.
  // Stored in a ref to avoid it being a useCallback dependency (which caused infinite re-renders).
  const [timelineRange, setTimelineRange] = useState(() => {
    if (propTimelineRange) return propTimelineRange;
    return {
      unit: 'month',
      count: 1,
      granularity: 'week',
      isAllTime: false,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      startDate: null,
      endDate: null,
    };
  });
  const timelineRangeRef = useRef(timelineRange);
  const activeYearRef = useRef(year);
  const activeMonthRef = useRef(month);
  // Tracks whether the component has finished its initial mount render.
  // TimelineRangeSelector fires onChange on mount; we skip that first fire
  // so we don't double-fetch on load.
  const isMountedRef = useRef(false);

  // fetchTrigger is the ONLY dependency that actually causes a re-fetch.
  // Incrementing it is the explicit "go fetch" signal, avoiding infinite loops.
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const [stakeholdersSetting, setStakeholdersSetting] = useState(() => isStakeholdersEnabled(storeId));

  useEffect(() => {
    return onStakeholdersSettingChange(() => {
      setStakeholdersSetting(isStakeholdersEnabled(storeId));
    });
  }, [storeId]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Sync with prop changes if parent changes them
  useEffect(() => {
    if (propTimelineRange) {
      const cur = timelineRangeRef.current;
      if (
        cur &&
        cur.startDate === propTimelineRange.startDate &&
        cur.endDate === propTimelineRange.endDate &&
        cur.granularity === propTimelineRange.granularity &&
        cur.unit === propTimelineRange.unit &&
        cur.count === propTimelineRange.count &&
        cur.isAllTime === propTimelineRange.isAllTime
      ) {
        return;
      }
      setTimelineRange(propTimelineRange);
      timelineRangeRef.current = propTimelineRange;
      if (propTimelineRange.startDate) {
        const [y, m, d] = propTimelineRange.startDate.split('-').map(Number);
        if (y) { setActiveYear(y); activeYearRef.current = y; }
        if (m) { setActiveMonth(m); activeMonthRef.current = m; }
        if (d) setActiveDayNum(d);
      }
      setFetchTrigger((t) => t + 1);
      return;
    }

    setActiveYear(year);
    setActiveMonth(month);
    activeYearRef.current = year;
    activeMonthRef.current = month;
    const freshRange = {
      unit: 'month',
      count: 1,
      granularity: 'week',
      isAllTime: false,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      startDate: null,
      endDate: null,
    };
    setTimelineRange(freshRange);
    timelineRangeRef.current = freshRange;
    setFetchTrigger((t) => t + 1);
  }, [year, month, propTimelineRange]);

  // The actual data fetch — only depends on storeId and fetchTrigger.
  // Reads year/month/range from refs so they are always current without causing re-renders.
  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = timelineRangeRef.current;
      const params = {
        store: storeId || undefined,
        year: activeYearRef.current,
        month: activeMonthRef.current,
      };
      // Attach start_date / end_date whenever available from TimelineRangeSelector
      if (range?.startDate && range?.endDate) {
        params.start_date = range.startDate;
        params.end_date = range.endDate;
      }

      const res = await fetchMonthlyFinancialAnalysis(params);
      setData(res);
    } catch (err) {
      console.error('Failed to load financial analysis:', err);
      setError('Could not load monthly financial analysis.');
    } finally {
      setLoading(false);
    }
  }, [storeId]); // storeId is the only real external dep

  // Fire whenever the explicit trigger increments
  useEffect(() => {
    loadAnalysis();
    // Mark mounted after the very first fetch so handleTimelineRangeChange
    // knows it can safely trigger re-fetches from user interactions.
    isMountedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTrigger, storeId]);

  // Called by the master TimelineRangeSelector when the user picks + applies a range.
  // Updates all refs first, then increments fetchTrigger to trigger a single re-fetch.
  const handleTimelineRangeChange = useCallback((newRange) => {
    // Skip the initial programmatic onChange fire from TimelineRangeSelector on mount
    if (!isMountedRef.current) return;

    // Update the display state (for the label in subtitle)
    const updatedRange = {
      ...newRange,
      label: newRange.unit === 'month' && !newRange.startDate
        ? `${MONTH_NAMES[activeMonthRef.current - 1]} ${activeYearRef.current}`
        : newRange.label,
    };
    setTimelineRange(updatedRange);
    timelineRangeRef.current = updatedRange;

    // Only update year/month if it was an explicit custom range selection or explicit year
    if (newRange.unit === 'custom' && newRange.startDate) {
      const [y, m, d] = newRange.startDate.split('-').map(Number);
      if (y) { setActiveYear(y); activeYearRef.current = y; }
      if (m) { setActiveMonth(m); activeMonthRef.current = m; }
      if (d) setActiveDayNum(d);
    } else if (newRange.unit === 'year' && newRange.startDate) {
      const [y] = newRange.startDate.split('-').map(Number);
      if (y) { setActiveYear(y); activeYearRef.current = y; }
    } else if (newRange.isAllTime) {
      // All-time: keep year/month labels at current year
      const now = new Date();
      activeYearRef.current = now.getFullYear();
      activeMonthRef.current = now.getMonth() + 1;
    }

    // Notify parent if controlled
    if (onTimelineRangeChange) {
      onTimelineRangeChange(updatedRange);
    }

    // Trigger data re-fetch
    setFetchTrigger((t) => t + 1);
  }, [onTimelineRangeChange]);

  // Yearly aggregated summary for bar chart year-level zoom
  const yearlySummary = useMemo(() => {
    if (!data?.monthly_profit_trend) return null;
    const s = data.summary || {};
    const init = {
      total_revenue: 0,
      gross_sales: 0,
      gross_revenue: 0,
      returns_amount: 0,
      taxable_base: 0,
      gst_amount: 0,
      net_revenue_after_gst: 0,
      gst_mode: s.gst_mode || 'all',
      gst_mode_display: s.gst_mode_display || 'All Revenue (18%)',
      enable_gst: s.enable_gst !== false,
      total_cogs: 0,
      gross_profit: 0,
      total_non_salary_expenses: 0,
      total_salaries_expense: 0,
      total_inventory_loss_expired: 0,
      total_operating_outflows: 0,
      store_operating_net_profit: 0,
      stakeholder_contractual_share_allocated: 0,
      final_retained_net_profit: 0,
      total_orders_count: s.total_orders_count || 0,
      total_stakeholder_percentage: s.total_stakeholder_percentage || 0,
      active_stakeholders_count: s.active_stakeholders_count || 0,
    };
    data.monthly_profit_trend.forEach((m) => {
      const gSales = Number(m.gross_sales || m.gross_revenue || m.revenue) || 0;
      init.total_revenue += gSales;
      init.gross_sales += gSales;
      init.gross_revenue += gSales;
      init.returns_amount += Number(m.returns_amount) || 0;
      init.taxable_base += Number(m.taxable_base) || 0;
      init.gst_amount += Number(m.gst_amount) || 0;
      init.net_revenue_after_gst += Number(m.net_revenue_after_gst || m.revenue) || 0;
      init.total_cogs += Number(m.cogs) || 0;
      init.gross_profit += Number(m.gross_profit) || 0;
      init.total_non_salary_expenses += Number(m.operating_expenses || 0) + Number(m.counter_payouts || 0);
      init.total_salaries_expense += Number(m.salaries) || 0;
      init.total_inventory_loss_expired += Number(m.expired_loss || m.total_inventory_loss_expired) || 0;
      init.total_operating_outflows += Number(m.total_outflows) || 0;
      init.store_operating_net_profit += Number(m.operating_profit) || 0;
      init.stakeholder_contractual_share_allocated += Number(m.stakeholder_share) || 0;
      init.final_retained_net_profit += Number(m.retained_profit) || 0;
    });
    return init;
  }, [data?.monthly_profit_trend, data?.summary]);

  const earliestRecordDate = data?.summary?.earliest_record_date || data?.earliest_record_date || '2026-09-04';

  const isStakeholdersActive = (data?.summary?.enable_stakeholders !== false) && stakeholdersSetting;

  const handleExportCSV = () => {
    if (!data || !data.summary) return;
    const s = data.summary;
    const rows = [
      ['STORE MONTHLY FINANCIAL PERFORMANCE REPORT'],
      [`Store Period: ${MONTH_NAMES[activeMonth - 1]} ${activeYear}`],
      [`Generated At: ${new Date().toLocaleString()}`],
      [],
      ['EXECUTIVE KEY PERFORMANCE INDICATORS', 'AMOUNT (INR)'],
      ['Gross Customer Sales Revenue', s.gross_sales || s.gross_revenue || s.total_revenue],
      ['Customer Returns & Refunds', s.returns_amount || s.total_refunds || 0],
      ['Net Sales (Before GST)', s.total_revenue || 0],
      ['GST Output Liability (18%)', s.gst_amount || 0],
      ['Net Taxable Sales (Ex-GST)', s.net_revenue_after_gst || s.total_revenue],
      ['Cost of Goods Sold (COGS)', s.total_cogs || 0],
      ['Gross Profit Margin', s.gross_profit || 0],
      ['Gross Margin (%)', `${s.gross_margin_pct || 0}%`],
      ['Total Store Operating Expenses', s.total_non_salary_expenses || 0],
      isStakeholdersActive
        ? ['Store Net Operating Profit (Pre-Stakeholder)', s.store_operating_net_profit || 0]
        : ['Store Net Profit', s.store_operating_net_profit || 0],
      ['Operating Margin (%)', `${s.store_operating_net_profit_margin_pct || 0}%`],
      ...(isStakeholdersActive
        ? [
            ['Stakeholder Profit Share Allocated', s.stakeholder_contractual_share_allocated || 0],
            ['Final Retained Store Net Profit', s.final_retained_net_profit || 0],
            ['Final Retained Margin (%)', `${s.final_retained_net_profit_margin_pct || 0}%`],
          ]
        : []),
      ['Completed Sales Count', s.total_orders_count || 0],
      ['Average Order Value (AOV)', s.average_order_value || 0],
      [],
      ['ACCOUNTING WATERFALL MONEY FLOW'],
      ['Step', 'Description', 'Amount (INR)'],
      ...(data.waterfall || []).map((w) => [w.step, w.description, w.amount]),
      [],
      ['DAILY TIMELINE PERFORMANCE BREAKDOWN'],
      isStakeholdersActive
        ? ['Day', 'Date', 'Gross Sales', 'GST Outflow', 'Net Sales', 'COGS', 'Gross Profit', 'Operating Expenses', 'Operating Profit', 'Retained Net Profit']
        : ['Day', 'Date', 'Gross Sales', 'GST Outflow', 'Net Sales', 'COGS', 'Gross Profit', 'Operating Expenses', 'Net Profit'],
      ...(data.timeline || []).map((t) =>
        isStakeholdersActive
          ? [
              t.day,
              t.date,
              t.revenue,
              t.gst_amount,
              t.net_revenue,
              t.cogs,
              t.gross_profit,
              t.expenses,
              t.operating_profit,
              t.retained_profit,
            ]
          : [
              t.day,
              t.date,
              t.revenue,
              t.gst_amount,
              t.net_revenue,
              t.cogs,
              t.gross_profit,
              t.expenses,
              t.operating_profit,
            ]
      ),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_report_${activeYear}_${activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Destructure data safely — safe to call at top level since we conditionally render below
  const summary = data?.summary || {};
  const stakeholders_breakdown = data?.stakeholders_breakdown || [];
  const timeline = data?.timeline || [];
  const waterfall = data?.waterfall || [];
  const monthly_profit_trend = data?.monthly_profit_trend || [];
  const weeks = data?.weeks || [];
  const hourly_by_day = data?.hourly_by_day || {};
  const categories = data?.categories || [];
  const suppliers = data?.suppliers || [];
  const sections = data?.sections || [];
  const payment_methods = data?.payment_methods || [];

  const grossSales = Number(summary.gross_sales || summary.gross_revenue || summary.total_revenue) || 0;
  const netRevenue = Number(summary.net_revenue_after_gst || summary.total_revenue) || 0;
  const gstAmount = Number(summary.gst_amount) || 0;
  const grossProfit = Number(summary.gross_profit) || 0;
  const opExpenses = Number(summary.total_non_salary_expenses) || 0;
  const salariesExpense = Number(summary.total_salaries_expense || summary.salaries) || 0;
  const expiredLoss = Number(summary.total_inventory_loss_expired || summary.expired_loss) || 0;
  const opProfit = Number(summary.store_operating_net_profit) || 0;
  const retProfit = Number(summary.final_retained_net_profit) || 0;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', paddingBottom: '35px' }}>
      {/* ========================================================================= */}
      {/* TOP HEADER: PERIOD SELECTOR & EXPORT ACTION                               */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: 'var(--card-bg, #1E293B)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={22} color="#38BDF8" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
              Store Financial Performance & P&L
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
              Real-time multi-period P&L accounting for {timelineRange?.label || `${MONTH_NAMES[activeMonth - 1]} ${activeYear}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Universal Standard Timeline Range Selector matching all graphs */}
          <TimelineRangeSelector
            value={timelineRange}
            defaultUnit="month"
            defaultCount={1}
            allowAllTime={true}
            minDate={earliestRecordDate}
            compact={false}
            chartType="dashboard"
            onChange={handleTimelineRangeChange}
          />

          {/* Refresh Action */}
          <button
            onClick={loadAnalysis}
            title="Refresh Financial Data"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              color: 'var(--text-primary, #F8FAFC)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} />
            <span>Sync</span>
          </button>

          {/* Export P&L CSV */}
          <button
            onClick={handleExportCSV}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#10B981',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
            }}
          >
            <Download size={15} />
            <span>Export P&L CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INLINE LOADING STATE — shown below the always-visible header              */}
      {/* ========================================================================= */}
      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '380px',
            gap: '16px',
          }}
        >
          <RefreshCw size={38} color="#38BDF8" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: 'var(--text-secondary, #94A3B8)', fontSize: '0.95rem', fontWeight: 600 }}>
            Crunching store accounting and multi-period financial data for {MONTH_NAMES[activeMonth - 1]} {activeYear}...
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INLINE ERROR STATE                                                         */}
      {/* ========================================================================= */}
      {!loading && (error || !data) && (
        <div
          style={{
            padding: '32px',
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          <p style={{ color: '#F87171', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
            {error || 'No financial data available for this period.'}
          </p>
          <button
            onClick={() => setFetchTrigger((t) => t + 1)}
            style={{
              marginTop: '16px',
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATA CONTENT — only rendered when not loading and data is available       */}
      {/* ========================================================================= */}
      {!loading && data && (
      <React.Fragment>

      {/* Combined Multi-Store Indicator Banner */}
      {data.is_combined && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60A5FA',
              }}
            >
              <Building2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                Combined Multi-Branch Financial View
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Consolidated financials aggregating performance across {data.stores_breakdown?.length || 0} branches
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {data.stores_breakdown?.map((st) => (
              <span
                key={st.id}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-secondary, #94A3B8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {st.name}: <strong style={{ color: '#60A5FA' }}>{st.share_of_sales_pct}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE KPI STAT CARDS STRIP                                            */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >

        {/* Card 1: Gross Sales */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Gross Sales
            </span>
            <Receipt size={16} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#38BDF8' }}>
            ₹{grossSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)' }}>
            {summary.total_orders_count || 0} customer orders
          </div>
        </div>

        {/* Card 2: Ex-GST Net Sales */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Net Sales (Ex-GST)
            </span>
            <Tag size={16} color="#60A5FA" />
          </div>
          <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
            ₹{netRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#C084FC' }}>
            {gstAmount > 0 ? `GST Tax: -₹${gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'GST Exempt / Inactive'}
          </div>
        </div>

        {/* Card 3: Gross Profit Margin */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: grossProfit < 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--card-bg, #1E293B)',
            border: grossProfit < 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: grossProfit < 0 ? '#F87171' : 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {grossProfit < 0 ? 'Gross Deficit' : 'Gross Profit'}
            </span>
            {grossProfit < 0 ? <AlertTriangle size={16} color="#EF4444" /> : <TrendingUp size={16} color="#34D399" />}
          </div>
          <div style={{ fontSize: '1.28rem', fontWeight: 800, color: grossProfit < 0 ? '#EF4444' : '#34D399' }}>
            {grossProfit < 0 ? '-' : ''}₹{Math.abs(grossProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: grossProfit < 0 ? '#F87171' : '#10B981', fontWeight: 700 }}>
            {summary.gross_margin_pct || 0}% {grossProfit < 0 ? 'negative margin' : 'product margin'}
          </div>
        </div>

        {/* Card 4: Operating Expenses */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Operating Overheads
            </span>
            <Truck size={16} color="#F87171" />
          </div>
          <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#F87171' }}>
            ₹{opExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Bills, rent & maintenance payouts
          </div>
        </div>

        {/* Card 4b: Staff Salaries & Wages — only if > 0 this period */}
        {salariesExpense > 0 && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Salaries & Wages
              </span>
              <Wallet size={16} color="#C084FC" />
            </div>
            <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#C084FC' }}>
              ₹{salariesExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#C084FC' }}>
              Payroll & staff counter payouts
            </div>
          </div>
        )}

        {/* Card 4c: Expired Inventory Loss — only if > 0 this period */}
        {(expiredLoss > 0 || summary.total_inventory_loss_expired > 0) && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Expired Write-Off Loss
              </span>
              <AlertTriangle size={16} color="#F97316" />
            </div>
            <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#F97316' }}>
              ₹{Number(expiredLoss || summary.total_inventory_loss_expired || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#F97316' }}>
              {summary.expired_items_count || 0} items · {summary.expired_units_count || 0} units written off
            </div>
          </div>
        )}

        {/* Card 5: Store Net Operating Profit / Loss */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: opProfit < 0
              ? 'rgba(239, 68, 68, 0.08)'
              : (isStakeholdersActive ? 'var(--card-bg, #1E293B)' : 'rgba(0, 229, 163, 0.08)'),
            border: opProfit < 0
              ? '1px solid rgba(239, 68, 68, 0.35)'
              : (isStakeholdersActive ? '1px solid var(--border-color, rgba(255,255,255,0.08))' : '1px solid rgba(0, 229, 163, 0.35)'),
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: opProfit < 0
              ? '0 4px 18px -4px rgba(239, 68, 68, 0.15)'
              : (isStakeholdersActive ? 'none' : '0 4px 18px -4px rgba(0, 229, 163, 0.15)'),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              color: opProfit < 0 ? '#F87171' : (isStakeholdersActive ? 'var(--text-secondary, #94A3B8)' : '#00E5A3'),
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {opProfit < 0 ? 'Store Net Loss' : 'Store Net Profit'}
            </span>
            {opProfit < 0 ? (
              <AlertTriangle size={16} color="#EF4444" />
            ) : isStakeholdersActive ? (
              <Sparkles size={16} color="#F59E0B" />
            ) : (
              <Award size={16} color="#00E5A3" />
            )}
          </div>
          <div style={{
            fontSize: isStakeholdersActive && opProfit >= 0 ? '1.28rem' : '1.35rem',
            fontWeight: 900,
            color: opProfit < 0 ? '#EF4444' : (isStakeholdersActive ? '#F59E0B' : '#00E5A3')
          }}>
            {opProfit < 0 ? '-' : ''}₹{Math.abs(opProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{
            fontSize: '0.72rem',
            color: opProfit < 0 ? '#F87171' : (isStakeholdersActive ? '#FBBF24' : '#00E5A3'),
            fontWeight: 700
          }}>
            {summary.store_operating_net_profit_margin_pct || 0}% {opProfit < 0 ? 'operating deficit' : (isStakeholdersActive ? 'pre-partner' : 'net profit margin')}
          </div>
        </div>

        {/* Card 6: Retained Net Profit (only shown when stakeholders enabled) */}
        {isStakeholdersActive && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: retProfit < 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 229, 163, 0.08)',
              border: retProfit < 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(0, 229, 163, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: retProfit < 0 ? '0 4px 18px -4px rgba(239, 68, 68, 0.15)' : '0 4px 18px -4px rgba(0, 229, 163, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: retProfit < 0 ? '#F87171' : '#00E5A3',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {retProfit < 0 ? 'Retained Net Loss' : 'Retained Net Profit'}
              </span>
              {retProfit < 0 ? <AlertTriangle size={16} color="#EF4444" /> : <Award size={16} color="#00E5A3" />}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: retProfit < 0 ? '#EF4444' : '#00E5A3' }}>
              {retProfit < 0 ? '-' : ''}₹{Math.abs(retProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: retProfit < 0 ? '#F87171' : '#00E5A3', fontWeight: 700 }}>
              {summary.final_retained_net_profit_margin_pct || 0}% {retProfit < 0 ? 'final deficit' : 'final margin'}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: EXECUTIVE FINANCIAL BAR GRAPH WITH NEGATIVE Y-AXIS (-y)        */}
      {/* ========================================================================= */}
      <div>
        <GlowBarChart
          id="exec-summary-bars"
          title="Financial Executive Summary"
          summary={summary}
          yearlySummary={yearlySummary}
          weeksData={weeks}
          dailyData={timeline}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          selectedYear={activeYear}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: RETAIL SALES ORDERS & TRANSACTION VOLUME FREQUENCY            */}
      {/* ========================================================================= */}
      <div>
        <SalesVolumeCurveChart
          id="sales-volume-frequency-chart"
          title="Sales Volume & Transaction Frequency"
          yearlyData={monthly_profit_trend}
          monthlyData={timeline}
          weeksData={weeks}
          hourlyByDay={hourly_by_day}
          initialPeriod={timelineRange?.unit || 'month'}
          activeMonthKey={activeMonth}
          selectedYear={activeYear}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          onYearChange={(newYear) => setActiveYear(newYear)}
          onMonthChange={(newMonth) => setActiveMonth(newMonth)}
          onWeekChange={(newWeek) => setActiveWeekIdx(newWeek)}
          onDayChange={(newDay) => setActiveDayNum(newDay)}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
          height={310}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: TOP HERO GRAPH: MONTHLY PROFIT CURVE (2 LINES)                 */}
      {/* ========================================================================= */}
      <div>
        <GlowCurveChart
          id="monthly-profit-hero"
          title={(p) =>
            p === 'day'
              ? `Day Profit Trajectory (Hourly Breakdown)`
              : p === 'week'
              ? `Week Profit Trajectory (7-Day Performance)`
              : p === 'month'
              ? `Daily Profit Trajectory (${MONTH_NAMES[activeMonth - 1]} ${activeYear})`
              : `Monthly Profit Trajectory (Year ${activeYear})`
          }
          yearlyData={monthly_profit_trend}
          monthlyData={timeline}
          weeksData={weeks}
          hourlyByDay={hourly_by_day}
          initialPeriod="year"
          activeMonthKey={activeMonth}
          selectedYear={activeYear}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          onYearChange={(newYear) => setActiveYear(newYear)}
          onMonthChange={(newMonth) => setActiveMonth(newMonth)}
          onWeekChange={(newWeek) => setActiveWeekIdx(newWeek)}
          onDayChange={(newDay) => setActiveDayNum(newDay)}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
          lines={
            isStakeholdersActive
              ? [
                  {
                    key: 'operating_profit',
                    name: 'Total Store Profit (Pre-Stakeholders)',
                    color: '#00E5A3', // Radiant mint/teal
                  },
                  {
                    key: 'retained_profit',
                    name: 'Net Retained Profit (After Stakeholders)',
                    color: '#818CF8', // Radiant Purple/Indigo
                  },
                ]
              : [
                  {
                    key: 'operating_profit',
                    name: 'Store Net Profit',
                    color: '#00E5A3', // Radiant mint/teal
                  },
                ]
          }
          height={310}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: REVENUE VS TOTAL STORE COSTS & OUTFLOWS                        */}
      {/* ========================================================================= */}
      <div>
        <GlowCurveChart
          id="revenue-outflows-chart"
          title={(p) =>
            p === 'day'
              ? `Day Revenue vs. Costs (Hourly Breakdown)`
              : p === 'week'
              ? `Week Revenue vs. Operating Outflows`
              : p === 'month'
              ? `Daily Revenue vs. Total Costs (${MONTH_NAMES[activeMonth - 1]} ${activeYear})`
              : `Annual Sales Revenue vs. Total Operating Costs (${activeYear})`
          }
          yearlyData={monthly_profit_trend}
          monthlyData={timeline}
          weeksData={weeks}
          hourlyByDay={hourly_by_day}
          initialPeriod="year"
          activeMonthKey={activeMonth}
          selectedYear={activeYear}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          onYearChange={(newYear) => setActiveYear(newYear)}
          onMonthChange={(newMonth) => setActiveMonth(newMonth)}
          onWeekChange={(newWeek) => setActiveWeekIdx(newWeek)}
          onDayChange={(newDay) => setActiveDayNum(newDay)}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
          lines={[
            {
              key: 'revenue',
              name: 'Gross Sales Revenue',
              color: '#38BDF8', // Cyan
            },
            {
              key: 'total_outflows',
              name: 'Total Costs & Outflows',
              color: '#F87171', // Coral Red
            },
          ]}
          height={280}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: PAYMENT CHANNELS & REVENUE DISTRIBUTION STRIP                 */}
      {/* ========================================================================= */}
      {payment_methods && payment_methods.length > 0 && (
        <div
          style={{
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            padding: '20px 24px',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} color="#38BDF8" />
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                Payment Methods & Channel Revenue Distribution
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
              Net customer payment receipts
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            {payment_methods.map((pm, idx) => {
              const isUpi = pm.method.toLowerCase().includes('upi');
              const isCash = pm.method.toLowerCase().includes('cash');
              const themeColor = isUpi ? '#C084FC' : isCash ? '#34D399' : '#38BDF8';

              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.07))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', textTransform: 'uppercase' }}>
                      {pm.method}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: `${themeColor}20`,
                        color: themeColor,
                      }}
                    >
                      {pm.percentage}%
                    </span>
                  </div>

                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: themeColor }}>
                    ₹{pm.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  {/* Visual percentage progress bar */}
                  <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, pm.percentage))}%`,
                        height: '100%',
                        backgroundColor: themeColor,
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4.5: BRANCH / STORE PERFORMANCE & CONTRIBUTION BREAKDOWN         */}
      {/* ========================================================================= */}
      {data?.stores_breakdown && data.stores_breakdown.length > 1 && (
        <div
          style={{
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            padding: '22px 24px',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60A5FA',
                }}
              >
                <Building2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                  Branch Performance &amp; Contribution
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary, #94A3B8)' }}>
                  Comparative financial breakdown of sales, margins, operating expenses &amp; net profit across {data.stores_breakdown.length} branches
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60A5FA',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {data.stores_breakdown.length} Branches Combined
              </span>
            </div>
          </div>

          {/* Branch Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '14px',
            }}
          >
            {data.stores_breakdown.map((st, sIdx) => {
              const colors = ['#38BDF8', '#818CF8', '#34D399', '#FBBF24', '#EC4899', '#2DD4BF'];
              const accentColor = colors[sIdx % colors.length];

              return (
                <div
                  key={st.id}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Branch Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: accentColor,
                          boxShadow: `0 0 8px ${accentColor}`,
                        }}
                      />
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                        {st.name}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: `${accentColor}20`,
                        color: accentColor,
                      }}
                    >
                      {st.share_of_sales_pct}% Share
                    </span>
                  </div>

                  {/* Revenue & Share Bar */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary, #F8FAFC)' }}>
                        ₹{st.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
                        {st.orders_count} orders
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, st.share_of_sales_pct))}%`,
                          height: '100%',
                          backgroundColor: accentColor,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Financial Metrics Mini-Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>Gross Profit</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34D399' }}>
                        ₹{st.gross_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>Operating Expenses</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F87171' }}>
                        ₹{st.operating_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>Net Profit</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: st.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                        ₹{st.net_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>Net Margin</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: st.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                        {st.net_margin_pct}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: PRODUCT CATEGORY & SUBCATEGORY PIE CHART WITH DRILL-DOWN       */}
      {/* ========================================================================= */}
      <div>
        <CategoryPieChart
          categories={categories}
          storeId={storeId}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          selectedYear={activeYear}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6: SUPPLIER & SUPPLIED ITEMS PIE CHART WITH DRILL-DOWN            */}
      {/* ========================================================================= */}
      <div>
        <SupplierPieChart
          suppliers={suppliers}
          storeId={storeId}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          selectedYear={activeYear}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6.5: STORE SECTIONS & DEPARTMENTS PIE CHART WITH DRILL-DOWN       */}
      {/* ========================================================================= */}
      <div>
        <SectionPieChart
          sections={sections}
          storeId={storeId}
          selectedMonthName={MONTH_NAMES[activeMonth - 1]}
          selectedYear={activeYear}
          timelineRange={timelineRange}
          minDate={earliestRecordDate}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6.8: BROKEN & DAMAGED INVENTORY WRITE-OFFS (CATEGORY, SECTION, SUPPLIER) */}
      {/* ========================================================================= */}
      <div>
        <BrokenPieChart
          brokenBreakdown={data?.broken_breakdown || data?.summary?.broken_breakdown}
          currencySymbol="₹"
          onReportUpdated={() => setFetchTrigger((t) => t + 1)}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 7: ACCOUNTING WATERFALL FLOW & STAKEHOLDERS PARTNERS LEDGER       */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isStakeholdersActive ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr',
          gap: '20px',
        }}
      >
        {/* Left: Complete Accounting Waterfall Flow */}
        <div
          style={{
            borderRadius: '16px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            padding: '22px 24px',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#FBBF24" />
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                Accounting Waterfall & Money Flow
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
              {isStakeholdersActive ? 'Revenue to Retained Net' : 'Revenue to Store Net Profit'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {waterfall.map((step, idx) => {
              const isOutflow = step.type.startsWith('outflow');
              const isFinal = step.type === 'final_profit' || step.type === 'final_loss';
              const isPreProfit = step.type === 'highlight_pre';
              const isLoss = step.type === 'final_loss' || (isFinal && step.amount < 0);

              let valColor = 'var(--text-primary, #F8FAFC)';
              let bg = 'var(--bg-surface-hover, rgba(0, 0, 0, 0.02))';
              let border = '1px solid var(--border-subtle)';

              if (step.type === 'inflow') {
                valColor = '#38BDF8';
              } else if (step.type === 'outflow_loss_broken') {
                // Broken inventory write-off — distinct rose/red warning color
                valColor = '#F43F5E';
                bg = 'rgba(244, 63, 94, 0.08)';
                border = '1px solid rgba(244, 63, 94, 0.3)';
              } else if (step.type === 'outflow_loss') {
                // Expired inventory write-off — distinct amber/orange warning color
                valColor = '#F97316';
                bg = 'rgba(249, 115, 22, 0.08)';
                border = '1px solid rgba(249, 115, 22, 0.3)';
              } else if (step.type === 'outflow_salaries') {
                valColor = '#C084FC';
                bg = 'rgba(168, 85, 247, 0.08)';
                border = '1px solid rgba(168, 85, 247, 0.25)';
              } else if (isLoss) {
                valColor = '#EF4444';
                bg = 'rgba(239, 68, 68, 0.15)';
                border = '1px solid rgba(239, 68, 68, 0.4)';
              } else if (isOutflow) {
                valColor = '#F87171';
              } else if (isPreProfit) {
                if (step.amount < 0) {
                  valColor = '#EF4444';
                  bg = 'rgba(239, 68, 68, 0.12)';
                  border = '1px solid rgba(239, 68, 68, 0.3)';
                } else {
                  valColor = '#FBBF24';
                  bg = 'rgba(245, 158, 11, 0.12)';
                  border = '1px solid rgba(245, 158, 11, 0.3)';
                }
              } else if (isFinal) {
                valColor = '#10B981';
                bg = 'rgba(16, 185, 129, 0.15)';
                border = '1px solid rgba(16, 185, 129, 0.4)';
              }

              return (
                <div
                  key={idx}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    backgroundColor: bg,
                    border: border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: isFinal || isPreProfit ? 800 : 600, color: 'var(--text-primary, #F8FAFC)' }}>
                      {step.step}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94A3B8)' }}>
                      {step.description}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: valColor }}>
                    {isOutflow || step.amount < 0 ? '-' : ''}₹{Math.abs(step.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Profit-Sharing Stakeholders Partner Ledger - rendered ONLY when active */}
        {isStakeholdersActive && (
          <div
            style={{
              borderRadius: '16px',
              backgroundColor: 'var(--card-bg, #1E293B)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              padding: '22px 24px',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#EC4899" />
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                  Active Stakeholder Partners ({MONTH_NAMES[activeMonth - 1]} {activeYear})
                </h3>
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  color: '#F472B6',
                }}
              >
                {summary.total_stakeholder_percentage}% Total Stake
              </span>
            </div>

            {!stakeholders_breakdown || stakeholders_breakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.85rem' }}>
                No active stakeholders configured.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stakeholders_breakdown.map((sh) => (
                  <div
                    key={sh.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(236, 72, 153, 0.04)',
                      border: '1px solid rgba(236, 72, 153, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #F8FAFC)' }}>
                        {sh.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                        Cash Disbursed This Month: ₹{sh.payouts_disbursed_this_month.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          color: '#F472B6',
                          display: 'inline-block',
                          marginBottom: '4px',
                        }}
                      >
                        {sh.profit_percentage}% Share
                      </span>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F472B6' }}>
                        ₹{sh.contractual_share_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      </React.Fragment>
      )}

    </div>
  );
}
