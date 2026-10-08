import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Edit,
  Printer,
  SlidersHorizontal,
  Image as ImageIcon,
  Copy,
  Check,
  Barcode,
  Tag,
  Truck,
  Scale,
  Box,
  Ruler,
  MapPin,
  Store as StoreIcon,
  FileText,
  ZoomIn,
  X,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Sparkles,
  Layers,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { fetchItem, fetchProductAnalytics, singleAIGenerateDescription, applyAIDescription, fetchItemVariants, deleteItem } from '../api';
import { calculateVolumeMetrics } from './ItemTable';
import ProductRankingCard from './ProductRankingCard';
import ProductPriceHistoryChart from './ProductPriceHistoryChart';
import ProductQuantitySalesChart from './ProductQuantitySalesChart';
import ProductActivityLedgers from './ProductActivityLedgers';

function Pill({ children, color = 'var(--bg-main)', textColor = 'var(--text-secondary)', border = 'var(--border-subtle)', icon }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 11px', borderRadius:'100px', background:color, border:`1px solid ${border}`, color:textColor, fontSize:'0.75rem', fontWeight:600, whiteSpace:'nowrap' }}>
      {icon}{children}
    </span>
  );
}

function SpecRow({ icon, label, value, accent }) {
  return (
    <div className="product-spec-row" style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid var(--border-subtle)' }}>
      <div className="product-spec-icon" style={{ width:'34px', height:'34px', borderRadius:'8px', background:`${accent}18`, border:`1px solid ${accent}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:accent }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="product-spec-label" style={{ fontSize:'0.70rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <div className="product-spec-val" style={{ fontSize:'0.88rem', fontWeight:600, color: value ? 'var(--text-primary)' : 'var(--text-muted)', marginTop:'1px', fontStyle: value ? 'normal' : 'italic' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, valueColor = 'var(--text-primary)' }) {
  return (
    <div style={{ padding:'16px 18px', borderRadius:'12px', background:'var(--bg-main, #0B0E17)', border:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:'3px' }}>
      <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      <span style={{ fontSize:'1.30rem', fontWeight:800, color:valueColor, letterSpacing:'-0.01em', lineHeight:1.2 }}>{value}</span>
      {sub && <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'1px' }}>{sub}</span>}
    </div>
  );
}

export default function ProductDetailView({ item, onBack, onUpdateItem, onOpenBarcode, onOpenImageModal, onQuickAdjust, onOpenEditModal, currentUser, stores = [], suppliers = [] }) {
  const [pItem, setPItem] = useState(item);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedUid, setCopiedUid] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiError, setAiError] = useState('');
  const currencySymbol = localStorage.getItem('wondersale_currency') || 'Rs.';

  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantsError, setVariantsError] = useState('');

  useEffect(() => { setPItem(item); }, [item]);
  useEffect(() => {
    if (item?.id) {
      fetchItem(item.id).then((full) => { if (full) setPItem(full); }).catch(() => {});
      setAnalyticsLoading(true);
      fetchProductAnalytics(item.id)
        .then((data) => {
          setAnalytics(data);
        })
        .catch((err) => {
          console.error('Failed to load product analytics', err);
        })
        .finally(() => {
          setAnalyticsLoading(false);
        });

      // Load sibling variants for this item
      setLoadingVariants(true);
      fetchItemVariants(item.id)
        .then((data) => {
          setVariants(data.variants || []);
        })
        .catch((err) => {
          console.error('Failed to load variants in ProductDetailView', err);
          setVariantsError(err.message);
        })
        .finally(() => {
          setLoadingVariants(false);
        });
    }
  }, [item?.id]);

  const handleGenerateAI = async () => {
    if (!pItem.primary_image_url && (!pItem.images || pItem.images.length === 0)) {
      setAiError('A product photo is required to generate an AI description. Please upload an image first.');
      return;
    }
    setGeneratingAI(true);
    setAiError('');
    setAiFeedback('');
    try {
      const res = await singleAIGenerateDescription(pItem.id);
      setPItem(res.item);
      setAiFeedback('AI draft ready! Click "Apply Draft" below to overwrite the product description.');
      if (res.job) {
        window.dispatchEvent(new CustomEvent('ai-job-started', { detail: res.job }));
      }
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      onUpdateItem?.(res.item);
    } catch (err) {
      setAiError(err.message || 'Failed to generate AI description.');
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleApplyDraft = async () => {
    if (!pItem.ai_description_draft) return;
    setGeneratingAI(true);
    setAiError('');
    try {
      const res = await applyAIDescription(pItem.id, pItem.ai_description_draft);
      setPItem(res.item);
      setAiFeedback('Description overwritten & applied successfully!');
      onUpdateItem?.(res.item);
    } catch (err) {
      setAiError(err.message || 'Failed to apply description.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const imageList = useMemo(() => {
    const list = [];
    if (pItem.images?.length > 0) {
      pItem.images.forEach((img) => { if (img?.image_url) list.push({ id: img.id, url: img.image_url, isPrimary: Boolean(img.is_primary) }); });
    } else if (pItem.primary_image_url) {
      list.push({ id: 'primary', url: pItem.primary_image_url, isPrimary: true });
    }
    return list;
  }, [pItem.images, pItem.primary_image_url]);

  const activeImage = imageList[selectedImageIndex] || imageList[0] || null;
  const volMetrics = useMemo(() => calculateVolumeMetrics(pItem.length, pItem.width, pItem.height), [pItem.length, pItem.width, pItem.height]);

  const costPrice = parseFloat(pItem.cost_price) || 0;
  const sellingPrice = parseFloat(pItem.selling_price) || 0;
  const mrp = pItem.mrp ? parseFloat(pItem.mrp) : null;
  const grossProfit = sellingPrice - costPrice;
  const marginPct = costPrice > 0 ? ((grossProfit / costPrice) * 100).toFixed(1) : '0.0';
  const discountPct = mrp && mrp > sellingPrice ? (((mrp - sellingPrice) / mrp) * 100).toFixed(0) : null;

  const stockQty = parseInt(pItem.quantity, 10) || 0;
  const stockStatus =
    stockQty <= 0 ? { label: 'Out of Stock', color: '#F87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)' }
    : stockQty <= 5 ? { label: `Low Stock - ${stockQty} left`, color: '#FBBF24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' }
    : { label: `In Stock - ${stockQty} units`, color: '#34D399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' };

  const primaryCategoryName = pItem.primary_category?.name || pItem.categories?.[0]?.name || pItem.subcategories?.[0]?.category_name || null;
  const primarySubcategoryName = pItem.primary_subcategory?.name || pItem.subcategories?.[0]?.name || null;
  const supplierName = pItem.supplier_name || pItem.supplier_details?.name || (pItem.supplier ? suppliers.find((s) => String(s.id) === String(pItem.supplier))?.name : null);
  const storeName = pItem.store_details?.name || (pItem.store ? stores.find((s) => String(s.id) === String(pItem.store))?.name : 'Active Store');

  const handleCopyUid = (e) => {
    e.stopPropagation();
    if (pItem.uid) { navigator.clipboard.writeText(pItem.uid); setCopiedUid(true); setTimeout(() => setCopiedUid(false), 2000); }
  };
  const prevImage = (e) => { e.stopPropagation(); setSelectedImageIndex((i) => (i === 0 ? imageList.length - 1 : i - 1)); };
  const nextImage = (e) => { e.stopPropagation(); setSelectedImageIndex((i) => (i === imageList.length - 1 ? 0 : i + 1)); };

  return (
    <div className="product-detail-root" style={{ display:'flex', flexDirection:'column', gap:'0px', width:'100%', maxWidth:'1300px', margin:'0 auto', paddingBottom:'48px' }}>

      {/* TOP NAV */}
      <div className="product-detail-topnav" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', paddingBottom:'20px', marginBottom:'4px', borderBottom:'1px solid var(--border-subtle)' }}>
        <div className="product-detail-topnav-left" style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <button type="button" onClick={onBack} className="btn btn-secondary product-detail-back-btn" style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'var(--radius-sm)', fontWeight:600, fontSize:'0.83rem', height:'36px', cursor:'pointer' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <nav aria-label="Breadcrumb" className="product-detail-breadcrumb" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.82rem' }}>
            <span onClick={onBack} style={{ color:'var(--text-muted)', cursor:'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color='var(--text-primary)')} onMouseLeave={(e) => (e.currentTarget.style.color='var(--text-muted)')}>Inventory</span>
            {primaryCategoryName && (<><ChevronRight size={12} style={{ color:'var(--text-muted)', opacity:0.4 }} /><span style={{ color:'var(--text-secondary)' }}>{primaryCategoryName}</span></>)}
            {primarySubcategoryName && (<><ChevronRight size={12} style={{ color:'var(--text-muted)', opacity:0.4 }} /><span style={{ color:'var(--text-secondary)' }}>{primarySubcategoryName}</span></>)}
            <ChevronRight size={12} style={{ color:'var(--text-muted)', opacity:0.4 }} />
            <span style={{ color:'var(--text-primary)', fontWeight:600, maxWidth:'240px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pItem.name}</span>
          </nav>
          {variants && variants.length > 1 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface-hover)', padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <Layers size={13} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>Variant:</span>
              <select
                value={pItem.id}
                onChange={(e) => {
                  const targetId = Number(e.target.value);
                  const targetVariant = variants.find((v) => v.id === targetId);
                  if (targetVariant) handleSwitchVariant(targetVariant);
                }}
                className="form-input"
                style={{
                  height: '28px',
                  fontSize: '0.78rem',
                  padding: '2px 8px',
                  maxWidth: '300px',
                  background: 'var(--bg-surface-solid, #161B2C)',
                  color: 'var(--text-primary, #ffffff)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  colorScheme: 'dark',
                  cursor: 'pointer',
                }}
              >
                {variants.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    style={{ background: '#161B2C', color: '#ffffff', padding: '6px 8px' }}
                  >
                    {v.is_master_variant ? '[Original] ' : ''}{v.variant_name || (v.is_master_variant ? 'Original' : `Batch ${v.uid}`)} ({v.quantity} in stock, ₹{v.selling_price})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="product-detail-actions-bar" style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          {[
            { icon: <Edit size={14} />, label: 'Edit', onClick: () => onOpenEditModal?.(pItem), title: 'Edit product' },
            { icon: <Printer size={14} />, label: 'Print Label', onClick: () => onOpenBarcode?.(pItem), title: 'Print barcode' },
            { icon: <SlidersHorizontal size={14} />, label: 'Adjust Stock', onClick: () => onQuickAdjust?.(pItem), title: 'Adjust stock' },
            { icon: <ImageIcon size={14} />, label: `Gallery (${imageList.length})`, onClick: () => onOpenImageModal?.(pItem), title: 'Manage gallery' },
          ].map(({ icon, label, onClick, title }) => (
            <button key={label} type="button" onClick={onClick} className="btn btn-secondary" title={title} style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'0.82rem', height:'36px', padding:'0 14px' }}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="product-detail-main-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0, 500px) minmax(0, 1fr)', gap:'0', alignItems:'start', background:'var(--bg-surface-solid, #161B2C)', borderRadius:'20px', border:'1px solid var(--border-subtle)', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>

        {/* LEFT: IMAGE PANEL */}
        <div className="product-detail-media-panel" style={{ background:'var(--bg-main, #0B0E17)', borderRight:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column' }}>
          {/* Main image */}
          <div
            className="product-detail-image-box"
            style={{ position:'relative', aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', cursor: activeImage ? 'zoom-in' : 'default', background:'radial-gradient(ellipse at center, var(--bg-surface, #141829) 0%, var(--bg-main, #0B0E17) 100%)' }}
            onClick={() => { if (activeImage) setLightboxOpen(true); else onOpenImageModal?.(pItem); }}
          >
            {activeImage ? (
              <img src={activeImage.url} alt={pItem.name} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'28px', transition:'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform='scale(1.04)')} onMouseLeave={(e) => (e.currentTarget.style.transform='scale(1)')} />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', color:'var(--text-muted)' }}>
                <div style={{ width:'72px', height:'72px', borderRadius:'16px', background:'rgba(255,255,255,0.04)', border:'1px dashed var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ImageIcon size={32} style={{ opacity:0.3 }} />
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:'4px' }}>No Product Photo</div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Click to upload an image</div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); onOpenImageModal?.(pItem); }} className="btn btn-secondary btn-sm" style={{ borderRadius:'100px', fontSize:'0.78rem' }}>+ Upload Photo</button>
              </div>
            )}

            {/* Stock badge */}
            <div style={{ position:'absolute', top:'14px', left:'14px' }}>
              <Pill color={stockStatus.bg} textColor={stockStatus.color} border={stockStatus.border}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:stockStatus.color, flexShrink:0 }} />
                {stockStatus.label}
              </Pill>
            </div>

            {/* Zoom btn */}
            {activeImage && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                style={{ position:'absolute', top:'14px', right:'14px', width:'34px', height:'34px', borderRadius:'50%', background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)', transition:'all 0.15s ease' }}>
                <ZoomIn size={15} />
              </button>
            )}

            {/* Arrow nav */}
            {imageList.length > 1 && (
              <>
                <button type="button" onClick={prevImage} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'36px', height:'36px', borderRadius:'50%', background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={nextImage} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', width:'36px', height:'36px', borderRadius:'50%', background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                  <ChevronRightIcon size={16} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="product-detail-thumb-strip" style={{ display:'flex', gap:'8px', padding:'14px 16px', overflowX:'auto', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-surface, #141829)', scrollbarWidth:'thin', minHeight:'88px', alignItems:'center' }}>
            {imageList.map((img, idx) => {
              const active = idx === selectedImageIndex;
              return (
                <button key={img.id || idx} type="button" onClick={() => setSelectedImageIndex(idx)}
                  style={{ width:'60px', height:'60px', borderRadius:'10px', overflow:'hidden', border: active ? '2px solid var(--brand-primary)' : '2px solid transparent', background:'var(--bg-main)', cursor:'pointer', padding:0, flexShrink:0, transition:'all 0.15s ease', boxShadow: active ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none', outline:'none' }}>
                  <img src={img.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </button>
              );
            })}
            <button type="button" onClick={() => onOpenImageModal?.(pItem)}
              style={{ width:'60px', height:'60px', borderRadius:'10px', border:'1.5px dashed var(--border-subtle)', background:'transparent', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', transition:'all 0.15s ease', fontSize:'0.62rem', flexDirection:'column', gap:'3px' }}>
              <ImageIcon size={14} /><span>Add</span>
            </button>
          </div>

          {/* Description — below image, constrained to image panel width */}
          <div className="product-detail-desc-box" style={{ padding:'20px 20px 24px', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-main, #0B0E17)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <FileText size={13} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Description &amp; Notes</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={generatingAI}
                className="btn btn-sm"
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                  color: '#fff',
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
                title="Generate e-commerce description from photo using Gemini Vision"
              >
                <Sparkles size={12} className={generatingAI ? 'animate-spin' : ''} />
                <span>{generatingAI ? 'Generating...' : '✨ AI Generate'}</span>
              </button>
            </div>

            {aiError && (
              <div style={{ background:'rgba(239, 68, 68, 0.15)', border:'1px solid rgba(239, 68, 68, 0.3)', borderRadius:'8px', padding:'8px 12px', fontSize:'0.76rem', color:'#fca5a5', marginBottom:'10px' }}>
                {aiError}
              </div>
            )}

            {aiFeedback && (
              <div style={{ background:'rgba(16, 185, 129, 0.15)', border:'1px solid rgba(16, 185, 129, 0.3)', borderRadius:'8px', padding:'8px 12px', fontSize:'0.76rem', color:'#6ee7b7', marginBottom:'10px' }}>
                {aiFeedback}
              </div>
            )}

            {pItem.ai_description_draft && pItem.ai_description_draft !== pItem.description && (
              <div style={{ background:'rgba(99, 102, 241, 0.12)', border:'1px solid rgba(99, 102, 241, 0.3)', borderRadius:'10px', padding:'10px 12px', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                  <span style={{ fontSize:'0.74rem', fontWeight:700, color:'#c7d2fe', display:'flex', alignItems:'center', gap:'4px' }}>
                    <Sparkles size={13} style={{ color:'#a855f7' }} /> AI Draft Ready
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyDraft}
                    disabled={generatingAI}
                    style={{
                      background: '#10B981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Apply &amp; Overwrite
                  </button>
                </div>
                <div style={{ fontSize:'0.76rem', color:'#e2e8f0', maxHeight:'90px', overflowY:'auto', whiteSpace:'pre-wrap', lineHeight:1.5 }}>
                  {pItem.ai_description_draft}
                </div>
              </div>
            )}

            <div style={{ fontSize:'0.84rem', color: pItem.description ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word', overflowWrap:'break-word', fontStyle: pItem.description ? 'normal' : 'italic', minHeight:'48px' }}>
              {pItem.description || 'No description provided.'}
            </div>
          </div>
        </div>

        {/* RIGHT: INFO PANEL */}
        <div className="product-detail-info-panel" style={{ padding:'36px 40px', display:'flex', flexDirection:'column', gap:'28px', overflowY:'auto' }}>

          {/* Section 1: Identity */}
          <div className="product-detail-identity-sec">
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
              {primaryCategoryName && <Pill icon={<Tag size={11} />}>{primaryCategoryName}</Pill>}
              {pItem.subcategories?.map((sc) => {
                const isPrimary = pItem.primary_subcategory && String(pItem.primary_subcategory.id || pItem.primary_subcategory) === String(sc.id);
                return (
                  <Pill key={sc.id} color={isPrimary ? 'var(--brand-ruby-glow)' : 'var(--bg-main)'} textColor={isPrimary ? 'var(--brand-primary)' : 'var(--text-secondary)'} border={isPrimary ? 'var(--brand-primary)' : 'var(--border-subtle)'}>
                    {sc.name}
                  </Pill>
                );
              })}
            </div>

            <h1 className="product-detail-title" style={{ fontSize:'clamp(1.5rem, 3vw, 2.1rem)', fontWeight:800, color:'var(--text-primary)', lineHeight:1.2, margin:'0 0 10px 0', letterSpacing:'-0.025em' }}>{pItem.name}</h1>

            <div className="product-detail-meta-row" style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <div onClick={handleCopyUid} title="Click to copy barcode / UID" style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-main, #0B0E17)', border:'1px solid var(--border-subtle)', padding:'5px 12px', borderRadius:'8px', fontSize:'0.78rem', fontFamily:'monospace', color:'var(--text-secondary)', cursor:'pointer', transition:'all 0.15s ease', userSelect:'none' }}>
                <svg width="22" height="14" viewBox="0 0 22 14" style={{ flexShrink: 0 }}>
                  <rect x="0" y="0" width="2" height="14" fill="var(--brand-primary, #EC4899)" />
                  <rect x="3" y="0" width="1" height="14" fill="var(--text-secondary, #94A3B8)" />
                  <rect x="5" y="0" width="3" height="14" fill="var(--text-primary, #F8FAFC)" />
                  <rect x="9" y="0" width="1" height="14" fill="var(--text-secondary, #94A3B8)" />
                  <rect x="11" y="0" width="2" height="14" fill="var(--brand-primary, #EC4899)" />
                  <rect x="14" y="0" width="1" height="14" fill="var(--text-primary, #F8FAFC)" />
                  <rect x="16" y="0" width="2" height="14" fill="var(--text-secondary, #94A3B8)" />
                  <rect x="19" y="0" width="3" height="14" fill="var(--brand-primary, #EC4899)" />
                </svg>
                <span style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{pItem.uid || 'No UID'}</span>
                {copiedUid ? <Check size={13} style={{ color:'#34D399' }} /> : <Copy size={13} style={{ opacity:0.5 }} />}
              </div>
              <Pill color="rgba(59,130,246,0.1)" textColor="#60A5FA" border="rgba(59,130,246,0.25)" icon={<StoreIcon size={11} />}>{storeName}</Pill>
              {pItem.location_section && <Pill icon={<MapPin size={11} style={{ color:'var(--brand-primary)' }} />}>Section: <strong style={{ marginLeft:'2px' }}>{pItem.location_section}</strong></Pill>}
            </div>
          </div>

          <div style={{ height:'1px', background:'var(--border-subtle)' }} />

          {/* Section 2: Pricing */}
          <div className="product-detail-pricing-sec">
            <div className="product-detail-price-display" style={{ display:'flex', alignItems:'flex-end', gap:'16px', flexWrap:'wrap', marginBottom:'6px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'2px' }}>
                <span style={{ fontSize:'1.3rem', fontWeight:700, color:'#34D399', marginTop:'4px', lineHeight:1 }}>{currencySymbol}</span>
                <span className="product-detail-price-main" style={{ fontSize:'3rem', fontWeight:900, color:'#34D399', lineHeight:1, letterSpacing:'-0.03em' }}>{sellingPrice.toFixed(2)}</span>
              </div>
              {mrp && mrp > sellingPrice && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingBottom:'6px' }}>
                  <span style={{ fontSize:'1rem', color:'var(--text-muted)', textDecoration:'line-through' }}>{currencySymbol}{mrp.toFixed(2)}</span>
                  <span style={{ fontSize:'0.74rem', fontWeight:700, background:'rgba(16,185,129,0.15)', color:'#34D399', padding:'3px 9px', borderRadius:'100px', border:'1px solid rgba(16,185,129,0.3)' }}>{discountPct}% OFF</span>
                </div>
              )}
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'20px' }}>Retail Selling Price</div>
            <div className="product-detail-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px' }}>
              <StatCard label="Cost Price" value={`${currencySymbol}${costPrice.toFixed(2)}`} sub="Purchase cost" />
              <StatCard label="Gross Profit" value={grossProfit >= 0 ? `+${currencySymbol}${grossProfit.toFixed(2)}` : `-${currencySymbol}${Math.abs(grossProfit).toFixed(2)}`} valueColor={grossProfit >= 0 ? '#34D399' : '#F87171'} sub="Per unit" />
              <StatCard label="Markup" value={`${marginPct}%`} valueColor={parseFloat(marginPct) >= 20 ? '#34D399' : '#60A5FA'} sub="On cost price" />
            </div>
          </div>

          <div style={{ height:'1px', background:'var(--border-subtle)' }} />

          {/* Section 3: Specs */}
          <div className="product-detail-specs-sec">
            <h3 style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 4px 0' }}>Specifications &amp; Logistics</h3>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <SpecRow icon={<Scale size={15} />} label="Weight" value={pItem.weight ? `${pItem.weight} g` : null} accent="#FBBF24" />
              <SpecRow icon={<Ruler size={15} />} label="Dimensions (L x W x H)" value={volMetrics.dimensionsStr || null} accent="#60A5FA" />
              <SpecRow icon={<Box size={15} />} label="Volume" value={volMetrics.volumeCm3 ? `${volMetrics.volumeCm3} cm3  -  ${volMetrics.volumeLiters} L` : null} accent="#34D399" />
              <SpecRow icon={<Truck size={15} />} label="Volumetric Weight (shipping)" value={volMetrics.volumetricWeightKg ? `${volMetrics.volumetricWeightKg} kg` : null} accent="#A78BFA" />
              <SpecRow icon={<Package size={15} />} label="Supplier / Vendor" value={supplierName || null} accent="#F472B6" />
            </div>
          </div>



          {/* Footer meta */}
          <div className="product-detail-footer-meta" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', paddingTop:'4px' }}>
            {pItem.expiry_date ? (
              <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'0.78rem', fontWeight:600, color:'#FBBF24', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', padding:'5px 12px', borderRadius:'100px' }}>
                <Calendar size={12} /> Expires: {pItem.expiry_date}
              </div>
            ) : (
              <span style={{ fontSize:'0.76rem', color:'var(--text-muted)', fontStyle:'italic' }}>No expiration date</span>
            )}
            {pItem.created_at && <span style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>Added {new Date(pItem.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</span>}
          </div>
        </div>
      </div>

      {/* PRODUCT VARIANTS & BATCHES MATRIX */}
      <div className="product-variants-card" style={{ marginTop:'28px', padding:'24px', borderRadius:'16px', background:'var(--bg-surface, #111422)', border:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'rgba(245, 158, 11, 0.15)', border:'1px solid rgba(245, 158, 11, 0.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-warning)' }}>
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:700, color:'var(--text-primary)' }}>
                Product Variants &amp; Batches {variants.length > 0 ? `(${variants.length})` : ''}
              </h3>
              <p style={{ margin:'2px 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
                Different batches, expiry dates, suppliers, or price tiers for this product family.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenEditModal?.(pItem)}
            style={{ display:'flex', alignItems:'center', gap:'6px' }}
          >
            <Layers size={14} />
            <span>Manage / Add Variant</span>
          </button>
        </div>

        {loadingVariants && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem' }}>
            Loading sibling variants…
          </div>
        )}

        {!loadingVariants && variantsError && (
          <div style={{ padding:'12px 16px', background:'var(--color-danger-bg)', color:'var(--color-danger)', borderRadius:'var(--radius-md)', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'8px' }}>
            <AlertTriangle size={15} /> {variantsError}
          </div>
        )}

        {!loadingVariants && !variantsError && variants.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', border:'1px dashed var(--border-subtle)', borderRadius:'12px' }}>
            No variants created for this product yet. Click "Manage / Add Variant" to create batches or variations.
          </div>
        )}

        {!loadingVariants && variants.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem', textAlign:'left' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border-subtle)', color:'var(--text-muted)', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <th style={{ padding:'10px 14px' }}>Variant / Batch</th>
                  <th style={{ padding:'10px 14px' }}>Barcode (UID)</th>
                  <th style={{ padding:'10px 14px' }}>Stock</th>
                  <th style={{ padding:'10px 14px' }}>Selling Price</th>
                  <th style={{ padding:'10px 14px' }}>Cost Price</th>
                  <th style={{ padding:'10px 14px' }}>Expiry</th>
                  <th style={{ padding:'10px 14px' }}>Location</th>
                  <th style={{ padding:'10px 14px', textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const isCurrent = v.id === pItem.id;
                  const isExpired = v.expiry_date && new Date(v.expiry_date) <= new Date();
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom:'1px solid var(--border-subtle)',
                        background: isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        transition:'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding:'12px 14px', fontWeight:600 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          {v.primary_image_url && (
                            <img src={v.primary_image_url} alt="" style={{ width:'28px', height:'28px', borderRadius:'4px', objectFit:'cover' }} />
                          )}
                          <div>
                            <span style={{ color: isCurrent ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                              {v.variant_name || v.name}
                            </span>
                            {v.is_master_variant && (
                              <span style={{ marginLeft:'6px', background:'var(--brand-primary)', color:'#fff', borderRadius:'999px', fontSize:'0.62rem', padding:'1px 6px', fontWeight:700 }}>
                                ORIGINAL
                              </span>
                            )}
                            {isCurrent && (
                              <span style={{ marginLeft:'6px', background:'rgba(99,102,241,0.2)', color:'var(--brand-primary)', borderRadius:'999px', fontSize:'0.62rem', padding:'1px 6px', fontWeight:700 }}>
                                VIEWING
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px', fontFamily:'monospace', color:'var(--text-muted)' }}>
                        {v.uid}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ fontWeight:700, color: v.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {v.quantity}
                        </span>
                      </td>
                      <td style={{ padding:'12px 14px', fontWeight:600 }}>
                        {currencySymbol}{v.selling_price}
                      </td>
                      <td style={{ padding:'12px 14px', color:'var(--text-muted)' }}>
                        {currencySymbol}{v.cost_price || '0.00'}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {v.expiry_date ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'100px', fontSize:'0.74rem', background: isExpired ? 'var(--color-danger-bg)' : 'rgba(245,158,11,0.1)', color: isExpired ? 'var(--color-danger)' : '#FBBF24', border: `1px solid ${isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                            <Calendar size={11} /> {v.expiry_date} {isExpired ? '⚠️' : ''}
                          </span>
                        ) : (
                          <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding:'12px 14px', color:'var(--text-muted)' }}>
                        {v.location_section || '—'}
                      </td>
                      <td style={{ padding:'12px 14px', textAlign:'right' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                          {!isCurrent ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding:'4px 8px', fontSize:'0.75rem' }}
                              onClick={() => {
                                fetchItem(v.id)
                                  .then((full) => {
                                    setPItem(full);
                                    onUpdateItem?.(full);
                                  })
                                  .catch(() => {
                                    setPItem(v);
                                  });
                              }}
                            >
                              Switch View
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding:'4px 8px', fontSize:'0.75rem' }}
                              onClick={() => onOpenEditModal?.(v)}
                            >
                              <Edit size={12} style={{ marginRight:4 }} /> Edit
                            </button>
                          )}
                          {!isCurrent && (
                            <button
                              type="button"
                              title="Delete variant"
                              className="btn btn-sm"
                              style={{ padding:'4px 6px', background:'transparent', color:'var(--color-danger)', border:'1px solid rgba(239, 68, 68, 0.3)' }}
                              onClick={async () => {
                                if (!window.confirm(`Are you sure you want to delete variant "${v.variant_name || v.uid}"?`)) return;
                                try {
                                  await deleteItem(v.id);
                                  const refreshed = await fetchItemVariants(pItem.id);
                                  setVariants(refreshed.variants || []);
                                } catch (err) {
                                  alert(`Failed to delete variant: ${err.message}`);
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRODUCT SALES VELOCITY & QUANTITY SOLD CHART */}
      <ProductQuantitySalesChart
        item={pItem}
        timeline={analytics?.timeline}
        performance={analytics?.performance}
        currencySymbol={currencySymbol}
      />

      {/* PRODUCT PRICE HISTORY & MARGIN TRAJECTORY CHART */}
      <ProductPriceHistoryChart
        item={pItem}
        timeline={analytics?.timeline}
        priceHistory={analytics?.price_history}
        currencySymbol={currencySymbol}
      />

      {/* PRODUCT PERFORMANCE & RANKING CARD */}
      <ProductRankingCard
        item={pItem}
        analytics={analytics}
        loading={analyticsLoading}
        currencySymbol={currencySymbol}
      />

      {/* OPERATIONS & ACTIVITY LEDGERS (ORDERS, AUDIT TRAIL, RESTOCK VALUATION) */}
      <ProductActivityLedgers
        item={pItem}
        analytics={analytics}
        currencySymbol={currencySymbol}
      />

      {/* LIGHTBOX */}
      {lightboxOpen && activeImage && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'24px' }} onClick={() => setLightboxOpen(false)}>
          <button type="button" onClick={() => setLightboxOpen(false)} style={{ position:'absolute', top:'20px', right:'20px', width:'42px', height:'42px', borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={20} />
          </button>
          {imageList.length > 1 && (
            <>
              <button type="button" onClick={prevImage} style={{ position:'absolute', left:'20px', top:'50%', transform:'translateY(-50%)', width:'44px', height:'44px', borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={20} /></button>
              <button type="button" onClick={nextImage} style={{ position:'absolute', right:'20px', top:'50%', transform:'translateY(-50%)', width:'44px', height:'44px', borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRightIcon size={20} /></button>
            </>
          )}
          <img src={activeImage.url} alt={pItem.name} style={{ maxWidth:'88vw', maxHeight:'84vh', objectFit:'contain', borderRadius:'16px', boxShadow:'0 40px 80px rgba(0,0,0,0.7)' }} onClick={(e) => e.stopPropagation()} />
          {imageList.length > 1 && (
            <div style={{ position:'absolute', bottom:'24px', left:'50%', transform:'translateX(-50%)', display:'flex', gap:'6px' }}>
              {imageList.map((_, i) => (
                <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(i); }}
                  style={{ width: i === selectedImageIndex ? '22px' : '7px', height:'7px', borderRadius:'100px', background: i === selectedImageIndex ? '#fff' : 'rgba(255,255,255,0.3)', border:'none', cursor:'pointer', padding:0, transition:'all 0.2s ease' }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
