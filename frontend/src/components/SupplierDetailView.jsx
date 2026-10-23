import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CreditCard,
  Truck,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  X,
  ExternalLink,
  Tag,
  Paperclip,
} from 'lucide-react';
import {
  fetchSupplierDetailStats,
  fetchSupplierOrders,
  fetchSupplierLedgerEntries,
  recordSupplierOrderPayment,
  updateSupplierOrder,
  createSupplierLedgerEntry,
  deleteSupplierLedgerEntry,
  fetchItems,
} from '../api';

const STATUS_BADGES = {
  unpaid: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', text: 'Unpaid' },
  partial: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', text: 'Partially Paid' },
  paid: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', text: 'Paid' },
};

const DELIVERY_BADGES = {
  pending: { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', text: 'Awaiting Arrival' },
  in_transit: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', text: 'In Transit' },
  delivered: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981', text: 'Received' },
};

export default function SupplierDetailView({
  supplierId,
  supplier: initialSupplier,
  onBack,
  currentUser,
  stores = [],
  selectedStore = '',
  currencySymbol = '₹',
}) {
  const [activeTab, setActiveTab] = useState('orders'); // 'overview' | 'orders' | 'ledger'
  const [supplier, setSupplier] = useState(initialSupplier || null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Time range filter for stats and orders
  const [timeRange, setTimeRange] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'this_year'

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Products state (overview tab)
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Ledger entries state
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Modals
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [deliveryModalOrder, setDeliveryModalOrder] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('delivered');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  const [manualEntryModal, setManualEntryModal] = useState(false);
  const [entryType, setEntryType] = useState('payment');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryMethod, setEntryMethod] = useState('cash');
  const [entryRef, setEntryRef] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);

  // Compute date range
  const dateRange = useMemo(() => {
    const now = new Date();
    if (timeRange === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start_date: start, end_date: end };
    }
    if (timeRange === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start_date: start, end_date: end };
    }
    if (timeRange === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      return { start_date: start, end_date: end };
    }
    return {};
  }, [timeRange]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!supplierId) return;
    setLoadingStats(true);
    try {
      const params = { ...dateRange };
      if (selectedStore) params.store = selectedStore;
      const data = await fetchSupplierDetailStats(supplierId, params);
      setStats(data);
    } catch (err) {
      console.error('Failed to load supplier stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [supplierId, selectedStore, dateRange]);

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!supplierId) return;
    setLoadingOrders(true);
    try {
      const params = { supplier: supplierId };
      if (selectedStore) params.store = selectedStore;
      if (orderStatusFilter !== 'all') params.status = orderStatusFilter;
      if (orderSearch.trim()) params.search = orderSearch.trim();
      const data = await fetchSupplierOrders(params);
      setOrders(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to load supplier orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [supplierId, selectedStore, orderStatusFilter, orderSearch]);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!supplierId) return;
    setLoadingProducts(true);
    try {
      const params = { supplier: supplierId, page_size: 100 };
      if (selectedStore) params.store = selectedStore;
      if (productSearch.trim()) params.search = productSearch.trim();
      const data = await fetchItems(params);
      setProducts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to load supplier products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [supplierId, selectedStore, productSearch]);

  // Load ledger entries
  const loadLedger = useCallback(async () => {
    if (!supplierId) return;
    setLoadingLedger(true);
    try {
      const params = { supplier: supplierId };
      if (selectedStore) params.store = selectedStore;
      const data = await fetchSupplierLedgerEntries(params);
      setLedgerEntries(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [supplierId, selectedStore]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'overview') loadProducts();
    if (activeTab === 'ledger') loadLedger();
  }, [activeTab, loadOrders, loadProducts, loadLedger]);

  // Handle Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalOrder || !paymentAmount) return;
    setSubmittingPayment(true);
    try {
      await recordSupplierOrderPayment(paymentModalOrder.id, {
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        payment_reference: paymentRef,
        notes: paymentNotes,
      });
      setPaymentModalOrder(null);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      loadOrders();
      loadStats();
      loadLedger();
    } catch (err) {
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handle Update Delivery Status
  const handleUpdateDelivery = async (e) => {
    e.preventDefault();
    if (!deliveryModalOrder) return;
    setSubmittingDelivery(true);
    try {
      await updateSupplierOrder(deliveryModalOrder.id, {
        delivery_status: deliveryStatus,
      });
      setDeliveryModalOrder(null);
      loadOrders();
    } catch (err) {
      alert(`Failed to update delivery status: ${err.message}`);
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Handle Add Manual Ledger Entry
  const handleAddManualEntry = async (e) => {
    e.preventDefault();
    if (!entryTitle || !entryAmount) return;
    setSubmittingEntry(true);
    try {
      await createSupplierLedgerEntry({
        supplier: supplierId,
        store: selectedStore || null,
        entry_type: entryType,
        title: entryTitle,
        amount: parseFloat(entryAmount),
        payment_method: entryMethod,
        reference: entryRef,
        notes: entryNotes,
      });
      setManualEntryModal(false);
      setEntryTitle('');
      setEntryAmount('');
      setEntryRef('');
      setEntryNotes('');
      loadLedger();
      loadStats();
    } catch (err) {
      alert(`Failed to add manual entry: ${err.message}`);
    } finally {
      setSubmittingEntry(false);
    }
  };

  // Handle Delete Ledger Entry
  const handleDeleteLedgerEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this ledger entry?')) return;
    try {
      await deleteSupplierLedgerEntry(entryId);
      loadLedger();
      loadStats();
    } catch (err) {
      alert(`Failed to delete entry: ${err.message}`);
    }
  };

  const supplierName = supplier?.name || stats?.supplier_name || 'Supplier Detail';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header & Breadcrumb */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '16px 22px',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBack}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Suppliers</span>
          </button>

          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(20, 184, 166, 0.16)',
              color: '#14B8A6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(20, 184, 166, 0.25)',
              flexShrink: 0,
            }}
          >
            <Building2 size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {supplierName}
              </h1>
              {supplier?.city && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {supplier.city}
                  {supplier.state ? `, ${supplier.state}` : ''}
                </span>
              )}
              {supplier?.pincode && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(20, 184, 166, 0.14)',
                    color: '#14B8A6',
                  }}
                >
                  PIN: {supplier.pincode}
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '4px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
              }}
            >
              {supplier?.contact_person && (
                <span>👤 Contact: <strong>{supplier.contact_person}</strong></span>
              )}
              {supplier?.phone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> {supplier.phone}
                </span>
              )}
              {supplier?.email && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} /> {supplier.email}
                </span>
              )}
              {supplier?.gst_number && (
                <span>GST: <strong>{supplier.gst_number}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Time range selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Period:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="input-field"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)' }}
          >
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
          </select>
          <button
            type="button"
            onClick={() => {
              loadStats();
              if (activeTab === 'orders') loadOrders();
              if (activeTab === 'overview') loadProducts();
              if (activeTab === 'ledger') loadLedger();
            }}
            className="btn btn-secondary btn-sm"
            title="Refresh Data"
            style={{ padding: '7px' }}
          >
            <RefreshCw size={14} className={loadingStats ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Amount Owed (Highlight) */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid #EF4444',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(0,0,0,0.1) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>
              Amount Owed
            </span>
            <DollarSign size={18} color="#EF4444" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: '#EF4444' }}>
            {currencySymbol}{(stats?.total_owed_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.unpaid_orders_count ?? 0} unpaid · {stats?.partial_orders_count ?? 0} partial orders
          </div>
        </div>

        {/* Total Orders / Procurement */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid #14B8A6',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Orders
            </span>
            <ShoppingCart size={18} color="#14B8A6" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px' }}>
            {stats?.total_orders_count ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Ordered: {currencySymbol}{(stats?.total_ordered_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Total Paid */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid #10B981',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Paid
            </span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
            {currencySymbol}{(stats?.total_paid_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.paid_orders_count ?? 0} fully cleared orders
          </div>
        </div>

        {/* Products in Catalog & Stock Value */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid #6366F1',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Stock Catalog
            </span>
            <Package size={18} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px' }}>
            {stats?.total_items_count ?? 0} items
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.total_units_in_stock ?? 0} units · {currencySymbol}{(stats?.total_stock_cost_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} cost value
          </div>
        </div>

        {/* Sales Performance */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid #F59E0B',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Retail Sales
            </span>
            <Tag size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: '#F59E0B' }}>
            {currencySymbol}{(stats?.total_sold_revenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.total_sold_units ?? 0} units sold from this supplier
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="glass-panel"
        style={{
          padding: '0 16px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'orders' ? '3px solid #14B8A6' : '3px solid transparent',
              color: activeTab === 'orders' ? '#14B8A6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShoppingCart size={16} />
            <span>Orders & Ledger ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '3px solid #14B8A6' : '3px solid transparent',
              color: activeTab === 'overview' ? '#14B8A6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Package size={16} />
            <span>Supplied Products ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ledger' ? '3px solid #14B8A6' : '3px solid transparent',
              color: activeTab === 'ledger' ? '#14B8A6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={16} />
            <span>Manual Ledger Entries ({ledgerEntries.length})</span>
          </button>
        </div>

        {activeTab === 'ledger' && (
          <button
            type="button"
            onClick={() => setManualEntryModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} />
            <span>Add Manual Entry</span>
          </button>
        )}
      </div>

      {/* Tab 1: Orders & Payment Tracking */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
          <div
            className="glass-panel"
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '240px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search orders by number, title, reference..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.86rem', padding: '6px 10px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="input-field"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="unpaid">Unpaid Only</option>
                <option value="partial">Partially Paid</option>
                <option value="paid">Fully Paid</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          {loadingOrders ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No orders found for this supplier. Adding products with this supplier selected will automatically generate procurement orders here!
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Order #</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Title / Items</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ padding: '12px 16px' }}>Payment Status</th>
                    <th style={{ padding: '12px 16px' }}>Delivery</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => {
                    const statusMeta = STATUS_BADGES[ord.status] || STATUS_BADGES.unpaid;
                    const deliveryMeta = DELIVERY_BADGES[ord.delivery_status] || DELIVERY_BADGES.pending;
                    const isExpanded = expandedOrderId === ord.id;
                    const outstanding = parseFloat(ord.outstanding_amount || 0);

                    return (
                      <React.Fragment key={ord.id}>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: isExpanded ? 'rgba(20, 184, 166, 0.04)' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: '#14B8A6' }}>
                            {ord.order_number}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                            {ord.order_date}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{ord.title}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {ord.items?.length || 0} line item(s) · Recorded by {ord.recorded_by_name || 'System'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                            {currencySymbol}{parseFloat(ord.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10B981' }}>
                            {currencySymbol}{parseFloat(ord.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: outstanding > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                            {currencySymbol}{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: statusMeta.bg,
                                color: statusMeta.color,
                              }}
                            >
                              {statusMeta.text}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: deliveryMeta.bg,
                                color: deliveryMeta.color,
                              }}
                            >
                              {deliveryMeta.text}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {ord.status !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentModalOrder(ord);
                                    setPaymentAmount(outstanding.toFixed(2));
                                  }}
                                  className="btn btn-primary btn-xs"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                >
                                  Pay
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setDeliveryModalOrder(ord);
                                  setDeliveryStatus(ord.delivery_status || 'delivered');
                                }}
                                className="btn btn-secondary btn-xs"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                Delivery
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr style={{ background: 'rgba(0, 0, 0, 0.15)', borderBottom: '1px solid var(--border-color)' }}>
                            <td colSpan={9} style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#14B8A6' }}>
                                  Line Items Procured in this Order:
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                  {ord.items?.map((it) => (
                                    <div
                                      key={it.id}
                                      style={{
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      <div style={{ fontWeight: 600 }}>{it.item_name}</div>
                                      {it.item_uid && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                          UID: {it.item_uid}
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                        <span>Qty: <strong>{it.quantity}</strong></span>
                                        <span>Cost: {currencySymbol}{parseFloat(it.cost_price).toFixed(2)}</span>
                                        <span style={{ fontWeight: 700, color: '#14B8A6' }}>
                                          Total: {currencySymbol}{parseFloat(it.line_total).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {ord.notes && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Notes: {ord.notes}
                                  </div>
                                )}
                                {ord.payment_notes && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    Payment Notes: {ord.payment_notes}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Supplied Products */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            className="glass-panel"
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search products supplied..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.86rem', padding: '6px 10px' }}
              />
            </div>
          </div>

          {loadingProducts ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No products found for this supplier.
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Product</th>
                    <th style={{ padding: '12px 16px' }}>UID / Barcode</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>In Stock</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cost Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Selling Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Cost Value</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const qty = p.quantity || 0;
                    const cost = parseFloat(p.cost_price || 0);
                    const selling = parseFloat(p.price || 0);
                    const totalVal = qty * cost;

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {p.uid || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                          <span style={{ color: qty > 0 ? '#10B981' : '#EF4444' }}>{qty}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {currencySymbol}{cost.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {currencySymbol}{selling.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#14B8A6' }}>
                          {currencySymbol}{totalVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Manual Ledger Entries */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingLedger ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading ledger entries...
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No ledger entries yet. Click "Add Manual Entry" above to record extra payments, credit adjustments, or debits.
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Entry #</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Description</th>
                    <th style={{ padding: '12px 16px' }}>Method / Ref</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => {
                    const isDebit = entry.entry_type === 'debit';
                    const isCredit = entry.entry_type === 'credit';
                    const isPayment = entry.entry_type === 'payment';

                    let typeBadge = { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'Payment' };
                    if (isDebit) typeBadge = { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', label: 'Debit (+Owe)' };
                    if (isCredit) typeBadge = { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', label: 'Credit (-Owe)' };

                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: '#14B8A6' }}>
                          {entry.entry_number}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{entry.entry_date}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '12px',
                              background: typeBadge.bg,
                              color: typeBadge.color,
                            }}
                          >
                            {typeBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{entry.title}</div>
                          {entry.order_number && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Linked to Order: {entry.order_number}
                            </div>
                          )}
                          {entry.notes && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{entry.notes}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {entry.payment_method ? entry.payment_method.toUpperCase() : '—'}
                          {entry.reference ? ` (${entry.reference})` : ''}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: typeBadge.color }}>
                          {currencySymbol}{parseFloat(entry.amount).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteLedgerEntry(entry.id)}
                            className="btn btn-secondary btn-xs"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#EF4444' }}
                            title="Delete Entry"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setPaymentModalOrder(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Record Payment
              </h2>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Order: <strong>{paymentModalOrder.order_number}</strong> · Outstanding:{' '}
              <strong style={{ color: '#EF4444' }}>
                {currencySymbol}{parseFloat(paymentModalOrder.outstanding_amount || 0).toFixed(2)}
              </strong>
            </p>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Amount to Pay ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Transaction / Cheque Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678, Cheque #0045"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context or remarks..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="btn btn-primary"
                >
                  {submittingPayment ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Delivery Status Modal */}
      {deliveryModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setDeliveryModalOrder(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Update Delivery Status
              </h2>
              <button
                type="button"
                onClick={() => setDeliveryModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Delivery Status
                </label>
                <select
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="pending">Awaiting Arrival</option>
                  <option value="in_transit">In Transit / Dispatched</option>
                  <option value="delivered">Received / In Stock</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setDeliveryModalOrder(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelivery}
                  className="btn btn-primary"
                >
                  {submittingDelivery ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {manualEntryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setManualEntryModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Add Manual Ledger Entry
              </h2>
              <button
                type="button"
                onClick={() => setManualEntryModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddManualEntry} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Entry Type *
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="payment">Payment Made (We paid supplier)</option>
                  <option value="credit">Credit Adjustment (Supplier gave discount / rebate)</option>
                  <option value="debit">Debit Adjustment (Extra charges / freight)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Title / Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advance payment, Freight charge"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <select
                  value={entryMethod}
                  onChange={(e) => setEntryMethod(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Cheque # / UTR reference"
                  value={entryRef}
                  onChange={(e) => setEntryRef(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional remarks..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setManualEntryModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="btn btn-primary"
                >
                  {submittingEntry ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
