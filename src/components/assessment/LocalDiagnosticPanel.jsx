/**
 * LocalDiagnosticPanel.jsx
 *
 * Painel de diagnóstico analítico LOCAL — executa o falDiagnosticEngine
 * diretamente no frontend. Exibe resumo executivo, matriz de risco e achados.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { runFullDiagnostic } from '@/components/engine/falDiagnosticEngine';
import FalExecutiveDiagnostic from '@/components/fal/FalExecutiveDiagnostic';
import ClusterRiskMatrix from '@/components/fal/ClusterRiskMatrix';
import SystemicFindingsPanel from '@/components/fal/SystemicFindingsPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Network, AlertTriangle } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.questionSet
 * @param {any=} props.activeDimensions
 */
export default function LocalDiagnosticPanel({ assessmentId, questionSet = [], activeDimensions = null }) {
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['fal-questions-all', assessmentId],
    queryFn: () => base44.entities.FalQuestion.list(),
    enabled: !!assessmentId && questionSet.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['fal-responses', assessmentId],
    queryFn: () => base44.entities.FalResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  const questions = useMemo(() => {
    if (!questionSet?.length || !allQuestions.length) return [];
    const setIds = new Set(questionSet);
    return allQuestions.filter(q => setIds.has(q.id));
  }, [allQuestions, questionSet]);

  const diagnosticResult = useMemo(() => {
    if (!questions.length || !responses.length) return null;
    return runFullDiagnostic({ questions, responses, activeDimensions });
  }, [questions, responses, activeDimensions]);

  if (!questionSet?.length || !responses.length || !diagnosticResult) return null;

  const { clusters = [], system_findings = [] } = diagnosticResult;

  return (
    <div className="border-t pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-700">Diagnóstico Analítico Local</h3>
        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-2 py-0.5">tempo real · escala 0–4</span>
        {system_findings.length > 0 && (
          <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-2 py-0.5 font-semibold flex items-center gap-1">
            <Network className="w-2.5 h-2.5" /> {system_findings.length} achado{system_findings.length > 1 ? 's' : ''} sistêmico{system_findings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <Tabs defaultValue="executive" className="space-y-4">
        <TabsList className="bg-white border shadow-sm h-auto">
          <TabsTrigger value="executive" className="text-xs gap-1.5">
            <Brain className="w-3 h-3" /> Resumo Executivo
          </TabsTrigger>
          <TabsTrigger value="risk_matrix" className="text-xs gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Matriz de Risco
          </TabsTrigger>
          {system_findings.length > 0 && (
            <TabsTrigger value="findings" className="text-xs gap-1.5">
              <Network className="w-3 h-3" /> Achados Sistêmicos
              <span className="bg-orange-100 text-orange-700 text-[9px] rounded-full px-1.5 py-0.5 font-bold ml-0.5">
                {system_findings.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="executive">
          <FalExecutiveDiagnostic
            questions={questions}
            responses={responses}
            activeDimensions={activeDimensions}
          />
        </TabsContent>

        <TabsContent value="risk_matrix">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-800">Matriz de Risco</h4>
              <p className="text-xs text-slate-500 mt-0.5">Risco Inerente × Maturidade (Score). Clique num cluster para detalhes.</p>
            </div>
            <ClusterRiskMatrix clusters={clusters} />
          </div>
        </TabsContent>

        {system_findings.length > 0 && (
          <TabsContent value="findings">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <SystemicFindingsPanel findings={system_findings} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}