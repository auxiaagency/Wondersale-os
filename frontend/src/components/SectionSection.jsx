import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  Layers,
  MapPin,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Users,
  Store as StoreIcon,
  Palette,
  FileText,
  Boxes,
} from 'lucide-react';
import {
  createSection,
  updateSection,
  deleteSection,
} from '../api';

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#E11D48', // Ruby Rose
  '#84CC16', // Lime
  '#64748B', // Slate
];

export default function SectionSection({
  sections = [],
  stores = [],
  currentStore = null,
  loading = false,
  onSectionsUpdated,
}) {
  // Add Section form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [description, setDescription] = useState('');
  const [storeId, setStoreId] = useState(currentStore?.id || '');
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingSection, setEditingSection] = useState(null);
  const [deletingSection, setDeletingSection] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Section name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        color: color || '#3B82F6',
        description: description.trim(),
        store: storeId ? storeId : null,
      };
      const created = await createSection(payload);
      setName('');
      setCode('');
      setColor('#3B82F6');
      setDescription('');
      showFeedback(`Section "${created.name}" created successfully.`);
      onSectionsUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to create section');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSection = async (e) => {
    e.preventDefault();
    if (!editingSection || !editingSection.name.trim()) {
      setError('Section name is required.');
      return;
    }
    setModalSaving(true);
    try {
      const payload = {
        name: editingSection.name.trim(),
        code: (editingSection.code || '').trim().toUpperCase(),
        color: editingSection.color || '#3B82F6',
        description: (editingSection.description || '').trim(),
        store: editingSection.store || null,
        is_active: editingSection.is_active !== undefined ? editingSection.is_active : true,
      };
      await updateSection(editingSection.id, payload);
      showFeedback(`Section "${editingSection.name}" updated.`);
      setEditingSection(null);
      onSectionsUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to update section');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;
    setModalSaving(true);
    try {
      await deleteSection(deletingSection.id);
      showFeedback(`Section "${deletingSection.name}" deleted.`);
      setDeletingSection(null);
      onSectionsUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to delete section');
    } finally {
      setModalSaving(false);
    }
  };

  // Filtered sections
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.store_name && s.store_name.toLowerCase().includes(q))
      );
    });
  }, [sections, searchQuery]);

  // Summary Metrics
  const totalSectionsCount = sections.length;
  const totalItemsAssigned = useMemo(() => {
    return sections.reduce((acc, s) => acc + (s.items_count || 0), 0);
  }, [sections]);
  const totalUnitsInSections = useMemo(() => {
    return sections.reduce((acc, s) => acc + (s.total_units || 0), 0);
  }, [sections]);
  const totalStaffAssigned = useMemo(() => {
    return sections.reduce((acc, s) => acc + (s.staff_count || 0), 0);
  }, [sections]);

  return (
    <div className="section-management-workspace" style={{ paddingBottom: '60px' }}>
      {/* Toast Notifications */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--color-success-bg, #064E3B)',
            color: 'var(--color-success, #10B981)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '12px 20px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.92rem',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--color-danger-bg, #4C0519)',
            color: 'var(--color-danger, #F43F5E)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '12px 20px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.92rem',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              marginLeft: '8px',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Stat Cards */}
      <div className="section-mgmt-header-wrap" style={{ marginBottom: '24px' }}>
        <div className="section-mgmt-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="section-mgmt-title" style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LayoutGrid size={24} style={{ color: 'var(--brand-primary)' }} />
              Store Sections & Departments
            </h2>
            <p className="section-mgmt-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
              Organize your retail floor, departments, and aisles for efficient product placement, staff assignments, and section-wise sales analytics.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div
          className="section-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <div className="glass-panel section-stat-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              className="section-stat-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LayoutGrid size={20} />
            </div>
            <div>
              <div className="section-stat-label" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Sections</div>
              <div className="section-stat-value" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{totalSectionsCount}</div>
            </div>
          </div>

          <div className="glass-panel section-stat-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              className="section-stat-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={20} />
            </div>
            <div>
              <div className="section-stat-label" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Assigned Products</div>
              <div className="section-stat-value" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{totalItemsAssigned}</div>
            </div>
          </div>

          <div className="glass-panel section-stat-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              className="section-stat-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Boxes size={20} />
            </div>
            <div>
              <div className="section-stat-label" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Stock Units in Sections</div>
              <div className="section-stat-value" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{totalUnitsInSections}</div>
            </div>
          </div>

          <div className="glass-panel section-stat-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              className="section-stat-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.12)',
                color: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div className="section-stat-label" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Staff Members Assigned</div>
              <div className="section-stat-value" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{totalStaffAssigned}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid: Create Section Form + Directory List */}
      <div
        className="section-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 380px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Create Section Form */}
        <div className="glass-panel section-form-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div
              className="section-form-icon-box"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--brand-ruby-glow, rgba(225, 29, 72, 0.12))',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={18} />
            </div>
            <div>
              <h3 className="section-form-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add New Section</h3>
              <span className="section-form-desc" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Define a new department or aisle</span>
            </div>
          </div>

          <form onSubmit={handleCreateSection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Section Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Section / Department Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Menswear, Electronics, Shelf A1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            {/* Section Code & Store Scope */}
            <div className="section-form-row-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Short Code (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. MEN, SEC-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Store Location
                </label>
                <select
                  className="input-field"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">All Stores (Global)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Accent Color Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Badge & Chart Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '2.5px solid #fff' : '2px solid transparent',
                      boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                      cursor: 'pointer',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '30px',
                    height: '30px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                  title="Choose custom color"
                />
              </div>
            </div>

            {/* Description / Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Description / Floor Notes
              </label>
              <textarea
                className="input-field"
                placeholder="e.g. Ground floor aisle 3, near fitting rooms"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 700,
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Plus size={18} />
              {saving ? 'Creating Section...' : 'Create Section'}
            </button>
          </form>
        </div>

        {/* Right Column: Section Directory List & Cards */}
        <div className="section-dir-column">
          {/* Search Header */}
          <div
            className="glass-panel section-dir-search"
            style={{
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
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
                className="input-field"
                placeholder="Search sections by name, code, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {filteredSections.length} of {sections.length} sections
            </div>
          </div>

          {/* Section Cards Grid */}
          {loading && sections.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading sections directory...
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <LayoutGrid size={40} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700 }}>No Sections Found</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
                {searchQuery ? `No sections match "${searchQuery}".` : 'Create your first store section to begin organizing inventory.'}
              </p>
            </div>
          ) : (
            <div
              className="section-cards-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredSections.map((sec) => {
                const secColor = sec.color || '#3B82F6';
                return (
                  <div
                    key={sec.id}
                    className="glass-panel glass-panel-interactive section-item-card"
                    style={{
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      borderLeft: `4px solid ${secColor}`,
                    }}
                  >
                    <div>
                      {/* Top Row: Title & Actions */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: secColor,
                                display: 'inline-block',
                              }}
                            />
                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{sec.name}</h4>
                            {sec.code && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--bg-card-hover)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {sec.code}
                              </span>
                            )}
                          </div>

                          {sec.store_name && (
                            <div className="section-card-store" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                              <StoreIcon size={12} />
                              <span>{sec.store_name}</span>
                            </div>
                          )}
                        </div>

                        {/* Edit / Delete Buttons */}
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setEditingSection({ ...sec })}
                            className="btn btn-secondary btn-sm section-card-btn section-card-edit-btn"
                            style={{ padding: '6px 8px', borderRadius: '6px' }}
                            title="Edit Section"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSection(sec)}
                            className="btn btn-sm section-card-btn section-card-delete-btn"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: 'rgba(244, 63, 94, 0.1)',
                              color: 'var(--color-danger)',
                              border: '1px solid rgba(244, 63, 94, 0.2)',
                            }}
                            title="Delete Section"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {sec.description ? (
                        <p className="section-card-desc" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 14px', lineHeight: 1.4 }}>
                          {sec.description}
                        </p>
                      ) : (
                        <p className="section-card-desc" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '6px 0 14px' }}>
                          No description provided
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata Pills */}
                    <div
                      className="section-item-meta-row"
                      style={{
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Package size={14} style={{ color: 'var(--brand-primary)' }} />
                        <span>
                          <strong>{sec.items_count || 0}</strong> products
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Users size={14} style={{ color: '#8B5CF6' }} />
                        <span>
                          <strong>{sec.staff_count || 0}</strong> staff
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Boxes size={14} style={{ color: '#10B981' }} />
                        <span>
                          <strong>{sec.total_units || 0}</strong> units
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Section Modal */}
      {editingSection && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-panel section-modal-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: 'var(--radius-xl, 16px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              animation: 'modalSlideUp 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--brand-primary)' }} />
                Edit Section
              </h3>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Section Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editingSection.name || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Short Code
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingSection.code || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, code: e.target.value.toUpperCase() })}
                    style={{ width: '100%', textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Store Scope
                  </label>
                  <select
                    className="input-field"
                    value={editingSection.store || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, store: e.target.value || null })}
                    style={{ width: '100%' }}
                  >
                    <option value="">All Stores (Global)</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Badge Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingSection({ ...editingSection, color: c })}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: c,
                        border: editingSection.color === c ? '2.5px solid #fff' : '2px solid transparent',
                        boxShadow: editingSection.color === c ? `0 0 10px ${c}` : 'none',
                        cursor: 'pointer',
                        transform: editingSection.color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editingSection.color || '#3B82F6'}
                    onChange={(e) => setEditingSection({ ...editingSection, color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Description / Floor Notes
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editingSection.description || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingSection(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSaving}
                >
                  {modalSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Section Modal */}
      {deletingSection && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-panel section-modal-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: 'var(--radius-xl, 16px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              animation: 'modalSlideUp 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Delete Section?</h3>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 14px', lineHeight: 1.5 }}>
              Are you sure you want to delete the section <strong>"{deletingSection.name}"</strong>?
            </p>

            {(deletingSection.items_count > 0 || deletingSection.staff_count > 0) && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: 'var(--color-warning, #F59E0B)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.8rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Notice:</strong> This section currently has <strong>{deletingSection.items_count || 0} product(s)</strong> and{' '}
                  <strong>{deletingSection.staff_count || 0} staff member(s)</strong> assigned. Deleting this section will safely unassign them.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingSection(null)}
                disabled={modalSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDeleteSection}
                disabled={modalSaving}
                style={{
                  background: 'var(--color-danger, #F43F5E)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                }}
              >
                {modalSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
