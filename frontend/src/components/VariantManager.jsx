import React from 'react';
import { Plus, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';

export default function VariantManager({
  hasVariants,
  setHasVariants,
  variants,
  setVariants,
  totalStock,
  availableImages = [],
}) {
  const sumQuantity = (variants || []).reduce(
    (acc, v) => acc + (parseInt(v.quantity, 10) || 0),
    0
  );
  const isStockAligned = !hasVariants || sumQuantity === (parseInt(totalStock, 10) || 0);

  const handleAddVariant = () => {
    setVariants([
      ...(variants || []),
      {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: '',
        quantity: 0,
        image_id: null,
      },
    ]);
  };

  const handleRemoveVariant = (index) => {
    const updated = [...variants];
    updated.splice(index, 1);
    setVariants(updated);
  };

  const handleUpdateVariant = (index, field, value) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.02))',
        border: hasVariants
          ? '1px solid rgba(244, 63, 94, 0.35)'
          : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '16px',
        marginBottom: '20px',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => {
                const checked = e.target.checked;
                setHasVariants(checked);
                if (checked && (!variants || variants.length === 0)) {
                  setVariants([
                    {
                      id: `temp_1`,
                      name: 'Design 1',
                      quantity: parseInt(totalStock, 10) || 0,
                      image_id: availableImages[0]?.id || null,
                    },
                  ]);
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--brand-primary, #f43f5e)',
                cursor: 'pointer',
              }}
            />
            <span>Enable Colours / Designs (Shared Barcode)</span>
          </label>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', marginLeft: '26px' }}>
            Products with multiple character designs or colours sharing the exact same barcode/UID.
          </div>
        </div>

        {hasVariants && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.82rem',
            }}
          >
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: isStockAligned
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(239, 68, 68, 0.15)',
                color: isStockAligned
                  ? 'var(--color-success, #10b981)'
                  : 'var(--color-danger, #ef4444)',
                fontWeight: 700,
                border: `1px solid ${
                  isStockAligned
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(239, 68, 68, 0.4)'
                }`,
              }}
            >
              Variant Stock Total: {sumQuantity} / Total: {parseInt(totalStock, 10) || 0}
            </span>

            <button
              type="button"
              onClick={handleAddVariant}
              className="btn btn-secondary btn-xs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontWeight: 600,
              }}
            >
              <Plus size={13} />
              <span>Add Design</span>
            </button>
          </div>
        )}
      </div>

      {hasVariants && (
        <div style={{ marginTop: '16px' }}>
          {!isStockAligned && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-danger, #ef4444)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginBottom: '12px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>
                The sum of all variant quantities ({sumQuantity}) must equal the product's total
                stock ({parseInt(totalStock, 10) || 0}). Please adjust individual counts.
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {variants.map((v, idx) => (
              <div
                key={v.id || idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(180px, 2fr) 40px',
                  gap: '12px',
                  alignItems: 'center',
                  background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <input
                    type="text"
                    value={v.name || ''}
                    onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                    placeholder="e.g. Spider-Man / Red"
                    className="form-input"
                    style={{ height: '36px', fontSize: '0.84rem' }}
                    required
                  />
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    value={v.quantity ?? ''}
                    onChange={(e) =>
                      handleUpdateVariant(idx, 'quantity', parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="Qty"
                    className="form-input mono"
                    style={{ height: '36px', fontSize: '0.84rem' }}
                    required
                  />
                </div>

                {/* Linked Photo selector with Visual Thumbnails */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Option: No image */}
                    <button
                      type="button"
                      onClick={() => handleUpdateVariant(idx, 'image_id', null)}
                      title="No linked photo"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        border: !v.image_id ? '2px solid var(--brand-primary, #f43f5e)' : '1px solid var(--border-subtle)',
                        background: !v.image_id ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        color: !v.image_id ? 'var(--brand-primary, #f43f5e)' : 'var(--text-muted)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      None
                    </button>

                    {/* Available product photos as clickable image thumbnails */}
                    {availableImages.map((img, imgIdx) => {
                      const imgKey = img.id || imgIdx;
                      const isSelected = String(v.image_id) === String(img.id);
                      const src = img.url || img.image_url || img.image;

                      return (
                        <button
                          key={imgKey}
                          type="button"
                          onClick={() => handleUpdateVariant(idx, 'image_id', img.id)}
                          title={`Select Photo #${imgIdx + 1} for this variant`}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            border: isSelected ? '2px solid var(--brand-primary, #f43f5e)' : '1px solid var(--border-subtle)',
                            overflow: 'hidden',
                            padding: 0,
                            position: 'relative',
                            cursor: 'pointer',
                            background: '#000',
                            boxShadow: isSelected ? '0 0 8px rgba(244, 63, 94, 0.45)' : 'none',
                            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {src ? (
                            <img
                              src={src}
                              alt={`Photo ${imgIdx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(244, 63, 94, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#fff',
                                }}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(idx)}
                    disabled={variants.length <= 1}
                    className="btn btn-secondary btn-icon btn-xs"
                    style={{
                      height: '36px',
                      width: '36px',
                      color: variants.length <= 1 ? 'var(--text-muted)' : 'var(--color-danger, #ef4444)',
                      opacity: variants.length <= 1 ? 0.4 : 1,
                    }}
                    title="Remove variant"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
