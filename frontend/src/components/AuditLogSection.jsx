import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Building2,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
  FileSpreadsheet,
  User,
  ShoppingCart,
} from 'lucide-react';
import { fetchAllStockMovements, fetchEmployees } from '../api';
import { SkeletonAuditRows } from './Skeleton';
import TimeRangeFilter, { filterLogsByTimeRange } from './TimeRangeFilter';

const REASON_METAS = {
  initial_import: { label: 'Initial Import', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)', icon: Package },
  restock: { label: 'Restock / Purchase', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', icon: ArrowUpRight },
  sale: { label: 'POS Customer Sale', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)', icon: ShoppingCart },
  damage: { label: 'Damaged / Discarded', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)', icon: ArrowDownRight },
  audit_correction: { label: 'Audit Correction', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)', icon: AlertTriangle },
  return: { label: 'Customer / Supplier Return', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)', icon: RotateCcw },
  manual_adjustment: { label: 'Manual Adjustment', color: '#64748B', bg: 'rgba(100, 116, 139, 0.14)', icon: SlidersHorizontal },
};

export function getRoleBadgeStyle(roleName) {
  const r = (roleName || '').toLowerCase();
  if (r.includes('owner') || r.includes('admin')) {
    return {
      color: '#F43F5E',
      bg: 'rgba(244, 63, 94, 0.14)',
      border: '1px solid rgba(244, 63, 94, 0.35)',
    };
  }
  if (r.includes('manager')) {
    return {
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.14)',
      border: '1px solid rgba(59, 130, 246, 0.35)',
    };
  }
  if (r.includes('cashier')) {
    return {
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.14)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    };
  }
  return {
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: '1px solid rgba(168, 85, 247, 0.35)',
  };
}

function formatTimestamp(isoStr) {
  if (!isoStr) return { dateStr: '—', timeStr: '', relStr: '' };
  try {
    const d = new Date(isoStr);
    const dateStr = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relStr = 'Just now';
    if (diffDays > 0) {
      relStr = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      relStr = `${diffHours}h ago`;
    } else if (diffMins > 0) {
      relStr = `${diffMins}m ago`;
    }

    return { dateStr, timeStr, relStr };
  } catch (e) {
    return { dateStr: isoStr, timeStr: '', relStr: '' };
  }
}

export default function AuditLogSection({
  currentUser,
  stores = [],
  selectedStore,
  onSelectStore,
  onViewItem,
  onQuickAdjust,
}) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', '7days', '30days'
  const [timeFilter, setTimeFilter] = useState(null);
  const [filterStoreId, setFilterStoreId] = useState(selectedStore || '');

  // Keep store filter in sync if active session store changes
  useEffect(() => {
    if (selectedStore) {
      setFilterStoreId(selectedStore);
    }
  }, [selectedStore]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (reasonFilter) params.reason = reasonFilter;
      if (staffFilter) params.staff = staffFilter;
      if (filterStoreId) params.store = filterStoreId;
      if (timeFilter?.active) {
        if (timeFilter.startTime) params.start_time = timeFilter.startTime;
        if (timeFilter.endTime) params.end_time = timeFilter.endTime;
      }

      const data = await fetchAllStockMovements(params);
      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load stock audit ledger.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, reasonFilter, staffFilter, filterStoreId, timeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMovements();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadMovements]);

  // Persistent staff list so options don't vanish on filter
  const [allStaffList, setAllStaffList] = useState([]);

  // Load employees from backend staff system on mount
  useEffect(() => {
    fetchEmployees()
      .then((data) => {
        const empList = Array.isArray(data) ? data : data?.results || [];
        setAllStaffList((prev) => {
          const map = new Map();
          empList.forEach((e) => {
            const key = e.employee_code || e.staff_id || String(e.id) || e.name;
            map.set(String(key), {
              id: key,
              name: e.name,
              role: e.designation || e.role_name || 'Staff',
              staffId: e.employee_code || e.staff_id,
            });
          });
          prev.forEach((p) => {
            if (!map.has(String(p.id))) {
              map.set(String(p.id), p);
            }
          });
          return Array.from(map.values());
        });
      })
      .catch(() => {
        // ignore if not authorized
      });
  }, []);

  // Accumulate performers from ledger movements
  useEffect(() => {
    if (!movements || movements.length === 0) return;
    setAllStaffList((prev) => {
      const map = new Map();
      prev.forEach((s) => map.set(String(s.id), s));
      movements.forEach((m) => {
        const val = m.performed_by_staff_id || (m.performed_by_id ? String(m.performed_by_id) : (m.performed_by_name || 'Owner / Admin'));
        if (!map.has(String(val))) {
          map.set(String(val), {
            id: val,
            name: m.performed_by_name || 'Owner / Admin',
            role: m.performed_by_role || 'Owner',
            staffId: m.performed_by_staff_id,
          });
        }
      });
      return Array.from(map.values());
    });
  }, [movements]);

  // Client-side date, exact minute time period, and staff filtering
  const filteredMovements = useMemo(() => {
    let list = movements;

    if (staffFilter) {
      const sf = staffFilter.toLowerCase().trim();
      list = list.filter((m) => {
        if (sf === 'owner' || sf === 'admin' || sf === 'owner / admin') {
          return (
            !m.performed_by_id ||
            (m.performed_by_role || '').toLowerCase().includes('owner') ||
            (m.performed_by_name || '').toLowerCase().includes('owner') ||
            (m.performed_by_name || '').toLowerCase().includes('admin')
          );
        }
        return (
          String(m.performed_by_id) === staffFilter ||
          String(m.performed_by_staff_id || '').toLowerCase() === sf ||
          String(m.performed_by_name || '').toLowerCase().includes(sf) ||
          String(m.performed_by_role || '').toLowerCase().includes(sf)
        );
      });
    }

    if (timeFilter?.active) {
      list = filterLogsByTimeRange(list, timeFilter, ['created_at']);
    } else if (dateFilter !== 'all') {
      const now = Date.now();
      list = list.filter((m) => {
        if (!m.created_at) return true;
        const mTime = new Date(m.created_at).getTime();
        const diffHours = (now - mTime) / (1000 * 60 * 60);

        if (dateFilter === 'today') return diffHours <= 24;
        if (dateFilter === '7days') return diffHours <= 24 * 7;
        if (dateFilter === '30days') return diffHours <= 24 * 30;
        return true;
      });
    }

    return list;
  }, [movements, staffFilter, dateFilter, timeFilter]);

  // Handle Export to CSV according to active filters & time period
  const handleExportCsv = () => {
    if (!filteredMovements || filteredMovements.length === 0) {
      alert('No audit movements found to export with the currently selected filters.');
      return;
    }

    const headers = [
      'Date & Time',
      'Product Name',
      'Product UID',
      'Movement Reason',
      'Stock Change (Units)',
      'Current Balance',
      'Performed By',
      'Role',
      'Store Branch',
      'Audit Note',
    ];

    const rows = filteredMovements.map((m) => {
      const dt = m.created_at ? new Date(m.created_at).toLocaleString('en-IN') : '—';
      const reasonMeta = REASON_METAS[m.reason] || {};
      const reasonLabel = reasonMeta.label || m.reason_display || m.reason || 'Stock Movement';
      const changeStr = m.change > 0 ? `+${m.change}` : String(m.change);
      const perfName = m.performed_by_name || 'Owner / Admin';
      const perfRole = m.performed_by_role || 'Owner';
      const storeName = m.store_name || (stores.find((s) => String(s.id) === String(m.store_id))?.name) || 'All Stores';

      return [
        `"${dt.replace(/"/g, '""')}"`,
        `"${(m.item_name || 'Unknown Product').replace(/"/g, '""')}"`,
        `"${(m.item_uid || '').replace(/"/g, '""')}"`,
        `"${reasonLabel.replace(/"/g, '""')}"`,
        changeStr,
        m.item_current_quantity !== undefined && m.item_current_quantity !== null ? m.item_current_quantity : '',
        `"${perfName.replace(/"/g, '""')}"`,
        `"${perfRole.replace(/"/g, '""')}"`,
        `"${storeName.replace(/"/g, '""')}"`,
        `"${(m.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().split('T')[0];
    const staffTag = staffFilter ? `_staff_${staffFilter}` : '';
    const reasonTag = reasonFilter ? `_${reasonFilter}` : '';
    a.download = `stock_movement_audit_ledger_${dateTag}${staffTag}${reasonTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Aggregate Metrics
  const totalEntries = filteredMovements.length;
  const totalInward = filteredMovements
    .filter((m) => m.change > 0)
    .reduce((sum, m) => sum + m.change, 0);
  const totalOutward = filteredMovements
    .filter((m) => m.change < 0)
    .reduce((sum, m) => sum + Math.abs(m.change), 0);
  const totalDamaged = filteredMovements
    .filter((m) => m.reason === 'damage')
    .reduce((sum, m) => sum + Math.abs(m.change), 0);

  return (
    <div className="audit-section-root">
      {/* Top Banner / Description */}
      <div
        className="glass-panel audit-header-card"
        style={{
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, var(--bg-surface) 100%)',
          borderColor: 'rgba(239, 68, 68, 0.18)',
        }}
      >
        <div className="audit-header-info-wrap" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="audit-header-icon-box"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-ruby-glow)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <History size={24} />
          </div>
          <div>
            <h3 className="audit-header-title" style={{ fontSize: '1.28rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              Stock Movement Ledger &amp; Audit Trail
              <span className="badge badge-neutral audit-immutable-badge" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                Immutable
              </span>
            </h3>
            <p className="audit-header-sub" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Every inventory change is recorded as an immutable ledger transaction. Item stock totals are derived exclusively from this ledger.
            </p>
          </div>
        </div>

        <div className="audit-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredMovements.length === 0}
            className="btn btn-secondary audit-export-csv-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.1)',
              borderColor: 'rgba(16, 185, 129, 0.35)',
              color: '#10B981',
            }}
            title="Export filtered audit logs to CSV spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span>Export to CSV ({filteredMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={loadMovements}
            className="btn btn-secondary audit-refresh-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            title="Refresh Ledger"
          >
            <RotateCcw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh Log</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Metric Cards */}
      <div
        className="audit-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Total Ledger Entries */}
        <div className="glass-panel audit-kpi-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="audit-kpi-icon-box"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={22} />
          </div>
          <div>
            <div className="audit-kpi-label" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Ledger Events
            </div>
            <div className="audit-kpi-value" style={{ fontSize: '1.45rem', fontWeight: 800 }}>{totalEntries}</div>
          </div>
        </div>

        {/* Inward / Restocked Units */}
        <div className="glass-panel audit-kpi-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="audit-kpi-icon-box"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="audit-kpi-label" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Units Added (+)
            </div>
            <div className="audit-kpi-value" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10B981' }}>
              +{totalInward}
            </div>
          </div>
        </div>

        {/* Outward / Deductions */}
        <div className="glass-panel audit-kpi-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="audit-kpi-icon-box"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingDown size={22} />
          </div>
          <div>
            <div className="audit-kpi-label" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Units Deducted (-)
            </div>
            <div className="audit-kpi-value" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-danger)' }}>
              -{totalOutward}
            </div>
          </div>
        </div>

        {/* Damaged / Discarded */}
        <div className="glass-panel audit-kpi-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="audit-kpi-icon-box"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="audit-kpi-label" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Damaged / Written-Off
            </div>
            <div className="audit-kpi-value" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F59E0B' }}>
              {totalDamaged} Units
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel audit-filter-bar"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          borderRadius: 'var(--radius-lg)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Search */}
        <div className="audit-search-wrap" style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, UID/barcode, note..."
            className="form-input audit-search-input"
            style={{
              paddingLeft: '36px',
              paddingRight: searchQuery ? '32px' : '12px',
              fontSize: '0.86rem',
              height: '38px',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Reason Filter */}
        <div className="audit-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="form-select audit-filter-select"
            style={{ height: '38px', fontSize: '0.84rem', minWidth: '160px' }}
          >
            <option value="">All Movement Reasons</option>
            <option value="sale">🛒 POS Customer Sale</option>
            <option value="restock">📦 Restock / Purchase</option>
            <option value="damage">⚠️ Damaged / Discarded</option>
            <option value="audit_correction">🔍 Audit Correction</option>
            <option value="return">🔄 Customer / Supplier Return</option>
            <option value="manual_adjustment">⚙️ Manual Adjustment</option>
            <option value="initial_import">📥 Initial Legacy Import</option>
          </select>
        </div>

        {/* Staff / Performed By Filter */}
        {allStaffList.length > 0 && (
          <div className="audit-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="form-select audit-filter-select"
              style={{ height: '38px', fontSize: '0.84rem', minWidth: '150px' }}
            >
              <option value="">All Staff / Users</option>
              {allStaffList.map((st) => (
                <option key={String(st.id)} value={String(st.id)}>
                  {st.name} ({st.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Exact Time & Range Filter */}
        <TimeRangeFilter
          filterState={timeFilter}
          onFilterChange={(st) => {
            setTimeFilter(st);
            if (st?.active) setDateFilter('all');
          }}
        />

        {/* Date Filter */}
        <div className="audit-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="form-select audit-filter-select"
            style={{ height: '38px', fontSize: '0.84rem', minWidth: '130px' }}
          >
            <option value="all">All Time</option>
            <option value="today">Today (Last 24h)</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        {/* Store Location Filter (for owner) */}
        {currentUser?.is_owner && stores.length > 0 && (
          <div className="audit-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
              className="form-select audit-filter-select"
              style={{ height: '38px', fontSize: '0.84rem', minWidth: '140px' }}
            >
              <option value="">All Store Locations</option>
              {stores.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="glass-panel audit-table-card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
        <div className="audit-table-scroll" style={{ overflowX: 'auto' }}>
          <table className="data-table audit-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <th className="audit-th-time" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Timestamp
                </th>
                <th className="audit-th-product" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Product &amp; Code
                </th>
                <th className="audit-th-store" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Store Branch
                </th>
                <th className="audit-th-user" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Performed By
                </th>
                <th className="audit-th-reason" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Transaction Reason
                </th>
                <th className="audit-th-delta" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Stock Delta
                </th>
                <th className="audit-th-note" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Audit Note / Description
                </th>
                <th className="audit-th-actions" style={{ padding: '14px 18px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonAuditRows rows={6} />
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '60px', textAlign: 'center' }}>
                    <History size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>No Ledger Movements Found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
                      {searchQuery || reasonFilter || staffFilter || dateFilter !== 'all'
                        ? 'No stock movements match your search and filter criteria.'
                        : 'Stock movements will be logged here whenever items are added, restocked, or adjusted.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => {
                  const reasonMeta = REASON_METAS[movement.reason] || {
                    label: movement.reason_display || movement.reason,
                    color: '#64748B',
                    bg: 'rgba(100, 116, 139, 0.14)',
                    icon: History,
                  };
                  const ReasonIcon = reasonMeta.icon;
                  const { dateStr, timeStr, relStr } = formatTimestamp(movement.created_at);
                  const isPositive = movement.change > 0;
                  const roleStyle = getRoleBadgeStyle(movement.performed_by_role);

                  return (
                    <tr
                      key={movement.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                      className="table-row-interactive"
                    >
                      {/* Timestamp */}
                      <td className="audit-td-time" style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <div className="audit-time-date" style={{ fontSize: '0.84rem', fontWeight: 600 }}>{dateStr}</div>
                            <div className="audit-time-sub" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {timeStr} &bull; <span style={{ color: 'var(--brand-primary)' }}>{relStr}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Product & UID */}
                      <td className="audit-td-product" style={{ padding: '14px 18px' }}>
                        <div>
                          <div
                            className="audit-product-name"
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              cursor: onViewItem ? 'pointer' : 'default',
                              color: 'var(--text-primary)',
                            }}
                            onClick={() => onViewItem && onViewItem({ id: movement.item, uid: movement.item_uid, name: movement.item_name })}
                            title="Click to view product details"
                          >
                            {movement.item_name || `Item #${movement.item}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span
                              className="mono audit-product-uid"
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--bg-surface-hover)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                              }}
                            >
                              UID: {movement.item_uid || movement.item}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Store Branch */}
                      <td className="audit-td-store" style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{movement.store_name || '—'}</span>
                        </div>
                      </td>

                      {/* Performed By (Who Did It) */}
                      <td className="audit-td-user" style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className="audit-user-avatar"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: roleStyle.bg,
                              border: roleStyle.border,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: roleStyle.color,
                              flexShrink: 0,
                            }}
                          >
                            <User size={14} />
                          </div>
                          <div>
                            <div className="audit-user-name" style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {movement.performed_by_name || 'Owner / Admin'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                              <span
                                className="audit-user-role-badge"
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: roleStyle.bg,
                                  color: roleStyle.color,
                                }}
                              >
                                {movement.performed_by_role || 'Owner'}
                              </span>
                              {movement.performed_by_staff_id && (
                                <span className="mono audit-user-staff-id" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  {movement.performed_by_staff_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reason Badge */}
                      <td className="audit-td-reason" style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span
                          className="audit-reason-badge"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: reasonMeta.bg,
                            color: reasonMeta.color,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                          }}
                        >
                          <ReasonIcon size={12} />
                          <span>{reasonMeta.label}</span>
                        </span>
                      </td>

                      {/* Delta */}
                      <td className="audit-td-delta" style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span
                          className="audit-delta-text"
                          style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: isPositive ? '#10B981' : 'var(--color-danger)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          {isPositive ? `+${movement.change}` : movement.change}
                        </span>
                      </td>

                      {/* Audit Note */}
                      <td className="audit-td-note" style={{ padding: '14px 18px', maxWidth: '280px' }}>
                        <span className="audit-note-text" style={{ fontSize: '0.82rem', color: movement.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                          {movement.note || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="audit-td-actions" style={{ padding: '14px 18px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => onViewItem && onViewItem({ id: movement.item, uid: movement.item_uid, name: movement.item_name })}
                          className="btn btn-secondary btn-sm audit-view-btn"
                          style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                          title="View Product"
                        >
                          <span>View Product</span>
                          <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
