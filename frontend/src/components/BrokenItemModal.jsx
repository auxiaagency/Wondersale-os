import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Upload,
  Camera,
  CheckCircle2,
  Trash2,
  Search,
  Package,
  Layers,
  Building2,
  AlertOctagon,
  Check,
} from 'lucide-react';
import { reportBrokenItem, fetchItems } from '../api';

export default function BrokenItemModal({
  item: initialItem = null,
  currentUser = null,
  stores = [],
  sections = [],
  onClose,
  onSuccess,
}) {
  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [reasonCategory, setReasonCategory] = useState('Dropped / Smashed');
  const [reasonDetails, setReasonDetails] = useState('');
  const [proofImageFile, setProofImageFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fileInputRef = useRef(null);

  // Extract staff scope
  const userSection = currentUser?.section || currentUser?.section_id || currentUser?.section_details?.id;
  const userStore = currentUser?.store || currentUser?.store_id || currentUser?.store_details?.id;
  const isSectionScoped =
    currentUser?.effective_inventory_scope === 'assigned_section' ||
    currentUser?.role_details?.inventory_scope === 'assigned_section' ||
    currentUser?.inventory_scope === 'assigned_section';

  // Load available in-stock items when modal opens if no initial item provided
  useEffect(() => {
    if (initialItem) {
      setSelectedItem(initialItem);
      return;
    }

    let isMounted = true;
    const loadInStockItems = async () => {
      setIsLoadingItems(true);
      try {
        const params = {
          stock_status: 'in_stock',
          page_size: 50,
        };
        if (isSectionScoped && userSection) {
          params.section = userSection;
        } else if (userStore) {
          params.store = userStore;
        }
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        const data = await fetchItems(params);
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        // Strictly only items with positive stock
        const strictlyInStock = list.filter((it) => Number(it.quantity || 0) > 0);
        setAvailableItems(strictlyInStock);
      } catch (err) {
        console.error('Failed to load in-stock items for broken report:', err);
      } finally {
        if (isMounted) setIsLoadingItems(false);
      }
    };

    const timer = setTimeout(loadInStockItems, searchQuery.trim() ? 250 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [initialItem, searchQuery, isSectionScoped, userSection, userStore]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
      }
    };
  }, [proofPreviewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 12MB)
    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage('Proof image is too large. Maximum file size allowed is 12MB.');
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setProofImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setProofPreviewUrl(objectUrl);
    setErrorMessage(null);
  };

  const handleRemovePhoto = () => {
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }
    setProofImageFile(null);
    setProofPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Stock calculations
  const inStockQty = Number(selectedItem?.quantity || 0);
  const costPrice = Number(selectedItem?.cost_price || 0);
  const isOutOfStock = inStockQty <= 0;
  const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
  const totalLoss = (parsedQty * costPrice).toFixed(2);
  const remainingStock = Math.max(0, inStockQty - parsedQty);

  // Validation
  const isQtyExceeded = parsedQty > inStockQty;
  const canSubmit =
    Boolean(selectedItem) &&
    !isOutOfStock &&
    !isQtyExceeded &&
    parsedQty >= 1 &&
    Boolean(proofImageFile) &&
    !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedItem) {
      setErrorMessage('Please select an in-stock item to report.');
      return;
    }

    if (inStockQty <= 0) {
      setErrorMessage(
        'Cannot report broken items: This item is completely out of stock. Stock write-offs can only be applied to items physically present in inventory.'
      );
      return;
    }

    if (parsedQty <= 0) {
      setErrorMessage('Write-off quantity must be at least 1 unit.');
      return;
    }

    if (parsedQty > inStockQty) {
      setErrorMessage(
        `Cannot report ${parsedQty} units. Only ${inStockQty} units are currently in stock.`
      );
      return;
    }

    if (!proofImageFile) {
      setErrorMessage('Mandatory photo proof is required to verify inventory write-offs for accounting.');
      return;
    }

    const fullReason = reasonDetails.trim()
      ? `${reasonCategory}: ${reasonDetails.trim()}`
      : reasonCategory;

    const formData = new FormData();
    formData.append('item', selectedItem.id);
    formData.append('item_id', selectedItem.id);
    formData.append('quantity', parsedQty);
    formData.append('reason', fullReason);
    formData.append('proof_image', proofImageFile);

    setIsSubmitting(true);
    try {
      const response = await reportBrokenItem(selectedItem.id, formData);
      setSuccessMessage(
        `Successfully logged write-off of ${parsedQty} unit(s). Stock synchronized and financial loss of ₹${totalLoss} recorded in accounting.`
      );
      setTimeout(() => {
        if (onSuccess) onSuccess(response);
        if (onClose) onClose();
      }, 1100);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit broken item report.');
      setIsSubmitting(false);
    }
  };

  const damageCategories = [
    'Dropped / Smashed',
    'Packaging Torn / Crushed',
    'Water / Moisture Damage',
    'Customer Handling Incident',
    'Internal Transit / Storage Defect',
    'Other / Defective',
  ];

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 14, 23, 0.82)',
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
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface-solid, #1e293b)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 24px rgba(244, 63, 94, 0.15)',
          color: 'var(--text-primary, #f8fafc)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(244, 63, 94, 0.2)',
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(30, 41, 59, 0.8) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(244, 63, 94, 0.18)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertOctagon size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  Report Broken / Damaged Item
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(244, 63, 94, 0.2)',
                    color: '#fda4af',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                  }}
                >
                  Stock Write-off
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                Log physical goods damage with mandatory photo proof for accounting deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Alerts */}
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{successMessage}</div>
            </div>
          )}

          {/* ITEM SELECTOR (When no preselected item or user clicked change) */}
          {!selectedItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)' }}>
                  Select In-Stock Item to Report <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
                  Showing in-stock inventory only
                </span>
              </div>

              {/* Instant Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter by product name, SKU, or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    color: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* In-Stock Items List */}
              <div
                style={{
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  maxHeight: '230px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isLoadingItems ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Loading in-stock inventory...
                  </div>
                ) : availableItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                    {searchQuery.trim()
                      ? `No in-stock items matching "${searchQuery}".`
                      : 'No items currently in stock in this scope.'}
                  </div>
                ) : (
                  availableItems.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setSelectedItem(it);
                        setQuantity(1);
                        setErrorMessage(null);
                      }}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'transparent',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: '8px', marginTop: '3px' }}>
                          <span>UID: {it.uid}</span>
                          {it.section_name && <span>• {it.section_name}</span>}
                          {it.category_name && <span>• {it.category_name}</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#6ee7b7',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'inline-block',
                          }}
                        >
                          {it.quantity} in stock
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '3px', fontWeight: 600 }}>
                          Cost: ₹{Number(it.cost_price || 0).toFixed(2)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected Item Banner */
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#f43f5e',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Package size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedItem.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span>UID: {selectedItem.uid}</span>
                      {selectedItem.section_name && <span>• Section: {selectedItem.section_name}</span>}
                    </div>
                  </div>
                </div>

                {!initialItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setQuantity(1);
                    }}
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-muted, #cbd5e1)',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Change Item
                  </button>
                )}
              </div>

              {/* Stock & Loss Snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Available Stock</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isOutOfStock ? '#f87171' : '#34d399', marginTop: '2px' }}>
                    {inStockQty} units
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Unit Cost Price</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>
                    ₹{costPrice.toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Write-off Loss</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f43f5e', marginTop: '2px' }}>
                    ₹{totalLoss}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Inputs (Visible once item is selected and verified in stock) */}
          {selectedItem && !isOutOfStock && (
            <>
              {/* Quantity Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)' }}>
                    Broken Quantity to Deduct <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Max: <strong style={{ color: '#34d399' }}>{inStockQty}</strong> units in stock
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="number"
                    min="1"
                    max={inStockQty}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: isQtyExceeded ? '1px solid #f43f5e' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted, #94a3b8)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Remaining: <strong style={{ color: '#fff' }}>{remainingStock}</strong>
                  </div>
                </div>
                {isQtyExceeded && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <AlertTriangle size={14} />
                    Cannot exceed current in-stock quantity of {inStockQty} units.
                  </p>
                )}
              </div>

              {/* Reason Category Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)' }}>
                  Primary Cause / Damage Category <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {damageCategories.map((cat) => {
                    const isSelected = reasonCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setReasonCategory(cat)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 700 : 500,
                          textAlign: 'left',
                          border: isSelected ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isSelected ? 'rgba(244, 63, 94, 0.18)' : 'rgba(0, 0, 0, 0.2)',
                          color: isSelected ? '#fda4af' : 'var(--text-primary, #e2e8f0)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Reason Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)' }}>
                  Incident Details & Description (Optional)
                </label>
                <textarea
                  rows="2"
                  placeholder="Specify shelf location, staff shift, or customer incident notes..."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    color: '#fff',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Mandatory Photo Proof Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={16} style={{ color: '#f43f5e' }} />
                    Mandatory Photo Proof <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: '#fda4af', fontWeight: 600 }}>
                    Required for Audit Ledger
                  </span>
                </div>

                {!proofPreviewUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(244, 63, 94, 0.4)',
                      borderRadius: '14px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(244, 63, 94, 0.04)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.8)';
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.04)';
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'rgba(244, 63, 94, 0.15)',
                        color: '#f43f5e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Upload size={22} />
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                      Click to take photo or upload proof
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                      PNG, JPG, or WEBP up to 12MB (camera capture supported on mobile)
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '14px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div
                      style={{
                        height: '180px',
                        width: '100%',
                        background: '#0b0e17',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={proofPreviewUrl}
                        alt="Broken item proof"
                        style={{ height: '100%', width: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #cbd5e1)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proofImageFile?.name} ({(proofImageFile?.size / 1024).toFixed(0)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          color: '#f87171',
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: canSubmit
                  ? 'linear-gradient(135deg, #e11d48, #be123c)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: canSubmit ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                border: canSubmit ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: canSubmit ? '0 4px 16px rgba(225, 29, 72, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {isSubmitting ? (
                <>
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Processing Write-off...</span>
                </>
              ) : (
                <>
                  <AlertOctagon size={16} />
                  <span>Confirm Write-off (₹{totalLoss})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
