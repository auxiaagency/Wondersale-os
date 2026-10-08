import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Upload,
  Camera,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  Layers,
  Wand2,
  Truck,
  ChevronDown,
} from 'lucide-react';
import { extractProductsFromBill } from '../api';

export default function ScanBillModal({
  isOpen = false,
  onClose,
  onExtractSuccess,
  subcategories = [],
  suppliers = [],
  effectiveStoreId = '',
  onOpenSettings,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [keysTriedCount, setKeysTriedCount] = useState(0);
  const [customRequest, setCustomRequest] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Camera Capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment'); // 'user' or 'environment'
  const [multipleCamerasAvailable, setMultipleCamerasAvailable] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Retrieve saved Gemini API keys from localStorage
  const getSavedApiKeys = () => {
    try {
      const raw = localStorage.getItem('wondersale_gemini_api_keys');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((k) => (typeof k === 'string' ? k : k.key)).filter(Boolean);
        }
      }
    } catch (e) {}
    return [];
  };

  // Check camera device count
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setMultipleCamerasAvailable(videoDevices.length > 1);
        })
        .catch(() => {});
    }
  }, []);

  // Handle Camera streaming
  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraActive, cameraFacingMode]);

  const startCamera = async () => {
    try {
      stopCamera();
      const constraints = {
        video: {
          facingMode: cameraFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setError('Could not access camera. Please check permissions or upload an image.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera_bill_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        setSelectedFiles((prev) => [...prev, file]);
        setFilePreviews((prev) => [...prev, { name: file.name, url: previewUrl, isPdf: false }]);
        setIsCameraActive(false);
        setError('');
      },
      'image/jpeg',
      0.95
    );
  };

  const handleSwitchCamera = () => {
    setCameraFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setQuotaExhausted(false);

    const newFiles = Array.from(files);
    const valid = [];
    const previews = [];

    newFiles.forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name);

      if (!isPdf && !isImage) {
        setError('Please upload only image files (JPEG, PNG, WEBP, HEIC) or PDF bills.');
        return;
      }

      valid.push(file);
      previews.push({
        name: file.name,
        url: isPdf ? null : URL.createObjectURL(file),
        isPdf,
        size: (file.size / 1024).toFixed(1),
      });
    });

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
      setFilePreviews((prev) => [...prev, ...previews]);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleClearAll = () => {
    filePreviews.forEach((p) => {
      if (p.url) URL.revokeObjectURL(p.url);
    });
    setSelectedFiles([]);
    setFilePreviews([]);
    setError('');
    setQuotaExhausted(false);
  };

  const handleProcessBill = async () => {
    if (selectedFiles.length === 0) {
      setError('Please add at least one bill photo or PDF document.');
      return;
    }

    setLoading(true);
    setError('');
    setQuotaExhausted(false);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => {
        formData.append('files', f);
      });

      const apiKeys = getSavedApiKeys();
      formData.append('api_keys', JSON.stringify(apiKeys));
      if (effectiveStoreId) {
        formData.append('store', effectiveStoreId);
      }
      if (customRequest && customRequest.trim()) {
        formData.append('custom_request', customRequest.trim());
      }

      const response = await extractProductsFromBill(formData);

      if (!response.items || response.items.length === 0) {
        setError('Gemini AI could not detect any readable product items in the provided bill. Please try with a clearer photo.');
        return;
      }

      if (selectedSupplierId === 'NONE') {
        response.bill_metadata = response.bill_metadata || {};
        response.bill_metadata.matched_supplier_id = '';
        response.bill_metadata.matched_supplier_name = '';
        if (response.items) {
          response.items.forEach((item) => {
            item.supplier_id = '';
            item.supplier_name = '';
          });
        }
      } else if (selectedSupplierId) {
        response.bill_metadata = response.bill_metadata || {};
        response.bill_metadata.matched_supplier_id = selectedSupplierId;
        const matchedSup = suppliers.find((s) => String(s.id) === String(selectedSupplierId));
        response.bill_metadata.matched_supplier_name = matchedSup?.name || '';
        if (response.items) {
          response.items.forEach((item) => {
            item.supplier_id = selectedSupplierId;
            item.supplier_name = matchedSup?.name || '';
          });
        }
      }

      onExtractSuccess?.(response.items, response.bill_metadata, response.ai_stats);
      handleClearAll();
      onClose();
    } catch (err) {
      console.error('Bill OCR Extraction error:', err);
      const isQuota = err.quotaExhausted || err.status === 429;
      setQuotaExhausted(isQuota);
      setKeysTriedCount(err.keysTried || 1);
      setError(
        err.message ||
          'Failed to extract bill data. If rate limits are reached, please add another Gemini API key in Settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  if (!isOpen) return null;

  const savedKeysCount = getSavedApiKeys().length;

  return (
    <div
      className="scan-bill-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel scan-bill-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="scan-bill-modal-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-solid, #161B2C)',
          }}
        >
          <div className="scan-bill-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="scan-bill-header-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(218, 41, 28, 0.2), rgba(168, 85, 247, 0.2))',
                color: '#EC4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(236, 72, 153, 0.3)',
              }}
            >
              <Sparkles size={22} style={{ color: '#F472B6' }} />
            </div>
            <div>
              <h2 className="scan-bill-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Scan Bill / Invoice
              </h2>
              <p className="scan-bill-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                AI converts messy handwritten bills &amp; supplier invoices into staged inventory items with live confidence indicators.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon scan-bill-close-btn"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="scan-bill-modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* API Key Status & Settings Helper Bar */}
          <div
            className="scan-bill-api-bar"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div className="scan-bill-api-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={15} style={{ color: 'var(--color-success)' }} />
              <span>
                Gemini Engine: <strong>{savedKeysCount} Key{savedKeysCount > 1 ? 's' : ''} Ready</strong> (Auto-Rotation Active)
              </span>
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="btn btn-secondary btn-sm scan-bill-api-btn"
                style={{
                  fontSize: '0.74rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                }}
              >
                <Settings size={12} />
                <span>Manage API Keys in Settings</span>
              </button>
            )}
          </div>

          {/* Camera View Mode */}
          {isCameraActive ? (
            <div
              className="scan-bill-camera-container"
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: '#000000',
                border: '2px solid var(--brand-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="scan-bill-camera-video"
                style={{ width: '100%', maxHeight: '340px', objectFit: 'contain' }}
              />

              {/* Camera Action Overlay Bar */}
              <div
                className="scan-bill-camera-controls"
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  left: '0',
                  right: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCameraActive(false)}
                  className="btn btn-secondary btn-sm scan-bill-camera-cancel"
                  style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  className="btn btn-primary scan-bill-camera-shutter"
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px var(--brand-primary)',
                  }}
                  title="Capture Photo"
                >
                  <Camera size={26} />
                </button>

                {multipleCamerasAvailable && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="btn btn-secondary btn-sm scan-bill-camera-switch"
                    style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                    title="Switch Camera"
                  >
                    <RefreshCw size={14} />
                    <span>Switch</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Upload / Drop Area */
            <div
              className="scan-bill-dropzone"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '30px 20px',
                border: dragActive
                  ? '2px dashed var(--brand-primary)'
                  : selectedFiles.length > 0
                  ? '2px solid rgba(16, 185, 129, 0.5)'
                  : '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                background: dragActive
                  ? 'rgba(218, 41, 28, 0.08)'
                  : selectedFiles.length > 0
                  ? 'rgba(16, 185, 129, 0.04)'
                  : 'var(--bg-surface-hover)',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                  }
                }}
              />

              <div
                className="scan-bill-dropzone-icon"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: selectedFiles.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 72, 153, 0.12)',
                  color: selectedFiles.length > 0 ? 'var(--color-success)' : '#EC4899',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedFiles.length > 0 ? <CheckCircle2 size={28} /> : <Upload size={28} />}
              </div>

              <div className="scan-bill-dropzone-text">
                <div className="scan-bill-dropzone-title" style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) attached — Click or drag to add more`
                    : 'Click to select or drag & drop bill images / PDFs'}
                </div>
                <div className="scan-bill-dropzone-sub" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports handwritten receipts, distributor invoices, photos (.jpg, .png, .webp) and multi-page PDFs
                </div>
              </div>

              {/* Take Photo via Camera Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCameraActive(true);
                }}
                className="btn btn-secondary btn-sm scan-bill-camera-btn"
                style={{
                  marginTop: '4px',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-pill)',
                  borderColor: 'rgba(236, 72, 153, 0.4)',
                  color: '#F472B6',
                }}
              >
                <Camera size={14} />
                <span>Take Photo with Camera</span>
              </button>
            </div>
          )}

          {/* Selected Files Thumbnails Strip */}
          {filePreviews.length > 0 && (
            <div className="scan-bill-previews-section">
              <div
                className="scan-bill-previews-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Attached Documents ({filePreviews.length})
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Clear All
                </button>
              </div>

              <div
                className="scan-bill-previews-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                }}
              >
                {filePreviews.map((p, idx) => (
                  <div
                    key={idx}
                    className="scan-bill-preview-item"
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      height: '90px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                    }}
                  >
                    {p.isPdf ? (
                      <div style={{ textAlign: 'center', padding: '4px' }}>
                        <FileText size={28} style={{ color: '#F59E0B', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '0.68rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                          {p.name}
                        </div>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>PDF Doc</span>
                      </div>
                    ) : (
                      <img
                        src={p.url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(0, 0, 0, 0.75)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Remove file"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions / Custom Request Section */}
          <div
            className="scan-bill-custom-req-box"
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface, #161B2C)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div className="scan-bill-custom-req-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div className="scan-bill-custom-req-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                    color: '#F472B6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wand2 size={14} />
                </div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Special Instructions / Custom Request
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(236, 72, 153, 0.12)',
                    color: '#F472B6',
                    fontWeight: 700,
                    border: '1px solid rgba(236, 72, 153, 0.2)',
                  }}
                >
                  Priority Override
                </span>
              </div>

              {customRequest && (
                <button
                  type="button"
                  onClick={() => setCustomRequest('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                  }}
                  title="Clear custom instructions"
                >
                  <X size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
              Specify any custom requirements for this bill (e.g., skip selling price, apply custom markup %, or set defaults). Your special request will be given <strong>highest priority</strong> over default extraction rules.
            </p>

            <textarea
              className="scan-bill-custom-req-textarea"
              value={customRequest}
              onChange={(e) => setCustomRequest(e.target.value)}
              placeholder="e.g. Do not extract selling price from bill, or Calculate selling price as cost price + 15%, or If quantity is missing set to 1..."
              rows={2}
              style={{
                width: '100%',
                fontSize: '0.82rem',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-main, #0B0E17)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                resize: 'vertical',
                minHeight: '54px',
                lineHeight: 1.45,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Supplier Attachment Option */}
          {suppliers && suppliers.length > 0 && (
            <div
              className="scan-bill-supplier-box"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-surface, #161B2C)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div className="scan-bill-supplier-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#A78BFA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                  }}
                >
                  <Truck size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Assign Supplier to Extracted Items
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Auto-attach or force a supplier for all items scanned from this bill
                  </div>
                </div>
              </div>

              <div className="scan-bill-supplier-select-wrap" style={{ position: 'relative', minWidth: '220px', maxWidth: '300px', flex: '1 1 auto' }}>
                <select
                  className="scan-bill-supplier-select"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    fontSize: '0.82rem',
                    padding: '6px 36px 6px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-main, #0B0E17)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main, #FFFFFF)',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                >
                  <option value="" style={{ background: '#161B2C', color: '#FFFFFF' }}>
                    Auto-detect from bill
                  </option>
                  <option value="NONE" style={{ background: '#161B2C', color: '#FFFFFF' }}>
                    No Supplier (Leave Empty)
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} style={{ background: '#161B2C', color: '#FFFFFF' }}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          )}

          {/* Quota Exhausted / Rate Limit Error Alert Banner with Direct Action */}
          {quotaExhausted && (
            <div
              className="scan-bill-quota-alert"
              style={{
                padding: '14px 18px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-md)',
                color: '#FCD34D',
                fontSize: '0.84rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={20} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#FBBF24', fontSize: '0.92rem' }}>
                    Gemini API Rate Limit / Daily Quota Reached
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                    All {keysTriedCount} configured Gemini API key(s) have reached their current rate limit. Wondersale supports multi-key rotation so you never run out of capacity.
                  </div>
                </div>
              </div>

              <div className="scan-bill-alert-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="btn btn-primary btn-sm"
                    style={{
                      fontSize: '0.76rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#F59E0B',
                      borderColor: '#F59E0B',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    <Settings size={13} />
                    <span>Add Another Free API Key in Settings</span>
                  </button>
                )}

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.76rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#FCD34D',
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Get Free Key on Google AI Studio</span>
                </a>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {error && !quotaExhausted && (
            <div
              className="scan-bill-error-alert"
              style={{
                padding: '12px 16px',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-danger)',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Extraction Failed</div>
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{error}</div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div
          className="scan-bill-modal-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-solid, #161B2C)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary scan-bill-cancel-btn">
            Cancel
          </button>

          <button
            type="button"
            onClick={handleProcessBill}
            disabled={loading || selectedFiles.length === 0}
            className="btn btn-primary scan-bill-submit-btn"
            style={{
              fontWeight: 800,
              padding: '10px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #DC2626, #7C3AED)',
              borderColor: 'transparent',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Reading Handwriting with Gemini AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Extract Products ({selectedFiles.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
