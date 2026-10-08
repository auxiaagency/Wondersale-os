import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 99999,
          background: '#DC2626',
          color: '#FFFFFF',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.86rem',
          fontWeight: 700,
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
          letterSpacing: '0.01em',
          animation: 'slideDown 0.2s ease-out',
        }}
      >
        <WifiOff size={16} />
        <span>You are currently offline. Check your store network connection.</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 99999,
        background: '#059669',
        color: '#FFFFFF',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontSize: '0.86rem',
        fontWeight: 700,
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
        animation: 'slideDown 0.2s ease-out',
      }}
    >
      <Wifi size={16} />
      <span>Internet connection restored. Synchronized with server.</span>
    </div>
  );
}
