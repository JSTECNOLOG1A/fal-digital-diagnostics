import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import {
  LOCAL_TEST_AUTH_ENABLED,
  LOCAL_TEST_CREDENTIALS,
} from '@/lib/localTestAuth';
import {
  Rocket,
  Play,
  ShieldCheck,
  Terminal,
  LayoutDashboard,
  Building2,
  Copy,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Cable,
} from 'lucide-react';

const RELEASES = [
  {
    id: 'v2.62',
    title: 'RC-1 · Release candidata v2.62',
    status: 'candidata',
    summary: 'Gate verify:rc1, onboarding, support bundle e manifesto de go-live.',
    command: 'npm run verify:rc1',
  },
  {
    id: 'phase5',
    title: 'FASE 5 · Product readiness',
    status: 'validada',
    summary: 'Rotas, LGPD, observabilidade, cockpit e superfície de produção.',
    command: 'npm run test:phase5',
  },
  {
    id: 'phase4',
    title: 'FASE 4 · Action plan & reports',
    status: 'validada',
    summary: 'Plano de ação, review lifecycle, PDF e oficialidade de relatório.',
    command: 'npm run test:phase4',
  },
  {
    id: 'phase3',
    title: 'FASE 3 · Financeiro canônico',
    status: 'validada',
    summary: 'Demonstrações, indicadores, DFC, snapshot e lifecycle financeiro.',
    command: 'npm run test:phase3',
  },
];

const CLI_LAUNCHES = [
  {
    id: 'dev',
    title: 'Dev local (offline)',
    description: 'Sobe o Vite sem proxy Base44.',
    command: 'npm run dev',
  },
  {
    id: 'smoke',
    title: 'Smoke local',
    description: 'Valida auth, tenants seed e CRUD offline.',
    command: 'npm run smoke:local',
  },
  {
    id: 'verify',
    title: 'Verify (gate oficial)',
    description: 'Audits + fases + lint/typecheck/build.',
    command: 'npm run verify',
  },
  {
    id: 'validate',
    title: 'Validação completa',
    description: 'Runner estendido com smoke + suítes principais.',
    command: 'npm run validate:full',
  },
];

function statusTone(status) {
  if (status === 'pass') return { color: 'var(--fal-success-text)', bg: 'var(--fal-success-bg)' };
  if (status === 'fail') return { color: 'var(--fal-danger-text)', bg: 'var(--fal-danger-bg)' };
  return { color: 'var(--fal-text-muted)', bg: 'var(--fal-bg-soft)' };
}

export default function SystemLaunches() {
  const { tenant, isHQ } = useTenant();
  const [copied, setCopied] = useState('');
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [smokeResults, setSmokeResults] = useState([]);

  const appLinks = useMemo(
    () => [
      { title: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
      { title: 'Tenants', page: 'Tenants', icon: Building2 },
      { title: 'Integrações', page: 'Integrations', icon: Cable },
      { title: 'Smoke Test', page: 'SmokeTest', icon: ShieldCheck },
      { title: 'Configurações', page: 'SystemSettings', icon: Rocket },
    ],
    []
  );

  const copyCommand = async (command) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  };

  const runInAppSmoke = async () => {
    setSmokeRunning(true);
    const results = [];

    const push = (name, ok, detail = '') => {
      results.push({ name, ok, detail });
      setSmokeResults([...results]);
    };

    try {
      const me = await base44.auth.me();
      push('Sessão autenticada', !!me?.email, me?.email || '');

      const tenants = await base44.entities.Tenant.filter({ active: true }, 'name', 50);
      push('Tenants disponíveis', tenants.length > 0, `${tenants.length} ativo(s)`);

      const methods = await base44.entities.MethodVersion.filter({ status: 'active' });
      push('MethodVersion ativa', methods.length > 0, methods[0]?.name || methods[0]?.version_code || '');

      if (tenant?.id) {
        const groups = await base44.entities.Group.filter({ tenant_id: tenant.id });
        push('Grupos do tenant', true, `${groups.length} grupo(s)`);
      } else {
        push('Tenant selecionado', false, 'Selecione um tenant no seletor');
      }

      const probe = await base44.functions.invoke('localLaunchProbe', { source: 'SystemLaunches' });
      push('Functions stub/local', !!probe?.data, probe?.data?.message || 'ok');
    } catch (error) {
      push('Smoke in-app', false, error?.message || 'falha inesperada');
    } finally {
      setSmokeRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide fal-muted">Operação do sistema</p>
        <h1 className="fal-title text-2xl flex items-center gap-2">
          <Rocket className="w-6 h-6" style={{ color: 'var(--fal-green-400)' }} />
          Lançamentos
        </h1>
        <p className="fal-muted text-sm">
          Atalhos e rotinas para iniciar, validar e acompanhar releases do Método FAL dentro do sistema.
        </p>
      </header>

      {LOCAL_TEST_AUTH_ENABLED ? (
        <section className="fal-card p-5 space-y-3">
          <h2 className="fal-title text-lg">Modo local (Base44 desconectado)</h2>
          <p className="fal-muted text-sm">
            Use estas credenciais no login local. Os dados ficam em memória neste browser.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="fal-muted text-xs mb-1">E-mail</p>
              <p className="font-mono">{LOCAL_TEST_CREDENTIALS.email}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="fal-muted text-xs mb-1">Senha</p>
              <p className="font-mono">{LOCAL_TEST_CREDENTIALS.password}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="fal-title text-lg">Abrir no sistema</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {appLinks.map((item) => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className="fal-card p-4 hover:border-[var(--fal-green-400)] transition-colors"
            >
              <item.icon className="w-5 h-5 mb-3" style={{ color: 'var(--fal-green-400)' }} />
              <p className="font-medium text-sm">{item.title}</p>
              <p className="fal-muted text-xs mt-1 flex items-center gap-1">
                Abrir <ExternalLink className="w-3 h-3" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="fal-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="fal-title text-lg">Smoke in-app</h2>
            <p className="fal-muted text-sm">Executa checagens rápidas na sessão atual.</p>
          </div>
          <button
            type="button"
            className="fal-btn-primary inline-flex items-center gap-2"
            onClick={runInAppSmoke}
            disabled={smokeRunning}
          >
            <Play className="w-4 h-4" />
            {smokeRunning ? 'Executando…' : 'Rodar smoke'}
          </button>
        </div>

        {smokeResults.length > 0 ? (
          <div className="space-y-2">
            {smokeResults.map((result) => {
              const tone = statusTone(result.ok ? 'pass' : 'fail');
              return (
                <div
                  key={result.name}
                  className="flex items-start gap-3 rounded-md border px-3 py-2"
                  style={{ background: tone.bg }}
                >
                  {result.ok ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: tone.color }} />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5" style={{ color: tone.color }} />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: tone.color }}>{result.name}</p>
                    {result.detail ? <p className="text-xs fal-muted">{result.detail}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="fal-title text-lg">Comandos de lançamento</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {CLI_LAUNCHES.map((item) => (
            <div key={item.id} className="fal-card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Terminal className="w-4 h-4 mt-1" style={{ color: 'var(--fal-green-400)' }} />
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="fal-muted text-xs mt-1">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs rounded-md border px-2 py-1.5 font-mono bg-white overflow-x-auto">
                  {item.command}
                </code>
                <button
                  type="button"
                  className="fal-btn-secondary px-2 py-1.5"
                  onClick={() => copyCommand(item.command)}
                  title="Copiar"
                >
                  {copied === item.command ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="fal-title text-lg">Releases do produto</h2>
        <div className="space-y-3">
          {RELEASES.map((release) => (
            <div key={release.id} className="fal-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{release.title}</p>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border fal-muted">
                    {release.status}
                  </span>
                </div>
                <p className="fal-muted text-xs">{release.summary}</p>
              </div>
              <button
                type="button"
                className="fal-btn-secondary inline-flex items-center gap-2 text-xs"
                onClick={() => copyCommand(release.command)}
              >
                <Copy className="w-3.5 h-3.5" />
                {copied === release.command ? 'Copiado' : 'Copiar comando'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {!isHQ ? (
        <p className="text-xs fal-muted">Algumas rotas administrativas exigem perfil HQ.</p>
      ) : null}
    </div>
  );
}
