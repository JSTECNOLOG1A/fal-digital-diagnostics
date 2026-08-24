import React, { useState } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw, LayoutDashboard, AlertTriangle, Trophy, Map as MapIcon, Target, TrendingUp, CheckSquare, Zap } from 'lucide-react';

import PortfolioStats from '@/components/cockpit/PortfolioStats';
import AlertsPanel from '@/components/cockpit/AlertsPanel';
import CriticalClustersPanel from '@/components/cockpit/CriticalClustersPanel';
import RecentDiagnosticsPanel from '@/components/cockpit/RecentDiagnosticsPanel';
import PortfolioRiskMap from '@/components/cockpit/PortfolioRiskMap';
import PortfolioRankingPanel from '@/components/cockpit/PortfolioRankingPanel';
import { Card, CardContent } from '@/components/ui/card';
import PortfolioKpiTable from '@/components/cockpit/PortfolioKpiTable';
import PortfolioEvolutionPanel from '@/components/cockpit/PortfolioEvolutionPanel';
import ActionPlanCockpitPanel from '@/components/cockpit/ActionPlanCockpitPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ConsultantCockpit() {
  const { user, tenant, tenantId } = useTenant();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

  // Para a aba de plano de ação: buscar assessments publicados da carteira
  const { data: publishedAssessments = [] } = useQuery({
    queryKey: ['cockpit-published-assessments', tenantId],
    queryFn: () => base44.entities.Assessment.filter(
      { tenant_id: tenantId, status: 'published' }, '-updated_date', 30
    ),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000
  });

  // Buscar plano de ação do assessment selecionado
  const { data: actionPlanData } = useQuery({
    queryKey: ['cockpit-action-plan', selectedAssessmentId],
    queryFn: async () => {
      if (!selectedAssessmentId) return null;
      const plans = await base44.entities.ActionPlan.filter(
        { assessment_id: selectedAssessmentId }, '-generated_at', 1
      );
      if (!plans[0]) return null;
      const tasks = await base44.entities.ActionTask.filter(
        { plan_id: plans[0].id }, '-priority', 100
      );
      return { plan: plans[0], tasks };
    },
    enabled: !!selectedAssessmentId,
    staleTime: 2 * 60 * 1000
  });

  const { data: portfolio, isLoading: loadingPortfolio } = useQuery({
    queryKey: ['cockpit-portfolio', tenantId, refreshKey],
    queryFn: () => base44.functions.invoke('computeConsultantPortfolio', {
      consultant_id: user?.email,
      tenant_id: tenantId
    }).then((r) => r.data),
    enabled: !!tenantId || !!user,
    staleTime: 2 * 60 * 1000
  });

  const { data: alertsData, isLoading: loadingAlerts } = useQuery({
    queryKey: ['cockpit-alerts', tenantId, refreshKey],
    queryFn: () => base44.functions.invoke('generateConsultantAlerts', {
      tenant_id: tenantId
    }).then((r) => r.data),
    enabled: !!tenantId || !!user,
    staleTime: 5 * 60 * 1000
  });

  const { data: benchmarkData, isLoading: loadingBenchmark } = useQuery({
    queryKey: ['cockpit-benchmark', tenantId, refreshKey],
    queryFn: () => base44.functions.invoke('computePortfolioBenchmark', {
      tenant_id: tenantId
    }).then((r) => r.data),
    enabled: !!tenantId || !!user,
    staleTime: 5 * 60 * 1000
  });

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <PageContainer variant="wide" className="py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Cockpit do Consultor</h1>
          </div>
          

          
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="gap-2 self-start sm:self-auto">
          
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Portfolio Stats */}
      {loadingPortfolio ?
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div> :

      <div className="mb-6">
          <PortfolioStats data={portfolio} />
        </div>
      }

      {/* Portfolio KPIs executivos */}
      {!loadingBenchmark && benchmarkData?.rankings?.length > 0 &&
      <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">KPIs da Carteira</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
          {
            icon: Target,
            bg: 'bg-blue-50', color: 'text-blue-600',
            label: 'Maturidade Média',
            value: benchmarkData.portfolio_avg ?
            `${Math.round(Object.values(benchmarkData.portfolio_avg).reduce((a, b) => a + b, 0) / Object.values(benchmarkData.portfolio_avg).length / 3 * 100)}%` :
            '—'
          },
          {
            icon: AlertTriangle,
            bg: 'bg-red-50', color: 'text-red-500',
            label: 'Total Críticos',
            value: benchmarkData.rankings.reduce((acc, r) => acc + (r.critical_clusters || 0), 0)
          },
          {
            icon: TrendingUp,
            bg: 'bg-emerald-50', color: 'text-emerald-600',
            label: 'Clientes Monitorados',
            value: benchmarkData.total_clients ?? benchmarkData.rankings.length
          },
          {
            icon: CheckSquare,
            bg: 'bg-violet-50', color: 'text-violet-600',
            label: 'Assessments Totais',
            value: benchmarkData.rankings.reduce((acc, r) => acc + (r.assessment_count || 0), 0)
          }].
          map(({ icon: Icon, bg, color, label, value }) =>
          <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-2xl font-bold text-slate-900">{value}</p>
                    </div>
                    <div className={`p-2 rounded-xl ${bg} flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
          )}
          </div>
        </div>
      }

      {/* Alerts row */}
      <div className="mb-6">
        <AlertsPanel alerts={alertsData?.alerts || []} loading={loadingAlerts} />
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="kpis" className="space-y-4">
        <TabsList className="bg-white border shadow-sm flex-wrap h-auto">
          <TabsTrigger value="kpis" className="gap-1.5">
            <Target className="w-3.5 h-3.5" /> Painel KPI
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Riscos Críticos
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="riskmap" className="gap-1.5">
            <MapIcon className="w-3.5 h-3.5" /> Mapa de Risco
          </TabsTrigger>
          <TabsTrigger value="evolution" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Evolução
          </TabsTrigger>
          <TabsTrigger value="action_plan" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Plano de Ação
          </TabsTrigger>
        </TabsList>

        {/* KPI Table Tab */}
        <TabsContent value="kpis">
          {loadingBenchmark ?
          <Skeleton className="h-64 rounded-xl" /> :

          <PortfolioKpiTable rankings={benchmarkData?.rankings || []} />
          }
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid lg:grid-cols-2 gap-6">
            <RecentDiagnosticsPanel
              assessments={portfolio?.recent_assessments || []} />
            
            <CriticalClustersPanel
              clusters={portfolio?.top_critical_clusters || []} />
            
          </div>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks">
          <div className="space-y-6">
            <CriticalClustersPanel
              clusters={portfolio?.top_critical_clusters || []} />
            
          </div>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking">
          {loadingBenchmark ?
          <Skeleton className="h-64 rounded-xl" /> :

          <PortfolioRankingPanel rankings={benchmarkData?.rankings || []} />
          }
        </TabsContent>

        {/* Risk Map Tab */}
        <TabsContent value="riskmap">
          {loadingBenchmark ?
          <Skeleton className="h-64 rounded-xl" /> :

          <PortfolioRiskMap rankings={benchmarkData?.rankings || []} />
          }
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution">
          {loadingBenchmark ?
          <Skeleton className="h-64 rounded-xl" /> :

          <PortfolioEvolutionPanel rankings={benchmarkData?.rankings || []} />
          }
        </TabsContent>

        {/* Action Plan Tab */}
        <TabsContent value="action_plan">
          <div className="space-y-4">
            {/* Seletor de assessment */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Plano de Ação por Diagnóstico</p>
                    <p className="text-xs text-slate-500 mt-0.5">Selecione um assessment publicado para visualizar as ações geradas.</p>
                  </div>
                  <div className="sm:ml-auto">
                    <Select value={selectedAssessmentId || ''} onValueChange={setSelectedAssessmentId}>
                      <SelectTrigger className="w-64 bg-white">
                        <SelectValue placeholder="Selecionar assessment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {publishedAssessments.map((a) =>
                        <SelectItem key={a.id} value={a.id}>
                            {a.display_name || a.title}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Painel de ações */}
            {selectedAssessmentId && actionPlanData?.tasks ?
            <ActionPlanCockpitPanel
              actions={actionPlanData.tasks.map((t) => ({
                cluster_key: t.cluster_key || t.id,
                cluster_label: t.cluster_key?.replace(/_cluster$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || t.title,
                dimension_key: t.dimension_key,
                dimension_label: t.dimension_key,
                priority: t.priority,
                priority_label: t.priority,
                priority_score: t.priority_score || 0,
                action_title: t.title,
                action_description: t.description,
                expected_impact: t.impact_score ? `Score de impacto: ${t.impact_score}` : null,
                implementation_complexity: t.action_type,
                suggested_deadline: t.horizon || '90d'
              }))} /> :

            selectedAssessmentId ?
            <div className="text-center py-12 text-slate-400">
                <Skeleton className="h-32 rounded-xl" />
              </div> :
            null}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>);

}