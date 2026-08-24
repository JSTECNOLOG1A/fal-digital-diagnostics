import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Upload, FileText, ArrowRight, BarChart2 } from 'lucide-react';
import ImportFalCSVPanel from '@/components/method/ImportFalCSVPanel';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import ExecutiveKPIs from '@/components/dashboard/ExecutiveKPIs';
import PageContainer from '@/components/layout/PageContainer';

function currentCompetence() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildCompetenceOptions() {
  const options = [];
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push(val);
  }
  return options;
}

export default function Dashboard() {
  // Layout guarantees loading/error handled upstream — tenantId is always valid here
  const { user, tenant, isHQ, tenantId, methodVersion } = useTenant();
  const [showImportFal, setShowImportFal] = useState(false);
  const [competence, setCompetence] = useState(currentCompetence());

  const tenantFilter = tenantId ? { tenant_id: tenantId } : null;

  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ['assessments-dash', tenantId],
    queryFn: () => base44.entities.Assessment.filter({ tenant_id: tenantId }, '-created_date', 200),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  // Snapshots recentes para KPIs executivos — adia até assessments carregar
  const { data: recentSnaps = [], isLoading: loadingSnaps } = useQuery({
    queryKey: ['dash-snaps-kpi', tenantId],
    queryFn: () => base44.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId }, '-computed_at', 5
    ),
    enabled: !!tenantId && !loadingAssessments,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  const competenceOptions = buildCompetenceOptions();

  // Assessments na competência selecionada
  const compAssessments = assessments.filter((a) => a.competence === competence);
  const publishedInComp = compAssessments.filter((a) => a.status === 'published');
  const draftInComp = compAssessments.filter((a) => a.status === 'draft' || a.status === 'in_progress');

  // Stale nodes: assessments com status não published há mais de 90 dias
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const stale = assessments.filter((a) =>
  a.status !== 'published' && a.status !== 'archived' &&
  a.created_date && new Date(a.created_date) < ninetyDaysAgo
  );

  // Recent assessments (last 5)
  const recent = [...assessments].sort((a, b) =>
  new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
  ).slice(0, 5);

  const { data: recentDiagnoses = [], isLoading: loadingDiagnoses } = useQuery({
    queryKey: ['fin-diagnoses-dash', tenantId],
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ tenant_id: tenantId }, '-created_date', 5),
    enabled: !!tenantId && !loadingAssessments,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  // Apenas a query crítica bloqueia o render — KPIs e diagnósticos carregam em background
  const loading = loadingAssessments;

  return (
    <PageContainer variant="wide" className="py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold fal-title">
            Olá, {user?.full_name?.split(' ')[0] || 'Consultor'}
          </h1>
          

          
        </div>
        <div className="flex gap-2 items-center">
          {isHQ &&
          <Button variant="outline" onClick={() => setShowImportFal((v) => !v)} className="gap-2 hidden">
              <Upload className="w-4 h-4" /> Importar FAL CSV
            </Button>
          }
          <Link to={createPageUrl('Assessments')}>
            <Button className="text-white gap-2" style={{ background: 'var(--fal-green-700)' }}>
              <Plus className="w-4 h-4" /> Novo Assessment
            </Button>
          </Link>
        </div>
      </div>

      {/* Competence Selector */}
      














      

      {loading ?
      <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div> :

      <div className="space-y-6">
          {/* Executive KPIs */}
          <ExecutiveKPIs snapshots={recentSnaps} loading={loading} />

          {/* Stats para a competência */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            












          

            












          

            <Card className="fal-card col-span-2 lg:col-span-1 hidden">
              










            
            </Card>
          </div>

          {/* Recent financial diagnoses */}
          {recentDiagnoses.length > 0 &&
        <Card className="fal-card">
              <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fal-border-subtle)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--fal-text-primary)' }}>Diagnósticos Financeiros Recentes</h2>
                <Link to={createPageUrl('Groups')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--fal-green-600)' }}>
                  Ver grupos <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <CardContent className="pt-0 p-0">
                <div className="divide-y" style={{ borderColor: 'var(--fal-border-subtle)' }}>
                  {recentDiagnoses.map((d) => {
                const statusClass = {
                  draft: 'fal-badge-neutral', uploaded: 'fal-badge-current',
                  validating: 'fal-badge-warning', validated: 'fal-badge-current',
                  processing: 'fal-badge-current', processed: 'fal-badge-success',
                  reviewed: 'fal-badge-success', approved: 'fal-badge-success'
                };
                const statusLabels = {
                  draft: 'Rascunho', uploaded: 'Enviado', validating: 'Validando',
                  validated: 'Validado', processing: 'Processando', processed: 'Processado',
                  reviewed: 'Revisado', approved: 'Aprovado'
                };
                return (
                  <Link
                    key={d.id}
                    to={createPageUrl(`FinancialDiagnosisDetail?id=${d.id}`)}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--fal-bg-muted)]">
                    
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg fal-icon-info flex items-center justify-center flex-shrink-0">
                            <BarChart2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--fal-text-primary)' }}>{d.title}</p>
                            <p className="text-xs fal-muted">
                              {d.sector && <span>{d.sector} · </span>}
                              {d.created_date ? format(new Date(d.created_date), 'dd/MM/yyyy') : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`fal-badge ${statusClass[d.status] || 'fal-badge-neutral'}`}>
                            {statusLabels[d.status] || d.status}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--fal-border-medium)' }} />
                        </div>
                      </Link>);

              })}
                </div>
              </CardContent>
            </Card>
        }

          {/* Recent assessments */}
          <Card className="fal-card">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fal-border-subtle)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--fal-text-primary)' }}>Assessments Recentes</h2>
              <Link to={createPageUrl('Assessments')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--fal-green-600)' }}>
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <CardContent className="pt-0 p-0">
              {recent.length === 0 ?
            <div className="text-center py-12">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--fal-border-medium)' }} />
                  <p className="text-sm fal-muted">Nenhum assessment ainda</p>
                  <Link to={createPageUrl('Assessments')}>
                    <Button size="sm" className="mt-3 text-white gap-1" style={{ background: 'var(--fal-green-700)' }}>
                      <Plus className="w-3.5 h-3.5" /> Criar primeiro
                    </Button>
                  </Link>
                </div> :

            <div className="divide-y" style={{ borderColor: 'var(--fal-border-subtle)' }}>
                  {recent.map((a) =>
              <Link
                key={a.id}
                to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--fal-bg-muted)]">
                
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg fal-icon-neutral flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--fal-text-primary)' }}>{a.title}</p>
                          <p className="text-xs fal-muted">
                            {a.competence && <span className="font-mono">{a.competence}</span>}
                            {a.competence && ' · '}
                            {a.created_date ? format(new Date(a.created_date), 'dd/MM/yyyy') : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={a.status} />
                        <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--fal-border-medium)' }} />
                      </div>
                    </Link>
              )}
                </div>
            }
            </CardContent>
          </Card>
        </div>
      }

      {isHQ && showImportFal &&
      <div className="mt-6">
          <ImportFalCSVPanel />
        </div>
      }

      {isHQ && !methodVersion &&
      <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 font-medium mb-3">Nenhuma versão do método encontrada. Inicialize o seed.</p>
          <SeedButton />
        </div>
      }
    </PageContainer>);

}

function SeedButton() {
  const [seeding, setSeeding] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const handleSeed = async () => {
    setSeeding(true);
    const response = await base44.functions.invoke('seedMethodData', {});
    setResult(response.data);
    setSeeding(false);
    window.location.reload();
  };

  return (
    <div>
      <Button onClick={handleSeed} disabled={seeding} className="bg-amber-600 hover:bg-amber-700 text-white">
        {seeding ? 'Inicializando...' : 'Inicializar Método FAL v1.0'}
      </Button>
      {result &&
      <p className="text-xs text-amber-700 mt-2">
          ✓ {result.questions_created} perguntas, {result.mqe_questions_created} MQE, {result.checklist_items_created} checklist items
        </p>
      }
    </div>);

}