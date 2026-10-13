import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import { fetchActiveAIDescriptionJob } from '../api';

export default function AIDescriptionProgressWidget({
  activeStoreId,
  onOpenReview,
  onJobStatusChange
}) {
  const [job, setJob] = useState(null);
  // Default to minimized form on initial startup or page reload
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('ai_widget_minimized');
    return saved !== null ? saved === 'true' : true;
  });
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [networkError, setNetworkError] = useState(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const toggleMinimized = (val) => {
    setIsMinimized(prev => {
      const next = typeof val === 'boolean' ? val : !prev;
      localStorage.setItem('ai_widget_minimized', String(next));
      return next;
    });
  };

  const pollJob = async () => {
    try {
      const data = await fetchActiveAIDescriptionJob(activeStoreId);
      setNetworkError(null);
      if (data && data.active_job) {
        const currentJob = data.active_job;
        setJob(currentJob);
        if (onJobStatusChange) onJobStatusChange(currentJob);

        if (currentJob.status === 'running') {
          setIsVisible(true);
        }
      }
    } catch (err) {
      console.error("Error polling AI description job:", err);
      setNetworkError(err.message || "Failed to reach AI server");
    }
  };

  useEffect(() => {
    let intervalId = null;
    pollJob();
    intervalId = setInterval(pollJob, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeStoreId, onJobStatusChange]);

  useEffect(() => {
    const handleJobStarted = (e) => {
      if (e.detail) {
        setJob(e.detail);
        setIsVisible(true);
        // Keep in minimized form as requested
        toggleMinimized(true);
        setNetworkError(null);
      }
    };

    const handleOpenStudio = (e) => {
      setIsVisible(true);
      if (onOpenReview) {
        onOpenReview(e.detail?.jobId || job?.id || 'active');
      }
    };

    const handleDraftsUpdated = () => {
      setIsVisible(true);
      pollJob();
    };

    window.addEventListener('ai-job-started', handleJobStarted);
    window.addEventListener('open-ai-studio', handleOpenStudio);
    window.addEventListener('ai-drafts-updated', handleDraftsUpdated);
    return () => {
      window.removeEventListener('ai-job-started', handleJobStarted);
      window.removeEventListener('open-ai-studio', handleOpenStudio);
      window.removeEventListener('ai-drafts-updated', handleDraftsUpdated);
    };
  }, [job, onOpenReview]);

  // Handle Dragging
  const handlePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.initialX + dx,
        y: dragStartRef.current.initialY + dy
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  if (!job || !isVisible) return null;

  const total = job.total_items || 0;
  const processed = (job.completed_items || 0) + (job.failed_items || 0) + (job.skipped_items || 0);
  const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : (job.status === 'completed' ? 100 : 0);
  // Job is truly running only if status is running and there are still unfinished items
  const isFinished = (total > 0 && processed >= total) || job.status === 'completed';
  const isRunning = job.status === 'running' && !isFinished;
  const readyCount = job.ready_items !== undefined ? job.ready_items : (job.completed_items || 0);
  const inProgressCount = isRunning ? (job.generating_items !== undefined ? job.generating_items : Math.max(0, total - processed)) : 0;
  const skippedCount = job.skipped_items || 0;
  const failedCount = job.failed_items || 0;
  const hasPendingReview = readyCount > 0;

  return (
    <aside
      role="region"
      aria-label="AI Description Studio Background Progress"
      className="ai-progress-widget-aside"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <div
        className="ai-progress-widget-card"
        style={{
          width: isMinimized ? '300px' : '360px',
          backgroundColor: 'var(--bg-surface-solid)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg, 18px)',
          boxShadow: 'var(--shadow-lg, 0 20px 48px rgba(0, 0, 0, 0.4))',
          color: 'var(--text-primary)',
          padding: isMinimized ? '10px 14px' : '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMinimized ? '0' : '12px',
          transition: 'width 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        {/* Header Bar */}
        <div
          className="ai-progress-header"
          onPointerDown={handlePointerDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'grab',
            borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle)',
            paddingBottom: isMinimized ? '0' : '10px',
          }}
        >
          <div
            className="ai-progress-header-left"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, cursor: isMinimized ? 'pointer' : 'grab' }}
            onClick={() => {
              if (isMinimized) toggleMinimized(false);
            }}
          >
            <div
              className="ai-progress-icon-box"
              style={{
                width: isMinimized ? '28px' : '32px',
                height: isMinimized ? '28px' : '32px',
                borderRadius: 'var(--radius-sm, 8px)',
                background: isRunning
                  ? 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.15))'
                  : hasPendingReview
                  ? 'var(--color-success-bg, rgba(16, 185, 129, 0.15))'
                  : 'var(--bg-surface-hover)',
                border: isRunning
                  ? '1px solid rgba(197, 34, 36, 0.35)'
                  : hasPendingReview
                  ? '1px solid rgba(16, 185, 129, 0.35)'
                  : '1px solid var(--border-subtle)',
                color: isRunning
                  ? 'var(--brand-primary)'
                  : hasPendingReview
                  ? 'var(--color-success)'
                  : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={isMinimized ? 14 : 16} />
            </div>

            <div className="ai-progress-title-wrap" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="ai-progress-title" style={{ fontSize: isMinimized ? '0.82rem' : '0.86rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  AI Studio
                </span>
                {isRunning && (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: 'var(--brand-primary)',
                      boxShadow: '0 0 8px var(--brand-primary)',
                      display: 'inline-block',
                      animation: 'pulse 1.5s infinite',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              <span className="ai-progress-subtitle" style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isRunning
                  ? `Running (${processed}/${total})`
                  : isFinished && total > 0
                  ? `Completed (${processed}/${total})`
                  : hasPendingReview
                  ? `${readyCount} ready`
                  : 'Idle'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ai-progress-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => toggleMinimized()}
              style={{
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
              title={isMinimized ? "Expand AI Studio" : "Minimize"}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              style={{
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
              title="Close widget"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isMinimized && (
          <div className="ai-progress-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Network / API Error Warning */}
            {networkError && (
              <div
                style={{
                  background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '0.74rem',
                  color: 'var(--color-danger, #ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {networkError}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={pollJob}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Real-time Rate Limit / Pause / Daily Quota Banner */}
            {job.status_message && (!isFinished || job.status_message.toLowerCase().includes('daily')) && (
              <div
                style={{
                  background: job.status_message.toLowerCase().includes('daily')
                    ? 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))'
                    : 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.12))',
                  border: job.status_message.toLowerCase().includes('daily')
                    ? '1px solid rgba(245, 158, 11, 0.35)'
                    : '1px solid rgba(197, 34, 36, 0.3)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.72rem',
                  lineHeight: '1.4',
                  color: job.status_message.toLowerCase().includes('daily')
                    ? 'var(--color-warning, #f59e0b)'
                    : 'var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={13} style={{ flexShrink: 0 }} />
                <span>{job.status_message}</span>
              </div>
            )}

            {/* Progress Section or Idle Status */}
            {isRunning ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{percentage}% Completed</span>
                  <span style={{ color: 'var(--brand-primary)' }}>{processed} of {total} Products</span>
                </div>
                <div style={{ width: '100%', height: '7px', background: 'var(--bg-surface-hover)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, var(--brand-primary) 0%, #10B981 100%)',
                      borderRadius: '10px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ) : hasPendingReview ? (
              <div
                style={{
                  background: 'var(--color-success-bg, rgba(16, 185, 129, 0.08))',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary)',
                }}
              >
                <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>
                  <strong>{readyCount} new draft{readyCount > 1 ? 's' : ''}</strong> ready for catalog approval.
                </span>
              </div>
            ) : isFinished && total > 0 ? (
              <div
                style={{
                  background: 'var(--color-success-bg, rgba(16, 185, 129, 0.08))',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary)',
                }}
              >
                <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>Job completed ({processed} of {total} items processed)</span>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)',
                }}
              >
                <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>Catalog is up to date • No job in progress</span>
              </div>
            )}

            {/* Status Breakdown Badges */}
            <div
              className="ai-progress-badge-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isRunning ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
                gap: '6px',
                textAlign: 'center',
              }}
            >
              {isRunning && (
                <div style={{ background: 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.1))', border: '1px solid rgba(197, 34, 36, 0.25)', borderRadius: '10px', padding: '6px 2px' }}>
                  <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: 'var(--brand-primary)', lineHeight: 1.1 }}>{inProgressCount}</span>
                  <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>In Progress</span>
                </div>
              )}
              <div style={{ background: 'var(--color-success-bg, rgba(16, 185, 129, 0.12))', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>{readyCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ready</span>
              </div>
              <div style={{ background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1.1 }}>{skippedCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>No Photo</span>
              </div>
              <div style={{ background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>{failedCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Failed</span>
              </div>
            </div>

            {/* Review & Apply Button */}
            <button
              type="button"
              className="ai-progress-action-btn"
              onClick={() => onOpenReview(job.id)}
              style={{
                width: '100%',
                background: 'var(--brand-primary)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '9px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px var(--brand-ruby-glow, rgba(197, 34, 36, 0.35))',
                transition: 'var(--transition-smooth)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1.0)')}
            >
              <span>
                {isRunning
                  ? 'Open Studio (Live Progress)'
                  : hasPendingReview
                  ? `Review & Apply Drafts (${readyCount})`
                  : 'Open AI Studio'}
              </span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
