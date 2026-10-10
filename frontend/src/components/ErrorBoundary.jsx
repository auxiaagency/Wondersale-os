import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary caught exception]:', error, errorInfo);

    // If it's a dynamic import failure (e.g. after a new deployment), reload page once
    const errorMsg = error?.message || (typeof error === 'string' ? error : '');
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Failed to fetch dynamically imported module/i.test(errorMsg) ||
      /error loading dynamically imported module/i.test(errorMsg) ||
      /Importing a module script failed/i.test(errorMsg);

    if (isChunkError) {
      const reloadKey = 'chunk_reload_auto_' + (window.location.pathname + window.location.hash);
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    const errorMsg = this.state.error?.message || (typeof this.state.error === 'string' ? this.state.error : '');
    const isChunkError =
      this.state.error?.name === 'ChunkLoadError' ||
      /Failed to fetch dynamically imported module/i.test(errorMsg) ||
      /error loading dynamically imported module/i.test(errorMsg) ||
      /Importing a module script failed/i.test(errorMsg);

    if (isChunkError) {
      // Chunk file is missing on the server, regular setState won't fix it — full page reload is required
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMsg = this.state.error?.message || (typeof this.state.error === 'string' ? this.state.error : '');
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(errorMsg) ||
        /error loading dynamically imported module/i.test(errorMsg) ||
        /Importing a module script failed/i.test(errorMsg);

      return (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          background: 'var(--bg-page, #0f172a)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            borderRadius: 'var(--radius-lg, 16px)',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text-primary, #f8fafc)',
              margin: '0 0 8px',
            }}>
              {isChunkError ? 'New Version Available' : (this.props.title || 'Component Error')}
            </h2>

            <p style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary, #94a3b8)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}>
              {isChunkError
                ? 'A new system update was deployed or your connection was interrupted. Please reload to load the latest module.'
                : (this.props.message || 'An unexpected rendering error occurred in this module. The rest of the system remains functional.')}
            </p>

            {this.state.error && (
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '24px',
                textAlign: 'left',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono, monospace)',
                color: '#f87171',
                overflowX: 'auto',
                maxHeight: '120px',
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} />
                {isChunkError ? 'Update & Reload' : 'Reload Module'}
              </button>

              {this.props.onHome && (
                <button
                  onClick={this.props.onHome}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Home size={15} />
                  App Launcher
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
