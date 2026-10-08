import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  User,
  RotateCw,
  VideoOff,
  Video,
  X,
  Sparkles,
} from 'lucide-react';
import ImageCropModal from './ImageCropModal';

/**
 * Reusable Profile Photo Picker & 1:1 Square Cropper Component.
 * Supports:
 * - Drag & drop photo upload
 * - File browser input
 * - Live webcam / camera snapshot
 * - Universal 1:1 square crop with blur margin preview
 * - Single profile photo enforcement
 */
export default function ProfilePhotoPicker({
  photoUrl = '',
  onChangePhoto, // (file: File | null, previewUrl: string | null) => void
  name = '',
  disabled = false,
  size = 96, // Avatar size in pixels
}) {
  const [preview, setPreview] = useState(photoUrl || '');
  const [cropFiles, setCropFiles] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Live Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Sync incoming photoUrl
  useEffect(() => {
    if (photoUrl && typeof photoUrl === 'string') {
      setPreview(photoUrl);
    } else if (!photoUrl) {
      setPreview('');
    }
  }, [photoUrl]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleStartCamera = async (deviceId = null) => {
    setCameraError('');
    stopCameraStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Webcam / Camera not supported on this browser.');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      setCanSwitchCamera(videoInputs.length > 1);

      const targetDevice = deviceId || (videoInputs[0]?.deviceId ? videoInputs[0].deviceId : null);
      setSelectedCameraId(targetDevice || '');

      const constraints = {
        video: targetDevice
          ? { deviceId: { exact: targetDevice }, aspectRatio: { ideal: 1 }, width: { ideal: 720 } }
          : { facingMode: 'user', aspectRatio: { ideal: 1 }, width: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera open error:', err);
      setCameraError(err.message || 'Could not access camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream not ready yet.');
      return;
    }

    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCameraStream();
        setCropFiles([capturedFile]);
      },
      'image/jpeg',
      0.95
    );
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type?.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i)
    );
    if (files.length > 0) {
      setCropFiles([files[0]]);
    }
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer?.files || []).filter(
      (f) => f.type?.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i)
    );
    if (files.length > 0) {
      setCropFiles([files[0]]);
    }
  };

  const handleCropComplete = (croppedFiles) => {
    setCropFiles([]);
    if (!croppedFiles || croppedFiles.length === 0) return;
    const file = croppedFiles[0];
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    if (onChangePhoto) {
      onChangePhoto(file, previewUrl);
    }
  };

  const handleRemovePhoto = () => {
    setPreview('');
    if (onChangePhoto) {
      onChangePhoto(null, null);
    }
  };

  // Compute initials fallback
  const getInitials = () => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Avatar Dropzone Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled && !isCameraActive) fileInputRef.current?.click();
          }}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '16px',
            background: isDraggingOver
              ? 'rgba(59, 130, 246, 0.2)'
              : preview
              ? 'rgba(0,0,0,0.4)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
            border: isDraggingOver
              ? '2px dashed var(--brand-primary, #6366f1)'
              : '2px solid var(--border-subtle, rgba(255,255,255,0.12))',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            transition: 'all 0.2s ease',
          }}
          title={preview ? 'Click to change photo (1:1 auto-crop)' : 'Click or drop 1:1 profile image'}
        >
          {preview ? (
            <img
              src={preview}
              alt={name || 'Profile photo'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
              {name ? (
                <span style={{ fontSize: `${size * 0.32}px`, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
                  {getInitials()}
                </span>
              ) : (
                <User size={size * 0.4} style={{ opacity: 0.6, margin: '0 auto' }} />
              )}
            </div>
          )}

          {/* Dragging indicator overlay */}
          {isDraggingOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(99, 102, 241, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              Drop Image
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            Profile Picture
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
            1:1 Square Crop • Drag &amp; drop or click camera
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.76rem',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Upload size={13} />
              <span>{preview ? 'Change Photo' : 'Upload Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartCamera()}
              disabled={disabled}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.76rem',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Camera size={13} />
              <span>Take Photo</span>
            </button>

            {preview && !disabled && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  color: '#f87171',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Remove profile photo"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Camera Snapshot Overlay Modal */}
      {isCameraActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '20px',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--brand-primary, #6366f1)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Capture Profile Photo</h3>
              </div>
              <button
                type="button"
                onClick={stopCameraStream}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Video Preview Box */}
            <div
              style={{
                width: '100%',
                aspectRatio: '1/1',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#000',
                position: 'relative',
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
                  transform: 'scaleX(-1)', // Mirror front selfie
                }}
              />

              {/* 1:1 Guide Overlay Frame */}
              <div
                style={{
                  position: 'absolute',
                  inset: '20px',
                  border: '2px dashed rgba(255,255,255,0.6)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {cameraError && (
              <div style={{ fontSize: '0.78rem', color: '#f87171', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              {canSwitchCamera && (
                <button
                  type="button"
                  onClick={() => {
                    const nextDevice = videoDevices.find((d) => d.deviceId !== selectedCameraId);
                    if (nextDevice) handleStartCamera(nextDevice.deviceId);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: 'var(--radius-pill)', padding: '8px 14px' }}
                >
                  <RotateCw size={14} />
                  <span>Switch Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCaptureSnapshot}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  borderRadius: 'var(--radius-pill)',
                  padding: '10px 20px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                }}
              >
                <Camera size={16} />
                <span>Snap Photo &amp; Crop 1:1</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:1 Universal Image Cropper */}
      <ImageCropModal
        isOpen={cropFiles.length > 0}
        files={cropFiles}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropFiles([])}
      />
    </div>
  );
}
