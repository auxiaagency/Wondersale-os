import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Layers,
  Truck,
  Tag,
  DollarSign,
  Package,
  Calendar,
  Scale,
  FileText,
} from 'lucide-react';

export default function BulkEditModal({
  isOpen,
  onClose,
  selectedCount = 0,
  isEditMode = false,
  sections = [],
  suppliers = [],
  subcategories = [],
  hsnCodes = [],
  isSectionRestricted = false,
  onConfirmChanges, // ({ changes, changesDesc, count }) => void
}) {
  const [supplierId, setSupplierId] = useState('KEEP_CURRENT');
  const [sectionId, setSectionId] = useState('KEEP_CURRENT');
  const [subcategoryId, setSubcategoryId] = useState('KEEP_CURRENT');
  const [hsnCodeId, setHsnCodeId] = useState('KEEP_CURRENT');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const changes = {};
    const changesDesc = [];

    // Supplier
    if (supplierId !== 'KEEP_CURRENT') {
      changes.supplierId = supplierId === '' ? '' : supplierId;
      const sObj = suppliers.find((s) => String(s.id) === String(supplierId));
      changesDesc.push(supplierId === '' ? 'Clear Supplier (No Supplier)' : `Set Supplier to "${sObj?.name || supplierId}"`);
    }

    // Section
    if (!isSectionRestricted && sectionId !== 'KEEP_CURRENT') {
      changes.sectionId = sectionId === '' ? '' : sectionId;
      const secObj = sections.find((s) => String(s.id) === String(sectionId));
      changesDesc.push(sectionId === '' ? 'Clear Section (No Section)' : `Set Section to "${secObj?.name || sectionId}"`);
    }

    // Subcategory
    if (subcategoryId !== 'KEEP_CURRENT') {
      changes.subcategoryId = subcategoryId;
      const subObj = subcategories.find((s) => String(s.id) === String(subcategoryId));
      changesDesc.push(`Add Subcategory "${subObj?.name || subcategoryId}"`);
    }

    // HSN Code
    if (hsnCodeId !== 'KEEP_CURRENT') {
      changes.hsnCodeId = hsnCodeId === '' ? '' : hsnCodeId;
      const hsnObj = hsnCodes.find((h) => String(h.id) === String(hsnCodeId));
      changesDesc.push(hsnCodeId === '' ? 'Clear HSN Code (No HSN)' : `Set HSN Code to "${hsnObj?.code || hsnCodeId}" (${hsnObj?.gst_rate || 0}% GST)`);
    }

    // Cost Price
    if (costPrice.trim() !== '') {
      changes.costPrice = costPrice.trim();
      changesDesc.push(`Set Cost Price to ₹${costPrice.trim()}`);
    }

    // Selling Price
    if (sellingPrice.trim() !== '') {
      changes.sellingPrice = sellingPrice.trim();
      changesDesc.push(`Set Selling Price to ₹${sellingPrice.trim()}`);
    }

    // MRP
    if (mrp.trim() !== '') {
      changes.mrp = mrp.trim();
      changesDesc.push(`Set MRP to ₹${mrp.trim()}`);
    }

    // Quantity (only for staging list)
    if (!isEditMode && quantity.trim() !== '') {
      changes.initialQuantity = quantity.trim();
      changesDesc.push(`Set Stock Quantity to ${quantity.trim()} units`);
    }

    // Weight
    if (weight.trim() !== '') {
      changes.weight = weight.trim();
      changesDesc.push(`Set Weight to ${weight.trim()}g`);
    }

    // Expiry Date
    if (expiryDate.trim() !== '') {
      changes.expiryDate = expiryDate.trim();
      changesDesc.push(`Set Expiry Date to ${expiryDate.trim()}`);
    }

    // Description
    if (description.trim() !== '') {
      changes.description = description.trim();
      changesDesc.push(`Set Description to "${description.trim().slice(0, 30)}${description.trim().length > 30 ? '...' : ''}"`);
    }

    if (changesDesc.length === 0) {
      alert('Please specify at least one field to change.');
      return;
    }

    onConfirmChanges?.({
      changes,
      changesDesc,
      count: selectedCount,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl, 16px)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          backgroundColor: 'var(--bg-surface-solid, #161B2C)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(129, 140, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(129, 140, 248, 0.3)',
              }}
            >
              <Edit3 size={18} color="#818CF8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary, #F8FAFC)' }}>
                Bulk Change Properties
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                Applying to <strong style={{ color: '#818CF8' }}>{selectedCount}</strong> selected product(s)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-icon btn-sm"
            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.78rem',
              color: '#7DD3FC',
              lineHeight: 1.45,
            }}
          >
            Leave fields blank or set to &quot;Keep Unchanged&quot; to leave existing values untouched on each product.
          </div>

          {/* Section & Supplier Dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: isSectionRestricted ? '1fr' : '1fr 1fr', gap: '14px' }}>
            {!isSectionRestricted && (
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                  <Layers size={13} color="#A855F7" /> Location Section
                </label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                >
                  <option value="KEEP_CURRENT">-- Keep Unchanged --</option>
                  <option value="">No Section (Clear)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                <Truck size={13} color="#34D399" /> Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="KEEP_CURRENT">-- Keep Unchanged --</option>
                <option value="">No Supplier (Clear)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory & HSN Code Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                <Tag size={13} color="#38BDF8" /> Add Subcategory
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="KEEP_CURRENT">-- Keep Unchanged --</option>
                {subcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name} ({sc.category_name || 'Category'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                <FileText size={13} color="#F59E0B" /> HSN / SAC Code
              </label>
              <select
                value={hsnCodeId}
                onChange={(e) => setHsnCodeId(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="KEEP_CURRENT">-- Keep Unchanged --</option>
                <option value="">No HSN Code (Clear)</option>
                {hsnCodes.map((hsn) => (
                  <option key={hsn.id} value={hsn.id}>
                    {hsn.code} ({hsn.gst_rate}% GST){hsn.description ? ` - ${hsn.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prices Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.76rem' }}>Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Unchanged"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="form-input mono"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.76rem' }}>Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Unchanged"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="form-input mono"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.76rem' }}>MRP (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Unchanged"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="form-input mono"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Optional Stock, Weight & Expiry */}
          <div style={{ display: 'grid', gridTemplateColumns: isEditMode ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
            {!isEditMode && (
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Unchanged"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input mono"
                  style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                />
              </div>
            )}
            <div>
              <label className="form-label" style={{ fontSize: '0.76rem' }}>Weight (g)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unchanged"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.76rem' }}>Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="form-input mono"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label" style={{ fontSize: '0.76rem' }}>Product Description / Notes</label>
            <input
              type="text"
              maxLength={500}
              placeholder="Unchanged (leave blank to keep existing descriptions)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ height: '36px', padding: '0 16px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                height: '36px',
                padding: '0 20px',
                fontSize: '0.84rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Review &amp; Apply Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Confirmation Popover / Dialog
export function BulkConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  confirmData, // { count, changesDesc, changes }
}) {
  if (!isOpen || !confirmData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: 'var(--radius-xl, 16px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          backgroundColor: 'var(--bg-surface-solid, #161B2C)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={24} color="#F59E0B" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              Confirm Bulk Changes?
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#94A3B8', marginTop: '4px', lineHeight: 1.45 }}>
              Are you sure you want to apply the following modification(s) across{' '}
              <strong style={{ color: '#FBBF24' }}>{confirmData.count} selected product(s)</strong>?
            </p>
          </div>
        </div>

        {/* Changes summary box */}
        <div
          style={{
            borderRadius: '12px',
            backgroundColor: 'var(--bg-main, #0B0E17)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            padding: '14px 16px',
            maxHeight: '180px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Action Summary ({confirmData.changesDesc?.length || 0} change{confirmData.changesDesc?.length > 1 ? 's' : ''}):
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(confirmData.changesDesc || []).map((desc, i) => (
              <li key={i} style={{ color: '#E2E8F0', fontWeight: 600 }}>
                {desc}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ height: '38px', padding: '0 16px', fontSize: '0.84rem', cursor: 'pointer' }}
          >
            No, Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(confirmData.changes);
              onClose();
            }}
            className="btn btn-primary"
            style={{
              height: '38px',
              padding: '0 20px',
              fontSize: '0.84rem',
              fontWeight: 800,
              backgroundColor: '#10B981',
              borderColor: '#10B981',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>Yes, Apply to {confirmData.count} Products</span>
          </button>
        </div>
      </div>
    </div>
  );
}
