import React, { useState } from 'react';
import { ScanBarcode, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { fetchItemByUid } from '../api';

export default function BarcodeScannerInput({ onItemFound }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScanSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    // Strip common scanner symbology prefixes (e.g. ]C1, ]e0, etc.)
    const cleanQuery = query.trim().replace(/^\][A-Za-z0-9]{2}/, '').trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError('');

    try {
      let item = await fetchItemByUid(cleanQuery).catch(() => null);
      // Fallback: if numeric and < 7 digits, try zero-padding
      if (!item && /^\d+$/.test(cleanQuery) && cleanQuery.length < 7) {
        item = await fetchItemByUid(cleanQuery.padStart(7, '0')).catch(() => null);
      }
      // Fallback: if leading zeroes exist, try stripped
      if (!item && /^0+[0-9a-z]+$/i.test(cleanQuery)) {
        item = await fetchItemByUid(cleanQuery.replace(/^0+/, '')).catch(() => null);
      }

      if (item) {
        setQuery('');
        onItemFound(item);
      } else {
        setError(`No item found for barcode/UID: "${cleanQuery}"`);
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Lookup failed');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
      <form onSubmit={handleScanSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <ScanBarcode
          size={18}
          style={{
            position: 'absolute',
            left: '12px',
            color: 'var(--brand-primary)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scan barcode or type UID..."
          className="form-input mono"
          style={{
            paddingLeft: '38px',
            paddingRight: '40px',
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-surface)',
            borderColor: error ? 'var(--color-danger)' : 'var(--border-subtle)',
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn btn-primary"
          title="Lookup Barcode"
          style={{
            position: 'absolute',
            right: '4px',
            width: '30px',
            height: '30px',
            padding: 0,
            borderRadius: '50%',
            opacity: query.trim() ? 1 : 0.5,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </form>

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--bg-surface-solid)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            fontSize: '0.78rem',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
