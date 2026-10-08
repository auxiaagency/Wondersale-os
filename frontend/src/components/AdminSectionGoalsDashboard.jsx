/**
 * AdminSectionGoalsDashboard.jsx
 *
 * Dedicated Admin & Owner Workstation for Section Monthly Target & Goals Management:
 *   - Overview of monthly targets across all store sections
 *   - Live actuals synchronized with the store financial analysis engine
 *   - Real-time progress bars for Revenue and Gross Profit
 *   - Strict auto-lock evaluation and status countdown (auto-locks on the 3rd of subsequent month at 23:59:59)
 *   - Interactive Goal Setting / Editing Modal
 *   - Dense Matrix Table and Grid View modes
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Target, TrendingUp, DollarSign, Calendar, Lock, Unlock,
  CheckCircle2, AlertCircle, Edit3, Save, X, RefreshCw,
  Sparkles, Award, ArrowRight, Shield, ShieldAlert,
  Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, Users, Tag, Building2,
} from 'lucide-react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import { fetchSectionGoals, saveSectionGoal, fetchMonthlyFinancialAnalysis } from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminSectionGoalsDashboard({
  stores = [],
  sections = [],
  staffMembers = [],
  currentUser = null,
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear]   = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [storeFilter, setStoreFilter]     = useState('');
  const [search, setSearch]               = useState('');
  const [viewMode, setViewMode]           = useState('grid'); // 'grid' | 'table'

  const [goals, setGoals]                 = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  // Target Goal Setting Modal
  const [modalOpen, setModalOpen]         = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [targetRevInput, setTargetRevInput] = useState('');
  const [targetProfInput, setTargetProfInput] = useState('');
  const [notesInput, setNotesInput]       = useState('');
  const [modalSaving, setModalSaving]     = useState(false);
  const [modalError, setModalError]       = useState('');
  const [modalSuccess, setModalSuccess]   = useState('');

  // Calculate auto-lock details for selected period
  const lockDetails = useMemo(() => {
    // Lock deadline is the 3rd day of the subsequent month at 23:59:59
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    const deadline = new Date(nextYear, nextMonth - 1, 3, 23, 59, 59);
    const nowTime = new Date();

    const isPeriodLocked = nowTime > deadline;
    const diffMs = deadline - nowTime;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      isPeriodLocked,
      deadlineStr: `3rd ${MONTH_NAMES[nextMonth - 1]} ${nextYear} at 23:59`,
      daysRemaining,
    };
  }, [selectedYear, selectedMonth]);

  // Load section goals and store financial analysis for selected period
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [goalsRes, finRes] = await Promise.all([
        fetchSectionGoals({
          year: selectedYear,
          month: selectedMonth,
          store: storeFilter || undefined,
        }).catch(() => []),
        fetchMonthlyFinancialAnalysis({
          year: selectedYear,
          month: selectedMonth,
          store: storeFilter || undefined,
        }).catch(() => null),
      ]);
      setGoals(goalsRes || []);
      setFinancialData(finRes);
    } catch (err) {
      console.error('Failed to load section goals dashboard data:', err);
      setError('Could not load section goals or financial analysis.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, storeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  };

  // Merge sections with their goals, financial actuals, and staff count
  const sectionCards = useMemo(() => {
    const finSections = financialData?.sections || [];

    return sections.map(sec => {
      const goalObj = goals.find(g => String(g.section) === String(sec.id));
      const finSec = finSections.find(s => String(s.id) === String(sec.id));

      const targetRev = goalObj ? Number(goalObj.target_revenue || 0) : 0;
      const targetProf = goalObj ? Number(goalObj.target_profit || 0) : 0;
      const actualRev = finSec ? Number(finSec.revenue || 0) : (goalObj ? Number(goalObj.actual_revenue || 0) : 0);
      const actualProf = finSec ? Number(finSec.gross_profit || 0) : (goalObj ? Number(goalObj.actual_profit || 0) : 0);

      const revPct = targetRev > 0 ? Math.min(999, Math.round((actualRev / targetRev) * 100)) : 0;
      const profPct = targetProf > 0 ? Math.min(999, Math.round((actualProf / targetProf) * 100)) : 0;

      const isLocked = Boolean(goalObj?.is_locked || lockDetails.isPeriodLocked);
      const assignedStaff = staffMembers.filter(m => String(m.section) === String(sec.id));

      return {
        ...sec,
        goalObj,
        targetRev,
        targetProf,
        actualRev,
        actualProf,
        revPct,
        profPct,
        isLocked,
        hasGoal: Boolean(goalObj && (targetRev > 0 || targetProf > 0)),
        assignedStaff,
      };
    });
  }, [sections, goals, financialData, staffMembers, lockDetails]);

  // Filter sections by search and store
  const filteredSections = useMemo(() => {
    return sectionCards.filter(sec => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        sec.name?.toLowerCase().includes(q) ||
        sec.code?.toLowerCase().includes(q);
      const matchStore = !storeFilter || String(sec.store) === String(storeFilter);
      return matchSearch && matchStore;
    });
  }, [sectionCards, search, storeFilter]);

  // Aggregate overarching KPIs
  const summaryKPIs = useMemo(() => {
    let totalTargetRev = 0;
    let totalActualRev = 0;
    let totalTargetProf = 0;
    let totalActualProf = 0;
    let configuredCount = 0;
    let reachedCount = 0;

    sectionCards.forEach(s => {
      totalTargetRev += s.targetRev;
      totalActualRev += s.actualRev;
      totalTargetProf += s.targetProf;
      totalActualProf += s.actualProf;
      if (s.hasGoal) configuredCount++;
      if (s.hasGoal && s.revPct >= 100) reachedCount++;
    });

    const aggregateRevPct = totalTargetRev > 0 ? Math.min(999, Math.round((totalActualRev / totalTargetRev) * 100)) : 0;
    const aggregateProfPct = totalTargetProf > 0 ? Math.min(999, Math.round((totalActualProf / totalTargetProf) * 100)) : 0;

    return {
      totalTargetRev,
      totalActualRev,
      totalTargetProf,
      totalActualProf,
      aggregateRevPct,
      aggregateProfPct,
      configuredCount,
      reachedCount,
      totalSections: sectionCards.length,
    };
  }, [sectionCards]);

  // Open modal for setting target
  const handleOpenGoalModal = (sec) => {
    setActiveSection(sec);
    setTargetRevInput(sec.targetRev > 0 ? String(sec.targetRev) : '');
    setTargetProfInput(sec.targetProf > 0 ? String(sec.targetProf) : '');
    setNotesInput(sec.goalObj?.notes || '');
    setModalError('');
    setModalSuccess('');
    setModalOpen(true);
  };

  const handleSaveModalGoal = async () => {
    if (!activeSection) return;
    setModalError('');
    setModalSuccess('');

    const revNum = parseFloat(targetRevInput);
    const profNum = parseFloat(targetProfInput);

    if (isNaN(revNum) || revNum < 0) {
      setModalError('Please enter a valid non-negative Target Revenue amount.');
      return;
    }
    if (isNaN(profNum) || profNum < 0) {
      setModalError('Please enter a valid non-negative Target Gross Profit amount.');
      return;
    }

    setModalSaving(true);
    try {
      const payload = {
        section: activeSection.id,
        store: activeSection.store || undefined,
        year: selectedYear,
        month: selectedMonth,
        target_revenue: revNum,
        target_profit: profNum,
        notes: notesInput.trim(),
      };
      await saveSectionGoal(payload);
      setModalSuccess(`Goal for ${activeSection.name} saved successfully!`);
      await loadData();
      setTimeout(() => {
        setModalOpen(false);
        setActiveSection(null);
      }, 900);
    } catch (err) {
      setModalError(err.message || 'Failed to save section goal.');
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & MONTH/STORE SELECTION CONTROLS                            */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 46, height: 46, borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(197,34,36,0.18) 100%)',
            color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <Target size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 800,
                color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Owner &amp; Administrator Portal
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Target Governance &amp; Auto-Lock
              </span>
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Section Monthly Goals &amp; Targets
            </h2>
          </div>
        </div>

        {/* Period Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
            padding: '4px 6px', borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="btn btn-secondary"
              style={{ width: 34, height: 34, padding: 0, borderRadius: '8px' }}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-primary)', fontWeight: 700,
                fontSize: '0.9rem', padding: '0 8px', outline: 'none', cursor: 'pointer',
              }}
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1} style={{ background: '#1e293b' }}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-primary)', fontWeight: 700,
                fontSize: '0.9rem', padding: '0 8px', outline: 'none', cursor: 'pointer',
              }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y} style={{ background: '#1e293b' }}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="btn btn-secondary"
              style={{ width: 34, height: 34, padding: 0, borderRadius: '8px' }}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {(selectedYear !== currentYear || selectedMonth !== currentMonth) && (
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '10px', fontWeight: 700 }}
            >
              Current Month
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: 38, height: 38, padding: 0, borderRadius: '10px' }}
            title="Refresh Goals"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AUTO-LOCK STATUS NOTICE BANNER                                         */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: lockDetails.isPeriodLocked
            ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(56,189,248,0.06) 100%)',
          border: `1px solid ${lockDetails.isPeriodLocked ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '8px',
            background: lockDetails.isPeriodLocked ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            color: lockDetails.isPeriodLocked ? '#ef4444' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {lockDetails.isPeriodLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {lockDetails.isPeriodLocked
                ? `Period Auto-Locked — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                : `Active Goal Period — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {lockDetails.isPeriodLocked
                ? `Target values and financial actuals for this period permanently locked on ${lockDetails.deadlineStr} for audit integrity.`
                : `Targets remain open for adjustment until ${lockDetails.deadlineStr} (${lockDetails.daysRemaining} days remaining).`}
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800,
          background: lockDetails.isPeriodLocked ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
          color: lockDetails.isPeriodLocked ? '#ef4444' : '#10b981',
          border: `1px solid ${lockDetails.isPeriodLocked ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
        }}>
          {lockDetails.isPeriodLocked ? <Lock size={12} /> : <Clock size={12} />}
          <span>{lockDetails.isPeriodLocked ? 'LOCKED & FROZEN' : `${lockDetails.daysRemaining} DAYS TO LOCK`}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. OVERARCHING KPI SUMMARY RIBBON                                         */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        {/* Card 1: Revenue Target vs Actuals */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Section Sales
            </span>
            <DollarSign size={15} color="#38bdf8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatIndianCurrencyCompact(summaryKPIs.totalActualRev)}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              / {formatIndianCurrencyCompact(summaryKPIs.totalTargetRev)}
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, summaryKPIs.aggregateRevPct)}%`,
              height: '100%',
              background: summaryKPIs.aggregateRevPct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #38bdf8, #818cf8)',
              borderRadius: '3px',
            }} />
          </div>
          <div style={{ fontSize: '0.74rem', color: summaryKPIs.aggregateRevPct >= 100 ? '#22c55e' : '#38bdf8', fontWeight: 700 }}>
            {summaryKPIs.aggregateRevPct}% Overall Revenue Target Achieved
          </div>
        </div>

        {/* Card 2: Profit Target vs Actuals */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Gross Profit
            </span>
            <TrendingUp size={15} color="#00e5a3" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#00e5a3' }}>
              {formatIndianCurrencyCompact(summaryKPIs.totalActualProf)}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              / {formatIndianCurrencyCompact(summaryKPIs.totalTargetProf)}
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, summaryKPIs.aggregateProfPct)}%`,
              height: '100%',
              background: summaryKPIs.aggregateProfPct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #00e5a3, #10b981)',
              borderRadius: '3px',
            }} />
          </div>
          <div style={{ fontSize: '0.74rem', color: summaryKPIs.aggregateProfPct >= 100 ? '#22c55e' : '#00e5a3', fontWeight: 700 }}>
            {summaryKPIs.aggregateProfPct}% Overall Profit Target Achieved
          </div>
        </div>

        {/* Card 3: Target Coverage */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Configured Sections
            </span>
            <Target size={15} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summaryKPIs.configuredCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {summaryKPIs.totalSections}</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {summaryKPIs.totalSections - summaryKPIs.configuredCount === 0
              ? '100% of departments have targets set'
              : `${summaryKPIs.totalSections - summaryKPIs.configuredCount} department(s) missing targets`}
          </div>
        </div>

        {/* Card 4: Goals Met Count */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Goal Achieved Count
            </span>
            <Award size={15} color="#22c55e" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#22c55e' }}>
            {summaryKPIs.reachedCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sections</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 600 }}>
            Sections surpassing 100% monthly target
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SEARCH, FILTER & VIEW CONTROLS TOOLBAR                                 */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search section name or code…"
              className="form-control"
              style={{
                width: '100%', height: '40px', padding: '0 14px 0 40px',
                borderRadius: '10px', fontSize: '0.86rem',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
              }}
            />
          </div>

          {stores.length > 1 && (
            <select
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
              className="form-select"
              style={{
                height: '40px', padding: '0 12px', borderRadius: '10px',
                fontSize: '0.84rem', background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
              }}
            >
              <option value="">All Stores</option>
              {stores.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          )}

          {(search || storeFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setStoreFilter(''); }}
              className="btn btn-secondary"
              style={{ height: '40px', padding: '0 14px', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              Reset
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              width: 36, height: 36, borderRadius: '8px', border: 'none',
              background: viewMode === 'grid' ? 'var(--brand-primary, #c52224)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Card Grid Mode"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              width: 36, height: 36, borderRadius: '8px', border: 'none',
              background: viewMode === 'table' ? 'var(--brand-primary, #c52224)' : 'transparent',
              color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="High Density Table Mode"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SECTIONS GOALS GRID / TABLE CONTENT                                    */}
      {/* ========================================================================= */}
      {filteredSections.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '60px 20px', borderRadius: '18px', textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <Filter size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No sections found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Try clearing your search query or store filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '18px',
        }}>
          {filteredSections.map(sec => (
            <div
              key={sec.id}
              className="glass-panel"
              style={{
                padding: '22px', borderRadius: '18px',
                background: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', gap: '18px',
                border: '1px solid var(--border-subtle)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Accent Banner */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: sec.color || '#38bdf8',
              }} />

              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px',
                    background: sec.color ? `${sec.color}22` : 'rgba(56,189,248,0.15)',
                    color: sec.color || '#38bdf8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${sec.color ? `${sec.color}44` : 'rgba(56,189,248,0.3)'}`,
                  }}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {sec.name}
                    </h4>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {sec.code && <span>Code: <b>{sec.code}</b> • </span>}
                      <span>{sec.assignedStaff.length} staff member(s)</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                {sec.isLocked ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
                    background: 'rgba(239,68,68,0.14)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Lock size={11} /> Locked
                  </span>
                ) : sec.revPct >= 100 ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
                    background: 'rgba(34,197,94,0.14)', color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Award size={11} /> Target Met
                  </span>
                ) : sec.hasGoal ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
                    background: 'rgba(56,189,248,0.14)', color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Sparkles size={11} /> In Progress
                  </span>
                ) : (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    No Target Set
                  </span>
                )}
              </div>

              {/* Progress Gauges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Revenue Metric */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sales Revenue Target</span>
                    <span style={{ fontWeight: 800, color: sec.revPct >= 100 ? '#22c55e' : '#38bdf8' }}>
                      {formatIndianCurrencyCompact(sec.actualRev)} / {formatIndianCurrencyCompact(sec.targetRev)} ({sec.revPct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, sec.revPct)}%`,
                      height: '100%',
                      background: sec.revPct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease-out',
                    }} />
                  </div>
                </div>

                {/* Gross Profit Metric */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Gross Profit Target</span>
                    <span style={{ fontWeight: 800, color: sec.profPct >= 100 ? '#22c55e' : '#00e5a3' }}>
                      {formatIndianCurrencyCompact(sec.actualProf)} / {formatIndianCurrencyCompact(sec.targetProf)} ({sec.profPct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, sec.profPct)}%`,
                      height: '100%',
                      background: sec.profPct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #00e5a3, #10b981)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease-out',
                    }} />
                  </div>
                </div>
              </div>

              {/* Card Footer Action */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {sec.store_details?.name || 'All Stores'}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenGoalModal(sec)}
                  className={sec.isLocked ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{
                    fontSize: '0.76rem', padding: '6px 14px', borderRadius: '8px',
                    fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {sec.isLocked ? <Lock size={13} /> : <Edit3 size={13} />}
                  <span>{sec.isLocked ? 'View Locked Goal' : (sec.hasGoal ? 'Adjust Target' : 'Set Target')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* High Density Table View */
        <div
          className="glass-panel"
          style={{
            borderRadius: '16px', overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Section / Department</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Target Sales (₹)</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Actual Sales (₹)</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Target Profit (₹)</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Actual Profit (₹)</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map(sec => (
                <tr
                  key={sec.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: sec.color || '#38bdf8', flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{sec.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {sec.code || 'No code'} • {sec.assignedStaff.length} staff
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatIndianCurrencyCompact(sec.targetRev)}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontWeight: 800, color: sec.revPct >= 100 ? '#22c55e' : '#38bdf8' }}>
                      {formatIndianCurrencyCompact(sec.actualRev)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                      ({sec.revPct}%)
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatIndianCurrencyCompact(sec.targetProf)}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontWeight: 800, color: sec.profPct >= 100 ? '#22c55e' : '#00e5a3' }}>
                      {formatIndianCurrencyCompact(sec.actualProf)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                      ({sec.profPct}%)
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    {sec.isLocked ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800,
                        background: 'rgba(239,68,68,0.14)', color: '#ef4444',
                      }}>
                        Locked
                      </span>
                    ) : sec.revPct >= 100 ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800,
                        background: 'rgba(34,197,94,0.14)', color: '#22c55e',
                      }}>
                        Goal Reached
                      </span>
                    ) : sec.hasGoal ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(56,189,248,0.14)', color: '#38bdf8',
                      }}>
                        In Progress
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Target</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenGoalModal(sec)}
                      className={sec.isLocked ? 'btn btn-secondary' : 'btn btn-primary'}
                      style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}
                    >
                      {sec.isLocked ? 'View' : (sec.hasGoal ? 'Adjust' : 'Set Target')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SET / EDIT GOAL MODAL                                                  */}
      {/* ========================================================================= */}
      {modalOpen && activeSection && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div
            className="glass-panel"
            style={{
              width: '100%', maxWidth: '480px', borderRadius: '20px',
              padding: '28px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: '20px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '10px',
                  background: activeSection.color ? `${activeSection.color}22` : 'rgba(56,189,248,0.15)',
                  color: activeSection.color || '#38bdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeSection.isLocked ? 'Locked Goal Details' : 'Set Monthly Target'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {activeSection.name} • {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary"
                style={{ width: 32, height: 32, padding: 0, borderRadius: '8px' }}
              >
                <X size={15} />
              </button>
            </div>

            {modalSuccess && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.84rem', fontWeight: 600,
              }}>
                <CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {modalSuccess}
              </div>
            )}

            {modalError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.84rem', fontWeight: 600,
              }}>
                <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {modalError}
              </div>
            )}

            {activeSection.isLocked && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', lineHeight: 1.5,
              }}>
                <Lock size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                This target period is permanently auto-locked and cannot be altered. Actuals are frozen.
              </div>
            )}

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Target Monthly Revenue (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetRevInput}
                  onChange={e => setTargetRevInput(e.target.value)}
                  disabled={activeSection.isLocked || modalSaving}
                  placeholder="e.g. 150000"
                  className="form-control"
                  style={{
                    width: '100%', height: '42px', padding: '0 14px', borderRadius: '10px',
                    background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                    border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    fontSize: '0.94rem', fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Target Monthly Gross Profit (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetProfInput}
                  onChange={e => setTargetProfInput(e.target.value)}
                  disabled={activeSection.isLocked || modalSaving}
                  placeholder="e.g. 50000"
                  className="form-control"
                  style={{
                    width: '100%', height: '42px', padding: '0 14px', borderRadius: '10px',
                    background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                    border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    fontSize: '0.94rem', fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Notes &amp; Strategy Guidelines (Optional)
                </label>
                <textarea
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  disabled={activeSection.isLocked || modalSaving}
                  placeholder="e.g. Focus on promoting newly received festive catalog items..."
                  rows={3}
                  className="form-control"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                    border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    fontSize: '0.84rem', resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: 600 }}
              >
                Close
              </button>

              {!activeSection.isLocked && (
                <button
                  type="button"
                  onClick={handleSaveModalGoal}
                  disabled={modalSaving}
                  className="btn btn-primary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 22px', borderRadius: '10px', fontWeight: 700,
                  }}
                >
                  <Save size={15} />
                  <span>{modalSaving ? 'Saving…' : 'Save Monthly Goal'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
