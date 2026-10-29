import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Percent,
  Check,
  X,
  FileText,
} from 'lucide-react';
import {
  createHsnCode,
  updateHsnCode,
  deleteHsnCode,
} from '../api';

const GST_SLABS = [
  { rate: '0.00', label: '0% (Exempt / Nil Rated)' },
  { rate: '3.00', label: '3% (Precious Metals / Gold)' },
  { rate: '5.00', label: '5% (Essential Goods / Packaged Food)' },
  { rate: '12.00', label: '12% (Processed Goods / Apparel)' },
  { rate: '18.00', label: '18% (Standard Retail Goods / Footwear)' },
  { rate: '28.00', label: '28% (Luxury / Automotives / High-End)' },
];

export default function HsnSection({
  hsnCodes = [],
  loading = false,
  onHsnUpdated,
}) {
  // New HSN Form State
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [gstRate, setGstRate] = useState('18.00');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [slabFilter, setSlabFilter] = useState('all');

  // Modals & Active Edit
  const [editingHsn, setEditingHsn] = useState(null);
  const [deletingHsn, setDeletingHsn] = useState(null);

  // Notifications
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleCreateHsn = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      setError('HSN / SAC Code is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createHsnCode({
        code: cleanCode,
        description: description.trim(),
        gst_rate: gstRate,
        is_active: isActive,
      });
      setCode('');
      setDescription('');
      setGstRate('18.00');
      setIsActive(true);
      showFeedback(`HSN Code "${cleanCode}" added successfully.`);
      if (onHsnUpdated) onHsnUpdated();
    } catch (err) {
      setError(err.message || 'Failed to create HSN Code.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHsn) return;
    setError('');
    try {
      await deleteHsnCode(deletingHsn.id);
      showFeedback(`HSN Code "${deletingHsn.code}" deleted successfully.`);
      setDeletingHsn(null);
      if (onHsnUpdated) onHsnUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete HSN Code.');
      setDeletingHsn(null);
    }
  };

  const filteredList = useMemo(() => {
    return hsnCodes.filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        h.code.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q));

      const matchesSlab =
        slabFilter === 'all' ||
        parseFloat(h.gst_rate) === parseFloat(slabFilter);

      return matchesSearch && matchesSlab;
    });
  }, [hsnCodes, searchQuery, slabFilter]);

  return (
    <div style={{ maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tag size={20} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                HSN &amp; SAC Codes Directory
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, maxWidth: '640px' }}>
              Manage official Harmonized System of Nomenclature (HSN) codes and default statutory GST slabs.
              Assign codes to inventory items for accurate invoice compliance and tax reporting.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Codes</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {hsnCodes.filter((h) => h.is_active).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10B981',
            borderRadius: 'var(--radius-md)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Add Form + Directory Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '24px', alignItems: 'start' }}>
        {/* Form: Add New HSN Code */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-xl)' }}>
          <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} style={{ color: 'var(--brand-primary)' }} />
            Add New HSN Code
          </h3>

          <form onSubmit={handleCreateHsn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                HSN / SAC Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 6203, 62034290, 8471"
                className="form-input"
                maxLength={16}
                required
                style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.5px' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Typically 4, 6, or 8 digits under Indian GST rules.
              </span>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Description / Goods Classification
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Men's Cotton Trousers, Laptops"
                className="form-input"
                maxLength={255}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Default GST Rate Slab *
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="form-select"
                style={{ fontWeight: 600 }}
              >
                {GST_SLABS.map((slab) => (
                  <option key={slab.rate} value={slab.rate}>
                    {slab.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="hsn_is_active_checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="hsn_is_active_checkbox" style={{ fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                Active for product assignment
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ marginTop: '8px', fontWeight: 700, justifyContent: 'center' }}
            >
              <Plus size={16} />
              <span>{saving ? 'Adding...' : 'Save HSN Code'}</span>
            </button>
          </form>
        </div>

        {/* Directory Table */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-xl)' }}>
          {/* Search & Slab Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code or description..."
                className="form-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.86rem' }}
              />
            </div>

            <select
              value={slabFilter}
              onChange={(e) => setSlabFilter(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', height: '38px', fontSize: '0.84rem' }}
            >
              <option value="all">All GST Slabs</option>
              {GST_SLABS.map((s) => (
                <option key={s.rate} value={s.rate}>
                  {parseFloat(s.rate)}% GST
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '10px 12px' }}>HSN / SAC</th>
                  <th style={{ padding: '10px 12px' }}>Description</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>GST Slab</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Linked Items</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {searchQuery || slabFilter !== 'all' ? (
                        'No HSN codes matching filters.'
                      ) : (
                        <div>
                          <Tag size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                          <div>No HSN codes added yet. Use the form on the left to add your first code.</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((hsn) => (
                    <tr
                      key={hsn.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.92rem' }}>
                        {hsn.code}
                      </td>
                      <td style={{ padding: '12px', color: hsn.description ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {hsn.description || '—'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          {parseFloat(hsn.gst_rate)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {hsn.items_count || 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: hsn.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.15)',
                            color: hsn.is_active ? '#059669' : 'var(--text-muted)',
                          }}
                        >
                          {hsn.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setEditingHsn(hsn)}
                            className="btn btn-secondary btn-icon"
                            style={{ width: '30px', height: '30px', padding: 0 }}
                            title="Edit HSN Code"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingHsn(hsn)}
                            className="btn btn-secondary btn-icon"
                            style={{ width: '30px', height: '30px', padding: 0, color: 'var(--color-danger)' }}
                            title="Delete HSN Code"
                          >
                            <Trash2 size={14} />
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
      </div>

      {/* Edit HSN Code Modal */}
      {editingHsn && (
        <EditHsnModal
          hsn={editingHsn}
          onClose={() => setEditingHsn(null)}
          onSuccess={(updated) => {
            setEditingHsn(null);
            showFeedback(`HSN Code "${updated.code}" updated successfully.`);
            if (onHsnUpdated) onHsnUpdated();
          }}
        />
      )}

      {/* Delete HSN Code Modal */}
      {deletingHsn && (
        <div className="modal-overlay" onClick={() => setDeletingHsn(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={44} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Delete HSN Code?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Are you sure you want to remove HSN Code <strong>{deletingHsn.code}</strong>?
                {deletingHsn.items_count > 0 && (
                  <span style={{ display: 'block', color: 'var(--color-danger)', fontWeight: 700, marginTop: '8px' }}>
                    Warning: {deletingHsn.items_count} item(s) are currently linked to this code.
                  </span>
                )}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" onClick={() => setDeletingHsn(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="btn btn-primary"
                  style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditHsnModal({ hsn, onClose, onSuccess }) {
  const [code, setCode] = useState(hsn.code);
  const [description, setDescription] = useState(hsn.description || '');
  const [gstRate, setGstRate] = useState(String(hsn.gst_rate));
  const [isActive, setIsActive] = useState(hsn.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      setError('HSN / SAC Code is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await updateHsnCode(hsn.id, {
        code: cleanCode,
        description: description.trim(),
        gst_rate: gstRate,
        is_active: isActive,
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to update HSN Code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag size={20} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Edit HSN Code: {hsn.code}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }}>
              {error}
            </div>
          )}

          <div>
            <label className="form-label">HSN / SAC Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="form-input"
              maxLength={16}
              required
              style={{ fontFamily: 'monospace', fontWeight: 700 }}
            />
          </div>

          <div>
            <label className="form-label">Description / Goods Classification</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              maxLength={255}
            />
          </div>

          <div>
            <label className="form-label">Default GST Rate Slab *</label>
            <select
              value={gstRate}
              onChange={(e) => setGstRate(e.target.value)}
              className="form-select"
              style={{ fontWeight: 600 }}
            >
              {GST_SLABS.map((slab) => (
                <option key={slab.rate} value={slab.rate}>
                  {slab.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="edit_hsn_is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="edit_hsn_is_active" style={{ fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
              Active for product assignment
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
