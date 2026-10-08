import React from 'react';
import { Compass, ArrowLeft, Home } from 'lucide-react';

export default function NotFoundView({ onBackToLauncher, invalidPath }) {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '40px 32px',
          boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.25))',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(197, 34, 36, 0.12)',
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Compass size={36} />
        </div>

        <div
          style={{
            fontSize: '3rem',
            fontWeight: 900,
            color: 'var(--brand-primary)',
            lineHeight: 1,
            marginBottom: '8px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          404
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 10px' }}>
          Station Not Found
        </h2>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
          The module or station page{' '}
          {invalidPath && (
            <code
              style={{
                background: 'var(--bg-surface)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              #{invalidPath}
            </code>
          )}{' '}
          does not exist or has been moved.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {onBackToLauncher && (
            <button
              onClick={onBackToLauncher}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderRadius: 'var(--radius-pill, 9999px)',
                cursor: 'pointer',
              }}
            >
              <Home size={16} />
              Return to Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
