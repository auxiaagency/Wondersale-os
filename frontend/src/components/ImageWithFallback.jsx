import React, { useState } from 'react';
import { Package } from 'lucide-react';

export default function ImageWithFallback({
  src,
  alt = 'Product Image',
  style = {},
  className = '',
  iconSize = 20,
  fallbackBg = 'var(--bg-surface, #1e293b)',
  fallbackColor = 'var(--text-muted, #94a3b8)',
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: fallbackBg,
          color: fallbackColor,
          borderRadius: style.borderRadius || 'var(--radius-sm, 6px)',
          ...style,
        }}
        title={alt}
      >
        <Package size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        objectFit: 'cover',
        ...style,
      }}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
