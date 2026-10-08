import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Calculator,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  Receipt,
  FileText,
  Sliders,
  DollarSign,
  TrendingDown,
  TrendingUp,
  X,
  FileSpreadsheet,
  Printer,
  Clock,
  Sparkles,
  Coins,
  Banknote,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchPayrollRuns,
  fetchPayrollRunDetail,
  generateDraftPayroll,
  finalizePayrollRun,
  reopenPayrollRun,
  toggleStatementInclusion,
  fetchPayrollAdjustments,
  createPayrollAdjustment,
  deletePayrollAdjustment,
} from '../api';
import { formatDateTime12h, formatCurrencyINR } from '../utils/timeFormat';
import SalaryStructureModal from './SalaryStructureModal';
import PayrollSettlementModal from './PayrollSettlementModal';
import OvertimeVerificationModal from './OvertimeVerificationModal';

export default function PayrollStation({ store, currentUser, employees = [], onShowToast, onReloadLedger }) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const [payrollRun, setPayrollRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [proceedUnresolved, setProceedUnresolved] = useState(false);

  // Statements filtering
  const [stmtSearch, setStmtSearch] = useState('');

  // Itemized Payslip Modal
  const [activeStatement, setActiveStatement] = useState(null);

  // Quick Salary Structure modal from payroll
  const [activeSalaryModalEmp, setActiveSalaryModalEmp] = useState(null);

  // Adjustments Modal
  const [adjustments, setAdjustments] = useState([]);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjFormData, setAdjFormData] = useState({
    employee_id: '',
    adjustment_type: 'bonus',
    amount: '',
    label: '',
    note: '',
  });

  // Interim Settlement Modals
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isOTVerifyModalOpen, setIsOTVerifyModalOpen] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  const isOngoingMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isFutureMonth = selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth);
  const isCompletedMonth = !isOngoingMonth && !isFutureMonth;

  // Next allowed unlock date for ongoing month
  const unlockDate = new Date(selectedYear, selectedMonth, 1);
  const unlockDateFormatted = unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const todayFormatted = today.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Previous completed month calculation for quick toggle
  const prevMonthDate = new Date(currentYear, currentMonth - 2, 1);
  const prevMonthNum = prevMonthDate.getMonth() + 1;
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthName = monthNames[prevMonthDate.getMonth()];

  const loadCurrentPayroll = async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      const runs = await fetchPayrollRuns(store.id);
      const target = runs.find((r) => r.year === selectedYear && r.month === selectedMonth);
      if (target) {
        const detail = await fetchPayrollRunDetail(target.id, store.id);
        setPayrollRun(detail);
      } else {
        setPayrollRun(null);
      }

      // Load adjustments for this month
      const adjs = await fetchPayrollAdjustments({ store_id: store.id, year: selectedYear, month: selectedMonth });
      setAdjustments(adjs);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentPayroll();
  }, [store?.id, selectedYear, selectedMonth]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateDraftPayroll({
        store_id: store.id,
        year: selectedYear,
        month: selectedMonth,
        proceed_with_needs_review: proceedUnresolved,
      });
      setPayrollRun(res);
      if (onShowToast) onShowToast(`Draft payroll computed for ${monthNames[selectedMonth - 1]} ${selectedYear}`);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!payrollRun) return;
    const msg = `Finalize payroll for ${monthNames[selectedMonth - 1]} ${selectedYear}?\n\nThis will:\n1. Lock all attendance days for this month.\n2. Post salary accruals directly to staff ledgers.\n3. Post summary expense voucher to Accounting.`;
    if (!window.confirm(msg)) return;

    try {
      const res = await finalizePayrollRun(payrollRun.id, store.id);
      setPayrollRun(res);
      if (onShowToast) onShowToast(`Payroll finalized and ledger accruals posted!`);
      if (onReloadLedger) onReloadLedger();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleReopen = async () => {
    if (!payrollRun) return;
    const reason = window.prompt("Reason for reopening this finalized payroll run (e.g. attendance revision, salary correction):");
    if (!reason) return;

    try {
      const res = await reopenPayrollRun(payrollRun.id, store.id, reason);
      setPayrollRun(res);
      if (onShowToast) onShowToast(`Payroll reopened. Ledger accruals reversed & attendance unlocked.`);
      if (onReloadLedger) onReloadLedger();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleToggleInclusion = async (stmt) => {
    if (payrollRun?.status === 'finalized') return;
    const reason = stmt.is_included ? (window.prompt("Reason for excluding this staff member from this month's payout:") || '') : '';
    try {
      const updated = await toggleStatementInclusion(payrollRun.id, stmt.id, store.id, !stmt.is_included, reason);
      setPayrollRun((prev) => ({
        ...prev,
        statements: prev.statements.map((s) => (s.id === stmt.id ? updated : s)),
      }));
      if (onShowToast) onShowToast(`Updated inclusion for ${stmt.employee_name}`);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleCreateAdjustment = async (e) => {
    e.preventDefault();
    if (!adjFormData.employee_id || !adjFormData.amount) return;
    try {
      await createPayrollAdjustment({
        store_id: store.id,
        year: selectedYear,
        month: selectedMonth,
        employee_id: adjFormData.employee_id,
        adjustment_type: adjFormData.adjustment_type,
        amount: adjFormData.amount,
        label: adjFormData.label,
        note: adjFormData.note,
      });
      setIsAdjModalOpen(false);
      setAdjFormData({
        employee_id: '',
        adjustment_type: 'bonus',
        amount: '',
        label: '',
        note: '',
      });
      if (onShowToast) onShowToast('Adjustment added. Re-generate draft payroll to apply lines.');
      loadCurrentPayroll();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleDeleteAdjustment = async (id) => {
    if (!window.confirm('Delete this adjustment?')) return;
    try {
      await deletePayrollAdjustment(id, store.id);
      if (onShowToast) onShowToast('Adjustment deleted.');
      loadCurrentPayroll();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const filteredStatements = (payrollRun?.statements || []).filter((s) => {
    if (!stmtSearch) return true;
    const q = stmtSearch.toLowerCase();
    return s.employee_name?.toLowerCase().includes(q) || s.employee_code?.toLowerCase().includes(q);
  });

  const unconfiguredStatements = (payrollRun?.statements || []).filter((s) => s.mode === 'UNCONFIGURED');

  return (
    <div className="payroll-station-root">
      {/* Month Picker & Primary Action Bar */}
      <div
        className="card payroll-header-card"
        style={{
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div className="payroll-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="payroll-month-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} className="payroll-cal-icon" style={{ color: 'var(--brand-primary)' }} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="input-field payroll-month-select"
              style={{ fontWeight: 700, padding: '8px 14px' }}
            >
              {monthNames.map((name, idx) => {
                const mNum = idx + 1;
                const isCur = selectedYear === currentYear && mNum === currentMonth;
                const isFut = selectedYear > currentYear || (selectedYear === currentYear && mNum > currentMonth);
                let badge = '';
                if (isCur) badge = ' • (In Progress)';
                else if (isFut) badge = ' • (Future)';
                return (
                  <option key={name} value={mNum}>
                    {name} {badge}
                  </option>
                );
              })}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="input-field payroll-year-select"
              style={{ fontWeight: 700, padding: '8px 14px' }}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Month Switcher */}
          {isOngoingMonth ? (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(prevMonthNum);
                setSelectedYear(prevMonthYear);
              }}
              className="btn btn-secondary payroll-quick-switch-btn"
              style={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
              title={`Jump to ${prevMonthName} ${prevMonthYear} to finalize completed payroll`}
            >
              ⏮ Settle {prevMonthName} {prevMonthYear}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonth);
                setSelectedYear(currentYear);
              }}
              className="btn btn-secondary payroll-quick-switch-btn"
              style={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
              title={`Jump to ongoing month (${monthNames[currentMonth - 1]} ${currentYear}) live progress`}
            >
              ⏭ View Ongoing Progress
            </button>
          )}

          {payrollRun && (
            <span
              className="payroll-status-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                fontWeight: 800,
                background: payrollRun.status === 'finalized' ? 'var(--color-success-bg)' : isOngoingMonth ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-warning-bg)',
                color: payrollRun.status === 'finalized' ? 'var(--color-success)' : isOngoingMonth ? '#6366F1' : 'var(--color-warning)',
              }}
            >
              {payrollRun.status === 'finalized' ? <Lock size={14} /> : isOngoingMonth ? <Clock size={14} /> : <Unlock size={14} />}
              <span>{isOngoingMonth && payrollRun.status === 'draft' ? 'IN PROGRESS' : payrollRun.status.toUpperCase()}</span>
            </span>
          )}
        </div>

        <div className="payroll-header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {payrollRun?.status === 'draft' && (
            <label className="payroll-unresolved-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={proceedUnresolved}
                onChange={(e) => setProceedUnresolved(e.target.checked)}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Proceed if unreviewed days</span>
            </label>
          )}

          <div className="payroll-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Interim settlement buttons — always visible for ongoing or draft months */}
            {(!payrollRun || payrollRun.status !== 'finalized') && (
              <>
                <button
                  type="button"
                  onClick={() => setIsOTVerifyModalOpen(true)}
                  className="btn btn-secondary payroll-ot-verify-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.83rem',
                    color: '#F59E0B',
                    borderColor: 'rgba(245,158,11,0.4)',
                    background: 'rgba(245,158,11,0.08)',
                  }}
                  title="Review and approve / override overtime hours before settlement"
                >
                  <ShieldCheck size={15} />
                  <span>Verify OT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(true)}
                  className="btn btn-secondary payroll-settle-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.83rem',
                    color: '#10B981',
                    borderColor: 'rgba(16,185,129,0.4)',
                    background: 'rgba(16,185,129,0.08)',
                  }}
                  title="Pay out unsettled wages for selected employees — can be done mid-month"
                >
                  <Banknote size={15} />
                  <span>Interim Settlement</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || payrollRun?.status === 'finalized'}
              className="btn btn-secondary payroll-calc-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Calculator size={16} />
              <span>
                {isOngoingMonth
                  ? (payrollRun ? 'Recalculate Live Progress' : 'Compute Live Progress')
                  : (payrollRun ? 'Recalculate Draft' : 'Compute Draft Payroll')}
              </span>
            </button>

            {payrollRun && payrollRun.status === 'draft' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAdjModalOpen(true)}
                  className="btn btn-secondary payroll-adj-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <Plus size={16} />
                  <span>Adjustment</span>
                </button>

                {isOngoingMonth ? (
                  <button
                    type="button"
                    disabled
                    className="btn btn-secondary payroll-finalize-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      opacity: 0.65,
                      cursor: 'not-allowed',
                    }}
                    title={`Cannot finalize while ${monthNames[selectedMonth - 1]} is ongoing. Shifts and punches are still active. Finalization unlocks on ${unlockDateFormatted}.`}
                  >
                    <Lock size={16} />
                    <span>Finalize (Unlocks {unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span>
                  </button>
                ) : isFutureMonth ? (
                  <button
                    type="button"
                    disabled
                    className="btn btn-secondary payroll-finalize-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }}
                    title="Future month cannot be finalized."
                  >
                    <Lock size={16} />
                    <span>Finalize Locked</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalize}
                    className="btn btn-primary payroll-finalize-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                    }}
                  >
                    <Lock size={16} />
                    <span>Finalize Payroll</span>
                  </button>
                )}
              </>
            )}

            {payrollRun && payrollRun.status === 'finalized' && (
              <button
                type="button"
                onClick={handleReopen}
                className="btn btn-secondary payroll-reopen-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--color-warning)' }}
              >
                <Unlock size={16} />
                <span>Reopen Payroll</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {payrollRun?.status === 'finalized' && (
        <div
          className="payroll-finalized-banner"
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} className="payroll-finalized-icon" />
            <span className="payroll-finalized-text" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Payroll finalized on {formatDateTime12h(payrollRun.finalized_at)} by {payrollRun.finalized_by_name || 'Admin'}. Attendance locked. Salary accruals posted to employee ledger.
            </span>
          </div>
          <span className="payroll-finalized-code" style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            EXP-PAYROLL-{store?.id}-{selectedYear}{String(selectedMonth).padStart(2, '0')}
          </span>
        </div>
      )}

      {payrollRun?.status === 'draft' && isOngoingMonth && (
        <div
          className="payroll-ongoing-banner"
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.08)',
            color: '#6366F1',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Clock size={20} className="payroll-ongoing-icon" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="payroll-ongoing-title" style={{ fontWeight: 800, fontSize: '0.92rem' }}>
              Ongoing Month — Live Progress Mode
            </div>
            <div className="payroll-ongoing-text" style={{ fontSize: '0.82rem', marginTop: '2px', opacity: 0.9 }}>
              Attendance, overtime, and salary calculations reflect live operations through today ({todayFormatted}). You can recalculate as often as needed to preview store labor costs. Finalization will unlock on <strong>{unlockDateFormatted}</strong> once the month has concluded.
            </div>
          </div>
        </div>
      )}

      {payrollRun?.status === 'draft' && isFutureMonth && (
        <div
          className="payroll-future-banner"
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(100, 116, 139, 0.08)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Calendar size={20} className="payroll-future-icon" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="payroll-future-title" style={{ fontWeight: 800, fontSize: '0.92rem' }}>
              Future Month
            </div>
            <div className="payroll-future-text" style={{ fontSize: '0.82rem', marginTop: '2px' }}>
              No operational attendance has occurred for {monthNames[selectedMonth - 1]} {selectedYear} yet.
            </div>
          </div>
        </div>
      )}

      {payrollRun?.status === 'draft' && isCompletedMonth && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={18} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Completed Month Ready for Finalization: Review attendance cuts, add adjustments, and click "Finalize Payroll" to lock attendance and post ledger accruals.
          </span>
        </div>
      )}

      {/* Missing Salary Structure Banner */}
      {unconfiguredStatements.length > 0 && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.12)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                Salary Structure Not Configured for {unconfiguredStatements.length} Employee{unconfiguredStatements.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.82rem', marginTop: '3px', color: 'var(--text-secondary)' }}>
                {unconfiguredStatements.map((s) => s.employee_name).join(', ')} {unconfiguredStatements.length > 1 ? 'do' : 'does'} not have an active compensation structure and {unconfiguredStatements.length > 1 ? 'are' : 'is'} excluded from payout. Click "Set Salary" on the staff row to configure monthly or daily wages.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {payrollRun && (
        <div className="payroll-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card payroll-kpi-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total Gross</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              ₹{Number(payrollRun.total_gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>Before attendance cuts</div>
          </div>

          <div className="card payroll-kpi-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Net Disbursable</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-success)' }}>
              ₹{Number(payrollRun.total_net || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total payable liability</div>
          </div>

          <div className="card payroll-kpi-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Staff Included</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px' }}>
              {(payrollRun.statements || []).filter((s) => s.is_included).length} / {(payrollRun.statements || []).length}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active salary profiles</div>
          </div>

          <div className="card payroll-kpi-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Adjustments</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', color: '#6366F1' }}>
              {adjustments.length} items
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>Bonuses, fines &amp; incentives</div>
          </div>
        </div>
      )}

      {/* Main Table or Empty Prompt */}
      {!payrollRun ? (
        <div
          className="card"
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calculator size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
              No Payroll Generated for {monthNames[selectedMonth - 1]} {selectedYear}
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '8px auto 0', fontSize: '0.88rem' }}>
              Click below to compute this month's draft salary statements based on verified RFID punch logs, daily shift rules, and active compensation structures.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary"
            style={{ padding: '10px 24px', fontWeight: 800, borderRadius: 'var(--radius-pill)' }}
          >
            {generating ? 'Calculating...' : 'Compute Draft Payroll Now'}
          </button>
        </div>
      ) : (
        <div className="card payroll-table-card" style={{ overflow: 'hidden' }}>
          {/* Table Toolbar */}
          <div
            className="payroll-toolbar"
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div className="payroll-search-wrap" style={{ position: 'relative', width: '320px' }}>
              <Search size={16} className="payroll-search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search staff payslips..."
                value={stmtSearch}
                onChange={(e) => setStmtSearch(e.target.value)}
                className="input-field payroll-search-input"
                style={{ paddingLeft: '38px', width: '100%', fontSize: '0.86rem' }}
              />
            </div>

            <div className="payroll-statement-count" style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Showing {filteredStatements.length} salary statements
            </div>
          </div>

          <div className="payroll-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="payroll-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th className="payroll-th-staff" style={{ padding: '12px 18px' }}>Staff</th>
                  <th className="payroll-th-mode" style={{ padding: '12px 16px' }}>Mode</th>
                  <th className="payroll-th-gross" style={{ padding: '12px 16px', textAlign: 'right' }}>Gross</th>
                  <th className="payroll-th-deductions" style={{ padding: '12px 16px', textAlign: 'right' }}>Deductions</th>
                  <th className="payroll-th-additions" style={{ padding: '12px 16px', textAlign: 'right' }}>Additions</th>
                  <th className="payroll-th-net" style={{ padding: '12px 16px', textAlign: 'right' }}>Net Payable</th>
                  <th className="payroll-th-inclusion" style={{ padding: '12px 16px', textAlign: 'center' }}>Inclusion</th>
                  <th className="payroll-th-action" style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <AlertTriangle size={32} style={{ margin: '0 auto 12px', color: 'var(--color-warning)' }} />
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        No salary statements in this draft run
                      </div>
                      <div style={{ fontSize: '0.86rem', marginTop: '4px' }}>
                        Click "Compute Draft Payroll" or "Recalculate Draft" above to generate statements.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStatements.map((stmt) => (
                    <tr
                      key={stmt.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        opacity: stmt.is_included ? 1 : 0.65,
                        background: stmt.is_included ? 'transparent' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <td className="payroll-td-staff" style={{ padding: '14px 18px' }}>
                        <div className="payroll-stmt-emp-name" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stmt.employee_name}</div>
                        <div className="payroll-stmt-emp-sub" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {stmt.employee_code} • {stmt.designation || 'Staff'}
                        </div>
                      </td>

                      <td className="payroll-td-mode" style={{ padding: '14px 16px' }}>
                        {stmt.mode === 'UNCONFIGURED' ? (
                          <span
                            className="payroll-mode-badge"
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: 'var(--color-danger, #EF4444)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <AlertTriangle size={12} />
                            NO SALARY SET
                          </span>
                        ) : (
                          <span
                            className="payroll-mode-badge"
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: stmt.mode === 'MONTHLY' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: stmt.mode === 'MONTHLY' ? '#6366F1' : '#F59E0B',
                            }}
                          >
                            {stmt.mode}
                          </span>
                        )}
                      </td>

                      <td className="payroll-td-gross" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                        <span className="payroll-stmt-gross-text">
                          {stmt.mode === 'UNCONFIGURED' ? (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          ) : (
                            `₹${Number(stmt.gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          )}
                        </span>
                      </td>

                      <td className="payroll-td-deductions" style={{ padding: '14px 16px', textAlign: 'right', color: Number(stmt.total_deductions) > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        <span className="payroll-stmt-deductions-text">
                          {Number(stmt.total_deductions) > 0 ? `-₹${Number(stmt.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </td>

                      <td className="payroll-td-additions" style={{ padding: '14px 16px', textAlign: 'right', color: Number(stmt.total_additions) > 0 ? 'var(--color-success)' : 'inherit' }}>
                        <span className="payroll-stmt-additions-text">
                          {Number(stmt.total_additions) > 0 ? `+₹${Number(stmt.total_additions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </td>

                      <td className="payroll-td-net" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontSize: '0.98rem', color: stmt.mode === 'UNCONFIGURED' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        <span className="payroll-stmt-net-text">
                          {stmt.mode === 'UNCONFIGURED' ? '₹0.00' : `₹${Number(stmt.net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                        </span>
                      </td>

                      <td className="payroll-td-inclusion" style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleInclusion(stmt)}
                          disabled={payrollRun.status === 'finalized' || stmt.mode === 'UNCONFIGURED'}
                          className="payroll-inclusion-btn"
                          style={{
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            border: 'none',
                            cursor: (payrollRun.status === 'finalized' || stmt.mode === 'UNCONFIGURED') ? 'default' : 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: stmt.is_included ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                            color: stmt.is_included ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                          title={stmt.exclusion_reason || 'Toggle payout inclusion'}
                        >
                          {stmt.is_included ? 'Included' : 'Excluded'}
                        </button>
                      </td>

                      <td className="payroll-td-actions" style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          {stmt.mode === 'UNCONFIGURED' && (
                            <button
                              type="button"
                              onClick={() => {
                                const empObj = employees.find((e) => e.id === stmt.employee || e.employee_code === stmt.employee_code) || {
                                  id: stmt.employee,
                                  name: stmt.employee_name,
                                  employee_code: stmt.employee_code,
                                  designation: stmt.designation,
                                };
                                setActiveSalaryModalEmp(empObj);
                              }}
                              className="btn btn-primary payroll-setsalary-btn"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              title="Configure salary structure for this staff member"
                            >
                              <Coins size={14} />
                              <span>Set Salary</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveStatement(stmt)}
                            className="btn btn-secondary payroll-payslip-btn"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Eye size={14} />
                            <span>Payslip Breakdown</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustments Section */}
      {adjustments.length > 0 && (
        <div className="card" style={{ marginTop: '24px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0 }}>
              Payroll Adjustments for {monthNames[selectedMonth - 1]} {selectedYear}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total: {adjustments.length} entries
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        background: adj.adjustment_type === 'bonus' ? 'var(--color-success-bg)' : (adj.adjustment_type === 'fine' ? 'var(--color-danger-bg)' : 'rgba(99, 102, 241, 0.12)'),
                        color: adj.adjustment_type === 'bonus' ? 'var(--color-success)' : (adj.adjustment_type === 'fine' ? 'var(--color-danger)' : '#6366F1'),
                      }}
                    >
                      {adj.adjustment_type_display}
                    </span>
                    <strong style={{ fontSize: '0.88rem' }}>₹{Number(adj.amount).toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {adj.employee_name}: {adj.label}
                  </div>
                </div>

                {payrollRun?.status !== 'finalized' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAdjustment(adj.id)}
                    className="btn btn-secondary"
                    style={{ padding: '6px', color: 'var(--color-danger)' }}
                    title="Delete adjustment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itemized Payslip Modal */}
      {activeStatement && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveStatement(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
                  Itemized Payslip &amp; Formula Breakdown
                </h3>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {activeStatement.employee_name} ({activeStatement.employee_code}) • {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStatement(null)}
                className="btn btn-secondary"
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Attendance Days Snapshot */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
              {Object.entries(activeStatement.days_summary || {}).map(([k, v]) => (
                <span key={k} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)' }}>
                  {k}: {v}
                </span>
              ))}
            </div>

            {/* Salary Lines Table */}
            <div style={{ marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>Component</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeStatement.lines || []).map((line) => {
                    const isEarning = line.line_type === 'earning';
                    const isAddition = line.line_type === 'addition';
                    return (
                      <tr key={line.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 4px' }}>
                          <div style={{ fontWeight: 700 }}>{line.label}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{line.formula_text}</div>
                        </td>
                        <td style={{ padding: '12px 4px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                          {line.quantity}
                        </td>
                        <td style={{ padding: '12px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          ₹{Number(line.rate).toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: '12px 4px',
                            textAlign: 'right',
                            fontWeight: 800,
                            color: isEarning ? 'inherit' : (isAddition ? 'var(--color-success)' : 'var(--color-danger)'),
                          }}
                        >
                          {isEarning || isAddition ? `+₹${Number(line.amount).toFixed(2)}` : `-₹${Number(line.amount).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Net Total Summary */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Net Salary Payable
                </span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>
                  ₹{Number(activeStatement.net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <div>Gross: ₹{Number(activeStatement.gross).toFixed(2)}</div>
                <div>Deductions: -₹{Number(activeStatement.total_deductions).toFixed(2)}</div>
                <div>Additions: +₹{Number(activeStatement.total_additions).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Print Payslip"
              >
                <Printer size={15} />
                <span>Print Payslip</span>
              </button>
              <button type="button" onClick={() => setActiveStatement(null)} className="btn btn-secondary">
                Close Payslip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Adjustment Modal */}
      {isAdjModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdjModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Add Payroll Adjustment</h3>
              <button type="button" onClick={() => setIsAdjModalOpen(false)} className="btn btn-secondary" style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Staff Member *</label>
                <select
                  required
                  value={adjFormData.employee_id}
                  onChange={(e) => setAdjFormData({ ...adjFormData, employee_id: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="">Select staff member...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Adjustment Type *</label>
                <select
                  value={adjFormData.adjustment_type}
                  onChange={(e) => setAdjFormData({ ...adjFormData, adjustment_type: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="bonus">Bonus (Addition)</option>
                  <option value="incentive">Incentive / Commission (Addition)</option>
                  <option value="fine">Fine / Penalty (Deduction)</option>
                  <option value="advance_recovery">Advance Recovery (Deduction)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1500"
                  value={adjFormData.amount}
                  onChange={(e) => setAdjFormData({ ...adjFormData, amount: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Label / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Performance Bonus"
                  value={adjFormData.label}
                  onChange={(e) => setAdjFormData({ ...adjFormData, label: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Internal Note</label>
                <input
                  type="text"
                  placeholder="Approval reference or justification"
                  value={adjFormData.note}
                  onChange={(e) => setAdjFormData({ ...adjFormData, note: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAdjModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Salary Structure Modal */}
      {activeSalaryModalEmp && (
        <SalaryStructureModal
          employee={activeSalaryModalEmp}
          storeId={store?.id}
          onClose={() => setActiveSalaryModalEmp(null)}
          onUpdated={() => {
            setActiveSalaryModalEmp(null);
            handleGenerate();
          }}
        />
      )}

      {/* OT Verification Modal */}
      {isOTVerifyModalOpen && (
        <OvertimeVerificationModal
          store={store}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setIsOTVerifyModalOpen(false)}
          onDone={() => {
            setIsOTVerifyModalOpen(false);
            loadCurrentPayroll();
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Interim Settlement Modal */}
      {isSettlementModalOpen && (
        <PayrollSettlementModal
          store={store}
          year={selectedYear}
          month={selectedMonth}
          proceedUnresolved={proceedUnresolved}
          onProceedUnresolvedChange={setProceedUnresolved}
          onClose={() => setIsSettlementModalOpen(false)}
          onDone={() => {
            setIsSettlementModalOpen(false);
            loadCurrentPayroll();
            if (onReloadLedger) onReloadLedger();
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
