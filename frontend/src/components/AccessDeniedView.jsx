import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export default function AccessDeniedView({ moduleId, currentUser, onBackToLauncher }) {
  const roleName = currentUser?.role_details?.name || 'Assigned Staff';
  const moduleName = moduleId ? moduleId.charAt(0).toUpperCase() + moduleId.slice(1) : 'Requested';

  return (
    <div
      style={{
        maxWidth: '580px',
        margin: '80px auto 40px',
        padding: '0 24px',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '48px 36px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: 'var(--shadow-floating)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red warning ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.18)',
            filter: 'blur(45px)',
            pointerEvents: 'none',
          }}
        />

        {/* Lock / Alert Icon */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: '2px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <Lock size={34} />
        </div>

        <div
          className="badge badge-danger"
          style={{
            fontSize: '0.75rem',
            padding: '4px 12px',
            margin: '0 auto 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ShieldAlert size={14} />
          <span>Access Denied &bull; Unauthorized URL</span>
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '10px' }}>
          {moduleName} Module is Locked
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Your staff account (<strong>{currentUser?.staff_id}</strong>) has the role{' '}
          <strong style={{ color: 'var(--text-primary)' }}>"{roleName}"</strong>, which does not have permission
          to view or access the <strong>{moduleName}</strong> workstation. Even if accessed directly via URL,
          this module is strictly locked.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '10px 22px' }}
            id="btn-return-menu-denied"
          >
            <ArrowLeft size={16} />
            <span>Return to Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
