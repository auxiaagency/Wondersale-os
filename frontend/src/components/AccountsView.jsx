import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FinancialAnalysisDashboard from './FinancialAnalysisDashboard';
import SalesInvoicesLedgerView from './SalesInvoicesLedgerView';
import TimelineRangeSelector, { calculateDatesForDuration } from './TimelineRangeSelector';
import {
  fetchOperatingExpenses,
  fetchOperatingExpenseSummary,
  createOperatingExpense,
  updateOperatingExpense,
  deleteOperatingExpense,
  fetchStores,
} from '../api';
import TimeRangeFilter, { filterLogsByTimeRange, isWithinTimeRange } from './TimeRangeFilter';
import { playVipAcceptedSound, playVipRejectedSound } from '../utils/vipCardSounds';
import {
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Building2,
  Calendar,
  Search,
  Edit3,
  Printer,
  Sparkles,
  RefreshCw,
  Wallet,
  Banknote,
  AlertCircle,
  TrendingDown,
  ShieldCheck,
  CreditCard,
  Plus,
  Trash2,
  Receipt,
  Tag,
  Zap,
  Coffee,
  Wrench,
  Truck,
  Megaphone,
  Package,
  FileText,
  FileSpreadsheet,
  Layers,
  BarChart3,
  ChevronDown,
  Check,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EXPENSE_CATEGORIES = [
  { id: 'rent', name: 'Store Rent & Lease', icon: Building2, color: '#818CF8', bg: 'rgba(99, 102, 241, 0.15)' },
  { id: 'utilities', name: 'Electricity, Water & Utilities', icon: Zap, color: '#FBBF24', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'refreshments', name: 'Tea, Snacks & Daily Supplies', icon: Coffee, color: '#34D399', bg: 'rgba(16, 185, 129, 0.15)' },
  { id: 'repairs', name: 'Maintenance & Repairs', icon: Wrench, color: '#F87171', bg: 'rgba(239, 68, 68, 0.15)' },
  { id: 'logistics', name: 'Freight, Courier & Logistics', icon: Truck, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' },
  { id: 'marketing', name: 'Advertising & Marketing', icon: Megaphone, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { id: 'packaging', name: 'Packaging, Bags & Stationery', icon: Package, color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' },
  { id: 'cleaning', name: 'Housekeeping & Cleaning', icon: Sparkles, color: '#2DD4BF', bg: 'rgba(45, 212, 191, 0.15)' },
  { id: 'software', name: 'Software, POS & Subscriptions', icon: CreditCard, color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.15)' },
  { id: 'tax_legal', name: 'Taxes, Licenses & Legal', icon: ShieldCheck, color: '#CBD5E1', bg: 'rgba(203, 213, 225, 0.15)' },
  { id: 'other', name: 'Other Operating Expense', icon: Tag, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' },
];

export default function AccountsView({
  currentUser,
  stores = [],
  selectedStore: propSelectedStore,
  onBackToLauncher,
}) {
  const isOwner = currentUser?.is_owner || false;

  // Active Main Tab: 'analysis' | 'invoices_ledger' | 'operating_expenses'
  const [activeTab, setActiveTab] = useState('analysis');

  // Selected stores scoping: single, multiple, or 'all'
  const [selectedStoreIds, setSelectedStoreIds] = useState(() => {
    if (!isOwner && currentUser?.store) return [String(currentUser.store)];
    if (propSelectedStore === 'all') {
      return stores.map((s) => String(s.id));
    }
    if (propSelectedStore) {
      const parts = String(propSelectedStore).split(',').map((x) => x.trim()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    return stores[0]?.id ? [String(stores[0].id)] : [];
  });

  const [isAllStoresSelected, setIsAllStoresSelected] = useState(() => {
    if (!isOwner) return false;
    return propSelectedStore === 'all';
  });

  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const storeDropdownRef = useRef(null);

  // Close store dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target)) {
        setStoreDropdownOpen(false);
      }
    }
    if (storeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [storeDropdownOpen]);

  // Derived query string for APIs: 'all', or comma-separated '1,2', or single '1'
  const activeStoreQueryString = useMemo(() => {
    if (!isOwner && currentUser?.store) {
      return String(currentUser.store);
    }
    if (isAllStoresSelected) {
      return 'all';
    }
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return stores[0]?.id ? String(stores[0].id) : 'all';
    }
    if (stores.length > 1 && selectedStoreIds.length === stores.length) {
      return 'all';
    }
    return selectedStoreIds.join(',');
  }, [isOwner, currentUser, isAllStoresSelected, selectedStoreIds, stores]);

  const isCombinedView = useMemo(() => {
    if (!isOwner) return false;
    return isAllStoresSelected || selectedStoreIds.length > 1;
  }, [isOwner, isAllStoresSelected, selectedStoreIds]);

  const storeSelectionInfo = useMemo(() => {
    if (isAllStoresSelected || (stores.length > 1 && selectedStoreIds.length === stores.length)) {
      return {
        label: 'All Branches (Combined)',
        shortLabel: 'All Branches',
        badge: `All (${stores.length})`,
        isCombined: true,
        count: stores.length,
      };
    }
    if (selectedStoreIds.length > 1) {
      return {
        label: `${selectedStoreIds.length} Branches Combined`,
        shortLabel: `${selectedStoreIds.length} Branches`,
        badge: `${selectedStoreIds.length} Stores`,
        isCombined: true,
        count: selectedStoreIds.length,
      };
    }
    const singleStore = stores.find((s) => String(s.id) === String(selectedStoreIds[0]));
    return {
      label: singleStore ? singleStore.name : 'Store',
      shortLabel: singleStore ? singleStore.name : 'Store',
      badge: singleStore ? (singleStore.code || 'Single') : '1 Store',
      isCombined: false,
      count: 1,
    };
  }, [isAllStoresSelected, selectedStoreIds, stores]);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleToggleStore = (storeIdStr) => {
    if (isAllStoresSelected) {
      const remaining = stores
        .map((s) => String(s.id))
        .filter((id) => id !== storeIdStr);
      if (remaining.length === 0) {
        showToast('At least one branch must remain selected.', 'error');
        return;
      }
      setIsAllStoresSelected(false);
      setSelectedStoreIds(remaining);
      return;
    }

    const isCurrentlySelected = selectedStoreIds.includes(storeIdStr);
    if (isCurrentlySelected) {
      if (selectedStoreIds.length === 1) {
        showToast('At least one branch must remain selected.', 'error');
        return;
      }
      setSelectedStoreIds((prev) => prev.filter((id) => id !== storeIdStr));
    } else {
      const next = [...selectedStoreIds, storeIdStr];
      if (next.length === stores.length) {
        setIsAllStoresSelected(true);
      }
      setSelectedStoreIds(next);
    }
  };

  const handleSelectAllStores = () => {
    setIsAllStoresSelected(true);
    setSelectedStoreIds(stores.map((s) => String(s.id)));
  };

  const handleSelectOnlyStore = (storeIdStr) => {
    setIsAllStoresSelected(false);
    setSelectedStoreIds([storeIdStr]);
  };

  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);

  // Period state & Master Universal Timeline Range
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const [masterTimelineRange, setMasterTimelineRange] = useState(() => {
    const now = new Date();
    const dates = calculateDatesForDuration('month', 1, now);
    return {
      unit: 'month',
      count: 1,
      granularity: 'week',
      isAllTime: false,
      label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
      startDate: dates.startDate,
      endDate: dates.endDate,
    };
  });

  const handleMasterTimelineRangeChange = useCallback((newRange) => {
    if (!newRange) return;
    setMasterTimelineRange(newRange);
    if (newRange.endDate) {
      const parts = newRange.endDate.split('-').map(Number);
      if (parts[0]) setSelectedYear(parts[0]);
      if (parts[1]) setSelectedMonth(parts[1]);
    }
  }, []);

  // Operating Expenses data states
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expensePaymentMethodFilter, setExpensePaymentMethodFilter] = useState('all');
  const [expenseTimeFilter, setExpenseTimeFilter] = useState(null);

  // Operating Expense Modals state
  const [addExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [editingExpenseItem, setEditingExpenseItem] = useState(null);
  const [deletingExpenseItem, setDeletingExpenseItem] = useState(null);

  // Load Operating Expenses List & Summary
  const loadExpenseData = useCallback(async () => {
    setExpenseLoading(true);
    try {
      const params = {
        store: activeStoreQueryString || undefined,
        category: expenseCategoryFilter !== 'all' ? expenseCategoryFilter : undefined,
        payment_method: expensePaymentMethodFilter !== 'all' ? expensePaymentMethodFilter : undefined,
        search: expenseSearchQuery.trim() || undefined,
      };

      if (masterTimelineRange?.startDate && masterTimelineRange?.endDate) {
        params.start_date = masterTimelineRange.startDate;
        params.end_date = masterTimelineRange.endDate;
      } else {
        params.year = selectedYear;
        params.month = selectedMonth;
      }

      if (expenseTimeFilter?.active) {
        if (expenseTimeFilter.startTime) params.start_time = expenseTimeFilter.startTime;
        if (expenseTimeFilter.endTime) params.end_time = expenseTimeFilter.endTime;
      }

      const summaryParams = {
        store: activeStoreQueryString || undefined,
      };
      if (masterTimelineRange?.startDate && masterTimelineRange?.endDate) {
        summaryParams.start_date = masterTimelineRange.startDate;
        summaryParams.end_date = masterTimelineRange.endDate;
      } else {
        summaryParams.year = selectedYear;
        summaryParams.month = selectedMonth;
      }

      const [expList, summaryRes] = await Promise.all([
        fetchOperatingExpenses(params),
        fetchOperatingExpenseSummary(summaryParams),
      ]);
      setExpenses(Array.isArray(expList) ? expList : expList?.results || []);
      setExpenseSummary(summaryRes);
    } catch (err) {
      console.error('Failed to load operating expenses:', err);
      showToast('Failed to load operating expenses', 'error');
    } finally {
      setExpenseLoading(false);
    }
  }, [activeStoreQueryString, masterTimelineRange, selectedYear, selectedMonth, expenseCategoryFilter, expensePaymentMethodFilter, expenseSearchQuery, expenseTimeFilter, showToast]);

  // Load data
  useEffect(() => {
    loadExpenseData();
  }, [loadExpenseData]);

  // Derived filtered expenses based on time filter
  const displayedExpenses = useMemo(() => {
    if (!expenseTimeFilter || !expenseTimeFilter.active) {
      return expenses;
    }
    return expenses.filter((item) => {
      const timeStr = item.created_at || item.expense_date;
      return isWithinTimeRange(timeStr, expenseTimeFilter);
    });
  }, [expenses, expenseTimeFilter]);



  // Handle Expense Deletion
  const handleDeleteExpense = async (expense) => {
    try {
      await deleteOperatingExpense(expense.id);
      playVipAcceptedSound();
      showToast(`Expense "${expense.title}" deleted successfully!`);
      setDeletingExpenseItem(null);
      loadExpenseData();
      setAnalysisRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to delete expense:', err);
      playVipRejectedSound();
      showToast(err.message || 'Failed to delete expense', 'error');
    }
  };

  return (
    <div style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderRadius: '12px',
            backgroundColor: toastMessage.type === 'error' ? '#EF4444' : '#10B981',
            color: '#FFFFFF',
            fontWeight: 600,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toastMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackToLauncher}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              backgroundColor: 'var(--card-bg, #1E293B)',
              color: 'var(--text-primary, #F8FAFC)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Back to App Launcher"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', letterSpacing: '-0.02em' }}>
                Accounts & Finance
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: storeSelectionInfo.isCombined ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                  color: '#60A5FA',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {storeSelectionInfo.label}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary, #94A3B8)' }}>
              {activeTab === 'analysis'
                ? 'Comprehensive monthly financial intelligence, sales contribution, expenses, and dual profit analysis.'
                : activeTab === 'invoices_ledger'
                ? 'Search, filter, sort, and inspect all customer sales orders and itemized tax invoice receipts.'
                : 'Track monthly store overhead, rent, utility bills, maintenance, freight, and daily expenses.'}
            </p>
          </div>
        </div>

        {/* Store & Period Controls + Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Add Expense Action Button (Only in Operating Expenses tab) */}
          {activeTab === 'operating_expenses' && (
            <button
              onClick={() => setAddExpenseModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Expense
            </button>
          )}

          {/* Multi-Store Branch Selector (Owner / Multi-Store View) */}
          {isOwner && stores.length > 1 && (
            <div ref={storeDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setStoreDropdownOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  backgroundColor: storeSelectionInfo.isCombined ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg, #1E293B)',
                  border: `1px solid ${storeSelectionInfo.isCombined ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color, rgba(255,255,255,0.12))'}`,
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: storeSelectionInfo.isCombined ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none',
                }}
              >
                <Building2 size={16} color={storeSelectionInfo.isCombined ? '#60A5FA' : '#94A3B8'} />
                <span>{storeSelectionInfo.shortLabel}</span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    backgroundColor: storeSelectionInfo.isCombined ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.08)',
                    color: storeSelectionInfo.isCombined ? '#93C5FD' : 'var(--text-secondary, #94A3B8)',
                  }}
                >
                  {storeSelectionInfo.badge}
                </span>
                <ChevronDown
                  size={15}
                  style={{
                    transform: storeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    color: 'var(--text-secondary, #94A3B8)',
                  }}
                />
              </button>

              {/* Multi-Store Popover Menu */}
              {storeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '320px',
                    maxHeight: '440px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--card-bg, #1E293B)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.16))',
                    borderRadius: '14px',
                    boxShadow: '0 18px 40px -4px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.08)',
                    padding: '14px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                        Select Branches
                      </div>
                      <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary, #94A3B8)' }}>
                        Choose branches to combine
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAllStores}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#60A5FA',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Select All
                    </button>
                  </div>

                  {/* All Branches Toggle Row */}
                  <div
                    onClick={handleSelectAllStores}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: isAllStoresSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isAllStoresSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          backgroundColor: isAllStoresSelected ? '#3B82F6' : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${isAllStoresSelected ? '#60A5FA' : 'rgba(255, 255, 255, 0.2)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isAllStoresSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                          All Branches (Combined)
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #94A3B8)' }}>
                          View unified totals across all locations
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#93C5FD',
                      }}
                    >
                      {stores.length}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                    Individual Branches
                  </div>

                  {/* Individual Store List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {stores.map((s) => {
                      const sIdStr = String(s.id);
                      const isSelected = isAllStoresSelected || selectedStoreIds.includes(sIdStr);

                      return (
                        <div
                          key={s.id}
                          onClick={() => handleToggleStore(sIdStr)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '5px',
                                backgroundColor: isSelected ? '#10B981' : 'rgba(255, 255, 255, 0.08)',
                                border: `1px solid ${isSelected ? '#34D399' : 'rgba(255, 255, 255, 0.2)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFFFFF',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
                                {s.name}
                              </div>
                              {s.code && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #94A3B8)' }}>
                                  Code: {s.code}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* "Only" Quick Shortcut Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOnlyStore(sIdStr);
                            }}
                            title={`View only ${s.name}`}
                            style={{
                              background: 'none',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: 'var(--text-secondary, #94A3B8)',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)';
                            }}
                          >
                            Only
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Action */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setStoreDropdownOpen(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => { setAnalysisRefreshKey((k) => k + 1); loadExpenseData(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              backgroundColor: 'var(--card-bg, #1E293B)',
              color: 'var(--text-secondary, #94A3B8)',
              cursor: 'pointer',
            }}
            title="Refresh Data"
          >
            <RefreshCw
              size={16}
              className={expenseLoading ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {/* Main Section Navigation Switcher (Tabs) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          backgroundColor: 'var(--bg-input)',
          padding: '4px',
          borderRadius: '12px',
          width: 'fit-content',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('analysis')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'analysis' ? '#38BDF8' : 'transparent',
            color: activeTab === 'analysis' ? '#0F172A' : 'var(--text-secondary, #94A3B8)',
            boxShadow: activeTab === 'analysis' ? '0 2px 10px rgba(56, 189, 248, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <BarChart3 size={16} />
          Financial Overview & Analysis
        </button>

        <button
          onClick={() => setActiveTab('operating_expenses')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'operating_expenses' ? '#10B981' : 'transparent',
            color: activeTab === 'operating_expenses' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
            boxShadow: activeTab === 'operating_expenses' ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Receipt size={16} />
          Operating Expenses
          {expenseSummary?.total_count > 0 && (
            <span
              style={{
                marginLeft: '4px',
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                backgroundColor: activeTab === 'operating_expenses' ? 'rgba(0,0,0,0.25)' : 'rgba(16, 185, 129, 0.2)',
                color: activeTab === 'operating_expenses' ? '#FFFFFF' : '#34D399',
              }}
            >
              {expenseSummary.total_count}
            </span>
          )}
        </button>

<button
          onClick={() => setActiveTab('invoices_ledger')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'invoices_ledger' ? '#8B5CF6' : 'transparent',
            color: activeTab === 'invoices_ledger' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
            boxShadow: activeTab === 'invoices_ledger' ? '0 2px 8px rgba(139, 92, 246, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <FileSpreadsheet size={16} />
          Sales &amp; Invoices Ledger
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 0: FINANCIAL OVERVIEW & ANALYSIS DASHBOARD (PRIMARY DEFAULT VIEW)    */}
      {/* ========================================================================= */}
      {activeTab === 'analysis' && (
        <FinancialAnalysisDashboard
          key={`${activeStoreQueryString}-${analysisRefreshKey}`}
          storeId={activeStoreQueryString}
          selectedStoreIds={selectedStoreIds}
          isCombined={isCombinedView}
          stores={stores}
          year={selectedYear}
          month={selectedMonth}
          timelineRange={masterTimelineRange}
          onTimelineRangeChange={handleMasterTimelineRangeChange}
          currentUser={currentUser}
          onNavigateToExpenses={() => setActiveTab('operating_expenses')}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW: INVOICES & SALES ORDERS LEDGER                                      */}
      {/* ========================================================================= */}
      {activeTab === 'invoices_ledger' && (
        <SalesInvoicesLedgerView
          activeStoreId={activeStoreQueryString}
          isCombined={isCombinedView}
          currentUser={currentUser}
          stores={stores}
          timelineRange={masterTimelineRange}
          onTimelineRangeChange={handleMasterTimelineRangeChange}
        />
      )}

      {activeTab === 'operating_expenses' && (
        <>
          {/* 3 Summary KPI Cards for Operating Expenses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {/* Card 1: Monthly Total Expenses */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '14px',
                backgroundColor: 'var(--card-bg, #1E293B)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                  Total Operating Expenses ({masterTimelineRange?.label || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`})
                </span>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F87171',
                  }}
                >
                  <Receipt size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#F87171', letterSpacing: '-0.02em' }}>
                ₹{(expenseSummary?.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                {expenseSummary?.total_count || 0} recorded expense vouchers in this period
              </div>
            </div>

            {/* Card 2: Top Expense Category */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '14px',
                backgroundColor: 'var(--card-bg, #1E293B)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                  Highest Expense Category
                </span>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FBBF24',
                  }}
                >
                  <Tag size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {expenseSummary?.top_category ? expenseSummary.top_category.category_name : 'No Expenses Yet'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#FBBF24', fontWeight: 700 }}>
                {expenseSummary?.top_category
                  ? `₹${(expenseSummary.top_category.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${expenseSummary.top_category.count} entries)`
                  : 'Start recording expenses for this month'}
              </div>
            </div>

            {/* Card 3: Quick Action & Average per Entry */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '14px',
                backgroundColor: 'var(--card-bg, #1E293B)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                boxShadow: '0 4px 15px -2px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                  Average per Voucher
                </span>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38BDF8',
                  }}
                >
                  <Layers size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.02em' }}>
                ₹{((expenseSummary?.total_count || 0) > 0
                  ? (expenseSummary.total_amount / expenseSummary.total_count)
                  : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Calculated across {expenseSummary?.total_count || 0} bills & payouts
              </div>
            </div>
          </div>

          {/* Operating Expenses Table Card */}
          <div
            style={{
              borderRadius: '16px',
              backgroundColor: 'var(--card-bg, #1E293B)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
              overflow: 'visible',
              position: 'relative',
              zIndex: 30,
              marginBottom: '24px',
            }}
          >
            {/* Search & Category Filter Toolbar */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                position: 'relative',
                zIndex: 35,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                  Operating Expenses Ledger
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                  {masterTimelineRange?.label || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`} • {expenses.length} Records
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                {/* Date Range Selector for Expenses Ledger */}
                <TimelineRangeSelector
                  value={masterTimelineRange}
                  onChange={handleMasterTimelineRangeChange}
                  minDate={expenseSummary?.earliest_record_date || '2026-09-04'}
                  allowAllTime={true}
                  showXAxis={false}
                  chartType="dashboard"
                />

                {/* Search Input */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                    width: '220px',
                  }}
                >
                  <Search size={14} color="#94A3B8" />
                  <input
                    type="text"
                    placeholder="Search title, vendor, bill #..."
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary, #F8FAFC)',
                      fontSize: '0.82rem',
                      width: '100%',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Category Filter Dropdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  }}
                >
                  <Tag size={13} color="#94A3B8" />
                  <select
                    value={expenseCategoryFilter}
                    onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary, #F8FAFC)',
                      fontSize: '0.80rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                      All Categories
                    </option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  }}
                >
                  <CreditCard size={13} color="#94A3B8" />
                  <select
                    value={expensePaymentMethodFilter}
                    onChange={(e) => setExpensePaymentMethodFilter(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary, #F8FAFC)',
                      fontSize: '0.80rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>All Payment Modes</option>
                    <option value="cash" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Cash</option>
                    <option value="upi" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>UPI / QR</option>
                    <option value="bank_transfer" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Bank Transfer</option>
                    <option value="cheque" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Cheque</option>
                    <option value="card" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Debit / Credit Card</option>
                  </select>
                </div>

                <TimeRangeFilter
                  compact={true}
                  filterState={expenseTimeFilter}
                  onFilterChange={setExpenseTimeFilter}
                />
              </div>
            </div>

            {/* Expenses Table */}
            <div style={{ overflowX: 'auto', borderRadius: '0 0 16px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Voucher & Date</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Expense Details</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Payment Mode</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Paid To / Vendor</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary, #94A3B8)' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', color: '#10B981' }} />
                        <div>Loading store expenses...</div>
                      </td>
                    </tr>
                  ) : displayedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary, #94A3B8)' }}>
                        <Receipt size={36} color="var(--text-muted, #64748B)" style={{ margin: '0 auto 12px' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary, #F8FAFC)', marginBottom: '4px' }}>
                          {expenseTimeFilter?.active
                            ? 'No expenses found matching the selected time range'
                            : 'No operating expenses found'}
                        </div>
                        <div style={{ fontSize: '0.82rem', maxWidth: '380px', margin: '0 auto 16px auto' }}>
                          {expenseTimeFilter?.active
                            ? 'Adjust the time range or clear the time filter to see all recorded expenses.'
                            : 'Record store overhead, rent, electricity, freight, or refreshments using the "Add Expense" button above.'}
                        </div>
                        {!expenseTimeFilter?.active && (
                          <button
                            type="button"
                            onClick={() => setAddExpenseModalOpen(true)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#10B981',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={14} />
                            Record First Expense
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    displayedExpenses.map((item) => {
                      const categoryObj = EXPENSE_CATEGORIES.find((c) => c.id === item.category) || {
                        name: item.category_display || item.category,
                        color: '#94A3B8',
                        bg: 'rgba(148, 163, 184, 0.15)',
                      };

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))',
                            transition: 'background-color 0.15s ease',
                          }}
                          className="hover-row"
                        >
                          {/* Voucher & Date */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                              {item.voucher_number}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                              {item.expense_date}
                            </div>
                          </td>

                          {/* Expense Details */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>{item.title}</div>
                            {item.notes && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.notes}
                              </div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                backgroundColor: categoryObj.bg,
                                color: categoryObj.color,
                                border: `1px solid ${categoryObj.color}40`,
                              }}
                            >
                              {categoryObj.name}
                            </span>
                          </td>

                          {/* Payment Method */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
                              <CreditCard size={12} color="#94A3B8" />
                              {item.payment_method_display || item.payment_method}
                            </div>
                            {item.reference_number && (
                              <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px' }}>
                                Ref: {item.reference_number}
                              </div>
                            )}
                          </td>

                          {/* Paid To / Vendor */}
                          <td style={{ padding: '12px 18px', color: item.paid_to ? 'var(--text-primary, #F8FAFC)' : 'var(--text-secondary, #94A3B8)' }}>
                            {item.paid_to || '—'}
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, fontSize: '0.96rem', color: '#F87171' }}>
                            ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {/* Edit Button */}
                              <button
                                onClick={() => setEditingExpenseItem(item)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                                  backgroundColor: 'transparent',
                                  color: 'var(--text-secondary, #94A3B8)',
                                  cursor: 'pointer',
                                }}
                                title="Edit Expense"
                              >
                                <Edit3 size={13} />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setDeletingExpenseItem(item)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: '#F87171',
                                  cursor: 'pointer',
                                }}
                                title="Delete Expense"
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

          {/* Store Monthly Operating Expense Summary Bar */}
          {expenseSummary && (
            <div
              style={{
                borderRadius: '14px',
                backgroundColor: 'var(--card-bg, #1E293B)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                padding: '16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#10B981" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                  Operating Expense Summary
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                  ({masterTimelineRange?.label || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`})
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary, #94A3B8)' }}>Total Expenses: </span>
                  <strong style={{ color: '#F87171' }}>
                    ₹{(expenseSummary.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary, #94A3B8)' }}>Total Vouchers: </span>
                  <strong style={{ color: '#38BDF8' }}>
                    {expenseSummary.total_count || 0}
                  </strong>
                </div>

                {expenseSummary.top_category && (
                  <div style={{ fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary, #94A3B8)' }}>Top Category: </span>
                    <strong style={{ color: '#FBBF24' }}>
                      {expenseSummary.top_category.category_name} (₹{(expenseSummary.top_category.total_amount || 0).toLocaleString('en-IN')})
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}



      {/* ========================================================================= */}
      {/* OPERATING EXPENSE MODALS                                                  */}
      {/* ========================================================================= */}
      {(addExpenseModalOpen || editingExpenseItem) && (
        <OperatingExpenseModal
          expense={editingExpenseItem}
          storeId={activeStoreQueryString}
          stores={stores}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          currentUser={currentUser}
          onClose={() => {
            setAddExpenseModalOpen(false);
            setEditingExpenseItem(null);
          }}
          onSuccess={(msg) => {
            playVipAcceptedSound();
            setAddExpenseModalOpen(false);
            setEditingExpenseItem(null);
            showToast(msg || 'Operating expense saved successfully!');
            loadExpenseData();
            setAnalysisRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Delete Expense Confirmation Modal */}
      {deletingExpenseItem && (
        <DeleteConfirmationModal
          title="Delete Operating Expense"
          message={`Are you sure you want to delete expense "${deletingExpenseItem.title}" (${deletingExpenseItem.voucher_number}) of ₹${Number(deletingExpenseItem.amount).toLocaleString('en-IN')}? This action cannot be undone.`}
          onCancel={() => setDeletingExpenseItem(null)}
          onConfirm={() => handleDeleteExpense(deletingExpenseItem)}
        />
      )}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: OPERATING EXPENSE ADD / EDIT MODAL
// =========================================================================
function OperatingExpenseModal({
  expense,
  storeId,
  stores = [],
  selectedYear,
  selectedMonth,
  currentUser,
  onClose,
  onSuccess,
}) {
  const isEditing = Boolean(expense?.id);

  const [chosenStoreId, setChosenStoreId] = useState(() => {
    if (expense?.store) return String(typeof expense.store === 'object' ? expense.store.id : expense.store);
    if (storeId && storeId !== 'all' && !storeId.includes(',')) return String(storeId);
    return stores[0]?.id ? String(stores[0].id) : '';
  });

  const defaultDate = useMemo(() => {
    if (expense?.expense_date) return expense.expense_date;
    const now = new Date();
    // Default to today if current month/year matches, otherwise 1st of selected month
    if (now.getFullYear() === selectedYear && now.getMonth() + 1 === selectedMonth) {
      return now.toISOString().split('T')[0];
    }
    const mm = String(selectedMonth).padStart(2, '0');
    return `${selectedYear}-${mm}-01`;
  }, [expense, selectedYear, selectedMonth]);

  const [title, setTitle] = useState(expense?.title || '');
  const [category, setCategory] = useState(expense?.category || 'utilities');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [expenseDate, setExpenseDate] = useState(defaultDate);
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method || 'cash');
  const [paidTo, setPaidTo] = useState(expense?.paid_to || '');
  const [referenceNumber, setReferenceNumber] = useState(expense?.reference_number || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter an expense title / description.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        store: chosenStoreId ? Number(chosenStoreId) : undefined,
        title: title.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod,
        paid_to: paidTo.trim(),
        reference_number: referenceNumber.trim(),
        notes: notes.trim(),
        recorded_by_name: currentUser?.name || 'Store Cashier',
      };

      if (isEditing) {
        await updateOperatingExpense(expense.id, payload);
        onSuccess(`Expense "${title}" updated successfully!`);
      } else {
        await createOperatingExpense(payload);
        onSuccess(`Expense "${title}" of ₹${Number(amount).toLocaleString('en-IN')} added successfully!`);
      }
    } catch (err) {
      console.error('Error saving operating expense:', err);
      playVipRejectedSound();
      setErrorMsg(err.message || 'Failed to save operating expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '16px',
          backgroundColor: 'var(--card-bg, #1E293B)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                {isEditing ? 'Edit Operating Expense' : 'Add Operating Expense'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Record monthly store operational bills, overhead, or supplies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94A3B8)',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {errorMsg && (
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#F87171',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Branch / Store Location (when multiple branches available) */}
          {stores && stores.length > 1 && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Store / Branch Location *
              </label>
              <select
                value={chosenStoreId}
                onChange={(e) => setChosenStoreId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.90rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: 'var(--bg-surface)' }}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title & Category */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
              Expense Title / Description *
            </label>
            <input
              type="text"
              placeholder="e.g. Electricity Bill, Shop Rent, Tea & Snacks"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.90rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Expense Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#F87171', marginBottom: '5px' }}>
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {/* Expense Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="cash" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>Cash</option>
                <option value="upi" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>UPI / QR</option>
                <option value="bank_transfer" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>Bank Transfer / NEFT</option>
                <option value="cheque" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>Cheque</option>
                <option value="card" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>Debit / Credit Card</option>
                <option value="other" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {/* Paid To / Vendor */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Paid To / Vendor (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Landlord, State Power, Vendor"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Bill / Ref # */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
                Bill # / Ref / UTR # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. INV-1049, UTR9871"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '5px' }}>
              Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="Additional details, justification, or comments"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #94A3B8)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: DELETE CONFIRMATION MODAL
// =========================================================================
function DeleteConfirmationModal({ title, message, onCancel, onConfirm }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '16px',
          backgroundColor: 'var(--card-bg, #1E293B)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trash2 size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
              {title}
            </h3>
          </div>
        </div>

        <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94A3B8)', lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary, #94A3B8)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

