import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, CheckCircle2, AlertCircle, Coins, Clock } from 'lucide-react';
import {
  fetchSalaryStructures,
  createSalaryStructure,
  deleteSalaryStructure,
} from '../api';
import { formatCurrencyINR } from '../utils/timeFormat';

export default function SalaryStructureModal({ employee, storeId, onClose, onUpdated }) {
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    mode: 'MONTHLY',
    amount: '',
    overtime_rate: '',
    from_date: new Date().toISOString().split('T')[0],
    to_date: '',
    note: '',
  });

  const loadStructures = async () => {
    if (!employee) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSalaryStructures({ employee_id: employee.id, store_id: storeId });
      setStructures(data);
    } catch (err) {
      setError(err.message || 'Failed to load compensation structures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructures();
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Please specify a valid compensation amount greater than ₹0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSalaryStructure({
        employee: employee.id,
        mode: formData.mode,
        amount: formData.amount,
        overtime_rate: formData.overtime_rate ? formData.overtime_rate : null,
        from_date: formData.from_date,
        to_date: formData.to_date || null,
        note: formData.note,
        auto_close_previous: true,
      });
      setFormData({
        mode: 'MONTHLY',
        amount: '',
        overtime_rate: '',
        from_date: new Date().toISOString().split('T')[0],
        to_date: '',
        note: '',
      });
      loadStructures();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to save compensation structure');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salary structure record?')) return;
    try {
      await deleteSalaryStructure(id);
      loadStructures();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete structure');
    }
  };

  if (!employee) return null;

  // Clean deduplicated subtitle
  const subtitleParts = [
    employee.name,
    employee.employee_code,
    employee.designation && employee.designation.trim().toLowerCase() !== employee.name.trim().toLowerCase()
      ? employee.designation
      : null,
  ].filter(Boolean);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          maxWidth: '720px',
          padding: '28px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(16, 185, 129, 0.14)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Coins size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Compensation Plan &amp; Wage Rate
              </h3>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                {subtitleParts.join(' • ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Existing Structures List */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.84rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.04em' }}>
            Effective Salary History
          </h4>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Loading compensation plans...
            </div>
          ) : structures.length === 0 ? (
            <div
              style={{
                padding: '22px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface-hover)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
              }}
            >
              No compensation structure configured yet. Add one below to enable automated monthly payroll for this employee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {structures.map((s) => {
                const isActive = !s.to_date || new Date(s.to_date) >= new Date();
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-hover)',
                      border: isActive ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: s.mode === 'MONTHLY' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: s.mode === 'MONTHLY' ? '#6366F1' : '#F59E0B',
                          }}
                        >
                          {s.mode === 'MONTHLY' ? 'Monthly Salary' : 'Daily Wage'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {formatCurrencyINR(s.amount)}
                        </span>
                        {isActive && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: 'var(--color-success-bg)',
                              color: 'var(--color-success)',
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '5px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>
                          From: <strong>{s.from_date}</strong> to <strong>{s.to_date || 'Ongoing'}</strong>
                        </span>
                        {s.overtime_rate && (
                          <span>
                            Overtime: <strong>{formatCurrencyINR(s.overtime_rate)}/hr</strong>
                          </span>
                        )}
                        {s.note && <span style={{ color: 'var(--text-muted)' }}>Note: {s.note}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="btn btn-secondary"
                      style={{ padding: '7px 10px', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)' }}
                      title="Delete Structure"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add New Structure Form */}
        <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '22px' }}>
          <h4 style={{ fontSize: '0.84rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.04em' }}>
            Set New / Updated Compensation Structure
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Mode
              </label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="MONTHLY">Monthly Fixed Salary</option>
                <option value="DAILY">Daily Wage Worker</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                {formData.mode === 'MONTHLY' ? 'Monthly Amount (₹)' : 'Daily Wage Rate (₹)'} *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder={formData.mode === 'MONTHLY' ? 'e.g. 25000' : 'e.g. 800'}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input-field"
                style={{ width: '100%', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Overtime Hourly Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Optional (Auto 1.5x base)"
                value={formData.overtime_rate}
                onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Effective From Date *
              </label>
              <input
                type="date"
                required
                value={formData.from_date}
                onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Effective To Date (Leave blank for indefinite)
              </label>
              <input
                type="date"
                value={formData.to_date}
                onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Notes / Increment Reference
              </label>
              <input
                type="text"
                placeholder="e.g. Annual revision 2026"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{saving ? 'Saving...' : 'Save Structure'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
