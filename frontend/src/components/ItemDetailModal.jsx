import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Upload,
  Trash2,
  Star,
  ArrowUpDown,
  History,
  Image as ImageIcon,
  Edit,
  AlertTriangle,
  Calendar,
  Layers,
  CheckCircle2,
  Plus,
  FolderPlus,
  Building2,
  Lock,
  User,
  Crop,
  Ruler,
  Scale,
  FileText,
  Box,
  Sparkles,
  AlertOctagon,
} from 'lucide-react';
import {
  updateItem,
  uploadItemImages,
  setImagePrimary,
  deleteItemImage,
  fetchStockMovements,
  createCategory,
  createSubcategory,
  singleAIGenerateDescription,
  applyAIDescription,
  fetchItemVariants,
  createItemVariant,
  deleteItem,
  fetchNextUid,
  fetchItem,
} from '../api';
import { Skeleton } from './Skeleton';
import CategorySubcategoryPicker from './CategorySubcategoryPicker';
import TimeRangeFilter, { filterLogsByTimeRange } from './TimeRangeFilter';
import ImageCropModal from './ImageCropModal';
import BrokenItemModal from './BrokenItemModal';
import { calculateVolumeMetrics } from './ItemTable';

export default function ItemDetailModal({
  item,
  stores = [],
  categories = [],
  subcategories = [],
  suppliers = [],
  sections = [],
  currentUser,
  isSectionRestricted: propIsSectionRestricted,
  onClose,
  onUpdateItem,
  onOpenBarcode,
  onQuickAdjust,
  onMetaUpdated,
  onSwitchItem,
  onItemsChanged,
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
  const [activeTab, setActiveTab] = useState('edit'); // 'edit', 'images', 'ledger'

  // Edit fields
  const [name, setName] = useState(item?.name || '');
  const [supplierId, setSupplierId] = useState(item?.supplier || item?.supplier_id || item?.supplier_details?.id || '');
  const [sectionId, setSectionId] = useState(() => (isSectionRestricted && currentUser?.section ? currentUser.section : (item?.section || item?.section_id || item?.section_details?.id || '')));
  const [costPrice, setCostPrice] = useState(item?.cost_price || '');
  const [sellingPrice, setSellingPrice] = useState(item?.selling_price || '');
  const [mrp, setMrp] = useState(item?.mrp || '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 0);
  const [locationSection, setLocationSection] = useState(item?.location_section || '');
  const [expiryDate, setExpiryDate] = useState(item?.expiry_date || '');
  const [weight, setWeight] = useState(item?.weight || '');
  const [length, setLength] = useState(item?.length !== null && item?.length !== undefined ? item.length : '');
  const [width, setWidth] = useState(item?.width !== null && item?.width !== undefined ? item.width : '');
  const [height, setHeight] = useState(item?.height !== null && item?.height !== undefined ? item.height : '');
  const [description, setDescription] = useState(item?.description || '');
  const [selectedSubcatIds, setSelectedSubcatIds] = useState(
    item?.subcategories?.map((sc) => sc.id) || []
  );
  const [primarySubcatId, setPrimarySubcatId] = useState(
    item?.primary_subcategory?.id || item?.primary_subcategory_id || (item?.subcategories?.[0]?.id || null)
  );
  const [storeId, setStoreId] = useState(item?.store || stores[0]?.id);

  // Taxonomy state
  const [catList, setCatList] = useState(categories);
  const [subcatList, setSubcatList] = useState(subcategories);

  // Gallery state
  const [images, setImages] = useState(item?.images || []);
  const [uploading, setUploading] = useState(false);

  // Stock movements ledger
  const [movements, setMovements] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerTimeFilter, setLedgerTimeFilter] = useState(null);

  // Status
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // AI Description Generator State
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showBrokenModal, setShowBrokenModal] = useState(false);
  const [aiDraft, setAiDraft] = useState(item?.ai_description_draft || '');
  const [aiStatus, setAiStatus] = useState(item?.ai_description_status || 'none');

  // Variants/Batches Tab State
  const [variants, setVariants] = useState(null); // null = not loaded yet
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantsError, setVariantsError] = useState('');
  const [showCreateVariant, setShowCreateVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({
    variant_name: '',
    expiry_date: '',
    supplier_id: '',
    cost_price: '',
    selling_price: '',
    mrp: '',
    location_section: '',
    initial_quantity: '',
    uid: '',
  });
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantFeedback, setVariantFeedback] = useState('');
  const [variantError, setVariantError] = useState('');

  // 1:1 Image Cropper queue state
  const [cropFiles, setCropFiles] = useState([]);

  useEffect(() => {
    setCatList(categories);
  }, [categories]);

  useEffect(() => {
    setSubcatList(subcategories);
  }, [subcategories]);

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setSupplierId(item.supplier || item.supplier_id || item.supplier_details?.id || '');
      setSectionId(isSectionRestricted && currentUser?.section ? currentUser.section : (item.section || item.section_id || item.section_details?.id || ''));
      setCostPrice(item.cost_price || '');
      setSellingPrice(item.selling_price || '');
      setMrp(item.mrp || '');
      setQuantity(item.quantity ?? 0);
      setLocationSection(item.location_section || '');
      setExpiryDate(item.expiry_date || '');
      setWeight(item.weight || '');
      setLength(item.length !== null && item.length !== undefined ? item.length : '');
      setWidth(item.width !== null && item.width !== undefined ? item.width : '');
      setHeight(item.height !== null && item.height !== undefined ? item.height : '');
      setDescription(item.description || '');
      setAiDraft(item.ai_description_draft || '');
      setAiStatus(item.ai_description_status || 'none');
      setSelectedSubcatIds(item.subcategories?.map((sc) => sc.id) || []);
      const itemPrimary = item.primary_subcategory?.id || item.primary_subcategory_id || (item.subcategories?.[0]?.id || null);
      setPrimarySubcatId(itemPrimary);
      setStoreId(item.store || stores[0]?.id);
      setImages(item.images || []);

      // Auto-load variants for dropdown selector
      if (item.id) {
        fetchItemVariants(item.id)
          .then((d) => setVariants(d.variants || []))
          .catch((err) => console.error('Failed to load variants in modal', err));
      }
    }
  }, [item, stores]);

  // When opening Create Variant, automatically pre-fetch next unique UID
  useEffect(() => {
    if (showCreateVariant) {
      fetchNextUid()
        .then((nextUid) => {
          if (nextUid) {
            setVariantForm((f) => ({ ...f, uid: nextUid }));
          }
        })
        .catch((err) => console.error('Failed to pre-fetch next UID for variant', err));
    }
  }, [showCreateVariant]);

  const handleGenerateAIDescription = async () => {
    const hasImage = (images && images.length > 0) || Boolean(item?.primary_image_url);
    if (!hasImage) {
      setErrorMsg('A product photo is required to generate an AI description. Please upload an image first in the Image Gallery tab.');
      return;
    }
    setGeneratingAI(true);
    setErrorMsg('');
    try {
      const res = await singleAIGenerateDescription(item.id);
      const cleanDesc = (res.description || '').slice(0, 1500);
      setDescription(cleanDesc);
      setAiDraft(cleanDesc);
      setAiStatus('ready');
      setFeedbackMsg('✨ AI description generated successfully!');
      if (res.job) {
        window.dispatchEvent(new CustomEvent('ai-job-started', { detail: res.job }));
      }
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      if (onUpdateItem) onUpdateItem(res.item);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate AI description.');
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
    } finally {
      setGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger' && item) {
      loadLedger();
    }
  }, [activeTab, item, ledgerTimeFilter]);

  const loadLedger = async () => {
    setLoadingLedger(true);
    try {
      const params = {};
      if (ledgerTimeFilter?.active) {
        if (ledgerTimeFilter.from_date) params.from_date = ledgerTimeFilter.from_date;
        if (ledgerTimeFilter.to_date) params.to_date = ledgerTimeFilter.to_date;
      }
      const data = await fetchStockMovements(item.id, params);
      setMovements(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load stock movements ledger.');
    } finally {
      setLoadingLedger(false);
    }
  };

  const filteredLedgerMovements = React.useMemo(() => {
    return filterLogsByTimeRange(movements, ledgerTimeFilter, ['created_at']);
  }, [movements, ledgerTimeFilter]);

  if (!item) return null;

  const handleToggleSubcategory = (subcatId) => {
    setSelectedSubcatIds((prev) =>
      prev.includes(subcatId) ? prev.filter((id) => id !== subcatId) : [...prev, subcatId]
    );
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory({ name: newCatName.trim() });
      setCatList((prev) => [...prev, created]);
      setNewSubcatParentId(created.id);
      setNewCatName('');
      setShowAddCat(false);
      onMetaUpdated?.();
    } catch (err) {
      alert(`Category creation failed: ${err.message}`);
    }
  };

  const handleAddSubcategory = async () => {
    if (!newSubcatName.trim() || !newSubcatParentId) return;
    try {
      const created = await createSubcategory({
        category: newSubcatParentId,
        name: newSubcatName.trim(),
      });
      setSubcatList((prev) => [...prev, created]);
      setSelectedSubcatIds((prev) => [...prev, created.id]);
      setNewSubcatName('');
      setShowAddSubcat(false);
      onMetaUpdated?.();
    } catch (err) {
      alert(`Subcategory creation failed: ${err.message}`);
    }
  };

  const handleSaveDetails = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setFeedbackMsg('');

    // Strict validation for mandatory fields
    if (!name.trim()) {
      setErrorMsg('Product Name is required.');
      return;
    }
    if (!storeId) {
      setErrorMsg('Store Location is required. Please select a store.');
      return;
    }
    if (costPrice === '' || isNaN(costPrice) || parseFloat(costPrice) < 0) {
      setErrorMsg('Cost Price is required and must be a valid positive number.');
      return;
    }
    if (sellingPrice === '' || isNaN(sellingPrice) || parseFloat(sellingPrice) < 0) {
      setErrorMsg('Selling Price is required and must be a valid positive number.');
      return;
    }
    if (quantity === '' || isNaN(quantity) || parseInt(quantity, 10) < 0) {
      setErrorMsg('Quantity is required and must be 0 or greater.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        supplier: supplierId || null,
        section: isSectionRestricted && currentUser?.section ? currentUser.section : (sectionId || null),
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellingPrice),
        mrp: mrp ? parseFloat(mrp) : null,
        quantity: parseInt(quantity, 10),
        location_section: locationSection.trim(),
        expiry_date: expiryDate || null,
        weight: weight ? parseFloat(weight) : null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        description: description.trim(),
        subcategories: selectedSubcatIds,
        primary_subcategory: primarySubcatId,
        store: storeId,
      };

      const updated = await updateItem(item.id, payload);
      onUpdateItem?.(updated);
      setFeedbackMsg('Product details updated successfully!');
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rawFiles = Array.from(files).filter(
      (f) => f.type?.startsWith('image/') || (f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i))
    );
    if (rawFiles.length > 0) {
      setCropFiles(rawFiles);
    }
    e.target.value = '';
  };

  const handleCroppedUpload = async (croppedFiles) => {
    setCropFiles([]);
    if (!croppedFiles || croppedFiles.length === 0) return;

    setUploading(true);
    setErrorMsg('');
    try {
      const newImages = await uploadItemImages(item.id, croppedFiles);
      setImages((prev) => [...prev, ...newImages]);
      setFeedbackMsg(`${newImages.length} image(s) cropped (1:1) and added!`);
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (imageId) => {
    try {
      await setImagePrimary(imageId);
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_primary: img.id === imageId,
        }))
      );
    } catch (err) {
      alert(`Failed to set primary image: ${err.message}`);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      await deleteItemImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      alert(`Failed to delete image: ${err.message}`);
    }
  };

  return (
    <>
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="modal-content" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{item.name}</h3>
              <span className="badge badge-neutral mono" style={{ fontSize: '0.8rem' }}>
                UID: {item.uid}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {item.store_details?.name || 'Store'} • Created {new Date(item.created_at).toLocaleDateString()}
              </span>
              {item.needs_new_barcode_printed && (
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  ⚠️ Needs Barcode Printed
                </span>
              )}
            </div>

            {/* Variant Family Dropdown in Modal Header */}
            {((variants && variants.length > 1) || (item.sibling_variants && item.sibling_variants.length > 1)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: 'var(--bg-surface-hover)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
                <Layers size={13} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Variant / Batch:</span>
                <select
                  className="form-input"
                  style={{ height: '28px', fontSize: '0.8rem', padding: '2px 8px', minWidth: '220px', maxWidth: '340px', background: 'var(--bg-base)', color: 'var(--text-primary)', colorScheme: 'dark', cursor: 'pointer' }}
                  value={item.id}
                  onChange={async (e) => {
                    const targetId = Number(e.target.value);
                    if (targetId === item.id) return;
                    if (onSwitchItem) {
                      onSwitchItem(targetId);
                    } else {
                      try {
                        const newItem = await fetchItem(targetId);
                        if (newItem && onUpdateItem) onUpdateItem(newItem);
                      } catch (err) {
                        setErrorMsg('Failed to switch variant');
                      }
                    }
                  }}
                >
                  {(variants || item.sibling_variants || []).map((v) => (
                    <option key={v.id} value={v.id} style={{ background: '#161B2C', color: '#ffffff', padding: '6px 8px' }}>
                      {v.is_master_variant ? '[Original] ' : ''}{v.variant_name || (v.is_master_variant ? 'Original' : `Batch ${v.uid}`)} — UID: {v.uid} ({v.quantity} stock, ₹{v.selling_price})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => { setActiveTab('variants'); setShowCreateVariant(true); }}
                  style={{ padding: '2px 8px', fontSize: '0.74rem', height: '26px' }}
                  title="Add a new variant or batch to this product"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onOpenBarcode(item)}
              className="btn btn-secondary btn-sm"
              title="Print Code128 Label"
            >
              <Printer size={15} />
              <span>Barcode Tag</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdjust(item)}
              className="btn btn-primary btn-sm"
              title="Adjust Stock"
            >
              <ArrowUpDown size={15} />
              <span>Stock ({item.quantity})</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBrokenModal(true)}
              disabled={!item?.quantity || Number(item.quantity) <= 0}
              className="btn btn-sm"
              style={{
                background: (item?.quantity && Number(item.quantity) > 0) ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: (item?.quantity && Number(item.quantity) > 0) ? '#f43f5e' : 'var(--text-muted)',
                border: (item?.quantity && Number(item.quantity) > 0) ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid var(--border-subtle)',
                cursor: (item?.quantity && Number(item.quantity) > 0) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              title={(item?.quantity && Number(item.quantity) > 0) ? "Report Broken / Damaged Item" : "Cannot report broken: Item is out of stock"}
            >
              <AlertOctagon size={15} />
              <span>Report Broken</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0 24px',
            background: 'var(--bg-surface-hover)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'edit' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'edit' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Edit size={16} />
            <span>Product Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'images' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'images' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ImageIcon size={16} />
            <span>Image Gallery ({images.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ledger' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'ledger' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <History size={16} />
            <span>Stock Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('variants');
              if (!variants) {
                setLoadingVariants(true);
                fetchItemVariants(item.id)
                  .then((d) => { setVariants(d.variants || []); })
                  .catch((e) => { setVariantsError(e.message); })
                  .finally(() => setLoadingVariants(false));
              }
            }}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'variants' ? '2px solid var(--color-warning)' : '2px solid transparent',
              color: activeTab === 'variants' ? 'var(--color-warning)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={16} />
            <span>Variants {variants ? `(${variants.length})` : ''}</span>
          </button>
        </div>

        {/* Notifications */}
        {feedbackMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '10px 16px',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '10px 16px',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Edit Details */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveDetails} style={{ padding: '24px' }}>
            {/* Product Name & Store Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">
                  Product Name <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>(Required)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  required
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
                      {item?.store_details?.name || stores.find((s) => String(s.id) === String(item?.store || storeId))?.name || 'Assigned Store'}
                    </span>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px', flexShrink: 0 }}>
                    <Lock size={9} /> Assigned
                  </span>
                </div>
              </div>
            </div>

            {/* Categories & Subcategories (Organized with Live Search) */}
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>
                Categories &amp; Subcategories <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <CategorySubcategoryPicker
                categories={catList}
                subcategories={subcatList}
                selectedSubcatIds={selectedSubcatIds}
                primarySubcatId={primarySubcatId}
                onChangeSelected={setSelectedSubcatIds}
                onChangePrimary={setPrimarySubcatId}
                onMetaUpdated={onMetaUpdated}
                maxHeight="160px"
              />
            </div>

            {/* Supplier & Section Selection Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>
                  Supplier / Vendor <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <select
                  value={supplierId || ''}
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
                  value={isSectionRestricted && currentUser?.section ? currentUser.section : (sectionId || '')}
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
                  value={mrp || ''}
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
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input mono"
                  required
                />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Modifications will automatically record a stock ledger entry.
                </div>
              </div>
              <div>
                <label className="form-label">
                  Section / Shelf <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={locationSection}
                  onChange={(e) => setLocationSection(e.target.value)}
                  placeholder="e.g. Aisle 3"
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
                  value={expiryDate || ''}
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
                  value={weight || ''}
                  onChange={(e) => setWeight(e.target.value)}
                  className="form-input mono"
                />
              </div>
            </div>

            {/* Physical Dimensions (L x W x H in cm) & Volume Calculation */}
            <div style={{ marginBottom: '16px', background: 'var(--bg-surface-hover)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Ruler size={14} style={{ color: 'var(--brand-primary)' }} />
                  Dimensions (cm) <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                {(() => {
                  const { volumeCm3, volumeLiters, volumetricWeightKg } = calculateVolumeMetrics(length, width, height);
                  if (volumeCm3 !== null) {
                    return (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '2px 8px', gap: '4px' }}>
                          <Box size={11} /> Vol: {volumeCm3.toLocaleString()} cm³ ({volumeLiters} L)
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '2px 8px', gap: '4px' }}>
                          <Scale size={11} /> Vol. Wt: {volumetricWeightKg} kg
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="Length (cm)"
                    className="form-input mono"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="Width (cm)"
                    className="form-input mono"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="Height (cm)"
                    className="form-input mono"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                  <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                  Product Description <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleGenerateAIDescription}
                    disabled={generatingAI}
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '4px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    }}
                    title="Generate product description from image using Gemini Vision"
                  >
                    <Sparkles size={13} className={generatingAI ? 'animate-spin' : ''} />
                    <span>{generatingAI ? 'Generating...' : '✨ AI Generate'}</span>
                  </button>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: description.length > 1450 ? 'var(--color-danger, #ef4444)' : 'var(--text-muted)',
                    }}
                  >
                    {description.length}/1500
                  </span>
                </div>
              </div>

              {aiDraft && aiDraft !== description && (
                <div
                  style={{
                    marginBottom: '8px',
                    padding: '8px 12px',
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                    color: '#c7d2fe',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} style={{ color: '#a855f7' }} />
                    <span>✨ AI Description Draft Available</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDescription((aiDraft || '').slice(0, 1500))}
                    style={{
                      background: '#10B981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title="Overwrite current description with AI generated draft"
                  >
                    Apply &amp; Overwrite
                  </button>
                </div>
              )}

              <textarea
                rows="4"
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
                placeholder="Enter detailed e-commerce description, markdown specifications, packaging highlights..."
                className="form-input"
                style={{
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  lineHeight: '1.6',
                  borderColor: description.length > 1500 ? 'var(--color-danger, #ef4444)' : undefined,
                }}
              />
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Close
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Images */}
        {activeTab === 'images' && (
          <div style={{ padding: '24px' }}>
            {/* Upload Area */}
            <div
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                textAlign: 'center',
                marginBottom: '24px',
                background: 'var(--bg-surface-hover)',
              }}
            >
              <Upload size={32} style={{ color: 'var(--brand-primary)', margin: '0 auto 8px', opacity: 0.8 }} />
              <h4 style={{ fontSize: '0.98rem', marginBottom: '4px' }}>Upload Product Images</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Accepts JPG, PNG, HEIC. Converted server-side to WebP before saving. Original files are never persisted.
              </p>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <span>{uploading ? 'Processing & Converting...' : 'Choose Images'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.heic"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Images Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px',
              }}
            >
              {images.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No gallery images uploaded yet.
                </div>
              ) : (
                images.map((img) => (
                  <div
                    key={img.id}
                    className="glass-panel"
                    style={{
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ height: '140px', background: '#000', overflow: 'hidden' }}>
                      <img
                        src={img.image_url || img.image}
                        alt="Product Image"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {img.is_primary && (
                      <span
                        className="badge badge-warning"
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                        }}
                      >
                        ⭐ Primary
                      </span>
                    )}

                    <div
                      style={{
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-surface-solid)',
                      }}
                    >
                      {!img.is_primary ? (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(img.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                        >
                          Make Primary
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Primary Image</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="btn btn-danger btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Delete Image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Stock Ledger */}
        {activeTab === 'ledger' && (
          <div style={{ padding: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h4 style={{ fontSize: '1rem' }}>Stock Movement Ledger</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Immutable audit trail — current balance: <strong>{item.quantity} units</strong>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TimeRangeFilter
                  compact={true}
                  filterState={ledgerTimeFilter}
                  onFilterChange={setLedgerTimeFilter}
                />
                <button
                  type="button"
                  onClick={() => onQuickAdjust(item)}
                  className="btn btn-primary btn-sm"
                >
                  <ArrowUpDown size={14} />
                  <span>Adjust Stock</span>
                </button>
              </div>
            </div>

            {loadingLedger ? (
              <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.02)',
                        color: 'var(--text-muted)',
                        fontSize: '0.76rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Performed By</th>
                      <th style={{ padding: '10px 14px' }}>Reason</th>
                      <th style={{ padding: '10px 14px' }}>Change</th>
                      <th style={{ padding: '10px 14px' }}>Audit Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 14px' }}><Skeleton width="110px" height="12px" /></td>
                        <td style={{ padding: '12px 14px' }}><Skeleton width="120px" height="16px" /></td>
                        <td style={{ padding: '12px 14px' }}><Skeleton width="80px" height="20px" variant="pill" /></td>
                        <td style={{ padding: '12px 14px' }}><Skeleton width="45px" height="20px" variant="pill" /></td>
                        <td style={{ padding: '12px 14px' }}><Skeleton width="140px" height="12px" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredLedgerMovements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {ledgerTimeFilter?.active
                  ? 'No stock movements logged for this product within the selected time range.'
                  : 'No stock movements logged for this product.'}
              </div>
            ) : (
              <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.02)',
                        color: 'var(--text-muted)',
                        fontSize: '0.76rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Performed By</th>
                      <th style={{ padding: '10px 14px' }}>Reason</th>
                      <th style={{ padding: '10px 14px' }}>Change</th>
                      <th style={{ padding: '10px 14px' }}>Audit Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedgerMovements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: 'var(--primary-color, #6366f1)',
                                flexShrink: 0,
                              }}
                            >
                              {m.performed_by_name ? m.performed_by_name.charAt(0).toUpperCase() : <User size={12} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                {m.performed_by_name || 'System / Auto'}
                              </div>
                              {m.performed_by_role && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {m.performed_by_role}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {m.reason_display || m.reason}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="mono"
                            style={{
                              fontWeight: 700,
                              color: m.change > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                            }}
                          >
                            {m.change > 0 ? `+${m.change}` : m.change}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {m.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Variants & Batches */}
        {activeTab === 'variants' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Product Variants &amp; Batches
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  All siblings share the same product family. Each variant has its own barcode, stock &amp; pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreateVariant((p) => !p); setVariantError(''); setVariantFeedback(''); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} />
                <span>Add Variant</span>
              </button>
            </div>

            {/* Create Variant Form */}
            {showCreateVariant && (
              <div style={{
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                marginBottom: '24px',
              }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Create New Variant
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  ⚠️ At least one field below must differ from the original product to create a valid variant.
                </p>
                {variantError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', marginBottom: '12px' }}>
                    <AlertTriangle size={14} style={{ marginRight: 6 }} />{variantError}
                  </div>
                )}
                {variantFeedback && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', marginBottom: '12px' }}>
                    <CheckCircle2 size={14} style={{ marginRight: 6 }} />{variantFeedback}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Variant Label <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(e.g. "Nov Batch", "Vendor B")</span></label>
                    <input className="form-input" value={variantForm.variant_name} onChange={(e) => setVariantForm((f) => ({ ...f, variant_name: e.target.value }))} placeholder="Short descriptive name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom Barcode / UID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(auto if blank)</span></label>
                    <input className="form-input mono" value={variantForm.uid} onChange={(e) => setVariantForm((f) => ({ ...f, uid: e.target.value }))} placeholder="Leave blank to auto-generate" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={variantForm.expiry_date} onChange={(e) => setVariantForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier</label>
                    <select className="form-input" value={variantForm.supplier_id} onChange={(e) => setVariantForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                      <option value="">— Same as original —</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price (₹)</label>
                    <input type="number" step="0.01" className="form-input" value={variantForm.cost_price} onChange={(e) => setVariantForm((f) => ({ ...f, cost_price: e.target.value }))} placeholder={item?.cost_price || '—'} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹)</label>
                    <input type="number" step="0.01" className="form-input" value={variantForm.selling_price} onChange={(e) => setVariantForm((f) => ({ ...f, selling_price: e.target.value }))} placeholder={item?.selling_price || '—'} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MRP (₹)</label>
                    <input type="number" step="0.01" className="form-input" value={variantForm.mrp} onChange={(e) => setVariantForm((f) => ({ ...f, mrp: e.target.value }))} placeholder={item?.mrp || '—'} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Stock Qty</label>
                    <input type="number" min="0" className="form-input" value={variantForm.initial_quantity} onChange={(e) => setVariantForm((f) => ({ ...f, initial_quantity: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section (Department)</label>
                    <select
                      className="form-input"
                      value={variantForm.section || ''}
                      onChange={(e) => setVariantForm((f) => ({ ...f, section: e.target.value }))}
                    >
                      <option value="">No Section</option>
                      {(sections || []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowCreateVariant(false); setVariantError(''); }}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={variantSaving}
                    onClick={async () => {
                      setVariantSaving(true);
                      setVariantError('');
                      setVariantFeedback('');

                      // Enforce UID difference
                      if (variantForm.uid && String(variantForm.uid).trim() === String(item.uid).trim()) {
                        setVariantError('Variant must have a unique UID / Barcode different from the original item.');
                        setVariantSaving(false);
                        return;
                      }

                      try {
                        const payload = {};
                        Object.entries(variantForm).forEach(([k, v]) => { if (v !== '') payload[k] = v; });
                        const result = await createItemVariant(item.id, payload);
                        const updatedVariants = await fetchItemVariants(item.id);
                        setVariants(updatedVariants.variants || []);
                        setVariantFeedback(`Variant "${result.variant?.uid}" created successfully!`);
                        setShowCreateVariant(false);
                        setVariantForm({ variant_name: '', expiry_date: '', supplier_id: '', cost_price: '', selling_price: '', mrp: '', section: '', initial_quantity: '', uid: '' });
                        if (onItemsChanged) onItemsChanged();
                        if (onUpdateItem && result.source_item) onUpdateItem(result.source_item);
                        setTimeout(() => setVariantFeedback(''), 5000);
                      } catch (e) {
                        setVariantError(e.message);
                      } finally {
                        setVariantSaving(false);
                      }
                    }}
                  >
                    {variantSaving ? 'Creating…' : 'Create Variant'}
                  </button>
                </div>
              </div>
            )}

            {variantFeedback && !showCreateVariant && (
              <div style={{ padding: '10px 14px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} />{variantFeedback}
              </div>
            )}

            {loadingVariants && <Skeleton rows={3} />}

            {!loadingVariants && variantsError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', padding: '16px', textAlign: 'center' }}>
                <AlertTriangle size={16} style={{ marginRight: 6 }} />{variantsError}
              </div>
            )}

            {!loadingVariants && !variantsError && variants && variants.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                <Layers size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontWeight: 600 }}>No variants yet</p>
                <p style={{ fontSize: '0.82rem' }}>Click "Add Variant" to create the first batch or variant of this product.</p>
              </div>
            )}

            {!loadingVariants && variants && variants.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                {variants.map((v) => {
                  const isCurrent = v.id === item.id;
                  const isExpired = v.expiry_date && new Date(v.expiry_date) <= new Date();
                  const primaryImg = v.primary_image_url;
                  return (
                    <div
                      key={v.id}
                      style={{
                        background: isCurrent ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                        border: `1.5px solid ${isCurrent ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: '14px',
                        position: 'relative',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      {v.is_master_variant && (
                        <span style={{ position: 'absolute', top: 10, right: 10, background: 'var(--brand-primary)', color: '#fff', borderRadius: '999px', fontSize: '0.68rem', padding: '2px 8px', fontWeight: 700 }}>
                          ORIGINAL
                        </span>
                      )}
                      {isCurrent && !v.is_master_variant && (
                        <span style={{ position: 'absolute', top: 10, right: 10, background: 'var(--bg-surface-hover)', color: 'var(--brand-primary)', borderRadius: '999px', fontSize: '0.68rem', padding: '2px 8px', fontWeight: 700, border: '1px solid var(--brand-primary)' }}>
                          CURRENT
                        </span>
                      )}
                      {primaryImg && (
                        <img
                          src={primaryImg}
                          alt={v.name}
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '10px' }}
                        />
                      )}
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.variant_name || v.name}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{v.uid}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem' }}>
                        <span style={{ background: 'var(--bg-base)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-secondary)' }}>
                          Stock: <strong style={{ color: v.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{v.quantity}</strong>
                        </span>
                        <span style={{ background: 'var(--bg-base)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-secondary)' }}>
                          ₹{v.selling_price}
                        </span>
                        {v.expiry_date && (
                          <span style={{ background: isExpired ? 'var(--color-danger-bg)' : 'var(--bg-base)', borderRadius: '6px', padding: '3px 8px', color: isExpired ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                            <Calendar size={11} style={{ marginRight: 3 }} />
                            {v.expiry_date}
                            {isExpired && ' ⚠️'}
                          </span>
                        )}
                      </div>
                      {!isCurrent && (
                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                            onClick={() => {
                              if (onSwitchItem) {
                                onSwitchItem(v.id);
                              } else {
                                fetchItem(v.id).then((newItem) => {
                                  if (newItem && onUpdateItem) onUpdateItem(newItem);
                                });
                              }
                            }}
                          >
                            Switch to Variant
                          </button>
                          <button
                            type="button"
                            title="Delete this variant"
                            className="btn btn-xs"
                            style={{
                              background: 'transparent',
                              color: 'var(--color-danger)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={async () => {
                              if (!window.confirm(`Are you sure you want to delete variant "${v.variant_name || v.uid}"? This will permanently delete this variant item.`)) return;
                              try {
                                await deleteItem(v.id);
                                const updatedVariants = await fetchItemVariants(item.id);
                                setVariants(updatedVariants.variants || []);
                                setVariantFeedback(`Variant "${v.uid}" was deleted successfully.`);
                                onItemsChanged?.();
                                onMetaUpdated?.();
                                setTimeout(() => setVariantFeedback(''), 4000);
                              } catch (err) {
                                alert(`Failed to delete variant: ${err.message}`);
                              }
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* 1:1 Square Image Cropper Modal */}
    {cropFiles.length > 0 && (
      <ImageCropModal
        isOpen={cropFiles.length > 0}
        files={cropFiles}
        onCropComplete={handleCroppedUpload}
        onCancel={() => setCropFiles([])}
      />
    )}

    {/* Damaged / Broken Item Reporting Modal */}
    {showBrokenModal && (
      <BrokenItemModal
        item={item}
        currentUser={currentUser}
        stores={stores}
        sections={sections}
        onClose={() => setShowBrokenModal(false)}
        onSuccess={async () => {
          try {
            const refreshed = await fetchItem(item.id);
            if (refreshed && onUpdateItem) onUpdateItem(refreshed);
          } catch (e) {
            console.error('Failed to reload item after broken write-off:', e);
          }
          if (activeTab === 'ledger') {
            loadLedger();
          }
        }}
      />
    )}
  </>
  );
}
