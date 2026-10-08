import React, { useState, useMemo } from 'react';
import {
  Truck,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Store as StoreIcon,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../api';

export default function SupplierSection({
  suppliers = [],
  stores = [],
  currentStore = null,
  loading = false,
  onSuppliersUpdated,
}) {
  // Add Supplier form state
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [storeId, setStoreId] = useState(currentStore?.id || '');
  const [saving, setSaving] = useState(false);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Notifications
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier / Vendor name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gst_number: gstNumber.trim().toUpperCase(),
        city: city.trim(),
        state: stateName.trim(),
        address: address.trim(),
        notes: notes.trim(),
        store: storeId ? storeId : null,
      };
      const created = await createSupplier(payload);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstNumber('');
      setCity('');
      setStateName('');
      setAddress('');
      setNotes('');
      showFeedback(`Supplier "${created.name}" created successfully.`);
      onSuppliersUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!editingSupplier || !editingSupplier.name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setModalSaving(true);
    try {
      const payload = {
        name: editingSupplier.name.trim(),
        contact_person: (editingSupplier.contact_person || '').trim(),
        phone: (editingSupplier.phone || '').trim(),
        email: (editingSupplier.email || '').trim(),
        gst_number: (editingSupplier.gst_number || '').trim().toUpperCase(),
        city: (editingSupplier.city || '').trim(),
        state: (editingSupplier.state || '').trim(),
        address: (editingSupplier.address || '').trim(),
        notes: (editingSupplier.notes || '').trim(),
        is_active: editingSupplier.is_active !== undefined ? editingSupplier.is_active : true,
        store: editingSupplier.store ? editingSupplier.store : null,
      };
      await updateSupplier(editingSupplier.id, payload);
      showFeedback(`Supplier "${editingSupplier.name}" updated successfully.`);
      setEditingSupplier(null);
      onSuppliersUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to update supplier');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    try {
      await deleteSupplier(deletingSupplier.id);
      showFeedback(`Supplier "${deletingSupplier.name}" removed.`);
      setDeletingSupplier(null);
      onSuppliersUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to delete supplier');
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter((sup) => {
      return (
        sup.name?.toLowerCase().includes(q) ||
        sup.contact_person?.toLowerCase().includes(q) ||
        sup.phone?.toLowerCase().includes(q) ||
        sup.gst_number?.toLowerCase().includes(q) ||
        sup.city?.toLowerCase().includes(q) ||
        sup.notes?.toLowerCase().includes(q)
      );
    });
  }, [suppliers, searchQuery]);

  const activeCount = suppliers.filter((s) => s.is_active).length;

  return (
    <div className="supplier-section-root" style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div
        className="glass-panel supplier-header-card"
        style={{
          padding: '24px 28px',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="supplier-header-icon-box"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Truck size={24} />
          </div>
          <div>
            <h2 className="supplier-header-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              Suppliers &amp; Vendors Directory
            </h2>
            <p className="supplier-header-sub" style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Manage wholesale suppliers, distributor contacts, GST details, and track linked catalog items.
            </p>
          </div>
        </div>

        <div className="supplier-header-stats" style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          <strong>{suppliers.length}</strong> Total Suppliers &bull; <strong>{activeCount}</strong> Active
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          style={{
            padding: '12px 18px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Creation Form */}
      <form
        onSubmit={handleCreateSupplier}
        className="glass-panel supplier-create-form"
        style={{ padding: '24px', borderRadius: 'var(--radius-xl)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add New Supplier / Vendor</h3>
        </div>

        <div className="supplier-form-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="form-label">Supplier / Company Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Wholesale Ltd."
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="form-label">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Phone / Mobile</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. vendor@example.com"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">GSTIN / Tax ID</label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 27AAAAA0000A1Z5"
              className="form-input"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label className="form-label">City / State</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="form-input"
                style={{ flex: 1 }}
              />
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="State"
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        <div className="supplier-form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label className="form-label">Full Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, warehouse location..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Notes / Payment Terms</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Net 30 days, 2% early discount..."
              className="form-input"
            />
          </div>

          {stores && stores.length > 1 && (
            <div>
              <label className="form-label">Associated Store Branch</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="form-select"
              >
                <option value="">All / Global (Available to all branches)</option>
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn btn-primary btn-sm supplier-create-btn"
            style={{ fontWeight: 700, padding: '8px 20px' }}
          >
            {saving ? 'Creating Supplier...' : '+ Add Supplier'}
          </button>
        </div>
      </form>

      {/* Directory Search & List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="supplier-directory-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Registered Suppliers</h3>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'var(--color-surface-hover)',
                color: 'var(--text-muted)',
              }}
            >
              {filteredSuppliers.length}
            </span>
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suppliers, contacts, GST..."
              className="form-input supplier-search-input"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '48px 24px',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 6px' }}>
              {searchQuery ? 'No suppliers matching your search.' : 'No suppliers registered yet.'}
            </p>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Use the form above to register your wholesale suppliers and assign them to inventory products.
            </p>
          </div>
        ) : (
          <div
            className="supplier-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="glass-panel supplier-item-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Header row */}
                <div className="supplier-card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4
                        className="supplier-card-title"
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          margin: 0,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={sup.name}
                      >
                        {sup.name}
                      </h4>
                      {sup.is_active ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <ShieldCheck size={11} /> Active
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <ShieldAlert size={11} /> Inactive
                        </span>
                      )}
                    </div>
                    {sup.contact_person && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} style={{ opacity: 0.7 }} /> {sup.contact_person}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingSupplier({ ...sup })}
                      className="btn btn-ghost btn-icon-sm"
                      title="Edit Supplier"
                      style={{ padding: '6px', borderRadius: 'var(--radius-md)' }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSupplier(sup)}
                      className="btn btn-ghost btn-icon-sm"
                      title="Delete Supplier"
                      style={{ padding: '6px', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Details metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {sup.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} style={{ opacity: 0.7 }} />
                      <span>{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} style={{ opacity: 0.7 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.email}</span>
                    </div>
                  )}
                  {sup.gst_number && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={13} style={{ opacity: 0.7 }} />
                      <span>GST: <strong style={{ color: 'var(--text-main)', letterSpacing: '0.5px' }}>{sup.gst_number}</strong></span>
                    </div>
                  )}
                  {(sup.city || sup.state) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} style={{ opacity: 0.7 }} />
                      <span>{[sup.city, sup.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {sup.notes && (
                    <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)', background: 'var(--color-surface-hover)', padding: '6px 10px', borderRadius: 'var(--radius-md)', marginTop: '2px' }}>
                      {sup.notes}
                    </div>
                  )}
                </div>

                {/* Footer badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Package size={13} style={{ color: 'var(--brand-primary)' }} />
                    <strong>{sup.items_count || 0}</strong> {sup.items_count === 1 ? 'Product' : 'Products'} linked
                  </span>

                  {sup.store_name ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <StoreIcon size={12} /> {sup.store_name}
                    </span>
                  ) : (
                    <span style={{ opacity: 0.7 }}>Global Vendor</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingSupplier && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div
            className="modal-content glass-panel"
            style={{
              maxWidth: '600px',
              width: '90%',
              padding: '24px 28px',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Edit Supplier</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="btn btn-ghost btn-icon-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    value={editingSupplier.name}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    value={editingSupplier.contact_person || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={editingSupplier.gst_number || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, gst_number: e.target.value })}
                    className="form-input"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={editingSupplier.city || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, city: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  value={editingSupplier.notes || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="checkbox"
                  id="supplier_active_check"
                  checked={editingSupplier.is_active !== undefined ? editingSupplier.is_active : true}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="supplier_active_check" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Supplier is Active
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !editingSupplier.name.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {modalSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div
            className="modal-content glass-panel"
            style={{
              maxWidth: '460px',
              width: '90%',
              padding: '24px 28px',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '14px' }}>
              <AlertCircle size={24} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Delete Supplier?</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '12px' }}>
              Are you sure you want to delete <strong>&ldquo;{deletingSupplier.name}&rdquo;</strong>?
            </p>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Deleting this supplier will remove its vendor records. Any items previously supplied by this vendor will remain in inventory with their supplier set to unassigned.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                className="btn btn-danger btn-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
