import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, ChevronRight, Minimize2, Maximize2, Move } from 'lucide-react';
import { fetchActiveAIDescriptionJob } from '../api';

export default function AIDescriptionProgressWidget({
  activeStoreId,
  onOpenReview,
  onJobStatusChange
}) {
  const [job, setJob] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [networkError, setNetworkError] = useState(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

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
        setIsMinimized(false);
        setNetworkError(null);
      }
    };

    const handleOpenStudio = (e) => {
      setIsVisible(true);
      setIsMinimized(false);
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
  const isRunning = job.status === 'running';
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
          width: isMinimized ? '280px' : '360px',
          backgroundColor: 'var(--bg-surface-solid, var(--bg-surface, #141829))',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-strong, rgba(99, 102, 241, 0.35))',
          borderRadius: '18px',
          boxShadow: 'var(--shadow-lg, 0 20px 48px rgba(0, 0, 0, 0.4)), 0 0 24px rgba(99, 102, 241, 0.15)',
          color: 'var(--text-primary, #ffffff)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
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
            borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            paddingBottom: isMinimized ? '0' : '10px',
          }}
        >
          <div className="ai-progress-header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="ai-progress-icon-box"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: isRunning ? 'rgba(99, 102, 241, 0.18)' : (hasPendingReview ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.12)'),
                border: isRunning ? '1px solid rgba(99, 102, 241, 0.45)' : (hasPendingReview ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-subtle)'),
                color: isRunning ? '#6366F1' : (hasPendingReview ? '#10B981' : 'var(--text-secondary)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </div>

            <div className="ai-progress-title-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="ai-progress-title" style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                  AI Description Studio
                </span>
                {isRunning && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#6366F1',
                      boxShadow: '0 0 10px #6366F1',
                      display: 'inline-block',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                )}
              </div>
              <span className="ai-progress-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {isRunning
                  ? `Generating in background (${processed}/${total})`
                  : hasPendingReview
                  ? `${readyCount} draft${readyCount > 1 ? 's' : ''} ready for review`
                  : 'No job in progress'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ai-progress-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.08))',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-secondary, #cbd5e1)',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              style={{
                background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.08))',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-secondary, #cbd5e1)',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
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
                  background: 'rgba(239, 68, 68, 0.12)',
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
            {job.status_message && (
              <div
                style={{
                  background: job.status_message.toLowerCase().includes('daily')
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(99, 102, 241, 0.14)',
                  border: job.status_message.toLowerCase().includes('daily')
                    ? '1px solid rgba(245, 158, 11, 0.35)'
                    : '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.72rem',
                  lineHeight: '1.4',
                  color: job.status_message.toLowerCase().includes('daily')
                    ? '#f59e0b'
                    : '#818cf8',
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
                  <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>{percentage}% Completed</span>
                  <span style={{ color: '#6366F1' }}>{processed} of {total} Products</span>
                </div>
                <div style={{ width: '100%', height: '7px', background: 'var(--bg-card-hover, rgba(125, 125, 125, 0.15))', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 50%, #10B981 100%)',
                      borderRadius: '10px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ) : hasPendingReview ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary, #ffffff)',
                }}
              >
                <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>
                  <strong>{readyCount} new draft{readyCount > 1 ? 's' : ''}</strong> ready for catalog approval.
                </span>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--bg-surface-hover, rgba(125, 125, 125, 0.08))',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary, #94a3b8)',
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
                <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                  <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#a855f7', lineHeight: 1.1 }}>{inProgressCount}</span>
                  <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>In Progress</span>
                </div>
              )}
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>{readyCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Ready</span>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1.1 }}>{skippedCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>No Photo</span>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '6px 2px' }}>
                <span className="ai-badge-num" style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>{failedCount}</span>
                <span className="ai-badge-lbl" style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Failed</span>
              </div>
            </div>

            {/* Review & Apply Button */}
            <button
              type="button"
              className="ai-progress-action-btn"
              onClick={() => onOpenReview(job.id)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
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
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                transition: 'transform 0.15s ease, filter 0.15s ease',
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
