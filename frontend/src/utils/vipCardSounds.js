/**
 * WonderSale VIP RFID Card Audio Effects Engine
 * 
 * High-fidelity, zero-latency procedural Web Audio synthesizer
 * tuned specifically for POS terminals and RFID card reader feedback:
 * 1. 'ready'    - Clean, modern terminal prompt tone ("Place card on reader")
 * 2. 'accepted' - Bright, satisfying POS double-chime ("Card verified / Approved")
 * 3. 'rejected' - Clear, low-frequency warning buzz ("Card denied / Insufficient balance")
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 1. READY TO SCAN SOUND
 * Tone: Soft, modern dual-frequency terminal standby prompt (D5 -> A5)
 */
export function playVipReadySound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Note 1: 587 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Note 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.08);

    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.28);
  } catch (err) {
    console.debug('VIP sound error:', err);
  }
}

/**
 * 2. CARD ACCEPTED / VERIFIED SOUND
 * Tone: High-energy, crisp contactless POS authorization arpeggio (G5 -> C6 -> E6 chime)
 */
export function playVipAcceptedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic layers for rich, bell-like POS authorization chime
    const notes = [
      { freq: 783.99, time: 0.00, dur: 0.14, gain: 0.18 }, // G5
      { freq: 1046.50, time: 0.07, dur: 0.18, gain: 0.22 }, // C6
      { freq: 1318.51, time: 0.14, dur: 0.35, gain: 0.25 }, // E6
    ];

    notes.forEach(({ freq, time, dur, gain: targetGain }) => {
      const startTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Blend of sine and gentle triangle for sparkle
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(targetGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  } catch (err) {
    console.debug('VIP sound error:', err);
  }
}

/**
 * 3. CARD REJECTED / INVALID / INSUFFICIENT BALANCE SOUND
 * Tone: Distinct, authoritative double low warning buzz (240Hz -> 160Hz)
 */
export function playVipRejectedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Double error thuds (0ms and 140ms)
    [0.0, 0.14].forEach((offset) => {
      const startTime = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sawtooth with low-pass filter gives a solid, non-piercing error buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, startTime);
      osc.frequency.exponentialRampToValueAtTime(140, startTime + 0.11);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.11);
    });
  } catch (err) {
    console.debug('VIP sound error:', err);
  }
}

/**
 * Unified helper dispatcher
 */
export function playVipSound(type) {
  if (type === 'ready') playVipReadySound();
  else if (type === 'accepted') playVipAcceptedSound();
  else if (type === 'rejected') playVipRejectedSound();
}

export default {
  playVipReadySound,
  playVipAcceptedSound,
  playVipRejectedSound,
  playVipSound,
};
