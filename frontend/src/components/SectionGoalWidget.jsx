import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Target, TrendingUp, DollarSign, Calendar, Lock, Unlock,
  CheckCircle2, AlertCircle, Edit3, Save, X, RefreshCw,
  Sparkles, Award, ArrowRight, ShieldAlert,
} from 'lucide-react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import { fetchSectionGoals, saveSectionGoal } from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SectionGoalWidget({
  sectionId,
  sectionName = 'Section',
  sectionColor = '#38BDF8',
  storeId = null,
  isOwner = false,
  activeYear = 2026,
  activeMonth = 10,
  currentRevenue = 0,
  currentProfit = 0,
  onGoalUpdated = null,
}) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [targetRevInput, setTargetRevInput] = useState('');
  const [targetProfInput, setTargetProfInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-lock deadline label for current period (3rd of next month at 23:59:59)
  const lockDeadlineLabel = useMemo(() => {
    const nextMonthIdx = activeMonth === 12 ? 0 : activeMonth;
    const nextYear = activeMonth === 12 ? activeYear + 1 : activeYear;
    return `3rd ${MONTH_NAMES[nextMonthIdx]} ${nextYear}, 23:59`;
  }, [activeMonth, activeYear]);

  const loadGoal = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const goals = await fetchSectionGoals({
        section: sectionId,
        year: activeYear,
        month: activeMonth,
      });
      const current = goals && goals.length > 0 ? goals[0] : null;
      setGoal(current);
      if (current) {
        setTargetRevInput(String(current.target_revenue || ''));
        setTargetProfInput(String(current.target_profit || ''));
        setNotesInput(current.notes || '');
      } else {
        setTargetRevInput('');
        setTargetProfInput('');
        setNotesInput('');
      }
    } catch (err) {
      console.error('Failed to load section monthly goal:', err);
    } finally {
      setLoading(false);
    }
  }, [sectionId, activeYear, activeMonth]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const handleSaveGoal = async () => {
    setError('');
    setSuccess('');
    const revNum = parseFloat(targetRevInput);
    const profNum = parseFloat(targetProfInput);
    if (isNaN(revNum) || revNum < 0) {
      setError('Please provide a valid Target Revenue amount.');
      return;
    }
    if (isNaN(profNum) || profNum < 0) {
      setError('Please provide a valid Target Gross Profit amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        section: sectionId,
        store: storeId || undefined,
        year: activeYear,
        month: activeMonth,
        target_revenue: revNum,
        target_profit: profNum,
        notes: notesInput.trim(),
      };
      const res = await saveSectionGoal(payload);
      setGoal(res);
      setEditing(false);
      setSuccess('Monthly section target saved successfully!');
      onGoalUpdated?.(res);
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save section goal.');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = goal?.is_locked;
  const targetRevenue = parseFloat(goal?.target_revenue || 0);
  const targetProfit = parseFloat(goal?.target_profit || 0);
  const actualRevenue = currentRevenue || parseFloat(goal?.actual_revenue || 0);
  const actualProfit = currentProfit || parseFloat(goal?.actual_profit || 0);

  const revAchievement = targetRevenue > 0
    ? Math.round((actualRevenue / targetRevenue) * 100 * 10) / 10
    : (actualRevenue > 0 ? 100 : 0);

  const profitAchievement = targetProfit > 0
    ? Math.round((actualProfit / targetProfit) * 100 * 10) / 10
    : (actualProfit > 0 ? 100 : 0);

  const isGoalReached = targetRevenue > 0 && revAchievement >= 100;

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '16px',
        padding: '20px 24px',
        background: 'var(--bg-surface, #0f172a)',
        border: isLocked
          ? '1px solid rgba(245, 158, 11, 0.3)'
          : isGoalReached
            ? '1px solid rgba(34, 197, 94, 0.4)'
            : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        boxShadow: isGoalReached ? '0 8px 30px rgba(34, 197, 94, 0.15)' : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Gradient Stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: isGoalReached
            ? 'linear-gradient(90deg, #22c55e, #10b981)'
            : `linear-gradient(90deg, ${sectionColor || '#38bdf8'}, #6366f1)`,
        }}
      />

      {/* Header Row: Title + Period + Lock Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '10px',
              backgroundColor: `${sectionColor || '#38bdf8'}22`,
              color: sectionColor || '#38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Target size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {sectionName} — Monthly Performance Target
              </h4>
              {isGoalReached && (
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem',
                    fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.18)', color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}
                >
                  <Award size={12} /> Target Exceeded!
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Calendar size={12} />
              <span>Period: <b>{MONTH_NAMES[activeMonth - 1]} {activeYear}</b></span>
            </div>
          </div>
        </div>

        {/* Lock Status & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isLocked ? (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.35)',
              }}
              title={`Permanently locked on the 3rd of subsequent month (${goal?.locked_at ? new Date(goal.locked_at).toLocaleDateString() : 'Auto-locked'})`}
            >
              <Lock size={12} /> Target Locked
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600,
                backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
              title={`Auto-locks on ${lockDeadlineLabel}`}
            >
              <Unlock size={12} /> Auto-locks on {lockDeadlineLabel}
            </span>
          )}

          {isOwner && !isLocked && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              <Edit3 size={13} /> {goal ? 'Adjust Target' : 'Set Monthly Target'}
            </button>
          )}
        </div>
      </div>

      {/* Inline Notifications */}
      {error && (
        <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={14} /> <span>{success}</span>
        </div>
      )}

      {/* Edit Form for Owner */}
      {editing && isOwner && (
        <div
          style={{
            padding: '16px', borderRadius: '12px',
            backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Target Gross Revenue (₹)
              </label>
              <input
                type="number"
                step="500"
                min="0"
                value={targetRevInput}
                onChange={e => setTargetRevInput(e.target.value)}
                placeholder="e.g. 100000"
                className="form-input"
                style={{
                  width: '100%', height: '38px', borderRadius: '8px', padding: '0 10px',
                  background: 'var(--bg-input, #1e293b)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)', fontSize: '0.88rem', fontWeight: 700,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Target Gross Profit (₹)
              </label>
              <input
                type="number"
                step="500"
                min="0"
                value={targetProfInput}
                onChange={e => setTargetProfInput(e.target.value)}
                placeholder="e.g. 40000"
                className="form-input"
                style={{
                  width: '100%', height: '38px', borderRadius: '8px', padding: '0 10px',
                  background: 'var(--bg-input, #1e293b)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)', fontSize: '0.88rem', fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Strategic Goal Note (Optional for Employee)
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="e.g. Focus on clearance of high-margin items this month"
              className="form-input"
              style={{
                width: '100%', height: '36px', borderRadius: '8px', padding: '0 10px',
                background: 'var(--bg-input, #1e293b)', color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)', fontSize: '0.82rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); }}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveGoal}
              disabled={saving}
              className="btn btn-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 16px', fontSize: '0.8rem', fontWeight: 700,
                borderRadius: '8px', backgroundColor: '#38bdf8', color: '#0f172a',
              }}
            >
              {saving ? <RefreshCw size={13} className="spin" /> : <Save size={13} />}
              <span>Save Target</span>
            </button>
          </div>
        </div>
      )}

      {/* Progress Cards: Revenue & Profit Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Card 1: Revenue Progress */}
        <div
          style={{
            padding: '16px 18px', borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sales Revenue
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: revAchievement >= 100 ? '#22c55e' : '#38bdf8' }}>
              {revAchievement}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '1.28rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {formatIndianCurrencyCompact(actualRevenue)}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              target: <b style={{ color: 'var(--text-secondary)' }}>{targetRevenue > 0 ? formatIndianCurrencyCompact(targetRevenue) : 'Not Set'}</b>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, revAchievement))}%`,
                height: '100%',
                borderRadius: '4px',
                background: revAchievement >= 100
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'linear-gradient(90deg, #38bdf8, #6366f1)',
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>
        </div>

        {/* Card 2: Gross Profit Progress */}
        <div
          style={{
            padding: '16px 18px', borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Gross Profit
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: profitAchievement >= 100 ? '#22c55e' : '#00e5a3' }}>
              {profitAchievement}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '1.28rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {formatIndianCurrencyCompact(actualProfit)}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              target: <b style={{ color: 'var(--text-secondary)' }}>{targetProfit > 0 ? formatIndianCurrencyCompact(targetProfit) : 'Not Set'}</b>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, profitAchievement))}%`,
                height: '100%',
                borderRadius: '4px',
                background: profitAchievement >= 100
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'linear-gradient(90deg, #00e5a3, #10b981)',
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>
        </div>
      </div>

      {/* Goal Strategy Notes or Unset Callout */}
      {goal?.notes && (
        <div
          style={{
            padding: '10px 14px', borderRadius: '10px',
            backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)',
            fontSize: '0.8rem', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <Sparkles size={14} color="#38bdf8" />
          <span><b>Manager Strategy:</b> {goal.notes}</span>
        </div>
      )}

      {!goal && !editing && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
          {isOwner
            ? 'No monthly sales target set for this section yet. Click "Set Monthly Target" above to define targets.'
            : 'No monthly sales target set by the store administrator for this section yet.'}
        </div>
      )}
    </div>
  );
}
