import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Tag,
  Paperclip,
  Edit3,
  Trash2,
  Download,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import {
  fetchSupplierDetailStats,
  fetchSupplierOrders,
  fetchSupplierLedgerEntries,
  createSupplierOrder,
  updateSupplierOrder,
  deleteSupplierOrder,
  deleteSupplierOrderAttachment,
  createSupplierLedgerEntry,
  deleteSupplierLedgerEntry,
  fetchItems,
} from '../api';
import TimelineRangeSelector from './TimelineRangeSelector';

const STATUS_BADGES = {
  unpaid: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', text: 'Unpaid' },
  partial: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', text: 'Partially Paid' },
  paid: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', text: 'Paid' },
};

function normalizeMediaUrl(url) {
  if (!url) return '';
  // Convert absolute local backend URLs to relative /media/
  if (url.startsWith('http://127.0.0.1:8000/media/')) {
    return url.replace('http://127.0.0.1:8000/media/', '/media/');
  }
  if (url.startsWith('http://localhost:8000/media/')) {
    return url.replace('http://localhost:8000/media/', '/media/');
  }
  if (url.startsWith('http://127.0.0.1:5173/media/') || url.startsWith('http://127.0.0.1:5174/media/')) {
    return url.replace(/http:\/\/127\.0\.0\.1:\d+\/media\//, '/media/');
  }
  if (url.startsWith('http://localhost:5173/media/') || url.startsWith('http://localhost:5174/media/')) {
    return url.replace(/http:\/\/localhost:\d+\/media\//, '/media/');
  }
  return url;
}

export default function SupplierDetailView({
  supplierId,
  supplier: initialSupplier,
  onBack,
  currentUser,
  stores = [],
  selectedStore = '',
  currencySymbol = '₹',
}) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'overview' | 'ledger'
  const [supplier, setSupplier] = useState(initialSupplier || null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Timeline selector state (using standardized TimelineRangeSelector)
  const [timelineRange, setTimelineRange] = useState(null);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Products state (overview tab) with backend pagination
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(20);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [productTotalPages, setProductTotalPages] = useState(1);

  // Ledger entries state
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Edit / Create Order Modal State
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderFormData, setOrderFormData] = useState({
    title: '',
    total_amount: '',
    order_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    notes: '',
  });
  const [orderFiles, setOrderFiles] = useState([]);
  const [existingOrderAttachments, setExistingOrderAttachments] = useState([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const fileInputRef = useRef(null);

  // Record Payment / Manual Ledger Entry Modal State
  // Used both for "Record Payment" (optionally linked to order or general) and "Add Manual Entry"
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetOrder, setPaymentTargetOrder] = useState(null);
  const [entryType, setEntryType] = useState('payment'); // 'payment' | 'credit' | 'debit'
  const [entryTitle, setEntryTitle] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryMethod, setEntryMethod] = useState('cash');
  const [entryRef, setEntryRef] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryNotes, setEntryNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Lightbox Viewer State for Photos & PDFs
  const [activeViewerRecord, setActiveViewerRecord] = useState(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);

  // Helper to compile full files list for an order
  const getOrderFileList = useCallback((ord) => {
    if (!ord) return [];
    const files = [];

    if (ord.attachments && ord.attachments.length > 0) {
      ord.attachments.forEach((att) => {
        const url = normalizeMediaUrl(att.file_url || att.file);
        files.push({
          id: att.id,
          url,
          name: att.file_name || url.split('/').pop() || 'Attachment',
          isPdf: url.toLowerCase().includes('.pdf'),
          size: att.file_size,
        });
      });
    }

    if (ord.bill_file_url || ord.bill_file) {
      const legacyUrl = normalizeMediaUrl(ord.bill_file_url || ord.bill_file);
      if (!files.some((f) => f.url === legacyUrl)) {
        files.unshift({
          id: 'legacy-bill',
          url: legacyUrl,
          name: legacyUrl.split('/').pop() || 'Primary Bill',
          isPdf: legacyUrl.toLowerCase().includes('.pdf'),
        });
      }
    }

    return files;
  }, []);

  // Compute date range for filters from TimelineRangeSelector
  const dateRange = useMemo(() => {
    if (!timelineRange || timelineRange.isAllTime) return {};
    const params = {};
    if (timelineRange.startDate) {
      params.start_date = typeof timelineRange.startDate === 'string'
        ? timelineRange.startDate.slice(0, 10)
        : timelineRange.startDate.toISOString().slice(0, 10);
    }
    if (timelineRange.endDate) {
      params.end_date = typeof timelineRange.endDate === 'string'
        ? timelineRange.endDate.slice(0, 10)
        : timelineRange.endDate.toISOString().slice(0, 10);
    }
    return params;
  }, [timelineRange]);

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

  // Load products with backend pagination
  const loadProducts = useCallback(async () => {
    if (!supplierId) return;
    setLoadingProducts(true);
    try {
      const params = {
        supplier: supplierId,
        page: productPage,
        page_size: productPageSize,
      };
      if (selectedStore) params.store = selectedStore;
      if (productSearch.trim()) params.search = productSearch.trim();
      const data = await fetchItems(params);
      if (Array.isArray(data)) {
        setProducts(data);
        setProductTotalCount(data.length);
        setProductTotalPages(1);
      } else {
        setProducts(data.results || []);
        setProductTotalCount(data.count ?? (data.results?.length || 0));
        setProductTotalPages(data.total_pages || Math.max(1, Math.ceil((data.count || 0) / productPageSize)));
      }
    } catch (err) {
      console.error('Failed to load supplier products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [supplierId, selectedStore, productSearch, productPage, productPageSize]);

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

  // Open Edit Order Modal
  const handleOpenEditOrder = (ord) => {
    setEditingOrder(ord);
    setOrderFormData({
      title: ord.title || '',
      total_amount: String(ord.total_amount || ''),
      order_date: ord.order_date || new Date().toISOString().slice(0, 10),
      due_date: ord.due_date || '',
      notes: ord.notes || '',
    });
    setExistingOrderAttachments(ord.attachments || []);
    setOrderFiles([]);
    setOrderModalOpen(true);
  };

  // Open Create Order Modal
  const handleOpenCreateOrder = () => {
    setEditingOrder(null);
    setOrderFormData({
      title: '',
      total_amount: '',
      order_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      notes: '',
    });
    setExistingOrderAttachments([]);
    setOrderFiles([]);
    setOrderModalOpen(true);
  };

  // Submit Order (Create or Update)
  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!orderFormData.title.trim()) {
      alert('Order title is required');
      return;
    }
    setSubmittingOrder(true);
    try {
      const fd = new FormData();
      fd.append('supplier', supplierId);
      if (selectedStore) fd.append('store', selectedStore);
      fd.append('title', orderFormData.title.trim());
      if (orderFormData.total_amount !== '') {
        fd.append('total_amount', parseFloat(orderFormData.total_amount) || 0);
      }
      if (orderFormData.order_date) fd.append('order_date', orderFormData.order_date);
      if (orderFormData.due_date) fd.append('due_date', orderFormData.due_date);
      if (orderFormData.notes) fd.append('notes', orderFormData.notes);

      // Append multi-attachments
      orderFiles.forEach((file) => {
        fd.append('attachments', file);
      });

      if (editingOrder) {
        await updateSupplierOrder(editingOrder.id, fd);
      } else {
        await createSupplierOrder(fd);
      }

      setOrderModalOpen(false);
      setEditingOrder(null);
      setOrderFiles([]);
      loadOrders();
      loadStats();
    } catch (err) {
      alert(`Failed to save order: ${err.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Delete an existing attachment inside the edit modal
  const handleDeleteExistingAttachment = async (attachmentId) => {
    if (!editingOrder) return;
    if (!window.confirm('Delete this attachment?')) return;
    try {
      const updated = await deleteSupplierOrderAttachment(editingOrder.id, attachmentId);
      setExistingOrderAttachments(updated.attachments || []);
      setEditingOrder(updated);
      loadOrders();
    } catch (err) {
      alert(`Failed to delete attachment: ${err.message}`);
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? All attached records will be deleted.')) return;
    try {
      await deleteSupplierOrder(orderId);
      loadOrders();
      loadStats();
    } catch (err) {
      alert(`Failed to delete order: ${err.message}`);
    }
  };

  // Open Payment Modal (Optionally linked to an order, creates a ledger entry)
  const handleOpenPaymentModal = (order = null) => {
    setPaymentTargetOrder(order);
    setEntryType('payment');
    if (order) {
      const outstanding = parseFloat(order.outstanding_amount || order.total_amount || 0);
      setEntryTitle(`Payment for Order ${order.order_number}`);
      setEntryAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
    } else {
      setEntryTitle(`Payment to ${supplier?.name || 'Supplier'}`);
      setEntryAmount('');
    }
    setEntryMethod('cash');
    setEntryRef('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryNotes('');
    setPaymentModalOpen(true);
  };

  // Open Manual Entry Modal (General ledger entry)
  const handleOpenManualEntryModal = (type = 'payment') => {
    setPaymentTargetOrder(null);
    setEntryType(type);
    setEntryTitle('');
    setEntryAmount('');
    setEntryMethod('cash');
    setEntryRef('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryNotes('');
    setPaymentModalOpen(true);
  };

  // Submit Payment / Ledger Entry
  const handleSubmitLedgerPayment = async (e) => {
    e.preventDefault();
    if (!entryTitle.trim() || !entryAmount) {
      alert('Title and amount are required.');
      return;
    }
    setSubmittingPayment(true);
    try {
      const amt = parseFloat(entryAmount);
      await createSupplierLedgerEntry({
        supplier: supplierId,
        order: paymentTargetOrder ? paymentTargetOrder.id : null,
        store: selectedStore || null,
        entry_type: entryType,
        title: entryTitle.trim(),
        amount: amt,
        entry_date: entryDate,
        payment_method: entryMethod,
        reference: entryRef.trim(),
        notes: entryNotes.trim(),
      });

      // When a payment or credit is recorded, apply FIFO (oldest first) to settle orders
      if (entryType === 'payment' || entryType === 'credit') {
        let remaining = amt;
        // Sort orders chronologically (oldest order_date/id first)
        const sortedOrders = [...orders]
          .filter((o) => o.status !== 'paid')
          .sort((a, b) => (a.order_date || '').localeCompare(b.order_date || '') || a.id - b.id);

        for (const ord of sortedOrders) {
          if (remaining <= 0) break;
          const totalAmt = parseFloat(ord.total_amount || 0);
          const currentPaid = parseFloat(ord.paid_amount || 0);
          const unpaid = Math.max(0, totalAmt - currentPaid);
          if (unpaid <= 0) continue;

          const toApply = Math.min(unpaid, remaining);
          const newPaid = currentPaid + toApply;
          remaining -= toApply;

          await updateSupplierOrder(ord.id, {
            paid_amount: newPaid,
            payment_method: entryMethod,
            payment_reference: entryRef.trim(),
            payment_date: entryDate,
          });
        }
      }

      setPaymentModalOpen(false);
      setPaymentTargetOrder(null);
      loadLedger();
      loadOrders();
      loadStats();
    } catch (err) {
      alert(`Failed to save payment entry: ${err.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Delete Ledger Entry
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

        {/* Time range selector and actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleOpenPaymentModal(null)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <DollarSign size={15} />
            <span>Make Payment</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateOrder}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} />
            <span>New Order / Bill</span>
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <TimelineRangeSelector
              value={timelineRange || undefined}
              defaultUnit="all"
              defaultCount={1}
              allowAllTime={true}
              compact={true}
              showXAxis={false}
              onChange={(newRange) => {
                setTimelineRange(newRange);
              }}
            />
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
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Amount Owed */}
        {/* Amount Owed / Advance Balance */}
        {(() => {
          const owedVal = stats?.total_owed_amount ?? 0;
          const isAdvance = owedVal < 0;
          const absVal = Math.abs(owedVal);
          return (
            <div
              className="glass-panel"
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-lg)',
                borderLeft: isAdvance ? '4px solid #10B981' : owedVal > 0 ? '4px solid #EF4444' : '4px solid var(--border-color)',
                background: isAdvance
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0.1) 100%)'
                  : owedVal > 0
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(0,0,0,0.1) 100%)'
                  : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: isAdvance ? '#10B981' : owedVal > 0 ? '#EF4444' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  {isAdvance ? 'Advance Paid (Credit)' : 'Amount Owed'}
                </span>
                <DollarSign size={18} color={isAdvance ? '#10B981' : owedVal > 0 ? '#EF4444' : 'var(--text-muted)'} />
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  marginTop: '8px',
                  color: isAdvance ? '#10B981' : owedVal > 0 ? '#EF4444' : 'inherit',
                }}
              >
                {isAdvance ? '-' : ''}{currencySymbol}{absVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isAdvance
                  ? 'Supplier overpaid / Advance balance available'
                  : `${stats?.unpaid_orders_count ?? 0} unpaid · ${stats?.partial_orders_count ?? 0} partial orders`}
              </div>
            </div>
          );
        })()}

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
              Stock & Retail Value
            </span>
            <Package size={18} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: '#6366F1' }}>
            {currencySymbol}{(stats?.total_retail_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.total_units_in_stock ?? 0} units ({stats?.total_items_count ?? 0} items) · Cost: {currencySymbol}{(stats?.total_stock_cost_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
            <span>Orders & Purchases ({orders.length})</span>
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
            <span>Supplied Products ({productTotalCount || stats?.total_items_count || products.length})</span>
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
            <span>Payment & Credit Ledger ({ledgerEntries.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'ledger' && (
            <button
              type="button"
              onClick={() => handleOpenManualEntryModal('payment')}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Add Ledger Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Orders & Purchases */}
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
              No orders found for this supplier. Adding products with this supplier selected will automatically generate procurement orders here, or you can create one manually!
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Order #</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Title / Items</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Files</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid</th>
                    <th style={{ padding: '12px 16px' }}>Outstanding</th>
                    <th style={{ padding: '12px 16px' }}>Payment Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => {
                    const statusMeta = STATUS_BADGES[ord.status] || STATUS_BADGES.unpaid;
                    const isExpanded = expandedOrderId === ord.id;
                    const outstanding = parseFloat(ord.outstanding_amount || 0);
                    const fileList = getOrderFileList(ord);

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
                          <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            {fileList.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveViewerRecord(ord);
                                  setActiveViewerIndex(0);
                                }}
                                className="btn btn-secondary btn-xs"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', fontSize: '0.72rem' }}
                                title="View attached bill photos and PDFs"
                              >
                                <Paperclip size={12} color="#14B8A6" />
                                <span>{fileList.length} file{fileList.length > 1 ? 's' : ''}</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                            )}
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
                          <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {/* Edit Order button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditOrder(ord)}
                                className="btn btn-secondary btn-xs"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                title="Edit order details, amount, attachments"
                              >
                                <Edit3 size={12} />
                              </button>
                              {/* Delete Order button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(ord.id)}
                                className="btn btn-secondary btn-xs"
                                style={{ padding: '4px 6px', fontSize: '0.72rem', color: '#EF4444' }}
                                title="Delete Order"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr style={{ background: 'rgba(0, 0, 0, 0.15)', borderBottom: '1px solid var(--border-color)' }}>
                            <td colSpan={9} style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#14B8A6' }}>
                                    Line Items Procured in this Order:
                                  </div>
                                  {fileList.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Attached Documents:</span>
                                      {fileList.map((f, fIdx) => (
                                        <button
                                          key={f.id}
                                          type="button"
                                          onClick={() => {
                                            setActiveViewerRecord(ord);
                                            setActiveViewerIndex(fIdx);
                                          }}
                                          className="btn btn-secondary btn-xs"
                                          style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          {f.isPdf ? <FileText size={12} color="#EF4444" /> : <ImageIcon size={12} color="#38BDF8" />}
                                          <span>{f.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {ord.items && ord.items.length > 0 ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                    {ord.items.map((it) => (
                                      <div
                                        key={it.id}
                                        style={{
                                          padding: '12px 14px',
                                          borderRadius: 'var(--radius-md)',
                                          background: 'rgba(255, 255, 255, 0.04)',
                                          border: '1px solid var(--border-color)',
                                          fontSize: '0.8rem',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '8px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                          <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{it.item_name}</div>
                                            {it.item_uid && (
                                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                UID: {it.item_uid}
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, color: '#14B8A6' }}>
                                              {currencySymbol}{parseFloat(it.line_total).toFixed(2)}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                              @{currencySymbol}{parseFloat(it.cost_price).toFixed(2)}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Stock Metrics: Qty Added, Sold, and Current Stock */}
                                        <div
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr',
                                            gap: '6px',
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            background: 'rgba(0, 0, 0, 0.2)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            textAlign: 'center',
                                          }}
                                        >
                                          <div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                                              Added
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                                              {it.quantity}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                                              Sold
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F59E0B', marginTop: '2px' }}>
                                              {it.sold_quantity ?? 0}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                                              Current
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>
                                              {it.current_quantity ?? 0}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    Direct order record (no item breakdown).
                                  </div>
                                )}

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
          {/* Products Summary Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Units In Stock
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: '#10B981' }}>
                {(stats?.total_units_in_stock ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Cost Value
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: '#14B8A6' }}>
                {currencySymbol}{(stats?.total_stock_cost_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Value If Sold (Retail)
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: '#6366F1' }}>
                {currencySymbol}{(stats?.total_retail_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Estimated Margin
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: '#F59E0B' }}>
                {currencySymbol}{Math.max(0, (stats?.total_retail_value ?? 0) - (stats?.total_stock_cost_value ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '220px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search products supplied (name, UID, SKU)..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                className="input-field"
                style={{ width: '100%', fontSize: '0.86rem', padding: '6px 10px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Show:</span>
              <select
                value={productPageSize}
                onChange={(e) => {
                  setProductPageSize(Number(e.target.value));
                  setProductPage(1);
                }}
                className="input-field"
                style={{ padding: '4px 8px', fontSize: '0.82rem', borderRadius: '6px' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
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
                    <th style={{ padding: '12px 16px' }}>UID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>In Stock</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cost Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Selling Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Cost Value</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Value If Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const qty = p.quantity || 0;
                    const cost = parseFloat(p.cost_price || 0);
                    const selling = parseFloat(p.selling_price || p.price || 0);
                    const totalCost = qty * cost;
                    const totalRetail = qty * selling;

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
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#38BDF8' }}>
                          {currencySymbol}{selling.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#14B8A6' }}>
                          {currencySymbol}{totalCost.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#6366F1' }}>
                          {currencySymbol}{totalRetail.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Backend Pagination Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  Showing {Math.min((productPage - 1) * productPageSize + 1, productTotalCount)} -{' '}
                  {Math.min(productPage * productPageSize, productTotalCount)} of {productTotalCount} products
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={productPage <= 1 || loadingProducts}
                    onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}
                    className="btn btn-secondary btn-xs"
                    style={{
                      padding: '4px 8px',
                      opacity: productPage <= 1 ? 0.5 : 1,
                      cursor: productPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  <span style={{ padding: '0 8px', fontWeight: 600 }}>
                    Page {productPage} of {Math.max(1, productTotalPages)}
                  </span>

                  <button
                    type="button"
                    disabled={productPage >= productTotalPages || loadingProducts}
                    onClick={() => setProductPage((prev) => Math.min(productTotalPages, prev + 1))}
                    className="btn btn-secondary btn-xs"
                    style={{
                      padding: '4px 8px',
                      opacity: productPage >= productTotalPages ? 0.5 : 1,
                      cursor: productPage >= productTotalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payment & Credit Ledger */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingLedger ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading ledger entries...
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No ledger entries yet. Click "Add Ledger Entry" or click "Pay" on an order to record payments, credit adjustments, or debits.
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Entry #</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Description / Linked Order</th>
                    <th style={{ padding: '12px 16px' }}>Method / Ref</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => {
                    const isDebit = entry.entry_type === 'debit';
                    const isCredit = entry.entry_type === 'credit';

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

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT SUPPLIER ORDER (WITH PHOTO & PDF UPLOAD)         */}
      {/* ========================================================================= */}
      {orderModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setOrderModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '620px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {editingOrder ? `Edit Order (${editingOrder.order_number})` : 'New Procurement Order / Bill'}
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Supplier: <strong>{supplierName}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Order Title */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Order Title / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch inventory delivery, 50x Linen Shirts"
                  value={orderFormData.title}
                  onChange={(e) => setOrderFormData({ ...orderFormData, title: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              {/* Amount and Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Total Order Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={orderFormData.total_amount}
                    onChange={(e) => setOrderFormData({ ...orderFormData, total_amount: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderFormData.order_date}
                    onChange={(e) => setOrderFormData({ ...orderFormData, order_date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Payment Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={orderFormData.due_date}
                  onChange={(e) => setOrderFormData({ ...orderFormData, due_date: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Notes / Terms (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional order terms, courier details, invoice numbers..."
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              {/* ======================================================== */}
              {/* Optional Photo or PDF Bill Attachments                   */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={16} color="#14B8A6" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      Bill / Invoice Attachments (Photos &amp; PDFs)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    JPG, PNG, WebP or PDF
                  </span>
                </div>

                {/* Existing attachments on edit */}
                {existingOrderAttachments.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Saved Attachments ({existingOrderAttachments.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {existingOrderAttachments.map((att) => {
                        const normUrl = normalizeMediaUrl(att.file_url || att.file);
                        const isPdf = normUrl.toLowerCase().includes('.pdf');
                        return (
                          <div
                            key={att.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.74rem',
                            }}
                          >
                            {isPdf ? <FileText size={13} color="#EF4444" /> : <ImageIcon size={13} color="#38BDF8" />}
                            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.file_name || 'Attachment'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteExistingAttachment(att.id)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 2px' }}
                              title="Delete attachment"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Newly selected files */}
                {orderFiles.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Ready to upload ({orderFiles.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {orderFiles.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(20, 184, 166, 0.12)',
                            border: '1px solid rgba(20, 184, 166, 0.3)',
                            fontSize: '0.74rem',
                            color: '#14B8A6',
                          }}
                        >
                          {f.type?.includes('pdf') || f.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText size={13} color="#EF4444" />
                          ) : (
                            <ImageIcon size={13} color="#38BDF8" />
                          )}
                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOrderFiles(orderFiles.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 2px' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Button & Hidden Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setOrderFiles((prev) => [...prev, ...files]);
                    }
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  <span>Choose Photo or PDF</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="btn btn-primary"
                >
                  {submittingOrder ? 'Saving...' : editingOrder ? 'Save Changes' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD PAYMENT / MANUAL LEDGER ENTRY                            */}
      {/* ========================================================================= */}
      {paymentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Record Payment / Ledger Entry
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Supplier: <strong>{supplier?.name || stats?.supplier_name || 'Supplier'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitLedgerPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  placeholder="e.g. Payment for Order, Advance cash, Cheque transfer"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                    <option value="upi">UPI / QR Scan</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Reference / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345, CHQ#0045"
                    value={entryRef}
                    onChange={(e) => setEntryRef(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context or remarks..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="btn btn-primary"
                >
                  {submittingPayment ? 'Saving...' : 'Record in Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL 4: MULTI-FILE GALLERY / LIGHTBOX (PHOTO & PDF VIEWER)              */}
      {/* ========================================================================= */}
      {activeViewerRecord && (() => {
        const fileList = getOrderFileList(activeViewerRecord);
        const currentFile = fileList[activeViewerIndex] || fileList[0];
        if (!currentFile) return null;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px',
            }}
            onClick={() => setActiveViewerRecord(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '960px',
                maxHeight: '92vh',
                backgroundColor: '#1E293B',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {currentFile.isPdf ? (
                    <FileText size={18} color="#F87171" />
                  ) : (
                    <ImageIcon size={18} color="#38BDF8" />
                  )}
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#F8FAFC' }}>
                      {activeViewerRecord.order_number} • {currentFile.name}
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#94A3B8' }}>
                      ({activeViewerIndex + 1} of {fileList.length})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={currentFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#38BDF8',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(56,189,248,0.12)',
                    }}
                    title="Open in new window"
                  >
                    <ExternalLink size={14} /> Open
                  </a>
                  <a
                    href={currentFile.url}
                    download={currentFile.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#38BDF8',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(56,189,248,0.12)',
                    }}
                  >
                    <Download size={14} /> Download
                  </a>
                  <button
                    onClick={() => setActiveViewerRecord(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Main Content Viewer */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  backgroundColor: '#0F172A',
                  position: 'relative',
                  minHeight: '440px',
                  maxHeight: '68vh',
                  overflow: 'auto',
                }}
              >
                {/* Previous button */}
                {fileList.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveViewerIndex((prev) => (prev > 0 ? prev - 1 : fileList.length - 1))
                    }
                    style={{
                      position: 'absolute',
                      left: '16px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}

                {/* File preview */}
                {currentFile.isPdf ? (
                  <object
                    data={currentFile.url}
                    type="application/pdf"
                    style={{
                      width: '100%',
                      height: '68vh',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px' }}>
                      <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5, color: '#F87171' }} />
                      <p style={{ fontSize: '0.95rem', marginBottom: '14px' }}>
                        Inline preview could not be loaded directly by the browser frame.
                      </p>
                      <a
                        href={currentFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '9px 18px',
                          borderRadius: '8px',
                          backgroundColor: '#38BDF8',
                          color: '#0F172A',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={16} /> Open PDF in Separate Window / Tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <img
                    src={currentFile.url}
                    alt={currentFile.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '68vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                    }}
                  />
                )}

                {/* Next button */}
                {fileList.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveViewerIndex((prev) => (prev < fileList.length - 1 ? prev + 1 : 0))
                    }
                    style={{
                      position: 'absolute',
                      right: '16px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                  >
                    <ChevronRight size={22} />
                  </button>
                )}
              </div>

              {/* Thumbnail Strip */}
              {fileList.length > 1 && (
                <div
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    overflowX: 'auto',
                  }}
                >
                  {fileList.map((file, idx) => {
                    const isSelected = idx === activeViewerIndex;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setActiveViewerIndex(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #14B8A6' : '1px solid rgba(255,255,255,0.1)',
                          backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.3)',
                          color: isSelected ? '#14B8A6' : '#94A3B8',
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                          fontWeight: isSelected ? 700 : 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.isPdf ? <FileText size={14} color="#EF4444" /> : <ImageIcon size={14} color="#38BDF8" />}
                        <span>{file.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
