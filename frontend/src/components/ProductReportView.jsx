import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  PackageSearch,
  Receipt,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Tag,
  DollarSign,
  TrendingUp,
  Boxes,
  Percent,
  Clock,
  User,
  ShoppingBag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  X,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  Store as StoreIcon,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { fetchItems, fetchProductAnalytics, getSaleOrdersPage } from '../api';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import ReceiptModal from './ReceiptModal';
import TimelineRangeSelector from './TimelineRangeSelector';

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

export default function ProductReportView({
  stores = [],
  activeStoreId,
  isCombined = false,
  currentUser,
  timelineRange: propTimelineRange,
  onTimelineRangeChange,
}) {
  // Product Search & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchAbortControllerRef = useRef(null);

  // Timeframe state (Universal template from Financial Overview)
  const [timelineRange, setTimelineRange] = useState(() => {
    if (propTimelineRange) return propTimelineRange;
    return {
      unit: 'month',
      count: 1,
      granularity: 'week',
      isAllTime: false,
      label: 'This Month',
      startDate: null,
      endDate: null,
    };
  });

  // Analytics KPI State
  const [analytics, setAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  // Bills Table State
  const [billsData, setBillsData] = useState(null);
  const [billsPage, setBillsPage] = useState(1);
  const [billsPageSize, setBillsPageSize] = useState(15);
  const [billsSearch, setBillsSearch] = useState('');
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(null);

  // Bill Receipt Modal State
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const params = {
          search: searchQuery.trim(),
          page_size: 15,
        };
        if (!isCombined && activeStoreId && activeStoreId !== 'all') {
          params.store = activeStoreId;
        }
        const data = await fetchItems(params, { signal: controller.signal });
        const items = Array.isArray(data) ? data : data?.results || [];
        setSearchResults(items);
        setIsDropdownOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Product search error:', err);
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, activeStoreId, isCombined]);

  // Load Product Analytics for a given timeframe
  const loadProductAnalytics = useCallback(async (productId, range = timelineRange) => {
    if (!productId) return;
    setIsLoadingAnalytics(true);
    setAnalyticsError('');
    try {
      const params = {};
      if (!isCombined && activeStoreId && activeStoreId !== 'all') {
        params.store = activeStoreId;
      }
      if (range && !range.isAllTime) {
        if (range.startDate) params.start_date = range.startDate;
        if (range.endDate) params.end_date = range.endDate;
      }
      const data = await fetchProductAnalytics(productId, params);
      setAnalytics(data);
    } catch (err) {
      console.warn('Failed to load product analytics:', err);
      setAnalyticsError(err.message || 'Failed to load product analytics');
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [activeStoreId, isCombined, timelineRange]);

  // Load Paginated Bills for Selected Product and timeframe
  const loadProductBills = useCallback(async (productId, page, pageSize, search, range = timelineRange) => {
    if (!productId) return;
    setIsLoadingBills(true);
    try {
      const params = {
        item: productId,
        page,
        page_size: pageSize,
      };
      if (search?.trim()) {
        params.search = search.trim();
      }
      if (!isCombined && activeStoreId && activeStoreId !== 'all') {
        params.store = activeStoreId;
      }
      if (range && !range.isAllTime) {
        if (range.startDate) params.start_date = range.startDate;
        if (range.endDate) params.end_date = range.endDate;
      }
      const data = await getSaleOrdersPage(params);
      setBillsData(data);
    } catch (err) {
      console.warn('Failed to load product bills:', err);
      setBillsData(null);
    } finally {
      setIsLoadingBills(false);
    }
  }, [activeStoreId, isCombined, timelineRange]);

  // Timeframe change handler
  const handleTimelineRangeChange = useCallback((newRange) => {
    if (!newRange) return;
    setTimelineRange(newRange);
    onTimelineRangeChange?.(newRange);
    if (selectedProduct?.id) {
      loadProductAnalytics(selectedProduct.id, newRange);
      loadProductBills(selectedProduct.id, 1, billsPageSize, billsSearch, newRange);
      setBillsPage(1);
    }
  }, [selectedProduct?.id, billsPageSize, billsSearch, loadProductAnalytics, loadProductBills, onTimelineRangeChange]);

  // Manual Refresh Handler
  const handleManualRefresh = useCallback(() => {
    if (selectedProduct?.id) {
      loadProductAnalytics(selectedProduct.id, timelineRange);
      loadProductBills(selectedProduct.id, billsPage, billsPageSize, billsSearch, timelineRange);
      showNotification('success', 'Product report refreshed for timeframe!');
    }
  }, [selectedProduct?.id, timelineRange, billsPage, billsPageSize, billsSearch, loadProductAnalytics, loadProductBills, showNotification]);

  // Trigger data load when product is selected or pagination/search changes
  useEffect(() => {
    if (selectedProduct?.id) {
      loadProductAnalytics(selectedProduct.id, timelineRange);
      loadProductBills(selectedProduct.id, billsPage, billsPageSize, billsSearch, timelineRange);
    } else {
      setAnalytics(null);
      setBillsData(null);
    }
  }, [selectedProduct?.id, billsPage, billsPageSize, billsSearch]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setIsDropdownOpen(false);
    setSearchQuery('');
    setBillsPage(1);
    setBillsSearch('');
  };

  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
    setAnalytics(null);
    setBillsData(null);
    setSearchQuery('');
    setBillsSearch('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleCopyInvoice = (invNum) => {
    if (!invNum) return;
    navigator.clipboard?.writeText(invNum);
    setCopiedInvoice(invNum);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  // Export Product Report to CSV
  const handleExportCsv = () => {
    if (!selectedProduct) return;
    const p = selectedProduct;
    const perf = analytics?.performance || analytics || {};
    const bills = billsData?.results || [];

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `WONDERSALE OS - PRODUCT FINANCIAL REPORT\r\n`;
    csvContent += `Product Name,${(p.name || '').replace(/,/g, ' ')}\r\n`;
    csvContent += `UID / Barcode,${p.uid || ''}\r\n`;
    csvContent += `Timeframe,${timelineRange?.isAllTime ? 'All Time' : (timelineRange?.label || 'Custom')}\r\n`;
    if (timelineRange?.startDate && timelineRange?.endDate && !timelineRange.isAllTime) {
      csvContent += `Date Range,${timelineRange.startDate} to ${timelineRange.endDate}\r\n`;
    }
    csvContent += `Current Stock,${p.quantity || 0}\r\n`;
    csvContent += `Cost Price,${p.cost_price || 0}\r\n`;
    csvContent += `Selling Price,${p.selling_price || 0}\r\n`;
    csvContent += `MRP,${p.mrp || p.selling_price || 0}\r\n`;
    csvContent += `Units Sold (Net),${perf.total_units_sold || 0}\r\n`;
    csvContent += `Gross Revenue,${perf.total_revenue || 0}\r\n`;
    csvContent += `Gross Profit,${perf.total_profit || 0}\r\n`;
    csvContent += `Margin %,${perf.margin_pct || 0}%\r\n`;
    csvContent += `\r\n`;
    csvContent += `ITEMIZED BILLS HISTORY\r\n`;
    csvContent += `Invoice Number,Date,Store,Customer,Cashier,Qty,Unit Price,Item Total,Bill Grand Total,Payment Method,Status\r\n`;

    bills.forEach((order) => {
      const lineItem = (order.items || []).find((it) => String(it.item) === String(p.id) || String(it.item_id) === String(p.id)) || {};
      const qty = lineItem.quantity || order.total_units || 1;
      const unitPrice = lineItem.unit_selling_price || order.total_amount;
      const itemTotal = lineItem.total_price || (qty * unitPrice);
      const custName = (order.customer_name || 'Walk-in Customer').replace(/,/g, ' ');
      const cashierName = (order.cashier_name || 'Cashier').replace(/,/g, ' ');
      const storeName = (order.store_name || order.store_details?.name || 'Wondersale').replace(/,/g, ' ');

      csvContent += `${order.invoice_number},"${order.created_at}",${storeName},${custName},${cashierName},${qty},${unitPrice},${itemTotal},${order.total_amount || order.grand_total},${order.payment_method},${order.status}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Report_${p.uid || p.id}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Product report exported as CSV!');
  };

  // Derived KPI calculations
  const perf = analytics?.performance || analytics || {};
  const totalUnitsSold = perf.total_units_sold ?? 0;
  const totalRevenue = parseFloat(perf.total_revenue ?? 0);
  const totalCost = parseFloat(perf.total_cost ?? 0);
  const totalProfit = parseFloat(perf.total_profit ?? (totalRevenue - totalCost));
  const marginPct = perf.margin_pct ?? (totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0);
  const markupPct = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : 0;
  const currentStock = selectedProduct?.quantity ?? 0;
  const costPrice = parseFloat(selectedProduct?.cost_price ?? 0);
  const sellingPrice = parseFloat(selectedProduct?.selling_price ?? 0);
  const mrpPrice = parseFloat(selectedProduct?.mrp ?? sellingPrice);
  const stockValuationCost = currentStock * costPrice;
  const stockValuationRetail = currentStock * sellingPrice;
  const potentialStockProfit = stockValuationRetail - stockValuationCost;
  const dailyVelocity = perf.daily_velocity ?? 0;
  const daysInventoryLeft = perf.days_inventory_left;
  const bestMonth = perf.best_month;
  const bestDow = perf.best_day_of_week || perf.best_dow;

  // Pagination calculation
  const totalBillsCount = billsData?.count ?? 0;
  const totalBillsPages = Math.max(1, Math.ceil(totalBillsCount / billsPageSize));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Toast Notification Banner */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 10000,
            padding: '12px 20px',
            borderRadius: '10px',
            backgroundColor: notification.type === 'success' ? '#10B981' : '#EF4444',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.88rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideUp 0.2s ease',
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP SEARCH & PRODUCT SELECTOR BAR                                      */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <PackageSearch size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                Product Financial &amp; Sales Report
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Search any catalog product to inspect profit margins, inventory valuation, and itemized billing history.
              </p>
            </div>
          </div>

          {selectedProduct && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#34D399',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Download size={14} />
                <span>Export Report CSV</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelectedProduct}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
                <span>Change Product</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Input Container */}
        <div ref={searchContainerRef} style={{ position: 'relative', width: '100%' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                color: 'var(--text-muted, #64748B)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setIsDropdownOpen(true);
              }}
              placeholder={
                selectedProduct
                  ? `Selected: ${selectedProduct.name} (${selectedProduct.uid}) — Type to search another...`
                  : 'Search product by name, UID / barcode, category, or section... (Press "/" to focus)'
              }
              className="form-input"
              style={{
                width: '100%',
                paddingLeft: '42px',
                paddingRight: searchQuery ? '40px' : '70px',
                height: '44px',
                fontSize: '0.92rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                backgroundColor: 'var(--bg-main, #0F172A)',
                color: 'var(--text-primary, #F8FAFC)',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #64748B)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            ) : (
              <span
                style={{
                  position: 'absolute',
                  right: '14px',
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-muted, #94A3B8)',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                }}
              >
                /
              </span>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 100,
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                maxHeight: '340px',
                overflowY: 'auto',
              }}
            >
              {isSearching ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)', fontSize: '0.85rem' }}>
                  Searching products across catalog...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)', fontSize: '0.85rem' }}>
                  No matching products found for "{searchQuery}"
                </div>
              ) : (
                searchResults.map((item) => {
                  const stock = item.quantity || 0;
                  const isStockOut = stock <= 0;
                  const isLowStock = stock > 0 && stock <= 10;
                  const isCurrent = selectedProduct?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectProduct(item)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {item.primary_image?.image || item.image ? (
                            <img
                              src={item.primary_image?.image || item.image}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <ShoppingBag size={18} color="var(--text-muted, #94A3B8)" />
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: 'var(--text-primary, #F8FAFC)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem' }}>
                            <span style={{ color: 'var(--brand-primary, #38BDF8)', fontFamily: 'monospace', fontWeight: 600 }}>
                              {item.uid}
                            </span>
                            {item.primary_subcategory?.name && (
                              <span style={{ color: 'var(--text-muted, #94A3B8)' }}>
                                • {item.primary_subcategory.name}
                              </span>
                            )}
                            {item.store?.name && (
                              <span style={{ color: 'var(--text-muted, #94A3B8)' }}>
                                • {item.store.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                            ₹{parseFloat(item.selling_price || 0).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>
                            Cost: ₹{parseFloat(item.cost_price || 0).toFixed(2)}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: isStockOut
                              ? 'rgba(239, 68, 68, 0.2)'
                              : isLowStock
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                            color: isStockOut ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981',
                            minWidth: '64px',
                            textAlign: 'center',
                          }}
                        >
                          {isStockOut ? 'Out of Stock' : `${stock} in stock`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SELECTED PRODUCT BANNER                                                */}
      {/* ========================================================================= */}
      {selectedProduct ? (
        <>
          <div
            className="glass-panel"
            style={{
              padding: '18px 24px',
              borderRadius: '14px',
              background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {selectedProduct.primary_image?.image || selectedProduct.image ? (
                  <img
                    src={selectedProduct.primary_image?.image || selectedProduct.image}
                    alt={selectedProduct.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <ShoppingBag size={28} color="var(--brand-primary, #38BDF8)" />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary, #F8FAFC)' }}>
                    {selectedProduct.name}
                  </h2>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: '#38BDF8',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    UID: {selectedProduct.uid}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>
                  {selectedProduct.primary_subcategory?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={13} /> {selectedProduct.primary_subcategory.name}
                    </span>
                  )}
                  {selectedProduct.section?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={13} /> Section: {selectedProduct.section.name}
                    </span>
                  )}
                  {selectedProduct.supplier?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Supplier: {selectedProduct.supplier.name}
                    </span>
                  )}
                  {selectedProduct.store?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <StoreIcon size={13} /> {selectedProduct.store.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Price & Stock Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Cost Price
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-secondary, #94A3B8)' }}>
                  ₹{costPrice.toFixed(2)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Selling Price
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10B981' }}>
                  ₹{sellingPrice.toFixed(2)}
                </div>
              </div>

              {mrpPrice > sellingPrice && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    MRP
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textDecoration: 'line-through' }}>
                    ₹{mrpPrice.toFixed(2)}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: currentStock <= 0
                    ? 'rgba(239, 68, 68, 0.2)'
                    : currentStock <= 10
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                  border: `1px solid ${currentStock <= 0 ? '#EF4444' : currentStock <= 10 ? '#F59E0B' : '#10B981'}40`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: currentStock <= 0 ? '#EF4444' : currentStock <= 10 ? '#F59E0B' : '#10B981' }}>
                  {currentStock <= 0 ? 'Out of Stock' : 'Stock On Hand'}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: currentStock <= 0 ? '#EF4444' : currentStock <= 10 ? '#F59E0B' : '#10B981' }}>
                  {currentStock} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>units</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. TIMEFRAME & REFRESH TOOLBAR (Exact Template from Financial Overview)   */}
          {/* ========================================================================= */}
          <div
            className="glass-panel"
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                }}
              >
                <Calendar size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                    Reporting Timeframe:
                  </span>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      color: '#38BDF8',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {timelineRange?.isAllTime ? 'All Time (Lifetime History)' : (timelineRange?.label || 'Selected Period')}
                  </span>
                </div>
                {timelineRange?.startDate && timelineRange?.endDate && !timelineRange.isAllTime && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                    Active range: {timelineRange.startDate} to {timelineRange.endDate}
                  </span>
                )}
              </div>
            </div>

            {/* Timeframe Selector & Refresh Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <TimelineRangeSelector
                value={timelineRange}
                defaultUnit="month"
                defaultCount={1}
                allowAllTime={true}
                compact={false}
                chartType="dashboard"
                onChange={handleTimelineRangeChange}
              />

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isLoadingAnalytics || isLoadingBills}
                title="Refresh Product Data for Timeframe"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: (isLoadingAnalytics || isLoadingBills) ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
              >
                <RefreshCw size={14} className={isLoadingAnalytics || isLoadingBills ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. FINANCIAL & SALES KPI METRICS GRID                                    */}
          {/* ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            {/* KPI 1: Units Sold */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Units Sold (Net)</span>
                <ShoppingBag size={18} color="#38BDF8" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38BDF8', marginTop: '6px' }}>
                {totalUnitsSold} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>units</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                Across {totalBillsCount} customer bills in {timelineRange?.isAllTime ? 'all time' : (timelineRange?.label || 'selected timeframe')}
              </div>
            </div>

            {/* KPI 2: Gross Sales Revenue */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gross Revenue</span>
                <DollarSign size={18} color="#10B981" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10B981', marginTop: '6px' }}>
                ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                {formatIndianCurrencyCompact(totalRevenue)} total sales
              </div>
            </div>

            {/* KPI 3: Gross Profit */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gross Profit</span>
                <TrendingUp size={18} color="#F59E0B" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalProfit >= 0 ? '#F59E0B' : '#EF4444', marginTop: '6px' }}>
                ₹{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                Revenue minus purchase cost
              </div>
            </div>

            {/* KPI 4: Profit Margin & Markup */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Margin / Markup</span>
                <Percent size={18} color="#A78BFA" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#A78BFA', marginTop: '6px' }}>
                {marginPct}% <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>margin</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                {markupPct}% pricing markup over cost
              </div>
            </div>

            {/* KPI 5: Inventory Valuation (Cost) */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock Value (Cost)</span>
                <Boxes size={18} color="#60A5FA" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#60A5FA', marginTop: '6px' }}>
                ₹{stockValuationCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                {currentStock} units × ₹{costPrice.toFixed(2)} cost
              </div>
            </div>

            {/* KPI 6: Inventory Valuation (Retail) */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock Value (Retail)</span>
                <DollarSign size={18} color="#34D399" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#34D399', marginTop: '6px' }}>
                ₹{stockValuationRetail.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                ₹{potentialStockProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} potential unrealized profit
              </div>
            </div>

            {/* KPI 7: Sales Velocity */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Velocity</span>
                <Clock size={18} color="#EC4899" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#EC4899', marginTop: '6px' }}>
                {dailyVelocity} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>/day</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                {daysInventoryLeft !== null && daysInventoryLeft !== undefined
                  ? `~${daysInventoryLeft} days of stock remaining`
                  : 'Velocity calculated from active sales'}
              </div>
            </div>

            {/* KPI 8: Peak Sales Timing */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94A3B8)' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peak Sales Period</span>
                <Sparkles size={18} color="#FBBF24" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FBBF24', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bestMonth?.label || 'N/A'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                Best day: {bestDow?.day_name || 'N/A'} ({bestDow?.share_pct || 0}% share)
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 5. CHRONOLOGICAL BILLS & SALES INVOICES TABLE                             */}
          {/* ========================================================================= */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              borderRadius: '14px',
              background: 'var(--bg-card, #1E293B)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Table Header & Local Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                  Sales Invoices &amp; Bills Containing This Product
                </h3>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                  }}
                >
                  {totalBillsCount} Bills Found
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Search within bills */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748B)' }} />
                  <input
                    type="text"
                    value={billsSearch}
                    onChange={(e) => {
                      setBillsSearch(e.target.value);
                      setBillsPage(1);
                    }}
                    placeholder="Search invoice or customer..."
                    className="form-input"
                    style={{
                      paddingLeft: '32px',
                      paddingRight: '10px',
                      height: '34px',
                      fontSize: '0.82rem',
                      width: '100%',
                      borderRadius: '8px',
                    }}
                  />
                </div>

                {/* Page Size Selector */}
                <select
                  value={billsPageSize}
                  onChange={(e) => {
                    setBillsPageSize(Number(e.target.value));
                    setBillsPage(1);
                  }}
                  className="form-input"
                  style={{
                    height: '34px',
                    fontSize: '0.82rem',
                    padding: '0 8px',
                    borderRadius: '8px',
                    color: 'var(--text-secondary, #94A3B8)',
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>{sz} / page</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invoices Table */}
            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      color: 'var(--text-secondary, #94A3B8)',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    <th style={{ padding: '12px 14px' }}>Invoice #</th>
                    <th style={{ padding: '12px 14px' }}>Date &amp; Time</th>
                    <th style={{ padding: '12px 14px' }}>Store</th>
                    <th style={{ padding: '12px 14px' }}>Customer</th>
                    <th style={{ padding: '12px 14px' }}>Cashier</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Item Total</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Bill Grand Total</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingBills ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#10B981' }} />
                        Loading item sales invoices...
                      </td>
                    </tr>
                  ) : !billsData?.results || billsData.results.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
                        No bills recorded for this product in {timelineRange?.isAllTime ? 'all time' : (timelineRange?.label || 'selected timeframe')}.
                      </td>
                    </tr>
                  ) : (
                    billsData.results.map((order) => {
                      const lineItem = (order.items || []).find((it) => String(it.item) === String(selectedProduct.id) || String(it.item_id) === String(selectedProduct.id)) || {};
                      const qty = lineItem.quantity || 1;
                      const rate = parseFloat(lineItem.unit_selling_price || 0);
                      const itemTotal = parseFloat(lineItem.total_price || (qty * rate));
                      const grandTotal = parseFloat(order.total_amount || order.grand_total || 0);
                      const dt = new Date(order.created_at || Date.now());
                      const dateFormatted = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      const timeFormatted = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                      const cashierName = order.cashier_name || 'Cashier';
                      const custName = order.customer_name || (order.customer_display_name && !order.customer_display_name.startsWith('Customer (') ? order.customer_display_name : '') || 'Walk-in';
                      const payMethod = (order.payment_method || 'cash').toLowerCase();

                      return (
                        <tr
                          key={order.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {/* Invoice # */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, color: 'var(--brand-primary, #38BDF8)', fontFamily: 'monospace' }}>
                                {order.invoice_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyInvoice(order.invoice_number)}
                                title="Copy invoice number"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted, #64748B)',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                {copiedInvoice === order.invoice_number ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94A3B8)', whiteSpace: 'nowrap' }}>
                            <div>{dateFormatted}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>{timeFormatted}</div>
                          </td>

                          {/* Store */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94A3B8)' }}>
                            {order.store_name || order.store_details?.name || 'Store'}
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>{custName}</div>
                            {order.customer_phone && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontFamily: 'monospace' }}>
                                {order.customer_phone}
                              </div>
                            )}
                          </td>

                          {/* Cashier */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94A3B8)' }}>
                            {cashierName}
                          </td>

                          {/* Qty Sold */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                            {qty}
                          </td>

                          {/* Unit Rate */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary, #94A3B8)' }}>
                            ₹{rate.toFixed(2)}
                          </td>

                          {/* Item Total */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                            ₹{itemTotal.toFixed(2)}
                          </td>

                          {/* Bill Grand Total & Mode */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                              ₹{grandTotal.toFixed(2)}
                            </div>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-muted, #94A3B8)',
                              }}
                            >
                              {payMethod}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                backgroundColor: order.status === 'completed'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : order.status === 'partial'
                                  ? 'rgba(236, 72, 153, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                color: order.status === 'completed'
                                  ? '#10B981'
                                  : order.status === 'partial'
                                  ? '#EC4899'
                                  : '#EF4444',
                              }}
                            >
                              {order.status === 'partial' ? 'Due' : order.status}
                            </span>
                          </td>

                          {/* Action: Open Bill Button */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptOrder(order)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '7px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                color: '#34D399',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#10B981';
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                                e.currentTarget.style.color = '#34D399';
                              }}
                            >
                              <Eye size={14} />
                              <span>Open Bill</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalBillsCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  paddingTop: '6px',
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary, #94A3B8)',
                }}
              >
                <div>
                  Showing {Math.min((billsPage - 1) * billsPageSize + 1, totalBillsCount)} to{' '}
                  {Math.min(billsPage * billsPageSize, totalBillsCount)} of {totalBillsCount} bills
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setBillsPage(1)}
                    disabled={billsPage === 1 || isLoadingBills}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      color: billsPage === 1 ? 'var(--text-muted, #64748B)' : 'var(--text-primary, #F8FAFC)',
                      cursor: billsPage === 1 ? 'not-allowed' : 'pointer',
                    }}
                    title="First Page"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillsPage((prev) => Math.max(1, prev - 1))}
                    disabled={billsPage === 1 || isLoadingBills}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      color: billsPage === 1 ? 'var(--text-muted, #64748B)' : 'var(--text-primary, #F8FAFC)',
                      cursor: billsPage === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span style={{ padding: '0 8px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                    Page {billsPage} of {totalBillsPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setBillsPage((prev) => Math.min(totalBillsPages, prev + 1))}
                    disabled={billsPage >= totalBillsPages || isLoadingBills}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      color: billsPage >= totalBillsPages ? 'var(--text-muted, #64748B)' : 'var(--text-primary, #F8FAFC)',
                      cursor: billsPage >= totalBillsPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillsPage(totalBillsPages)}
                    disabled={billsPage >= totalBillsPages || isLoadingBills}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      color: billsPage >= totalBillsPages ? 'var(--text-muted, #64748B)' : 'var(--text-primary, #F8FAFC)',
                      cursor: billsPage >= totalBillsPages ? 'not-allowed' : 'pointer',
                    }}
                    title="Last Page"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Empty State: Prompt user to search and select a product */
        <div
          className="glass-panel"
          style={{
            padding: '60px 24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #1E293B)',
            border: '1px dashed var(--border-subtle, rgba(255, 255, 255, 0.15))',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981',
            }}
          >
            <PackageSearch size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
            Search &amp; Select a Product
          </h3>
          <p style={{ margin: 0, maxWidth: '500px', fontSize: '0.88rem', color: 'var(--text-secondary, #94A3B8)', lineHeight: 1.5 }}>
            Type any product name or scan a barcode in the search bar above to generate its itemized financial performance report, stock valuations, and order history.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. 80MM BIXOLON POS THERMAL RECEIPT MODAL                                 */}
      {/* ========================================================================= */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          stores={stores}
          onClose={() => setSelectedReceiptOrder(null)}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}
