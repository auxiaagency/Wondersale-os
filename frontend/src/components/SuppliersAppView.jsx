import React, { useState, useMemo } from 'react';
import {
  Truck,
  ArrowLeft,
  Building2,
  Layers,
  Search,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  ShoppingBag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShoppingCart,
} from 'lucide-react';
import SupplierSection from './SupplierSection';
import SupplierDetailView from './SupplierDetailView';

export default function SuppliersAppView({
  currentUser,
  stores = [],
  selectedStore = '',
  suppliers = [],
  loading = false,
  onSuppliersUpdated,
  onBackToLauncher,
  currencySymbol = '₹',
}) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'manage_suppliers'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  
  // Filter and Sorting States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'owed' | 'clear' | 'advance'
  const [sortBy, setSortBy] = useState('profit_desc'); // 'profit_desc', 'owed_desc', 'purchase_desc', 'retail_desc', 'sold_desc', 'name_asc', 'name_desc'

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const currentStore = stores.find((s) => String(s.id) === String(selectedStore)) || null;

  // Selected supplier object
  const selectedSupplier = suppliers.find((s) => String(s.id) === String(selectedSupplierId)) || null;

  // Filtered & Sorted Suppliers
  const processedSuppliers = useMemo(() => {
    let result = suppliers.filter((s) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          s.name?.toLowerCase().includes(q) ||
          s.contact_person?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.pincode?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Status Filter
      const owed = parseFloat(s.total_owed || 0);
      if (statusFilter === 'owed' && owed <= 0) return false;
      if (statusFilter === 'clear' && owed !== 0) return false;
      if (statusFilter === 'advance' && owed >= 0) return false;

      return true;
    });

    // 3. Sorting
    result.sort((a, b) => {
      const profitA = parseFloat(a.total_profit || 0);
      const profitB = parseFloat(b.total_profit || 0);
      const owedA = parseFloat(a.total_owed || 0);
      const owedB = parseFloat(b.total_owed || 0);
      const costA = parseFloat(a.stock_cost_value || 0);
      const costB = parseFloat(b.stock_cost_value || 0);
      const retailA = parseFloat(a.stock_retail_value || 0);
      const retailB = parseFloat(b.stock_retail_value || 0);
      const soldA = parseFloat(a.total_sold_revenue || 0);
      const soldB = parseFloat(b.total_sold_revenue || 0);
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();

      switch (sortBy) {
        case 'profit_desc':
          return profitB - profitA;
        case 'profit_asc':
          return profitA - profitB;
        case 'owed_desc':
          return owedB - owedA;
        case 'owed_asc':
          return owedA - owedB;
        case 'purchase_desc':
          return costB - costA;
        case 'purchase_asc':
          return costA - costB;
        case 'retail_desc':
          return retailB - retailA;
        case 'retail_asc':
          return retailA - retailB;
        case 'sold_desc':
          return soldB - soldA;
        case 'sold_asc':
          return soldA - soldB;
        case 'name_desc':
          return nameB.localeCompare(nameA);
        case 'name_asc':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return result;
  }, [suppliers, searchQuery, statusFilter, sortBy]);

  // Aggregate Metrics for Header KPI Bar
  const aggregateStats = useMemo(() => {
    return suppliers.reduce(
      (acc, s) => {
        acc.totalStockCost += parseFloat(s.stock_cost_value || 0);
        acc.totalStockRetail += parseFloat(s.stock_retail_value || 0);
        acc.totalSoldUnits += parseInt(s.total_sold_units || 0, 10);
        acc.totalSoldRevenue += parseFloat(s.total_sold_revenue || 0);
        acc.totalProfit += parseFloat(s.total_profit || 0);
        acc.totalOwed += parseFloat(s.total_owed || 0);
        return acc;
      },
      {
        totalStockCost: 0,
        totalStockRetail: 0,
        totalSoldUnits: 0,
        totalSoldRevenue: 0,
        totalProfit: 0,
        totalOwed: 0,
      }
    );
  }, [suppliers]);

  // Pagination Slice
  const totalItems = processedSuppliers.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / (parseInt(pageSize, 10) || 20)));
  const paginatedSuppliers = useMemo(() => {
    if (pageSize === 'all') return processedSuppliers;
    const size = parseInt(pageSize, 10) || 20;
    const start = (currentPage - 1) * size;
    return processedSuppliers.slice(start, start + size);
  }, [processedSuppliers, currentPage, pageSize]);

  // Handle Sort Change from Table Column Header
  const handleColumnSort = (field) => {
    if (sortBy === `${field}_desc`) {
      setSortBy(`${field}_asc`);
    } else {
      setSortBy(`${field}_desc`);
    }
  };

  const getSortIcon = (field) => {
    if (sortBy === `${field}_desc`) return <ArrowDown size={14} color="#14B8A6" />;
    if (sortBy === `${field}_asc`) return <ArrowUp size={14} color="#14B8A6" />;
    return <ArrowUpDown size={13} color="var(--text-muted)" style={{ opacity: 0.6 }} />;
  };

  // If a supplier is selected for detail view, show detail view directly (AFTER ALL HOOKS)
  if (selectedSupplierId) {
    return (
      <div
        className="suppliers-app-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          gap: '20px',
          padding: '20px',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <SupplierDetailView
          supplierId={selectedSupplierId}
          supplier={selectedSupplier}
          onBack={() => {
            setSelectedSupplierId(null);
            onSuppliersUpdated?.();
          }}
          currentUser={currentUser}
          stores={stores}
          selectedStore={selectedStore}
          currencySymbol={currencySymbol}
        />
      </div>
    );
  }

  return (
    <div
      className="suppliers-app-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '20px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header Bar */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderRadius: 'var(--radius-xl)',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} />
              <span>Menu</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(20, 184, 166, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#14B8A6',
              }}
            >
              <Truck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.28rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  Suppliers & Vendor Central
                </h1>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(20, 184, 166, 0.15)',
                    color: '#14B8A6',
                  }}
                >
                  {suppliers.length} Registered
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Line-by-line financial intelligence, stock valuations, gross profits, and vendor balances.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Overall Ecosystem Financial KPI Summary Bar */}
      <div
        className="glass-panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          padding: '16px 20px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package size={14} color="#06B6D4" /> Stock Purchase Cost
          </span>
          <span style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {currencySymbol}{aggregateStats.totalStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Procured inventory on shelf
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShoppingBag size={14} color="#A855F7" /> Stock Retail Value
          </span>
          <span style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {currencySymbol}{aggregateStats.totalStockRetail.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Estimated sales turnover value
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="#3B82F6" /> Units & Revenue Sold
          </span>
          <span style={{ fontSize: '1.18rem', fontWeight: 800, color: '#3B82F6' }}>
            {currencySymbol}{aggregateStats.totalSoldRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {aggregateStats.totalSoldUnits.toLocaleString('en-IN')} units sold to date
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} color="#10B981" /> Overall Gross Profit
          </span>
          <span style={{ fontSize: '1.18rem', fontWeight: 800, color: '#10B981' }}>
            +{currencySymbol}{aggregateStats.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {aggregateStats.totalSoldRevenue > 0
              ? `${((aggregateStats.totalProfit / aggregateStats.totalSoldRevenue) * 100).toFixed(1)}% gross margin`
              : '0.0% gross margin'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} color={aggregateStats.totalOwed > 0 ? '#EF4444' : '#10B981'} /> Total Money Payable
          </span>
          <span style={{ fontSize: '1.18rem', fontWeight: 800, color: aggregateStats.totalOwed > 0 ? '#EF4444' : '#10B981' }}>
            {aggregateStats.totalOwed > 0
              ? `Owe: ${currencySymbol}${aggregateStats.totalOwed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'All Clear'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Net outstanding across all vendors
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'directory' ? '3px solid #14B8A6' : '3px solid transparent',
            color: activeTab === 'directory' ? '#14B8A6' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Building2 size={17} />
          <span>Supplier Directory ({suppliers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage_suppliers')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'manage_suppliers' ? '3px solid #14B8A6' : '3px solid transparent',
            color: activeTab === 'manage_suppliers' ? '#14B8A6' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={17} />
          <span>Manage Suppliers & Master</span>
        </button>
      </div>

      {/* Tab Viewport */}
      <div>
        {activeTab === 'directory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter and Sorting Toolbar */}
            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap',
              }}
            >
              {/* Search Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, city, phone, pincode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.86rem', padding: '7px 12px' }}
                />
              </div>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '4px' }}>Status:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'owed', label: 'Pending Payment' },
                  { id: 'clear', label: 'All Clear' },
                  { id: 'advance', label: 'Advance Credit' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: statusFilter === st.id ? '#14B8A6' : 'var(--border-color)',
                      background: statusFilter === st.id ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                      color: statusFilter === st.id ? '#14B8A6' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sorting Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input-field"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="profit_desc">Most Profit Overall (High to Low)</option>
                  <option value="profit_asc">Least Profit Overall (Low to High)</option>
                  <option value="owed_desc">Highest Pending Payment (Owed First)</option>
                  <option value="owed_asc">Lowest Pending Payment</option>
                  <option value="purchase_desc">Highest Stock Purchase Cost</option>
                  <option value="purchase_asc">Lowest Stock Purchase Cost</option>
                  <option value="retail_desc">Highest Stock Retail Value</option>
                  <option value="sold_desc">Most Sales Revenue</option>
                  <option value="name_asc">Supplier Name (A to Z)</option>
                  <option value="name_desc">Supplier Name (Z to A)</option>
                </select>
              </div>

              {/* Rows Per Page Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input-field"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                  <option value="all">All ({totalItems})</option>
                </select>
              </div>
            </div>

            {/* Horizontal Line-by-Line Table */}
            {processedSuppliers.length === 0 ? (
              <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No suppliers found matching your search and filter criteria.
              </div>
            ) : (
              <div
                className="glass-panel"
                style={{
                  borderRadius: 'var(--radius-xl)',
                  overflowX: 'auto',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.84rem',
                    minWidth: '1020px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        fontSize: '0.74rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th
                        onClick={() => handleColumnSort('name')}
                        style={{ padding: '14px 18px', cursor: 'pointer', userSelect: 'none', width: '22%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>Supplier & Details</span>
                          {getSortIcon('name')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleColumnSort('purchase')}
                        style={{ padding: '14px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '15%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>Stock Purchase Cost</span>
                          {getSortIcon('purchase')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleColumnSort('retail')}
                        style={{ padding: '14px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '15%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>Stock Retail Value</span>
                          {getSortIcon('retail')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleColumnSort('sold')}
                        style={{ padding: '14px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '16%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>Units & Amount Sold</span>
                          {getSortIcon('sold')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleColumnSort('profit')}
                        style={{ padding: '14px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '15%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>Overall Profit</span>
                          {getSortIcon('profit')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleColumnSort('owed')}
                        style={{ padding: '14px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '16%' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>Money to be Paid</span>
                          {getSortIcon('owed')}
                        </div>
                      </th>
                      <th style={{ padding: '14px 18px', textAlign: 'center', width: '90px' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSuppliers.map((sup, index) => {
                      const owed = parseFloat(sup.total_owed || 0);
                      const cost = parseFloat(sup.stock_cost_value || 0);
                      const retail = parseFloat(sup.stock_retail_value || 0);
                      const soldUnits = parseInt(sup.total_sold_units || 0, 10);
                      const soldRev = parseFloat(sup.total_sold_revenue || 0);
                      const profit = parseFloat(sup.total_profit || 0);
                      const margin = parseFloat(sup.profit_margin_pct || 0);

                      return (
                        <tr
                          key={sup.id}
                          onClick={() => setSelectedSupplierId(sup.id)}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                            background: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(20, 184, 166, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)';
                          }}
                        >
                          {/* Supplier & Contact Info */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                                {sup.name}
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {sup.contact_person && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <User size={11} /> {sup.contact_person}
                                  </span>
                                )}
                                {sup.city && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <MapPin size={11} /> {sup.city}
                                  </span>
                                )}
                                {sup.phone && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <Phone size={11} /> {sup.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Stock Purchase Cost */}
                          <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                {currencySymbol}{cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Package size={11} /> {sup.items_count || 0} items ({sup.orders_count || 0} orders)
                              </span>
                            </div>
                          </td>

                          {/* Stock Retail Value */}
                          <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#A855F7' }}>
                                {currencySymbol}{retail.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {cost > 0 && retail > cost
                                  ? `+${(((retail - cost) / cost) * 100).toFixed(0)}% projected markup`
                                  : 'at selling price'}
                              </span>
                            </div>
                          </td>

                          {/* Units & Amount Sold */}
                          <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#3B82F6' }}>
                                {currencySymbol}{soldRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <ShoppingCart size={11} /> <strong>{soldUnits.toLocaleString('en-IN')}</strong> units sold
                              </span>
                            </div>
                          </td>

                          {/* Overall Profit */}
                          <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.92rem',
                                  color: profit > 0 ? '#10B981' : profit < 0 ? '#EF4444' : 'var(--text-muted)',
                                }}
                              >
                                {profit > 0 ? `+${currencySymbol}` : profit < 0 ? `-${currencySymbol}` : currencySymbol}
                                {Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {margin > 0 ? `${margin.toFixed(1)}% margin` : 'Gross P&L'}
                              </span>
                            </div>
                          </td>

                          {/* Amount of Money to be Paid */}
                          <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                            {owed > 0 ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#EF4444',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                }}
                              >
                                Owe: {currencySymbol}{owed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : owed < 0 ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#3B82F6',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                }}
                              >
                                Advance: {currencySymbol}{Math.abs(owed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10B981',
                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                }}
                              >
                                All Clear
                              </span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            <span
                              style={{
                                color: '#14B8A6',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              View Ledger →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    {pageSize === 'all' ? (
                      <span>Showing all {totalItems} suppliers</span>
                    ) : (
                      <span>
                        Showing {Math.min((currentPage - 1) * parseInt(pageSize, 10) + 1, totalItems)}–
                        {Math.min(currentPage * parseInt(pageSize, 10), totalItems)} of {totalItems} suppliers
                      </span>
                    )}
                  </div>

                  {pageSize !== 'all' && totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPage((p) => Math.max(1, p - 1));
                        }}
                        className="btn-ghost"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                          opacity: currentPage <= 1 ? 0.4 : 1,
                        }}
                      >
                        <ChevronLeft size={14} /> Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        // Display sliding window of page numbers if many pages
                        if (
                          totalPages > 7 &&
                          pageNum !== 1 &&
                          pageNum !== totalPages &&
                          Math.abs(pageNum - currentPage) > 2
                        ) {
                          if (pageNum === 2 || pageNum === totalPages - 1) {
                            return <span key={pageNum} style={{ padding: '0 4px' }}>...</span>;
                          }
                          return null;
                        }

                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentPage(pageNum);
                            }}
                            style={{
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: currentPage === pageNum ? 800 : 500,
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: currentPage === pageNum ? '#14B8A6' : 'transparent',
                              background: currentPage === pageNum ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                              color: currentPage === pageNum ? '#14B8A6' : 'var(--text-secondary)',
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPage((p) => Math.min(totalPages, p + 1));
                        }}
                        className="btn-ghost"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                          opacity: currentPage >= totalPages ? 0.4 : 1,
                        }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage_suppliers' && (
          <SupplierSection
            suppliers={suppliers}
            stores={stores}
            currentStore={currentStore}
            loading={loading}
            onSuppliersUpdated={onSuppliersUpdated}
          />
        )}
      </div>
    </div>
  );
}
