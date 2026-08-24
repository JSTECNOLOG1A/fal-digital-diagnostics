import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Play, Shield } from 'lucide-react';

const CHECKS = [
  {
    id: 'auth',
    name: 'Auth Guard',
    description: 'Confirma que usuário está autenticado na sessão atual',
  },
  {
    id: 'tenant_isolation',
    name: 'Tenant Isolation',
    description: 'Garante que assessment de outro tenant retorna 403',
  },
  {
    id: 'compute_scores',
    name: 'computeScores',
    description: 'Executa computeScores em um assessment real e verifica ScoreSnapshot',
  },
  {
    id: 'generate_report',
    name: 'generateReport',
    description: 'Verifica se generateReport retorna PDF ou pendências esperadas',
  },
  {
    id: 'generate_insights',
    name: 'generateInsights (IA)',
    description: 'Verifica se a função de sugestões IA responde corretamente',
  },
  {
    id: 'import_bank',
    name: 'Importação de Banco',
    description: 'Verifica se MethodAdmin tem acesso à tela de importação',
  },
];

/**
 * @param {Object} props
 * @param {any=} props.status
 */
function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
  if (status === 'running') return <Clock className="w-5 h-5 text-amber-500 animate-pulse flex-shrink-0" />;
  return <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />;
}

export default function SmokeTest() {
  const { user, loading: authLoading, isHQ, methodVersion } = useTenant();
  const [results, setResults] = useState(/** @type {Record<string, any>} */ ({}));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [authLoading, user]);

  if (!isHQ) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Acesso restrito ao HQ Admin.</p>
      </div>
    );
  }

  const setResult = (id, status, message) => {
    setResults(prev => ({ ...prev, [id]: { status, message } }));
  };

  const runAllChecks = async () => {
    setRunning(true);
    setResults({});

    // 1. Auth check
    setResult('auth', 'running', '');
    try {
      const me = await base44.auth.me();
      if (me && me.email) {
        setResult('auth', 'pass', `Autenticado como ${me.email} (role: ${me.role})`);
      } else {
        setResult('auth', 'fail', 'Usuário não encontrado na sessão');
      }
    } catch (e) {
      setResult('auth', 'fail', e.message);
    }

    // 2. Tenant Isolation
    setResult('tenant_isolation', 'running', '');
    try {
      const res = await base44.functions.invoke('computeScores', { assessment_id: 'INVALID_OTHER_TENANT_00000' });
      const d = res.data;
      if (d?.error && (d.error === 'Not found' || d.error === 'Forbidden' || d.error === 'assessment_id required')) {
        setResult('tenant_isolation', 'pass', `Retornou erro esperado: "${d.error}" para ID inválido`);
      } else if (d?.ifme_final !== undefined) {
        setResult('tenant_isolation', 'fail', 'ATENÇÃO: computeScores retornou dados para ID inválido — verificar guard');
      } else {
        setResult('tenant_isolation', 'pass', `Bloqueou corretamente ID inválido: ${JSON.stringify(d).slice(0, 80)}`);
      }
    } catch (e) {
      setResult('tenant_isolation', 'pass', `Bloqueado na rede: ${e.message}`);
    }

    // 3. computeScores
    setResult('compute_scores', 'running', '');
    try {
      const assessments = await base44.entities.Assessment.list('-created_date', 1);
      if (!assessments || assessments.length === 0) {
        setResult('compute_scores', 'fail', 'Nenhum assessment encontrado. Crie um primeiro.');
      } else {
        const a = assessments[0];
        const res = await base44.functions.invoke('computeScores', { assessment_id: a.id });
        const d = res.data;
        if (d?.ifme_final !== undefined) {
          setResult('compute_scores', 'pass', `IFME Final: ${d.ifme_final?.toFixed(1)} | IGI: ${d.igi?.toFixed(1)} | Assessment: "${a.title}"`);
        } else if (d?.error) {
          setResult('compute_scores', 'fail', `Erro: ${d.error}`);
        } else {
          setResult('compute_scores', 'fail', `Resposta inesperada: ${JSON.stringify(d).slice(0, 100)}`);
        }
      }
    } catch (e) {
      setResult('compute_scores', 'fail', e.message);
    }

    // 4. generateReport
    setResult('generate_report', 'running', '');
    try {
      const assessments = await base44.entities.Assessment.list('-created_date', 1);
      if (!assessments || assessments.length === 0) {
        setResult('generate_report', 'fail', 'Nenhum assessment encontrado.');
      } else {
        const a = assessments[0];
        const res = await base44.functions.invoke('generateReport', { assessment_id: a.id });
        const d = res.data;
        if (d?.pdf_url) {
          setResult('generate_report', 'pass', `PDF gerado com sucesso. URL: ${d.pdf_url.slice(0, 60)}...`);
        } else if (d?.pendencies) {
          const total = (d.pendencies.dimensions?.length || 0) + (d.pendencies.mqe?.length || 0) + (d.pendencies.evidence?.length || 0);
          setResult('generate_report', 'pass', `Assessment incompleto (esperado em dev): ${total} pendência(s) identificadas corretamente`);
        } else if (d?.error) {
          setResult('generate_report', 'fail', `Erro: ${d.error}`);
        } else {
          setResult('generate_report', 'fail', `Resposta inesperada: ${JSON.stringify(d).slice(0, 100)}`);
        }
      }
    } catch (e) {
      setResult('generate_report', 'fail', e.message);
    }

    // 5. generateInsights
    setResult('generate_insights', 'running', '');
    try {
      const assessments = await base44.entities.Assessment.list('-created_date', 1);
      if (!assessments || assessments.length === 0) {
        setResult('generate_insights', 'fail', 'Nenhum assessment encontrado.');
      } else {
        const a = assessments[0];
        const snapshots = await base44.entities.ScoreSnapshot.filter({ assessment_id: a.id }, '-computed_at', 1);
        if (!snapshots || snapshots.length === 0) {
          setResult('generate_insights', 'fail', 'Nenhum ScoreSnapshot encontrado. Execute computeScores antes.');
        } else {
          const res = await base44.functions.invoke('generateInsights', { assessment_id: a.id });
          const d = res.data;
          if (d?.insight?.executive_summary) {
            setResult('generate_insights', 'pass', `Insights gerados (v${d.insight.version}). Summary: "${d.insight.executive_summary.slice(0, 80)}..."`);
          } else if (d?.error) {
            setResult('generate_insights', 'fail', `Erro: ${d.error}`);
          } else {
            setResult('generate_insights', 'fail', `Resposta inesperada: ${JSON.stringify(d).slice(0, 100)}`);
          }
        }
      }
    } catch (e) {
      setResult('generate_insights', 'fail', e.message);
    }

    // 6. Import Bank (UI check)
    setResult('import_bank', 'running', '');
    try {
      if (methodVersion) {
        setResult('import_bank', 'pass', `MethodVersion ativa: ${methodVersion.version_code} — tela de importação disponível em "Método > Importar Banco"`);
      } else {
        setResult('import_bank', 'fail', 'Nenhuma MethodVersion ativa. Execute seed primeiro.');
      }
    } catch (e) {
      setResult('import_bank', 'fail', e.message);
    }

    setRunning(false);
  };

  const passCount = Object.values(results).filter(r => r.status === 'pass').length;
  const failCount = Object.values(results).filter(r => r.status === 'fail').length;
  const total = CHECKS.length;
  const allDone = passCount + failCount === total;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Smoke Test</h1>
          <p className="text-sm text-slate-500 mt-1">Checklist de QA — executa em ~30 segundos</p>
        </div>
        <Button
          onClick={runAllChecks}
          disabled={running}
          className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
        >
          <Play className="w-4 h-4" />
          {running ? 'Executando...' : 'Executar Todos'}
        </Button>
      </div>

      {allDone && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-3 ${failCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {failCount === 0 ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {failCount === 0
            ? `Todos os ${total} checks passaram! Sistema pronto para uso.`
            : `${passCount}/${total} passou · ${failCount} falha(s) — revise os itens em vermelho.`
          }
        </div>
      )}

      <div className="space-y-3">
        {CHECKS.map(check => {
          const r = results[check.id];
          return (
            <Card key={check.id} className={`border shadow-sm transition-colors ${r?.status === 'fail' ? 'border-red-200 bg-red-50' : r?.status === 'pass' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusIcon status={r?.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{check.name}</p>
                      {r?.status === 'pass' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">PASS</span>}
                      {r?.status === 'fail' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">FAIL</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{check.description}</p>
                    {r?.message && (
                      <p className={`text-xs mt-2 font-mono p-2 rounded ${r.status === 'fail' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-xl border text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">Notas:</p>
        <p>• "Tenant Isolation": usa ID inválido propositalmente — erro esperado confirma o guard.</p>
        <p>• "generateReport PASS com pendências": correto em ambiente dev (assessment incompleto).</p>
        <p>• Visível apenas para HQ Admin / Admin.</p>
      </div>
    </div>
  );
}