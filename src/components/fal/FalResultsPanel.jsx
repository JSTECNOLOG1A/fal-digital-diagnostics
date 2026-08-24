import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { runFullDiagnostic } from '@/components/engine/falDiagnosticEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, AlertCircle, RefreshCw, Brain, LayoutGrid, TriangleAlert, ScrollText } from 'lucide-react';


import FalNarrativePanel from './FalNarrativePanel';
import ClusterRiskMatrix from './ClusterRiskMatrix';
import SystemicFindingsPanel from './SystemicFindingsPanel';
import FalExecutiveDiagnostic from './FalExecutiveDiagnostic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const LEVEL_STYLE = {
  'Crítico':     'bg-red-100 text-red-700 border-red-200',
  'Básico':      'bg-amber-100 text-amber-700 border-amber-200',
  'Estruturado': 'bg-blue-100 text-blue-700 border-blue-200',
  'Avançado':    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

/**
 * @param {Object} props
 * @param {any=} props.assessment
 */
export default function FalResultsPanel({ assessment }) {
  const assessmentId = assessment?.id;
  const queryClient = useQueryClient();
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);

  const { data: latestSnapshot } = useQuery({
    queryKey: ['fal-snapshot', assessmentId],
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter(
        { assessment_id: assessmentId }, '-computed_at', 1
      );
      return snaps[0] || null;
    },
    enabled: !!assessmentId,
  });

  const { data: allTargetSnapshots = [] } = useQuery({
    queryKey: ['fal-target-snapshots', assessment?.target_id],
    queryFn: async () => {
      if (!assessment?.target_id) return [];
      return base44.entities.FalDiagnosticSnapshot.filter(
        { target_id: assessment.target_id }, 'computed_at', 50
      );
    },
    enabled: !!assessment?.target_id,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['fal-responses', assessmentId],
    queryFn: () => base44.entities.FalResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  // Carregar perguntas do question_set para o motor local
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['fal-questions-all'],
    queryFn: () => base44.entities.FalQuestion.list(),
    enabled: !!assessmentId && (assessment?.question_set?.length > 0),
    staleTime: 10 * 60 * 1000,
  });

  // Filtrar questions pelo question_set do assessment
  const questions = useMemo(() => {
    const qs = assessment?.question_set || [];
    if (!qs.length || !allQuestions.length) return [];
    const setIds = new Set(qs);
    return allQuestions.filter(q => setIds.has(q.id));
  }, [allQuestions, assessment?.question_set]);

  // Rodar motor local para clusters reais, system_findings e executive_summary
  const localResult = useMemo(() => {
    if (!questions.length || !responses.length) return null;
    return runFullDiagnostic({ questions, responses, activeDimensions: assessment?.active_dimensions });
  }, [questions, responses, assessment?.active_dimensions]);

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    const res = await base44.functions.invoke('computeFalDiagnostic', { assessment_id: assessmentId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['fal-snapshot', assessmentId] });
    }
    setComputing(false);
  };

  const questionSet = assessment?.question_set || [];
  const completeness = questionSet.length > 0
    ? Math.round((responses.length / questionSet.length) * 100)
    : 0;

  // clusters e achados do motor local (fonte de verdade para Matriz e Achados)
  const localClusters = localResult?.clusters || [];
  const localFindings = localResult?.system_findings || [];

  return (
    <div className="space-y-6">
      {/* Barra de ação */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Índice FAL de Maturidade Empresarial (IFME™)</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {responses.length} respostas · {completeness}% completo
                {localClusters.length > 0 && ` · ${localClusters.length} clusters analisados`}
              </p>
            </div>
            <Button
              onClick={handleCompute}
              disabled={computing || responses.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {computing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando...</>
                : <><RefreshCw className="w-4 h-4" /> {latestSnapshot ? 'Recalcular Resultados' : 'Calcular Resultados'}</>}
            </Button>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mt-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {latestSnapshot ? (
        <>
          {/* Score geral */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Índice FAL de Maturidade Empresarial (IFME™)</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="text-center sm:text-left">
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-slate-900">{(latestSnapshot.overall_score || 0).toFixed(2)}</p>
                    <p className="text-sm text-slate-400">/ 3.00</p>
                  </div>
                </div>
                <div className="flex-1">
                  <Badge className={`text-sm px-4 py-1.5 ${LEVEL_STYLE[latestSnapshot.overall_level] || 'bg-slate-100 text-slate-600'}`}>
                    {latestSnapshot.overall_level}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-2">
                    Calculado em {new Date(latestSnapshot.computed_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                {localFindings.length > 0 && (
                  <div className="flex-shrink-0 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <p className="text-xl font-bold text-orange-700">{localFindings.length}</p>
                    <p className="text-[10px] text-orange-600">Achados Sistêmicos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs analíticas */}
          <Tabs defaultValue="executive" className="space-y-4">
            <TabsList className="bg-slate-50 border border-slate-200 shadow-sm flex-wrap h-auto gap-0.5 p-1 rounded-xl">
              <TabsTrigger value="executive" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                <Brain className="w-3.5 h-3.5" /> Resumo Executivo
              </TabsTrigger>
              <TabsTrigger value="risk_matrix" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                <LayoutGrid className="w-3.5 h-3.5" /> Matriz FAL™
              </TabsTrigger>
              <TabsTrigger value="findings" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                <TriangleAlert className="w-3.5 h-3.5" />
                Achados Sistêmicos
                {localFindings.length > 0 && (
                  <span className="ml-1 bg-orange-100 text-orange-700 text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                    {localFindings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="narrative" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                <ScrollText className="w-3.5 h-3.5" /> Narrativa FAL™
              </TabsTrigger>
            </TabsList>

            {/* Resumo Executivo (motor local) */}
            <TabsContent value="executive">
              {localResult ? (
                <FalExecutiveDiagnostic
                  questions={questions}
                  responses={responses}
                  activeDimensions={assessment?.active_dimensions}
                />
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aguardando perguntas carregadas para resumo executivo em tempo real.</p>
                </div>
              )}
            </TabsContent>

            {/* Matriz de Risco — usa clusters do motor local */}
            <TabsContent value="risk_matrix">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Matriz FAL de Interdependência Sistêmica™</CardTitle>
                  <p className="text-xs text-slate-500">Risco Inerente × Maturidade — clique em um cluster para ver o diagnóstico detalhado</p>
                  <p className="text-xs text-slate-500 mt-1">Clique em um cluster para ver diagnóstico detalhado.</p>
                </CardHeader>
                <CardContent className="pt-2">
                  {localClusters.length > 0 ? (
                    <ClusterRiskMatrix clusters={localClusters} />
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-sm">Aguardando carregamento do motor local para exibir a matriz.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Achados Sistêmicos — usa system_findings do motor local */}
            <TabsContent value="findings">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  {localFindings.length > 0 ? (
                    <SystemicFindingsPanel findings={localFindings} />
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm">
                        {localResult
                          ? 'Nenhum achado sistêmico identificado neste diagnóstico.'
                          : 'Aguardando carregamento do motor local.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Narrativa */}
            <TabsContent value="narrative">
              <FalNarrativePanel snapshot={latestSnapshot} activeDimensions={assessment?.active_dimensions} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum resultado calculado ainda.</p>
          <p className="text-xs mt-1">Responda as perguntas no Diagnóstico e clique em "Gerar diagnóstico completo".</p>
        </div>
      )}
    </div>
  );
}