import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '../api';
import { SkeletonCategoryGrid } from './Skeleton';

export default function CategorySection({
  categories = [],
  subcategories = [],
  loading = false,
  onTaxonomyUpdated,
}) {
  // Add Category form state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Add Subcategory form state
  const [subName, setSubName] = useState('');
  const [subParentId, setSubParentId] = useState(categories[0]?.id || '');
  const [savingSub, setSavingSub] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [deletingSubcategory, setDeletingSubcategory] = useState(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      setError('Category name is required.');
      return;
    }
    setSavingCat(true);
    setError('');
    try {
      const created = await createCategory({
        name: catName.trim(),
        description: catDesc.trim(),
      });
      setCatName('');
      setCatDesc('');
      showFeedback(`Category "${created.name}" created successfully.`);
      if (!subParentId) {
        setSubParentId(created.id);
      }
      onTaxonomyUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  };

  const handleCreateSubcategory = async (e) => {
    e.preventDefault();
    if (!subName.trim()) {
      setError('Subcategory name is required.');
      return;
    }
    if (!subParentId) {
      setError('Please select a parent category.');
      return;
    }
    setSavingSub(true);
    setError('');
    try {
      const created = await createSubcategory({
        category: subParentId,
        name: subName.trim(),
      });
      setSubName('');
      showFeedback(`Subcategory "${created.name}" created under selected parent category.`);
      onTaxonomyUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to create subcategory');
    } finally {
      setSavingSub(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory(deletingCategory.id);
      showFeedback(`Category "${deletingCategory.name}" and its subcategories removed.`);
      setDeletingCategory(null);
      onTaxonomyUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!deletingSubcategory) return;
    try {
      await deleteSubcategory(deletingSubcategory.id);
      showFeedback(`Subcategory "${deletingSubcategory.name}" deleted.`);
      setDeletingSubcategory(null);
      onTaxonomyUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to delete subcategory');
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.description?.toLowerCase().includes(q) ||
        subcategories.some(
          (sub) => String(sub.category) === String(cat.id) && sub.name.toLowerCase().includes(q)
        )
    );
  }, [categories, subcategories, searchQuery]);

  return (
    <div className="category-section-root" style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div
        className="glass-panel category-header-card"
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
            className="category-header-icon-box"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--brand-ruby-glow)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <h2 className="category-header-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              Categories &amp; Subcategories Workspace
            </h2>
            <p className="category-header-sub" style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Create parent categories, add child subcategories, and organize multi-tier catalog taxonomy.
            </p>
          </div>
        </div>

        <div className="category-header-stats" style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          <strong>{categories.length}</strong> Parent Categories &bull; <strong>{subcategories.length}</strong> Child Subcategories
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

      {/* Two Top Creation Forms: Add Category & Add SubCategory */}
      <div className="category-forms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Form 1: Add Parent Category */}
        <form
          onSubmit={handleCreateCategory}
          className="glass-panel category-create-form"
          style={{ padding: '24px', borderRadius: 'var(--radius-xl)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <FolderPlus size={20} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add Parent Category</h3>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Category Name *</label>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Apparel, Electronics, Footwear"
              className="form-input"
              required
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Brief description or notes..."
              className="form-input"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingCat || !catName.trim()}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
            >
              {savingCat ? 'Saving Category...' : '+ Create Parent Category'}
            </button>
          </div>
        </form>

        {/* Form 2: Add Subcategory under Parent Category */}
        <form
          onSubmit={handleCreateSubcategory}
          className="glass-panel category-create-form"
          style={{ padding: '24px', borderRadius: 'var(--radius-xl)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Tag size={20} style={{ color: 'var(--brand-accent)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add Child Subcategory</h3>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Parent Category *</label>
            <select
              value={subParentId}
              onChange={(e) => setSubParentId(e.target.value)}
              className="form-select"
              required
            >
              {categories.length === 0 && <option value="">No parent categories available</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">Subcategory Name *</label>
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="e.g. Men's Wear, Casual Shirts, Smartwatches"
              className="form-input"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingSub || !subName.trim() || !subParentId}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
            >
              {savingSub ? 'Saving Subcategory...' : '+ Create Child Subcategory'}
            </button>
          </div>
        </form>
      </div>

      {/* Search Bar */}
      <div
        className="glass-panel category-search-card"
        style={{
          padding: '14px 20px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
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
            placeholder="Search categories or subcategories..."
            className="form-input category-search-input"
            style={{
              paddingLeft: '36px',
              paddingRight: searchQuery ? '32px' : '12px',
              fontSize: '0.88rem',
              height: '38px',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Cards Tree */}
      {loading && categories.length === 0 ? (
        <SkeletonCategoryGrid count={6} />
      ) : filteredCategories.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Folder size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <h3 style={{ marginBottom: '6px' }}>No Categories Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {searchQuery ? 'No categories or subcategories match your search query.' : 'Use the form above to add your first parent category.'}
          </p>
        </div>
      ) : (
        <div
          className="category-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredCategories.map((cat) => {
            const childSubs = subcategories.filter(
              (sub) => String(sub.category) === String(cat.id)
            );

            return (
              <div
                key={cat.id}
                className="glass-panel category-item-card"
                style={{
                  padding: '22px',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  {/* Category Header */}
                  <div
                    className="category-item-header"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        className="category-item-icon-box"
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--brand-ruby-glow)',
                          color: 'var(--brand-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Folder size={18} />
                      </div>
                      <div>
                        <h3 className="category-item-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                          {cat.name}
                        </h3>
                        <span className="category-item-count" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {childSubs.length} child subcategories &bull; {cat.items_count || 0} items
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(cat)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Edit Parent Category"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCategory(cat)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px', color: 'var(--color-danger)' }}
                        title="Delete Parent Category"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {cat.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', fontStyle: 'italic' }}>
                      {cat.description}
                    </p>
                  )}

                  {/* SubCategories List */}
                  <div
                    className="category-subs-box"
                    style={{
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                      }}
                    >
                      Child Subcategories
                    </div>

                    {childSubs.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                        No subcategories added yet.
                      </div>
                    ) : (
                      <div
                        className="custom-scrollbar"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          maxHeight: '185px',
                          overflowY: 'auto',
                          paddingRight: childSubs.length > 5 ? '6px' : '0px',
                        }}
                      >
                        {childSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="category-sub-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.82rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                              <Tag size={12} style={{ color: 'var(--brand-primary)' }} />
                              <span>{sub.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => setEditingSubcategory(sub)}
                                className="btn btn-secondary btn-icon"
                                style={{ width: '22px', height: '22px', padding: 0 }}
                                title="Edit Subcategory"
                              >
                                <Edit2 size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSubcategory(sub)}
                                className="btn btn-secondary btn-icon"
                                style={{ width: '22px', height: '22px', padding: 0, color: 'var(--color-danger)' }}
                                title="Delete Subcategory"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Add child subcategory button to this category */}
                <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubParentId(cat.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn btn-secondary btn-sm category-add-sub-btn"
                    style={{ width: '100%', fontSize: '0.78rem', justifyContent: 'center' }}
                  >
                    <Plus size={13} />
                    <span>Select &amp; Add Subcategory to {cat.name}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="modal-overlay cat-modal-overlay" onClick={() => setEditingCategory(null)}>
          <div className="modal-content cat-modal-dialog" style={{ maxWidth: '480px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="cat-modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                <h3 className="cat-modal-title" style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0 }}>Edit Category: {editingCategory.name}</h3>
              </div>
              <button type="button" onClick={() => setEditingCategory(null)} className="btn btn-secondary btn-icon cat-modal-close-btn" style={{ width: '30px', height: '30px', flexShrink: 0 }}>✕</button>
            </div>
            <EditCategoryForm
              category={editingCategory}
              onClose={() => setEditingCategory(null)}
              onSuccess={(updated) => {
                setEditingCategory(null);
                showFeedback(`Category "${updated.name}" updated successfully.`);
                onTaxonomyUpdated?.();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deletingCategory && (
        <div className="modal-overlay cat-modal-overlay" onClick={() => setDeletingCategory(null)}>
          <div className="modal-content cat-modal-dialog cat-modal-delete-dialog" style={{ maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-delete-body" style={{ padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={44} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
              <h3 className="cat-modal-title" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Delete Category?</h3>
              <p className="cat-modal-delete-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Are you sure you want to remove category <strong>{deletingCategory.name}</strong>? All child subcategories under it will also be deleted.
              </p>
              <div className="cat-modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" onClick={() => setDeletingCategory(null)} className="btn btn-secondary cat-modal-cancel-btn">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  className="btn btn-primary cat-modal-submit-btn"
                  style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subcategory Modal */}
      {editingSubcategory && (
        <div className="modal-overlay cat-modal-overlay" onClick={() => setEditingSubcategory(null)}>
          <div className="modal-content cat-modal-dialog" style={{ maxWidth: '480px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="cat-modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                <h3 className="cat-modal-title" style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0 }}>Edit Subcategory: {editingSubcategory.name}</h3>
              </div>
              <button type="button" onClick={() => setEditingSubcategory(null)} className="btn btn-secondary btn-icon cat-modal-close-btn" style={{ width: '30px', height: '30px', flexShrink: 0 }}>✕</button>
            </div>
            <EditSubcategoryForm
              subcategory={editingSubcategory}
              categories={categories}
              onClose={() => setEditingSubcategory(null)}
              onSuccess={(updated) => {
                setEditingSubcategory(null);
                showFeedback(`Subcategory "${updated.name}" updated successfully.`);
                onTaxonomyUpdated?.();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Subcategory Modal */}
      {deletingSubcategory && (
        <div className="modal-overlay cat-modal-overlay" onClick={() => setDeletingSubcategory(null)}>
          <div className="modal-content cat-modal-dialog cat-modal-delete-dialog" style={{ maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-delete-body" style={{ padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={44} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
              <h3 className="cat-modal-title" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Delete Subcategory?</h3>
              <p className="cat-modal-delete-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Are you sure you want to remove subcategory <strong>{deletingSubcategory.name}</strong>?
              </p>
              <div className="cat-modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" onClick={() => setDeletingSubcategory(null)} className="btn btn-secondary cat-modal-cancel-btn">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubcategory}
                  className="btn btn-primary cat-modal-submit-btn"
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

// ----------------- Edit Category Form -----------------
function EditCategoryForm({ category, onClose, onSuccess }) {
  const [name, setName] = useState(category.name || '');
  const [description, setDescription] = useState(category.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateCategory(category.id, {
        name: name.trim(),
        description: description.trim(),
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cat-modal-form" style={{ padding: '22px' }}>
      {error && (
        <div className="cat-modal-error" style={{ padding: '10px 14px', marginBottom: '14px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }}>
          {error}
        </div>
      )}
      <div className="cat-modal-field" style={{ marginBottom: '16px' }}>
        <label className="form-label cat-modal-label">Category Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input cat-modal-input" required />
      </div>
      <div className="cat-modal-field" style={{ marginBottom: '22px' }}>
        <label className="form-label cat-modal-label">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-input cat-modal-input" rows={3} />
      </div>
      <div className="cat-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" onClick={onClose} className="btn btn-secondary cat-modal-cancel-btn">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary cat-modal-submit-btn">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </form>
  );
}

// ----------------- Edit Subcategory Form -----------------
function EditSubcategoryForm({ subcategory, categories = [], onClose, onSuccess }) {
  const [name, setName] = useState(subcategory.name || '');
  const [category, setCategory] = useState(subcategory.category || categories[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateSubcategory(subcategory.id, {
        category,
        name: name.trim(),
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cat-modal-form" style={{ padding: '22px' }}>
      {error && (
        <div className="cat-modal-error" style={{ padding: '10px 14px', marginBottom: '14px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }}>
          {error}
        </div>
      )}
      <div className="cat-modal-field" style={{ marginBottom: '16px' }}>
        <label className="form-label cat-modal-label">Parent Category *</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-select cat-modal-input" required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="cat-modal-field" style={{ marginBottom: '22px' }}>
        <label className="form-label cat-modal-label">Subcategory Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input cat-modal-input" required />
      </div>
      <div className="cat-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" onClick={onClose} className="btn btn-secondary cat-modal-cancel-btn">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary cat-modal-submit-btn">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </form>
  );
}
