import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Package,
  ShoppingBag,
  TrendingUp,
  Search,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import {
  fetchWebsiteStats,
  fetchWebsiteOrders,
  updateWebsiteOrderStatus,
  toggleItemWebsiteListing,
  fetchItems,
} from '../api';

export default function WebsiteManagementView({ currentUser, onBackToLauncher }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'orders'
  const [stats, setStats] = useState({
    total_listed_items: 0,
    total_orders: 0,
    pending_orders: 0,
    confirmed_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    total_revenue: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Catalog Tab State
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'listed' | 'unlisted'
  const [togglingItemId, setTogglingItemId] = useState(null);

  // Orders Tab State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await fetchWebsiteStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load website stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoadingItems(true);
      const res = await fetchItems({
        search: searchQuery,
        page_size: 100,
      });
      const itemList = Array.isArray(res) ? res : res.results || [];
      setItems(itemList);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery]);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetchWebsiteOrders({
        status: orderStatusFilter,
        search: orderSearchQuery,
      });
      const orderList = Array.isArray(res) ? res : res.results || [];
      setOrders(orderList);
      if (orderList.length > 0 && !selectedOrder) {
        setSelectedOrder(orderList[0]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderStatusFilter, orderSearchQuery, selectedOrder]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadItems();
    } else if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, loadItems, loadOrders]);

  const handleToggleListing = async (item) => {
    const nextState = !item.is_listed_on_website;
    setTogglingItemId(item.id);
    try {
      await toggleItemWebsiteListing(item.id, nextState);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_listed_on_website: nextState } : i))
      );
      setStats((prev) => ({
        ...prev,
        total_listed_items: prev.total_listed_items + (nextState ? 1 : -1),
      }));
    } catch (err) {
      console.error('Failed to toggle item listing:', err);
      alert('Failed to update website listing: ' + (err.message || 'Server error'));
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateWebsiteOrderStatus(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: updated.status }));
      }
      loadStats();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update status: ' + (err.message || 'Server error'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (catalogFilter === 'listed') return item.is_listed_on_website;
    if (catalogFilter === 'unlisted') return !item.is_listed_on_website;
    return true;
  });

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' },
      CONFIRMED: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' },
      PROCESSING: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: '1px solid rgba(168, 85, 247, 0.3)' },
      SHIPPED: { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.3)' },
      DELIVERED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' },
      CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
    };
    const s = styles[status] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '1px solid rgba(148, 163, 184, 0.3)' };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: s.bg,
          color: s.text,
          border: s.border,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Header Card */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(20, 24, 41, 0.8) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Return to Menu"
            >
              <ArrowLeft size={15} />
              <span>Menu</span>
            </button>
          )}

          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(14, 165, 233, 0.16)',
              color: '#0EA5E9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              flexShrink: 0,
            }}
          >
            <Globe size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Website & Online Store
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                wonder.sale
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Manage online catalog visibility, sync stock in real time, and process incoming e-commerce orders.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              loadStats();
              if (activeTab === 'catalog') loadItems();
              if (activeTab === 'orders') loadOrders();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Refresh statistics and data"
          >
            <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <span>Visit Storefront</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Listed Products
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {loadingStats ? '...' : stats.total_listed_items}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Online Orders
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {loadingStats ? '...' : stats.total_orders}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Fulfillment
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#F59E0B' }}>
              {loadingStats ? '...' : stats.pending_orders}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Delivered Revenue
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#10B981' }}>
              ₹{loadingStats ? '...' : Number(stats.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.14)',
              color: '#A855F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Package size={15} />
          <span>Product Catalog ({stats.total_listed_items} Listed)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative' }}
        >
          <ShoppingBag size={15} />
          <span>Online Orders</span>
          {stats.pending_orders > 0 && (
            <span
              style={{
                marginLeft: '6px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                background: '#F59E0B',
                color: '#000',
              }}
            >
              {stats.pending_orders}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search & Filter Bar */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog by name, UID, or barcode..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter:</span>
              <button
                type="button"
                onClick={() => setCatalogFilter('all')}
                className={`btn btn-sm ${catalogFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All Items
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('listed')}
                className={`btn btn-sm ${catalogFilter === 'listed' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Published Only
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('unlisted')}
                className={`btn btn-sm ${catalogFilter === 'unlisted' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Unpublished
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div
            className="glass-panel"
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-solid)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Product</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>UID</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Selling Price</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>MRP</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>In Stock</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>Website Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0EA5E9' }} />
                        <div>Loading inventory items...</div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No items match the current search / filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isListed = Boolean(item.is_listed_on_website);
                      const isToggling = togglingItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {item.primary_image_url ? (
                                <img
                                  src={item.primary_image_url}
                                  alt={item.name}
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: 'var(--radius-sm)',
                                    objectFit: 'cover',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-surface-solid)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <Package size={18} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.description || 'No description entered'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {item.uid}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 800, color: '#10B981' }}>
                            ₹{Number(item.selling_price).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 18px', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{Number(item.mrp || item.selling_price).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: (item.quantity || 0) > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: (item.quantity || 0) > 0 ? '#10B981' : '#EF4444',
                              }}
                            >
                              {item.quantity} in stock
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleListing(item)}
                              disabled={isToggling}
                              className="btn btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: isListed ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-surface-solid)',
                                color: isListed ? '#10B981' : 'var(--text-muted)',
                                border: isListed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                              }}
                            >
                              {isToggling ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : isListed ? (
                                <>
                                  <Eye size={13} />
                                  <span>Published</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff size={13} />
                                  <span>Unlisted</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ONLINE ORDERS */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Order Search & Status Filter */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search by Order #, tracking ID, or customer phone..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                style={{
                  background: 'var(--bg-surface-solid)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders Master/Detail Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {/* Orders List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {loadingOrders ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0EA5E9' }} />
                  <div>Loading orders...</div>
                </div>
              ) : orders.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  <ShoppingBag size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No online orders yet</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Customer purchases from wonder.sale will appear right here.</div>
                </div>
              ) : (
                orders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="glass-panel"
                      style={{
                        padding: '16px 18px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        border: isSelected ? '1px solid #0EA5E9' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>#{order.order_number}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <User size={12} />
                              {order.customer_name || 'Customer'}
                            </span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} />
                              {order.customer_mobile}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            ₹{Number(order.total_amount).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Order Detail Panel */}
            <div>
              {selectedOrder ? (
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Order Details
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        #{selectedOrder.order_number}
                      </div>
                    </div>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  {/* Customer Block */}
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-solid)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Customer Info
                    </div>
                    <div style={{ fontWeight: 700 }}>{selectedOrder.customer_name || 'Customer'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{selectedOrder.customer_mobile}</div>
                  </div>

                  {/* Shipping Address */}
                  {selectedOrder.delivery_address && (
                    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-solid)' }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Delivery Address
                      </div>
                      <div style={{ fontSize: '0.84rem' }}>
                        {selectedOrder.delivery_address.address_line || selectedOrder.delivery_address.address_line1 || selectedOrder.delivery_address.street || 'Address on file'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {[selectedOrder.delivery_address.city, selectedOrder.delivery_address.pincode].filter(Boolean).join(' - ')}
                      </div>
                    </div>
                  )}

                  {/* Purchased Items */}
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Items Ordered ({(selectedOrder.items || []).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(selectedOrder.items || []).map((oi) => (
                        <div
                          key={oi.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface-solid)',
                            fontSize: '0.84rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{oi.item_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{oi.item_uid}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700 }}>₹{Number(oi.total_price).toFixed(2)}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{oi.quantity}x @ ₹{Number(oi.unit_price).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Change Order Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '6px' }}>
                      {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(selectedOrder.id, st)}
                          disabled={updatingOrderId === selectedOrder.id || selectedOrder.status === st}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '6px 8px',
                            background: selectedOrder.status === st ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-surface-solid)',
                            color: selectedOrder.status === st ? '#0EA5E9' : 'var(--text-primary)',
                            border: selectedOrder.status === st ? '1px solid #0EA5E9' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  Select an order on the left to see details and update status.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
