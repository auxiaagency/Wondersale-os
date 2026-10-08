import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Camera,
  Upload,
  Eye,
  Check,
  X,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Loader2,
  Tag,
  Building2,
  Flame,
  Award,
  Maximize2,
  ZoomIn,
} from 'lucide-react';
import TimelineRangeSelector from './TimelineRangeSelector';
import {
  fetchEmployeeTasks,
  createEmployeeTask,
  startEmployeeTask,
  submitEmployeeTask,
  verifyEmployeeTask,
  deleteEmployeeTask,
  fetchEmployeeTaskStats,
} from '../api';

// ---- Date & Time Helpers ---------------------------------------------------

function formatLocalInputDateTime(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** End of the ongoing / current date (11:59 PM / 23:59) */
export function getEndOfToday() {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return formatLocalInputDateTime(d);
}

/** End of tomorrow (11:59 PM / 23:59) */
export function getEndOfTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return formatLocalInputDateTime(d);
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatLatenessText(diffMs) {
  if (diffMs <= 0) return '';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMins / 60);
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const remMins = totalMins % 60;

  if (days > 0) {
    return remHours > 0 ? `${days}d ${remHours}h late` : `${days}d late`;
  }
  if (totalHours > 0) {
    return remMins > 0 ? `${totalHours}h ${remMins}m late` : `${totalHours}h late`;
  }
  return `${Math.max(1, remMins)}m late`;
}

export function getTaskLateness(task) {
  if (!task) {
    return { isLate: false, isCompleted: false, label: '', shortLabel: '', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' };
  }

  const isCompleted = task.status === 'verified' || task.status === 'submitted';
  const completionIso = task.submitted_at || (task.status === 'verified' ? task.verified_at : null);

  // If already completed or submitted
  if (isCompleted && completionIso && task.deadline) {
    const compTime = new Date(completionIso).getTime();
    const deadTime = new Date(task.deadline).getTime();
    const diff = compTime - deadTime;

    // Check backend is_on_time flag or timestamp diff
    const isLate = task.is_on_time === false || diff > 60000; // > 1 min threshold
    if (isLate && diff > 0) {
      const lateStr = task.late_duration || formatLatenessText(diff);
      return {
        isLate: true,
        isCompleted: true,
        label: `Completed Late (${lateStr})`,
        shortLabel: lateStr,
        color: '#f97316', // Vibrant orange/amber
        bg: 'rgba(249,115,22,0.14)',
        border: 'rgba(249,115,22,0.35)',
      };
    }
    return {
      isLate: false,
      isCompleted: true,
      label: 'Completed On Time',
      shortLabel: 'On Time',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.14)',
      border: 'rgba(34,197,94,0.32)',
    };
  }

  // If completed but lacks exact submitted_at
  if (task.status === 'verified') {
    if (task.is_on_time === false) {
      const lateStr = task.late_duration || 'Late';
      return {
        isLate: true,
        isCompleted: true,
        label: `Completed Late (${lateStr})`,
        shortLabel: lateStr,
        color: '#f97316',
        bg: 'rgba(249,115,22,0.14)',
        border: 'rgba(249,115,22,0.35)',
      };
    }
    return {
      isLate: false,
      isCompleted: true,
      label: 'Completed On Time',
      shortLabel: 'On Time',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.14)',
      border: 'rgba(34,197,94,0.32)',
    };
  }

  // If still ongoing (pending / in_progress / revision_needed)
  if (task.deadline) {
    const now = new Date().getTime();
    const deadTime = new Date(task.deadline).getTime();
    const overdueDiff = now - deadTime;
    if (overdueDiff > 0) {
      const lateStr = formatLatenessText(overdueDiff);
      return {
        isLate: true,
        isCompleted: false,
        label: `Currently Overdue (${lateStr})`,
        shortLabel: lateStr,
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.14)',
        border: 'rgba(239,68,68,0.35)',
      };
    }
  }

  return {
    isLate: false,
    isCompleted: false,
    label: '',
    shortLabel: '',
    color: 'var(--text-muted)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'var(--border-subtle)',
  };
}

function getDeadlineMeta(deadlineIso, status, task) {
  if (!deadlineIso) return { label: 'No deadline', color: 'var(--text-muted)', isOverdue: false, isNear: false };
  if (status === 'verified' || status === 'submitted') {
    const lateness = getTaskLateness(task || { deadline: deadlineIso, status });
    if (lateness.isLate) {
      return {
        label: `Due: ${formatDateTime(deadlineIso)} • ${lateness.shortLabel}`,
        color: lateness.color,
        isOverdue: false,
        isNear: false,
        isLate: true,
        lateLabel: lateness.shortLabel,
      };
    }
    return {
      label: `Due: ${formatDateTime(deadlineIso)}`,
      color: 'var(--text-muted)',
      isOverdue: false,
      isNear: false,
      isLate: false,
      lateLabel: 'On Time',
    };
  }

  const now = new Date().getTime();
  const deadline = new Date(deadlineIso).getTime();
  const diffMs = deadline - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    const overdueHours = Math.abs(Math.round(diffHours));
    const label = overdueHours < 24 ? `Overdue by ${overdueHours}h` : `Overdue by ${Math.round(overdueHours / 24)}d`;
    return { label, color: '#ef4444', isOverdue: true, isNear: false, isLate: true };
  } else if (diffHours <= 3) {
    const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    const label = mins < 60 ? `${mins}m remaining` : `${Math.floor(mins / 60)}h ${mins % 60}m remaining`;
    return { label, color: '#f59e0b', isOverdue: false, isNear: true, isLate: false };
  } else {
    return { label: `Due: ${formatDateTime(deadlineIso)}`, color: 'var(--text-secondary)', isOverdue: false, isNear: false, isLate: false };
  }
}

const PRIORITY_BADGES = {
  low: { label: 'Low', bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  normal: { label: 'Normal', bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  high: { label: 'High', bg: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  urgent: { label: 'Urgent', bg: 'rgba(239,68,68,0.22)', color: '#ef4444', border: 'rgba(239,68,68,0.4)' },
};

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'rgba(148,163,184,0.12)',
    color: '#94a3b8',
    border: 'rgba(148,163,184,0.25)',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'rgba(6,182,212,0.16)',
    color: '#06b6d4',
    border: 'rgba(6,182,212,0.3)',
  },
  submitted: {
    label: 'Awaiting Verification',
    bg: 'rgba(245,158,11,0.18)',
    color: '#fbbf24',
    border: 'rgba(245,158,11,0.35)',
  },
  verified: {
    label: 'Verified & Closed',
    bg: 'rgba(34,197,94,0.16)',
    color: '#22c55e',
    border: 'rgba(34,197,94,0.3)',
  },
  revision_needed: {
    label: 'Revision Requested',
    bg: 'rgba(244,63,94,0.18)',
    color: '#fb7185',
    border: 'rgba(244,63,94,0.35)',
  },
};

// ---- In-App Delete Confirmation Modal --------------------------------------

function DeleteConfirmModal({ task, onClose, onConfirm, deleting }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%', maxWidth: '440px', borderRadius: '20px',
          background: 'var(--bg-surface, #111827)', border: '1px solid rgba(239,68,68,0.35)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          padding: '26px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(239,68,68,0.16)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trash2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Delete Task
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Permanent administrative removal
            </span>
          </div>
        </div>

        <div style={{
          padding: '12px 14px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
          fontSize: '0.86rem', color: 'var(--text-secondary)',
        }}>
          <div>Task: <b style={{ color: 'var(--text-primary)' }}>{task.title}</b></div>
          <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Assigned to: {task.assigned_to_name} ({task.assigned_to_staff_id})
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Are you sure you want to permanently delete this task? This action cannot be undone and will delete all submissions and audit records.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="btn btn-secondary"
            style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="btn"
            style={{
              padding: '8px 20px', borderRadius: '10px', fontWeight: 700,
              background: '#ef4444', color: '#fff',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
            }}
          >
            {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
            <span>{deleting ? 'Deleting…' : 'Delete Task'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- High-Resolution Photo Lightbox Modal ----------------------------------

function TaskPhotoLightboxModal({ task, onClose, onOpenReview }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!task || !task.proof_image_url) return null;

  const priorityBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.normal;
  const statusBadge = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(5, 8, 16, 0.92)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          position: 'relative',
          maxWidth: '94vw',
          maxHeight: '94vh',
          width: '920px',
          background: 'var(--bg-surface, #111827)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '22px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Submitted Proof
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
              {task.title}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
              background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}`,
            }}>
              {statusBadge.label}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
              background: priorityBadge.bg, color: priorityBadge.color, border: `1px solid ${priorityBadge.border}`,
            }}>
              {priorityBadge.label}
            </span>
            {(() => {
              const lateness = getTaskLateness(task);
              if (task.status === 'verified' || task.status === 'submitted') {
                return (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 800,
                    color: lateness.color, background: lateness.bg, border: `1px solid ${lateness.border}`,
                    padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {lateness.isLate ? (
                      <>
                        <AlertTriangle size={11} />
                        <span>Late by {lateness.shortLabel.replace(' late', '')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={11} />
                        <span>Completed On Time</span>
                      </>
                    )}
                  </span>
                );
              }
              return null;
            })()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={task.proof_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                padding: '6px 12px', fontSize: '0.76rem', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none',
              }}
              title="Open full photo in new tab"
            >
              <ExternalLink size={13} />
              <span>Full View</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: '#fff',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              title="Close lightbox (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image Display Area */}
        <div
          style={{
            flex: 1,
            minHeight: '340px',
            maxHeight: '62vh',
            background: '#070a13',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '14px',
            position: 'relative',
          }}
        >
          <img
            src={task.proof_image_url}
            alt={task.title}
            style={{
              maxWidth: '100%',
              maxHeight: '60vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        </div>

        {/* Bottom Details Footer */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxWidth: '65%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>
                Employee: <b style={{ color: 'var(--text-primary)' }}>{task.assigned_to_name}</b> ({task.assigned_to_staff_id})
              </span>
              <span>•</span>
              <span>Submitted: {formatDateTime(task.submitted_at || task.created_at)}</span>
            </div>
            {task.write_off_notes && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Notes: </span>
                {task.write_off_notes}
              </div>
            )}
            {task.status === 'revision_needed' && task.revision_notes && (
              <div style={{ fontSize: '0.8rem', color: '#fb7185', lineHeight: 1.4 }}>
                <b>Revision Request: </b> {task.revision_notes}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenReview && task.status === 'submitted' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReview(task);
                }}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px', borderRadius: '10px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                }}
              >
                <Eye size={15} />
                <span>Open Verification Desk</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Task Submission Modal (Mandatory Photo Proof & Write-off Notes) --------

function TaskSubmissionModal({ task, onClose, onSuccess }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, WebP).');
      return;
    }
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile && !task.proof_image_url) {
      setError('A mandatory photographic proof image is required to submit this task.');
      return;
    }
    if (!notes.trim()) {
      setError('Please write resolution notes explaining what actions were performed.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      if (photoFile) fd.append('proof_image', photoFile);
      fd.append('write_off_notes', notes.trim());

      const updated = await submitEmployeeTask(task.id, fd);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit task proof.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%', maxWidth: '580px', borderRadius: '20px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                Proof Verification Engine
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Task #{task.id}</span>
            </div>
            <h3 style={{ margin: '3px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Submit Task Completion Proof
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 6, borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Task Info Pill */}
          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            background: 'var(--bg-surface-hover, rgba(255,255,255,0.03))',
            border: '1px solid var(--border-subtle)',
          }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {task.title}
            </h4>
            {task.description && (
              <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {task.description}
              </p>
            )}
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span>Target Deadline: <b style={{ color: 'var(--text-primary)' }}>{formatDateTime(task.deadline)}</b></span>
              {(() => {
                const now = new Date().getTime();
                const deadline = new Date(task.deadline).getTime();
                const diff = now - deadline;
                if (diff > 0) {
                  return (
                    <span style={{ color: '#f97316', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Late Submission ({formatLatenessText(diff)})
                    </span>
                  );
                }
                return (
                  <span style={{ color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> Submitting On Time
                  </span>
                );
              })()}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.15)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.84rem',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Mandatory Photo Proof Input */}
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Camera size={15} style={{ color: '#38bdf8' }} />
              Mandatory Photographic Proof *
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {previewUrl || task.proof_image_url ? (
              <div style={{
                position: 'relative', width: '100%', height: '220px', borderRadius: '14px',
                overflow: 'hidden', border: '2px solid rgba(56,189,248,0.4)',
                background: '#000',
              }}>
                <img
                  src={previewUrl || task.proof_image_url}
                  alt="Proof preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{
                    position: 'absolute', bottom: 10, right: 10,
                    fontSize: '0.78rem', padding: '6px 14px',
                    backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.65)',
                  }}
                >
                  <Camera size={13} style={{ marginRight: 6 }} /> Retake / Replace
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-subtle)', borderRadius: '14px',
                  padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Take photo or choose proof image
                  </span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    JPG, PNG, WebP from mobile camera or workstation file explorer
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Resolution Write-Off Notes */}
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <FileText size={15} style={{ color: '#fbbf24' }} />
              Write-Off Resolution Notes *
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was completed (e.g. Cleaned and restocked section aisle 4, counted 48 units on top shelf)..."
              className="form-control"
              style={{
                width: '100%', borderRadius: '12px', padding: '12px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                fontSize: '0.86rem', resize: 'vertical',
              }}
              required
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Required. Notes are archived in the store audit log alongside the photo proof.
            </span>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!photoFile && !task.proof_image_url) || !notes.trim()}
              className="btn btn-primary"
              style={{
                padding: '8px 22px', borderRadius: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
                opacity: (!photoFile && !task.proof_image_url) || !notes.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
              <span>Submit Proof for Verification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Owner Verification & Audit Lightbox -----------------------------------

function TaskVerificationLightbox({ task, onClose, onVerified, onRequestDelete, onZoomPhoto }) {
  const [actionType, setActionType] = useState(null); // 'approve' | 'revision'
  const [revisionNotes, setRevisionNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setProcessing(true);
    setError('');
    try {
      const updated = await verifyEmployeeTask(task.id, { action: 'approve' });
      onVerified(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to approve task.');
      setProcessing(false);
    }
  };

  const handleRequestRevision = async (e) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      setError('Please provide feedback explaining what needs revision.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const updated = await verifyEmployeeTask(task.id, {
        action: 'revision_needed',
        revision_notes: revisionNotes.trim(),
      });
      onVerified(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to request revision.');
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%', maxWidth: '920px', borderRadius: '22px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 26px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                Owner Verification Desk
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Task #{task.id}</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              {(() => {
                const lateness = getTaskLateness(task);
                return (
                  <span style={{
                    fontSize: '0.74rem', fontWeight: 800,
                    color: lateness.color,
                    background: lateness.bg,
                    border: `1px solid ${lateness.border}`,
                    padding: '2px 9px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {lateness.isLate ? (
                      <>
                        <AlertTriangle size={12} />
                        <span>Submitted Late ({lateness.shortLabel})</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Submitted On Time</span>
                      </>
                    )}
                  </span>
                );
              })()}
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {task.title}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRequestDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestDelete(task);
                }}
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px', fontSize: '0.76rem', color: '#f87171',
                  borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '5px',
                }}
                title="Delete this task"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 6, borderRadius: '8px',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content Split: Left Image Proof, Right Notes & Meta */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 340px',
          gap: '24px', padding: '24px', overflowY: 'auto', flex: 1,
        }}>
          {/* Left: Photo Proof Zoom Container */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Photographic Proof of Completion
            </span>
            <div style={{
              flex: 1, minHeight: '340px', borderRadius: '16px', overflow: 'hidden',
              background: '#090d16', border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {task.proof_image_url ? (
                <>
                  <img
                    src={task.proof_image_url}
                    alt="Proof submission"
                    style={{
                      width: '100%', height: '100%', maxHeight: '440px', objectFit: 'contain',
                      cursor: onZoomPhoto ? 'pointer' : 'default',
                    }}
                    onClick={() => onZoomPhoto?.(task)}
                    title={onZoomPhoto ? 'Click to view full photo in lightbox' : undefined}
                  />
                  {onZoomPhoto && (
                    <button
                      type="button"
                      onClick={() => onZoomPhoto(task)}
                      style={{
                        position: 'absolute', bottom: 12, right: 12,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                        borderRadius: '8px', padding: '5px 12px', fontSize: '0.74rem',
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={13} /> Full Screen
                    </button>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                  <Camera size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No proof photo uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Notes, Timeline & Decision Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Employee Submitter Card */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'var(--bg-surface-hover, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Submitted By
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#c52224',
                  color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, overflow: 'hidden', flexShrink: 0,
                }}>
                  {task.assigned_to_photo ? (
                    <img src={task.assigned_to_photo} alt={task.assigned_to_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    task.assigned_to_name?.[0] || '?'
                  )}
                </div>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {task.assigned_to_name}
                  </h5>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Staff ID: {task.assigned_to_staff_id}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Submitted:</span>
                  <b style={{ color: 'var(--text-primary)' }}>{formatDateTime(task.submitted_at)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target Due:</span>
                  <b style={{ color: 'var(--text-primary)' }}>{formatDateTime(task.deadline)}</b>
                </div>
                {(() => {
                  const lateness = getTaskLateness(task);
                  return (
                    <div style={{
                      marginTop: '4px', padding: '6px 10px', borderRadius: '8px',
                      background: lateness.bg, border: `1px solid ${lateness.border}`, color: lateness.color,
                      fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span>Punctuality Audit:</span>
                      <span>{lateness.isLate ? `⚠️ Late by ${lateness.shortLabel.replace(' late', '')}` : '✓ Completed On Time'}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Write-off Notes Box */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <span style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={13} /> Employee Write-off Notes
              </span>
              <p style={{
                margin: '8px 0 0 0', fontSize: '0.84rem', color: 'var(--text-primary)',
                lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {task.write_off_notes || 'No resolution notes provided.'}
              </p>
            </div>

            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.15)', color: '#f87171',
                fontSize: '0.8rem',
              }}>
                {error}
              </div>
            )}

            {/* Action Buttons: Approve or Request Revision */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionType === 'revision' ? (
                <form onSubmit={handleRequestRevision} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb7185' }}>
                    Reason / Instructions for Revision *
                  </label>
                  <textarea
                    rows={3}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Specify what needs correction (e.g. Photo is blurry, please retake shelf 4)..."
                    className="form-control"
                    style={{
                      width: '100%', borderRadius: '10px', padding: '10px', fontSize: '0.82rem',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(244,63,94,0.4)', color: '#fff',
                    }}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setActionType(null)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing || !revisionNotes.trim()}
                      className="btn"
                      style={{
                        flex: 1, padding: '7px', fontSize: '0.8rem',
                        background: '#e11d48', color: '#fff', fontWeight: 700, borderRadius: '8px',
                      }}
                    >
                      {processing ? <Loader2 size={14} className="spin" /> : 'Send Revision'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setActionType('revision')}
                    disabled={processing}
                    className="btn btn-secondary"
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      borderColor: 'rgba(244,63,94,0.35)', color: '#fb7185',
                    }}
                  >
                    <RotateCcw size={15} /> Request Revision
                  </button>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={processing}
                    className="btn"
                    style={{
                      flex: 1.4, padding: '10px', borderRadius: '10px', fontWeight: 800,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                    }}
                  >
                    {processing ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
                    Verify &amp; Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Owner Task Creator Modal ----------------------------------------------

function CreateTaskModal({ staffMembers = [], stores = [], sections = [], currentUser, onClose, onCreated }) {
  const [assignedTo, setAssignedTo] = useState(staffMembers[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  // Default deadline is 11:59 PM of the ongoing (current) date
  const [deadline, setDeadline] = useState(() => getEndOfToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick preset shortcuts
  const applyPreset = (type, value) => {
    if (type === 'end_of_today') {
      setDeadline(getEndOfToday());
    } else if (type === 'end_of_tomorrow') {
      setDeadline(getEndOfTomorrow());
    } else if (type === 'hours') {
      const d = new Date();
      d.setHours(d.getHours() + value);
      setDeadline(formatLocalInputDateTime(d));
    } else if (type === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + value);
      d.setHours(23, 59, 0, 0);
      setDeadline(formatLocalInputDateTime(d));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedTo) {
      setError('Please select an employee to assign this task.');
      return;
    }
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!deadline) {
      setError('A target completion deadline is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const selectedStaff = staffMembers.find((m) => String(m.id) === String(assignedTo));
      const payload = {
        assigned_to: assignedTo,
        title: title.trim(),
        description: description.trim(),
        priority,
        deadline: new Date(deadline).toISOString(),
        store: selectedStaff?.store || currentUser?.store || stores[0]?.id,
        section: selectedStaff?.section || null,
      };

      const created = await createEmployeeTask(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%', maxWidth: '620px', borderRadius: '22px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-primary, #c52224)', textTransform: 'uppercase' }}>
              Workstation Delegation
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Assign Employee Task
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 6, borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.15)', color: '#f87171',
              fontSize: '0.84rem',
            }}>
              {error}
            </div>
          )}

          {/* Assigned Employee Selection */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Assign To Employee *
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="form-control"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
              }}
              required
            >
              {staffMembers.map((m) => (
                <option key={m.id} value={m.id} style={{ background: '#1e293b', color: '#fff' }}>
                  {m.name} ({m.staff_id}) — {m.role_details?.name || 'Staff'}{m.section_name ? ` • ${m.section_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit Toy Aisle Stock & Clean Display Shelves"
              className="form-control"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Instructions &amp; Requirements (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify requirements, items to check, photo angles required for sign-off..."
              className="form-control"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                fontSize: '0.84rem', resize: 'vertical',
              }}
            />
          </div>

          {/* Priority & Deadline Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="form-control"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                }}
              >
                <option value="low" style={{ background: '#1e293b' }}>Low</option>
                <option value="normal" style={{ background: '#1e293b' }}>Normal</option>
                <option value="high" style={{ background: '#1e293b' }}>High</option>
                <option value="urgent" style={{ background: '#1e293b' }}>Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Deadline Target *
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="form-control"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '10px',
                  background: 'var(--bg-surface-hover, rgba(0,0,0,0.25))',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                }}
                required
              />
            </div>
          </div>

          {/* Deadline Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('end_of_today')}
              className="btn btn-secondary"
              style={{
                padding: '4px 11px', fontSize: '0.74rem', borderRadius: '14px',
                background: deadline === getEndOfToday() ? 'rgba(59,130,246,0.2)' : undefined,
                color: deadline === getEndOfToday() ? '#60a5fa' : undefined,
                borderColor: deadline === getEndOfToday() ? 'rgba(59,130,246,0.4)' : undefined,
                fontWeight: 700,
              }}
            >
              End of Day (Today 11:59 PM)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('end_of_tomorrow')}
              className="btn btn-secondary"
              style={{ padding: '4px 11px', fontSize: '0.74rem', borderRadius: '14px' }}
            >
              Tomorrow (11:59 PM)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hours', 3)}
              className="btn btn-secondary"
              style={{ padding: '4px 11px', fontSize: '0.74rem', borderRadius: '14px' }}
            >
              +3 Hours
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hours', 6)}
              className="btn btn-secondary"
              style={{ padding: '4px 11px', fontSize: '0.74rem', borderRadius: '14px' }}
            >
              +6 Hours
            </button>
            <button
              type="button"
              onClick={() => applyPreset('days', 3)}
              className="btn btn-secondary"
              style={{ padding: '4px 11px', fontSize: '0.74rem', borderRadius: '14px' }}
            >
              +3 Days
            </button>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', borderRadius: '10px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                padding: '8px 22px', borderRadius: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
              <span>Create &amp; Assign Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main Component: TaskVerificationEngine --------------------------------

export default function TaskVerificationEngine({ currentUser, staffMembers = [], stores = [], sections = [] }) {
  const isOwner = currentUser?.role_details?.is_owner || currentUser?.role_details?.can_access_staff;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [timelineRange, setTimelineRange] = useState(null);

  // Modals & Confirmation States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);
  const [verifyingTask, setVerifyingTask] = useState(null);
  const [viewingPhotoTask, setViewingPhotoTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const taskList = await fetchEmployeeTasks();
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Start Task
  const handleStartTask = async (taskId) => {
    try {
      const updated = await startEmployeeTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to start task.');
    }
  };

  // Handle Delete Confirmation Execute
  const handleExecuteDelete = async () => {
    if (!taskToDelete) return;
    const targetId = taskToDelete.id;
    setDeletingId(targetId);
    try {
      await deleteEmployeeTask(targetId);
      setTasks((prev) => prev.filter((t) => t.id !== targetId));
      setTaskToDelete(null);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete task.');
    } finally {
      setDeletingId(null);
    }
  };

  // Get selected employee object if filtered
  const selectedStaffObj = useMemo(() => {
    if (!staffFilter) return null;
    return staffMembers.find((m) => String(m.id) === String(staffFilter)) || null;
  }, [staffFilter, staffMembers]);

  // Check if a task falls within the selected TimelineRange
  const isTaskInTimeline = useCallback((t, range) => {
    if (!range || range.isAllTime || !range.startDate || !range.endDate) return true;
    const toLocalYMD = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return typeof val === 'string' ? val.slice(0, 10) : null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      } catch {
        return typeof val === 'string' ? val.slice(0, 10) : null;
      }
    };

    const start = range.startDate;
    const end = range.endDate;

    const cDate = toLocalYMD(t.created_at);
    const dDate = toLocalYMD(t.deadline);
    const sDate = toLocalYMD(t.submitted_at);
    const vDate = toLocalYMD(t.verified_at);

    const inCreated = cDate && cDate >= start && cDate <= end;
    const inDeadline = dDate && dDate >= start && dDate <= end;
    const inSubmitted = sDate && sDate >= start && sDate <= end;
    const inVerified = vDate && vDate >= start && vDate <= end;

    return Boolean(inCreated || inDeadline || inSubmitted || inVerified);
  }, []);

  // Tasks scoped to active Employee, Priority, and Timeline Range filters
  // This powers the dynamic top 4 metrics cards so they respond immediately
  const scopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Filter by Employee
      if (staffFilter && String(t.assigned_to) !== String(staffFilter)) return false;

      // 2. Filter by Priority
      if (priorityFilter && t.priority !== priorityFilter) return false;

      // 3. Filter by Timeline Range
      if (!isTaskInTimeline(t, timelineRange)) return false;

      return true;
    });
  }, [tasks, staffFilter, priorityFilter, timelineRange, isTaskInTimeline]);

  // Dynamically computed top 4 statistics based on scopedTasks
  const scopedStats = useMemo(() => {
    const total = scopedTasks.length;
    const submitted = scopedTasks.filter((t) => t.status === 'submitted').length;
    const active = scopedTasks.filter((t) => ['pending', 'in_progress'].includes(t.status)).length;
    const verified = scopedTasks.filter((t) => t.status === 'verified').length;
    const revision = scopedTasks.filter((t) => t.status === 'revision_needed').length;

    const evaluated = scopedTasks.filter((t) => t.submitted_at != null);
    const onTimeCount = evaluated.filter((t) => t.is_on_time).length;
    const onTimePct = evaluated.length > 0 ? Math.round((onTimeCount / evaluated.length) * 1000) / 10 : 100;

    return {
      total,
      submitted,
      active,
      verified,
      revision,
      on_time_percentage: onTimePct,
    };
  }, [scopedTasks]);

  // Filtered Tasks for the Card Grid (Status tabs + Text search)
  const filteredTasks = useMemo(() => {
    return scopedTasks.filter((t) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !['pending', 'in_progress'].includes(t.status)) return false;
        if (statusFilter === 'review' && t.status !== 'submitted') return false;
        if (statusFilter === 'done' && t.status !== 'verified') return false;
        if (statusFilter === 'revision' && t.status !== 'revision_needed') return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const titleMatch = t.title?.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        const nameMatch = t.assigned_to_name?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !nameMatch) return false;
      }
      return true;
    });
  }, [scopedTasks, statusFilter, search]);

  // Human-readable active filter subtitle for the top cards
  const scopeSubtitle = useMemo(() => {
    const parts = [];
    if (selectedStaffObj) parts.push(selectedStaffObj.name);
    if (priorityFilter) parts.push(`${priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)} priority`);
    if (timelineRange && !timelineRange.isAllTime && timelineRange.label) parts.push(timelineRange.label);
    return parts.length > 0 ? parts.join(' • ') : null;
  }, [selectedStaffObj, priorityFilter, timelineRange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Row with Title & TimelineRangeSelector */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Workforce Performance &amp; Tasks
          </h3>
          {selectedStaffObj && (
            <span style={{
              fontSize: '0.74rem', padding: '3px 10px', borderRadius: '12px',
              background: 'rgba(56,189,248,0.14)', color: '#38bdf8', fontWeight: 700,
              border: '1px solid rgba(56,189,248,0.3)',
            }}>
              Staff: {selectedStaffObj.name}
            </span>
          )}
          {priorityFilter && (
            <span style={{
              fontSize: '0.74rem', padding: '3px 10px', borderRadius: '12px',
              background: 'rgba(245,158,11,0.14)', color: '#fbbf24', fontWeight: 700,
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              Priority: {priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}
            </span>
          )}
          {timelineRange && !timelineRange.isAllTime && timelineRange.label && (
            <span style={{
              fontSize: '0.74rem', padding: '3px 10px', borderRadius: '12px',
              background: 'rgba(168,85,247,0.14)', color: '#c084fc', fontWeight: 700,
              border: '1px solid rgba(168,85,247,0.3)',
            }}>
              Range: {timelineRange.label}
            </span>
          )}
        </div>

        {/* Global TimelineRangeSelector (No X-Axis, compact) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TimelineRangeSelector
            value={timelineRange || undefined}
            defaultUnit="month"
            defaultCount={1}
            allowAllTime={true}
            compact={true}
            showXAxis={false}
            onChange={(newRange) => setTimelineRange(newRange)}
          />
        </div>
      </div>

      {/* Metrics Banner (Changes reactively when employee, priority, or time range filter changes) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {/* Total Tasks */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Total Tasks</span>
            <CheckSquare size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {scopedStats.total}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {scopeSubtitle ? `Tasks: ${scopeSubtitle}` : 'Workforce assignments'}
          </span>
        </div>

        {/* Awaiting Verification (Highlight) */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px', borderRadius: '16px',
            background: scopedStats.submitted > 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)',
            border: scopedStats.submitted > 0 ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fbbf24' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Awaiting Verification</span>
            <Eye size={18} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', marginTop: '8px' }}>
            {scopedStats.submitted}
          </div>
          <span style={{ fontSize: '0.74rem', color: scopedStats.submitted > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
            {scopedStats.submitted > 0 ? `${scopedStats.submitted} pending approval` : 'Zero backlog'}
          </span>
        </div>

        {/* In Progress / Active */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Active / In Progress</span>
            <Clock size={18} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {scopedStats.active}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {scopeSubtitle ? `Active (${scopeSubtitle})` : 'Employees actively working'}
          </span>
        </div>

        {/* On-Time Completion Rate */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>On-Time Rate</span>
            <Award size={18} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e', marginTop: '8px' }}>
            {scopedStats.on_time_percentage}%
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {scopeSubtitle ? `Punctuality: ${scopeSubtitle}` : 'Completion punctuality'}
          </span>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'var(--bg-surface)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '14px',
        }}>
          {/* Status Tab Filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'review', label: `Needs Review (${scopedTasks.filter((t) => t.status === 'submitted').length})` },
              { id: 'active', label: 'To Do / Active' },
              { id: 'revision', label: `Revisions (${scopedTasks.filter((t) => t.status === 'revision_needed').length})` },
              { id: 'done', label: 'Verified & Closed' },
            ].map(({ id, label }) => {
              const active = statusFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  style={{
                    padding: '6px 14px', borderRadius: '10px', border: 'none',
                    fontSize: '0.82rem', fontWeight: active ? 700 : 500,
                    background: active ? 'var(--brand-primary, #c52224)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Right Action: Create Task (Owner) */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '10px', fontWeight: 700,
              }}
            >
              <Plus size={16} /> Assign New Task
            </button>
          )}
        </div>

        {/* Secondary Filter Row: Search + Priority + Staff */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, descriptions, or employee..."
              className="form-control"
              style={{
                width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.2))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: '8px',
              background: 'var(--bg-surface-hover, rgba(0,0,0,0.2))',
              border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Staff Filter (For Owners) */}
          {isOwner && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                background: 'var(--bg-surface-hover, rgba(0,0,0,0.2))',
                border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="">All Staff Members</option>
              {staffMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.staff_id})
                </option>
              ))}
            </select>
          )}

          {(search || priorityFilter || staffFilter || (timelineRange && !timelineRange.isAllTime)) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPriorityFilter('');
                setStaffFilter('');
                setTimelineRange(null);
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Task Cards Grid */}
      {loading ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--brand-primary, #c52224)' }} />
          <span style={{ fontSize: '0.9rem' }}>Loading task queue…</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '60px 20px', borderRadius: '18px', textAlign: 'center',
            color: 'var(--text-muted)', background: 'var(--bg-surface)',
          }}
        >
          <CheckSquare size={44} style={{ opacity: 0.25, marginBottom: 12 }} />
          <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No tasks found</h4>
          <p style={{ margin: 0, fontSize: '0.84rem' }}>
            {isOwner ? 'Assign a new task to an employee above.' : 'You have no assigned tasks in this view.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '18px',
        }}>
          {filteredTasks.map((task) => {
            const priorityBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.normal;
            const statusBadge = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const deadlineMeta = getDeadlineMeta(task.deadline, task.status, task);
            const lateness = getTaskLateness(task);
            const isAssignedToMe = String(task.assigned_to) === String(currentUser?.id);

            // Determine border and top strip colors reflecting lateness
            let cardBorder = '1px solid var(--border-subtle)';
            let topStripBg = 'var(--border-subtle)';

            if (task.status === 'verified') {
              topStripBg = lateness.isLate ? '#f97316' : '#22c55e';
              cardBorder = lateness.isLate ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(34,197,94,0.35)';
            } else if (task.status === 'submitted') {
              topStripBg = lateness.isLate ? '#ea580c' : '#f59e0b';
              cardBorder = lateness.isLate ? '1px solid rgba(234,88,12,0.45)' : '1px solid rgba(245,158,11,0.35)';
            } else if (task.status === 'revision_needed') {
              topStripBg = '#f43f5e';
              cardBorder = '1px solid rgba(244,63,94,0.35)';
            } else if (deadlineMeta.isOverdue) {
              topStripBg = '#ef4444';
              cardBorder = '1px solid rgba(239,68,68,0.45)';
            }

            return (
              <div
                key={task.id}
                className="glass-panel"
                style={{
                  padding: '20px', borderRadius: '16px', background: 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', gap: '14px',
                  border: cardBorder,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Top Accent Strip */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: topStripBg,
                }} />

                {/* Card Header: Badges & Delete Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Status Badge */}
                    <span style={{
                      padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
                      background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}`,
                    }}>
                      {statusBadge.label}
                    </span>

                    {/* Lateness Tag for Completed / Submitted tasks */}
                    {(task.status === 'verified' || task.status === 'submitted') && (
                      <span style={{
                        padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
                        background: lateness.bg, color: lateness.color, border: `1px solid ${lateness.border}`,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {lateness.isLate ? (
                          <>
                            <AlertTriangle size={11} />
                            <span>Late by {lateness.shortLabel.replace(' late', '')}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={11} />
                            <span>On Time</span>
                          </>
                        )}
                      </span>
                    )}

                    {/* Priority Badge */}
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                      background: priorityBadge.bg, color: priorityBadge.color, border: `1px solid ${priorityBadge.border}`,
                    }}>
                      {priorityBadge.label}
                    </span>
                  </div>

                  {/* Owner Delete Button */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaskToDelete(task);
                      }}
                      style={{
                        width: 30, height: 30, borderRadius: '8px',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)',
                        color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', transition: 'all 0.15s ease',
                      }}
                      title="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Title & Description */}
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p style={{
                      margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Revision Note Banner if applicable */}
                {task.status === 'revision_needed' && task.revision_notes && (
                  <div style={{
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
                    color: '#fb7185', fontSize: '0.78rem',
                  }}>
                    <b>Admin Revision Request:</b> {task.revision_notes}
                  </div>
                )}

                {/* Assigned Employee & Section Row */}
                <div style={{
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--bg-surface-hover, rgba(255,255,255,0.02))',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '0.78rem', color: 'var(--text-secondary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <User size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <b style={{ color: 'var(--text-primary)' }}>{task.assigned_to_name}</b> ({task.assigned_to_staff_id})
                    </span>
                  </div>

                  {task.section_name && (
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '10px',
                      background: 'rgba(99,102,241,0.14)', color: '#818cf8', fontWeight: 600,
                    }}>
                      {task.section_name}
                    </span>
                  )}
                </div>

                {/* Created Time & Deadline Timestamps Row */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                }}>
                  {/* Created Time */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={12} /> Created:
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatDateTime(task.created_at)}
                    </span>
                  </div>

                  {/* Deadline Target */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={12} /> Deadline:
                    </span>
                    <span style={{ color: deadlineMeta.color, fontWeight: 700 }}>
                      {formatDateTime(task.deadline)}
                    </span>
                  </div>

                  {/* Submission Time if available */}
                  {task.submitted_at && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={12} /> Submitted:
                      </span>
                      <span style={{ color: lateness.color, fontWeight: 700 }}>
                        {formatDateTime(task.submitted_at)}
                      </span>
                    </div>
                  )}

                  {/* Urgency countdown indicator or Verified sign with lateness */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
                    fontSize: '0.72rem', fontWeight: 700, paddingTop: '4px',
                    borderTop: '1px dashed var(--border-subtle)', marginTop: '2px',
                  }}>
                    {task.status === 'verified' ? (
                      lateness.isLate ? (
                        <span style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> Verified (Late by {lateness.shortLabel.replace(' late', '')})
                        </span>
                      ) : (
                        <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Verified On Time
                        </span>
                      )
                    ) : task.status === 'submitted' ? (
                      lateness.isLate ? (
                        <span style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> Submitted Late by {lateness.shortLabel.replace(' late', '')}
                        </span>
                      ) : (
                        <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Submitted On Time
                        </span>
                      )
                    ) : (
                      <>
                        {deadlineMeta.isOverdue && <AlertTriangle size={12} style={{ color: '#ef4444' }} />}
                        <span style={{ color: deadlineMeta.color }}>{deadlineMeta.label}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Proof Thumbnail if submitted or verified */}
                {task.proof_image_url && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingPhotoTask(task);
                    }}
                    style={{
                      height: '115px', borderRadius: '12px', overflow: 'hidden',
                      background: '#070a13', border: '1px solid var(--border-subtle)',
                      cursor: 'pointer', position: 'relative',
                    }}
                    title="Click to view full photo proof in lightbox"
                  >
                    <img
                      src={task.proof_image_url}
                      alt="Submitted proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
                      padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', color: '#fff',
                      display: 'flex', alignItems: 'center', gap: '5px',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                      <Eye size={12} /> View Photo
                    </div>
                  </div>
                )}

                {/* Action Buttons based on Role & State */}
                <div style={{
                  marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
                  display: 'flex', gap: '8px',
                }}>
                  {/* For Assigned Employee: */}
                  {isAssignedToMe && task.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleStartTask(task.id)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      Start Task
                    </button>
                  )}

                  {isAssignedToMe && ['pending', 'in_progress', 'revision_needed'].includes(task.status) && (
                    <button
                      type="button"
                      onClick={() => setSubmittingTask(task)}
                      className="btn btn-primary"
                      style={{
                        flex: 1, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <Camera size={14} /> Submit Photo Proof
                    </button>
                  )}

                  {/* For Owner/Manager: Verify Button */}
                  {isOwner && task.status === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => setVerifyingTask(task)}
                      className="btn"
                      style={{
                        flex: 1, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 800,
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#000', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        boxShadow: '0 3px 12px rgba(245,158,11,0.3)',
                      }}
                    >
                      <Eye size={15} /> Review &amp; Verify Proof
                    </button>
                  )}

                  {/* Already Verified Info Pill */}
                  {task.status === 'verified' && (
                    <div style={{
                      flex: 1, textAlign: 'center', padding: '6px', fontSize: '0.74rem',
                      color: lateness.isLate ? '#fb923c' : '#86efac',
                      background: lateness.isLate ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                      border: lateness.isLate ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(34,197,94,0.2)',
                      borderRadius: '8px',
                    }}>
                      Closed by {task.verified_by_name || 'Admin'} • {lateness.isLate ? `Late by ${lateness.shortLabel.replace(' late', '')}` : 'On Time'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Creation Modal (Owner) */}
      {showCreateModal && (
        <CreateTaskModal
          staffMembers={staffMembers}
          stores={stores}
          sections={sections}
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newTask) => {
            setTasks((prev) => [newTask, ...prev]);
            loadData();
          }}
        />
      )}

      {/* Task Submission Modal (Employee) */}
      {submittingTask && (
        <TaskSubmissionModal
          task={submittingTask}
          onClose={() => setSubmittingTask(null)}
          onSuccess={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            loadData();
          }}
        />
      )}

      {/* Verification Lightbox Modal (Owner) */}
      {verifyingTask && (
        <TaskVerificationLightbox
          task={verifyingTask}
          onClose={() => setVerifyingTask(null)}
          onVerified={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            loadData();
          }}
          onRequestDelete={(task) => setTaskToDelete(task)}
          onZoomPhoto={(task) => setViewingPhotoTask(task)}
        />
      )}

      {/* High-Resolution Photo Lightbox Modal (For anyone viewing proof photos) */}
      {viewingPhotoTask && (
        <TaskPhotoLightboxModal
          task={viewingPhotoTask}
          onClose={() => setViewingPhotoTask(null)}
          onOpenReview={(task) => {
            setViewingPhotoTask(null);
            setVerifyingTask(task);
          }}
        />
      )}

      {/* In-App Delete Confirmation Modal (Owner) */}
      {taskToDelete && (
        <DeleteConfirmModal
          task={taskToDelete}
          onClose={() => setTaskToDelete(null)}
          onConfirm={handleExecuteDelete}
          deleting={deletingId === taskToDelete.id}
        />
      )}
    </div>
  );
}
