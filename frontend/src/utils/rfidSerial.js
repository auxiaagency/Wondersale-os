// Web Serial API Hardware Service for Arduino RFID / NFC Card Readers
// Supports Arduino Uno, Nano, Mega, ESP32, USB-UART scanners communicating at 9600 baud

let activePort = null;
let activeReader = null;
let isConnecting = false;
let isConnected = false;
let statusListeners = new Set();
let scanListeners = new Set();

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isRfidConnected() {
  return isConnected;
}

export function getRfidStatus() {
  return {
    isSupported: isWebSerialSupported(),
    isConnected,
    isConnecting,
    portInfo: activePort ? activePort.getInfo() : null,
  };
}

function notifyStatusChange() {
  const status = getRfidStatus();
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('RFID status listener error:', e);
    }
  });
  window.dispatchEvent(new CustomEvent('wondersale_rfid_status_changed', { detail: status }));
}

export function onRfidStatusChange(callback) {
  statusListeners.add(callback);
  callback(getRfidStatus());
  return () => statusListeners.delete(callback);
}

export function onRfidScan(callback) {
  scanListeners.add(callback);
  return () => scanListeners.delete(callback);
}

// Card scan debounce cache to prevent duplicate rapid scans from card hovering
let lastScannedUid = null;
let lastScanTimestamp = 0;
const SCAN_DEBOUNCE_MS = 2000;

function handleExtractedUid(rawString) {
  const trimmed = rawString.trim();
  if (!trimmed) return null;

  let uid = null;

  // 1. Try parsing JSON format: {"uid": "50E1AB61"}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.uid) uid = String(parsed.uid).trim();
      else if (parsed.card_uid) uid = String(parsed.card_uid).trim();
      else if (parsed.id) uid = String(parsed.id).trim();
    } catch (e) {
      // Fall through to regex
    }
  }

  // 2. Try JSON regex fallback
  if (!uid) {
    const jsonMatch = trimmed.match(/"uid"\s*:\s*"([^"]+)"/i);
    if (jsonMatch) {
      uid = jsonMatch[1].trim();
    }
  }

  // 3. Try plain UID formats (e.g. "50E1AB61", "50 E1 AB 61", "UID: 50E1AB61")
  if (!uid) {
    const hasExplicitPrefix = /^(card\s*uid\s*:|uid\s*:|card\s*:|rfid\s*:)/i.test(trimmed);
    const cleaned = trimmed.replace(/^(card\s*uid\s*:|uid\s*:|card\s*:|rfid\s*:)/i, '').trim();
    // Validate hex sequence (standard RFID card UIDs: 8, 14, 16, or 20 hex chars)
    const normalized = cleaned.replace(/[\s\-_:]/g, '');
    if (/^[0-9A-Fa-f]{8,20}$/.test(normalized)) {
      uid = normalized;
    } else if (hasExplicitPrefix && cleaned.length >= 4 && cleaned.length <= 24) {
      uid = cleaned;
    }
  }

  if (uid) {
    uid = uid.toUpperCase();
    const now = Date.now();

    // 2-Second Hardware Debounce Guard: prevent identical card tap spam
    if (lastScannedUid === uid && now - lastScanTimestamp < SCAN_DEBOUNCE_MS) {
      return null;
    }

    lastScannedUid = uid;
    lastScanTimestamp = now;

    // Dispatch to listeners and window
    scanListeners.forEach((listener) => {
      try {
        listener(uid, trimmed);
      } catch (e) {
        console.error('RFID scan callback error:', e);
      }
    });

    window.dispatchEvent(
      new CustomEvent('wondersale_rfid_scan', {
        detail: { uid, raw: trimmed, timestamp: now },
      })
    );
    return uid;
  }

  return null;
}

/**
 * Connect to USB Serial Port (e.g. Arduino Uno on COM5)
 */
export async function connectRfidReader(options = { baudRate: 9600 }) {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
  }

  if (isConnected) {
    return true;
  }

  isConnecting = true;
  notifyStatusChange();

  try {
    // Request port selection from user
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: options.baudRate || 9600 });

    activePort = port;
    isConnected = true;
    isConnecting = false;
    notifyStatusChange();

    // Start background stream processing
    startReadLoop(port);

    // Save connection state
    try {
      localStorage.setItem('wondersale_rfid_connected', 'true');
    } catch (e) {}

    return true;
  } catch (err) {
    isConnecting = false;
    isConnected = false;
    activePort = null;
    notifyStatusChange();

    if (err.name === 'NotFoundError') {
      // User cancelled port picker
      return false;
    }

    if (err.message && err.message.includes('Failed to open serial port')) {
      throw new Error(
        'Failed to open COM port! If Arduino IDE Serial Monitor is open, please close the Serial Monitor first (Windows only allows one app to access the COM port at a time).'
      );
    }

    throw err;
  }
}

/**
 * Try auto-reconnecting to previously authorized USB ports
 */
export async function autoReconnectRfidReader(options = { baudRate: 9600 }) {
  if (!isWebSerialSupported() || isConnected || isConnecting) return false;

  try {
    const ports = await navigator.serial.getPorts();
    if (ports && ports.length > 0) {
      const port = ports[0];
      await port.open({ baudRate: options.baudRate || 9600 });

      activePort = port;
      isConnected = true;
      notifyStatusChange();

      startReadLoop(port);
      return true;
    }
  } catch (e) {
    console.warn('Auto-reconnecting RFID reader failed or port in use:', e);
  }
  return false;
}

/**
 * Background streaming loop with line buffering and stream decoding
 */
async function startReadLoop(port) {
  let buffer = '';

  try {
    while (port.readable && isConnected) {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      activeReader = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          if (value) {
            buffer += value;
            const lines = buffer.split(/[\r\n]+/);
            // Retain unfinished partial chunk in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              handleExtractedUid(line);
            }
          }
        }
      } catch (streamErr) {
        console.warn('RFID stream read error:', streamErr);
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {}
      }

      await readableStreamClosed.catch(() => {});
    }
  } catch (err) {
    console.error('RFID Port read loop encountered error:', err);
  } finally {
    isConnected = false;
    activePort = null;
    activeReader = null;
    notifyStatusChange();
  }
}

/**
 * Disconnect and close the USB serial port
 */
export async function disconnectRfidReader() {
  isConnected = false;
  if (activeReader) {
    try {
      await activeReader.cancel();
    } catch (e) {}
    activeReader = null;
  }

  if (activePort) {
    try {
      await activePort.close();
    } catch (e) {}
    activePort = null;
  }

  try {
    localStorage.removeItem('wondersale_rfid_connected');
  } catch (e) {}

  notifyStatusChange();
  return true;
}

// Global keyboard simulation listener (for USB RFID readers in Keyboard wedge mode)
let keyBuffer = '';
let lastKeyTime = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // If the event was already handled and consumed by a barcode scanner, skip
    if (e.defaultPrevented) return;

    const now = Date.now();

    // Key presses faster than 50ms interval usually come from a USB barcode/RFID scanner
    if (now - lastKeyTime > 120) {
      keyBuffer = '';
    }
    lastKeyTime = now;

    if (e.key === 'Enter') {
      if (keyBuffer.length >= 4) {
        handleExtractedUid(keyBuffer);
      }
      keyBuffer = '';
    } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      keyBuffer += e.key;
    }
  });

  // Hardware Unplug / Disconnect listener
  if (typeof navigator !== 'undefined' && 'serial' in navigator) {
    navigator.serial.addEventListener('disconnect', (event) => {
      console.warn('RFID hardware disconnected from USB port', event);
      disconnectRfidReader().catch(() => {});
    });
  }

  // Attempt auto-reconnect on page load if previously enabled
  if (typeof localStorage !== 'undefined' && localStorage.getItem('wondersale_rfid_connected') === 'true') {
    setTimeout(() => {
      autoReconnectRfidReader().catch(() => {});
    }, 1000);
  }
}
