import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Radio,
  CheckCircle2,
  X,
  RefreshCw,
  AlertCircle,
  Trash2,
  Wifi,
  Sparkles,
  Clock,
  Edit3,
  Check,
} from 'lucide-react';
import {
  assignEmployeeCard,
  deactivateEmployeeCard,
  fetchPunchLog,
  inspectCard,
} from '../api';
import { onRfidScan, autoReconnectRfidReader } from '../utils/rfidSerial';
import { playVipAcceptedSound, playVipReadySound, playVipRejectedSound } from '../utils/vipCardSounds';
import { formatTime12h } from '../utils/timeFormat';

export default function AssignCardModal({
  employee,
  storeId,
  onClose,
  onAssigned,
  onDeactivated,
  onShowToast,
}) {
  const [scannedUid, setScannedUid] = useState(employee?.active_card_uid || '');
  const [detectedUid, setDetectedUid] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState(employee?.active_card_uid || '');
  const [reason, setReason] = useState('Contactless card assignment');
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState(null);
  const [cardConflict, setCardConflict] = useState(null);
  const [inspectingUid, setInspectingUid] = useState(false);

  // Recent unassigned taps from kiosk or hardware scanner
  const [recentTaps, setRecentTaps] = useState([]);
  const [loadingTaps, setLoadingTaps] = useState(false);

  // Buffer for USB keyboard-wedge RFID scanners
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());
  const hiddenInputRef = useRef(null);

  // Run live inspection whenever card UID changes
  const checkCardAvailability = async (uid) => {
    if (!uid || uid.length < 4) {
      setCardConflict(null);
      return;
    }
    setInspectingUid(true);
    try {
      const res = await inspectCard(uid);
      if (res.is_assigned) {
        if (res.assigned_type === 'customer' && res.customer) {
          setCardConflict({
            type: 'customer',
            title: 'Customer VIP Card Conflict',
            message: `This card (UID: ${uid}) is already registered as a VIP Card to Customer ${res.customer.display_name} (${res.customer.phone}). A card cannot be both an Employee Attendance card and a Customer VIP card.`,
          });
          playVipRejectedSound();
        } else if (res.assigned_type === 'employee' && res.employee && res.employee.id !== employee?.id) {
          setCardConflict({
            type: 'employee',
            title: 'Other Employee Card Conflict',
            message: `This card (UID: ${uid}) is already assigned to Employee ${res.employee.name} (${res.employee.employee_code}).`,
          });
          playVipRejectedSound();
        } else {
          setCardConflict(null);
        }
      } else {
        setCardConflict(null);
      }
    } catch (err) {
      console.debug('Card inspection check skipped:', err);
    } finally {
      setInspectingUid(false);
    }
  };

  // Handle a card tap from any protocol
  const handleCardTapped = (uid) => {
    if (!uid) return;
    const clean = uid.trim().replace(/[\s\-_:]/g, '').toUpperCase();
    if (clean.length < 4) return;

    playVipAcceptedSound();
    setDetectedUid(clean);
    setScannedUid(clean);
    setManualInput(clean);
    setError(null);
    checkCardAvailability(clean);
  };

  // Play ready sound on mount & listen for WebSerial
  useEffect(() => {
    playVipReadySound();
    autoReconnectRfidReader().catch(() => {});

    // 1. WebSerial scanner listener
    const unsubscribeSerial = onRfidScan((rawUid) => {
      handleCardTapped(rawUid);
    });

    // 2. Custom window event listener (matches Billing and VIP customer scan)
    const handleCustomScan = (e) => {
      if (e.detail && e.detail.uid) {
        handleCardTapped(e.detail.uid);
      }
    };
    window.addEventListener('wondersale_rfid_scan', handleCustomScan);
    window.addEventListener('wondersale_rfid_scanned', handleCustomScan);

    // 3. USB Keyboard-wedge reader listener
    const handleKeyDown = (e) => {
      // If user is actively typing in the audit reason input or manual input box, let regular typing occur
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
        document.activeElement !== hiddenInputRef.current
      ) {
        if (e.key === 'Enter' && bufferRef.current.length >= 4) {
          e.preventDefault();
          handleCardTapped(bufferRef.current);
          bufferRef.current = '';
        }
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const raw = bufferRef.current.trim();
        bufferRef.current = '';
        if (raw.length >= 4) {
          e.preventDefault();
          handleCardTapped(raw);
        }
      } else if (e.key.length === 1) {
        // Scanners send keystrokes rapidly (<150ms)
        if (timeDiff > 250) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Keep hidden input focused to catch wedge scanners
    if (hiddenInputRef.current && !manualMode) {
      hiddenInputRef.current.focus();
    }

    return () => {
      unsubscribeSerial();
      window.removeEventListener('wondersale_rfid_scan', handleCustomScan);
      window.removeEventListener('wondersale_rfid_scanned', handleCustomScan);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [manualMode]);

  const handleConfirmAssign = async (e) => {
    if (e) e.preventDefault();
    const finalUid = manualMode ? manualInput.trim().toUpperCase() : scannedUid;
    if (!finalUid) {
      setError('No RFID card detected yet. Tap a physical card on the reader.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await assignEmployeeCard(employee.id, finalUid, reason);
      if (onShowToast) onShowToast(`Card ${finalUid} successfully linked to ${employee.name}`);
      if (onAssigned) onAssigned();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to assign card');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate active RFID card for ${employee.name}?`)) return;
    setDeactivating(true);
    setError(null);
    try {
      await deactivateEmployeeCard(employee.id, null, 'Manager manual deactivation');
      if (onShowToast) onShowToast(`Card deactivated for ${employee.name}`);
      if (onDeactivated) onDeactivated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to deactivate card');
    } finally {
      setDeactivating(false);
    }
  };

  if (!employee) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(11, 14, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Hidden input to catch USB wedge readers when focus is lost */}
      <input
        ref={hiddenInputRef}
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
        }}
        value=""
        onChange={(e) => {
          if (e.target.value && e.target.value.length >= 4) {
            handleCardTapped(e.target.value);
          }
        }}
      />

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-pill)',
                background: detectedUid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: detectedUid ? 'var(--color-success)' : '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)',
              }}
            >
              <Radio size={22} className={!detectedUid ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Assign RFID Smart Card
              </h3>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {employee.name} • {employee.employee_code}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Current Active Card Banner if already assigned */}
        {employee.active_card_uid && !detectedUid && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Currently Assigned Card
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                {employee.active_card_uid}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="btn btn-danger btn-sm"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              title="Deactivate current card"
            >
              <Trash2 size={13} />
              <span>{deactivating ? 'Revoking...' : 'Deactivate'}</span>
            </button>
          </div>
        )}

        {!manualMode ? (
          /* AUTOMATIC SCANNING ZONE */
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                padding: '28px 20px',
                borderRadius: 'var(--radius-lg)',
                border: detectedUid
                  ? '2px solid var(--color-success)'
                  : '2px dashed var(--brand-primary)',
                background: detectedUid
                  ? 'rgba(16, 185, 129, 0.06)'
                  : 'rgba(197, 34, 36, 0.04)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'var(--transition-smooth)',
              }}
            >
              {detectedUid ? (
                /* Card Detected State */
                <div>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(16, 185, 129, 0.18)',
                      color: 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 14px',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>

                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--color-success-bg)',
                      color: 'var(--color-success)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Card Tap Detected!
                  </span>

                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: cardConflict ? 'var(--color-danger)' : 'var(--text-primary)',
                      margin: '12px 0 6px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {detectedUid}
                  </div>

                  {cardConflict ? (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-danger-bg)',
                        border: '1.5px solid var(--color-danger)',
                        color: 'var(--color-danger)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        margin: '0 0 16px',
                        textAlign: 'left',
                        lineHeight: 1.4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertCircle size={16} />
                        <span>{cardConflict.title}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 500 }}>
                        {cardConflict.message}
                      </p>
                    </div>
                  ) : inspectingUid ? (
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      Checking card availability...
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                      Ready to link with <strong>{employee.name}</strong>.
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDetectedUid(null);
                        setScannedUid('');
                        setCardConflict(null);
                        playVipReadySound();
                        if (hiddenInputRef.current) hiddenInputRef.current.focus();
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <RefreshCw size={14} />
                      <span>Scan Different Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmAssign}
                      disabled={saving || Boolean(cardConflict) || inspectingUid}
                      className="btn btn-primary btn-sm"
                      style={{
                        background: cardConflict ? 'var(--bg-surface-hover)' : 'linear-gradient(135deg, #10B981, #059669)',
                        boxShadow: cardConflict ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)',
                        fontWeight: 800,
                        opacity: cardConflict ? 0.5 : 1,
                        cursor: cardConflict ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Check size={15} />
                      <span>{saving ? 'Linking...' : 'Confirm & Assign'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Waiting for Tap State */
                <div>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(197, 34, 36, 0.1)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 14px',
                      animation: 'pulseRadar 2s infinite',
                    }}
                  >
                    <CreditCard size={32} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--color-success)',
                        display: 'inline-block',
                      }}
                      className="animate-ping"
                    />
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--brand-primary)', letterSpacing: '0.04em' }}>
                      Listening for Card Tap...
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px' }}>
                    Tap Physical Card on Reader Now
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, maxWidth: '360px', marginInline: 'auto' }}>
                    Works automatically with any connected USB RFID reader, contactless scanner, or Arduino WebSerial sensor.
                  </p>
                </div>
              )}
            </div>

            {/* Quick-Pick Recently Tapped Unassigned Cards */}
            {recentTaps.length > 0 && !detectedUid && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Recently Tapped Unassigned Cards
                  </span>
                  <button
                    type="button"
                    onClick={loadRecentTaps}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                    title="Refresh recent taps"
                  >
                    <RefreshCw size={11} className={loadingTaps ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {recentTaps.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleCardTapped(t.card_uid)}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderColor: 'var(--border-strong)',
                      }}
                      title={`Tapped at ${formatTime12h(t.at)}`}
                    >
                      <Sparkles size={13} style={{ color: 'var(--brand-accent)' }} />
                      <span>{t.card_uid}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        ({formatTime12h(t.at)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* MANUAL OVERRIDE INPUT */
          <form onSubmit={handleConfirmAssign} style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label">Card UID (Hexadecimal / Number) *</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. 50E1AB61"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                className="input-field"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.05rem' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Audit Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="btn btn-secondary"
              >
                Back to Tap
              </button>
              <button
                type="submit"
                disabled={saving || !manualInput}
                className="btn btn-primary"
                style={{ fontWeight: 800 }}
              >
                {saving ? 'Assigning...' : 'Assign Card'}
              </button>
            </div>
          </form>
        )}

        {/* Footer Toggle */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setManualMode(!manualMode);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
            }}
          >
            <Edit3 size={13} />
            <span>{manualMode ? 'Switch to Automatic Tap Detector' : 'Need manual typing? Enter UID directly'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
