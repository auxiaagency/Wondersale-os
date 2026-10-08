import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TimelineRangeSelector, { calculateDatesForDuration, MONTH_NAMES } from './TimelineRangeSelector';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RotateCcw,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Building,
  UserCheck,
  Gift,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import {
  fetchLedgerEntries,
  fetchStoreLedgerSummary,
  addLedgerEntry,
  reverseLedgerEntry,
  correctLedgerEntry,
} from '../api';

export default function EmployeeLedger({ store, employees = [], onShowToast }) {
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [timelineRange, setTimelineRange] = useState(() => {
    const now = new Date();
    const dates = calculateDatesForDuration('month', 1, now);
    return {
      unit: 'month',
      count: 1,
      isAllTime: false,
      label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
      startDate: dates.startDate,
      endDate: dates.endDate,
    };
  });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState('PAYOUT'); // 'PAYOUT', 'ADVANCE', 'BONUS', 'FINE'
  const [addFormData, setAddFormData] = useState({
    employee_id: '',
    amount: '',
    payment_method: 'cash',
    reference_no: '',
    note: '',
    entry_date: new Date().toISOString().split('T')[0],
    execution_mode: 'accrual', // 'accrual' (Add to Ledger Only) or 'settle_now' (Add & Pay/Collect Now)
    reason_preset: '',
  });

  const [activeCorrectEntry, setActiveCorrectEntry] = useState(null);
  const [correctFormData, setCorrectFormData] = useState({
    new_amount: '',
    new_entry_type: '',
    new_note: '',
    reason: '',
  });

  const loadLedgerData = useCallback(async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      const fromDate = timelineRange?.isAllTime ? undefined : (timelineRange?.startDate || undefined);
      const toDate = timelineRange?.isAllTime ? undefined : (timelineRange?.endDate || undefined);

      const [sum, list] = await Promise.all([
        fetchStoreLedgerSummary(store.id, selectedEmpId || undefined),
        fetchLedgerEntries({
          store_id: store.id,
          employee_id: selectedEmpId || undefined,
          from_date: fromDate,
          to_date: toDate,
        }),
      ]);
      setSummary(sum);
      setEntries(list);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [store?.id, selectedEmpId, timelineRange, onShowToast]);

  useEffect(() => {
    loadLedgerData();
  }, [loadLedgerData]);

  const handleOpenAddModal = (type) => {
    setAddModalType(type);
    setAddFormData({
      employee_id: selectedEmpId || (employees[0]?.id ? String(employees[0].id) : ''),
      amount: '',
      payment_method: type === 'PAYOUT' ? 'bank_transfer' : 'cash',
      reference_no: '',
      note: '',
      entry_date: new Date().toISOString().split('T')[0],
      execution_mode: (type === 'PAYOUT' || type === 'ADVANCE') ? 'settle_now' : 'accrual',
      reason_preset: '',
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addFormData.employee_id || !addFormData.amount) return;

    const rawAmt = Math.abs(Number(addFormData.amount));
    if (isNaN(rawAmt) || rawAmt <= 0) {
      if (onShowToast) onShowToast('Please enter a valid amount greater than 0.', 'warning');
      return;
    }

    try {
      if (addModalType === 'BONUS') {
        // Step 1: Record Bonus accrual (Store owes staff +rawAmt)
        const bonusNote = addFormData.note.trim() || addFormData.reason_preset || 'Performance / Festival Bonus';
        await addLedgerEntry({
          store_id: store.id,
          employee_id: addFormData.employee_id,
          entry_type: 'BONUS',
          amount: rawAmt, // Positive
          payment_method: addFormData.payment_method,
          reference_no: addFormData.reference_no,
          note: bonusNote,
          entry_date: addFormData.entry_date,
        });

        // Step 2: If 'settle_now' (Add & Pay Now), immediately disburse payout (-rawAmt) to settle to zero
        if (addFormData.execution_mode === 'settle_now') {
          await addLedgerEntry({
            store_id: store.id,
            employee_id: addFormData.employee_id,
            entry_type: 'PAYOUT',
            amount: -rawAmt, // Negative: disbursed
            payment_method: addFormData.payment_method,
            reference_no: addFormData.reference_no ? `${addFormData.reference_no}-PAY` : '',
            note: `Immediate Bonus Payout: ${bonusNote}`,
            entry_date: addFormData.entry_date,
          });
          if (onShowToast) onShowToast(`Recorded Bonus of ₹${rawAmt.toLocaleString('en-IN')} and disbursed payout (settled).`);
        } else {
          if (onShowToast) onShowToast(`Added Bonus of ₹${rawAmt.toLocaleString('en-IN')} to ledger balance.`);
        }
      } else if (addModalType === 'FINE') {
        // Step 1: Record Fine debit (Staff owes store -rawAmt)
        const fineNote = addFormData.note.trim() || addFormData.reason_preset || 'Disciplinary / Policy Penalty Fine';
        await addLedgerEntry({
          store_id: store.id,
          employee_id: addFormData.employee_id,
          entry_type: 'FINE',
          amount: -rawAmt, // Negative
          payment_method: addFormData.payment_method,
          reference_no: addFormData.reference_no,
          note: fineNote,
          entry_date: addFormData.entry_date,
        });

        // Step 2: If 'settle_now' (Add & Collect Now), immediately record counter collection (+rawAmt) to balance to zero
        if (addFormData.execution_mode === 'settle_now') {
          await addLedgerEntry({
            store_id: store.id,
            employee_id: addFormData.employee_id,
            entry_type: 'ADJUSTMENT',
            amount: rawAmt, // Positive credit balancing the fine
            payment_method: addFormData.payment_method,
            reference_no: addFormData.reference_no ? `${addFormData.reference_no}-COLLECT` : '',
            note: `Fine Collected Immediately: ${fineNote}`,
            entry_date: addFormData.entry_date,
          });
          if (onShowToast) onShowToast(`Recorded Fine of ₹${rawAmt.toLocaleString('en-IN')} and collected immediately (balanced to 0).`);
        } else {
          if (onShowToast) onShowToast(`Added Fine of ₹${rawAmt.toLocaleString('en-IN')} to ledger (deducted from balance).`);
        }
      } else {
        // PAYOUT or ADVANCE (standard negative debit entries)
        const isNegative = ['PAYOUT', 'ADVANCE'].includes(addModalType);
        const signedAmt = isNegative ? -rawAmt : rawAmt;
        await addLedgerEntry({
          store_id: store.id,
          employee_id: addFormData.employee_id,
          entry_type: addModalType,
          amount: signedAmt,
          payment_method: addFormData.payment_method,
          reference_no: addFormData.reference_no,
          note: addFormData.note,
          entry_date: addFormData.entry_date,
        });
        if (onShowToast) onShowToast(`Recorded ${addModalType.toLowerCase()} entry successfully.`);
      }

      setIsAddModalOpen(false);
      loadLedgerData();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleReverse = async (entry) => {
    const reason = window.prompt(`Reason for reversing ledger entry #${entry.id} (${entry.entry_type_display} ₹${Math.abs(entry.amount)})?`);
    if (!reason) return;

    try {
      await reverseLedgerEntry({
        store_id: store.id,
        entry_id: entry.id,
        reason,
      });
      if (onShowToast) onShowToast(`Ledger entry #${entry.id} reversed.`);
      loadLedgerData();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const handleOpenCorrect = (entry) => {
    setActiveCorrectEntry(entry);
    setCorrectFormData({
      new_amount: String(Math.abs(Number(entry.amount))),
      new_entry_type: entry.entry_type,
      new_note: entry.note || '',
      reason: 'Correcting voucher amount',
    });
  };

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!activeCorrectEntry || !correctFormData.new_amount) return;

    const rawAmt = Number(correctFormData.new_amount);
    const isNegative = ['PAYOUT', 'ADVANCE', 'FINE'].includes(correctFormData.new_entry_type || activeCorrectEntry.entry_type);
    const signedAmt = isNegative ? -Math.abs(rawAmt) : Math.abs(rawAmt);

    try {
      await correctLedgerEntry({
        store_id: store.id,
        entry_id: activeCorrectEntry.id,
        new_amount: signedAmt,
        new_entry_type: correctFormData.new_entry_type,
        new_note: correctFormData.new_note,
        reason: correctFormData.reason,
      });
      setActiveCorrectEntry(null);
      if (onShowToast) onShowToast(`Ledger entry corrected via atomic reversal and replacement.`);
      loadLedgerData();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'danger');
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'SALARY_ACCRUAL':
        return { label: 'Salary Accrual', bg: 'var(--color-success-bg)', color: 'var(--color-success)' };
      case 'PAYOUT':
        return { label: 'Salary Payout', bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' };
      case 'ADVANCE':
        return { label: 'Advance Paid', bg: 'rgba(168, 85, 247, 0.12)', color: '#A855F7' };
      case 'BONUS':
        return { label: 'Bonus', bg: 'var(--color-success-bg)', color: 'var(--color-success)' };
      case 'FINE':
        return { label: 'Fine', bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' };
      case 'REVERSAL':
        return { label: 'Reversal', bg: 'rgba(100, 116, 139, 0.14)', color: '#64748B' };
      default:
        return { label: type, bg: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' };
    }
  };

  const selectedEmp = employees.find((e) => String(e.id) === String(selectedEmpId));
  const isIndividual = Boolean(selectedEmpId && (summary?.is_employee_specific || summary?.employee_id));
  const netBal = Number(summary?.net_balance !== undefined ? summary.net_balance : (summary?.net_liability || 0));

  return (
    <div className="emp-ledger-root">
      {/* Individual Employee Active Focus Banner */}
      {selectedEmp && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.28)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
            <UserCheck size={18} style={{ color: '#3B82F6', flexShrink: 0 }} />
            <span>
              Focused Ledger for <strong>{selectedEmp.name}</strong> ({selectedEmp.employee_code || 'Staff'}):{' '}
              {netBal > 0 ? (
                <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>
                  Store Owes ₹{netBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              ) : netBal < 0 ? (
                <span style={{ color: '#EF4444', fontWeight: 800 }}>
                  Employee Owes Store ₹{Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>
                  Balance Settled (₹0.00)
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEmpId('')}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
          >
            Show Store-Wide Totals
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="emp-ledger-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Store Payables or Individual Total Earned */}
        <div className="card emp-ledger-kpi-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            {isIndividual ? 'Total Earned / Accrued' : 'Store Payables'}
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-success)' }}>
            ₹{Number(isIndividual ? (summary?.total_credits || 0) : (summary?.total_store_owes || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isIndividual ? `Gross credits accrued for ${selectedEmp?.name || 'staff'}` : 'Accruals owed to staff'}
          </div>
        </div>

        {/* Card 2: Staff Advances or Individual Total Disbursed */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            {isIndividual ? 'Total Disbursed / Paid' : 'Staff Advances'}
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', color: isIndividual ? '#3B82F6' : '#A855F7' }}>
            ₹{Number(isIndividual ? (summary?.total_debits || 0) : (summary?.total_staff_owes || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isIndividual ? `Payouts (₹${Number(summary?.total_payouts || 0).toLocaleString('en-IN')}) + Advances (₹${Number(summary?.total_advances || 0).toLocaleString('en-IN')})` : 'Outstanding recoverable balances'}
          </div>
        </div>

        {/* Card 3: Net Liability or Individual Balance Owed */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            {isIndividual
              ? (netBal > 0 ? 'Store Owes Employee' : netBal < 0 ? 'Employee Owes Store' : 'Balance Settled')
              : 'Net Liability'}
          </div>
          <div
            style={{
              fontSize: '1.55rem',
              fontWeight: 800,
              marginTop: '4px',
              color: isIndividual
                ? (netBal > 0 ? 'var(--color-success)' : netBal < 0 ? '#EF4444' : 'var(--text-muted)')
                : 'var(--text-primary)',
            }}
          >
            ₹{Math.abs(Number(isIndividual ? netBal : (summary?.net_liability || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isIndividual
              ? (netBal > 0 ? 'Remaining payable balance' : netBal < 0 ? 'Outstanding advance recoverable' : 'All accounts settled')
              : 'Net store obligations'}
          </div>
        </div>

        {/* Card 4: Staff On Ledger or Individual Transactions Count */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            {isIndividual ? 'Ledger Transactions' : 'Staff On Ledger'}
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px' }}>
            {isIndividual ? (summary?.entry_count ?? entries.length) : (summary?.employee_count || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isIndividual ? `Vouchers recorded for ${selectedEmp?.name || 'staff'}` : 'Active workforce accounts'}
          </div>
        </div>
      </div>

      {/* Notice on Finalized Accruals vs Ongoing Month */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface)',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
        }}
      >
        <FileText size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
        <span>
          <strong>Accounting Note:</strong> Only <em>finalized</em> monthly payroll runs post salary accruals to staff balances. Ongoing month progress and projected pay can be previewed in the <strong>Payroll Station</strong>.
        </span>
      </div>

      {/* Toolbar & Action Bar */}
      <div
        className="card"
        style={{
          padding: '16px 22px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          overflow: 'visible',
          position: 'relative',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="input-field"
            style={{ fontWeight: 700, padding: '8px 14px' }}
          >
            <option value="">All Staff Members</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employee_code})
              </option>
            ))}
          </select>

          {/* Unified Timeline Range Selector */}
          <TimelineRangeSelector
            value={timelineRange}
            onChange={(newRange) => setTimelineRange(newRange)}
            minDate={store?.earliest_record_date || '2026-09-04'}
            allowAllTime={true}
            showXAxis={false}
            compact={true}
            chartType="dashboard"
          />

          {(selectedEmpId || timelineRange?.isAllTime || timelineRange?.unit !== 'month' || timelineRange?.count !== 1) && (
            <button
              type="button"
              onClick={() => {
                setSelectedEmpId('');
                const now = new Date();
                const dates = calculateDatesForDuration('month', 1, now);
                setTimelineRange({
                  unit: 'month',
                  count: 1,
                  isAllTime: false,
                  label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
                  startDate: dates.startDate,
                  endDate: dates.endDate,
                });
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleOpenAddModal('PAYOUT')}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, background: '#3B82F6' }}
          >
            <ArrowDownRight size={16} />
            <span>Record Payout</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal('ADVANCE')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>Record Advance</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal('BONUS')}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              color: 'var(--color-success)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)',
            }}
          >
            <Gift size={16} />
            <span>Bonus (Add / Pay)</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal('FINE')}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              color: 'var(--color-danger)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.08)',
            }}
          >
            <ShieldAlert size={16} />
            <span>Fine (Add / Collect)</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card emp-ledger-table-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--brand-primary, #10B981)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Staff Ledger Vouchers
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ({timelineRange?.label || 'All Time'} • {entries.length} {entries.length === 1 ? 'Record' : 'Records'})
            </span>
          </div>
        </div>
        <div className="emp-ledger-table-scroll" style={{ overflowX: 'auto' }}>
          <table className="emp-ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 18px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Staff Member</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Method &amp; Ref</th>
                <th style={{ padding: '12px 16px' }}>Note</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const badge = getTypeBadge(entry.entry_type);
                  const isPositive = Number(entry.amount) > 0;
                  const isReversed = entry.is_reversed;
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        textDecoration: isReversed ? 'line-through' : 'none',
                        opacity: isReversed ? 0.5 : 1,
                      }}
                    >
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {entry.entry_date}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700 }}>{entry.employee_name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {entry.employee_code}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{entry.payment_method}</div>
                        {entry.reference_no && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {entry.reference_no}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{entry.note || '—'}</div>
                      </td>

                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.96rem',
                          color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                        }}
                      >
                        {isPositive ? `+₹${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `-₹${Math.abs(Number(entry.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!isReversed && entry.entry_type !== 'REVERSAL' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenCorrect(entry)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 8px', fontSize: '0.76rem' }}
                              title="Correct Entry (Atomic Reversal + Replacement)"
                            >
                              <Edit2 size={13} />
                              <span>Correct</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReverse(entry)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 8px', fontSize: '0.76rem', color: 'var(--color-warning)' }}
                              title="Reverse Entry"
                            >
                              <RotateCcw size={13} />
                              <span>Reverse</span>
                            </button>
                          </div>
                        )}
                        {isReversed && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Reversed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Ledger Entry Modal */}
      {isAddModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
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
              maxWidth: '520px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      addModalType === 'BONUS'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : addModalType === 'FINE'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : addModalType === 'ADVANCE'
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                    color:
                      addModalType === 'BONUS'
                        ? 'var(--color-success)'
                        : addModalType === 'FINE'
                        ? 'var(--color-danger)'
                        : addModalType === 'ADVANCE'
                        ? '#A855F7'
                        : '#3B82F6',
                  }}
                >
                  {addModalType === 'BONUS' && <Gift size={20} />}
                  {addModalType === 'FINE' && <ShieldAlert size={20} />}
                  {addModalType === 'ADVANCE' && <Plus size={20} />}
                  {addModalType === 'PAYOUT' && <ArrowDownRight size={20} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                    {addModalType === 'BONUS'
                      ? 'Record Staff Bonus'
                      : addModalType === 'FINE'
                      ? 'Record Staff Fine / Penalty'
                      : addModalType === 'ADVANCE'
                      ? 'Record Cash Advance'
                      : 'Record Salary Payout'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {addModalType === 'BONUS' && 'Reward performance, festival, or sales incentive'}
                    {addModalType === 'FINE' && 'Apply penalty deduction for breakage, late penalty, or policy violation'}
                    {addModalType === 'ADVANCE' && 'Disburse cash advance against future salary'}
                    {addModalType === 'PAYOUT' && 'Disburse earned salary or interim wage payment'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* BONUS & FINE 2-OPTION MODE SELECTOR */}
            {(addModalType === 'BONUS' || addModalType === 'FINE') && (
              <div
                style={{
                  background: 'var(--bg-surface-hover)',
                  padding: '12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '18px',
                }}
              >
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  How should this {addModalType === 'BONUS' ? 'bonus' : 'fine'} be processed? *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAddFormData((prev) => ({ ...prev, execution_mode: 'accrual' }))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: addFormData.execution_mode === 'accrual'
                        ? (addModalType === 'BONUS' ? '2px solid #10B981' : '2px solid #EF4444')
                        : '1px solid var(--border-subtle)',
                      background: addFormData.execution_mode === 'accrual'
                        ? (addModalType === 'BONUS' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                        : 'var(--bg-surface)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {addModalType === 'BONUS' ? '1. Add to Ledger Only' : '1. Add to Ledger Only'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {addModalType === 'BONUS'
                        ? 'Credit staff balance. Pay later at month-end payroll.'
                        : 'Deduct from staff balance. Recovered in next payroll.'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddFormData((prev) => ({ ...prev, execution_mode: 'settle_now' }))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: addFormData.execution_mode === 'settle_now'
                        ? (addModalType === 'BONUS' ? '2px solid #10B981' : '2px solid #EF4444')
                        : '1px solid var(--border-subtle)',
                      background: addFormData.execution_mode === 'settle_now'
                        ? (addModalType === 'BONUS' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                        : 'var(--bg-surface)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {addModalType === 'BONUS' ? '2. Add & Pay Now' : '2. Add & Collect Now'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {addModalType === 'BONUS'
                        ? 'Credits bonus & disburses cash/UPI immediately (zero net balance).'
                        : 'Applies fine & records cash collected (balances to zero).'}
                    </div>
                  </button>
                </div>

                {/* Explanation Banner */}
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, color: addModalType === 'BONUS' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                  <span>
                    {addFormData.execution_mode === 'settle_now'
                      ? (addModalType === 'BONUS'
                          ? 'Creates a BONUS credit (+₹) and an immediate PAYOUT disbursement (-₹), leaving ledger net change at ₹0 while recording the cash outflow.'
                          : 'Creates a FINE debit (-₹) and a counter COLLECTION credit (+₹), leaving ledger net change at ₹0 while auditing the penalty.')
                      : (addModalType === 'BONUS'
                          ? 'Increases Store Owes Employee (+₹). Will be paid out in future payroll or manual payout.'
                          : 'Decreases employee balance / increases Employee Owes Store (-₹). Will be subtracted from their next salary.')}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Staff Member *
                </label>
                <select
                  required
                  value={addFormData.employee_id}
                  onChange={(e) => setAddFormData({ ...addFormData, employee_id: e.target.value })}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 1000"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={addFormData.entry_date}
                    onChange={(e) => setAddFormData({ ...addFormData, entry_date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Quick Presets for Bonus and Fine */}
              {addModalType === 'BONUS' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Quick Bonus Reason
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Festival Bonus', 'Sales Target Reward', 'Exemplary Service', 'Overtime Compensation', 'Diwali Bonus'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddFormData((prev) => ({ ...prev, reason_preset: preset, note: preset }))}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: addFormData.note === preset ? 'rgba(16, 185, 129, 0.2)' : undefined,
                          borderColor: addFormData.note === preset ? '#10B981' : undefined,
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addModalType === 'FINE' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Quick Fine Reason
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Item Damage / Breakage', 'Cash Register Shortage', 'Unauthorized Absence', 'Uniform / Policy Violation', 'Late Arrival Penalty'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddFormData((prev) => ({ ...prev, reason_preset: preset, note: preset }))}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: addFormData.note === preset ? 'rgba(239, 68, 68, 0.2)' : undefined,
                          borderColor: addFormData.note === preset ? '#EF4444' : undefined,
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <select
                    value={addFormData.payment_method}
                    onChange={(e) => setAddFormData({ ...addFormData, payment_method: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="upi">UPI / QR Scan</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Reference / UTR #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98218731"
                    value={addFormData.reference_no}
                    onChange={(e) => setAddFormData({ ...addFormData, reference_no: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Note / Reason
                </label>
                <input
                  type="text"
                  placeholder={
                    addModalType === 'BONUS'
                      ? 'e.g. Diwali festive bonus'
                      : addModalType === 'FINE'
                      ? 'e.g. Glassware damage during inventory restock'
                      : 'e.g. Monthly salary disbursement'
                  }
                  value={addFormData.note}
                  onChange={(e) => setAddFormData({ ...addFormData, note: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background:
                      addModalType === 'BONUS'
                        ? '#10B981'
                        : addModalType === 'FINE'
                        ? '#EF4444'
                        : undefined,
                    borderColor:
                      addModalType === 'BONUS'
                        ? '#10B981'
                        : addModalType === 'FINE'
                        ? '#EF4444'
                        : undefined,
                  }}
                >
                  {addModalType === 'BONUS'
                    ? (addFormData.execution_mode === 'settle_now' ? 'Post & Pay Bonus Now' : 'Add Bonus to Ledger')
                    : addModalType === 'FINE'
                    ? (addFormData.execution_mode === 'settle_now' ? 'Post & Collect Fine Now' : 'Add Fine to Ledger')
                    : 'Post to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correct Ledger Entry Modal */}
      {activeCorrectEntry && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveCorrectEntry(null);
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
              maxWidth: '520px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Correct Ledger Entry #{activeCorrectEntry.id}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Atomic reversal of original entry + insertion of corrected entry.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCorrectEntry(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCorrectSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Corrected Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={correctFormData.new_amount}
                  onChange={(e) => setCorrectFormData({ ...correctFormData, new_amount: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Reason for Correction *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Typo in voucher amount"
                  value={correctFormData.reason}
                  onChange={(e) => setCorrectFormData({ ...correctFormData, reason: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Updated Note
                </label>
                <input
                  type="text"
                  value={correctFormData.new_note}
                  onChange={(e) => setCorrectFormData({ ...correctFormData, new_note: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setActiveCorrectEntry(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Apply Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
