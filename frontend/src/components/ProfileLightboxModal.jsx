import React, { useEffect } from 'react';
import { X, Phone, User, Building2, Shield, Tag } from 'lucide-react';
import { formatPhoneNumber } from '../utils/phoneFormat';

export default function ProfileLightboxModal({ image, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const imageSrc = image?.src || image?.url;
  if (!image || !imageSrc) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.88)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '24px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-50px',
            right: '0',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            borderRadius: 'var(--radius-pill, 50%)',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
          title="Close profile image view (Esc)"
        >
          <X size={22} />
        </button>

        {/* High-Res 1:1 Profile Image Container */}
        <div
          style={{
            width: 'min(440px, 78vw, 65vh)',
            height: 'min(440px, 78vw, 65vh)',
            borderRadius: '24px',
            overflow: 'hidden',
            background: '#0B0F19',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(197, 34, 36, 0.25)',
            border: '2px solid rgba(255, 255, 255, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <img
            src={imageSrc}
            alt={image.name || 'Staff Profile Photo'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Profile Details Banner */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: 'var(--radius-lg, 16px)',
            background: 'rgba(24, 28, 42, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            maxWidth: '520px',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
              {image.name || 'Staff Member'}
            </span>
            {image.code && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--brand-primary)',
                  background: 'rgba(197, 34, 36, 0.16)',
                  border: '1px solid rgba(197, 34, 36, 0.35)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs, 6px)',
                }}
              >
                {image.code}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {image.role && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={13} style={{ color: 'var(--brand-accent)' }} />
                <span>{image.role}</span>
              </span>
            )}
            {image.store && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{image.store}</span>
              </span>
            )}
            {image.section && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{image.section}</span>
              </span>
            )}
          </div>

          {image.phone && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: 'var(--color-success, #10B981)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '4px 14px',
                borderRadius: 'var(--radius-pill, 20px)',
                marginTop: '4px',
              }}
            >
              <Phone size={13} />
              <span>{formatPhoneNumber(image.phone)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
