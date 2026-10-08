import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  User,
  ArrowRight,
  Sparkles,
  X,
  Phone,
} from 'lucide-react';
import ProfileLightboxModal from './ProfileLightboxModal';
import { sendKioskTap, previewKioskTap } from '../api';
import { formatTime12h, formatDateTime12h } from '../utils/timeFormat';
import { formatPhoneNumber } from '../utils/phoneFormat';
import {
  connectRfidReader,
  disconnectRfidReader,
  isRfidConnected,
  isWebSerialSupported,
  getRfidStatus,
  onRfidStatusChange,
  autoReconnectRfidReader,
  onRfidScan,
} from '../utils/rfidSerial';
import {
  playVipReadySound,
  playVipAcceptedSound,
  playVipRejectedSound,
} from '../utils/vipCardSounds';

// Pleasant synthetic audio feedback via Web Audio API
function playChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Harmonic major chord chime (C5 -> E5 -> G5)
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });
    } else if (type === 'debounce') {
      // Warm double click
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Low dual error buzz
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (err) {
    console.debug('Audio chime skipped', err);
  }
}

export default function KioskView({ store, currentUser, onClose }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cardInput, setCardInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'debounce'|'error', data: ... }
  const [recentTaps, setRecentTaps] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [rfidStatus, setRfidStatus] = useState(getRfidStatus());
  const [isConnectingRfid, setIsConnectingRfid] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Kiosk Tap Confirmation Modal & 30s Debounce Protection
  const [pendingTap, setPendingTap] = useState(null);
  const [confirmCountdown, setConfirmCountdown] = useState(15);
  const [isConfirming, setIsConfirming] = useState(false);

  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const feedbackTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const lastProcessedUidRef = useRef({ uid: '', timestamp: 0 });
  const lastConfirmedPunchesRef = useRef({}); // { [uid]: { time: number, direction: string, empName: string, empCode: string, photo: string } }

  // Auto-cancel timer when confirmation modal is active (15s safety auto-cancel)
  useEffect(() => {
    if (pendingTap) {
      setConfirmCountdown(15);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setConfirmCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            setPendingTap(null);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [pendingTap]);

  // WebSerial Hardware Integration (Compatible with Billing & VIP Card Reader)
  useEffect(() => {
    const unsubscribeStatus = onRfidStatusChange((status) => {
      setRfidStatus(status);
    });

    autoReconnectRfidReader().catch(() => {});

    const unsubscribeScan = onRfidScan((rawUid) => {
      handleTapSubmit(rawUid);
    });

    const handleWindowScan = (e) => {
      if (e.detail?.uid) {
        handleTapSubmit(e.detail.uid);
      }
    };
    window.addEventListener('wondersale_rfid_scan', handleWindowScan);

    return () => {
      unsubscribeStatus();
      unsubscribeScan();
      window.removeEventListener('wondersale_rfid_scan', handleWindowScan);
    };
  }, [store, currentUser]);

  const handleConnectRfid = async () => {
    setIsConnectingRfid(true);
    try {
      const connected = await connectRfidReader({ baudRate: 9600 });
      if (connected) {
        playVipReadySound();
      }
    } catch (err) {
      alert(err.message || 'Failed to connect USB RFID reader.');
    } finally {
      setIsConnectingRfid(false);
    }
  };

  // Live Digital Clock (HH:MM:SS)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep hidden input focused for USB Keyboard-wedge scanners
  useEffect(() => {
    const keepFocus = () => {
      if (!manualMode && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };
    const interval = setInterval(keepFocus, 1000);
    window.addEventListener('click', keepFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', keepFocus);
    };
  }, [manualMode]);

  // Global Keydown Listener for USB RFID Readers (Keystroke wedge terminating with Enter)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If user is typing in a modal or manual text input, ignore global grabber
      if (manualMode) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Scanners type fast (<50ms per key)
      if (e.key === 'Enter') {
        const raw = bufferRef.current.trim();
        bufferRef.current = '';
        if (raw.length >= 4) {
          e.preventDefault();
          handleTapSubmit(raw);
        }
      } else if (e.key.length === 1) {
        // Reset buffer if delay is too long (human typing) unless continuous
        if (timeDiff > 250) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manualMode, store]);

  const handleTapSubmit = async (uid) => {
    const cleanUid = (uid || '').trim().toUpperCase();
    if (!cleanUid) return;

    // Prevent immediate re-trigger from dual events within 1.5 seconds
    const now = Date.now();
    if (
      lastProcessedUidRef.current.uid === cleanUid &&
      now - lastProcessedUidRef.current.timestamp < 1500
    ) {
      return;
    }
    lastProcessedUidRef.current = { uid: cleanUid, timestamp: now };

    // 1. Check 30-Second Client-Side Debounce Protection
    const lastPunch = lastConfirmedPunchesRef.current[cleanUid];
    if (lastPunch) {
      const elapsedSec = Math.floor((now - lastPunch.time) / 1000);
      if (elapsedSec < 30) {
        const remainingSec = 30 - elapsedSec;
        if (soundEnabled) playChime('debounce');
        setFeedback({
          type: 'debounce',
          title: 'Already Recorded (30s Debounce)',
          message: `Already clocked ${lastPunch.direction || 'attendance'} ${elapsedSec}s ago. Please wait ${remainingSec}s before tapping again.`,
          employee: {
            name: lastPunch.empName,
            code: lastPunch.empCode,
            photo: lastPunch.photo,
          },
          timestamp: new Date().toISOString(),
        });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
        return;
      }
    }

    if (isProcessing) return;
    setIsProcessing(true);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    try {
      const storeId = store?.id || (currentUser?.store ? currentUser.store : null);
      const res = await previewKioskTap(cleanUid, storeId);

      if (res.success && res.debounced) {
        // Debounce notice from server
        if (soundEnabled) playChime('debounce');
        setFeedback({
          type: 'debounce',
          title: 'Already Recorded',
          message: res.message || 'Already tapped recently.',
          employee: {
            name: res.employee_name,
            code: res.employee_code,
            phone: res.phone || '',
            photo: res.photo_url,
          },
          timestamp: res.punched_at || new Date().toISOString(),
        });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
      } else if (res.success) {
        // Valid card tap -> Open Action Confirmation Modal for Preview & Confirm
        if (soundEnabled) {
          playVipReadySound();
        }
        setPendingTap({
          uid: cleanUid,
          storeId,
          employee: {
            id: res.employee_id,
            name: res.employee_name,
            code: res.employee_code,
            phone: res.phone || '',
            department: res.department,
            designation: res.designation,
            photo: res.photo_url,
          },
          direction: res.direction || 'IN',
          shiftName: res.shift_name,
          shiftRange: res.shift_range_12h,
          lastInTime: res.last_in_time,
          elapsedMinutes: res.elapsed_minutes,
          elapsedFormatted: res.elapsed_formatted,
          isOutsideWindow: res.is_outside_window,
          timestamp: new Date(),
        });
      } else {
        // Error / Rejection
        if (soundEnabled) {
          playVipRejectedSound();
          playChime('error');
        }
        const errorTitle =
          res.error_code === 'shift_not_started'
            ? 'Shift Not Started'
            : res.error_code === 'shift_already_ended'
            ? 'Shift Ended'
            : res.error_code === 'no_shift_scheduled'
            ? 'No Shift Scheduled'
            : res.error_code === 'inactive_employee'
            ? 'Employee Inactive'
            : res.error_code === 'wrong_store'
            ? 'Store Mismatch'
            : 'Tap Rejected';

        setFeedback({
          type: 'error',
          title: errorTitle,
          message: res.message || 'Unrecognized RFID card.',
          errorCode: res.error_code,
          card_uid: cleanUid,
          employee: res.employee_name
            ? {
                name: res.employee_name,
                code: res.employee_code,
                phone: res.phone || '',
                photo: res.photo_url,
              }
            : null,
          shift_name: res.shift_name,
          shift_range_12h: res.shift_range_12h,
        });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4200);
      }
    } catch (err) {
      if (soundEnabled) {
        playVipRejectedSound();
        playChime('error');
      }
      setFeedback({
        type: 'error',
        title: 'Connection Error',
        message: err.message || 'Unable to communicate with server.',
      });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4200);
    } finally {
      setIsProcessing(false);
      setCardInput('');
    }
  };

  const handleConfirmPunch = async () => {
    if (!pendingTap || isConfirming) return;
    setIsConfirming(true);

    try {
      const res = await sendKioskTap(pendingTap.uid, pendingTap.storeId);
      if (res.success && res.debounced) {
        if (soundEnabled) playChime('debounce');
        setFeedback({
          type: 'debounce',
          title: 'Already Recorded',
          message: res.message || 'Already recorded recently.',
          employee: {
            name: res.employee_name || pendingTap.employee.name,
            code: res.employee_code || pendingTap.employee.code,
            phone: res.phone || pendingTap.employee.phone,
            photo: res.photo_url || pendingTap.employee.photo,
          },
          timestamp: res.punched_at || new Date().toISOString(),
        });
      } else if (res.success) {
        const direction = res.direction || pendingTap.direction;
        // Record timestamp for 30s debounce protection
        lastConfirmedPunchesRef.current[pendingTap.uid] = {
          time: Date.now(),
          direction,
          empName: pendingTap.employee.name,
          empCode: pendingTap.employee.code,
          photo: pendingTap.employee.photo,
        };

        if (soundEnabled) {
          playVipAcceptedSound();
          playChime('success');
        }
        const newTap = {
          id: Date.now(),
          employee_name: res.employee_name || pendingTap.employee.name,
          employee_code: res.employee_code || pendingTap.employee.code,
          photo_url: res.photo_url || pendingTap.employee.photo,
          direction,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
          card_uid: pendingTap.uid,
          shift_name: res.shift_name || pendingTap.shiftName,
        };
        setRecentTaps((prev) => [newTap, ...prev.slice(0, 5)]);

        setFeedback({
          type: 'success',
          direction,
          title: direction === 'IN' ? 'Clocked In Successfully' : 'Clocked Out Successfully',
          message: res.message || `Have a great ${direction === 'IN' ? 'shift' : 'evening'}!`,
          employee: {
            name: res.employee_name || pendingTap.employee.name,
            code: res.employee_code || pendingTap.employee.code,
            phone: res.phone || pendingTap.employee.phone,
            photo: res.photo_url || pendingTap.employee.photo,
          },
          shift: res.shift_name || pendingTap.shiftName,
          timestamp: res.punched_at || new Date().toISOString(),
        });
      } else {
        if (soundEnabled) {
          playVipRejectedSound();
          playChime('error');
        }
        setFeedback({
          type: 'error',
          title: 'Tap Rejected',
          message: res.message || 'Failed to record attendance punch.',
          errorCode: res.error_code,
          card_uid: pendingTap.uid,
        });
      }
    } catch (err) {
      if (soundEnabled) {
        playVipRejectedSound();
        playChime('error');
      }
      setFeedback({
        type: 'error',
        title: 'Connection Error',
        message: err.message || 'Unable to communicate with server.',
      });
    } finally {
      setIsConfirming(false);
      setPendingTap(null);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
        if (inputRef.current) inputRef.current.focus();
      }, 3500);
    }
  };

  const handleCancelPunch = () => {
    setPendingTap(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (cardInput.trim()) {
      handleTapSubmit(cardInput);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Hidden input for USB Keyboard-wedge capture */}
      <input
        ref={inputRef}
        type="text"
        value={cardInput}
        onChange={(e) => setCardInput(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          top: -100,
          left: -100,
        }}
      />

      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--brand-primary), #E11D48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(197, 34, 36, 0.25)',
            }}
          >
            <Radio size={24} className="animate-pulse" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {store?.name || 'Flagship Store'}
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                    boxShadow: '0 0 8px var(--color-success)',
                  }}
                />
                Kiosk Ready
              </span>

              {rfidStatus.isConnected ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Disconnect USB RFID Reader?')) {
                      disconnectRfidReader();
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                  }}
                  title="Arduino / ESP32 RFID Reader active on USB COM port (same as Billing). Click to disconnect."
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#10B981',
                      boxShadow: '0 0 8px #10B981',
                    }}
                  />
                  USB Reader Active
                </button>
              ) : rfidStatus.isSupported ? (
                <button
                  type="button"
                  onClick={handleConnectRfid}
                  disabled={isConnectingRfid}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366F1',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    cursor: 'pointer',
                  }}
                  title="Connect Arduino / ESP32 USB RFID Reader (same as Billing and VIP Card adding)"
                >
                  <Radio size={12} />
                  <span>{isConnectingRfid ? 'Connecting...' : 'Connect USB Reader'}</span>
                </button>
              ) : null}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Wondersale RFID Attendance Terminal
            </p>
          </div>
        </div>

        {/* Live Clock */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            title={soundEnabled ? 'Mute Chimes' : 'Unmute Chimes'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            onClick={() => setManualMode(!manualMode)}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.84rem', fontWeight: 600 }}
          >
            {manualMode ? 'Card Mode' : 'Keypad'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-danger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '8px 16px',
            }}
          >
            <LogOut size={16} />
            <span>Exit Kiosk</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="wait">
          {!feedback ? (
            /* IDLE STATE: Waiting for card tap */
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                maxWidth: '540px',
              }}
            >
              {/* Outer Pulsing Wave */}
              <div style={{ position: 'relative', marginBottom: '32px' }}>
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    inset: '-24px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)',
                    zIndex: 0,
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface)',
                    border: '3px solid var(--brand-primary)',
                    boxShadow: '0 0 35px rgba(197, 34, 36, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <CreditCard size={68} style={{ color: 'var(--brand-primary)' }} />
                </motion.div>
              </div>

              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                Please Tap Your RFID Card
              </h1>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', margin: '0 0 28px', lineHeight: 1.5 }}>
                Tap your smart card on the USB / Arduino RFID reader to automatically register your shift attendance.
              </p>

              {/* Manual Input Fallback for testing / keypad */}
              {manualMode && (
                <form
                  onSubmit={handleManualSubmit}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    width: '100%',
                    maxWidth: '420px',
                    marginTop: '8px',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter Card UID (e.g. 50E1AB61)"
                    value={cardInput}
                    onChange={(e) => setCardInput(e.target.value)}
                    autoFocus
                    className="input-field"
                    style={{ flex: 1, padding: '12px 16px', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    type="submit"
                    disabled={!cardInput.trim() || isProcessing}
                    className="btn btn-primary"
                    style={{ padding: '12px 20px', fontWeight: 700 }}
                  >
                    Tap
                  </button>
                </form>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  marginTop: '16px',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--brand-accent)' }} />
                <span>Instant biometric-grade derivation (No buttons needed)</span>
              </div>
            </motion.div>
          ) : feedback.type === 'success' ? (
            /* SUCCESS FEEDBACK CARD */
            <motion.div
              key="success"
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--color-success)',
                boxShadow: '0 20px 50px rgba(16, 185, 129, 0.22)',
                padding: '36px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Top Accent Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-pill)',
                  background: feedback.direction === 'IN' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(59, 130, 246, 0.16)',
                  color: feedback.direction === 'IN' ? 'var(--color-success)' : 'var(--color-info)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                }}
              >
                <CheckCircle2 size={18} />
                <span>{feedback.direction === 'IN' ? 'Shift Clock-In' : 'Shift Clock-Out'}</span>
              </div>

              {/* Employee Avatar */}
              <div
                onClick={() => {
                  if (feedback.employee?.photo) {
                    setLightboxImage({
                      src: feedback.employee.photo,
                      name: feedback.employee.name,
                      code: feedback.employee.code,
                      phone: feedback.employee.phone,
                      role: feedback.shift,
                    });
                  }
                }}
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  margin: '0 auto 18px',
                  border: '4px solid var(--color-success)',
                  overflow: 'hidden',
                  background: 'var(--bg-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(16, 185, 129, 0.35)',
                  cursor: feedback.employee?.photo ? 'zoom-in' : 'default',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1)';
                }}
                title={feedback.employee?.photo ? 'Click to enlarge profile photo' : undefined}
              >
                {feedback.employee?.photo ? (
                  <img
                    src={feedback.employee.photo}
                    alt={feedback.employee.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={72} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>

              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 4px' }}>
                {feedback.employee?.name}
              </h2>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  margin: '0 0 6px',
                }}
              >
                ID: {feedback.employee?.code}
              </p>

              {feedback.employee?.phone && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.92rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    margin: '0 0 16px',
                    background: 'var(--bg-surface-hover)',
                    padding: '4px 14px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  <Phone size={14} style={{ color: 'var(--color-success)' }} />
                  <span>{formatPhoneNumber(feedback.employee.phone)}</span>
                </div>
              )}

              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  margin: '0 0 20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', fontFamily: 'var(--font-mono)' }}>
                    {new Date(feedback.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </div>
                </div>
                {feedback.shift && (
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shift</div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{feedback.shift}</div>
                  </div>
                )}
              </div>

              <p style={{ fontSize: '0.95rem', color: 'var(--color-success)', fontWeight: 600, margin: 0 }}>
                {feedback.message}
              </p>

              {/* Progress bar timer */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.2, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '4px',
                  background: 'var(--color-success)',
                }}
              />
            </motion.div>
          ) : feedback.type === 'debounce' ? (
            /* DEBOUNCE NOTICE */
            <motion.div
              key="debounce"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--color-warning)',
                boxShadow: '0 16px 40px rgba(245, 158, 11, 0.18)',
                padding: '32px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => {
                  if (feedback.employee?.photo) {
                    setLightboxImage({
                      src: feedback.employee.photo,
                      name: feedback.employee.name,
                      code: feedback.employee.code,
                      phone: feedback.employee.phone,
                    });
                  }
                }}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  overflow: 'hidden',
                  border: '3px solid var(--color-warning)',
                  cursor: feedback.employee?.photo ? 'zoom-in' : 'default',
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.25)',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1)';
                }}
                title={feedback.employee?.photo ? 'Click to enlarge profile photo' : undefined}
              >
                {feedback.employee?.photo ? (
                  <img src={feedback.employee.photo} alt={feedback.employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Clock size={44} />
                )}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px' }}>
                {feedback.employee?.name}
              </h2>
              {feedback.employee?.phone && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>
                  <Phone size={13} style={{ color: 'var(--color-warning)' }} />
                  <span>{formatPhoneNumber(feedback.employee.phone)}</span>
                </div>
              )}
              <p style={{ fontSize: '1.02rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                {feedback.message}
              </p>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Your punch is already registered. Please proceed.
              </span>

              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 2.8, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '4px',
                  background: 'var(--color-warning)',
                }}
              />
            </motion.div>
          ) : (
            /* REJECTION / ERROR CARD */
            <motion.div
              key="error"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '500px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--color-danger)',
                boxShadow: '0 16px 40px rgba(239, 68, 68, 0.18)',
                padding: '32px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <XCircle size={36} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px', color: 'var(--color-danger)' }}>
                {feedback.title}
              </h2>

              {feedback.employee?.name && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div
                    onClick={() => {
                      if (feedback.employee?.photo) {
                        setLightboxImage({
                          src: feedback.employee.photo,
                          name: feedback.employee.name,
                          code: feedback.employee.code,
                          phone: feedback.employee.phone,
                          role: feedback.shift_name,
                        });
                      }
                    }}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid var(--color-danger)',
                      background: 'var(--bg-surface-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: feedback.employee.photo ? 'zoom-in' : 'default',
                      boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (feedback.employee?.photo) e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={feedback.employee?.photo ? 'Click to enlarge profile photo' : undefined}
                  >
                    {feedback.employee.photo ? (
                      <img src={feedback.employee.photo} alt={feedback.employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={40} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{feedback.employee.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span className="mono">ID: {feedback.employee.code}</span>
                      {feedback.employee.phone && (
                        <>
                          <span>•</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{formatPhoneNumber(feedback.employee.phone)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.4 }}>
                {feedback.message}
              </p>

              {feedback.shift_name && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--color-danger)',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}
                >
                  <Clock size={14} />
                  <span>{feedback.shift_name} {feedback.shift_range_12h ? `(${feedback.shift_range_12h})` : ''}</span>
                </div>
              )}

              {feedback.card_uid && !feedback.employee?.name && (
                <div
                  style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-hover)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  UID: {feedback.card_uid}
                </div>
              )}
              <div style={{ marginTop: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {feedback.errorCode === 'shift_not_started' || feedback.errorCode === 'shift_already_ended'
                  ? 'Please tap during your scheduled shift hours or contact your store manager.'
                  : 'Please contact store manager or HR to register your card.'}
              </div>

              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.2, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '4px',
                  background: 'var(--color-danger)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Live Feed: Recent Taps */}
      <footer
        style={{
          padding: '16px 32px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Recent Taps
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: 1 }}>
          {recentTaps.length === 0 ? (
            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Waiting for first employee tap...
            </span>
          ) : (
            recentTaps.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                }}
              >
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: t.direction === 'IN' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
                    color: t.direction === 'IN' ? 'var(--color-success)' : 'var(--color-info)',
                  }}
                >
                  {t.direction}
                </span>
                <span style={{ fontWeight: 700 }}>{t.employee_name}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {t.time}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Wondersale OS v2.0
        </div>
      </footer>

      {/* Tap Action Confirmation Modal */}
      {pendingTap && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isConfirming) handleCancelPunch();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 14, 23, 0.84)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: 'var(--bg-surface-solid, #181c2a)',
              borderRadius: 'var(--radius-xl, 20px)',
              border: pendingTap.direction === 'IN'
                ? '2px solid rgba(16, 185, 129, 0.55)'
                : '2px solid rgba(245, 158, 11, 0.55)',
              boxShadow: pendingTap.direction === 'IN'
                ? '0 25px 60px -10px rgba(16, 185, 129, 0.35)'
                : '0 25px 60px -10px rgba(245, 158, 11, 0.35)',
              padding: '26px 28px 22px',
              position: 'relative',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: pendingTap.direction === 'IN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: pendingTap.direction === 'IN' ? 'var(--color-success, #10B981)' : 'var(--color-warning, #F59E0B)',
                  }}
                >
                  {pendingTap.direction === 'IN' ? <LogIn size={17} /> : <LogOut size={17} />}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Confirm Attendance Action
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelPunch}
                disabled={isConfirming}
                className="btn btn-secondary"
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Employee Information Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg, 14px)',
                background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                marginBottom: '18px',
              }}
            >
              <div
                onClick={() => {
                  if (pendingTap.employee?.photo) {
                    setLightboxImage({
                      src: pendingTap.employee.photo,
                      name: pendingTap.employee.name,
                      code: pendingTap.employee.code,
                      phone: pendingTap.employee.phone,
                      role: pendingTap.employee.designation || pendingTap.employee.department,
                    });
                  }
                }}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3.5px solid var(--brand-primary)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 6px 20px rgba(197, 34, 36, 0.3)',
                  cursor: pendingTap.employee?.photo ? 'zoom-in' : 'default',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (pendingTap.employee?.photo) e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  if (pendingTap.employee?.photo) e.currentTarget.style.transform = 'scale(1)';
                }}
                title={pendingTap.employee?.photo ? 'Click to enlarge profile photo' : undefined}
              >
                {pendingTap.employee.photo ? (
                  <img src={pendingTap.employee.photo} alt={pendingTap.employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={60} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pendingTap.employee.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--brand-primary)',
                      background: 'rgba(197, 34, 36, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {pendingTap.employee.code}
                  </span>
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    {pendingTap.employee.designation || pendingTap.employee.department || 'Staff Member'}
                  </span>
                </div>
                {pendingTap.employee.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    <Phone size={14} style={{ color: 'var(--brand-primary)' }} />
                    <span>{formatPhoneNumber(pendingTap.employee.phone)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Details Card */}
            <div
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--radius-lg, 14px)',
                background: pendingTap.direction === 'IN' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: pendingTap.direction === 'IN' ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(245, 158, 11, 0.35)',
                marginBottom: '22px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: pendingTap.direction === 'IN' ? 'var(--color-success, #10B981)' : 'var(--color-warning, #F59E0B)',
                  marginBottom: '8px',
                }}
              >
                {pendingTap.direction === 'IN' ? <LogIn size={17} /> : <LogOut size={17} />}
                <span>{pendingTap.direction === 'IN' ? 'Action: CLOCK IN' : 'Action: CLOCK OUT'}</span>
              </div>

              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-primary)', margin: '2px 0 8px' }}>
                {pendingTap.direction === 'IN' ? 'Start Shift Attendance' : 'End Shift Attendance'}
              </div>

              {pendingTap.direction === 'IN' ? (
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Shift: <strong style={{ color: 'var(--text-primary)' }}>{pendingTap.shiftName}</strong>
                  {pendingTap.shiftRange && <span> ({pendingTap.shiftRange})</span>}
                </div>
              ) : (
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  {pendingTap.lastInTime && (
                    <span>Clocked in at <strong style={{ color: 'var(--text-primary)' }}>{formatDateTime12h(pendingTap.lastInTime)}</strong> • </span>
                  )}
                  Worked Today: <strong style={{ color: 'var(--color-warning, #F59E0B)' }}>{pendingTap.elapsedFormatted || 'Session Complete'}</strong>
                </div>
              )}

              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={13} />
                <span>Current Time: <strong>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</strong></span>
              </div>

              {pendingTap.isOutsideWindow && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '0.78rem',
                    color: 'var(--color-warning)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-block',
                  }}
                >
                  ⚠️ Note: Tap outside scheduled shift window
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
              <button
                type="button"
                onClick={handleCancelPunch}
                disabled={isConfirming}
                className="btn btn-secondary"
                style={{
                  padding: '13px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  borderRadius: 'var(--radius-md, 10px)',
                }}
              >
                Cancel (Mistake)
              </button>

              <button
                type="button"
                onClick={handleConfirmPunch}
                disabled={isConfirming}
                className="btn btn-primary"
                style={{
                  padding: '13px',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  borderRadius: 'var(--radius-md, 10px)',
                  background: pendingTap.direction === 'IN'
                    ? 'linear-gradient(135deg, #10B981, #059669)'
                    : 'linear-gradient(135deg, #F59E0B, #D97706)',
                  boxShadow: pendingTap.direction === 'IN'
                    ? '0 10px 25px rgba(16, 185, 129, 0.4)'
                    : '0 10px 25px rgba(245, 158, 11, 0.4)',
                  border: 'none',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={18} />
                <span>{isConfirming ? 'Confirming...' : pendingTap.direction === 'IN' ? 'Confirm Clock IN' : 'Confirm Clock OUT'}</span>
              </button>
            </div>

            {/* Auto-cancel Progress Countdown Bar */}
            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Card UID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{pendingTap.uid}</strong></span>
              <span>Auto-cancelling in <strong>{confirmCountdown}s</strong></span>
            </div>
            <div style={{ height: '3px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(confirmCountdown / 15) * 100}%`,
                  background: pendingTap.direction === 'IN' ? 'var(--color-success, #10B981)' : 'var(--color-warning, #F59E0B)',
                  transition: 'width 1s linear',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Profile Photo Modal */}
      {lightboxImage && (
        <ProfileLightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
