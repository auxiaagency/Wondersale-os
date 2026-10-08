import React from 'react';

/**
 * Universal Skeleton Primitive
 */
export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius,
  variant = 'text', // 'text' | 'circle' | 'pill' | 'box' | 'rect'
  style = {},
  className = '',
  ...props
}) {
  const variantClass =
    variant === 'circle'
      ? 'skeleton-circle'
      : variant === 'pill'
      ? 'skeleton-pill'
      : variant === 'box'
      ? 'skeleton-box'
      : variant === 'text'
      ? 'skeleton-text'
      : '';

  return (
    <div
      className={`skeleton ${variantClass} ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: borderRadius || (variant === 'circle' ? '50%' : variant === 'pill' ? 'var(--radius-pill)' : undefined),
        ...style,
      }}
      {...props}
    />
  );
}

/**
 * Skeleton Stats Grid (For Inventory Overview & Dashboard Metrics)
 */
export function SkeletonStatsCards({ count = 4 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <Skeleton width="44px" height="44px" variant="box" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width="60%" height="11px" />
            <Skeleton width="85%" height="22px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Inventory Table Rows
 */
export function SkeletonInventoryRows({ rows = 7, isEditMode = false }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <React.Fragment key={rIdx}>
          <tr style={{ borderBottom: 'none' }}>
            {isEditMode && (
              <td rowSpan={2} style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', width: '32px', borderBottom: '6px solid var(--border-subtle)' }}>
                <Skeleton width="16px" height="16px" style={{ borderRadius: '3px', margin: '0 auto' }} />
              </td>
            )}
            {/* Photo */}
            <td rowSpan={2} style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle', width: '74px', borderBottom: '6px solid var(--border-subtle)' }}>
              <Skeleton width="58px" height="58px" variant="box" style={{ borderRadius: '6px', margin: '0 auto' }} />
            </td>
            {/* Product Details */}
            <td style={{ padding: '14px 10px 8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <Skeleton width={`${60 + (rIdx % 4) * 10}%`} height="14px" />
                <Skeleton width={`${35 + (rIdx % 3) * 10}%`} height="11px" style={{ opacity: 0.6 }} />
              </div>
            </td>
            {/* Subcategories */}
            <td style={{ padding: '14px 8px 8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <Skeleton width="65px" height="22px" variant="pill" />
                {rIdx % 2 === 0 && <Skeleton width="45px" height="22px" variant="pill" />}
              </div>
            </td>
            {/* Barcode */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="88px" height="13px" />
            </td>
            {/* Aisle */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="38px" height="13px" />
            </td>
            {/* Stock */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="75px" height="22px" variant="pill" />
            </td>
            {/* Cost */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="48px" height="13px" />
            </td>
            {/* Selling */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="52px" height="13px" />
            </td>
            {/* MRP */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="46px" height="13px" />
            </td>
            {/* Margin */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="42px" height="13px" />
            </td>
            {/* Weight */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="40px" height="13px" />
            </td>
            {/* Expiry */}
            <td style={{ padding: '14px 8px 8px' }}>
              <Skeleton width="64px" height="13px" />
            </td>
            {/* Actions */}
            <td style={{ padding: '14px 10px 8px', textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: '6px' }}>
                <Skeleton width="28px" height="28px" variant="box" style={{ borderRadius: '6px' }} />
                <Skeleton width="28px" height="28px" variant="box" style={{ borderRadius: '6px' }} />
              </div>
            </td>
          </tr>
          <tr key={`sub-${rIdx}`} style={{ borderBottom: '6px solid var(--border-subtle)', background: 'var(--bg-surface-subtle, rgba(255,255,255,0.015))' }}>
            <td colSpan={12} style={{ padding: '4px 14px 14px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minHeight: '34px' }}>
                <Skeleton width="120px" height="24px" variant="pill" />
                <Skeleton width="100px" height="24px" variant="pill" />
                <Skeleton width="110px" height="24px" variant="pill" />
                <Skeleton width="220px" height="15px" />
              </div>
            </td>
          </tr>
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Skeleton Staff Table Rows
 */
export function SkeletonStaffRows({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Staff ID */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="70px" height="13px" />
          </td>
          {/* Staff Name / Email */}
          <td style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Skeleton width="36px" height="36px" variant="circle" style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <Skeleton width="130px" height="13px" />
                <Skeleton width="90px" height="10px" style={{ opacity: 0.6 }} />
              </div>
            </div>
          </td>
          {/* Role */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="85px" height="22px" variant="pill" />
          </td>
          {/* Store */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="105px" height="22px" variant="pill" />
          </td>
          {/* Section */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="80px" height="22px" variant="pill" />
          </td>
          {/* Status */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="65px" height="22px" variant="pill" />
          </td>
          {/* Last Active */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="90px" height="12px" />
          </td>
          {/* Actions */}
          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', gap: '8px' }}>
              <Skeleton width="30px" height="30px" variant="box" style={{ borderRadius: '6px' }} />
              <Skeleton width="30px" height="30px" variant="box" style={{ borderRadius: '6px' }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton Audit Logs Rows
 */
export function SkeletonAuditRows({ rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Timestamp */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="120px" height="12px" />
          </td>
          {/* Product & Code */}
          <td style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton width="140px" height="13px" />
              <Skeleton width="80px" height="10px" style={{ opacity: 0.6 }} />
            </div>
          </td>
          {/* Store Branch */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="100px" height="20px" variant="pill" />
          </td>
          {/* Performed By Staff */}
          <td style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width="28px" height="28px" variant="circle" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Skeleton width="90px" height="12px" />
                <Skeleton width="60px" height="10px" variant="pill" />
              </div>
            </div>
          </td>
          {/* Transaction Reason */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="110px" height="22px" variant="pill" />
          </td>
          {/* Stock Delta */}
          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
            <Skeleton width="55px" height="22px" variant="pill" style={{ marginLeft: 'auto' }} />
          </td>
          {/* Audit Note */}
          <td style={{ padding: '14px 18px' }}>
            <Skeleton width="130px" height="12px" />
          </td>
          {/* Actions */}
          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
            <Skeleton width="80px" height="26px" variant="box" style={{ borderRadius: '6px', margin: '0 auto' }} />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton Category Tree Grid
 */
export function SkeletonCategoryGrid({ count = 6 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '20px',
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            padding: '22px',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Category Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <Skeleton width="38px" height="38px" variant="box" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <Skeleton width="60%" height="15px" />
                <Skeleton width="80%" height="11px" style={{ opacity: 0.6 }} />
              </div>
            </div>
            <Skeleton width="24px" height="24px" variant="box" style={{ borderRadius: '6px' }} />
          </div>

          {/* Subcategories list skeleton */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px 0' }}>
            <Skeleton width="80px" height="26px" variant="pill" />
            <Skeleton width="95px" height="26px" variant="pill" />
            <Skeleton width="70px" height="26px" variant="pill" />
          </div>

          {/* Bottom Add button */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <Skeleton width="110px" height="24px" variant="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Store Branches Grid (For Settings)
 */
export function SkeletonStoreGrid({ count = 4 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px',
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <Skeleton width="40px" height="40px" variant="box" style={{ borderRadius: 'var(--radius-md)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <Skeleton width="55%" height="16px" />
                <Skeleton width="40%" height="11px" style={{ opacity: 0.6 }} />
              </div>
            </div>
            <Skeleton width="65px" height="22px" variant="pill" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="80%" height="12px" />
            <Skeleton width="60%" height="12px" />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
            <Skeleton width="70px" height="28px" variant="pill" />
            <Skeleton width="70px" height="28px" variant="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}
export default Skeleton;
