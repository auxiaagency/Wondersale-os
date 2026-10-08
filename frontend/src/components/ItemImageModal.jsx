import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Trash2,
  Star,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Plus,
  Camera,
  RefreshCw,
  Video,
  VideoOff,
  Check,
  Crop,
} from 'lucide-react';
import { uploadItemImages, setImagePrimary, deleteItemImage, fetchItem } from '../api';
import ImageCropModal from './ImageCropModal';

export default function ItemImageModal({
  item,
  onClose,
  onUpdateItem,
  isDraftMode = false,
  draftImages = [],
  onSaveDraft = null,
}) {
  // Normalize initial images
  const initialImages = isDraftMode
    ? draftImages.map((img, idx) => {
        if (typeof img === 'string') {
          return { id: `draft_${idx}`, image_url: img, is_primary: idx === 0 };
        }
        if (img instanceof File) {
          return {
            id: `draft_${idx}`,
            image_url: URL.createObjectURL(img),
            file: img,
            is_primary: idx === 0,
          };
        }
        return {
          id: img.id || `draft_${idx}`,
          image_url: img.image_url || img.url || (img.file ? URL.createObjectURL(img.file) : ''),
          file: img.file,
          is_primary: Boolean(img.is_primary || idx === 0),
        };
      })
    : item?.images || [];

  const [images, setImages] = useState(initialImages);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // 1:1 Image Cropper queue state
  const [cropFiles, setCropFiles] = useState([]);
  const [reCroppingTargetId, setReCroppingTargetId] = useState(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const currentPreview = images[activePreviewIndex] || images[0] || null;

  // Helper to detect if device has dual front & back cameras (phones, tablets) vs single webcam/laptop
  const detectDualCameraSupport = (devices = [], activeStream = null) => {
    if (typeof navigator === 'undefined') return false;

    // Filter out virtual cameras, infrared/hello devices, and screen capture
    const realVideoDevices = (devices || []).filter((d) => {
      if (d.kind !== 'videoinput') return false;
      const label = (d.label || '').toLowerCase();
      if (
        label.includes('virtual') ||
        label.includes('obs') ||
        label.includes('hello') ||
        label.includes('infrared') ||
        label.includes('ir camera') ||
        label.includes('screen')
      ) {
        return false;
      }
      return true;
    });

    if (realVideoDevices.length < 2) {
      return false;
    }

    // Check if labels explicitly distinguish front vs back/rear/environment
    const labels = realVideoDevices.map((d) => (d.label || '').toLowerCase());
    const hasFrontLabel = labels.some(
      (l) => l.includes('front') || l.includes('user') || l.includes('forward') || l.includes('selfie')
    );
    const hasBackLabel = labels.some(
      (l) => l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('main')
    );

    if (hasFrontLabel && hasBackLabel) {
      return true;
    }

    // Check MediaStreamTrack capabilities for facingMode array
    if (activeStream) {
      try {
        const videoTrack = activeStream.getVideoTracks()?.[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities();
          if (caps?.facingMode && Array.isArray(caps.facingMode) && caps.facingMode.length > 1) {
            return true;
          }
        }
      } catch (e) {}
    }

    // Check if running on a mobile device or tablet with multiple camera sensors
    const ua = navigator.userAgent || '';
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));

    return Boolean(isMobileDevice && realVideoDevices.length >= 2);
  };

  // Detect camera capability on mount
  useEffect(() => {
    if (navigator?.mediaDevices?.getUserMedia) {
      setHasCameraSupport(true);
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setVideoDevices(videoInputs);
          setCanSwitchCamera(detectDualCameraSupport(videoInputs, null));
          if (videoInputs.length > 0) {
            setSelectedCameraId(videoInputs[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const syncDraft = (updatedList) => {
    if (isDraftMode && onSaveDraft) {
      const files = updatedList.map((img) => img.file).filter(Boolean);
      const previews = updatedList.map((img) => img.image_url);
      onSaveDraft(files, previews, updatedList);
    }
  };

  // Start Live Camera
  const handleStartCamera = async (deviceId = null, facing = null) => {
    setCameraError('');
    stopCameraStream();

    try {
      const targetFacing = facing || currentFacingMode || 'environment';
      const targetDevice = deviceId || (!facing ? selectedCameraId : null);

      const constraints = {
        video: targetDevice
          ? {
              deviceId: { exact: targetDevice },
              aspectRatio: { ideal: 1 },
              width: { ideal: 1080 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: targetFacing },
              aspectRatio: { ideal: 1 },
              width: { ideal: 1080 },
              height: { ideal: 1080 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);

      // Re-enumerate devices if needed & verify dual camera capability
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        setCanSwitchCamera(detectDualCameraSupport(videoInputs, stream));
        if (targetDevice && videoInputs.length > 0) {
          setSelectedCameraId(targetDevice);
        }
      } catch (e) {}

      // Attach to video ref
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please verify camera permissions in your browser.');
      setIsCameraActive(false);
    }
  };

  // Toggle between front and back cameras on supported devices
  const handleToggleFacingCamera = () => {
    const nextFacing = currentFacingMode === 'environment' ? 'user' : 'environment';
    setCurrentFacingMode(nextFacing);
    handleStartCamera(null, nextFacing);
  };

  // Snap photo from live camera - feeds directly into 1:1 Square Cropper
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream not ready yet.');
      return;
    }

    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 250);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCameraStream();
        setReCroppingTargetId(null);
        setCropFiles([capturedFile]);
      },
      'image/jpeg',
      0.95
    );
  };

  // Re-crop or re-frame currently highlighted preview
  const handleRecropCurrent = () => {
    if (!currentPreview) return;
    const target = currentPreview.file || currentPreview.image_url || currentPreview.image;
    if (target) {
      setReCroppingTargetId(currentPreview.id);
      setCropFiles([target]);
    }
  };

  // Unified File Processor (called after 1:1 square crop confirms)
  const processNewFiles = async (filesList) => {
    const rawFiles = Array.from(filesList || []).filter(
      (f) => f.type?.startsWith('image/') || (f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i))
    );
    if (rawFiles.length === 0) return;

    if (isDraftMode) {
      const newItems = rawFiles.map((file, idx) => {
        const previewUrl = URL.createObjectURL(file);
        return {
          id: `draft_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          image_url: previewUrl,
          file: file,
          is_primary: images.length === 0 && idx === 0,
        };
      });

      const updated = [...images, ...newItems];
      setImages(updated);
      setActivePreviewIndex(updated.length - 1);
      syncDraft(updated);
      showFeedback(`${rawFiles.length} photo(s) added to draft.`);
    } else {
      setUploading(true);
      setError('');
      try {
        await uploadItemImages(item.id, rawFiles);
        const refreshed = await fetchItem(item.id);
        setImages(refreshed.images || []);
        onUpdateItem?.(refreshed);
        setActivePreviewIndex(Math.max(0, (refreshed.images || []).length - 1));
        showFeedback(`${rawFiles.length} photo(s) uploaded successfully.`);
      } catch (err) {
        setError(err.message || 'Failed to upload images.');
      } finally {
        setUploading(false);
      }
    }
  };

  // Called when 1:1 ImageCropModal confirms cropped files
  const handleCropComplete = async (croppedFiles) => {
    setCropFiles([]);
    if (!croppedFiles || croppedFiles.length === 0) return;

    if (reCroppingTargetId) {
      const targetId = reCroppingTargetId;
      setReCroppingTargetId(null);
      const replacementFile = croppedFiles[0];

      if (isDraftMode) {
        const previewUrl = URL.createObjectURL(replacementFile);
        const updated = images.map((img) =>
          img.id === targetId
            ? { ...img, image_url: previewUrl, file: replacementFile }
            : img
        );
        setImages(updated);
        syncDraft(updated);
        showFeedback('Photo re-cropped and updated in draft.');
      } else {
        setUploading(true);
        setError('');
        try {
          await uploadItemImages(item.id, [replacementFile]);
          try {
            await deleteItemImage(targetId);
          } catch (delErr) {
            console.warn('Could not delete old image after re-crop:', delErr);
          }
          const refreshed = await fetchItem(item.id);
          setImages(refreshed.images || []);
          onUpdateItem?.(refreshed);
          showFeedback('Photo re-cropped and updated successfully.');
        } catch (err) {
          setError(err.message || 'Failed to update cropped image.');
        } finally {
          setUploading(false);
        }
      }
    } else {
      await processNewFiles(croppedFiles);
    }
  };

  const handleFileInputChange = (e) => {
    const rawFiles = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i)
    );
    if (rawFiles.length > 0) {
      setReCroppingTargetId(null);
      setCropFiles(rawFiles);
    }
    e.target.value = '';
  };

  // Drag and Drop Event Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      const rawFiles = Array.from(e.dataTransfer.files || []).filter(
        (f) => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i)
      );
      if (rawFiles.length > 0) {
        setReCroppingTargetId(null);
        setCropFiles(rawFiles);
      }
    }
  };

  const handleSetPrimary = async (imgId) => {
    if (isDraftMode) {
      const updated = images.map((img) => ({
        ...img,
        is_primary: img.id === imgId,
      }));
      setImages(updated);
      syncDraft(updated);
      showFeedback('Primary photo updated.');
    } else {
      try {
        await setImagePrimary(imgId);
        const refreshed = await fetchItem(item.id);
        setImages(refreshed.images || []);
        onUpdateItem?.(refreshed);
        showFeedback('Primary product image updated.');
      } catch (err) {
        setError(err.message || 'Failed to set primary image.');
      }
    }
  };

  const handleDeleteImage = async (imgId) => {
    if (isDraftMode) {
      const updated = images.filter((img) => img.id !== imgId);
      if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
        updated[0].is_primary = true;
      }
      setImages(updated);
      if (activePreviewIndex >= updated.length) {
        setActivePreviewIndex(Math.max(0, updated.length - 1));
      }
      syncDraft(updated);
      showFeedback('Photo removed.');
    } else {
      try {
        await deleteItemImage(imgId);
        const refreshed = await fetchItem(item.id);
        setImages(refreshed.images || []);
        onUpdateItem?.(refreshed);
        if (activePreviewIndex >= (refreshed.images || []).length) {
          setActivePreviewIndex(Math.max(0, (refreshed.images || []).length - 1));
        }
        showFeedback('Image deleted.');
      } catch (err) {
        setError(err.message || 'Failed to delete image.');
      }
    }
  };

  const handleDone = () => {
    stopCameraStream();
    if (isDraftMode) {
      syncDraft(images);
    }
    onClose?.();
  };

  return (
    <>
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDone();
        }}
        style={{ zIndex: 1100 }}
      >
        <div
        className="modal-content"
        style={{
          maxWidth: '720px',
          width: '95%',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-ruby-glow)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0 }}>
                {item?.name || 'Product Photos'}
              </h3>
              <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {isDraftMode ? 'DRAFT MODE' : `UID: ${item?.uid || '—'}`} &bull; {images.length} photo(s)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDone}
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback / Error alerts */}
        {feedback && (
          <div
            style={{
              padding: '10px 18px',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{feedback}</span>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: '10px 18px',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        {cameraError && (
          <div
            style={{
              padding: '10px 18px',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Spotlight Area / Live Camera View / Drag & Drop Zone */}
          <div
            style={{
              width: isCameraActive ? '330px' : '100%',
              maxWidth: '100%',
              height: '330px',
              aspectRatio: isCameraActive ? '1 / 1' : undefined,
              margin: isCameraActive ? '0 auto 18px auto' : '0 0 18px 0',
              borderRadius: 'var(--radius-lg)',
              background: isCameraActive ? '#000000' : isDraggingOver ? 'rgba(218, 41, 28, 0.08)' : 'var(--bg-surface-hover)',
              border: isDraggingOver
                ? '2px dashed var(--brand-primary)'
                : isCameraActive
                ? '2px solid rgba(255, 255, 255, 0.25)'
                : '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isCameraActive ? '0 8px 32px rgba(0,0,0,0.6)' : 'none',
              transition: 'all 0.25s ease',
            }}
          >
            {/* Shutter flash effect */}
            {isCapturing && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#ffffff',
                  zIndex: 40,
                  opacity: 0.9,
                  transition: 'opacity 0.2s ease',
                }}
              />
            )}

            {/* Dragging over overlay */}
            {isDraggingOver && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  zIndex: 30,
                  color: 'var(--brand-primary)',
                }}
              >
                <Upload size={44} style={{ animation: 'bounce 1s infinite' }} />
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  Drop photo(s) here to add
                </span>
              </div>
            )}

            {/* Case 1: LIVE CAMERA VIEW (Strict 1:1 Aspect Ratio) */}
            {isCameraActive ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  aspectRatio: '1 / 1',
                  background: '#000000',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* 1:1 Viewfinder Framing Grid */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    borderRadius: 'var(--radius-md)',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff' }} />
                    <div style={{ width: '12px', height: '12px', borderTop: '2px solid #ffffff', borderRight: '2px solid #ffffff' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderBottom: '2px solid #ffffff', borderLeft: '2px solid #ffffff' }} />
                    <div style={{ width: '12px', height: '12px', borderBottom: '2px solid #ffffff', borderRight: '2px solid #ffffff' }} />
                  </div>
                </div>

                {/* Top Camera Controls */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 20,
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(6px)',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--color-success)',
                        display: 'inline-block',
                      }}
                    />
                    <span>1:1 Camera</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {canSwitchCamera && (
                      <button
                        type="button"
                        onClick={handleToggleFacingCamera}
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(6px)',
                          fontSize: '0.74rem',
                          padding: '4px 10px',
                        }}
                        title="Switch Camera (Front / Back)"
                      >
                        <RefreshCw size={13} />
                        <span>Switch</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(6px)',
                        fontSize: '0.74rem',
                        padding: '4px 10px',
                      }}
                    >
                      <VideoOff size={13} />
                      <span>Close</span>
                    </button>
                  </div>
                </div>

                {/* Shutter Capture Button */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.3)',
                      border: '3px solid #ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                      transition: 'transform 0.1s ease',
                      padding: 0,
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    title="Click Snapshot (1:1)"
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--brand-primary)',
                      }}
                    />
                  </button>
                </div>
              </div>
            ) : currentPreview ? (
              /* Case 2: IMAGE PREVIEW SPOTLIGHT */
              <>
                <img
                  src={currentPreview.image_url || currentPreview.image}
                  alt={item?.name || 'Preview'}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {currentPreview.is_primary && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(245, 158, 11, 0.9)',
                      color: '#000',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <Star size={12} fill="#000" />
                    <span>Primary Photo</span>
                  </div>
                )}

                {/* Actions on main preview */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    display: 'flex',
                    gap: '8px',
                    background: 'rgba(0,0,0,0.65)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-pill)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleRecropCurrent}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                    title="Crop / Re-frame Photo (1:1)"
                  >
                    <Crop size={12} />
                    <span>Crop / Frame</span>
                  </button>
                  {!currentPreview.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(currentPreview.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                      title="Set as Primary Image"
                    >
                      <Star size={12} />
                      <span>Set Primary</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(currentPreview.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 8px', color: 'var(--color-danger)' }}
                    title="Delete Image"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            ) : (
              /* Case 3: EMPTY STATE WITH DIRECT DRAG/DROP & CAMERA CALLS */
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <ImageIcon size={32} style={{ opacity: 0.6 }} />
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No Images Attached
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                  Drag &amp; drop photos here, choose from your computer, or click a photo with your camera.
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <label
                    className="btn btn-primary btn-sm"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Upload size={14} />
                    <span>Upload Photos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.heic,.heif"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {hasCameraSupport && (
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                    >
                      <Camera size={14} />
                      <span>Click Photo</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails Grid & Upload Controls */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                Photo Gallery ({images.length})
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Click Photo / Camera button */}
                {hasCameraSupport && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isCameraActive) {
                        stopCameraStream();
                      } else {
                        handleStartCamera();
                      }
                    }}
                    className={`btn btn-sm ${isCameraActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <Camera size={14} />
                    <span>{isCameraActive ? 'Live Camera' : 'Click Photo'}</span>
                  </button>
                )}

                {/* Upload Photos File Input Button */}
                <label
                  className="btn btn-primary btn-sm"
                  style={{
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                  }}
                >
                  <Plus size={14} />
                  <span>{uploading ? 'Processing...' : 'Upload Photos'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={handleFileInputChange}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Thumbnails Row */}
            {images.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '10px',
                }}
              >
                {images.map((img, idx) => {
                  const isSelected = !isCameraActive && (images[activePreviewIndex]?.id === img.id || (activePreviewIndex === idx));
                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        stopCameraStream();
                        setActivePreviewIndex(idx);
                      }}
                      style={{
                        height: '80px',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-hover)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <img
                        src={img.image_url || img.image}
                        alt={`Photo ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {img.is_primary && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '3px',
                            left: '3px',
                            background: 'rgba(245, 158, 11, 0.95)',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Star size={9} fill="#000" color="#000" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Tip: 1:1 square crop with blur margins applies automatically.
          </span>
          <button type="button" onClick={handleDone} className="btn btn-primary" style={{ fontWeight: 600, padding: '8px 20px' }}>
            Done
          </button>
        </div>
      </div>
    </div>

    {/* 1:1 Image Cropper Modal */}
    {cropFiles.length > 0 && (
      <ImageCropModal
        isOpen={cropFiles.length > 0}
        files={cropFiles}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setCropFiles([]);
          setReCroppingTargetId(null);
        }}
      />
    )}
  </>
  );
}
