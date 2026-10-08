import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Settings,
  Layers,
} from 'lucide-react';
import { getBarcodeUrl, updateItem } from '../api';

export default function BarcodeModal({ item, onClose, onUpdateItem }) {
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [copies, setCopies] = useState(2);
  const [labelFormat, setLabelFormat] = useState('38x25_2up'); // '38x25_2up' | '38x25_1up' | 'standard'
  const [autoMarkPrinted, setAutoMarkPrinted] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [printFeedback, setPrintFeedback] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (!item) return null;

  const barcodeUrl = `${getBarcodeUrl(item.id, false)}?v=ocrb1`;
  const downloadUrl = getBarcodeUrl(item.id, true);

  // Preload barcode image
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    const img = new Image();
    img.src = barcodeUrl;
    img.onload = () => setImageLoaded(true);
    img.onerror = () => {
      setImageLoaded(false);
      setImageError(true);
    };
  }, [barcodeUrl]);

  const handlePrint = async () => {
    if (!imageLoaded && !imageError) {
      setPrintFeedback('Preparing barcode image for crisp printing...');
      await new Promise((r) => setTimeout(r, 400));
    }

    if (autoMarkPrinted && item.needs_new_barcode_printed) {
      setMarkingPrinted(true);
      try {
        const updated = await updateItem(item.id, { needs_new_barcode_printed: false });
        onUpdateItem?.(updated);
        setPrintFeedback('Barcode label marked as printed!');
      } catch (err) {
        console.warn('Auto-mark printed warning:', err);
      } finally {
        setMarkingPrinted(false);
      }
    }

    window.print();
  };

  const handleManualMarkPrinted = async () => {
    setMarkingPrinted(true);
    try {
      const updated = await updateItem(item.id, { needs_new_barcode_printed: false });
      onUpdateItem?.(updated);
      setPrintFeedback('Successfully updated barcode status to ready!');
    } catch (err) {
      alert(`Error updating print status: ${err.message}`);
    } finally {
      setMarkingPrinted(false);
    }
  };

  // ---------------- Renderers for Different Label Presets ----------------

  // 1. Single 38mm x 25mm Compact Sticker (used in 2UP and 1UP)
  const renderSticker38x25 = (keyIndex = 0, isGhost = false) => {
    if (isGhost) {
      return (
        <div
          key={keyIndex}
          className="barcode-sticker-38x25"
          style={{
            opacity: 0.25,
            borderStyle: 'dashed',
            visibility: 'hidden',
          }}
        />
      );
    }

    return (
      <div
        key={keyIndex}
        className="barcode-sticker-38x25"
        style={{
          background: '#FFFFFF',
          color: '#000000',
          border: '1px solid #1E293B',
          borderRadius: '3px',
          padding: '2px 4px',
          textAlign: 'center',
          boxSizing: 'border-box',
          width: '38mm',
          height: '24.5mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* Header: Vector Logo + Brand Name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3.5px',
            lineHeight: 1.1,
            overflow: 'hidden',
          }}
        >
          <img
            src="/assets/logo.svg"
            alt="Logo"
            className="barcode-logo-img"
            style={{ height: '11px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: '8px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: '#C52224',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            WONDERSALE
          </span>
        </div>

        {/* Product Title (Max 2 lines with ellipsis) */}
        <div
          style={{
            fontSize: '9.2px',
            fontWeight: 800,
            color: '#0F172A',
            lineHeight: 1.15,
            maxHeight: '2.3em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
            flexShrink: 0,
          }}
          title={item.name}
        >
          {item.name}
        </div>

        {/* Price & MRP Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            lineHeight: 1.1,
          }}
        >
          <span style={{ fontSize: '10px', color: '#0F172A', display: 'inline-flex', alignItems: 'baseline' }}>
            <span
              className="barcode-currency-symbol"
              style={{
                fontSize: '10px',
                fontWeight: 400,
                marginRight: '1.5px',
                lineHeight: 1,
              }}
            >
              ₹
            </span>
            <span
              className="barcode-price-value"
              style={{
                fontFamily: "'OCR-B', 'OCRB', monospace",
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {parseFloat(item.selling_price || 0).toFixed(2)}
            </span>
          </span>
          {item.mrp && parseFloat(item.mrp) > parseFloat(item.selling_price) && (
            <span style={{ fontSize: '6.5px', color: '#64748B', textDecoration: 'line-through', display: 'inline-flex', alignItems: 'baseline' }}>
              <span>MRP:&nbsp;</span>
              <span className="barcode-currency-symbol" style={{ fontSize: '6.5px', fontWeight: 400 }}>₹</span>
              <span
                className="barcode-price-value"
                style={{
                  fontFamily: "'OCR-B', 'OCRB', monospace",
                  fontWeight: 700,
                }}
              >
                {parseFloat(item.mrp).toFixed(2)}
              </span>
            </span>
          )}
        </div>

        {/* Barcode Graphic (Wider Barcode with Increased UID Spacing) */}
        <div
          className="barcode-graphic-box"
          style={{
            background: '#FFFFFF',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '11mm',
            width: '100%',
            overflow: 'hidden',
            margin: '0 auto',
          }}
        >
          {imageError ? (
            <div style={{ fontSize: '6px', color: '#EF4444' }}>Barcode error</div>
          ) : !imageLoaded ? (
            <div style={{ fontSize: '6px', color: '#64748B' }}>Loading...</div>
          ) : (
            <img
              src={barcodeUrl}
              alt=""
              className="barcode-code-img"
              style={{
                width: '100%',
                maxWidth: '100%',
                height: '10.8mm',
                objectFit: 'contain',
                imageRendering: 'crisp-edges',
              }}
            />
          )}
        </div>

        {/* Footer: Location shifted in the middle */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '6.5px',
            fontWeight: 700,
            color: '#334155',
            lineHeight: 1.1,
            borderTop: '0.5px dashed #CBD5E1',
            paddingTop: '1px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.location_section || item.store_details?.name || 'General Store'}
        </div>
      </div>
    );
  };

  // 2. Standard 3.5in x 1.5in Tag (For regular desktop printers)
  const renderStandardSticker = (keyIndex = 0) => (
    <div
      key={keyIndex}
      className="barcode-single-sticker"
      style={{
        background: '#FFFFFF',
        color: '#000000',
        border: '2px solid #0F172A',
        borderRadius: '8px',
        padding: '16px 20px',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        margin: '0 auto',
        maxWidth: '360px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header: Vector Logo + Brand Name (Slightly Bigger) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '5px',
        }}
      >
        <img
          src="/assets/logo.svg"
          alt="Logo"
          className="barcode-logo-img"
          style={{ height: '22px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 900,
            letterSpacing: '0.12em',
            color: '#C52224',
            textTransform: 'uppercase',
          }}
        >
          WONDERSALE
        </span>
      </div>

      <div
        style={{
          fontSize: '1.06rem',
          fontWeight: 800,
          color: '#0F172A',
          marginBottom: '6px',
          lineHeight: 1.25,
          maxHeight: '2.5em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}
        title={item.name}
      >
        {item.name}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '1.25rem', color: '#0F172A', display: 'inline-flex', alignItems: 'baseline' }}>
          <span
            className="barcode-currency-symbol"
            style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              marginRight: '3px',
              lineHeight: 1,
            }}
          >
            ₹
          </span>
          <span
            className="barcode-price-value"
            style={{
              fontFamily: "'OCR-B', 'OCRB', monospace",
              fontWeight: 700,
              letterSpacing: '0.03em',
            }}
          >
            {parseFloat(item.selling_price || 0).toFixed(2)}
          </span>
        </span>
        {item.mrp && parseFloat(item.mrp) > parseFloat(item.selling_price) && (
          <span style={{ fontSize: '0.85rem', color: '#64748B', textDecoration: 'line-through', display: 'inline-flex', alignItems: 'baseline' }}>
            <span>MRP:&nbsp;</span>
            <span className="barcode-currency-symbol" style={{ fontSize: '0.85rem', fontWeight: 400 }}>₹</span>
            <span
              className="barcode-price-value"
              style={{
                fontFamily: "'OCR-B', 'OCRB', monospace",
                fontWeight: 700,
              }}
            >
              {parseFloat(item.mrp).toFixed(2)}
            </span>
          </span>
        )}
      </div>

      {/* Barcode Graphic (Enlarged with bold UID) */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '2px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '102px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {imageError ? (
          <div style={{ fontSize: '0.85rem', color: '#EF4444' }}>Barcode error</div>
        ) : !imageLoaded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.8rem' }}>
            <Loader2 size={16} className="spin" />
            <span>Generating barcode...</span>
          </div>
        ) : (
          <img
            src={barcodeUrl}
            alt=""
            className="barcode-code-img"
            style={{
              width: '100%',
              maxWidth: '100%',
              height: '100px',
              objectFit: 'contain',
              imageRendering: 'crisp-edges',
            }}
          />
        )}
      </div>

      {/* Footer: Location in the middle */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.74rem',
          fontWeight: 700,
          color: '#475569',
          marginTop: '6px',
          borderTop: '1px dashed #CBD5E1',
          paddingTop: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.location_section || item.store_details?.name || 'General Store'}
      </div>
    </div>
  );

  // 3. Helper to build 2UP rows (2 stickers per row across 80mm width)
  const render2UpRows = () => {
    const totalRows = Math.ceil(copies / 2);
    const rows = [];
    for (let r = 0; r < totalRows; r++) {
      const leftIndex = r * 2;
      const rightIndex = r * 2 + 1;
      const hasRight = rightIndex < copies;

      rows.push(
        <div
          key={`row-${r}`}
          className="barcode-2up-row"
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '80mm',
            height: '25mm',
            margin: '0 auto 8px auto',
            boxSizing: 'border-box',
          }}
        >
          {renderSticker38x25(leftIndex, false)}
          {hasRight ? renderSticker38x25(rightIndex, false) : renderSticker38x25(rightIndex, true)}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="modal-overlay barcode-modal-backdrop" onClick={onClose}>
      {/* Inject precise print page size according to the active label preset */}
      <style>{`
        @media print {
          @page {
            size: ${labelFormat === '38x25_2up' ? '80mm 25mm' : labelFormat === '38x25_1up' ? '38mm 25mm' : '3.5in 1.5in'};
            margin: 0;
          }
          #printable-barcode-label {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: ${labelFormat === '38x25_2up' ? '80mm' : labelFormat === '38x25_1up' ? '38mm' : '3.5in'} !important;
            max-width: ${labelFormat === '38x25_2up' ? '80mm' : labelFormat === '38x25_1up' ? '38mm' : '3.5in'} !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            border: none !important;
            box-shadow: none !important;
            min-height: 0 !important;
          }
        }
      `}</style>

      <div className="modal-content barcode-modal-card" style={{ maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          className="no-print"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Print Barcode Label</span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              TVS LP 46 Neo • 38×25mm (2UP) Thermal Transfer Chromo Roll
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="barcode-modal-body" style={{ padding: '22px 24px' }}>
          {/* Status Alert if item was flagged for printing */}
          {item.needs_new_barcode_printed && (
            <div
              className="no-print"
              style={{
                padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  This product needs a fresh barcode label printed.
                </span>
              </div>
              <button
                type="button"
                onClick={handleManualMarkPrinted}
                disabled={markingPrinted}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                {markingPrinted ? 'Updating...' : 'Mark Printed'}
              </button>
            </div>
          )}

          {printFeedback && (
            <div
              className="no-print"
              style={{
                padding: '10px 14px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.84rem',
                color: '#22C55E',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{printFeedback}</span>
            </div>
          )}

          {/* Roll Preset Selector */}
          <div
            className="no-print"
            style={{
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Select Roll & Label Format:
              </label>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <HelpCircle size={13} />
                <span>TVS LP 46 Setup Instructions</span>
                {showSetupGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setLabelFormat('38x25_2up')}
                className={`btn btn-sm ${labelFormat === '38x25_2up' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  border: labelFormat === '38x25_2up' ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontWeight: 800 }}>38×25mm (2UP Roll)</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>TVS LP 46 Neo (Your Roll)</span>
              </button>

              <button
                type="button"
                onClick={() => setLabelFormat('38x25_1up')}
                className={`btn btn-sm ${labelFormat === '38x25_1up' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  lineHeight: 1.2,
                  textAlign: 'center',
                }}
              >
                <span style={{ fontWeight: 800 }}>38×25mm (1UP)</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>Single Column Roll</span>
              </button>

              <button
                type="button"
                onClick={() => setLabelFormat('standard')}
                className={`btn btn-sm ${labelFormat === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  lineHeight: 1.2,
                  textAlign: 'center',
                }}
              >
                <span style={{ fontWeight: 800 }}>Standard Tag</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>3.5" × 1.5" Large View</span>
              </button>
            </div>
          </div>

          {/* Expandable TVS LP 46 Neo Setup Guide */}
          {showSetupGuide && (
            <div
              className="no-print"
              style={{
                marginBottom: '18px',
                padding: '16px',
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={15} style={{ color: 'var(--brand-primary)' }} />
                <span>How to Setup TVS LP 46 Neo for 38×25 (2UP) Chromo Roll:</span>
              </div>
              <ol style={{ paddingLeft: '18px', margin: 0, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>1. Driver Installation:</strong> Install the official <em>TVS LP 46 Neo Windows Driver (Seagull Scientific)</em> from TVS Electronics website so Windows detects the printer properly.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>2. Create 38×25 (2UP) Page Size:</strong> Open Windows <em>Printers & Scanners &gt; TVS LP 46 Neo &gt; Printing Preferences &gt; Page Setup &gt; Stock &gt; New</em>:
                  <ul style={{ paddingLeft: '16px', marginTop: '2px' }}>
                    <li>Stock Name: <code>38x25_2UP</code></li>
                    <li>Width: <code>80.0 mm</code> (covers both labels + 2mm gap + margins)</li>
                    <li>Height: <code>25.0 mm</code></li>
                  </ul>
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>3. Media & Sensor Settings:</strong> Under <em>Stock / Sensor</em> tab:
                  <ul style={{ paddingLeft: '16px', marginTop: '2px' }}>
                    <li>Method: <code>Thermal Transfer</code> (since your roll says <strong>PAPER: CHROMO</strong>, which requires a carbon/wax ribbon)</li>
                    <li>Sensor Type: <code>Die-Cut Gap / Transmissive</code> (Gap Height: <code>2.0 mm - 3.0 mm</code>)</li>
                  </ul>
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>4. Browser Print Settings:</strong> When print dialog opens:
                  <ul style={{ paddingLeft: '16px', marginTop: '2px' }}>
                    <li>Destination: <strong>TVS LP 46 Neo</strong></li>
                    <li>Paper Size: <strong>38x25_2UP (80x25mm)</strong></li>
                    <li>Margins: <strong>None (0mm)</strong> | Scale: <strong>100%</strong> | Headers/Footers: <strong>Off</strong></li>
                  </ul>
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>5. Gap Calibration Tip:</strong> If the printer spits out extra blank stickers, turn off the printer, hold the <code>FEED / PAUSE</code> button, and turn it back on until it beeps to auto-calibrate the gap sensor.
                </li>
              </ol>
            </div>
          )}

          {/* Printable Container (Rendered on Screen Preview & Isolated for @media print) */}
          <div
            id="printable-barcode-label"
            data-format={labelFormat}
            style={{
              padding: '16px',
              background: 'var(--bg-main)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
            }}
          >
            {labelFormat === '38x25_2up' ? (
              render2UpRows()
            ) : labelFormat === '38x25_1up' ? (
              <div className="barcode-1up-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: copies }).map((_, idx) => renderSticker38x25(idx, false))}
              </div>
            ) : (
              <div className="barcode-standard-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from({ length: copies }).map((_, idx) => renderStandardSticker(idx))}
              </div>
            )}
          </div>

          {/* Print Controls (No Print) */}
          <div
            className="no-print"
            style={{
              marginTop: '18px',
              background: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Copies Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Number of Sticker Copies:
                </span>
                {labelFormat === '38x25_2up' && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ({Math.ceil(copies / 2)} row{Math.ceil(copies / 2) > 1 ? 's' : ''} on 2UP roll)
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.max(1, c - (labelFormat === '38x25_2up' ? 2 : 1)))}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '28px', height: '28px' }}
                  disabled={copies <= 1}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCopies(isNaN(v) || v < 1 ? 1 : Math.min(100, v));
                  }}
                  className="form-input mono"
                  style={{ width: '54px', height: '28px', textAlign: 'center', padding: '2px', fontWeight: 800 }}
                />
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.min(100, c + (labelFormat === '38x25_2up' ? 2 : 1)))}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '28px', height: '28px' }}
                >
                  <Plus size={14} />
                </button>
                {item.quantity > 0 && item.quantity !== copies && (
                  <button
                    type="button"
                    onClick={() => setCopies(Math.min(100, item.quantity))}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '3px 8px', height: '28px' }}
                    title="Set copies equal to current stock quantity"
                  >
                    Stock ({item.quantity})
                  </button>
                )}
              </div>
            </div>

            {/* Auto-mark as printed checkbox */}
            {item.needs_new_barcode_printed && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoMarkPrinted}
                  onChange={(e) => setAutoMarkPrinted(e.target.checked)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--brand-primary)' }}
                />
                <span>Automatically mark label as printed upon clicking Print</span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginTop: '18px',
            }}
          >
            <button
              type="button"
              onClick={handlePrint}
              disabled={markingPrinted}
              className="btn btn-primary"
              style={{
                flex: 1.2,
                padding: '11px 18px',
                fontSize: '0.92rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Printer size={18} />
              <span>Print {copies > 1 ? `${copies} Labels` : 'Label'} ({labelFormat === '38x25_2up' ? '38×25 2UP' : labelFormat})</span>
            </button>
            <a
              href={downloadUrl}
              download={`barcode_${item.uid}.png`}
              className="btn btn-secondary"
              style={{
                flex: 0.8,
                padding: '11px 16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Download size={17} />
              <span>Download PNG</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
