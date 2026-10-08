import React, { useState, useMemo } from 'react';
import {
  History,
  ShoppingCart,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Boxes,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  User,
  Clock,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';

export default function ProductActivityLedgers({
  item,
  analytics,
  currencySymbol = 'Rs.',
}) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'movements' | 'valuation'
  const [orderSearch, setOrderSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  const recentSales = analytics?.recent_sales || [];
  const recentMovements = analytics?.recent_movements || [];

  // Filtered orders
  const filteredSales = useMemo(() => {
    if (!orderSearch.trim()) return recentSales;
    const q = orderSearch.toLowerCase();
    return recentSales.filter(
      (s) =>
        (s.invoice_number || '').toLowerCase().includes(q) ||
        (s.cashier_name || '').toLowerCase().includes(q) ||
        (s.date || '').toLowerCase().includes(q)
    );
  }, [recentSales, orderSearch]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (!movementSearch.trim()) return recentMovements;
    const q = movementSearch.toLowerCase();
    return recentMovements.filter(
      (m) =>
        (m.reason || '').toLowerCase().includes(q) ||
        (m.reason_display || '').toLowerCase().includes(q) ||
        (m.performed_by_name || '').toLowerCase().includes(q) ||
        (m.note || '').toLowerCase().includes(q)
    );
  }, [recentMovements, movementSearch]);

  // Valuation metrics
  const cost = parseFloat(item?.cost_price) || 0;
  const sell = parseFloat(item?.selling_price) || 0;
  const qty = parseInt(item?.quantity, 10) || 0;
  const costVal = qty * cost;
  const retailVal = qty * sell;
  const potentialProfit = retailVal - costVal;

  const dailyVelocity = analytics?.performance?.daily_velocity || 0;
  const daysLeft = analytics?.performance?.days_inventory_left;

  // Reorder suggestion logic
  const reorderRecommendation = useMemo(() => {
    if (qty <= 0) {
      const suggest = dailyVelocity > 0 ? Math.ceil(dailyVelocity * 30) : 25;
      return {
        status: 'critical',
        label: 'Out of Stock — Immediate Restock Required',
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        suggestedQty: suggest,
        explanation: `Stock is exhausted. To cover an estimated 30 days at current velocity (${dailyVelocity}/day), reorder ~${suggest} units.`,
      };
    }
    if (qty <= 5 || (daysLeft !== null && daysLeft <= 7)) {
      const suggest = dailyVelocity > 0 ? Math.ceil(dailyVelocity * 30) : 30;
      return {
        status: 'warning',
        label: 'Low Stock Alert — Reorder Recommended',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        suggestedQty: suggest,
        explanation: `Only ${qty} units remaining (${daysLeft ?? '—'} days coverage). Place purchase order soon.`,
      };
    }
    return {
      status: 'healthy',
      label: 'Inventory Healthy & Balanced',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
      suggestedQty: 0,
      explanation: `Current stock of ${qty} units provides comfortable coverage (~${daysLeft ?? '—'} days).`,
    };
  }, [qty, dailyVelocity, daysLeft]);

  return (
    <section
      aria-label="Product Operations and Audit Ledgers"
      className="glass-panel product-ledgers-card"
      style={{
        width: '100%',
        marginTop: '28px',
        borderRadius: '20px',
        padding: '28px 32px',
        background: 'var(--bg-surface-solid, #161B2C)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        boxShadow: 'var(--shadow-md, 0 20px 45px rgba(0,0,0,0.3))',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* 1. SECTION HEADER & NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8',
              flexShrink: 0,
            }}
          >
            <History size={20} />
          </div>
          <div>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary, #F8FAFC)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Operations &amp; Historical Ledgers
            </h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #94A3B8)', margin: '2px 0 0 0' }}>
              Detailed customer transaction records, stock audit trail, and valuation intelligence.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-input, #1E293B)',
            borderRadius: '10px',
            padding: '3px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'orders' ? 700 : 500,
              backgroundColor: activeTab === 'orders' ? '#38BDF8' : 'transparent',
              color: activeTab === 'orders' ? '#0F172A' : 'var(--text-secondary, #94A3B8)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShoppingCart size={13} />
            <span>Recent Orders ({recentSales.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'movements' ? 700 : 500,
              backgroundColor: activeTab === 'movements' ? '#38BDF8' : 'transparent',
              color: activeTab === 'movements' ? '#0F172A' : 'var(--text-secondary, #94A3B8)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <History size={13} />
            <span>Stock Audit Trail ({recentMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('valuation')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'valuation' ? 700 : 500,
              backgroundColor: activeTab === 'valuation' ? '#38BDF8' : 'transparent',
              color: activeTab === 'valuation' ? '#0F172A' : 'var(--text-secondary, #94A3B8)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Boxes size={13} />
            <span>Valuation &amp; Restock</span>
          </button>
        </div>
      </div>

      {/* 2. TAB 1: RECENT CUSTOMER ORDERS */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #64748B)',
                }}
              />
              <input
                type="text"
                placeholder="Search invoice or cashier..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main, #0B0E17)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.80rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)' }}>
              Showing {filteredSales.length} of {recentSales.length} recent orders
            </span>
          </div>

          {/* Table Container */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              backgroundColor: 'var(--bg-main, #0B0E17)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-muted, #94A3B8)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Invoice / Order</th>
                  <th style={{ padding: '12px 16px' }}>Date &amp; Time</th>
                  <th style={{ padding: '12px 16px' }}>Cashier</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Quantity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Discount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                      No sales orders found for this product.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s, idx) => (
                    <tr
                      key={s.order_id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#38BDF8', fontFamily: 'monospace' }}>
                        {s.invoice_number || `#ORD-${s.order_id}`}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #94A3B8)' }}>
                        {s.date || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary, #F8FAFC)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} style={{ opacity: 0.6 }} />
                          {s.cashier_name || 'Counter Staff'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#FBBF24' }}>
                        {s.quantity} pcs
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary, #F8FAFC)' }}>
                        {currencySymbol}{Number(s.unit_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: s.discount > 0 ? '#34D399' : 'var(--text-muted, #64748B)' }}>
                        {s.discount > 0 ? `-${currencySymbol}${Number(s.discount).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#34D399' }}>
                        {currencySymbol}{Number(s.total_price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB 2: INVENTORY MOVEMENT & AUDIT TRAIL */}
      {activeTab === 'movements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #64748B)',
                }}
              />
              <input
                type="text"
                placeholder="Search reason or staff..."
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main, #0B0E17)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.80rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)' }}>
              Showing {filteredMovements.length} audit movement logs
            </span>
          </div>

          {/* Table Container */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              backgroundColor: 'var(--bg-main, #0B0E17)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-muted, #94A3B8)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Date &amp; Time</th>
                  <th style={{ padding: '12px 16px' }}>Reason / Event</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Change</th>
                  <th style={{ padding: '12px 16px' }}>Performed By</th>
                  <th style={{ padding: '12px 16px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                      No stock movement audit entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m, idx) => {
                    const isPositive = m.change > 0;
                    return (
                      <tr
                        key={m.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #94A3B8)' }}>
                          {m.date || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: isPositive ? '#34D399' : '#F87171',
                              border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}
                          >
                            {m.reason_display || m.reason || 'Movement'}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: isPositive ? '#34D399' : '#F87171',
                          }}
                        >
                          {isPositive ? `+${m.change}` : m.change}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary, #F8FAFC)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <User size={12} style={{ opacity: 0.6 }} />
                            {m.performed_by_name || 'System'}
                            {m.performed_by_role && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)' }}>
                                ({m.performed_by_role})
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted, #64748B)', fontStyle: m.note ? 'normal' : 'italic' }}>
                          {m.note || 'No notes attached'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 3: STOCK VALUATION & RESTOCK ADVISOR */}
      {activeTab === 'valuation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Valuation KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-main, #0B0E17)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inventory Capital (at Cost)</span>
              <div style={{ fontSize: '1.40rem', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                {currencySymbol}{costVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {qty} units × {currencySymbol}{cost.toFixed(2)} cost
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-main, #0B0E17)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retail Realization (at Selling)</span>
              <div style={{ fontSize: '1.40rem', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>
                {currencySymbol}{retailVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {qty} units × {currencySymbol}{sell.toFixed(2)} retail
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-main, #0B0E17)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unrealized Gross Profit</span>
              <div style={{ fontSize: '1.40rem', fontWeight: 800, color: potentialProfit >= 0 ? '#A78BFA' : '#F87171', marginTop: '4px' }}>
                {potentialProfit >= 0 ? `+${currencySymbol}` : `-${currencySymbol}`}{Math.abs(potentialProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Gross margin potential in current stock
              </div>
            </div>
          </div>

          {/* Restock Intelligence Box */}
          <div
            style={{
              padding: '18px 22px',
              borderRadius: '14px',
              backgroundColor: reorderRecommendation.bg,
              border: `1px solid ${reorderRecommendation.color}40`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: `${reorderRecommendation.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: reorderRecommendation.color,
                flexShrink: 0,
              }}
            >
              {reorderRecommendation.status === 'critical' ? (
                <AlertTriangle size={20} />
              ) : reorderRecommendation.status === 'warning' ? (
                <AlertTriangle size={20} />
              ) : (
                <ShieldCheck size={20} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '0.90rem', fontWeight: 800, color: reorderRecommendation.color }}>
                {reorderRecommendation.label}
              </div>
              <p style={{ fontSize: '0.80rem', color: 'var(--text-primary, #F8FAFC)', margin: 0, lineHeight: 1.5 }}>
                {reorderRecommendation.explanation}
              </p>
              {reorderRecommendation.suggestedQty > 0 && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #CBD5E1)', marginTop: '4px' }}>
                  Suggested Reorder Quantity:{' '}
                  <strong style={{ color: reorderRecommendation.color, fontSize: '0.84rem' }}>
                    {reorderRecommendation.suggestedQty} units
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
