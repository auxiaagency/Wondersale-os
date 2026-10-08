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
  }

  handleReset = () => {
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
              {this.props.title || 'Component Error'}
            </h2>

            <p style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary, #94a3b8)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}>
              {this.props.message || 'An unexpected rendering error occurred in this module. The rest of the system remains functional.'}
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
                Reload Module
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
