import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CreditCard,
  Radio,
  User,
  Crown,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Phone,
  Building2,
  Briefcase,
  Wallet,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { inspectCard } from '../api';
import { onRfidScan, autoReconnectRfidReader } from '../utils/rfidSerial';
import { playVipAcceptedSound, playVipReadySound, playVipRejectedSound } from '../utils/vipCardSounds';
import { formatDateTime12h } from '../utils/timeFormat';

export default function CardLookupModal({
  isOpen,
  onClose,
  sourceArea = 'general', // 'employee' | 'customer' | 'general'
  initialCardUid = '',
  onUseCard,
}) {
  const [cardUidInput, setCardUidInput] = useState(initialCardUid || '');
  const [inspecting, setInspecting] = useState(false);
  const [cardResult, setCardResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());

  // Reset and inspect when modal opens or initialCardUid changes
  useEffect(() => {
    if (isOpen) {
      playVipReadySound();
      autoReconnectRfidReader().catch(() => {});
      if (initialCardUid) {
        setCardUidInput(initialCardUid);
        performInspection(initialCardUid);
      } else {
        setCardUidInput('');
        setCardResult(null);
        setError(null);
      }
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    }
  }, [isOpen, initialCardUid]);

  // Hardware RFID Scanner Listener (WebSerial & Keyboard Wedge)
  useEffect(() => {
    if (!isOpen) return;

    // 1. WebSerial scanner
    const unsubscribeSerial = onRfidScan((rawUid) => {
      const clean = (rawUid || '').trim().toUpperCase();
      if (clean.length >= 2) {
        setCardUidInput(clean);
        performInspection(clean);
      }
    });

    // 2. Custom window scan event
    const handleWindowScan = (e) => {
      if (e.detail?.uid) {
        const clean = (e.detail.uid || '').trim().toUpperCase();
        if (clean.length >= 2) {
          setCardUidInput(clean);
          performInspection(clean);
        }
      }
    };
    window.addEventListener('wondersale_rfid_scan', handleWindowScan);

    // 3. Fast Keyboard Wedge Listener
    const handleKeyDown = (e) => {
      // If typing in input field, don't double intercept
      if (document.activeElement === inputRef.current) return;

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const raw = bufferRef.current.trim().toUpperCase();
        bufferRef.current = '';
        if (raw.length >= 2) {
          e.preventDefault();
          setCardUidInput(raw);
          performInspection(raw);
        }
      } else if (e.key.length === 1) {
        if (diff > 220) bufferRef.current = '';
        bufferRef.current += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribeSerial();
      window.removeEventListener('wondersale_rfid_scan', handleWindowScan);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const performInspection = async (uid) => {
    const clean = (uid || '').trim().toUpperCase();
    if (!clean) return;

    setInspecting(true);
    setError(null);
    try {
      const res = await inspectCard(clean);
      setCardResult(res);
      if (res.is_assigned) {
        playVipAcceptedSound();
      } else {
        playVipReadySound();
      }
    } catch (err) {
      setError(err.message || 'Failed to inspect card details');
      playVipRejectedSound();
    } finally {
      setInspecting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (cardUidInput.trim()) {
      performInspection(cardUidInput);
    }
  };

  const handleCopyUid = () => {
    if (!cardUidInput && !cardResult?.card_uid) return;
    const uidToCopy = cardResult?.card_uid || cardUidInput;
    navigator.clipboard.writeText(uidToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClear = () => {
    setCardUidInput('');
    setCardResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.focus();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--bg-surface-solid)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-hover)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--brand-primary), #E11D48)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(197, 34, 36, 0.25)',
              }}
            >
              <Search size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Check Card Ownership
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: sourceArea === 'employee' ? 'rgba(197, 34, 36, 0.12)' : sourceArea === 'customer' ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-info-bg)',
                    color: sourceArea === 'employee' ? 'var(--brand-primary)' : sourceArea === 'customer' ? 'var(--color-warning)' : 'var(--color-info)',
                  }}
                >
                  {sourceArea === 'employee' ? 'Staff Area' : sourceArea === 'customer' ? 'VIP Area' : 'Global Check'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Inspect any RFID card to identify Employee or VIP Customer assignment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ width: '34px', height: '34px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {/* Card Tap / Input Search Bar */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Tap Card on USB Reader or Enter Card UID:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Radio size={18} className="animate-pulse" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan or enter UID (e.g. 50E1AB61)"
                  value={cardUidInput}
                  onChange={(e) => setCardUidInput(e.target.value)}
                  className="input-field"
                  style={{
                    width: '100%',
                    paddingLeft: '44px',
                    paddingRight: '36px',
                    height: '46px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    backgroundColor: 'var(--bg-input)',
                  }}
                />
                {cardUidInput && (
                  <button
                    type="button"
                    onClick={handleClear}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!cardUidInput.trim() || inspecting}
                className="btn btn-primary"
                style={{ height: '46px', padding: '0 20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {inspecting ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                <span>Inspect</span>
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* INSPECTION RESULTS DISPLAY */}
          {inspecting ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--brand-primary)' }} />
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Inspecting card across database...</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Checking Employee attendance registry and Customer VIP records
              </p>
            </div>
          ) : cardResult ? (
            <div>
              {/* STATUS 1: UNASSIGNED / FREE CARD */}
              {!cardResult.is_assigned && (
                <div
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-success-bg)',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 14px',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(16, 185, 129, 0.25)',
                      color: 'var(--color-success)',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '10px',
                    }}
                  >
                    🟢 Unassigned & Available
                  </span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    Card is Ready for Use
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.4 }}>
                    UID <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{cardResult.card_uid}</strong> is not assigned to any Employee or Customer. You can safely register it.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                    >
                      {copied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
                      <span>{copied ? 'Copied UID!' : 'Copy UID'}</span>
                    </button>
                    {onUseCard && (
                      <button
                        type="button"
                        onClick={() => {
                          onUseCard(cardResult.card_uid);
                          onClose();
                        }}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700 }}
                      >
                        <Sparkles size={14} />
                        <span>Use This Card</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STATUS 2: EMPLOYEE ATTENDANCE CARD */}
              {cardResult.assigned_type === 'employee' && cardResult.employee && (
                <div
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid rgba(197, 34, 36, 0.4)',
                    backgroundColor: 'var(--bg-surface-hover)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Domain Badge Banner */}
                  <div
                    style={{
                      padding: '12px 18px',
                      background: 'linear-gradient(135deg, rgba(197, 34, 36, 0.16), rgba(197, 34, 36, 0.04))',
                      borderBottom: '1px solid rgba(197, 34, 36, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={18} style={{ color: 'var(--brand-primary)' }} />
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Employee Attendance Card
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: cardResult.employee.is_active ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        color: cardResult.employee.is_active ? 'var(--color-success)' : 'var(--color-danger)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      {cardResult.employee.is_active ? 'Active Staff' : 'Inactive'}
                    </span>
                  </div>

                  {/* Cross-Area Warning if scanned in Customer VIP area */}
                  {sourceArea === 'customer' && (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                        color: 'var(--color-danger)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                      <span>
                        Notice: This card is already registered for Employee Attendance. It cannot be assigned as a Customer VIP card.
                      </span>
                    </div>
                  )}

                  {/* Employee Details Card */}
                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid var(--brand-primary)',
                          backgroundColor: 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {cardResult.employee.photo_url ? (
                          <img
                            src={cardResult.employee.photo_url}
                            alt={cardResult.employee.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <User size={28} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {cardResult.employee.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: 'var(--brand-primary)',
                              backgroundColor: 'rgba(197, 34, 36, 0.12)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-xs)',
                            }}
                          >
                            {cardResult.employee.employee_code}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {cardResult.employee.designation || cardResult.employee.department || 'Staff Member'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Assigned Store
                        </div>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{cardResult.employee.store_name || 'Primary Store'}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Phone Number
                        </div>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{cardResult.employee.phone || 'N/A'}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Card UID
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-primary)' }}>
                          {cardResult.card_uid}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Card Issued
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {cardResult.employee.assigned_at ? formatDateTime12h(cardResult.employee.assigned_at) : 'Active'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STATUS 3: CUSTOMER VIP CARD */}
              {cardResult.assigned_type === 'customer' && cardResult.customer && (
                <div
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid rgba(245, 158, 11, 0.45)',
                    backgroundColor: 'var(--bg-surface-hover)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Domain Badge Banner */}
                  <div
                    style={{
                      padding: '12px 18px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.04))',
                      borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Crown size={18} style={{ color: '#F59E0B' }} />
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Customer VIP Card
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        color: '#F59E0B',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      {cardResult.customer.vip_tier || 'VIP Member'}
                    </span>
                  </div>

                  {/* Cross-Area Warning if scanned in Employee Staff area */}
                  {sourceArea === 'employee' && (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                        color: 'var(--color-danger)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                      <span>
                        Notice: This card is already registered as a Customer VIP card. It cannot be assigned as an Employee Attendance card.
                      </span>
                    </div>
                  )}

                  {/* Customer Details Card */}
                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '14px',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          border: '2px solid rgba(245, 158, 11, 0.4)',
                          color: '#F59E0B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Crown size={30} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {cardResult.customer.name || cardResult.customer.display_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '2px' }}>
                          <Phone size={13} />
                          <span>{cardResult.customer.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          VIP Credit Balance
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Wallet size={15} />
                          <span>₹{cardResult.customer.vip_card_balance}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Total VIP Savings
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Coins size={15} />
                          <span>₹{cardResult.customer.total_vip_savings}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Card UID
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F59E0B' }}>
                          {cardResult.card_uid}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Registered Store
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {cardResult.customer.store_name || 'All Stores'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STATUS 4: CONFLICT (BOTH ASSIGNED) */}
              {cardResult.assigned_type === 'both_conflict' && (
                <div
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-danger-bg)',
                    border: '1.5px solid var(--color-danger)',
                    color: 'var(--color-danger)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '1rem', marginBottom: '8px' }}>
                    <ShieldAlert size={22} />
                    <span>Cross-System Conflict Detected</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', lineHeight: 1.4, margin: '0 0 10px' }}>
                    {cardResult.message}
                  </p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.85, margin: 0 }}>
                    Please re-assign or detach this card from either the Employee or Customer module to resolve.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* IDLE SCANNER HELPER */
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '2px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--text-muted)',
                }}
              >
                <CreditCard size={32} />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                Ready to Scan RFID Card
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.4 }}>
                Hold smart card near the USB reader or type the UID in the box above to immediately check its assignment status.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-hover)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                display: 'inline-block',
              }}
            />
            <span>USB Hardware Reader Active</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {cardResult && (
              <button
                type="button"
                onClick={handleClear}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Scan Another
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary"
              style={{ fontSize: '0.84rem', fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
