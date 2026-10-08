import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  Store as StoreIcon,
  Search,
  ChevronDown,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { loginStaff, fetchStores } from '../api';

function SearchableStoreSelect({ stores = [], selectedStoreId, onSelectStore }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const safeStores = Array.isArray(stores) ? stores : [];
  const selectedStore = safeStores.find((s) => String(s.id) === String(selectedStoreId));

  const formatStoreDisplay = (store) => {
    if (!store) return '';
    return store.pincode ? `${store.name} (${store.pincode})` : store.name;
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return safeStores;
    const q = searchQuery.toLowerCase().trim();
    return safeStores.filter((s) => {
      const nameMatch = s.name?.toLowerCase().includes(q);
      const pinMatch = s.pincode?.toLowerCase().includes(q);
      const cityMatch = s.city?.toLowerCase().includes(q);
      return nameMatch || pinMatch || cityMatch;
    });
  }, [safeStores, searchQuery]);

  const handleSelect = (store) => {
    onSelectStore(String(store.id));
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="form-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          paddingLeft: '42px',
          paddingRight: '14px',
          height: '42px',
          fontSize: '0.94rem',
          fontWeight: 600,
          borderColor: isOpen ? 'var(--brand-primary)' : undefined,
          boxShadow: isOpen ? '0 0 0 3px rgba(197, 34, 36, 0.15)' : undefined,
          userSelect: 'none',
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <StoreIcon
          size={18}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--brand-primary)',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selectedStore ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {selectedStore ? formatStoreDisplay(selectedStore) : 'Select Store Location...'}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '8px',
          }}
        />
      </div>

      {/* Searchable Dropdown Menu */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 100,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-floating)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Input Bar */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '20px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search store name or pincode..."
              className="form-input"
              style={{
                paddingLeft: '34px',
                paddingRight: searchQuery ? '30px' : '10px',
                height: '34px',
                fontSize: '0.86rem',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '18px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Stores List */}
          <div
            role="listbox"
            style={{
              overflowY: 'auto',
              maxHeight: '200px',
              padding: '4px',
            }}
          >
            {filteredStores.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}
              >
                No active stores found matching "{searchQuery}"
              </div>
            ) : (
              filteredStores.map((s) => {
                const isSelected = String(s.id) === String(selectedStoreId);
                return (
                  <div
                    key={s.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(s)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'var(--brand-ruby-glow)' : 'transparent',
                      color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.9rem',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{s.name}</span>
                      {s.pincode && (
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            opacity: 0.9,
                          }}
                        >
                          ({s.pincode})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginView({ onLoginSuccess, theme, onToggleTheme, notificationMessage }) {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStores() {
      try {
        const data = await fetchStores();
        // Exclude disabled/inactive stores from the login dropdown
        const activeStores = (data || []).filter((s) => s.is_active !== false);
        if (activeStores && activeStores.length > 0) {
          setStores(activeStores);
          // Default to Bhopal or first store in the list
          const bhopalStore = activeStores.find((s) => s.name?.toLowerCase().includes('bhopal'));
          setSelectedStoreId(String(bhopalStore ? bhopalStore.id : activeStores[0].id));
        } else {
          setStores([]);
          setSelectedStoreId('');
        }
      } catch (e) {
        setStores([]);
        setSelectedStoreId('');
      }
    }
    loadStores();
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!staffId.trim() || !password) {
      setError('Please enter both your Staff ID and Password.');
      return;
    }
    if (!selectedStoreId) {
      setError('Please select your Store location.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await loginStaff(staffId.trim(), password, selectedStoreId);
      localStorage.setItem('wondersale_logged_in_store', selectedStoreId);
      const chosenStoreObj = stores.find((s) => String(s.id) === String(selectedStoreId));
      onLoginSuccess(data.staff, selectedStoreId, chosenStoreObj);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Top Bar with Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn btn-secondary btn-icon"
          title="Toggle Dark / Light Theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} style={{ color: 'var(--brand-accent)' }} />
          ) : (
            <Moon size={18} style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
      </div>

      {/* Main Glassmorphic Login Card */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px 36px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-floating)',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Accent Glow Top Border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3.5px',
            background: 'linear-gradient(90deg, #C52224 0%, #FEC501 50%, #C52224 100%)',
            boxShadow: '0 0 16px rgba(254, 197, 1, 0.5), 0 2px 8px rgba(197, 34, 36, 0.35)',
            zIndex: 2,
          }}
        />

        {/* Logo & Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/assets/logo.svg"
            alt="Wondersale Logo"
            style={{
              height: '64px',
              width: 'auto',
              margin: '0 auto 16px',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            WONDERSALE
          </h2>
        </div>

        {/* Session Terminated / Logout Notice */}
        {notificationMessage && !error && (
          <div
            style={{
              padding: '12px 14px',
              marginBottom: '20px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              fontWeight: 600,
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              lineHeight: 1.4,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{notificationMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              marginBottom: '20px',
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.84rem',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Store Location Searchable Dropdown */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">Store *</label>
            <SearchableStoreSelect
              stores={stores}
              selectedStoreId={selectedStoreId}
              onSelectStore={setSelectedStoreId}
            />
          </div>

          {/* Staff ID Input */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">Staff ID / Username</label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. admin or CASHIER01"
                className="form-input mono"
                style={{ paddingLeft: '42px', fontSize: '0.94rem' }}
                autoFocus
                required
              />
            </div>
          </div>

          {/* Password Input with Visibility Toggle */}
          <div style={{ marginBottom: '26px' }}>
            <label className="form-label">Security Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="form-input"
                style={{ paddingLeft: '42px', paddingRight: '42px', fontSize: '0.94rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: showPassword ? 'var(--brand-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.96rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Store'}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
