/**
 * EmployeePortalView.jsx  —  Phase 1: Employee Workspace & Self-Service Profile Engine
 *
 * Full Desktop Workstation Edition:
 *   - Responsive desktop layout (max-width 1440px / widescreen container)
 *   - Top workstation header with return to launcher, quick metric badges, and role tag
 *   - Staff Directory: Multi-column responsive grid & table with search, store & section filters
 *   - My Workspace / Profile: 2-column desktop layout with 1:1 ProfilePhotoPicker, contact editor,
 *     role capabilities overview, and in-person administrator password security notice
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, Phone, Shield, ShieldCheck, AlertCircle, Users,
  Loader2, Edit3, Save, Building2, Tag, Star, ArrowLeft,
  Search, Filter, Check, LayoutGrid, List, Layers, CheckSquare,
  TrendingUp, BarChart2, PieChart as PieChartIcon, Eye, Target,
  AlertOctagon,
} from 'lucide-react';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import TaskVerificationEngine from './TaskVerificationEngine';
import SectionGoalWidget from './SectionGoalWidget';
import SectionPieChart from './SectionPieChart';
import GlowCurveChart from './GlowCurveChart';
import AdminSectionGoalsDashboard from './AdminSectionGoalsDashboard';
import TimelineRangeSelector, { MONTH_NAMES } from './TimelineRangeSelector';
import BrokenItemModal from './BrokenItemModal';
import SectionInventoryViewer from './SectionInventoryViewer';
import { formatPhoneNumber, handlePhoneInputChange, isValidPhoneNumber } from '../utils/phoneFormat';
import {
  getPortalMe, updatePortalMe,
  getOwnerStaffDirectory, fetchStores, fetchSections,
  fetchMonthlyFinancialAnalysis,
} from '../api';

// ---- Helpers ---------------------------------------------------------------

function buildPhotoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  return path;
}

function Avatar({ photo, name, size = 64 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const photoUrl = buildPhotoUrl(photo);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: photoUrl ? 'transparent' : 'linear-gradient(135deg, #c52224, #f87171)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 800, color: '#fff',
      overflow: 'hidden', flexShrink: 0,
      border: '2px solid rgba(255,255,255,0.12)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}

// ---- Desktop Staff Card (Owner Directory) ----------------------------------

function StaffCard({ member, onSelectMember }) {
  const [hover, setHover] = useState(false);
  const isOwner = member.role_details?.is_owner;

  return (
    <div
      className="glass-panel"
      onClick={() => onSelectMember?.(member)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '22px', borderRadius: '16px',
        display: 'flex', flexDirection: 'column', gap: '16px',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        borderColor: hover ? 'rgba(197,34,36,0.45)' : 'var(--border-subtle)',
        boxShadow: hover ? '0 14px 36px rgba(0,0,0,0.35)' : 'var(--shadow-sm)',
        transition: 'all 0.22s ease-out',
        background: 'var(--bg-surface)',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
      }}
      title="Click to inspect this employee's workspace, section targets and analytics as admin"
    >
      {/* Top Banner Accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
        background: isOwner
          ? 'linear-gradient(90deg, #f59e0b, #ec4899)'
          : member.section_color
            ? member.section_color
            : 'linear-gradient(90deg, #c52224, #f87171)',
      }} />

      {/* Header Row: Avatar + Name + ID + Role Tag */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <Avatar photo={member.photo} name={member.name} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <h4 style={{
              margin: 0, fontWeight: 800, color: 'var(--text-primary)',
              fontSize: '1.02rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {member.name}
            </h4>
            <span style={{
              padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem',
              fontWeight: 800, background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
            }}>
              {member.staff_id}
            </span>
          </div>

          {/* Role Pill */}
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700,
              background: isOwner ? 'rgba(245,158,11,0.16)' : 'rgba(197,34,36,0.14)',
              color: isOwner ? '#f59e0b' : 'var(--brand-primary, #c52224)',
              border: `1px solid ${isOwner ? 'rgba(245,158,11,0.3)' : 'rgba(197,34,36,0.25)'}`,
            }}>
              {isOwner ? <Star size={11} /> : <Shield size={11} />}
              {member.role_details?.name || 'Staff'}
            </span>

            {member.section_name && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600,
                background: member.section_color ? `${member.section_color}22` : 'rgba(99,102,241,0.14)',
                color: member.section_color || '#818cf8',
                border: `1px solid ${member.section_color ? `${member.section_color}44` : 'rgba(99,102,241,0.25)'}`,
              }}>
                <Tag size={11} /> {member.section_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Badges */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
        padding: '12px 14px', borderRadius: '12px',
        background: 'var(--bg-surface-hover, rgba(255,255,255,0.03))',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.store_details?.name || 'All Locations'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Phone size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatPhoneNumber(member.phone) || 'No phone'}
          </span>
        </div>
      </div>

      {/* Card Footer Status & Action */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: '8px', borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ color: '#22c55e' }} />
          <span>Active Staff</span>
        </div>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: hover ? '#fff' : 'var(--brand-primary, #c52224)',
          background: hover ? 'var(--brand-primary, #c52224)' : 'rgba(197,34,36,0.12)',
          padding: '4px 10px',
          borderRadius: '8px',
          transition: 'all 0.18s ease-out',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          View Workspace →
        </span>
      </div>
    </div>
  );
}

// ---- Owner Staff Directory View --------------------------------------------

function OwnerDirectory({ onSelectMember }) {
  const [members, setMembers]     = useState([]);
  const [stores, setStores]       = useState([]);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [storeFilter, setStoreFilter]     = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [roleFilter, setRoleFilter]       = useState('');
  const [viewMode, setViewMode]           = useState('grid'); // 'grid' | 'table'

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, storesData, sectionsData] = await Promise.all([
        getOwnerStaffDirectory(),
        fetchStores().catch(() => []),
        fetchSections().catch(() => []),
      ]);
      setMembers(membersData || []);
      setStores(storesData || []);
      setSections(sectionsData || []);
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Unique roles present
  const availableRoles = useMemo(() => {
    const map = new Map();
    members.forEach(m => {
      if (m.role_details?.name) map.set(m.role_details.name, m.role_details.name);
    });
    return Array.from(map.values());
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        m.name?.toLowerCase().includes(q) ||
        m.staff_id?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.role_details?.name?.toLowerCase().includes(q) ||
        m.section_name?.toLowerCase().includes(q);

      const matchStore = !storeFilter || String(m.store) === String(storeFilter);
      const matchSection = !sectionFilter || String(m.section) === String(sectionFilter);
      const matchRole = !roleFilter || m.role_details?.name === roleFilter;

      return matchSearch && matchStore && matchSection && matchRole;
    });
  }, [members, search, storeFilter, sectionFilter, roleFilter]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <Loader2 size={36} className="spin" style={{ margin: '0 auto 16px auto', color: 'var(--brand-primary, #c52224)' }} />
        <div style={{ fontSize: '0.94rem', fontWeight: 600 }}>Loading employee workstation directory…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Metric Summary Ribbon */}
      <div
        className="portal-metric-ribbon"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        <div className="glass-panel portal-metric-card" style={{ padding: '14px 18px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="portal-metric-icon" style={{ width: 40, height: 40, minWidth: 40, borderRadius: '10px', background: 'rgba(197,34,36,0.14)', color: 'var(--brand-primary, #c52224)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Active Staff</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{members.length}</div>
          </div>
        </div>

        <div className="glass-panel portal-metric-card" style={{ padding: '14px 18px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="portal-metric-icon" style={{ width: 40, height: 40, minWidth: 40, borderRadius: '10px', background: 'rgba(59,130,246,0.14)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Store Locations</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stores.length || 1}</div>
          </div>
        </div>

        <div className="glass-panel portal-metric-card" style={{ padding: '14px 18px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="portal-metric-icon" style={{ width: 40, height: 40, minWidth: 40, borderRadius: '10px', background: 'rgba(99,102,241,0.14)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Assigned Sections</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {members.filter(m => m.section).length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {members.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Search & Filter Toolbar */}
      <div
        className="glass-panel portal-filter-toolbar"
        style={{
          padding: '14px 18px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div className="portal-filter-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px', flexWrap: 'wrap' }}>
          <div className="portal-search-box" style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, phone, role, or section…"
              className="form-control"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px 0 40px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="portal-select-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Store Filter */}
            <select
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
              className="form-select"
              style={{
                height: '42px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Stores</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Section Filter */}
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="form-select"
              style={{
                height: '42px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Sections</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>

            {/* Role Filter */}
            {availableRoles.length > 0 && (
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="form-select"
                style={{
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">All Roles</option>
                {availableRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {(search || storeFilter || sectionFilter || roleFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStoreFilter(''); setSectionFilter(''); setRoleFilter(''); }}
                className="btn btn-secondary"
                style={{ height: '42px', padding: '0 14px', fontSize: '0.8rem', borderRadius: '10px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="portal-view-toggle" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              width: 36, height: 36, borderRadius: '8px', border: 'none',
              background: viewMode === 'grid' ? 'var(--brand-primary, #c52224)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Card Grid Mode"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              width: 36, height: 36, borderRadius: '8px', border: 'none',
              background: viewMode === 'table' ? 'var(--brand-primary, #c52224)' : 'transparent',
              color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Dense Table Mode"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Directory Content Display */}
      {filteredMembers.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '60px 20px', borderRadius: '18px', textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <Filter size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No staff members found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Try clearing your search query or filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '18px',
        }}>
          {filteredMembers.map(member => (
            <StaffCard key={member.id} member={member} onSelectMember={onSelectMember} />
          ))}
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            borderRadius: '16px', overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Staff Member</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Staff ID</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Role</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Section</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Store Location</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Contact Phone</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr
                  key={member.id}
                  onClick={() => onSelectMember?.(member)}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Click to view workspace as admin"
                >
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar photo={member.photo} name={member.name} size={36} />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{member.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {member.staff_id}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700,
                      background: member.role_details?.is_owner ? 'rgba(245,158,11,0.16)' : 'rgba(197,34,36,0.14)',
                      color: member.role_details?.is_owner ? '#f59e0b' : 'var(--brand-primary, #c52224)',
                    }}>
                      {member.role_details?.name || 'Staff'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    {member.section_name ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 600,
                        background: member.section_color ? `${member.section_color}22` : 'rgba(99,102,241,0.12)',
                        color: member.section_color || '#818cf8',
                      }}>
                        <Tag size={10} /> {member.section_name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                    {member.store_details?.name || 'All Stores'}
                  </td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                    {formatPhoneNumber(member.phone) || '—'}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.74rem', padding: '5px 12px', borderRadius: '8px', fontWeight: 700,
                        color: 'var(--brand-primary, #c52224)', borderColor: 'rgba(197,34,36,0.3)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember?.(member);
                      }}
                    >
                      View Workspace →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- My Profile & Workspace View (2-Column Desktop Layout + Section Analytics) -----------------

function MyWorkspaceProfile({
  profile,
  stores = [],
  sections = [],
  onSaved,
  onOpenTasks,
  isAdminInspection = false,
  isOwner = false,
}) {
  const [editing, setEditing]           = useState(false);
  const [name, setName]                 = useState(profile?.name || '');
  const [phone, setPhone]               = useState(profile?.phone || '');
  const [photoFile, setPhotoFile]       = useState(undefined); // File | null | undefined
  const [photoUrl, setPhotoUrl]         = useState(profile?.photo || '');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [showBrokenModal, setShowBrokenModal] = useState(false);

  // Section financial intelligence state
  const [finData, setFinData]             = useState(null);
  const [finLoading, setFinLoading]       = useState(false);
  const [timelineRange, setTimelineRange] = useState(null);
  const [activeYear, setActiveYear]       = useState(2026);
  const [activeMonth, setActiveMonth]     = useState(9);
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [activeDayNum, setActiveDayNum]   = useState(7);

  // Sync profile details when profile prop updates
  useEffect(() => {
    setName(profile?.name || '');
    setPhone(profile?.phone || '');
    setPhotoUrl(profile?.photo || '');
    setPhotoFile(undefined);
    setEditing(false);
    setError('');
  }, [profile]);

  // Load section performance analytics for whichever section the employee belongs to
  const loadSectionAnalysis = useCallback(async (range = null) => {
    if (!profile?.section) return;
    setFinLoading(true);
    try {
      const params = {
        store: profile?.store || undefined,
        year: activeYear,
        month: activeMonth,
      };
      if (range?.startDate && range?.endDate) {
        params.start_date = range.startDate;
        params.end_date = range.endDate;
      }
      const res = await fetchMonthlyFinancialAnalysis(params);
      setFinData(res);
    } catch (err) {
      console.error('Failed to load section analysis:', err);
    } finally {
      setFinLoading(false);
    }
  }, [profile?.section, profile?.store, activeYear, activeMonth]);

  useEffect(() => {
    loadSectionAnalysis(timelineRange);
  }, [loadSectionAnalysis, timelineRange]);

  const currentSection = useMemo(() => {
    if (!finData?.sections || !profile?.section) return null;
    return finData.sections.find(s => String(s.id) === String(profile.section)) || null;
  }, [finData, profile?.section]);

  const handleRangeChange = useCallback((newRange) => {
    const updatedRange = {
      ...newRange,
      label: newRange.unit === 'month' && !newRange.startDate
        ? `${MONTH_NAMES[activeMonth - 1]} ${activeYear}`
        : newRange.label,
    };
    setTimelineRange(updatedRange);
    if (newRange.unit === 'custom' && newRange.startDate) {
      const [y, m, d] = newRange.startDate.split('-').map(Number);
      if (y) setActiveYear(y);
      if (m) setActiveMonth(m);
      if (d) setActiveDayNum(d);
    } else if (newRange.unit === 'year' && newRange.startDate) {
      const [y] = newRange.startDate.split('-').map(Number);
      if (y) setActiveYear(y);
    }
  }, [activeMonth, activeYear]);

  const isProfileOwner = profile?.role_details?.is_owner;
  const currentPhoto = photoUrl || buildPhotoUrl(profile?.photo);

  const handleSave = async () => {
    if (isAdminInspection) return;
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('Full name cannot be blank.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact phone number cannot be blank.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setError('Please enter a valid 10-digit phone number without letters or invalid characters (e.g. +91 98765 43210).');
      return;
    }
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('name', name.trim());
      payload.append('phone', phone.trim());

      if (photoFile instanceof File) {
        payload.append('photo', photoFile);
      } else if (photoFile === null) {
        payload.append('photo', '');
      }

      const updated = await updatePortalMe(payload);
      setPhotoFile(undefined);
      setPhotoUrl(updated.photo || '');
      setEditing(false);
      setSuccess('Profile updated successfully!');
      if (typeof window !== 'undefined') {
        localStorage.setItem('wondersale_staff_user', JSON.stringify(updated));
      }
      onSaved?.(updated);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(profile?.name || '');
    setPhone(profile?.phone || '');
    setPhotoFile(undefined);
    setPhotoUrl(profile?.photo || '');
    setEditing(false);
    setError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* TOP 2-COLUMN PROFILE HERO & DETAILS SECTION */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 360px) 1fr',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* LEFT COLUMN: Identity Hero Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Profile Identity Card */}
          <div
            className="glass-panel"
            style={{
              borderRadius: '20px', overflow: 'hidden',
              background: 'var(--bg-surface)',
            }}
          >
            {/* Cover Header Banner */}
            <div style={{
              height: '110px',
              background: isProfileOwner
                ? 'linear-gradient(135deg, #c52224 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
              position: 'relative',
            }} />

            {/* Avatar & Main Badge */}
            <div style={{ padding: '0 24px 24px 24px', marginTop: '-55px', position: 'relative' }}>
              <div style={{ position: 'relative', width: 'fit-content' }}>
                <div
                  onClick={() => { if (!editing && !isAdminInspection) setEditing(true); }}
                  style={{
                    width: 104, height: 104, borderRadius: '50%',
                    background: currentPhoto ? 'transparent' : 'linear-gradient(135deg, #c52224, #f87171)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 38, fontWeight: 800, color: '#fff',
                    overflow: 'hidden', flexShrink: 0,
                    border: '4px solid var(--bg-surface)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    cursor: (!editing && !isAdminInspection) ? 'pointer' : 'default',
                  }}
                  title={isAdminInspection ? 'Viewing in Admin Inspection Mode' : (editing ? 'Editing profile' : 'Click to edit profile photo')}
                >
                  {currentPhoto
                    ? <img src={currentPhoto} alt={profile?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (profile?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>

                {!editing && !isAdminInspection && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    style={{
                      position: 'absolute', bottom: 4, right: 4,
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--brand-primary, #c52224)', border: '2px solid var(--bg-surface)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                    title="Edit Profile & Photo"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>

              <div style={{ marginTop: '14px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {profile?.name}
                </h3>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Staff ID: <b style={{ color: 'var(--text-primary)' }}>{profile?.staff_id}</b></span>
                  <span>•</span>
                  <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} /> Active
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                  background: isProfileOwner ? 'rgba(245,158,11,0.18)' : 'rgba(197,34,36,0.14)',
                  color: isProfileOwner ? '#f59e0b' : 'var(--brand-primary, #c52224)',
                  border: `1px solid ${isProfileOwner ? 'rgba(245,158,11,0.3)' : 'rgba(197,34,36,0.25)'}`,
                }}>
                  {isProfileOwner && <Star size={12} />}
                  {profile?.role_details?.name || 'Staff Member'}
                </span>

                {profile?.section_name && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                    background: profile.section_color ? `${profile.section_color}22` : 'rgba(99,102,241,0.14)',
                    color: profile.section_color || '#818cf8',
                    border: `1px solid ${profile.section_color ? `${profile.section_color}44` : 'rgba(99,102,241,0.25)'}`,
                  }}>
                    <Tag size={12} /> {profile.section_name}
                  </span>
                )}
              </div>

              <div style={{
                marginTop: '20px', paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                fontSize: '0.84rem', color: 'var(--text-secondary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <Building2 size={15} style={{ color: 'var(--text-muted)' }} />
                  <span>Store: <b style={{ color: 'var(--text-primary)' }}>{profile?.store_details?.name || 'All Store Locations'}</b></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <Phone size={15} style={{ color: 'var(--text-muted)' }} />
                  <span>Phone: <b style={{ color: 'var(--text-primary)' }}>{formatPhoneNumber(profile?.phone) || 'Not provided'}</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Personal Details & Operational Command Deck */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Personal Details Card */}
          <div
            className="glass-panel"
            style={{
              padding: '26px 28px', borderRadius: '20px',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '20px',
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Personal &amp; Contact Information
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {isAdminInspection
                    ? 'Administrator inspection view of staff contact details'
                    : (editing ? 'Update your profile photo, display name, and contact phone number' : 'Your staff workstation profile details')}
                </p>
              </div>

              {!isAdminInspection && (
                !editing ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="btn btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '8px 18px', borderRadius: '10px', fontWeight: 700,
                    }}
                  >
                    <Edit3 size={15} /> Edit Details
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-primary"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 20px', borderRadius: '10px', fontWeight: 700,
                      }}
                    >
                      {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )
              )}

              {isAdminInspection && (
                <span style={{
                  fontSize: '0.74rem', fontWeight: 700,
                  background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.3)',
                  padding: '5px 12px', borderRadius: '20px',
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                }}>
                  <Shield size={12} /> Admin Inspection
                </span>
              )}
            </div>

            {success && (
              <div style={{
                padding: '12px 18px', borderRadius: '10px', marginBottom: '18px',
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.86rem',
                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600,
              }}>
                <Check size={17} /> {success}
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px 18px', borderRadius: '10px', marginBottom: '18px',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.86rem',
                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600,
              }}>
                <AlertCircle size={17} /> {error}
              </div>
            )}

            {editing && !isAdminInspection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    Profile Photograph (1:1 Aspect Ratio)
                  </label>
                  <ProfilePhotoPicker
                    photoUrl={photoUrl}
                    name={name}
                    onChangePhoto={(file, url) => {
                      setPhotoFile(file);
                      setPhotoUrl(url || '');
                    }}
                    size={96}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Full Name *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="form-control"
                        placeholder="Enter full name"
                        style={{
                          width: '100%', padding: '11px 14px 11px 38px', borderRadius: '10px',
                          background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                          border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Contact Phone Number *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(handlePhoneInputChange(e.target.value))}
                        className="form-control"
                        placeholder="e.g. +91 98765 43210"
                        style={{
                          width: '100%', padding: '11px 14px 11px 38px', borderRadius: '10px',
                          background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                          border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                        }}
                        required
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      Required. Digits only, auto-formats to standard: +91 XXXXX XXXXX.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
              }}>
                {[
                  { label: 'Full Display Name', value: profile?.name || '—', Icon: User },
                  { label: 'Staff Login ID', value: profile?.staff_id || '—', Icon: Shield },
                  { label: 'Contact Phone', value: formatPhoneNumber(profile?.phone) || 'Not provided', Icon: Phone },
                  { label: 'Assigned Store', value: profile?.store_details?.name || 'All Stores', Icon: Building2 },
                  { label: 'Store Section', value: profile?.section_name || 'Unassigned', Icon: Tag },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    style={{
                      padding: '14px 16px', borderRadius: '14px',
                      background: 'var(--bg-surface-hover, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{
                      fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <Icon size={12} /> {label}
                    </div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Command Deck: 2x2 Balanced Grid (Role Capabilities, Tasks, Security, Damage Report) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            gap: '18px',
            alignItems: 'stretch',
          }}>
            {/* Card 1: Role Permissions & Capabilities Card */}
            <div
              className="glass-panel"
              style={{
                padding: '22px 24px', borderRadius: '18px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '8px',
                    background: 'rgba(16,185,129,0.14)', color: '#10b981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Active Role Capabilities
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Modules under <b>{profile?.role_details?.name || 'Staff'}</b>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(profile?.role_details?.allowed_modules || []).map(mod => (
                    <span
                      key={mod}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 11px', borderRadius: '16px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <Check size={12} style={{ color: '#22c55e' }} />
                      <span style={{ textTransform: 'capitalize' }}>{mod.replace('_', ' ')}</span>
                    </span>
                  ))}
                  {isProfileOwner && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 11px', borderRadius: '16px', fontSize: '0.76rem', fontWeight: 700,
                      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)',
                    }}>
                      <Star size={12} /> Complete Owner Privileges
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Task Engine Shortcut Widget */}
            {onOpenTasks && (
              <div
                className="glass-panel"
                style={{
                  padding: '22px 24px', borderRadius: '18px',
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(59,130,246,0.04) 100%)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '8px',
                        background: 'rgba(56,189,248,0.16)', color: '#38bdf8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <CheckSquare size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Task &amp; Proof Engine
                        </h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Daily Tasks &amp; Verification</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenTasks}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '5px 12px', borderRadius: '8px', fontWeight: 700 }}
                    >
                      Open Tasks →
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    View tasks assigned by managers, track target deadlines, and upload mandatory photo proofs.
                  </p>
                </div>
              </div>
            )}

            {/* Card 3: Security Policy Panel — In-Person Administrator Password Management */}
            <div
              className="glass-panel"
              style={{
                padding: '22px 24px', borderRadius: '18px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '8px',
                    background: 'rgba(99,102,241,0.14)', color: '#818cf8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Credential Security Policy
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Admin Managed Credentials</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Employee passwords cannot be altered online to preserve store audit integrity. Contact your store manager or administrator to update credentials in Staff &amp; Roles.
                </p>
              </div>
            </div>

            {/* Card 4: Damaged / Broken Stock Write-off Action */}
            <div
              className="glass-panel"
              style={{
                padding: '22px 24px', borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(244,63,94,0.07) 0%, rgba(225,29,72,0.04) 100%)',
                border: '1px solid rgba(244,63,94,0.3)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '8px',
                      background: 'rgba(244,63,94,0.16)', color: '#f43f5e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <AlertOctagon size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Report Broken Item
                      </h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Stock Loss &amp; Damage Write-off</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBrokenModal(true)}
                    className="btn"
                    style={{
                      fontSize: '0.74rem', padding: '6px 14px', borderRadius: '8px', fontWeight: 700,
                      background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', border: 'none',
                      boxShadow: '0 4px 12px rgba(225,29,72,0.3)', cursor: 'pointer',
                    }}
                  >
                    + Report Damage
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Physically damaged or broken in-stock items require mandatory photo verification for accounting write-offs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION PERFORMANCE, TARGETS & INVENTORY INTELLIGENCE WORKSTATION         */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
        {profile?.section ? (
          <>
            {/* Workstation Header Bar with Section Branding & Universal TimelineRangeSelector */}
            <div
              className="glass-panel"
              style={{
                padding: '18px 24px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '12px',
                  background: profile.section_color ? `${profile.section_color}22` : 'rgba(56,189,248,0.15)',
                  color: profile.section_color || '#38bdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${profile.section_color ? `${profile.section_color}44` : 'rgba(56,189,248,0.3)'}`,
                }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.74rem', fontWeight: 800,
                      color: profile.section_color || '#38bdf8',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      Assigned Section Workspace
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {profile.store_details?.name || 'All Locations'}
                    </span>
                  </div>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {profile.section_name} Performance &amp; Targets
                  </h3>
                </div>
              </div>

              {/* Universal Global Timeline Range Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TimelineRangeSelector
                  value={timelineRange}
                  defaultUnit="month"
                  defaultCount={1}
                  allowAllTime={true}
                  minDate={finData?.earliest_record_date || '2026-09-04'}
                  compact={false}
                  chartType="dashboard"
                  onChange={handleRangeChange}
                />
              </div>
            </div>

            {/* Target & Achievement Goals Widget */}
            <SectionGoalWidget
              sectionId={profile.section}
              sectionName={profile.section_name}
              sectionColor={profile.section_color}
              isOwner={isOwner || isAdminInspection}
            />

            {/* Section Sales & Profit Glow Curve Chart */}
            <div>
              <GlowCurveChart
                id={`section-${profile.section}-sales-profit-curve`}
                title={(p) =>
                  p === 'day'
                    ? `${profile.section_name} Intraday Sales & Profit (Hourly)`
                    : p === 'week'
                    ? `${profile.section_name} 7-Day Performance Trajectory`
                    : p === 'month'
                    ? `${profile.section_name} Daily Sales & Profit Trajectory (${MONTH_NAMES[activeMonth - 1]} ${activeYear})`
                    : `${profile.section_name} Annual Monthly Trajectory (Year ${activeYear})`
                }
                yearlyData={currentSection?.monthly_profit_trend || []}
                monthlyData={currentSection?.timeline || []}
                weeksData={currentSection?.weeks || []}
                initialPeriod="month"
                activeMonthKey={activeMonth}
                selectedYear={activeYear}
                selectedMonthName={MONTH_NAMES[activeMonth - 1]}
                onYearChange={(newYear) => setActiveYear(newYear)}
                onMonthChange={(newMonth) => setActiveMonth(newMonth)}
                onWeekChange={(newWeek) => setActiveWeekIdx(newWeek)}
                onDayChange={(newDay) => setActiveDayNum(newDay)}
                timelineRange={timelineRange}
                minDate={finData?.earliest_record_date || '2026-09-04'}
                lines={[
                  {
                    key: 'revenue',
                    name: `${profile.section_name} Sales Revenue`,
                    color: '#38BDF8', // Cyan/Sky
                  },
                  {
                    key: 'gross_profit',
                    name: `${profile.section_name} Gross Profit`,
                    color: '#00E5A3', // Vibrant Emerald/Mint
                  },
                ]}
                height={320}
              />
            </div>

            {/* Section Items Breakdown Pie Chart (Top 10 + Aggregate Other Slice) */}
            <div>
              <SectionPieChart
                sections={finData?.sections || []}
                lockToSectionId={profile.section}
                lockToSectionName={profile.section_name}
                storeId={profile.store}
                selectedMonthName={MONTH_NAMES[activeMonth - 1]}
                selectedYear={activeYear}
                timelineRange={timelineRange}
                onRangeChange={handleRangeChange}
                minDate={finData?.earliest_record_date || '2026-09-04'}
              />
            </div>

            {/* Section Items Live Verification Table (Read-Only) */}
            <SectionInventoryViewer
              sectionId={profile.section}
              sectionName={profile.section_name}
              sectionColor={profile.section_color}
              storeId={profile.store}
              currentUser={profile}
            />
          </>
        ) : (
          <div
            className="glass-panel"
            style={{
              padding: '40px 24px',
              borderRadius: '18px',
              textAlign: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Tag size={26} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                No Store Section Assigned
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '520px', lineHeight: 1.6 }}>
                This staff member is currently not assigned to a retail section. Section monthly sales and profit curves, financial targets, and inventory item pie charts will be unlocked automatically once a section is assigned in Staff &amp; Roles.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Damaged / Broken Item Reporting Modal */}
      {showBrokenModal && (
        <BrokenItemModal
          currentUser={profile}
          stores={stores}
          sections={sections}
          onClose={() => setShowBrokenModal(false)}
          onSuccess={() => {
            loadSectionAnalysis(timelineRange);
          }}
        />
      )}
    </div>
  );
}

// ---- Main Component --------------------------------------------------------

export default function EmployeePortalView({ currentUser, onBackToLauncher }) {
  const isOwner = currentUser?.role_details?.is_owner || currentUser?.role_details?.can_access_staff;
  const [profile, setProfile]                   = useState(null);
  const [staffMembers, setStaffMembers]         = useState([]);
  const [stores, setStores]                     = useState([]);
  const [sections, setSections]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [activeTab, setActiveTab]               = useState(isOwner ? 'tasks' : 'tasks');
  const [inspectedMember, setInspectedMember]   = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [meData, membersData, storesData, sectionsData] = await Promise.all([
          getPortalMe().catch(() => currentUser),
          getOwnerStaffDirectory().catch(() => []),
          fetchStores().catch(() => []),
          fetchSections().catch(() => []),
        ]);
        setProfile(meData || currentUser);
        setStaffMembers(membersData || []);
        setStores(storesData || []);
        setSections(sectionsData || []);
      } catch {
        setProfile(currentUser);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  const tabs = isOwner
    ? [
        { id: 'tasks',         label: 'Task Proof & Verification', Icon: CheckSquare },
        { id: 'section-goals', label: 'Section Monthly Goals',     Icon: Target },
        { id: 'directory',     label: 'Staff Directory',           Icon: Users },
        { id: 'profile',       label: 'My Workspace',             Icon: User },
      ]
    : [
        { id: 'tasks',         label: 'My Tasks & Photo Proof',    Icon: CheckSquare },
        { id: 'profile',       label: 'My Workspace',             Icon: User },
      ];

  if (loading) {
    return (
      <div style={{
        minHeight: '500px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '14px',
        color: 'var(--text-muted)', width: '100%',
      }}>
        <Loader2 size={36} className="spin" style={{ color: 'var(--brand-primary, #c52224)' }} />
        <span style={{ fontSize: '0.94rem', fontWeight: 600 }}>Loading employee workstation…</span>
      </div>
    );
  }

  return (
    <div
      className="employee-portal-root"
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '24px 32px',
        width: '100%',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Navigation & Employee Hub Title */}
      <div
        className="employee-portal-header"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Left: Back to Launcher */}
        <div className="employee-portal-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 700,
                padding: '5px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-pill)',
                height: '30px',
              }}
              title="Return to Menu"
            >
              <ArrowLeft size={13} />
              <span>Menu</span>
            </button>
          )}
        </div>

        {/* Center: Employee Hub Title & Subtitle */}
        <div className="employee-portal-header-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{
            margin: '0 0 1px 0',
            fontSize: '1.45rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            textAlign: 'center',
          }}>
            Employee Hub
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#d946ef',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Workstation Mode
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isOwner ? 'Full Directory & Workspace' : 'Personal Workspace'}
            </span>
          </div>
        </div>

        {/* Right: Quick Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="glass-panel"
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span>Logged in as <b>{currentUser?.name}</b></span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: isOwner ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.18)',
              color: isOwner ? '#f59e0b' : '#818cf8',
            }}>
              {currentUser?.role_details?.name || 'Staff'}
            </span>
          </div>
        </div>
      </div>

      {/* Workstation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '26px',
        }}
      >
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id !== 'directory') setInspectedMember(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--brand-primary, #c52224)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.92rem',
                borderBottom: isActive ? '3px solid var(--brand-primary, #c52224)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'all 0.18s ease-out',
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div>
        {activeTab === 'directory' && isOwner && (
          inspectedMember ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Top Admin Inspection Mode Banner */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px 22px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(197,34,36,0.08) 100%)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '12px',
                    background: 'rgba(245,158,11,0.2)', color: '#f59e0b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(245,158,11,0.4)',
                  }}>
                    <Shield size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Admin Inspection View
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Viewing employee workspace as an administrator
                      </span>
                    </div>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {inspectedMember.name} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>({inspectedMember.staff_id})</span>
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedMember(null)}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 18px', borderRadius: '10px', fontWeight: 700,
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Staff Directory</span>
                </button>
              </div>

              <MyWorkspaceProfile
                profile={inspectedMember}
                stores={stores}
                sections={sections}
                isAdminInspection={true}
                isOwner={true}
                onSaved={(updated) => setInspectedMember(updated)}
                onOpenTasks={() => {
                  setInspectedMember(null);
                  setActiveTab('tasks');
                }}
              />
            </div>
          ) : (
            <OwnerDirectory onSelectMember={(member) => setInspectedMember(member)} />
          )
        )}

        {activeTab === 'section-goals' && isOwner && (
          <AdminSectionGoalsDashboard
            stores={stores}
            sections={sections}
            staffMembers={staffMembers}
            currentUser={profile || currentUser}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskVerificationEngine
            currentUser={profile || currentUser}
            staffMembers={staffMembers}
            stores={stores}
            sections={sections}
          />
        )}

        {activeTab === 'profile' && profile && (
          <MyWorkspaceProfile
            profile={profile}
            stores={stores}
            sections={sections}
            isOwner={isOwner}
            onSaved={setProfile}
            onOpenTasks={() => setActiveTab('tasks')}
          />
        )}
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
