import React, { useState, useMemo } from 'react';
import {
  PieChart as PieIcon,
  Layers,
  Building2,
  Truck,
  X,
  Calendar,
  User,
  Package,
  ZoomIn,
  Sparkles,
  Gavel,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import FineEmployeeModal from './FineEmployeeModal';
import { markBrokenItemNoFine } from '../api';

const PALETTE = [
  '#f43f5e', // rose-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#d946ef', // fuchsia-500
  '#6366f1', // indigo-500
];

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutArc(x, y, radius, innerRadius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

  // If angle is almost 360, cap to 359.99 to prevent zero-length SVG path bug
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, arcSweep, 0, end.x, end.y,
    'L', innerEnd.x, innerEnd.y,
    'A', innerRadius, innerRadius, 0, arcSweep, 1, innerStart.x, innerStart.y,
    'Z',
  ].join(' ');
}

export default function BrokenPieChart({
  brokenBreakdown = null,
  currencySymbol = '₹',
  onReportUpdated = null,
}) {
  const [activeMode, setActiveMode] = useState('category'); // 'category' | 'section' | 'supplier'
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fineReportTarget, setFineReportTarget] = useState(null);
  const [localFinedMap, setLocalFinedMap] = useState({});

  // Extract raw slices based on selected drilldown mode
  const rawList = useMemo(() => {
    if (!brokenBreakdown) return [];
    if (activeMode === 'category') return brokenBreakdown.by_category || [];
    if (activeMode === 'section') return brokenBreakdown.by_section || [];
    if (activeMode === 'supplier') return brokenBreakdown.by_supplier || [];
    return [];
  }, [brokenBreakdown, activeMode]);

  // Aggregate Top 8 + Other if list is long
  const chartData = useMemo(() => {
    const totalLoss = Number(brokenBreakdown?.total_loss || 0);
    if (!rawList || rawList.length === 0 || totalLoss <= 0) return [];

    let sorted = [...rawList].sort((a, b) => b.loss - a.loss);

    if (sorted.length > 8) {
      const top7 = sorted.slice(0, 7);
      const remainder = sorted.slice(7);
      const otherLoss = remainder.reduce((acc, curr) => acc + curr.loss, 0);
      const otherUnits = remainder.reduce((acc, curr) => acc + curr.units, 0);
      const otherItems = remainder.reduce((acc, curr) => acc + curr.items, 0);

      sorted = [
        ...top7,
        {
          name: 'Other',
          loss: otherLoss,
          units: otherUnits,
          items: otherItems,
          isOther: true,
        },
      ];
    }

    // Compute angles
    let currentAngle = 0;
    return sorted.map((item, index) => {
      const fraction = item.loss / totalLoss;
      const angle = fraction * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      return {
        ...item,
        color: PALETTE[index % PALETTE.length],
        percentage: (fraction * 100).toFixed(1),
        startAngle,
        endAngle,
      };
    });
  }, [rawList, brokenBreakdown]);

  // Filter audit reports by active selection and search term
  const filteredReports = useMemo(() => {
    const rawReports = brokenBreakdown?.reports || brokenBreakdown?.recent_reports || [];
    return rawReports.map((r) => {
      if (localFinedMap[r.id]) {
        return { ...r, ...localFinedMap[r.id] };
      }
      return r;
    }).filter((r) => {
      // Group filter from pie slice click
      if (selectedGroup) {
        if (activeMode === 'category' && r.category_name !== selectedGroup) return false;
        if (activeMode === 'section' && r.section_name !== selectedGroup) return false;
        if (activeMode === 'supplier' && r.supplier_name !== selectedGroup) return false;
      }
      // Text search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchItem = (r.item_name || '').toLowerCase().includes(q);
        const matchUid = (r.item_uid || '').toLowerCase().includes(q);
        const matchReason = (r.reason || '').toLowerCase().includes(q);
        const matchStaff = (r.reported_by_name || '').toLowerCase().includes(q);
        const matchSection = (r.section_name || '').toLowerCase().includes(q);
        const matchFined = (r.fined_employee_name || '').toLowerCase().includes(q);
        return matchItem || matchUid || matchReason || matchStaff || matchSection || matchFined;
      }
      return true;
    });
  }, [brokenBreakdown, selectedGroup, activeMode, searchQuery, localFinedMap]);

  const totalLoss = Number(brokenBreakdown?.total_loss || 0);
  const totalUnits = Number(brokenBreakdown?.units_count ?? brokenBreakdown?.total_units ?? 0);

  const [waivingReportId, setWaivingReportId] = useState(null);

  const handleFineSuccess = (updatedReport) => {
    if (updatedReport?.id) {
      setLocalFinedMap((prev) => ({
        ...prev,
        [updatedReport.id]: updatedReport,
      }));
    }
    if (onReportUpdated) {
      onReportUpdated(updatedReport);
    }
  };

  const handleQuickNoFine = async (report) => {
    try {
      setWaivingReportId(report.id);
      const res = await markBrokenItemNoFine(report.id);
      handleFineSuccess(res.report);
    } catch (err) {
      alert(err.message || 'Failed to mark as No Fine.');
    } finally {
      setWaivingReportId(null);
    }
  };

  if (!brokenBreakdown || totalLoss <= 0 || chartData.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
          borderRadius: '18px',
          padding: '36px 24px',
          textAlign: 'center',
          color: 'var(--text-muted, #64748b)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 12px auto',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={24} />
        </div>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
          Zero Damaged Write-offs Recorded
        </h4>
        <p style={{ margin: '4px auto 0 auto', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', maxWidth: '440px', lineHeight: 1.5 }}>
          No broken items or damaged stock write-offs were logged for this billing period.
          Inventory integrity is 100%.
        </p>
      </div>
    );
  }

  const activeFocus = hoveredSlice || (selectedGroup ? chartData.find((d) => d.name === selectedGroup) : null);

  return (
    <div
      className="glass-panel"
      style={{
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
        borderRadius: '18px',
        padding: '24px',
        boxShadow: 'var(--shadow-md, 0 4px 14px rgba(0, 0, 0, 0.06))',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        color: 'var(--text-primary, #0f172a)',
      }}
    >
      {/* Header and Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--text-primary, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.12)',
                color: '#e11d48',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PieIcon size={16} />
            </span>
            Broken &amp; Damaged Inventory Write-offs
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
            Real-time loss analytics grouped by category, section, and supplier with audit photo ledger &amp; employee fines
          </p>
        </div>

        {/* Drilldown Mode Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px',
            background: 'var(--bg-card, rgba(0, 0, 0, 0.04))',
            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
            borderRadius: '12px',
          }}
        >
          {[
            { id: 'category', label: 'By Category', Icon: Layers },
            { id: 'section', label: 'By Section', Icon: Building2 },
            { id: 'supplier', label: 'By Supplier', Icon: Truck },
          ].map(({ id, label, Icon }) => {
            const isActive = activeMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveMode(id);
                  setSelectedGroup(null);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: isActive ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: isActive ? '1px solid rgba(225, 29, 72, 0.4)' : '1px solid transparent',
                  background: isActive ? 'rgba(225, 29, 72, 0.12)' : 'transparent',
                  color: isActive ? '#e11d48' : 'var(--text-secondary, #475569)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Chart & Right Ledger */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left: Donut Chart & Legend */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 16px',
            background: 'var(--bg-card, rgba(0, 0, 0, 0.02))',
            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.06))',
            borderRadius: '16px',
          }}
        >
          {/* SVG Donut */}
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 240 240" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              {chartData.map((slice, i) => {
                const d =
                  slice.endAngle - slice.startAngle >= 359.9
                    ? describeDonutArc(120, 120, 95, 62, 0, 359.99)
                    : describeDonutArc(
                        120,
                        120,
                        hoveredSlice?.name === slice.name ? 100 : 95,
                        hoveredSlice?.name === slice.name ? 58 : 62,
                        slice.startAngle,
                        slice.endAngle
                      );

                return (
                  <path
                    key={slice.name || i}
                    d={d}
                    fill={slice.color}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      filter: hoveredSlice?.name === slice.name ? `drop-shadow(0 0 8px ${slice.color})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredSlice(slice)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    onClick={() =>
                      setSelectedGroup(selectedGroup === slice.name ? null : slice.name)
                    }
                  />
                );
              })}
            </svg>

            {/* Central Donut Hole Badge */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                textAlign: 'center',
                padding: '16px',
              }}
            >
              {activeFocus ? (
                <div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted, #64748b)',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeFocus.name}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginTop: '2px' }}>
                    {currencySymbol}{activeFocus.loss.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#e11d48' }}>
                    {activeFocus.percentage}% ({activeFocus.units} units)
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted, #64748b)' }}>
                    Total Loss
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e11d48', marginTop: '2px' }}>
                    {currencySymbol}{totalLoss.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                    {totalUnits} damaged units
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Legend Pills */}
          <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {chartData.map((slice) => {
              const isSelected = selectedGroup === slice.name;
              return (
                <button
                  key={slice.name}
                  type="button"
                  onClick={() => setSelectedGroup(isSelected ? null : slice.name)}
                  onMouseEnter={() => setHoveredSlice(slice)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    border: isSelected ? '1px solid #e11d48' : '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                    background: isSelected ? 'rgba(225, 29, 72, 0.12)' : 'var(--bg-surface, #ffffff)',
                    color: isSelected ? '#e11d48' : 'var(--text-primary, #0f172a)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: slice.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                      {slice.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontWeight: 700 }}>
                    <span>{currencySymbol}{slice.loss.toFixed(0)}</span>
                    <span style={{ fontSize: '0.7rem', color: '#e11d48' }}>({slice.percentage}%)</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedGroup && (
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              style={{
                marginTop: '12px',
                fontSize: '0.74rem',
                color: '#e11d48',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <X size={14} /> Clear filter ({selectedGroup})
            </button>
          )}
        </div>

        {/* Right: Reports Audit Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #64748b)' }}>
                Audit Proof &amp; Fine Ledger
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  background: 'var(--bg-card, rgba(0, 0, 0, 0.05))',
                  color: 'var(--text-secondary, #475569)',
                  border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                }}
              >
                {filteredReports.length} reports
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Filter by item, reason, employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '220px',
                  padding: '6px 12px',
                  background: 'var(--bg-input, var(--bg-surface, #ffffff))',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Ledger Table / List */}
          <div
            style={{
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              borderRadius: '14px',
              overflow: 'hidden',
              background: 'var(--bg-card, rgba(0, 0, 0, 0.02))',
            }}
          >
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filteredReports.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                  No matching broken item reports found.
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.05))',
                      transition: 'background 0.15s ease',
                      background: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    {/* Proof Photo Thumbnail */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {report.proof_image || report.proof_image_url ? (
                        <div
                          onClick={() => setLightboxImage(report.proof_image || report.proof_image_url)}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
                            background: '#0b0e17',
                            cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          <img
                            src={report.proof_image || report.proof_image_url}
                            alt="Damage proof"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                            }}
                          >
                            <ZoomIn size={14} />
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                            background: 'var(--bg-card, rgba(0, 0, 0, 0.04))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted, #64748b)',
                          }}
                        >
                          <Package size={20} />
                        </div>
                      )}
                    </div>

                    {/* Item and Write-off Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {report.item_name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--bg-card, rgba(0, 0, 0, 0.04))',
                            color: 'var(--text-secondary, #475569)',
                            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                          }}
                        >
                          UID: {report.item_uid}
                        </span>
                        {report.is_fined ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 7px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={11} /> Fined: {currencySymbol}{Number(report.fine_amount || report.total_loss).toFixed(2)} ({report.fined_employee_name || 'Staff'})
                          </span>
                        ) : report.is_waived ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 7px',
                              borderRadius: '4px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <ShieldCheck size={11} /> Store Loss (No Fine)
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 7px',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              fontWeight: 600,
                            }}
                          >
                            Unfined
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#e11d48', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {report.reason}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '3px' }}>
                        {report.section_name && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={12} style={{ color: 'var(--text-muted, #64748b)' }} />
                            {report.section_name}
                          </span>
                        )}
                        {report.reported_by_name && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} style={{ color: 'var(--text-muted, #64748b)' }} />
                            Reported by: {report.reported_by_name}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} style={{ color: 'var(--text-muted, #64748b)' }} />
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Financial Loss & Fine Action Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#e11d48' }}>
                          -{currencySymbol}{Number(report.total_loss).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                          {report.quantity} unit{report.quantity > 1 ? 's' : ''} @ {currencySymbol}{Number(report.cost_price).toFixed(2)}
                        </div>
                      </div>

                      {!report.is_fined && !report.is_waived ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() => setFineReportTarget(report)}
                            title="Fine employee cost price via ledger deduction"
                            style={{
                              padding: '4px 9px',
                              borderRadius: '7px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Gavel size={12} /> Fine Employee
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickNoFine(report)}
                            disabled={waivingReportId === report.id}
                            title="No fine to employee — absorb entirely as store operational loss"
                            style={{
                              padding: '4px 9px',
                              borderRadius: '7px',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: '#3b82f6',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: waivingReportId === report.id ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                              opacity: waivingReportId === report.id ? 0.7 : 1,
                            }}
                          >
                            <ShieldCheck size={12} /> {waivingReportId === report.id ? 'Waiving…' : 'No Fine'}
                          </button>
                        </div>
                      ) : report.is_waived ? (
                        <div
                          style={{
                            fontSize: '0.68rem',
                            color: '#3b82f6',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ShieldCheck size={11} /> Store Loss ✓
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: '0.68rem',
                            color: '#10b981',
                            fontWeight: 600,
                          }}
                        >
                          Ledger Posted ✓
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fine Employee Modal */}
      {fineReportTarget && (
        <FineEmployeeModal
          report={fineReportTarget}
          currencySymbol={currencySymbol}
          onClose={() => setFineReportTarget(null)}
          onSuccess={handleFineSuccess}
        />
      )}

      {/* Proof Photo Lightbox Modal */}
      {lightboxImage && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="modal-content glass-panel"
            style={{
              position: 'relative',
              maxWidth: '720px',
              width: '100%',
              background: 'var(--bg-surface-solid, #1e293b)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '18px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ZoomIn size={16} style={{ color: '#f43f5e' }} /> Audit Proof Verification Photo
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px', background: '#0b0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '75vh' }}>
              <img
                src={lightboxImage}
                alt="Enlarged damaged item proof"
                style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
