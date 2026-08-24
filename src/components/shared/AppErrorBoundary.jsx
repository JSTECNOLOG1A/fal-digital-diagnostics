import React from 'react';
import { base44 } from '@/api/base44Client';

const currentVersion = 'FAL-v2.62';
const createCorrelationId = () => `FAL-${crypto.randomUUID?.() || Date.now().toString(36).toUpperCase()}`;

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { correlationId: null, bundleStatus: '' };
  }

  static getDerivedStateFromError() {
    return { correlationId: createCorrelationId() };
  }

  componentDidCatch() {
    this.createBundle();
  }

  createBundle = async () => {
    const { correlationId } = this.state;
    if (!correlationId) return;
    this.setState({ bundleStatus: 'Registrando ocorrência...' });
    try {
      await base44.functions.invoke('createSupportBundle', {
        correlation_id: correlationId,
        context: { route: window.location.pathname, version: currentVersion },
      });
      this.setState({ bundleStatus: 'Ocorrência registrada para consulta.' });
    } catch {
      this.setState({ bundleStatus: 'Não foi possível registrar agora; o código continua disponível.' });
    }
  };

  render() {
    if (this.state.correlationId) {
      return <main className="min-h-screen flex items-center justify-center p-6 fal-page"><section className="fal-card max-w-md p-6 text-center"><h1 className="fal-title text-lg">Não foi possível abrir esta tela</h1><p className="fal-muted mt-2 text-sm">Atualize a página. Se o problema continuar, informe este código ao suporte.</p><p className="mt-4 font-mono text-sm" style={{ color: 'var(--fal-danger-text)' }}>{this.state.correlationId}</p><p className="fal-muted mt-3 text-xs">{this.state.bundleStatus}</p><div className="mt-5 flex justify-center gap-3"><button className="fal-btn-secondary" onClick={this.createBundle}>Gerar suporte</button><button className="fal-btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button></div></section></main>;
    }
    return this.props.children;
  }
}