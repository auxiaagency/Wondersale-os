import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  User,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchStaffEmployees, fetchEmployeeLedgerBalance, fineEmployeeForBrokenItem, markBrokenItemNoFine } from '../api';

export default function FineEmployeeModal({
  report,
  onClose,
  onSuccess,
  currencySymbol = '₹',
}) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeBalance, setEmployeeBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const totalLoss = Number(report?.total_loss || (Number(report?.quantity || 1) * Number(report?.cost_price || 0)));
  const [fineType, setFineType] = useState('full'); // 'full' | 'half' | 'custom'
  const [fineAmount, setFineAmount] = useState(totalLoss.toFixed(2));
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load active employees
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoadingEmployees(true);
        const params = { status: 'active' };
        if (report?.store) {
          params.store = report.store;
        }
        const data = await fetchStaffEmployees(params);
        if (isMounted) {
          setEmployees(data);
          if (data.length > 0) {
            setSelectedEmployeeId(String(data[0].id));
          }
        }
      } catch (err) {
        if (isMounted) setErrorMsg('Failed to load employees: ' + err.message);
      } finally {
        if (isMounted) setLoadingEmployees(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [report?.store]);

  // Load employee ledger balance when selected employee changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeBalance(null);
      return;
    }
    let isMounted = true;
    async function loadBal() {
      try {
        setLoadingBalance(true);
        const res = await fetchEmployeeLedgerBalance(selectedEmployeeId);
        if (isMounted) {
          setEmployeeBalance(Number(res?.balance || 0));
        }
      } catch (err) {
        if (isMounted) setEmployeeBalance(0);
      } finally {
        if (isMounted) setLoadingBalance(false);
      }
    }
    loadBal();
    return () => {
      isMounted = false;
    };
  }, [selectedEmployeeId]);

  // Handle preset change
  const handleFineTypeChange = (type) => {
    setFineType(type);
    if (type === 'full') {
      setFineAmount(totalLoss.toFixed(2));
    } else if (type === 'half') {
      setFineAmount((totalLoss / 2).toFixed(2));
    }
  };

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => String(e.id) === String(selectedEmployeeId));
  }, [employees, selectedEmployeeId]);

  const numFine = Number(fineAmount) || 0;
  const projectedBalance = employeeBalance !== null ? (employeeBalance - numFine) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedEmployeeId) {
      setErrorMsg('Please select an employee to fine.');
      return;
    }

    if (numFine <= 0) {
      setErrorMsg('Fine amount must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fineEmployeeForBrokenItem(report.id, {
        employee_id: selectedEmployeeId,
        fine_amount: numFine,
        notes: notes.trim(),
      });
      if (onSuccess) {
        onSuccess(res.report, res.message || 'Fine successfully deducted from employee ledger.');
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit fine.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaiveNoFine = async () => {
    setErrorMsg('');
    try {
      setSubmitting(true);
      const res = await markBrokenItemNoFine(report.id);
      if (onSuccess) {
        onSuccess(res.report, res.message || 'Marked as Store Loss. No fine applied to staff.');
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to mark as No Fine.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content glass-panel"
        style={{
          position: 'relative',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface, #1e293b)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.4))',
          color: 'var(--text-primary, #0f172a)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                Fine Employee for Damaged Stock
              </h3>
              <p
                style={{
                  margin: '3px 0 0 0',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                Debit damaged inventory write-off cost directly to employee's ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Already Fined Notice */}
        {report?.is_fined && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#ef4444',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <AlertCircle size={18} flexShrink={0} />
            <div>
              This report has already been fined to{' '}
              <strong>{report.fined_employee_name || 'an employee'}</strong> for{' '}
              <strong>{currencySymbol}{Number(report.fine_amount).toFixed(2)}</strong>.
            </div>
          </div>
        )}

        {/* Waived / Store Loss Notice */}
        {report?.is_waived && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#3b82f6',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={18} flexShrink={0} />
            <div>
              This report was settled as <strong>Store Loss (No fine applied)</strong>
              {report.waived_by ? ` by ${report.waived_by}` : ''}.
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={15} flexShrink={0} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Write-off Item Overview Box */}
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--bg-card, rgba(0, 0, 0, 0.04))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Package size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      color: 'var(--text-primary, #0f172a)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {report?.item_name || 'Damaged Item'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                    UID: {report?.item_uid || 'N/A'} {report?.store_name ? `• ${report.store_name}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                  Cost Calculation
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444' }}>
                  {currencySymbol}{totalLoss.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Damage Math Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #475569)',
              }}
            >
              <span>
                <strong>{report?.quantity || 1}</strong> broken unit{report?.quantity > 1 ? 's' : ''} × {currencySymbol}{Number(report?.cost_price || 0).toFixed(2)} (Cost Price)
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                = {currencySymbol}{totalLoss.toFixed(2)}
              </span>
            </div>

            {report?.reason && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>
                Incident: "{report.reason}"
              </div>
            )}
          </div>

          {/* Employee Selection Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <User size={14} style={{ color: '#ef4444' }} /> Select Employee to Fine
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingEmployees || report?.is_fined}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--bg-input, var(--bg-surface, #ffffff))',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.84rem',
                outline: 'none',
                fontWeight: 600,
              }}
            >
              {loadingEmployees ? (
                <option value="">Loading workforce records...</option>
              ) : employees.length === 0 ? (
                <option value="">No active employees found</option>
              ) : (
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_code}){emp.department ? ` - ${emp.department}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Employee Ledger Current & Projected Balance */}
          {selectedEmployee && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', fontWeight: 600 }}>
                  Current Ledger Balance
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: (employeeBalance || 0) < 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                  {loadingBalance ? 'Checking...' : `${currencySymbol}${(employeeBalance || 0).toFixed(2)}`}
                </div>
              </div>

              <div style={{ color: 'var(--text-muted, #94a3b8)' }}>
                <ArrowRight size={16} />
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', fontWeight: 600 }}>
                  Projected Balance After Fine
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    color: projectedBalance !== null && projectedBalance < 0 ? '#ef4444' : '#10b981',
                    marginTop: '2px',
                  }}
                >
                  {projectedBalance !== null ? `${currencySymbol}${projectedBalance.toFixed(2)}` : '...'}
                </div>
              </div>
            </div>
          )}

          {/* Fine Amount Presets & Custom Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DollarSign size={14} style={{ color: '#ef4444' }} /> Fine Amount (Defaults to Cost Price)
            </label>

            {/* Preset Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleFineTypeChange('full')}
                disabled={report?.is_fined}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: fineType === 'full' ? '1px solid #ef4444' : '1px solid var(--border-subtle, #cbd5e1)',
                  background: fineType === 'full' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input, transparent)',
                  color: fineType === 'full' ? '#ef4444' : 'var(--text-secondary, #475569)',
                  transition: 'all 0.15s ease',
                }}
              >
                100% Cost ({currencySymbol}{totalLoss.toFixed(0)})
              </button>

              <button
                type="button"
                onClick={() => handleFineTypeChange('half')}
                disabled={report?.is_fined}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: fineType === 'half' ? '1px solid #ef4444' : '1px solid var(--border-subtle, #cbd5e1)',
                  background: fineType === 'half' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input, transparent)',
                  color: fineType === 'half' ? '#ef4444' : 'var(--text-secondary, #475569)',
                  transition: 'all 0.15s ease',
                }}
              >
                50% Cost ({currencySymbol}{(totalLoss / 2).toFixed(0)})
              </button>

              <button
                type="button"
                onClick={() => handleFineTypeChange('custom')}
                disabled={report?.is_fined}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: fineType === 'custom' ? '1px solid #ef4444' : '1px solid var(--border-subtle, #cbd5e1)',
                  background: fineType === 'custom' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input, transparent)',
                  color: fineType === 'custom' ? '#ef4444' : 'var(--text-secondary, #475569)',
                  transition: 'all 0.15s ease',
                }}
              >
                Custom Amount
              </button>
            </div>

            {/* Fine Input */}
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fineAmount}
                onChange={(e) => {
                  setFineAmount(e.target.value);
                  setFineType('custom');
                }}
                disabled={report?.is_fined}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 30px',
                  borderRadius: '10px',
                  background: 'var(--bg-input, var(--bg-surface, #ffffff))',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Audit Reason / Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileText size={14} style={{ color: 'var(--text-muted, #64748b)' }} /> Reason / Ledger Note
            </label>
            <input
              type="text"
              placeholder="e.g. Negligent handling during display stocking"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={report?.is_fined}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--bg-input, var(--bg-surface, #ffffff))',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            }}
          >
            {!report?.is_fined && !report?.is_waived && (
              <button
                type="button"
                onClick={handleWaiveNoFine}
                disabled={submitting}
                style={{
                  padding: '9px 15px',
                  borderRadius: '10px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(59, 130, 246, 0.08)',
                  color: 'var(--color-info, #3b82f6)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginRight: 'auto',
                  transition: 'all 0.15s ease',
                }}
              >
                <ShieldCheck size={16} /> No Fine (Absorb as Store Loss)
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                background: 'transparent',
                color: 'var(--text-secondary, #475569)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || report?.is_fined || !selectedEmployeeId || numFine <= 0}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: report?.is_fined ? '#94a3b8' : '#ef4444',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: report?.is_fined ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: report?.is_fined ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {submitting ? (
                'Posting to Ledger...'
              ) : report?.is_fined ? (
                'Already Fined'
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm Fine ({currencySymbol}{numFine.toFixed(2)})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
