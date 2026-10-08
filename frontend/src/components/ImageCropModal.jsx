import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Move,
} from 'lucide-react';

/**
 * Universal 1:1 Image Cropper Modal with Blurred Background for Empty Margins.
 * Supports:
 * - Fixed 1:1 square aspect ratio
 * - Full zoom-out (fitting wide or tall images completely)
 * - Automatic live & exported blurred background for empty letterbox/pillarbox areas
 * - Mouse drag and touch panning
 * - 90° rotation
 * - "Fit Entire (Blur BG)" and "Fill Square" quick presets
 * - Multi-image sequential cropping queue
 */
export default function ImageCropModal({
  isOpen,
  files = [],
  onCropComplete,
  onCancel,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedFiles, setProcessedFiles] = useState([]);

  const currentFile = files[currentIndex] || null;

  const [imageSrc, setImageSrc] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  // Transform states
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(0.3);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialPanX: 0, initialPanY: 0 });

  const viewportRef = useRef(null);
  const imageRef = useRef(null);

  // Initialize and load the image source when currentFile changes
  useEffect(() => {
    if (!currentFile) {
      setImageSrc('');
      return;
    }

    let url = '';
    if (currentFile instanceof File || currentFile instanceof Blob) {
      url = URL.createObjectURL(currentFile);
    } else if (typeof currentFile === 'string') {
      url = currentFile;
    } else if (currentFile.image_url || currentFile.url) {
      url = currentFile.image_url || currentFile.url;
    }

    setImageSrc(url);

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      // Calculate fit scale (so whole image fits inside 1:1 square by default)
      const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const fitRatio = minDim / maxDim;

      // Allow zooming out down to 0.2x or fitRatio * 0.7
      const calculatedMin = Math.max(0.2, Math.min(0.5, fitRatio * 0.8));
      setMinZoom(calculatedMin);

      // Default to "Fit Entire (Blur BG)" so product is never cropped unintentionally
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = url;

    return () => {
      if (url && (currentFile instanceof File || currentFile instanceof Blob)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [currentFile]);

  // Handle Drag / Pan start
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.initialPanX + dx,
        y: dragStartRef.current.initialPanY + dy,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support for mobile / tablets
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
    }
  };

  const handleTouchMove = useCallback(
    (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.initialPanX + dx,
        y: dragStartRef.current.initialPanY + dy,
      });
    },
    [isDragging]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.0015;
    setZoom((prev) => Math.max(minZoom, Math.min(3.0, prev + delta)));
  };

  // Quick Preset: Fit Entire Image (shows blurred background on empty sides)
  const handlePresetFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Quick Preset: Fill Square (zooms in until 1:1 box is completely covered)
  const handlePresetFill = () => {
    if (naturalSize.width && naturalSize.height) {
      const maxDim = Math.max(naturalSize.width, naturalSize.height);
      const minDim = Math.min(naturalSize.width, naturalSize.height);
      const fillScale = maxDim / minDim;
      setZoom(fillScale);
      setPan({ x: 0, y: 0 });
    }
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPan({ x: 0, y: 0 });
  };

  // Reset pan to center
  const handleResetCenter = () => {
    setPan({ x: 0, y: 0 });
  };

  // Export current 1:1 cropped canvas
  const renderCroppedBlob = async () => {
    return new Promise((resolve) => {
      const img = new Image();
      if (!imageSrc.startsWith('blob:') && !imageSrc.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        const outputSize = 1080; // High resolution standard 1:1 square
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        // --- LAYER 1: Blurred Background Fill ---
        ctx.save();
        // Scale background image to cover entire outputSize x outputSize
        const bgScale = Math.max(outputSize / imgW, outputSize / imgH) * 1.25; // 1.25 avoids edge vignette
        const bgW = imgW * bgScale;
        const bgH = imgH * bgScale;
        const bgX = (outputSize - bgW) / 2;
        const bgY = (outputSize - bgH) / 2;

        try {
          ctx.filter = 'blur(35px) brightness(0.75) saturate(1.2)';
        } catch (e) {}

        ctx.drawImage(img, bgX, bgY, bgW, bgH);
        ctx.restore();

        // Subtle dark gradient vignette overlay over blur
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, outputSize, outputSize);

        // --- LAYER 2: Foreground Sharp Product Image ---
        ctx.save();
        ctx.translate(outputSize / 2, outputSize / 2);

        // Viewport scale factor conversion
        const viewportBoxSize = viewportRef.current ? viewportRef.current.clientWidth : 380;
        const scaleFactor = outputSize / viewportBoxSize;

        // Apply pan translation scaled to high-res canvas
        ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

        // Apply rotation
        ctx.rotate((rotation * Math.PI) / 180);

        // Calculate foreground draw size based on fit and user zoom
        const fitScale = Math.min(outputSize / imgW, outputSize / imgH);
        const activeScale = fitScale * zoom;
        const fgW = imgW * activeScale;
        const fgH = imgH * activeScale;

        ctx.drawImage(img, -fgW / 2, -fgH / 2, fgW, fgH);
        ctx.restore();

        // Convert canvas to Blob / File
        canvas.toBlob(
          (blob) => {
            const fileName = currentFile?.name || `product_${Date.now()}.jpg`;
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const finalFile = new File([blob], `${baseName}_1x1.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(finalFile);
          },
          'image/jpeg',
          0.92
        );
      };
      img.src = imageSrc;
    });
  };

  // Confirm crop for the current image
  const handleConfirmCurrent = async () => {
    const croppedFile = await renderCroppedBlob();
    const updated = [...processedFiles, croppedFile];
    setProcessedFiles(updated);

    if (currentIndex + 1 < files.length) {
      // Proceed to next image in queue
      setCurrentIndex((prev) => prev + 1);
    } else {
      // All images in queue cropped!
      onCropComplete(updated);
    }
  };

  // Skip cropping current image (use original file or center square)
  const handleSkipCurrent = () => {
    const updated = [...processedFiles, currentFile];
    setProcessedFiles(updated);

    if (currentIndex + 1 < files.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onCropComplete(updated);
    }
  };

  if (!isOpen || !currentFile) return null;

  // Viewport display dimensions: responsive square up to 380px
  const viewportSize = 380;

  // Calculate sharp foreground CSS dimensions
  let fgBaseW = viewportSize;
  let fgBaseH = viewportSize;
  if (naturalSize.width && naturalSize.height) {
    const ratio = naturalSize.width / naturalSize.height;
    if (ratio >= 1) {
      fgBaseW = viewportSize;
      fgBaseH = viewportSize / ratio;
    } else {
      fgBaseH = viewportSize;
      fgBaseW = viewportSize * ratio;
    }
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100000,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface, #181B20)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text-primary, #FFFFFF)',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success, #10B981)',
              }}
            >
              <Crop size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Crop Product Photo (1:1)
                {files.length > 1 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted, #9CA3AF)',
                    }}
                  >
                    {currentIndex + 1} of {files.length}
                  </span>
                )}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9CA3AF)', margin: 0 }}>
                {currentFile?.name || 'Adjust product framing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #9CA3AF)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 1:1 Interactive Crop Viewport Area */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0D0E12',
          }}
        >
          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
            style={{
              width: '100%',
              maxWidth: `${viewportSize}px`,
              aspectRatio: '1 / 1',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 0 2px var(--brand-primary, #10B981)',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* LAYER 1: Live Blurred Background Extension */}
            {imageSrc && (
              <div
                style={{
                  position: 'absolute',
                  top: '-15%',
                  left: '-15%',
                  width: '130%',
                  height: '130%',
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(25px) brightness(0.68) saturate(1.25)',
                  transform: 'scale(1.15)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* LAYER 2: Crisp Foreground Product Image */}
            {imageSrc && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${fgBaseW}px`,
                  height: `${fgBaseH}px`,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                }}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45))',
                  }}
                />
              </div>
            )}

            {/* 1:1 Crop Grid Overlay Guideline */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
                pointerEvents: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr',
              }}
            >
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div />
            </div>

            {/* 1:1 Badge Indicator */}
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                zIndex: 4,
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                color: '#FFFFFF',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={11} style={{ color: 'var(--brand-primary, #10B981)' }} />
              1:1 SQUARE
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9CA3AF)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Move size={12} /> Drag image to position • Empty borders automatically blur
          </span>
        </div>

        {/* Toolbar & Controls */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--bg-surface, #181B20)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          {/* Zoom Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(minZoom, prev - 0.1))}
              title="Zoom out"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <ZoomOut size={16} />
            </button>

            <input
              type="range"
              min={minZoom}
              max={3.0}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--brand-primary, #10B981)',
                cursor: 'pointer',
              }}
            />

            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3.0, prev + 0.1))}
              title="Zoom in"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <ZoomIn size={16} />
            </button>

            <span style={{ fontSize: '0.8rem', fontWeight: 600, width: '42px', textAlign: 'right', color: 'var(--text-muted, #9CA3AF)' }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Preset Buttons & Rotation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePresetFit}
                title="Fit entire product image with blurred background borders"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: zoom <= 1.05 && zoom >= 0.95 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  border: zoom <= 1.05 && zoom >= 0.95 ? '1px solid var(--brand-primary, #10B981)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: zoom <= 1.05 && zoom >= 0.95 ? 'var(--color-success, #10B981)' : 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Minimize2 size={13} /> Fit (Blur BG)
              </button>

              <button
                type="button"
                onClick={handlePresetFill}
                title="Zoom in to fill entire 1:1 square without borders"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Maximize2 size={13} /> Fill Square
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90 degrees"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCw size={13} /> Rotate {rotation > 0 ? `${rotation}°` : ''}
              </button>

              {(pan.x !== 0 || pan.y !== 0) && (
                <button
                  type="button"
                  onClick={handleResetCenter}
                  title="Reset centering"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Center
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted, #9CA3AF)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {files.length > 1 && (
              <button
                type="button"
                onClick={handleSkipCurrent}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Skip This
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmCurrent}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: 700,
                background: 'var(--brand-primary, #10B981)',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Check size={18} />
              {currentIndex + 1 < files.length ? 'Crop & Next >' : 'Confirm 1:1 Photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
