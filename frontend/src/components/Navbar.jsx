import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Store as StoreIcon,
  RotateCcw,
  Move,
} from 'lucide-react';
import { isModuleAccessible, SYSTEM_MODULES, getLauncherOrderStorageKey } from './AppLauncher';

export default function Navbar({
  theme,
  onToggleTheme,
  stores = [],
  selectedStore,
  currentUser,
  activeView,
  onNavigate,
  onLogout,
}) {
  const isOwner = currentUser?.is_owner || currentUser?.role_details?.can_access_staff;
  const currentStoreObj = stores.find((s) => String(s.id) === String(selectedStore));
  const storeName = currentStoreObj?.name || (currentUser?.store_details?.name) || 'Bhopal';

  const checkCustomLauncherOrder = useCallback(() => {
    try {
      const storageKey = getLauncherOrderStorageKey(currentUser);
      const saved = localStorage.getItem(storageKey) || localStorage.getItem('wondersale_launcher_order');
      if (!saved) return false;
      const ids = JSON.parse(saved);
      if (!Array.isArray(ids)) return false;
      const defaultAccessible = SYSTEM_MODULES.filter((m) => isModuleAccessible(currentUser, m.id)).map((m) => m.id);
      return ids.length !== defaultAccessible.length || ids.some((id, idx) => id !== defaultAccessible[idx]);
    } catch {
      return false;
    }
  }, [currentUser]);

  const [hasCustomLauncherOrder, setHasCustomLauncherOrder] = useState(checkCustomLauncherOrder);
  const [isMoveModeActive, setIsMoveModeActive] = useState(false);

  useEffect(() => {
    setHasCustomLauncherOrder(checkCustomLauncherOrder());
  }, [currentUser, checkCustomLauncherOrder]);

  useEffect(() => {
    const handleOrderChange = () => {
      setHasCustomLauncherOrder(checkCustomLauncherOrder());
    };
    window.addEventListener('wondersale_launcher_order_changed', handleOrderChange);
    return () => window.removeEventListener('wondersale_launcher_order_changed', handleOrderChange);
  }, [checkCustomLauncherOrder]);

  useEffect(() => {
    const handleMoveModeChange = (e) => {
      if (typeof e.detail?.active === 'boolean') {
        setIsMoveModeActive(e.detail.active);
      }
    };
    window.addEventListener('wondersale_launcher_move_mode_changed', handleMoveModeChange);
    return () => window.removeEventListener('wondersale_launcher_move_mode_changed', handleMoveModeChange);
  }, []);

  const toggleMoveMode = () => {
    const next = !isMoveModeActive;
    setIsMoveModeActive(next);
    window.dispatchEvent(new CustomEvent('wondersale_launcher_toggle_move_mode', { detail: { active: next } }));
  };

  const handleResetLauncherOrder = () => {
    const storageKey = getLauncherOrderStorageKey(currentUser);
    localStorage.removeItem(storageKey);
    localStorage.removeItem('wondersale_launcher_order');
    setHasCustomLauncherOrder(false);
    window.dispatchEvent(new CustomEvent('wondersale_reset_launcher_order'));
    window.dispatchEvent(new CustomEvent('wondersale_launcher_order_changed', { detail: null }));
  };

  return (
    <header
      className="app-navbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="app-navbar-container"
        style={{
          width: '100%',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Brand Logo & Title & Active Service Breadcrumb */}
        <div className="app-navbar-brand-section" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="app-navbar-logo-wrap"
            onClick={() => onNavigate('launcher')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title="Return to Main Menu"
          >
            <img
              src="/assets/logo.svg"
              alt="Wondersale Logo"
              className="app-navbar-logo"
              style={{
                height: '44px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <span
              className="app-navbar-title"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
              }}
            >
              Wondersale
            </span>
          </div>

          {/* Active Service Breadcrumb with modern angled two-line chevron */}
          {activeView !== 'launcher' && (
            <div
              className="app-navbar-breadcrumb"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                userSelect: 'none',
              }}
            >
              <ChevronRight
                size={24}
                strokeWidth={2.8}
                className="app-navbar-breadcrumb-icon"
                style={{ color: 'var(--text-muted)', opacity: 0.8 }}
              />
              <span
                className="app-navbar-breadcrumb-text"
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                }}
              >
                {(() => {
                  const raw = activeView.replace('denied_', '');
                  if (raw === 'accounting') return 'ACCOUNTS AND FINANCE';
                  if (raw === 'employee_management') return 'EMPLOYEE MANAGEMENT';
                  return raw.replace(/_/g, ' ');
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Right Controls: Store Location Badge, Staff Badge, Theme, Logout */}
        <div className="app-navbar-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Active Store Location Badge */}
          {storeName && (
            <div
              className="app-navbar-store-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                padding: '5px 12px',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
              title={`Logged in store location: ${storeName}`}
            >
              <StoreIcon size={14} className="app-navbar-badge-icon" style={{ color: 'var(--brand-primary)' }} />
              <span className="app-navbar-store-name">{storeName}</span>
            </div>
          )}

          {/* Staff Identity Pill */}
          {currentUser && (
            <div
              className="app-navbar-staff-badge"
              onClick={() => onNavigate('employee_portal')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                padding: '5px 14px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              title="Open Employee Portal & Workspace"
            >
              <ShieldCheck
                size={15}
                className="app-navbar-badge-icon"
                style={{ color: isOwner ? 'var(--brand-accent)' : 'var(--color-info)' }}
              />
              <span className="app-navbar-staff-name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentUser.name}
              </span>
              <span className="app-navbar-staff-role" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                ({currentUser.role_details?.name || 'Staff'})
              </span>
            </div>
          )}

          {/* Mobile Rearrange / Move Apps Button: Only visible on launcher view in mobile after Store Location & Employee Badge */}
          {activeView === 'launcher' && (
            <button
              type="button"
              onClick={toggleMoveMode}
              className={`btn btn-secondary btn-icon app-navbar-btn app-navbar-move-btn ${isMoveModeActive ? 'active' : ''}`}
              title={isMoveModeActive ? 'Disable app reordering' : 'Enable app reordering'}
              aria-label="Toggle Move Apps Mode"
            >
              <Move size={14} style={{ color: isMoveModeActive ? 'var(--brand-accent)' : 'inherit' }} />
            </button>
          )}

          {/* Action Buttons Container */}
          <div className="app-navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Reset App Order Button: Visible ONLY on launcher view when custom order exists */}
            {activeView === 'launcher' && hasCustomLauncherOrder && (
              <button
                type="button"
                onClick={handleResetLauncherOrder}
                className="btn btn-secondary btn-sm app-navbar-reset-order-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  marginRight: '4px',
                }}
                title="Reset app icons to default order"
                aria-label="Reset app icons to default order"
              >
                <RotateCcw size={13} />
                <span className="app-navbar-reset-text">Reset App Order</span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn btn-secondary btn-icon app-navbar-btn app-navbar-theme-btn"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun size={17} style={{ color: 'var(--brand-accent)' }} />
              ) : (
                <Moon size={17} style={{ color: 'var(--text-secondary)' }} />
              )}
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-secondary btn-icon app-navbar-btn app-navbar-logout-btn"
              title="Sign Out"
              style={{ color: 'var(--color-danger)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
