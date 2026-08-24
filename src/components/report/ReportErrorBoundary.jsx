import React from 'react';

export default class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, section: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ReportErrorBoundary] Crash in report section:', error, info);
    this.setState({ section: info?.componentStack?.split('\n')[1] || null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 64px', fontFamily: 'system-ui, sans-serif',
          background: '#fff9f9', border: '2px solid #fecaca',
          borderRadius: 12, margin: '16px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', margin: '0 0 8px' }}>
                Erro ao renderizar seção do relatório
              </p>
              <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 8 }}>
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
              {this.state.section && (
                <pre style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 600 }}>
                  {this.state.section}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}