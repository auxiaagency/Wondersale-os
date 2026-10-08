import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  Lock,
  Store as StoreIcon,
  AlertCircle,
  Clock,
  Search,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Check,
  Package,
  Receipt,
  BarChart3,
  Building2,
  Briefcase,
  UserCheck,
  Settings,
  Layers,
  Phone,
  User,
  LogOut,
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import ProfileLightboxModal from './ProfileLightboxModal';
import { formatPhoneNumber, handlePhoneInputChange, isValidPhoneNumber } from '../utils/phoneFormat';
import {
  fetchStaffMembers,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  fetchStaffRoles,
  createStaffRole,
  updateStaffRole,
  deleteStaffRole,
  fetchStores,
  fetchSections,
  revokeStaffSessions,
} from '../api';
import { SkeletonStaffRows } from './Skeleton';
import { SYSTEM_MODULES } from './AppLauncher';

export default function StaffManagementView({ currentUser, onBackToLauncher }) {
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'roles'
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stores, setStores] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter & Sort state for Staff Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  // Lightbox Modal state
  const [lightboxImage, setLightboxImage] = useState(null);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  // Alert message
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const isOwner = currentUser?.is_owner || currentUser?.role_details?.can_access_staff;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [membersData, rolesData, storesData, sectionsData] = await Promise.all([
        fetchStaffMembers(),
        fetchStaffRoles(),
        fetchStores(),
        fetchSections(),
      ]);
      setMembers(membersData);
      setRoles(rolesData);
      setStores(storesData);
      setSections(sectionsData);
    } catch (err) {
      setError(err.message || 'Failed to load staff management data.');
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  // Helper to extract clean section details { id, name, code, color } from a staff member
  const getMemberSection = useCallback(
    (m) => {
      if (!m) return null;
      if (m.section_details && m.section_details.name) {
        return m.section_details;
      }
      const secId = m.section != null ? m.section : null;
      if (secId !== null && secId !== '') {
        const found = (sections || []).find((s) => String(s.id) === String(secId));
        if (found) return found;
        if (typeof secId === 'string' && isNaN(Number(secId))) {
          return { id: secId, name: secId, color: '#38BDF8', code: '' };
        }
      }
      if (m.section_name) {
        return {
          id: secId,
          name: m.section_name,
          color: m.section_color || '#38BDF8',
          code: m.section_code || '',
        };
      }
      return null;
    },
    [sections]
  );

  // Unique sections extracted from staff directory
  const availableSections = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      const sec = getMemberSection(m);
      if (sec?.name && typeof sec.name === 'string' && sec.name.trim()) {
        set.add(sec.name.trim());
      }
    });
    return Array.from(set).sort();
  }, [members, getMemberSection]);

  // Searching, Filtering & Sorting logic for Staff Directory
  const filteredMembers = useMemo(() => {
    let list = [...members];

    // 1. Text Search across Name, Staff ID, Role, Store, Section
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const sec = getMemberSection(m);
        return (
          m.name?.toLowerCase().includes(q) ||
          m.staff_id?.toLowerCase().includes(q) ||
          m.role_details?.name?.toLowerCase().includes(q) ||
          m.store_details?.name?.toLowerCase().includes(q) ||
          sec?.name?.toLowerCase().includes(q) ||
          sec?.code?.toLowerCase().includes(q) ||
          m.phone?.toLowerCase().includes(q)
        );
      });
    }

    // 2. Role Filter
    if (roleFilter) {
      list = list.filter((m) => String(m.role) === String(roleFilter));
    }

    // 3. Status Filter (Active / Disabled)
    if (statusFilter === 'active') {
      list = list.filter((m) => m.is_active);
    } else if (statusFilter === 'inactive') {
      list = list.filter((m) => !m.is_active);
    }

    // 4. Store Filter
    if (storeFilter) {
      list = list.filter((m) => String(m.store) === String(storeFilter));
    }

    // 4b. Section Filter
    if (sectionFilter === '__none__') {
      list = list.filter((m) => !getMemberSection(m));
    } else if (sectionFilter) {
      list = list.filter((m) => {
        const sec = getMemberSection(m);
        if (!sec) return false;
        return (
          String(sec.id) === String(sectionFilter) ||
          (sec.name && String(sec.name).toLowerCase() === sectionFilter.toLowerCase())
        );
      });
    }

    // 5. Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'staff_id_asc':
          return (a.staff_id || '').localeCompare(b.staff_id || '');
        case 'staff_id_desc':
          return (b.staff_id || '').localeCompare(a.staff_id || '');
        case 'date_desc':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'date_asc':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'role_asc':
          return (a.role_details?.name || '').localeCompare(b.role_details?.name || '');
        default:
          return 0;
      }
    });

    return list;
  }, [members, searchQuery, roleFilter, statusFilter, storeFilter, sectionFilter, sortBy]);

  const hasActiveFilters = Boolean(
    searchQuery || roleFilter || statusFilter || storeFilter || sectionFilter || sortBy !== 'name_asc'
  );

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setStoreFilter('');
    setSectionFilter('');
    setSortBy('name_asc');
  };

  if (!isOwner) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '30px' }} className="glass-panel">
        <ShieldAlert size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: '8px' }}>Restricted Access</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Only the Store Owner can view and configure staff credentials and permission categories.
        </p>
        <button type="button" onClick={onBackToLauncher} className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Return to Menu</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px', width: '100%' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
            }}
            title="Return to Menu"
          >
            <ArrowLeft size={16} />
            <span>Menu</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Staff &amp; Permissions</h2>
              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                Owner Security Portal
              </span>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Manage staff accounts, credentials, and configure visible menu buttons for each role.
            </p>
          </div>
        </div>

        {/* Action Button depending on tab */}
        <div>
          {activeTab === 'members' ? (
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Staff Member</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddRoleOpen(true)}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Create Role Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'members' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={18} />
          <span>Staff Directory ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'roles' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'roles' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Shield size={18} />
          <span>Role Categories &amp; Permissions ({roles.length})</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

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
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: Staff Directory with Search, Filter & Sort */}
      {activeTab === 'members' && (
        <div>
          {/* Search, Filtering & Sorting Controls Bar */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 20px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {/* Left: Search Box */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
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
                placeholder="Search staff by ID, name, or role..."
                className="form-input"
                style={{
                  paddingLeft: '36px',
                  paddingRight: searchQuery ? '32px' : '12px',
                  fontSize: '0.88rem',
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
                    fontSize: '0.9rem',
                    padding: '2px',
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Right: Filters & Sorter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              {/* Role Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="form-select"
                  style={{ height: '38px', fontSize: '0.84rem', minWidth: '130px' }}
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                  style={{ height: '38px', fontSize: '0.84rem', minWidth: '120px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Disabled Only</option>
                </select>
              </div>

              {/* Store Filter */}
              {stores.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="form-select"
                    style={{ height: '38px', fontSize: '0.84rem', minWidth: '130px' }}
                  >
                    <option value="">All Stores</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section Filter */}
              {sections.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="form-select"
                    style={{ height: '38px', fontSize: '0.84rem', minWidth: '130px' }}
                  >
                    <option value="">All Sections ({sections.length})</option>
                    <option value="__none__">Unassigned (No Section)</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={String(sec.id)}>
                        {sec.name} {sec.code ? `(${sec.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    paddingLeft: '8px',
                    height: '38px',
                  }}
                >
                  <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      outline: 'none',
                      padding: '0 8px',
                      cursor: 'pointer',
                      height: '100%',
                    }}
                  >
                    <option value="name_asc">Name (A → Z)</option>
                    <option value="name_desc">Name (Z → A)</option>
                    <option value="staff_id_asc">Staff ID (A → Z)</option>
                    <option value="staff_id_desc">Staff ID (Z → A)</option>
                    <option value="role_asc">Role Name</option>
                    <option value="date_desc">Newest Added</option>
                    <option value="date_asc">Oldest Added</option>
                  </select>
                </div>
              </div>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Reset all filters"
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              padding: '0 4px',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Showing <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> staff members
              {hasActiveFilters && ' (filtered)'}
            </div>
          </div>

          {/* Members Table */}
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.02)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <th style={{ padding: '14px 18px' }}>Staff ID</th>
                    <th style={{ padding: '14px 18px' }}>Staff Name</th>
                    <th style={{ padding: '14px 18px' }}>Role / Category</th>
                    <th style={{ padding: '14px 18px' }}>Assigned Store</th>
                    <th style={{ padding: '14px 18px' }}>Section</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px' }}>Last Active</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonStaffRows rows={6} />
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {hasActiveFilters
                          ? 'No staff members match the current search & filters.'
                          : 'No staff members found. Add your first employee above.'}
                        {hasActiveFilters && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="btn btn-secondary btn-sm"
                            >
                              Reset Filters
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {/* Staff ID */}
                        <td style={{ padding: '14px 18px' }}>
                          <span className="mono" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                            {m.staff_id}
                          </span>
                        </td>

                        {/* Name & Avatar & Phone */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              onClick={() => {
                                if (m.photo) {
                                  setLightboxImage({
                                    src: m.photo,
                                    name: m.name,
                                    code: m.staff_id,
                                    role: m.role_details?.name,
                                    store: m.store_details?.name,
                                    phone: m.phone,
                                    section: m.section,
                                  });
                                }
                              }}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: m.photo
                                  ? 'rgba(0,0,0,0.3)'
                                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontWeight: 700,
                                fontSize: '0.86rem',
                                color: 'var(--text-primary)',
                                cursor: m.photo ? 'zoom-in' : 'default',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (m.photo) {
                                  e.currentTarget.style.transform = 'scale(1.08)';
                                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (m.photo) {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                }
                              }}
                              title={m.photo ? `Click to view full photo of ${m.name}` : m.name}
                            >
                              {m.photo ? (
                                <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                m.name?.slice(0, 2).toUpperCase() || <User size={16} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{m.name}</div>
                              {m.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  <Phone size={11} style={{ opacity: 0.7 }} />
                                  <span>{formatPhoneNumber(m.phone)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            className={`badge ${m.is_owner ? 'badge-warning' : 'badge-neutral'}`}
                            style={{ fontWeight: 600 }}
                          >
                            {m.role_details?.name || 'Assigned Role'}
                            {m.is_owner && ' ⭐'}
                          </span>
                        </td>

                        {/* Store */}
                        <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                          {m.store_details?.name || 'All Locations'}
                        </td>

                        {/* Section */}
                        <td style={{ padding: '14px 18px' }}>
                          {(() => {
                            const sec = getMemberSection(m);
                            if (sec && sec.name) {
                              const color = sec.color || '#38BDF8';
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    backgroundColor: `${color}22`,
                                    color: color,
                                    border: `1px solid ${color}44`,
                                  }}
                                >
                                  <Layers size={11} />
                                  {sec.name} {sec.code ? `(${sec.code})` : ''}
                                </span>
                              );
                            }
                            return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>;
                          })()}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 18px' }}>
                          {m.is_active ? (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                              <CheckCircle2 size={12} /> Active
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                              <XCircle size={12} /> Disabled
                            </span>
                          )}
                        </td>

                        {/* Last Login */}
                        <td style={{ padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {m.last_login ? new Date(m.last_login).toLocaleString() : 'Never'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingMember(m)}
                              className="btn btn-secondary btn-sm"
                              title="Edit Staff Member"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Roles & 8 Menu Buttons Permissions */}
      {activeTab === 'roles' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {roles.map((r) => {
            const allowed = Array.isArray(r.allowed_modules) ? r.allowed_modules : [];
            return (
              <div
                key={r.id}
                className="glass-panel"
                style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: r.is_owner ? '1px solid var(--brand-accent)' : '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{r.name}</h3>
                    {r.is_owner ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        Owner (All Modules)
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {r.cashier_role === 'head_cashier' && (
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                            Head Cashier
                          </span>
                        )}
                        {allowed.includes('inventory') && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.7rem',
                              background: r.inventory_scope === 'assigned_section' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: r.inventory_scope === 'assigned_section' ? '#38BDF8' : '#10B981',
                              border: r.inventory_scope === 'assigned_section' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                            }}
                          >
                            {r.inventory_scope === 'assigned_section' ? 'Section Scope' : 'Full Inventory'}
                          </span>
                        )}
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {r.member_count} Staff Assigned
                        </span>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px', minHeight: '38px' }}>
                    {r.description || 'No description provided.'}
                  </p>

                  {/* Accessible Menu Buttons Grid Display */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Accessible Menu Buttons ({r.is_owner ? '8 of 8' : `${allowed.length} of 8`})
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      {r.is_owner ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'rgba(254, 197, 1, 0.15)',
                            color: '#D97706',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          <Shield size={14} />
                          <span>All {SYSTEM_MODULES.length} Menu Modules Fully Accessible</span>
                        </div>
                      ) : allowed.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                          No menu buttons assigned (Hidden completely from menu)
                        </span>
                      ) : (
                        SYSTEM_MODULES.map((m) => {
                          const isGranted = allowed.includes(m.id);
                          if (!isGranted) return null;
                          const IconComp = m.icon;
                          return (
                            <span
                              key={m.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                background: m.bgGlow,
                                color: m.color,
                                border: `1px solid ${m.color}30`,
                              }}
                            >
                              <IconComp size={12} />
                              <span>{m.title}</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {!r.is_owner && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setEditingRole(r)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Edit2 size={13} />
                      <span>Edit Buttons &amp; Permissions</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Member */}
      {isAddMemberOpen && (
        <StaffMemberModal
          roles={roles}
          stores={stores}
          sections={sections}
          currentUser={currentUser}
          onClose={() => setIsAddMemberOpen(false)}
          onSuccess={(newMember) => {
            setIsAddMemberOpen(false);
            showFeedback(`Staff member "${newMember.name}" (${newMember.staff_id}) added.`);
            loadData();
          }}
        />
      )}

      {/* Modal: Edit Member */}
      {editingMember && (
        <StaffMemberModal
          member={editingMember}
          roles={roles}
          stores={stores}
          sections={sections}
          currentUser={currentUser}
          onClose={() => setEditingMember(null)}
          onSuccess={(updated) => {
            setEditingMember(null);
            showFeedback(`Staff member "${updated.name}" updated.`);
            loadData();
          }}
        />
      )}

      {/* Modal: Create Role Category */}
      {isAddRoleOpen && (
        <StaffRoleModal
          onClose={() => setIsAddRoleOpen(false)}
          onSuccess={(newRole) => {
            setIsAddRoleOpen(false);
            showFeedback(`Role category "${newRole.name}" created.`);
            loadData();
          }}
        />
      )}

      {/* Modal: Edit Role Category */}
      {editingRole && (
        <StaffRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSuccess={(updated) => {
            setEditingRole(null);
            showFeedback(`Role category "${updated.name}" updated successfully.`);
            loadData();
          }}
        />
      )}

      {/* Lightbox Profile Photo Modal */}
      {lightboxImage && (
        <ProfileLightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}

// ----------------- Sub-Modal: Staff Member Editor -----------------

function StaffMemberModal({ member, roles, stores, sections = [], currentUser, onClose, onSuccess }) {
  const [staffId, setStaffId] = useState(member?.staff_id || '');
  const [name, setName] = useState(member?.name || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [photoFile, setPhotoFile] = useState(undefined);
  const [photoUrl, setPhotoUrl] = useState(member?.photo || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState(member?.role || roles[0]?.id || '');
  const [storeId, setStoreId] = useState(member?.store || '');
  const [section, setSection] = useState(member?.section_details?.id || member?.section || '');
  const [joinDate, setJoinDate] = useState(
    member?.join_date ? member.join_date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [isActive, setIsActive] = useState(member ? member.is_active : true);

  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(member);

  const handleRevokeSessions = async () => {
    if (
      !window.confirm(
        `Are you sure you want to terminate all active sessions for ${member.name} (${member.staff_id}) across all devices? They will be immediately required to log in again.`
      )
    ) {
      return;
    }
    setRevoking(true);
    try {
      const res = await revokeStaffSessions(member.id);
      if (currentUser && (member.id === currentUser.id || member.staff_id === currentUser.staff_id)) {
        if (res.session_token) {
          localStorage.setItem('wondersale_session_token', res.session_token);
        }
      }
      alert(res.message || 'All active sessions have been terminated.');
    } catch (err) {
      alert(err.message || 'Failed to revoke sessions.');
    } finally {
      setRevoking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffId.trim() || !name.trim()) {
      setError('Staff ID and Name are required.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact Phone Number is required.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setError('Please enter a valid contact phone number (10 to 15 digits, no letters or invalid characters).');
      return;
    }
    const trimmedPassword = password.trim();
    if (!isEditing && !trimmedPassword) {
      setError('A password is required for new staff accounts.');
      return;
    }
    if (trimmedPassword && trimmedPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    const selectedRole = (roles || []).find((r) => String(r.id) === String(roleId));
    const isAssignedSectionRole = selectedRole?.inventory_scope === 'assigned_section';
    if (isAssignedSectionRole && !section) {
      setError('This role is restricted to "Assigned Section Only". Please select a section for this staff member.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('staff_id', staffId.trim());
      payload.append('name', name.trim());
      if (trimmedPassword) {
        payload.append('password', trimmedPassword);
      }
      payload.append('role', roleId);
      if (storeId) {
        payload.append('store', storeId);
      } else if (isEditing) {
        payload.append('store', '');
      }
      if (section) {
        payload.append('section', section);
      } else if (isEditing) {
        payload.append('section', '');
      }
      payload.append('phone', phone.trim());
      if (joinDate) {
        payload.append('join_date', joinDate);
      }
      payload.append('is_active', isActive);

      if (photoFile instanceof File) {
        payload.append('photo', photoFile);
      } else if (photoFile === null) {
        payload.append('photo', '');
      }

      let res;
      if (isEditing) {
        res = await updateStaffMember(member.id, payload);
        if (currentUser && (member.id === currentUser.id || member.staff_id === currentUser.staff_id)) {
          if (res.session_token) {
            localStorage.setItem('wondersale_session_token', res.session_token);
          }
          localStorage.setItem('wondersale_staff_user', JSON.stringify(res));
        }
      } else {
        res = await createStaffMember(payload);
      }
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '1.2rem' }}>
            {isEditing ? `Edit Staff (${member.staff_id})` : 'Add New Staff Member'}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Profile Photo Picker with 1:1 Auto-Crop */}
          <div style={{ marginBottom: '20px' }}>
            <ProfilePhotoPicker
              photoUrl={photoUrl}
              name={name}
              onChangePhoto={(file, url) => {
                setPhotoFile(file);
                setPhotoUrl(url || '');
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">Staff ID *</label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. CASHIER02"
                className="form-input mono"
                required
                disabled={isEditing}
              />
            </div>
            <div>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Gonzalez"
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Contact Phone Number */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Contact Phone Number *</label>
            <div style={{ position: 'relative' }}>
              <Phone
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(handlePhoneInputChange(e.target.value))}
                placeholder="e.g. +91 98765 43210"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                required
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Required. Formatted for direct calling &amp; automated employee directory linking.
            </span>
          </div>

          {/* Official Join Date */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Official Join Date *</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                Used for attendance &amp; mid-month salary calculations
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px' }}
                required
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              For employees who joined earlier, set their actual start date here so they receive full salary without being treated as joining mid-month.
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isEditing ? 'Change Password' : 'Password *'}</span>
              {isEditing && (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  (Leave blank to keep current)
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? 'Enter new password to change' : 'Enter account password'}
                className="form-input"
                style={{ paddingRight: '40px' }}
                autoComplete="new-password"
                required={!isEditing}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '6px',
                  cursor: 'pointer',
                  color: showPassword ? 'var(--brand-primary, #6366f1)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isEditing && (
              <span style={{ fontSize: '0.76rem', color: 'var(--brand-accent, #FEC501)', display: 'block', marginTop: '6px', lineHeight: 1.4 }}>
                🔒 Security Note: Changing the password immediately terminates all active sessions for this staff member across all other devices.
              </span>
            )}
          </div>

          {/* Active Device Sessions Termination */}
          {isEditing && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={15} style={{ color: 'var(--color-danger)' }} />
                  <span>Active Device Sessions</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Force log out this staff member from all other devices and kiosks immediately.
                </div>
              </div>
              <button
                type="button"
                disabled={revoking}
                onClick={handleRevokeSessions}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  color: 'var(--color-danger)',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                <span>{revoking ? 'Revoking…' : 'Revoke All Sessions'}</span>
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label className="form-label">Role / Category *</label>
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="form-select" required>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_owner ? '(Owner)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Assigned Store</label>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="form-select">
                <option value="">All Locations</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned Section (Optional, Single Section) */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Assigned Section</span>
                {(() => {
                  const selRole = (roles || []).find((r) => String(r.id) === String(roleId));
                  return selRole?.inventory_scope === 'assigned_section' ? (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--brand-accent, #FEC501)',
                        background: 'rgba(254, 197, 1, 0.12)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      Required for Role
                    </span>
                  ) : null;
                })()}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                Single Section
              </span>
            </label>
            <select
              value={section || ''}
              onChange={(e) => setSection(e.target.value)}
              className="form-select"
            >
              <option value="">No Section Assigned (Unassigned)</option>
              {(sections || []).map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} {sec.code ? `(${sec.code})` : ''}
                </option>
              ))}
            </select>
            {(() => {
              const selRole = (roles || []).find((r) => String(r.id) === String(roleId));
              if (selRole?.inventory_scope === 'assigned_section') {
                return (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      fontSize: '0.76rem',
                      color: '#38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>
                      This role enforces <strong>Assigned Section Only</strong> inventory access. Staff will only be able to view, search, and manage items belonging to this specific section.
                    </span>
                  </div>
                );
              }
              return (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Employees can be assigned to at most one section (cashiers/managers can remain unassigned).
                </span>
              );
            })()}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Account Active (Allowed to sign in)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------- Sub-Modal: Role Category & 8 Menu Buttons Selector -----------------

function StaffRoleModal({ role, onClose, onSuccess }) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');

  // 8 Menu buttons permissions
  const [allowedModules, setAllowedModules] = useState(() => {
    if (role?.allowed_modules && Array.isArray(role.allowed_modules) && role.allowed_modules.length > 0) {
      return role.allowed_modules;
    }
    // Backward compatibility from legacy boolean flags
    const list = [];
    if (role?.can_access_inventory) list.push('inventory');
    if (role?.can_access_billing) list.push('billing');
    if (role?.can_access_staff) list.push('staff');
    return list.length > 0 ? list : ['billing'];
  });

  const [cashierRole, setCashierRole] = useState(role?.cashier_role || 'cashier');
  const [canAdjustStock, setCanAdjustStock] = useState(role ? role.can_adjust_stock : false);
  const [inventoryScope, setInventoryScope] = useState(role?.inventory_scope || 'full');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(role);

  const toggleModule = (modId) => {
    setAllowedModules((prev) => {
      if (prev.includes(modId)) {
        return prev.filter((id) => id !== modId);
      } else {
        return [...prev, modId];
      }
    });
  };

  const selectAllModules = () => {
    setAllowedModules(SYSTEM_MODULES.map((m) => m.id));
  };

  const clearAllModules = () => {
    setAllowedModules([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Role category name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        allowed_modules: allowedModules,
        can_access_inventory: allowedModules.includes('inventory'),
        can_access_billing: allowedModules.includes('billing'),
        can_access_staff: allowedModules.includes('staff'),
        can_adjust_stock: allowedModules.includes('inventory') ? canAdjustStock : false,
        cashier_role: allowedModules.includes('billing') ? cashierRole : 'cashier',
        inventory_scope: allowedModules.includes('inventory') ? inventoryScope : 'full',
      };

      let res;
      if (isEditing) {
        res = await updateStaffRole(role.id, payload);
      } else {
        res = await createStaffRole(payload);
      }
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {isEditing ? `Edit Category: ${role.name}` : 'Create New Role Category'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Select which buttons and workstations appear in the menu for staff with this role.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Role Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Counter Cashier, Floor Supervisor"
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Duties, operational scope, and role responsibilities..."
              className="form-input"
              rows={2}
            />
          </div>

          {/* 8 Menu Buttons Visibility & Permissions Selector */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>
                  Menu Buttons &amp; Accessibility ({SYSTEM_MODULES.length} Modules)
                </label>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Selected buttons will be visible and accessible in their fixed menu positions.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={selectAllModules}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllModules}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* 8 Buttons Card Selection Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}
            >
              {SYSTEM_MODULES.map((m) => {
                const isSelected = allowedModules.includes(m.id);
                const IconComp = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected
                        ? `2px solid ${m.color}`
                        : '1px solid var(--border-subtle)',
                      background: isSelected ? m.bgGlow : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {/* Custom Checkbox */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: isSelected ? `2px solid ${m.color}` : '2px solid var(--border-subtle)',
                        background: isSelected ? m.color : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>

                    {/* Module Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: m.bgGlow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: m.color,
                        flexShrink: 0,
                      }}
                    >
                      <IconComp size={18} />
                    </div>

                    {/* Module Details */}
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {m.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cashier Sub-Option: Head Cashier vs Cashier */}
            {allowedModules.includes('billing') && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '14px 16px',
                  background: 'var(--bg-surface-hover)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Receipt size={14} style={{ color: 'var(--brand-primary)' }} />
                  <span>Billing &amp; POS Authorization Level</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setCashierRole('cashier')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: cashierRole === 'cashier' ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      background: cashierRole === 'cashier' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: cashierRole === 'cashier' ? '5px solid var(--brand-primary)' : '2px solid var(--border-subtle)',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: cashierRole === 'cashier' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                        Standard Cashier
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '24px', lineHeight: 1.35 }}>
                      Can checkout cart and scan items. Cost prices are hidden and unit prices are fixed.
                    </div>
                  </div>

                  <div
                    onClick={() => setCashierRole('head_cashier')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: cashierRole === 'head_cashier' ? '2px solid #FEC501' : '1px solid var(--border-subtle)',
                      background: cashierRole === 'head_cashier' ? 'rgba(254, 197, 1, 0.08)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: cashierRole === 'head_cashier' ? '5px solid #FEC501' : '2px solid var(--border-subtle)',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: cashierRole === 'head_cashier' ? '#FEC501' : 'var(--text-primary)' }}>
                        Head Cashier
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '24px', lineHeight: 1.35 }}>
                      Can view Cost Prices and edit / override Unit Prices directly in POS cart.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory sub-option: Stock Adjustment & Scope */}
            {allowedModules.includes('inventory') && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Inventory Access Scope Selector */}
                <div
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-surface-hover)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: 'var(--brand-primary)' }} />
                    <span>Inventory Access Scope &amp; Boundary</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div
                      onClick={() => setInventoryScope('full')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: inventoryScope === 'full' ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        background: inventoryScope === 'full' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            border: inventoryScope === 'full' ? '5px solid var(--brand-primary)' : '2px solid var(--border-subtle)',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: inventoryScope === 'full' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                          Full Store Inventory
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '24px', lineHeight: 1.35 }}>
                        Access, view, search, and manage products across all sections and departments.
                      </div>
                    </div>

                    <div
                      onClick={() => setInventoryScope('assigned_section')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: inventoryScope === 'assigned_section' ? '2px solid #38BDF8' : '1px solid var(--border-subtle)',
                        background: inventoryScope === 'assigned_section' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            border: inventoryScope === 'assigned_section' ? '5px solid #38BDF8' : '2px solid var(--border-subtle)',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: inventoryScope === 'assigned_section' ? '#38BDF8' : 'var(--text-primary)' }}>
                          Assigned Section Only
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '24px', lineHeight: 1.35 }}>
                        Restricted strictly to the staff member's assigned department. Other sections and items are hidden.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Adjustment Permission */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bg-surface-hover)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem' }}>
                    <input
                      type="checkbox"
                      checked={canAdjustStock}
                      onChange={(e) => setCanAdjustStock(e.target.checked)}
                      style={{ width: '15px', height: '15px' }}
                    />
                    <span>
                      <strong>Stock Adjustments Permission:</strong> Allow staff with this role to manually add/deduct stock levels in ledger.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Role Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
