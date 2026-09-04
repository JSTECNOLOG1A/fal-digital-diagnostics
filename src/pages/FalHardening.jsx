/**
 * FalHardening — Painel de Qualidade e Hardening Técnico FAL
 * Rota: /FalHardening (admin only)
 */

import React, { useState } from 'react';
import { useTenant } from '@/components/shared/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck, FlaskConical, AlertTriangle, CheckCircle2, XCircle,
  Loader2, RefreshCw, ClipboardList, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { adminService } from '@/components/shared/falService';

/**
 * @param {Object} props
 * @param {any=} props.severity
 */
function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-100 text-red-700 border-red-300',
    error:    'bg-red-50 text-red-600 border-red-200',
    high:     'bg-orange-100 text-orange-700 border-orange-300',
    warning:  'bg-amber-50 text-amber-700 border-amber-200',
    medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
    low:      'bg-blue-50 text-blue-600 border-blue-200',
    fixed:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${map[severity] || 'bg-slate-100 text-slate-600'}`}>
      {severity}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.count
 * @param {any=} props.children
 * @param {any=} props.defaultOpen
 */
function CollapsibleSection({ title, icon: SectionIcon, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SectionIcon className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function FalHardening() {
  const { user } = useTenant();
  const perms = usePermissions();

  const [report,        setReport]        = useState(null);
  const [testResults,   setTestResults]   = useState(null);
  const [integrityData, setIntegrityData] = useState(null);

  const [loadingReport,    setLoadingReport]    = useState(false);
  const [loadingTests,     setLoadingTests]     = useState(false);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);

  const isAdmin = perms.isHQ;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const runReport = async () => {
    setLoadingReport(true);
    const res = await adminService.getHardeningReport();
    setReport(res.data);
    setLoadingReport(false);
  };

  const runTests = async (suite = 'all') => {
    setLoadingTests(true);
    const res = await adminService.runTestSuite(suite);
    setTestResults(res.data);
    setLoadingTests(false);
  };

  const runIntegrity = async () => {
    setLoadingIntegrity(true);
    const res = await adminService.runIntegrityCheck();
    setIntegrityData(res.data);
    setLoadingIntegrity(false);
  };

  const health = report?.health;
  const healthColor = !health ? 'text-slate-400'
    : health.score >= 90 ? 'text-emerald-600'
    : health.score >= 75 ? 'text-blue-600'
    : health.score >= 60 ? 'text-yellow-600'
    : 'text-red-600';

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            FAL Hardening & Quality
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Suite de testes automatizados, validação de integridade e relatório de qualidade
          </p>
        </div>
        <Button onClick={runReport} disabled={loadingReport} className="gap-2 bg-blue-600 hover:bg-blue-700">
          {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          Gerar Relatório
        </Button>
      </div>

      {/* Health score card */}
      {report && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm">Health Score</p>
                <p className={`text-5xl font-black mt-1 ${healthColor.replace('text-', 'text-')}`} style={{ color: health.score >= 90 ? '#34d399' : health.score >= 75 ? '#60a5fa' : health.score >= 60 ? '#fbbf24' : '#f87171' }}>
                  {health.score}
                  <span className="text-xl text-slate-400 font-normal">/100</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-white">{health.label}</span>
                <p className="text-slate-400 text-xs mt-1">{report.hardening_date}</p>
              </div>
            </div>
            <Progress value={health.score} className="h-2 bg-slate-700" />
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-400">{report.statistics.fixes_applied}</p>
                <p className="text-xs text-slate-400">Correções</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{report.statistics.improvements_applied}</p>
                <p className="text-xs text-slate-400">Melhorias</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{report.statistics.remaining_risks}</p>
                <p className="text-xs text-slate-400">Riscos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <FlaskConical className="w-8 h-8 text-blue-500 mb-2" />
            <h3 className="font-semibold text-slate-800 text-sm">Test Suite</h3>
            <p className="text-xs text-slate-500 mb-3">40+ testes unitários e de regressão</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => runTests('all')} disabled={loadingTests} className="flex-1 text-xs">
                {loadingTests ? <Loader2 className="w-3 h-3 animate-spin" /> : 'All'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => runTests('regression')} disabled={loadingTests} className="flex-1 text-xs">
                Regressão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2" />
            <h3 className="font-semibold text-slate-800 text-sm">Integrity Check</h3>
            <p className="text-xs text-slate-500 mb-3">Perguntas, ações, tenant isolation</p>
            <Button size="sm" variant="outline" onClick={runIntegrity} disabled={loadingIntegrity} className="w-full text-xs">
              {loadingIntegrity ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" /> Executar</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <ClipboardList className="w-8 h-8 text-indigo-500 mb-2" />
            <h3 className="font-semibold text-slate-800 text-sm">Hardening Report</h3>
            <p className="text-xs text-slate-500 mb-3">Relatório completo + recomendações</p>
            <Button size="sm" variant="outline" onClick={runReport} disabled={loadingReport} className="w-full text-xs">
              {loadingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Gerar'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Test results */}
      {testResults && (
        <Card className={`border ${testResults.ok ? 'border-emerald-200' : 'border-red-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {testResults.ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <XCircle className="w-4 h-4 text-red-500" />}
              Test Suite — {testResults.summary?.passed}/{testResults.summary?.total} passed
              <span className="text-xs text-slate-400 font-normal ml-1">({testResults.summary?.elapsed_ms}ms)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.suites?.map((suite, i) => (
                <div key={i} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">{suite.suite}</span>
                    <span className={`text-xs font-bold ${suite.failed === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {suite.passed}/{suite.total}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {suite.results?.filter(r => !r.passed).map((r, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                        <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="font-medium">{r.test}</span>
                        {r.error && <span className="text-red-500 ml-1">— {r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integrity results */}
      {integrityData && (
        <Card className={`border ${integrityData.healthy ? 'border-emerald-200' : 'border-red-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {integrityData.healthy
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <AlertTriangle className="w-4 h-4 text-red-500" />}
              Integrity Check — {integrityData.healthy ? 'Sistema íntegro' : 'Problemas encontrados'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm mb-3 flex-wrap">
              {[
                { label: 'Críticos', val: integrityData.summary?.criticals, color: 'text-red-700' },
                { label: 'Erros', val: integrityData.summary?.errors, color: 'text-orange-700' },
                { label: 'Avisos', val: integrityData.summary?.warnings, color: 'text-amber-700' },
              ].map(i => (
                <span key={i.label} className={`font-semibold ${i.color}`}>
                  {i.label}: {i.val || 0}
                </span>
              ))}
            </div>
            {integrityData.issues?.length > 0 && (
              <div className="space-y-1">
                {integrityData.issues.slice(0, 15).map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 bg-slate-50 rounded border border-slate-100">
                    <SeverityBadge severity={issue.severity} />
                    <span className="text-slate-700">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
            {integrityData.info?.map((msg, i) => (
              <p key={i} className="text-[11px] text-slate-400 mt-1">{msg}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fixes applied */}
      {report?.fixes_applied && (
        <CollapsibleSection title="Correções Aplicadas" icon={CheckCircle2} count={report.fixes_applied.length} defaultOpen>
          <div className="space-y-2">
            {report.fixes_applied.map(fix => (
              <div key={fix.id} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <SeverityBadge severity={fix.severity} />
                  <SeverityBadge severity={fix.status} />
                  <span className="text-xs font-mono text-slate-400">{fix.id}</span>
                  <span className="text-xs font-semibold text-slate-700 flex-1">{fix.title}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 ml-0">{fix.description}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {fix.files?.map(f => (
                    <span key={f} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Remaining risks */}
      {report?.remaining_risks && (
        <CollapsibleSection title="Riscos Remanescentes" icon={AlertTriangle} count={report.remaining_risks.length}>
          <div className="space-y-2">
            {report.remaining_risks.map(risk => (
              <div key={risk.id} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-1">
                  <SeverityBadge severity={risk.severity} />
                  <span className="text-xs font-mono text-slate-400">{risk.id}</span>
                  <span className="text-xs font-semibold text-slate-700 flex-1">{risk.title}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">esforço: {risk.effort}</span>
                </div>
                <p className="text-xs text-slate-500">{risk.description}</p>
                {risk.mitigation && (
                  <p className="text-xs text-blue-600 mt-1 flex items-start gap-1">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {risk.mitigation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Recommendations */}
      {report?.recommendations && (
        <CollapsibleSection title="Recomendações Prioritárias" icon={ClipboardList} count={report.recommendations.length}>
          <div className="space-y-2">
            {report.recommendations.map(rec => (
              <div key={rec.priority} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {rec.priority}
                </span>
                <div>
                  <p className="text-sm font-semibold text-blue-800">{rec.action}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{rec.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}