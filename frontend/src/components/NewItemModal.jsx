import React, { useState } from 'react';
import { X, Plus, AlertCircle, Tag, FolderPlus, Building2, Lock } from 'lucide-react';
import { createItem } from '../api';
import CategorySubcategoryPicker from './CategorySubcategoryPicker';

export default function NewItemModal({
  stores = [],
  categories = [],
  subcategories = [],
  suppliers = [],
  sections = [],
  currentUser,
  isSectionRestricted: propIsSectionRestricted,
  selectedStore,
  onClose,
  onSuccess,
  onMetaUpdated,
}) {
  const isSectionRestricted = Boolean(
    propIsSectionRestricted ?? (
      !currentUser?.is_owner &&
      !currentUser?.role_details?.is_owner &&
      (currentUser?.effective_inventory_scope === 'assigned_section' ||
        currentUser?.role_details?.inventory_scope === 'assigned_section' ||
        currentUser?.inventory_scope === 'assigned_section') &&
      currentUser?.section
    )
  );

  const isAssignedNonOwner = Boolean(currentUser && !currentUser.is_owner && currentUser.store);
  const effectiveStoreId = selectedStore || (isAssignedNonOwner ? String(currentUser.store) : (stores[0]?.id || ''));
  const currentStoreObj = stores.find((s) => String(s.id) === String(effectiveStoreId)) || stores[0];

  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [sectionId, setSectionId] = useState(() => (isSectionRestricted && currentUser?.section ? String(currentUser.section) : ''));
  const [selectedSubcatIds, setSelectedSubcatIds] = useState([]);
  const [primarySubcatId, setPrimarySubcatId] = useState(null);
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [locationSection, setLocationSection] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [weight, setWeight] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const targetStoreId = currentStoreObj?.id || effectiveStoreId;

    // Strict validation for mandatory fields
    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }
    if (!targetStoreId) {
      setError('Active store location could not be determined. Please re-login.');
      return;
    }
    if (costPrice === '' || isNaN(costPrice) || parseFloat(costPrice) < 0) {
      setError('Cost Price is required and must be a valid positive number.');
      return;
    }
    if (sellingPrice === '' || isNaN(sellingPrice) || parseFloat(sellingPrice) < 0) {
      setError('Selling Price is required and must be a valid positive number.');
      return;
    }
    if (initialQuantity === '' || isNaN(initialQuantity) || parseInt(initialQuantity, 10) < 0) {
      setError('Quantity is required and must be 0 or greater.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        store: targetStoreId,
        subcategories: selectedSubcatIds,
        primary_subcategory: primarySubcatId,
        supplier: supplierId || null,
        section: isSectionRestricted && currentUser?.section ? currentUser.section : (sectionId || null),
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellingPrice),
        mrp: mrp ? parseFloat(mrp) : null,
        initial_quantity: parseInt(initialQuantity, 10) || 0,
        location_section: locationSection.trim(),
        expiry_date: expiryDate || null,
        weight: weight ? parseFloat(weight) : null,
        needs_new_barcode_printed: true,
      };

      const created = await createItem(payload);
      onSuccess?.(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-ruby-glow)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Add New Product</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Store Inventory Catalog</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '18px',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name & Locked Store */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">
                Product Name <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>(Required)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic Oxford Cotton Shirt"
                className="form-input"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">
                Store Location <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Locked)</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  height: '42px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Building2 size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {currentStoreObj?.name || 'Store'}
                  </span>
                </div>
                <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px', flexShrink: 0 }}>
                  <Lock size={9} /> Active
                </span>
              </div>
            </div>
          </div>

          {/* Categories & Subcategories Section */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>
              Categories &amp; Subcategories <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <CategorySubcategoryPicker
              categories={categories}
              subcategories={subcategories}
              selectedSubcatIds={selectedSubcatIds}
              primarySubcatId={primarySubcatId}
              onChangeSelected={setSelectedSubcatIds}
              onChangePrimary={setPrimarySubcatId}
              onMetaUpdated={onMetaUpdated}
              maxHeight="180px"
            />
          </div>

          {/* Supplier & Section Selection Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label className="form-label" style={{ marginBottom: '6px' }}>
                Supplier / Vendor <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="form-input"
                style={{ height: '42px', fontSize: '0.86rem' }}
              >
                <option value="">No Supplier Assigned</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Store Section</span>
                  {isSectionRestricted ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#38BDF8',
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Lock size={10} /> Locked
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>(Optional)</span>
                  )}
                </span>
              </label>
              <select
                value={isSectionRestricted && currentUser?.section ? String(currentUser.section) : sectionId}
                onChange={(e) => !isSectionRestricted && setSectionId(e.target.value)}
                disabled={isSectionRestricted}
                className="form-input"
                style={{
                  height: '42px',
                  fontSize: '0.86rem',
                  opacity: isSectionRestricted ? 0.85 : 1,
                  cursor: isSectionRestricted ? 'not-allowed' : 'default',
                  borderColor: isSectionRestricted ? 'rgba(56, 189, 248, 0.4)' : undefined,
                }}
              >
                <option value="">No Section Assigned</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} {sec.code ? `(${sec.code})` : ''}
                  </option>
                ))}
              </select>
              {isSectionRestricted && (
                <span style={{ fontSize: '0.72rem', color: '#38BDF8', marginTop: '3px', display: 'block' }}>
                  Locked to your assigned section ({currentUser?.section_name || 'Section'}).
                </span>
              )}
            </div>
          </div>

          {/* Pricing Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">
                Cost Price (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>(Required)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="form-input mono"
                required
              />
            </div>
            <div>
              <label className="form-label">
                Selling Price (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>(Required)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className="form-input mono"
                required
              />
            </div>
            <div>
              <label className="form-label">
                MRP <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="Defaults to Selling"
                className="form-input mono"
              />
            </div>
          </div>

          {/* Quantity & Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">
                Stock Quantity <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>(Required)</span>
              </label>
              <input
                type="number"
                min="0"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                placeholder="0"
                className="form-input mono"
                required
              />
            </div>
            <div>
              <label className="form-label">
                Section / Shelf <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={locationSection}
                onChange={(e) => setLocationSection(e.target.value)}
                placeholder="e.g. Aisle 2"
                className="form-input"
              />
            </div>
          </div>

          {/* Expiry & Weight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label className="form-label">
                Expiry Date <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">
                Weight in Grams <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 250"
                className="form-input mono"
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ fontWeight: 700 }}>
              {loading ? 'Creating Product...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
