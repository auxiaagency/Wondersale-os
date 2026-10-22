import React, { useState, useMemo, useEffect } from 'react';
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
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import { getSaleOrdersPage, fetchStockMovements } from '../api';

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

export default function ProductActivityLedgers({
  item,
  analytics,
  currencySymbol = 'Rs.',
}) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'movements' | 'valuation'
  const [orderSearch, setOrderSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  // Pagination states
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(15);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(15);

  // Server-side lazy pagination states
  const [serverOrdersData, setServerOrdersData] = useState(null);
  const [serverOrdersLoading, setServerOrdersLoading] = useState(false);
  const [serverMovementsData, setServerMovementsData] = useState(null);
  const [serverMovementsLoading, setServerMovementsLoading] = useState(false);

  // Fallbacks from embedded analytics
  const fallbackSales = analytics?.recent_sales || [];
  const fallbackMovements = analytics?.recent_movements || [];

  // Fetch paginated sales orders on-demand from backend
  const loadOrdersFromServer = async (pageToLoad = orderPage, sizeToLoad = orderPageSize, searchVal = orderSearch) => {
    if (!item?.id) return;
    setServerOrdersLoading(true);
    try {
      const data = await getSaleOrdersPage({
        item: item.id,
        page: pageToLoad,
        page_size: sizeToLoad,
        search: searchVal.trim(),
      });
      setServerOrdersData(data);
    } catch (err) {
      console.warn('Failed to load server-paginated sales orders:', err);
    } finally {
      setServerOrdersLoading(false);
    }
  };

  // Fetch paginated stock movements on-demand from backend
  const loadMovementsFromServer = async (pageToLoad = movementPage, sizeToLoad = movementPageSize) => {
    if (!item?.id) return;
    setServerMovementsLoading(true);
    try {
      const data = await fetchStockMovements(item.id, {
        page: pageToLoad,
        page_size: sizeToLoad,
      });
      setServerMovementsData(data);
    } catch (err) {
      console.warn('Failed to load server-paginated stock movements:', err);
    } finally {
      setServerMovementsLoading(false);
    }
  };

  // Trigger server fetch on item, tab, page, or search change
  useEffect(() => {
    if (item?.id) {
      loadOrdersFromServer(orderPage, orderPageSize, orderSearch);
    }
  }, [item?.id, orderPage, orderPageSize, orderSearch]);

  useEffect(() => {
    if (item?.id) {
      loadMovementsFromServer(movementPage, movementPageSize);
    }
  }, [item?.id, movementPage, movementPageSize]);

  // Transform server sales records into tabular format
  const serverSalesList = useMemo(() => {
    if (!serverOrdersData || !Array.isArray(serverOrdersData.results)) return null;
    const rows = [];
    serverOrdersData.results.forEach((order) => {
      const lineItems = (order.items || []).filter((soi) => String(soi.item) === String(item.id) || String(soi.item_id) === String(item.id));
      const dt = order.created_at ? new Date(order.created_at) : new Date();
      const dateStr = dt.toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const cashierName = order.cashier_name || order.cashier?.name || 'Cashier';

      if (lineItems.length > 0) {
        lineItems.forEach((si) => {
          rows.push({
            order_id: order.id,
            invoice_number: order.invoice_number,
            date: dateStr,
            quantity: si.quantity,
            unit_price: si.unit_selling_price,
            discount: si.line_discount || 0,
            total_price: si.total_price,
            cashier_name: cashierName,
          });
        });
      } else {
        rows.push({
          order_id: order.id,
          invoice_number: order.invoice_number,
          date: dateStr,
          quantity: order.total_units || 1,
          unit_price: order.total_amount,
          discount: order.total_discount || 0,
          total_price: order.final_amount,
          cashier_name: cashierName,
        });
      }
    });
    return rows;
  }, [serverOrdersData, item?.id]);

  // Effective sales counts & rows
  const isServerOrders = Boolean(serverOrdersData && Array.isArray(serverOrdersData.results));
  const effectiveOrdersTotalCount = isServerOrders
    ? (serverOrdersData.count ?? 0)
    : fallbackSales.length;

  const effectiveOrdersTotalPages = isServerOrders
    ? (serverOrdersData.total_pages ?? 1)
    : Math.max(1, Math.ceil(fallbackSales.length / orderPageSize));

  const displaySales = isServerOrders
    ? (serverSalesList || [])
    : fallbackSales.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);

  // Effective movements counts & rows
  const isServerMovements = Boolean(serverMovementsData && Array.isArray(serverMovementsData.results));
  const effectiveMovementsTotalCount = isServerMovements
    ? (serverMovementsData.count ?? 0)
    : fallbackMovements.length;

  const effectiveMovementsTotalPages = isServerMovements
    ? (serverMovementsData.total_pages ?? 1)
    : Math.max(1, Math.ceil(fallbackMovements.length / movementPageSize));

  const rawServerMovements = isServerMovements
    ? serverMovementsData.results
    : fallbackMovements.slice((movementPage - 1) * movementPageSize, movementPage * movementPageSize);

  const filteredMovements = useMemo(() => {
    let list = rawServerMovements || [];
    if (!movementSearch.trim()) return list;
    const q = movementSearch.toLowerCase();
    return list.filter(
      (m) =>
        (m.reason || '').toLowerCase().includes(q) ||
        (m.reason_display || '').toLowerCase().includes(q) ||
        (m.performed_by_name || '').toLowerCase().includes(q) ||
        (m.note || '').toLowerCase().includes(q)
    );
  }, [rawServerMovements, movementSearch]);

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
            <span>Orders History ({effectiveOrdersTotalCount})</span>
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
            <span>Stock Audit Trail ({effectiveMovementsTotalCount})</span>
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

      {/* 2. TAB 1: CUSTOMER ORDERS */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
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
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setOrderPage(1);
                }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748B)' }}>
                Showing{' '}
                <strong style={{ color: 'var(--text-primary, #F8FAFC)' }}>
                  {effectiveOrdersTotalCount === 0 ? 0 : (orderPage - 1) * orderPageSize + 1}–{Math.min(orderPage * orderPageSize, effectiveOrdersTotalCount)}
                </strong>{' '}
                of <strong style={{ color: 'var(--text-primary, #F8FAFC)' }}>{effectiveOrdersTotalCount}</strong> orders
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)' }}>Per page:</span>
                <select
                  value={orderPageSize}
                  onChange={(e) => {
                    setOrderPageSize(Number(e.target.value));
                    setOrderPage(1);
                  }}
                  style={{
                    height: '28px',
                    fontSize: '0.76rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-main, #0B0E17)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-primary, #F8FAFC)',
                    colorScheme: 'dark',
                    cursor: 'pointer',
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
                {serverOrdersLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#38BDF8' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Loader2 size={16} className="spin-fast" />
                        <span>Loading orders page {orderPage}...</span>
                      </div>
                    </td>
                  </tr>
                ) : displaySales.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                      No sales orders found for this product.
                    </td>
                  </tr>
                ) : (
                  displaySales.map((s, idx) => (
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

          {/* Orders Pagination Controls */}
          {effectiveOrdersTotalCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Page <strong style={{ color: '#F8FAFC' }}>{orderPage}</strong> of{' '}
                <strong style={{ color: '#F8FAFC' }}>{effectiveOrdersTotalPages}</strong> ({effectiveOrdersTotalCount} total orders)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setOrderPage(1)}
                  disabled={orderPage === 1 || serverOrdersLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: orderPage === 1 || serverOrdersLoading ? 0.4 : 1,
                    cursor: orderPage === 1 || serverOrdersLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="First Page"
                >
                  <ChevronsLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                  disabled={orderPage === 1 || serverOrdersLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: orderPage === 1 || serverOrdersLoading ? 0.4 : 1,
                    cursor: orderPage === 1 || serverOrdersLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <span
                  style={{
                    padding: '0 8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #F8FAFC)',
                  }}
                >
                  {orderPage} / {effectiveOrdersTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.min(effectiveOrdersTotalPages, p + 1))}
                  disabled={orderPage >= effectiveOrdersTotalPages || serverOrdersLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: orderPage >= effectiveOrdersTotalPages || serverOrdersLoading ? 0.4 : 1,
                    cursor: orderPage >= effectiveOrdersTotalPages || serverOrdersLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setOrderPage(effectiveOrdersTotalPages)}
                  disabled={orderPage >= effectiveOrdersTotalPages || serverOrdersLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: orderPage >= effectiveOrdersTotalPages || serverOrdersLoading ? 0.4 : 1,
                    cursor: orderPage >= effectiveOrdersTotalPages || serverOrdersLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Last Page"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. TAB 2: INVENTORY MOVEMENT & AUDIT TRAIL */}
      {activeTab === 'movements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search and Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
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
                onChange={(e) => {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748B)' }}>
                Showing{' '}
                <strong style={{ color: 'var(--text-primary, #F8FAFC)' }}>
                  {filteredMovements.length === 0 ? 0 : (movementPage - 1) * movementPageSize + 1}–{Math.min(movementPage * movementPageSize, filteredMovements.length)}
                </strong>{' '}
                of <strong style={{ color: 'var(--text-primary, #F8FAFC)' }}>{filteredMovements.length}</strong> logs
                {filteredMovements.length !== recentMovements.length && ` (filtered from ${recentMovements.length})`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)' }}>Per page:</span>
                <select
                  value={movementPageSize}
                  onChange={(e) => {
                    setMovementPageSize(Number(e.target.value));
                    setMovementPage(1);
                  }}
                  style={{
                    height: '28px',
                    fontSize: '0.76rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-main, #0B0E17)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-primary, #F8FAFC)',
                    colorScheme: 'dark',
                    cursor: 'pointer',
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (filteredMovements.length === 0) return;
                  const headers = ['Date & Time', 'Product Name', 'UID', 'Reason', 'Change (Units)', 'Performed By', 'Role', 'Notes'];
                  const rows = filteredMovements.map((m) => {
                    const dt = m.created_at || m.timestamp ? new Date(m.created_at || m.timestamp).toLocaleString('en-IN') : '';
                    const perfName = m.performed_by_name || 'Owner / Admin';
                    const perfRole = m.performed_by_role || 'Owner';
                    return [
                      `"${dt.replace(/"/g, '""')}"`,
                      `"${(item?.name || '').replace(/"/g, '""')}"`,
                      `"${(item?.uid || '').replace(/"/g, '""')}"`,
                      `"${(m.reason_display || m.reason || '').replace(/"/g, '""')}"`,
                      m.change > 0 ? `+${m.change}` : m.change,
                      `"${perfName.replace(/"/g, '""')}"`,
                      `"${perfRole.replace(/"/g, '""')}"`,
                      `"${(m.note || '').replace(/"/g, '""')}"`,
                    ];
                  });
                  const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                  const encoded = encodeURI(csv);
                  const a = document.createElement('a');
                  a.href = encoded;
                  a.download = `product_stock_audit_${item?.uid || 'item'}_${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                disabled={filteredMovements.length === 0}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  padding: '4px 8px',
                  color: '#10B981',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.08)',
                }}
                title="Export this product's audit trail to CSV"
              >
                <Download size={12} />
                <span>Export CSV</span>
              </button>
            </div>
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
                {serverMovementsLoading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#38BDF8' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Loader2 size={16} className="spin-fast" />
                        <span>Loading audit logs page {movementPage}...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
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

          {/* Movements Pagination Controls */}
          {effectiveMovementsTotalCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Page <strong style={{ color: '#F8FAFC' }}>{movementPage}</strong> of{' '}
                <strong style={{ color: '#F8FAFC' }}>{effectiveMovementsTotalPages}</strong> ({effectiveMovementsTotalCount} total logs)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setMovementPage(1)}
                  disabled={movementPage === 1 || serverMovementsLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: movementPage === 1 || serverMovementsLoading ? 0.4 : 1,
                    cursor: movementPage === 1 || serverMovementsLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="First Page"
                >
                  <ChevronsLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                  disabled={movementPage === 1 || serverMovementsLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: movementPage === 1 || serverMovementsLoading ? 0.4 : 1,
                    cursor: movementPage === 1 || serverMovementsLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <span
                  style={{
                    padding: '0 8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #F8FAFC)',
                  }}
                >
                  {movementPage} / {effectiveMovementsTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setMovementPage((p) => Math.min(effectiveMovementsTotalPages, p + 1))}
                  disabled={movementPage >= effectiveMovementsTotalPages || serverMovementsLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: movementPage >= effectiveMovementsTotalPages || serverMovementsLoading ? 0.4 : 1,
                    cursor: movementPage >= effectiveMovementsTotalPages || serverMovementsLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setMovementPage(effectiveMovementsTotalPages)}
                  disabled={movementPage >= effectiveMovementsTotalPages || serverMovementsLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: movementPage >= effectiveMovementsTotalPages || serverMovementsLoading ? 0.4 : 1,
                    cursor: movementPage >= effectiveMovementsTotalPages || serverMovementsLoading ? 'not-allowed' : 'pointer',
                  }}
                  title="Last Page"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
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
