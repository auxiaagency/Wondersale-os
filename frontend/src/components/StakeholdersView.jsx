import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart2,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Search,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Shield,
  Award,
  Clock,
  X,
  CreditCard,
  Building2,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Receipt,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  getStakeholders,
  createStakeholder,
  updateStakeholder,
  deleteStakeholder,
  getStakeholderAnalytics,
  recordStakeholderPayout,
  getStakeholderPayouts,
} from '../api';
import TimeRangeFilter, { filterLogsByTimeRange } from './TimeRangeFilter';
import { calculatePointChange } from '../utils/chartChangeHelper';

const TIMELINE_PRESETS = [
  { id: 'past_2_months', label: 'Past 2 Months' },
  { id: 'last_3_months', label: 'Past 3 Months' },
  { id: 'last_6_months', label: 'Past 6 Months' },
  { id: 'this_year', label: 'This Year (2026)' },
  { id: 'last_year', label: 'Last Year (2025)' },
];

const AVAILABLE_MONTHS = [
  { value: '2026-09', label: 'Sep 2026 (Ongoing)' },
  { value: '2026-08', label: 'Aug 2026' },
  { value: '2026-07', label: 'Jul 2026' },
  { value: '2026-06', label: 'Jun 2026' },
  { value: '2026-05', label: 'May 2026' },
  { value: '2026-04', label: 'Apr 2026' },
  { value: '2026-03', label: 'Mar 2026' },
  { value: '2026-02', label: 'Feb 2026' },
  { value: '2026-01', label: 'Jan 2026' },
  { value: '2025-12', label: 'Dec 2025' },
  { value: '2025-11', label: 'Nov 2025' },
  { value: '2025-10', label: 'Oct 2025' },
  { value: '2025-09', label: 'Sep 2025' },
  { value: '2025-08', label: 'Aug 2025' },
  { value: '2025-07', label: 'Jul 2025' },
  { value: '2025-06', label: 'Jun 2025' },
  { value: '2025-05', label: 'May 2025' },
  { value: '2025-04', label: 'Apr 2025' },
  { value: '2025-03', label: 'Mar 2025' },
  { value: '2025-02', label: 'Feb 2025' },
  { value: '2025-01', label: 'Jan 2025' },
];

export default function StakeholdersView({
  currentUser,
  selectedStore: propSelectedStore,
  stores = [],
  onBackToLauncher,
}) {
  // Timeline Filter: 'this_year', 'last_year', 'last_6_months', 'last_3_months', 'past_2_months', 'specific_month'
  const [selectedTimeline, setSelectedTimeline] = useState('this_year');
  const [specificMonth, setSpecificMonth] = useState('2026-09');
  const [metricType, setMetricType] = useState('profit'); // 'profit' or 'revenue'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef(null);

  // Enforce store-wise scoping strictly. Even for owner!
  // To switch stores, owner changes store in settings/header.
  const activeStoreId = String(
    propSelectedStore ||
    localStorage.getItem('wondersale_logged_in_store') ||
    currentUser?.store ||
    '1'
  );
  const [selectedStore, setSelectedStore] = useState(activeStoreId);

  useEffect(() => {
    const storeToUse = String(
      propSelectedStore ||
      localStorage.getItem('wondersale_logged_in_store') ||
      currentUser?.store ||
      '1'
    );
    setSelectedStore(storeToUse);
  }, [propSelectedStore]);

  // Click outside listener for custom month picker dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target)) {
        setIsMonthDropdownOpen(false);
      }
    };
    if (isMonthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthDropdownOpen]);

  // Data State
  const [analytics, setAnalytics] = useState(null);
  const [stakeholders, setStakeholders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Hovered item on pie chart
  const [hoveredSlice, setHoveredSlice] = useState(null);
  // Hovered or selected point index on spline curve graph
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    store: activeStoreId,
    investment_amount: '',
    profit_percentage: '',
    contract_date: new Date().toISOString().split('T')[0],
    contract_end_date: '',
    total_payout_paid: '0',
    status: 'active',
    notes: '',
  });

  // Payout Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [stakeholderForPayout, setStakeholderForPayout] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    payout_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_id: '',
    notes: '',
  });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Payout History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [stakeholderForHistory, setStakeholderForHistory] = useState(null);
  const [payoutHistoryList, setPayoutHistoryList] = useState([]);
  const [historyTimeFilter, setHistoryTimeFilter] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const params = {
        timeframe: selectedTimeline,
        store: selectedStore,
      };

      if (selectedTimeline === 'specific_month') {
        params.year_month = specificMonth;
        const [y, m] = specificMonth.split('-');
        params.year = y;
        params.month = m;
      } else if (selectedTimeline === 'this_year') {
        params.year = '2026';
      } else if (selectedTimeline === 'last_year') {
        params.year = '2025';
      }

      const [analyticsRes, listRes] = await Promise.all([
        getStakeholderAnalytics(params),
        getStakeholders({ store: selectedStore }),
      ]);

      setAnalytics(analyticsRes);
      setStakeholders(listRes);
      setSelectedPointIndex(null);
    } catch (err) {
      console.error('Failed to load stakeholders data:', err);
      showNotification('error', err.message || 'Failed to load stakeholder data from backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTimeline, specificMonth, selectedStore]);

  const handleOpenAddModal = () => {
    setEditingStakeholder(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      store: selectedStore,
      investment_amount: '',
      profit_percentage: '',
      contract_date: new Date().toISOString().split('T')[0],
      contract_end_date: '',
      total_payout_paid: '0',
      status: 'active',
      notes: '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (s) => {
    setEditingStakeholder(s);
    setFormData({
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      store: String(s.store || selectedStore),
      investment_amount: s.investment_amount !== undefined ? String(s.investment_amount) : '',
      profit_percentage: s.profit_percentage !== undefined ? String(s.profit_percentage) : '',
      contract_date: s.contract_date || new Date().toISOString().split('T')[0],
      contract_end_date: s.contract_end_date || '',
      total_payout_paid: s.total_payout_paid !== undefined ? String(s.total_payout_paid) : '0',
      status: s.status || 'active',
      notes: s.notes || '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleSaveStakeholder = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('error', 'Stakeholder full name is required.');
      return;
    }
    const pct = parseFloat(formData.profit_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showNotification('error', 'Profit share percentage must be between 0% and 100%.');
      return;
    }

    const inv = parseFloat(formData.investment_amount);
    if (isNaN(inv) || inv < 0) {
      showNotification('error', 'Please specify a valid capital investment amount.');
      return;
    }

    try {
      const paid = parseFloat(formData.total_payout_paid);
      const payload = {
        ...formData,
        investment_amount: inv,
        profit_percentage: pct,
        total_payout_paid: !isNaN(paid) && paid >= 0 ? paid : 0,
        store: selectedStore ? parseInt(selectedStore, 10) : null,
        contract_end_date: formData.contract_end_date || null,
      };

      if (editingStakeholder) {
        await updateStakeholder(editingStakeholder.id, payload);
        showNotification('success', `Stakeholder ${payload.name} updated.`);
      } else {
        await createStakeholder(payload);
        showNotification('success', `Stakeholder ${payload.name} added successfully.`);
      }

      setIsAddEditModalOpen(false);
      loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to save stakeholder.');
    }
  };

  const handleDeleteStakeholder = async (s) => {
    if (
      window.confirm(
        `Are you sure you want to remove stakeholder "${s.name}"? This will detach their contractual records.`
      )
    ) {
      try {
        await deleteStakeholder(s.id);
        showNotification('success', `Stakeholder "${s.name}" removed.`);
        loadData();
      } catch (err) {
        showNotification('error', err.message || 'Failed to delete stakeholder.');
      }
    }
  };

  const handleOpenPayoutModal = (s) => {
    setStakeholderForPayout(s);
    setPayoutForm({
      amount: '',
      payout_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      reference_id: '',
      notes: '',
    });
    setIsPayoutModalOpen(true);
  };

  const handleSubmitPayout = async (e) => {
    e.preventDefault();
    if (!stakeholderForPayout) return;

    const amt = parseFloat(payoutForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('error', 'Please enter a valid payout disbursement amount.');
      return;
    }

    try {
      setSubmittingPayout(true);
      await recordStakeholderPayout(stakeholderForPayout.id, {
        ...payoutForm,
        amount: amt,
      });
      showNotification('success', `Payout of ₹${amt.toLocaleString('en-IN')} recorded for ${stakeholderForPayout.name}.`);
      setIsPayoutModalOpen(false);
      loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to record payout.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleViewHistory = async (s) => {
    setStakeholderForHistory(s);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);

    try {
      const params = {};
      if (historyTimeFilter?.active) {
        if (historyTimeFilter.startTime) params.start_time = historyTimeFilter.startTime;
        if (historyTimeFilter.endTime) params.end_time = historyTimeFilter.endTime;
      }
      const history = await getStakeholderPayouts(s.id, params);
      setPayoutHistoryList(Array.isArray(history) ? history : []);
    } catch (err) {
      showNotification('error', err.message || 'Failed to load payout history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isHistoryModalOpen && stakeholderForHistory) {
      handleViewHistory(stakeholderForHistory);
    }
  }, [historyTimeFilter]);

  const filteredStakeholders = useMemo(() => {
    return stakeholders.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          s.name?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [stakeholders, searchQuery, statusFilter]);

  // Analytics Map for Quick Lookup of calculated profit share per stakeholder
  const calculatedSharesMap = useMemo(() => {
    const map = {};
    if (analytics?.stakeholders) {
      analytics.stakeholders.forEach((s) => {
        map[s.id] = s;
      });
    }
    return map;
  }, [analytics]);

  // SVG Donut Chart Slices Math
  const pieSlicesWithAngles = useMemo(() => {
    if (!analytics?.pie_chart || analytics.pie_chart.length === 0) return [];

    let currentAngle = 0;
    const radius = 80;
    const circumference = 2 * Math.PI * radius;

    return analytics.pie_chart.map((slice) => {
      const pct = Math.max(0, Math.min(100, slice.percentage || 0));
      const strokeDash = (pct / 100) * circumference;
      const rotation = currentAngle;
      currentAngle += (pct / 100) * 360;

      return {
        ...slice,
        radius,
        circumference,
        strokeDash,
        strokeDashoffset: circumference - strokeDash,
        rotation,
      };
    });
  }, [analytics]);

  return (
    <div style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 28px' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 20px',
            borderRadius: 'var(--radius-lg)',
            background:
              notification.type === 'success'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))',
            color: '#fff',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            fontSize: '0.9rem',
            fontWeight: 700,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
            }}
            title="Return to Menu"
          >
            <ArrowLeft size={16} />
            <span>Menu</span>
          </button>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(219, 39, 119, 0.3))',
              border: '1px solid rgba(236, 72, 153, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EC4899',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.25)',
            }}
          >
            <Briefcase size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              Stakeholders &amp; Profit Sharing
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="btn btn-secondary btn-icon"
            style={{ width: '38px', height: '38px', borderRadius: '50%' }}
            title="Refresh analytics"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Total Capital Invested */}
        <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(236, 72, 153, 0.14)',
              color: '#EC4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Capital Invested
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              ₹{parseFloat(analytics?.summary?.total_capital_invested || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              From {analytics?.summary?.active_stakeholders_count || 0} active contractual partners
            </div>
          </div>
        </div>

        {/* Period Net Profit Pool */}
        <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              {selectedTimeline === 'specific_month' ? 'Selected Month Profit Pool' : 'Period Net Profit Pool'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981' }}>
              ₹{parseFloat(analytics?.summary?.total_profit_pool || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Revenue: ₹{parseFloat(analytics?.summary?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Total Profit Disbursed Till Date */}
        <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Receipt size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Paid Till Date
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3B82F6' }}>
              ₹{parseFloat(analytics?.summary?.total_payouts_disbursed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Auto-updated after each month end
            </div>
          </div>
        </div>

        {/* Committed Profit Share */}
        <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PieChartIcon size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Profit Share Allocated
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B' }}>
              {analytics?.summary?.total_committed_percentage || 0}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Retained by company: <strong>{analytics?.summary?.retained_percentage || 100}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 420px) 1fr',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {/* Left Card: Interactive Donut / Pie Chart */}
        <div
          className="glass-panel"
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <PieChartIcon size={18} color="#EC4899" /> Profit Share Distribution
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Contractual profit allocation percentages
              </div>
            </div>
          </div>

          {/* Donut Chart SVG */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '210px',
              flexShrink: 0,
            }}
          >
            <svg
              width="210"
              height="210"
              viewBox="0 0 210 210"
              style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
            >
              {/* Background Track */}
              <circle
                cx="105"
                cy="105"
                r="80"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="19"
              />

              {/* Segment Slices */}
              {pieSlicesWithAngles.map((slice) => {
                const isHovered = hoveredSlice?.id === slice.id;
                return (
                  <circle
                    key={slice.id}
                    cx="105"
                    cy="105"
                    r={isHovered ? 82 : 80}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? 23 : 19}
                    strokeDasharray={`${slice.strokeDash} ${slice.circumference}`}
                    strokeDashoffset={0}
                    style={{
                      transformOrigin: '105px 105px',
                      transform: `rotate(${slice.rotation}deg)`,
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      filter: isHovered ? `drop-shadow(0 0 14px ${slice.color})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredSlice(slice)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                );
              })}
            </svg>

            {/* Center Readout (Percentages Only) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                textAlign: 'center',
                padding: '0 25px',
              }}
            >
              {hoveredSlice ? (
                <>
                  <div
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      color: hoveredSlice.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      maxWidth: '92px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.2,
                      marginBottom: '2px',
                    }}
                  >
                    {hoveredSlice.name}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.05 }}>
                    {hoveredSlice.percentage}%
                  </div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
                    Profit Share
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.60rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '2px' }}>
                    Profit Allocated
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B', lineHeight: 1.05 }}>
                    {analytics?.summary?.total_committed_percentage || 0}%
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 700, marginTop: '2px' }}>
                    {analytics?.summary?.retained_percentage || 100}% Retained
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend (Percentages Only) - Extends dynamically till bottom of window/card */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              paddingRight: '6px',
              marginTop: '4px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(236, 72, 153, 0.35) transparent',
            }}
          >
            {analytics?.pie_chart?.map((slice) => {
              const isHovered = hoveredSlice?.id === slice.id;
              return (
                <div
                  key={slice.id}
                  onMouseEnter={() => setHoveredSlice(slice)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: isHovered ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                    border: isHovered ? `1px solid ${slice.color}` : '1px solid var(--border-subtle)',
                    boxShadow: isHovered ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '3px',
                        background: slice.color,
                        boxShadow: `0 0 6px ${slice.color}`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isHovered ? 'var(--text-main)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {slice.name}
                    </span>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: '10px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 9px',
                        borderRadius: '6px',
                        background: isHovered ? `${slice.color}20` : 'var(--bg-surface-hover)',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        color: slice.color,
                        border: `1px solid ${slice.color}35`,
                      }}
                    >
                      {slice.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Performance Trend Spline Curve Graph */}
        <div
          className="glass-panel"
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minHeight: '520px',
          }}
        >
          {/* Card Header: Title & Metric Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <TrendingUp size={18} color={metricType === 'profit' ? '#10B981' : '#3B82F6'} />
                {metricType === 'profit' ? 'Net Profit Trajectory' : 'Gross Revenue Trajectory'}
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {selectedTimeline === 'past_2_months' && 'Past 2 months bi-weekly trajectory'}
                {selectedTimeline === 'last_3_months' && 'Past 3 months trajectory'}
                {selectedTimeline === 'last_6_months' && 'Past 6 months continuous trajectory'}
                {selectedTimeline === 'this_year' && 'Year 2026 trajectory'}
                {selectedTimeline === 'last_year' && 'Year 2025 annual trajectory'}
                {selectedTimeline === 'specific_month' && `4-week trajectory for ${specificMonth}`}
              </div>
            </div>

            {/* Metric Toggle: Profit vs Revenue */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-surface-hover)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setMetricType('profit')}
                style={{
                  padding: '5px 14px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: metricType === 'profit' ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                  color: metricType === 'profit' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: metricType === 'profit' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none',
                }}
              >
                Profit Share (₹)
              </button>
              <button
                type="button"
                onClick={() => setMetricType('revenue')}
                style={{
                  padding: '5px 14px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: metricType === 'revenue' ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'transparent',
                  color: metricType === 'revenue' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: metricType === 'revenue' ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
                }}
              >
                Revenue Share (₹)
              </button>
            </div>
          </div>

          {/* Smooth Spline Wave Curve Graph (Matching Reference Aesthetics in Website Theme) */}
          {(() => {
            const trendData = analytics?.monthly_trend || [];
            const svgWidth = 740;
            const svgHeight = 250;
            const padLeft = 68;
            const padRight = 36;
            const padTop = 38;
            const padBottom = 38;
            const plotWidth = svgWidth - padLeft - padRight;
            const plotHeight = svgHeight - padTop - padBottom;
            const baselineY = svgHeight - padBottom;

            const values = trendData.map((d) => (metricType === 'profit' ? d.total_profit : d.total_revenue));
            const rawMax = Math.max(...values, 1000);
            const maxVal = Math.ceil((rawMax * 1.22) / 10000) * 10000;

            const points = trendData.map((d, idx) => {
              const val = metricType === 'profit' ? d.total_profit : d.total_revenue;
              const x = trendData.length === 1
                ? padLeft + plotWidth / 2
                : padLeft + (idx * plotWidth) / (trendData.length - 1);
              const y = baselineY - (val / maxVal) * plotHeight;
              return { x, y, val, data: d, index: idx };
            });

            // Smooth Catmull-Rom Cubic Bezier Curve Generator
            const getSplinePath = (pts) => {
              if (!pts || pts.length === 0) return '';
              if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
              if (pts.length === 2) {
                const midX = (pts[0].x + pts[1].x) / 2;
                return `M ${pts[0].x} ${pts[0].y} C ${midX} ${pts[0].y}, ${midX} ${pts[1].y}, ${pts[1].x} ${pts[1].y}`;
              }

              const tension = 0.22;
              let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = i > 0 ? pts[i - 1] : pts[i];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

                const cp1x = p1.x + (p2.x - p0.x) * tension;
                const cp1y = p1.y + (p2.y - p0.y) * tension;
                const cp2x = p2.x - (p3.x - p1.x) * tension;
                const cp2y = p2.y - (p3.y - p1.y) * tension;

                d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
              }
              return d;
            };

            const splinePath = getSplinePath(points);
            const areaPath = points.length > 0
              ? `${splinePath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`
              : '';

            // Y-Axis Ticks (4 divisions)
            const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const val = maxVal * pct;
              const y = baselineY - pct * plotHeight;
              const label =
                val >= 100000
                  ? `₹${(val / 100000).toFixed(1)}L`
                  : val >= 1000
                  ? `₹${(val / 1000).toFixed(0)}k`
                  : `₹${val.toFixed(0)}`;
              return { val, y, label };
            });

            const activeIdx =
              selectedPointIndex !== null && selectedPointIndex < points.length
                ? selectedPointIndex
                : hoveredPointIndex !== null && hoveredPointIndex < points.length
                ? hoveredPointIndex
                : (points.length ? points.length - 1 : null);

            return (
              <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                >
                  <defs>
                    {/* Linear Gradient for Profit Stroke */}
                    <linearGradient id="profitCurveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="50%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>

                    {/* Linear Gradient for Profit Area Fill */}
                    <linearGradient id="profitAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                      <stop offset="60%" stopColor="#06B6D4" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>

                    {/* Linear Gradient for Revenue Stroke */}
                    <linearGradient id="revenueCurveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="60%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>

                    {/* Linear Gradient for Revenue Area Fill */}
                    <linearGradient id="revenueAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
                      <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#EC4899" stopOpacity="0.0" />
                    </linearGradient>

                    {/* Glow Filter */}
                    <filter id="curveGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow
                        dx="0"
                        dy="3"
                        stdDeviation="5"
                        floodColor={metricType === 'profit' ? '#10B981' : '#3B82F6'}
                        floodOpacity="0.45"
                      />
                    </filter>

                    {/* Floating Pill Badge Drop Shadow Filter */}
                    <filter id="pillShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow
                        dx="0"
                        dy="3"
                        stdDeviation="4"
                        floodColor="#000000"
                        floodOpacity="0.22"
                      />
                    </filter>
                  </defs>

                  {/* Horizontal Gridlines & Y-Axis Labels */}
                  {yTicks.map((t, idx) => (
                    <g key={idx}>
                      <line
                        x1={padLeft}
                        y1={t.y}
                        x2={svgWidth - padRight + 12}
                        y2={t.y}
                        stroke="var(--border-subtle)"
                        strokeDasharray={idx === 0 ? 'none' : '4 4'}
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 10}
                        y={t.y + 4}
                        fill="var(--text-muted)"
                        fontSize="10"
                        fontWeight="700"
                        textAnchor="end"
                        style={{ fontFamily: 'monospace' }}
                      >
                        {t.label}
                      </text>
                    </g>
                  ))}

                  {/* Y-Axis Line & Arrow */}
                  <line
                    x1={padLeft}
                    y1={padTop - 14}
                    x2={padLeft}
                    y2={baselineY}
                    stroke="var(--border-strong)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points={`${padLeft - 3},${padTop - 10} ${padLeft + 3},${padTop - 10} ${padLeft},${padTop - 18}`}
                    fill="var(--text-muted)"
                  />

                  {/* X-Axis Baseline & Arrow */}
                  <line
                    x1={padLeft}
                    y1={baselineY}
                    x2={svgWidth - padRight + 18}
                    y2={baselineY}
                    stroke="var(--border-strong)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points={`${svgWidth - padRight + 14},${baselineY - 3} ${svgWidth - padRight + 14},${baselineY + 3} ${svgWidth - padRight + 21},${baselineY}`}
                    fill="var(--text-muted)"
                  />

                  {/* Area Fill Under Curve */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill={metricType === 'profit' ? 'url(#profitAreaGradient)' : 'url(#revenueAreaGradient)'}
                    />
                  )}

                  {/* Smooth Spline Curve Line */}
                  {splinePath && (
                    <path
                      d={splinePath}
                      fill="none"
                      stroke={metricType === 'profit' ? 'url(#profitCurveGradient)' : 'url(#revenueCurveGradient)'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#curveGlow)"
                    />
                  )}

                  {/* X-Axis Ticks & Period Labels */}
                  {points.map((pt) => {
                    const isSelected = activeIdx === pt.index;
                    return (
                      <g key={`tick-${pt.index}`}>
                        <line
                          x1={pt.x}
                          y1={baselineY}
                          x2={pt.x}
                          y2={baselineY + 5}
                          stroke="var(--border-strong)"
                          strokeWidth="1.5"
                        />
                        <text
                          x={pt.x}
                          y={baselineY + 18}
                          fill={isSelected ? 'var(--text-main)' : 'var(--text-muted)'}
                          fontSize="10"
                          fontWeight={isSelected ? 800 : 600}
                          textAnchor="middle"
                        >
                          {pt.data.short_label || pt.data.month}
                        </text>
                      </g>
                    );
                  })}

                  {/* Data Points on Curve with Glowing Halo */}
                  {points.map((pt) => {
                    const isSelected = activeIdx === pt.index;
                    const isHovered = hoveredPointIndex === pt.index && !isSelected;
                    const themeColor = metricType === 'profit' ? '#10B981' : '#3B82F6';
                    const haloColor = metricType === 'profit' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.35)';
                    const badgeX = Math.max(padLeft + 20, Math.min(svgWidth - padRight - 20, pt.x));
                    const badgeY = Math.max(10, pt.y - 42);

                    return (
                      <g
                        key={`pt-${pt.index}`}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredPointIndex(pt.index)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        onClick={() => setSelectedPointIndex(selectedPointIndex === pt.index ? null : pt.index)}
                      >
                        {/* Outer Glow Halo (ONLY when selected, subtle hint when hovered) */}
                        {isSelected ? (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={14}
                            fill={haloColor}
                            style={{ transition: 'all 0.2s ease' }}
                          />
                        ) : isHovered ? (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={9}
                            fill={haloColor}
                            opacity="0.55"
                            style={{ transition: 'all 0.15s ease' }}
                          />
                        ) : null}

                        {/* Node Outer Circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6.5 : isHovered ? 5.5 : 4.5}
                          fill={themeColor}
                          stroke="var(--bg-surface)"
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                          style={{ transition: 'all 0.2s ease' }}
                        />

                        {/* Center Dot */}
                        <circle cx={pt.x} cy={pt.y} r={1.5} fill="var(--bg-surface)" />

                        {/* Floating Callout Badge: on hover or select with percentage change */}
                        {(isSelected || isHovered) && (() => {
                          const prevPt = pt.index > 0 ? points[pt.index - 1] : null;
                          const currLabel = pt.data.short_label || pt.data.month || 'Current';
                          const prevLabel = prevPt ? (prevPt.data.short_label || prevPt.data.month || 'Prev') : '';
                          const change = calculatePointChange(
                            pt.val,
                            prevPt ? prevPt.val : null,
                            currLabel,
                            prevLabel,
                            (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(2)}L` : `₹${(v / 1000).toFixed(1)}k`)
                          );
                          const calloutW = 168;
                          const calloutH = 34;
                          const cX = Math.max(padLeft + calloutW / 2, Math.min(svgWidth - padRight - calloutW / 2, pt.x));
                          const cY = Math.max(8, pt.y - 48);

                          return (
                            <g style={{ pointerEvents: 'none', transition: 'all 0.2s ease' }}>
                              {/* Vertical connector guide stem */}
                              <line
                                x1={pt.x}
                                y1={pt.y - 7}
                                x2={cX}
                                y2={cY + calloutH}
                                stroke="var(--text-muted)"
                                strokeDasharray="2 2"
                                strokeWidth="1.2"
                              />

                              {/* Floating Pill Badge */}
                              <rect
                                x={cX - calloutW / 2}
                                y={cY}
                                width={calloutW}
                                height={calloutH}
                                rx="8"
                                fill="var(--bg-surface-solid)"
                                stroke={themeColor}
                                strokeWidth="1.4"
                                filter="url(#pillShadow)"
                              />

                              {/* Pill Indicator Dot */}
                              <circle
                                cx={cX - calloutW / 2 + 12}
                                cy={cY + 12}
                                r="3"
                                fill={themeColor}
                              />

                              {/* Value & Percentage Badge */}
                              <text
                                x={cX - calloutW / 2 + 20}
                                y={cY + 15}
                                fill="var(--text-main)"
                                fontSize="10"
                                fontWeight="800"
                                textAnchor="start"
                              >
                                {pt.val >= 100000
                                  ? `₹${(pt.val / 100000).toFixed(2)}L`
                                  : `₹${(pt.val / 1000).toFixed(1)}k`}
                              </text>
                              <text
                                x={cX + calloutW / 2 - 10}
                                y={cY + 15}
                                fill={change.badgeColor}
                                fontSize="9"
                                fontWeight="800"
                                textAnchor="end"
                              >
                                {change.badgeText}
                              </text>

                              {/* Subtext: Comparative change description */}
                              <text
                                x={cX}
                                y={cY + 27}
                                fill="var(--text-muted)"
                                fontSize="8"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                {change.hasPrev
                                  ? `vs ${prevLabel} (${change.prevFormatted} → ${change.currentFormatted})`
                                  : 'Initial baseline point'}
                              </text>
                            </g>
                          );
                        })()}

                        {/* Wider Invisible Hit Target for Smooth Hover & Click */}
                        <circle cx={pt.x} cy={pt.y} r="22" fill="transparent" />
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}

          {/* Under Graph: Mention Percentage Each Person / Organization Owns */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '4px',
                  borderRadius: '2px',
                  background: metricType === 'profit'
                    ? 'linear-gradient(90deg, #06B6D4, #10B981)'
                    : 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                }}
              />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Profit Share Ownership:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {analytics?.pie_chart?.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${s.color}35`,
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: '0.74rem',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: s.color,
                      boxShadow: `0 0 5px ${s.color}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{s.name}:</span>
                  <strong style={{ color: s.color, fontWeight: 800 }}>{s.percentage}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Option Bar: Positioned Between Graph & Partner Distribution Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              marginTop: '4px',
            }}
          >
            {/* Left: Presets + Specific Month Dropdown all seamlessly unified */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '2px' }}>
                <Calendar size={15} color="#EC4899" />
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Timeline:
                </span>
              </div>

              {TIMELINE_PRESETS.map((preset) => {
                const isActive = selectedTimeline === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedTimeline(preset.id);
                      setIsMonthDropdownOpen(false);
                    }}
                    style={{
                      padding: '5px 13px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-pill)',
                      border: isActive ? '1px solid #EC4899' : '1px solid var(--border-subtle)',
                      background: isActive ? 'linear-gradient(135deg, #EC4899, #DB2777)' : 'var(--bg-surface)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 8px rgba(236, 72, 153, 0.35)' : 'var(--shadow-sm)',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}

              <div style={{ width: '1px', height: '16px', background: 'var(--border-strong)', margin: '0 3px' }} />

              {/* Custom Specific Month Dropdown Button */}
              <div ref={monthDropdownRef} style={{ position: 'relative' }}>
                {(() => {
                  const isSpecificActive = selectedTimeline === 'specific_month';
                  const activeMonthObj = AVAILABLE_MONTHS.find((m) => m.value === specificMonth);
                  const activeMonthLabel = activeMonthObj ? activeMonthObj.label.replace(' (Ongoing)', '') : specificMonth;

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 13px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-pill)',
                          border: isSpecificActive
                            ? '1px solid #EC4899'
                            : isMonthDropdownOpen
                            ? '1px solid rgba(236, 72, 153, 0.5)'
                            : '1px solid var(--border-subtle)',
                          background: isSpecificActive
                            ? 'linear-gradient(135deg, #EC4899, #DB2777)'
                            : 'var(--bg-surface)',
                          color: isSpecificActive ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSpecificActive ? '0 2px 8px rgba(236, 72, 153, 0.35)' : 'var(--shadow-sm)',
                        }}
                        title="Pick a specific month"
                      >
                        <span>{isSpecificActive ? `Month: ${activeMonthLabel}` : 'Specific Month'}</span>
                        <ChevronDown
                          size={13}
                          style={{
                            transform: isMonthDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </button>

                      {isMonthDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            minWidth: '220px',
                            maxHeight: '300px',
                            borderRadius: '12px',
                            background: 'var(--bg-surface-solid)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 1000,
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            animation: 'fadeIn 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px 8px',
                              borderBottom: '1px solid var(--border-subtle)',
                              marginBottom: '4px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Choose Month
                            </span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                color: '#EC4899',
                                fontWeight: 800,
                                background: 'rgba(236, 72, 153, 0.14)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              2025 – 2026
                            </span>
                          </div>

                          <div
                            style={{
                              overflowY: 'auto',
                              maxHeight: '220px',
                              paddingRight: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              scrollbarWidth: 'thin',
                              scrollbarColor: 'rgba(236, 72, 153, 0.3) transparent',
                            }}
                          >
                            {AVAILABLE_MONTHS.map((m) => {
                              const isSelected = selectedTimeline === 'specific_month' && specificMonth === m.value;
                              return (
                                <button
                                  key={m.value}
                                  type="button"
                                  onClick={() => {
                                    setSpecificMonth(m.value);
                                    setSelectedTimeline('specific_month');
                                    setIsMonthDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: isSelected ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                                    color: isSelected ? '#EC4899' : 'var(--text-main)',
                                    fontWeight: isSelected ? 800 : 600,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.12s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = 'var(--bg-surface-hover)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  <span>{m.label}</span>
                                  {isSelected && <Check size={14} color="#EC4899" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Active Period / Month Partner Profit Distribution Section */}
          {(() => {
            const trendData = analytics?.monthly_trend || [];
            const activeIdx =
              selectedPointIndex !== null && selectedPointIndex < trendData.length
                ? selectedPointIndex
                : hoveredPointIndex !== null && hoveredPointIndex < trendData.length
                ? hoveredPointIndex
                : (trendData.length ? trendData.length - 1 : null);

            const activePoint = activeIdx !== null && trendData ? trendData[activeIdx] : null;

            if (!activePoint) return null;

            const pointProfit = parseFloat(activePoint.total_profit || 0);
            const pointRevenue = parseFloat(activePoint.total_revenue || 0);

            return (
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        color: '#EC4899',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                      }}
                    >
                      {activePoint.month}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Partner {metricType === 'profit' ? 'Profit Distribution' : 'Revenue Distribution'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Period Revenue: </span>
                      <strong style={{ color: '#3B82F6' }}>₹{pointRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Net Profit Pool: </span>
                      <strong style={{ color: '#10B981' }}>₹{pointProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Stakeholder Shares Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                  {activePoint.stakeholder_breakdown?.map((sb) => {
                    const shareAmt = metricType === 'profit' ? sb.profit_share : sb.revenue_share;
                    return (
                      <div
                        key={sb.stakeholder_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: sb.color,
                              boxShadow: `0 0 6px ${sb.color}`,
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {sb.name}
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                              {sb.percentage}% share
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: metricType === 'profit' ? '#10B981' : '#3B82F6' }}>
                            ₹{parseFloat(shareAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                            {metricType === 'profit' ? 'profit cut' : 'revenue cut'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Stakeholder Directory Table (Same Page) */}
      <div className="glass-panel" style={{ padding: '22px 24px' }}>
        {/* Table Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Stakeholder Records &amp; Payout Ledger
            </h3>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Managing {filteredStakeholders.length} partner contracts and payout settlements
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
            {/* Search Input on the LEFT */}
            <div style={{ position: 'relative', width: '250px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner by name, phone..."
                className="form-input"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  paddingLeft: '32px',
                  paddingRight: '12px',
                  height: '36px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                }}
              />
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            {/* Status Filter on the RIGHT */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{
                width: 'auto',
                minWidth: '135px',
                height: '36px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                paddingLeft: '12px',
                paddingRight: '28px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused</option>
              <option value="settled">Settled</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 12px' }}>Stakeholder</th>
                <th style={{ padding: '10px 12px' }}>Capital Invested</th>
                <th style={{ padding: '10px 12px' }}>Profit Share %</th>
                <th style={{ padding: '10px 12px' }}>Contract Date</th>
                <th style={{ padding: '10px 12px' }}>Paid Till Today</th>
                <th style={{ padding: '10px 12px' }}>
                  {selectedTimeline === 'specific_month' ? 'Selected Month Share' : 'Period Share'}
                </th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStakeholders.map((s) => {
                const analyticsInfo = calculatedSharesMap[s.id];
                const calculatedProfit = analyticsInfo ? analyticsInfo.calculated_profit_share : '0.00';

                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                    className="table-row-hover"
                  >
                    {/* Stakeholder Name & Contact */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(219, 39, 119, 0.3))',
                            border: '1px solid rgba(236, 72, 153, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            color: '#EC4899',
                            fontSize: '0.8rem',
                            flexShrink: 0,
                          }}
                        >
                          {s.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {s.phone || s.email || 'No contact specified'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Capital Invested */}
                    <td style={{ padding: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                      ₹{parseFloat(s.investment_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Profit Share % */}
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#EC4899',
                          background: 'rgba(236, 72, 153, 0.12)',
                          border: '1px solid rgba(236, 72, 153, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '10px',
                        }}
                      >
                        {s.profit_percentage}%
                      </span>
                    </td>

                    {/* Contract Date */}
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        {s.contract_date}
                      </div>
                    </td>

                    {/* Paid Till Today */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 800, color: '#3B82F6' }}>
                        ₹{parseFloat(s.total_payout_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        End-of-month auto
                      </div>
                    </td>

                    {/* Calculated Current Share */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 800, color: '#10B981' }}>
                        ₹{parseFloat(calculatedProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        from current pool
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background:
                            s.status === 'active'
                              ? 'var(--color-success-bg)'
                              : s.status === 'paused'
                              ? 'var(--color-warning-bg)'
                              : 'rgba(148, 163, 184, 0.12)',
                          color:
                            s.status === 'active'
                              ? 'var(--color-success)'
                              : s.status === 'paused'
                              ? 'var(--color-warning)'
                              : 'var(--text-muted)',
                          border: `1px solid ${
                            s.status === 'active'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : s.status === 'paused'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : 'var(--border-subtle)'
                          }`,
                          textTransform: 'uppercase',
                        }}
                      >
                        ● {s.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(s)}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '30px', height: '30px', borderRadius: '6px' }}
                          title="Edit Stakeholder"
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteStakeholder(s)}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '30px', height: '30px', borderRadius: '6px', color: 'var(--color-danger)' }}
                          title="Remove Stakeholder"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStakeholders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Briefcase size={34} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                      <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        No Stakeholders Found
                      </div>
                      <div style={{ fontSize: '0.82rem', maxWidth: '440px', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                        No contractual stakeholders registered yet for this store. Click "+ Add Stakeholder" below to add your first investor or profit sharing partner.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Section Controls: Add Stakeholder Button */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredStakeholders.length} contractual profit-sharing partner{filteredStakeholders.length === 1 ? '' : 's'} in this store
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #EC4899, #BE185D)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              padding: '9px 22px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 4px 16px rgba(236, 72, 153, 0.35)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.84rem',
            }}
          >
            <Plus size={16} />
            <span>Add Stakeholder</span>
          </button>
        </div>
      </div>

      {/* MODAL: ADD / EDIT STAKEHOLDER */}
      {isAddEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsAddEditModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(219, 39, 119, 0.3))',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#EC4899',
                  }}
                >
                  <Briefcase size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingStakeholder ? 'Edit Stakeholder Details' : 'Add New Profit-Sharing Stakeholder'}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Contractual profit sharing partner agreement
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveStakeholder}
              style={{
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* Partner Name */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Stakeholder / Partner Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Aarav Singhania or Apex Ventures"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Contact Info (Phone & Email) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9820011223"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="partner@wondersale.com"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Investment Amount & Profit Share % */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Capital Invested (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={formData.investment_amount}
                      onChange={(e) => setFormData({ ...formData, investment_amount: e.target.value })}
                      placeholder="e.g. 500000"
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '24px', fontWeight: 700 }}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#EC4899', fontWeight: 800 }}>₹</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Profit Share Percentage (%) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      required
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={formData.profit_percentage}
                      onChange={(e) => setFormData({ ...formData, profit_percentage: e.target.value })}
                      placeholder="e.g. 10.00"
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', paddingRight: '26px', fontWeight: 700, color: '#EC4899' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#EC4899', fontWeight: 800 }}>%</span>
                  </div>
                </div>
              </div>

              {/* Contract Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Contract Start Date <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.contract_date}
                    onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Contract End Date <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.contract_end_date}
                    onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Status & Store Scope */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="active">🟢 Active Partner</option>
                    <option value="paused">🟡 Paused / On Hold</option>
                    <option value="settled">⚪ Settled / Concluded</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Paid Till Today (₹) <span style={{ fontSize: '0.68rem', color: '#3B82F6' }}>● Manual control &amp; auto-accrued</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.total_payout_paid}
                      onChange={(e) => setFormData({ ...formData, total_payout_paid: e.target.value })}
                      placeholder="0.00"
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '24px', fontWeight: 700, color: '#3B82F6' }}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#3B82F6', fontWeight: 800 }}>₹</span>
                  </div>
                </div>
              </div>

              {/* Agreement Notes & Bank Details */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Contract Terms, Notes &amp; Bank Details
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Bank Account / UPI ID for profit disbursements, renewal conditions..."
                  rows={2}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsAddEditModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #BE185D)', fontWeight: 800 }}
                >
                  {editingStakeholder ? 'Update Contract' : 'Register Stakeholder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYOUT */}
      {isPayoutModalOpen && stakeholderForPayout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsPayoutModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10B981',
                  }}
                >
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Record Profit Payout
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Disburse profit payout to {stakeholderForPayout.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitPayout}
              style={{
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Partner Overview Badge */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(236, 72, 153, 0.08)',
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contractual Share</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#EC4899' }}>
                    {stakeholderForPayout.profit_percentage}% Profit Share
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Already Disbursed</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#3B82F6' }}>
                    ₹{parseFloat(stakeholderForPayout.total_payout_paid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Payout Amount (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                    placeholder="e.g. 25000"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '24px', fontWeight: 800, fontSize: '1.05rem', color: '#10B981' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#10B981', fontWeight: 800 }}>₹</span>
                </div>
              </div>

              {/* Payout Date & Method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Payment Date <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutForm.payout_date}
                    onChange={(e) => setPayoutForm({ ...payoutForm, payout_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Payment Method
                  </label>
                  <select
                    value={payoutForm.payment_method}
                    onChange={(e) => setPayoutForm({ ...payoutForm, payment_method: e.target.value })}
                    className="form-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="bank_transfer">🏦 Bank Transfer / NEFT</option>
                    <option value="upi">📱 UPI / QR</option>
                    <option value="cheque">📝 Cheque</option>
                    <option value="cash">💵 Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Reference ID / UTR */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Bank UTR / Transaction Reference ID
                </label>
                <input
                  type="text"
                  value={payoutForm.reference_id}
                  onChange={(e) => setPayoutForm({ ...payoutForm, reference_id: e.target.value })}
                  placeholder="e.g. UTR-2026-99881122"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Notes / Description
                </label>
                <input
                  type="text"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  placeholder="e.g. Q3 Profit settlement for July-September"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsPayoutModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', fontWeight: 800 }}
                >
                  {submittingPayout ? 'Processing...' : 'Confirm & Disburse Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAYOUT HISTORY LEDGER */}
      {isHistoryModalOpen && stakeholderForHistory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3B82F6',
                  }}
                >
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Payout Disbursement Ledger
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {stakeholderForHistory.name} • Total Paid: ₹{parseFloat(stakeholderForHistory.total_payout_paid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TimeRangeFilter
                  compact={true}
                  filterState={historyTimeFilter}
                  onFilterChange={setHistoryTimeFilter}
                />
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Loading transaction history...
                </div>
              ) : filterLogsByTimeRange(payoutHistoryList, historyTimeFilter, ['payout_date', 'created_at']).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filterLogsByTimeRange(payoutHistoryList, historyTimeFilter, ['payout_date', 'created_at']).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface-hover)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981' }}>
                            ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#3B82F6',
                            }}
                          >
                            {p.payment_method_display || p.payment_method}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {p.notes || 'Profit share disbursement'}
                          {p.reference_id ? ` • Ref: ${p.reference_id}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>{p.payout_date}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Completed</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No past payout disbursements recorded for this stakeholder yet.
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsHistoryModalOpen(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
