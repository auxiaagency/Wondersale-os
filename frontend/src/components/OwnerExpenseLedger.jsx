import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DollarSign,
  Receipt,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Download,
  Calendar,
  Building2,
  FileText,
  CreditCard,
  Banknote,
  Eye,
  X,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Tag,
  ShieldCheck,
  Check,
  ArrowRight,
  Upload,
  Paperclip,
  File,
  Image as ImageIcon,
} from 'lucide-react';
import TimelineRangeSelector from './TimelineRangeSelector';
import {
  fetchOwnerExpenses,
  fetchOwnerExpenseSummary,
  createOwnerExpense,
  updateOwnerExpense,
  markOwnerExpensePaid,
  updateOwnerExpenseDelivery,
  deleteOwnerExpense,
  deleteOwnerExpenseAttachment,
} from '../api';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'stock_order', label: 'Stock / Inventory Order' },
  { id: 'raw_materials', label: 'Raw Materials / Goods' },
  { id: 'store_supplies', label: 'Store & Packaging Supplies' },
  { id: 'rent', label: 'Store Rent & Lease' },
  { id: 'utilities', label: 'Electricity, Water & Utilities' },
  { id: 'repairs', label: 'Repairs & Maintenance' },
  { id: 'logistics', label: 'Freight, Courier & Logistics' },
  { id: 'marketing', label: 'Marketing & Promotion' },
  { id: 'salary', label: 'Staff Salaries / Advance' },
  { id: 'equipment', label: 'Tools, Machinery & Equipment' },
  { id: 'personal', label: 'Owner Personal Expense' },
  { id: 'other', label: 'Other Expense' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Payments' },
  { id: 'unpaid', label: 'Unpaid Only' },
  { id: 'partial', label: 'Partial Paid' },
  { id: 'paid', label: 'Fully Paid' },
];

const DELIVERY_OPTIONS = [
  { id: 'all', label: 'All Deliveries' },
  { id: 'pending', label: 'Awaiting Arrival' },
  { id: 'in_transit', label: 'In Transit / Dispatched' },
  { id: 'delivered', label: 'Received / Delivered' },
  { id: 'not_applicable', label: 'N/A' },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI / QR Scan' },
  { id: 'bank_transfer', label: 'Bank Transfer / NEFT' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'card', label: 'Debit / Credit Card' },
  { id: 'other', label: 'Other' },
];

/**
 * Normalizes file URLs to stay root-relative or current-origin
 * to avoid hardcoded port or connection refused issues.
 */
function normalizeMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://127.0.0.1:8000/media/')) {
    return url.replace('http://127.0.0.1:8000/media/', '/media/');
  }
  if (url.startsWith('http://localhost:8000/media/')) {
    return url.replace('http://localhost:8000/media/', '/media/');
  }
  return url;
}

export default function OwnerExpenseLedger({
  currentUser,
  stores = [],
  currencySymbol = '₹',
  timelineRange = null,
  onTimelineRangeChange = null,
}) {
  const isOwner = currentUser?.is_owner || false;

  // Filter states
  const [selectedTimelineRange, setSelectedTimelineRange] = useState(() => {
    if (timelineRange) return timelineRange;
    const now = new Date();
    return {
      unit: 'month',
      count: 1,
      isAllTime: false,
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
  });

  // Sync external timeline changes
  useEffect(() => {
    if (!timelineRange) return;
    setSelectedTimelineRange((prev) => {
      if (
        prev &&
        prev.startDate === timelineRange.startDate &&
        prev.endDate === timelineRange.endDate &&
        prev.unit === timelineRange.unit &&
        prev.count === timelineRange.count &&
        prev.isAllTime === timelineRange.isAllTime &&
        prev.granularity === timelineRange.granularity &&
        prev.label === timelineRange.label
      ) {
        return prev;
      }
      return timelineRange;
    });
  }, [timelineRange]);

  const handleTimelineChange = useCallback((newRange) => {
    setSelectedTimelineRange(newRange);
    if (onTimelineRangeChange) {
      onTimelineRangeChange(newRange);
    }
  }, [onTimelineRangeChange]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [targetForPayment, setTargetForPayment] = useState(null);
  const [payFormData, setPayFormData] = useState({
    amount: '',
    payment_method: 'upi',
    payment_account: '',
    payment_reference: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_notes: '',
    full_payment: true,
  });

  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [targetForDelivery, setTargetForDelivery] = useState(null);
  const [deliveryFormData, setDeliveryFormData] = useState({
    delivery_status: 'delivered',
    delivery_notes: '',
  });

  // Multi-document Lightbox Gallery State
  const [activeViewerRecord, setActiveViewerRecord] = useState(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);

  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Fetch logic
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: statusFilter,
        delivery_status: deliveryFilter,
        category: categoryFilter,
        store: storeFilter,
        search: searchQuery,
        overdue: onlyOverdue ? 'true' : undefined,
      };

      if (!selectedTimelineRange?.isAllTime) {
        if (selectedTimelineRange?.startDate) {
          params.start_date = selectedTimelineRange.startDate;
        }
        if (selectedTimelineRange?.endDate) {
          params.end_date = selectedTimelineRange.endDate;
        }
      }

      const [data, sum] = await Promise.all([
        fetchOwnerExpenses(params),
        fetchOwnerExpenseSummary(params),
      ]);
      setExpenses(Array.isArray(data) ? data : (data.results || []));
      setSummary(sum);
    } catch (err) {
      showToast(err.message || 'Failed to load expense records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    deliveryFilter,
    categoryFilter,
    storeFilter,
    searchQuery,
    onlyOverdue,
    selectedTimelineRange,
    showToast,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Multi-file Lightbox
  const handleOpenFileViewer = (record, initialIndex = 0) => {
    setActiveViewerRecord(record);
    setActiveViewerIndex(initialIndex);
  };

  // Compile full files list for an expense record (legacy bill_file + multiple attachments)
  const getRecordFileList = useCallback((record) => {
    if (!record) return [];
    const files = [];

    if (record.attachments && record.attachments.length > 0) {
      record.attachments.forEach((att) => {
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

    if (record.bill_file_url || record.bill_file) {
      const legacyUrl = normalizeMediaUrl(record.bill_file_url || record.bill_file);
      // Don't duplicate if already in attachments
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

  // Handle Quick Pay
  const handleOpenPayModal = (item) => {
    setTargetForPayment(item);
    setPayFormData({
      amount: String(item.outstanding_amount || item.total_amount),
      payment_method: item.payment_method || 'upi',
      payment_account: item.payment_account || '',
      payment_reference: item.payment_reference || '',
      payment_date: new Date().toISOString().slice(0, 10),
      payment_notes: item.payment_notes || '',
      full_payment: true,
    });
    setIsPayModalOpen(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!targetForPayment) return;
    try {
      await markOwnerExpensePaid(targetForPayment.id, {
        amount: payFormData.full_payment ? targetForPayment.outstanding_amount : payFormData.amount,
        is_additive: true,
        payment_method: payFormData.payment_method,
        payment_account: payFormData.payment_account,
        payment_reference: payFormData.payment_reference,
        payment_date: payFormData.payment_date,
        payment_notes: payFormData.payment_notes,
      });
      showToast(`Payment recorded for ${targetForPayment.record_number}`);
      setIsPayModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  // Handle Quick Delivery Status
  const handleOpenDeliveryModal = (item) => {
    setTargetForDelivery(item);
    setDeliveryFormData({
      delivery_status: item.delivery_status === 'pending' || item.delivery_status === 'in_transit' ? 'delivered' : item.delivery_status,
      delivery_notes: item.delivery_notes || '',
    });
    setIsDeliveryModalOpen(true);
  };

  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    if (!targetForDelivery) return;
    try {
      await updateOwnerExpenseDelivery(targetForDelivery.id, deliveryFormData);
      showToast(`Delivery status updated for ${targetForDelivery.record_number}`);
      setIsDeliveryModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update delivery status', 'error');
    }
  };

  // Handle Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete this expense record: "${title}"?`)) {
      return;
    }
    try {
      await deleteOwnerExpense(id);
      showToast('Record deleted successfully');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete record', 'error');
    }
  };

  return (

    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            backgroundColor: toastMessage.type === 'error' ? '#EF4444' : '#10B981',
            color: '#FFFFFF',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {toastMessage.msg}
        </div>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.45rem',
              fontWeight: 800,
              color: 'var(--text-primary, #F8FAFC)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(139, 92, 246, 0.18)',
                color: '#A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={20} />
            </div>
            Expense, Purchase &amp; Delivery Ledger
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '0.85rem',
              color: 'var(--text-secondary, #94A3B8)',
            }}
          >
            Centralised log for purchases, multi-bill attachments (photos &amp; PDFs), payment status &amp; incoming shipments. Isolated from store P&amp;L balances.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              setEditingExpense(null);
              setIsFormModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              backgroundColor: '#8B5CF6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 3px 12px rgba(139, 92, 246, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={17} />
            + Record Expense / Order
          </button>
        </div>
      </div>


      {/* 4 TOP KPI CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Outstanding Unpaid */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Total Outstanding Balance
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#FBBF24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={17} />
            </div>
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: (summary?.total_outstanding || 0) > 0 ? '#FBBF24' : '#10B981',
              letterSpacing: '-0.02em',
            }}
          >
            {currencySymbol}
            {Number(summary?.total_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            {summary?.unpaid_count || 0} bills with pending payments
          </div>
        </div>

        {/* Card 2: Paid This Month */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Settled This Month
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: '#34D399',
              letterSpacing: '-0.02em',
            }}
          >
            {currencySymbol}
            {Number(summary?.paid_this_month || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Total paid out in current calendar month
          </div>
        </div>

        {/* Card 3: Overdue Bills */}
        <div
          onClick={() => setOnlyOverdue((prev) => !prev)}
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: onlyOverdue
              ? '2px solid #EF4444'
              : '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Overdue Due-Dates
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#F87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={17} />
            </div>
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: (summary?.overdue_count || 0) > 0 ? '#F87171' : 'var(--text-primary, #F8FAFC)',
              letterSpacing: '-0.02em',
            }}
          >
            {summary?.overdue_count || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: onlyOverdue ? '#F87171' : 'var(--text-secondary, #94A3B8)' }}>
            {onlyOverdue ? 'Click to show all entries' : 'Click to filter only overdue bills'}
          </div>
        </div>

        {/* Card 4: Shipments / Deliveries Pending */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'var(--card-bg, #1E293B)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              Incoming Deliveries
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Truck size={17} />
            </div>
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: '#38BDF8',
              letterSpacing: '-0.02em',
            }}
          >
            {summary?.pending_delivery_count || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Shipments awaiting branch arrival / receipt
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: 'var(--card-bg, #1E293B)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Search */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 240px',
            minWidth: '220px',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary, #94A3B8)',
            }}
          />
          <input
            type="text"
            placeholder="Search by title, vendor, record #, UTR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #F8FAFC)',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Universal Timeline Range Selector */}
          <TimelineRangeSelector
            value={selectedTimelineRange}
            defaultUnit="month"
            defaultCount={1}
            onChange={handleTimelineChange}
            allowFuture={false}
            showXAxis={false}
            isAllTime={selectedTimelineRange?.isAllTime || false}
          />

          {/* Payment Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #F8FAFC)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} style={{ background: '#1E293B', color: '#F8FAFC' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Delivery Status Dropdown */}
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #F8FAFC)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {DELIVERY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} style={{ background: '#1E293B', color: '#F8FAFC' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #F8FAFC)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id} style={{ background: '#1E293B', color: '#F8FAFC' }}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Branch Filter (if multi-branch) */}
          {stores.length > 0 && (
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all" style={{ background: '#1E293B' }}>All Branches</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#1E293B' }}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => loadData()}
            title="Refresh"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #F8FAFC)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* EXPENSE LEDGER DATA TABLE */}
      <div
        style={{
          borderRadius: '14px',
          backgroundColor: 'var(--card-bg, #1E293B)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.86rem',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  backgroundColor: 'rgba(0,0,0,0.18)',
                  color: 'var(--text-secondary, #94A3B8)',
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Record #</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Date / Due</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Title &amp; Category</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Vendor / Payee</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Total</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Payment</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Shipment</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Attachments</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94A3B8)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    <div>Loading records...</div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary, #94A3B8)' }}>
                    <Receipt size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No expense or purchase records found</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                      Click "+ Record Expense / Order" to log a new purchase or bill.
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((row) => {
                  const isOverdue = row.is_overdue;
                  const isPaid = row.status === 'paid';
                  const isPartial = row.status === 'partial';
                  const fileList = getRecordFileList(row);

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))',
                        backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Record # */}
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {row.record_number}
                          {isOverdue && (
                            <span
                              title="Payment Overdue"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                color: '#F87171',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                              }}
                            >
                              OVERDUE
                            </span>
                          )}
                        </div>
                        {row.store_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                            {row.store_name}
                          </div>
                        )}
                      </td>

                      {/* Date & Due Date */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary, #94A3B8)', whiteSpace: 'nowrap' }}>
                        <div>{row.expense_date}</div>
                        {row.due_date ? (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isOverdue ? '#F87171' : 'var(--text-secondary, #94A3B8)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '2px',
                            }}
                          >
                            <Clock size={11} /> Due: {row.due_date}
                          </div>
                        ) : null}
                      </td>

                      {/* Title & Category */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
                          {row.title}
                        </div>
                        <div
                          style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            fontSize: '0.72rem',
                            padding: '1px 8px',
                            borderRadius: '5px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-secondary, #94A3B8)',
                          }}
                        >
                          {row.category_display || row.category}
                        </div>
                      </td>

                      {/* Vendor */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-primary, #F8FAFC)' }}>
                        {row.vendor_name || <span style={{ color: 'var(--text-secondary, #64748B)' }}>—</span>}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                        {currencySymbol}
                        {Number(row.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#34D399' }}>
                        {currencySymbol}
                        {Number(row.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Outstanding */}
                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: Number(row.outstanding_amount) > 0 ? '#FBBF24' : '#10B981',
                        }}
                      >
                        {currencySymbol}
                        {Number(row.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Payment Status Badge */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {isPaid ? (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#34D399',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            Paid
                          </span>
                        ) : isPartial ? (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              color: '#60A5FA',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            Partial
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#FBBF24',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Delivery Status Badge / Quick Confirm */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {row.delivery_status === 'delivered' ? (
                          <span
                            onClick={() => handleOpenDeliveryModal(row)}
                            title="Click to view delivery info"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#34D399',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            Delivered
                          </span>
                        ) : row.delivery_status === 'in_transit' ? (
                          <button
                            onClick={() => handleOpenDeliveryModal(row)}
                            title="In Transit. Click to mark Delivered"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: '#38BDF8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <Truck size={12} />
                            In Transit
                          </button>
                        ) : row.delivery_status === 'pending' ? (
                          <button
                            onClick={() => handleOpenDeliveryModal(row)}
                            title="Awaiting Arrival. Click to update"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <Package size={12} />
                            Awaiting
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-secondary, #64748B)', fontSize: '0.75rem' }}>
                            N/A
                          </span>
                        )}
                      </td>

                      {/* Multi-Bill Attachments Button / Badge */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {fileList.length > 0 ? (
                          <button
                            onClick={() => handleOpenFileViewer(row, 0)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              backgroundColor: 'rgba(139, 92, 246, 0.15)',
                              color: '#A78BFA',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Paperclip size={13} />
                            {fileList.length} {fileList.length === 1 ? 'Doc' : 'Docs'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-secondary, #64748B)', fontSize: '0.75rem' }}>
                            None
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {!isPaid && (
                            <button
                              onClick={() => handleOpenPayModal(row)}
                              title="Record Payment"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                backgroundColor: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <DollarSign size={13} />
                              Pay
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingExpense(row);
                              setIsFormModalOpen(true);
                            }}
                            title="Edit Record"
                            style={{
                              padding: '5px 7px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                              color: 'var(--text-primary, #F8FAFC)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            onClick={() => handleDelete(row.id, row.title)}
                            title="Delete Record"
                            style={{
                              padding: '5px 7px',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#F87171',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT EXPENSE & PURCHASE RECORD                            */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <ExpenseFormModal
          isOpen={isFormModalOpen}
          initialData={editingExpense}
          stores={stores}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={() => {
            setIsFormModalOpen(false);
            loadData();
          }}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK PAYMENT MODAL                                             */}
      {/* ========================================================================= */}
      {isPayModalOpen && targetForPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#1E293B',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                  Record Payment Settlement
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '3px' }}>
                  {targetForPayment.record_number} • {targetForPayment.title}
                </div>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
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

            <form onSubmit={handleSubmitPayment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total Bill Amount</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                    {currencySymbol}{Number(targetForPayment.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Current Outstanding</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FBBF24' }}>
                    {currencySymbol}{Number(targetForPayment.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Full Payment Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#F8FAFC' }}>
                <input
                  type="checkbox"
                  checked={payFormData.full_payment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPayFormData((prev) => ({
                      ...prev,
                      full_payment: checked,
                      amount: checked ? String(targetForPayment.outstanding_amount) : prev.amount,
                    }));
                  }}
                />
                Pay remaining full outstanding ({currencySymbol}{Number(targetForPayment.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </label>

              {!payFormData.full_payment && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    Payment Amount to Settle Now ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={targetForPayment.outstanding_amount}
                    required
                    value={payFormData.amount}
                    onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <select
                    value={payFormData.payment_method}
                    onChange={(e) => setPayFormData({ ...payFormData, payment_method: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: '#1E293B' }}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payFormData.payment_date}
                    onChange={(e) => setPayFormData({ ...payFormData, payment_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  Paid By Which Account / Source
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Current A/C, Cash Box, Owner GPay"
                  value={payFormData.payment_account}
                  onChange={(e) => setPayFormData({ ...payFormData, payment_account: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  UTR # / Cheque # / Transaction Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR 42918847294, Chq #00123"
                  value={payFormData.payment_reference}
                  onChange={(e) => setPayFormData({ ...payFormData, payment_reference: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                  }}
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELIVERY & SHIPMENT STATUS MODAL                                */}
      {/* ========================================================================= */}
      {isDeliveryModalOpen && targetForDelivery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#1E293B',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                  Confirm Delivery / Shipment Arrival
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '3px' }}>
                  {targetForDelivery.record_number} • {targetForDelivery.title}
                </div>
              </div>
              <button
                onClick={() => setIsDeliveryModalOpen(false)}
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

            <form onSubmit={handleSubmitDelivery} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
                  Arrival / Delivery Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'delivered', label: 'Received / Delivered', icon: CheckCircle2, color: '#10B981' },
                    { id: 'in_transit', label: 'In Transit / Dispatched', icon: Truck, color: '#38BDF8' },
                    { id: 'pending', label: 'Awaiting Arrival', icon: Package, color: '#F87171' },
                    { id: 'not_applicable', label: 'Not Applicable', icon: Tag, color: '#94A3B8' },
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = deliveryFormData.delivery_status === s.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setDeliveryFormData({ ...deliveryFormData, delivery_status: s.id })}
                        style={{
                          padding: '12px 10px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${s.color}` : '1px solid rgba(255,255,255,0.1)',
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)',
                          color: '#F8FAFC',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        <Icon size={16} color={s.color} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  Delivery / Inspection Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Received 5 cartons via DTDC. Inspected by staff member; all items intact."
                  value={deliveryFormData.delivery_notes}
                  onChange={(e) => setDeliveryFormData({ ...deliveryFormData, delivery_notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {targetForDelivery.received_by_name && (
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                  Previously confirmed received by: <strong style={{ color: '#F8FAFC' }}>{targetForDelivery.received_by_name}</strong> on {targetForDelivery.received_at ? new Date(targetForDelivery.received_at).toLocaleString() : ''}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#8B5CF6',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(139,92,246,0.35)',
                  }}
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MULTI-FILE GALLERY / LIGHTBOX (IMAGE & PDF SUPPORT)             */}
      {/* ========================================================================= */}
      {activeViewerRecord && (() => {
        const fileList = getRecordFileList(activeViewerRecord);
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
                      {activeViewerRecord.record_number} • {currentFile.name}
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#94A3B8' }}>
                      ({activeViewerIndex + 1} of {fileList.length})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <a
                    href={currentFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#38BDF8',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <Download size={14} /> Download / Open Tab
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

              {/* Main Content Area */}
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  overflow: 'auto',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0F172A',
                  minHeight: '440px',
                }}
              >
                {/* Previous Button */}
                {fileList.length > 1 && (
                  <button
                    onClick={() => setActiveViewerIndex((prev) => (prev > 0 ? prev - 1 : fileList.length - 1))}
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#FFFFFF',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {/* Render PDF or Image */}
                {currentFile.isPdf ? (
                  <object
                    data={currentFile.url}
                    type="application/pdf"
                    style={{
                      width: '100%',
                      height: '70vh',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px' }}>
                      <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>Inline PDF preview is not supported directly by your browser window.</p>
                      <a
                        href={currentFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#38BDF8',
                          color: '#0F172A',
                          fontWeight: 700,
                          textDecoration: 'none',
                          marginTop: '8px',
                        }}
                      >
                        <ExternalLink size={16} /> Open PDF in Separate Tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <img
                    src={currentFile.url}
                    alt={currentFile.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    }}
                  />
                )}

                {/* Next Button */}
                {fileList.length > 1 && (
                  <button
                    onClick={() => setActiveViewerIndex((prev) => (prev < fileList.length - 1 ? prev + 1 : 0))}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#FFFFFF',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              {/* Bottom Thumbnails Strip */}
              {fileList.length > 1 && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    overflowX: 'auto',
                  }}
                >
                  {fileList.map((f, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveViewerIndex(idx)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: idx === activeViewerIndex ? '2px solid #8B5CF6' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: idx === activeViewerIndex ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0,0,0,0.3)',
                        color: idx === activeViewerIndex ? '#FFFFFF' : '#94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: idx === activeViewerIndex ? 700 : 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.isPdf ? <FileText size={14} color="#F87171" /> : <ImageIcon size={14} color="#38BDF8" />}
                      {f.name.length > 20 ? `${f.name.slice(0, 18)}...` : f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: FULL ADD / EDIT FORM MODAL WITH MULTI-ATTACHMENTS
// =========================================================================
function ExpenseFormModal({
  isOpen,
  initialData,
  stores = [],
  onClose,
  onSuccess,
  showToast,
}) {
  const isEditing = Boolean(initialData?.id);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    category: initialData?.category || 'stock_order',
    vendor_name: initialData?.vendor_name || '',
    total_amount: initialData?.total_amount || '',
    paid_amount: initialData?.paid_amount || '0.00',
    expense_date: initialData?.expense_date || new Date().toISOString().slice(0, 10),
    due_date: initialData?.due_date || '',
    delivery_status: initialData?.delivery_status || 'not_applicable',
    delivery_notes: initialData?.delivery_notes || '',
    payment_method: initialData?.payment_method || 'upi',
    payment_account: initialData?.payment_account || '',
    payment_date: initialData?.payment_date || new Date().toISOString().slice(0, 10),
    payment_reference: initialData?.payment_reference || '',
    payment_notes: initialData?.payment_notes || '',
    store: initialData?.store || '',
    notes: initialData?.notes || '',
  });

  // Multiple new files to upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  // Existing attachments on edit
  const [existingAttachments, setExistingAttachments] = useState(
    initialData?.attachments || []
  );

  const [submitting, setSubmitting] = useState(false);

  // Quick initial payment check
  const [isImmediatelyPaid, setIsImmediatelyPaid] = useState(
    initialData ? initialData.status === 'paid' : false
  );

  const handleMultipleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveNewFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingAttachment = async (attachmentId) => {
    if (!initialData?.id) return;
    try {
      const updated = await deleteOwnerExpenseAttachment(initialData.id, attachmentId);
      setExistingAttachments(updated.attachments || []);
      showToast('Attachment removed');
    } catch (err) {
      showToast(err.message || 'Failed to remove attachment', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('vendor_name', formData.vendor_name);
      data.append('total_amount', formData.total_amount);

      // Amount handling
      const totalAmt = parseFloat(formData.total_amount) || 0;
      let finalPaid = parseFloat(formData.paid_amount) || 0;
      if (isImmediatelyPaid && !isEditing) {
        finalPaid = totalAmt;
      }
      data.append('paid_amount', String(finalPaid));

      data.append('expense_date', formData.expense_date);
      if (formData.due_date) data.append('due_date', formData.due_date);
      data.append('delivery_status', formData.delivery_status);
      if (formData.delivery_notes) data.append('delivery_notes', formData.delivery_notes);

      if (finalPaid > 0) {
        data.append('payment_method', formData.payment_method);
        if (formData.payment_account) data.append('payment_account', formData.payment_account);
        if (formData.payment_date) data.append('payment_date', formData.payment_date);
        if (formData.payment_reference) data.append('payment_reference', formData.payment_reference);
        if (formData.payment_notes) data.append('payment_notes', formData.payment_notes);
      }

      if (formData.store) data.append('store', formData.store);
      if (formData.notes) data.append('notes', formData.notes);

      // Append all multiple attachments
      selectedFiles.forEach((file) => {
        data.append('attachments', file);
      });

      if (isEditing) {
        await updateOwnerExpense(initialData.id, data);
        showToast('Record updated successfully');
      } else {
        await createOwnerExpense(data);
        showToast('Record created successfully');
      }

      onSuccess();
    } catch (err) {
      showToast(err.message || 'Failed to save record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          backgroundColor: '#1E293B',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
              {isEditing ? `Edit Record (${initialData.record_number})` : 'New Expense / Stock Order Bill'}
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '3px' }}>
              Isolated from operational account balances; supports multiple photos and PDFs.
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Row 1: Title & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Item / Expense Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 100x Cotton Fabric Rolls, Showroom AC repair"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              >
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#1E293B' }}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Vendor, Branch Tag */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Vendor / Supplier / Payee Name
              </label>
              <input
                type="text"
                placeholder="e.g. Surat Textiles Ltd, Star Logistics"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Branch / Store Tag (Optional)
              </label>
              <select
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              >
                <option value="" style={{ background: '#1E293B' }}>Global / Centralised</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#1E293B' }}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Total Amount & Date & Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Total Bill Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Order / Bill Date *
              </label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Payment Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Section: Delivery / Shipment Status */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={17} color="#38BDF8" />
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#F8FAFC' }}>
                Shipment &amp; Physical Arrival Status
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                  Arrival Status
                </label>
                <select
                  value={formData.delivery_status}
                  onChange={(e) => setFormData({ ...formData, delivery_status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                >
                  <option value="not_applicable" style={{ background: '#1E293B' }}>Not Applicable (Service/Rent)</option>
                  <option value="pending" style={{ background: '#1E293B' }}>Awaiting Shipment / Arrival</option>
                  <option value="in_transit" style={{ background: '#1E293B' }}>In Transit / Dispatched</option>
                  <option value="delivered" style={{ background: '#1E293B' }}>Received / Delivered at Store</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                  Tracking / Package Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Courier Docket #, Transporter phone"
                  value={formData.delivery_notes}
                  onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.84rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section: Payment Settlement Options */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={17} color="#10B981" />
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#F8FAFC' }}>
                  Payment Settlement
                </span>
              </div>

              {!isEditing && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#F8FAFC' }}>
                  <input
                    type="checkbox"
                    checked={isImmediatelyPaid}
                    onChange={(e) => setIsImmediatelyPaid(e.target.checked)}
                  />
                  Mark as fully paid right now
                </label>
              )}
            </div>

            {(isImmediatelyPaid || (isEditing && Number(formData.paid_amount) > 0)) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: '#1E293B' }}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                    Paid from which Account / Channel
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, GPay, Cash"
                    value={formData.payment_account}
                    onChange={(e) => setFormData({ ...formData, payment_account: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                    Payment Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR 948291038"
                    value={formData.payment_reference}
                    onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F8FAFC',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Upload Multiple Bills & Attachments (Images + PDFs) */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={17} color="#A78BFA" />
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#F8FAFC' }}>
                  Bill Attachments (Photos &amp; PDFs)
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Select multiple files at once
              </span>
            </div>

            {/* Existing Attachments on Edit */}
            {existingAttachments.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
                  Saved Attachments ({existingAttachments.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {existingAttachments.map((att) => {
                    const normUrl = normalizeMediaUrl(att.file_url || att.file);
                    const isPdf = normUrl.toLowerCase().includes('.pdf');
                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontSize: '0.78rem',
                          color: '#F8FAFC',
                        }}
                      >
                        {isPdf ? <FileText size={15} color="#F87171" /> : <ImageIcon size={15} color="#38BDF8" />}
                        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.file_name || 'Attachment'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingAttachment(att.id)}
                          title="Delete saved attachment"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload Input for Multiple Files */}
            <div>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  borderRadius: '10px',
                  border: '2px dashed rgba(255,255,255,0.15)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                <Upload size={24} color="#A78BFA" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC' }}>
                  Click to select photos or PDF documents
                </span>
                <span style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '4px' }}>
                  You can choose multiple photos (JPG, PNG) and PDF invoices together
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleMultipleFiles}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Preview of newly selected files */}
            {selectedFiles.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
                  Ready to Upload ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedFiles.map((file, idx) => {
                    const isImg = file.type.startsWith('image/');
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          fontSize: '0.78rem',
                          color: '#F8FAFC',
                        }}
                      >
                        {isImg ? <ImageIcon size={15} color="#38BDF8" /> : <FileText size={15} color="#F87171" />}
                        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewFile(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
              Additional Remarks / Item Checklist
            </label>
            <textarea
              rows={2}
              placeholder="Any additional details or reminder notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#F8FAFC',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Modal Footer Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94A3B8',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.86rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                boxShadow: '0 3px 12px rgba(139, 92, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : null}
              {isEditing ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
