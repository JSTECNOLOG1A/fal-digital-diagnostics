/**
 * MfisPage — Matriz FAL de Interdependência Sistêmica™
 * 4 blocos: painel executivo, grid, ranking, interpretação + drawer de detalhe
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import MfisExecutivePanel from '@/components/mfis/MfisExecutivePanel';
import MfisCrossingGrid from '@/components/mfis/MfisCrossingGrid';
import MfisTensionRanking from '@/components/mfis/MfisTensionRanking';
import MfisInterpretationPanel from '@/components/mfis/MfisInterpretationPanel';
import MfisCrossingDrawer from '@/components/mfis/MfisCrossingDrawer';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/shared/PermissionGuard';

export default function MfisPage() {
  const params = new URLSearchParams(window.location.search);
  const assessmentId = params.get('assessment_id');
  const { user } = useTenant();
  const qc = useQueryClient();

  const [computing, setComputing] = useState(false);
  const [error, setError]         = useState(null);
  const [selectedCrossing, setSelectedCrossing] = useState(null);

  const { data: assessment } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => base44.entities.Assessment.get(assessmentId),
    enabled: !!assessmentId,
  });

  const { data: crossings = [], isLoading: crossingsLoading } = useQuery({
    queryKey: ['mfis-crossings', assessmentId],
    queryFn: () => base44.entities.SystemicCrossingAnalysis.filter(
      { assessment_id: assessmentId }, 'tension_rank', 20
    ),
    enabled: !!assessmentId,
  });

  const { data: dimImpacts = [], isLoading: dimLoading } = useQuery({
    queryKey: ['mfis-dim-impacts', assessmentId],
    queryFn: () => base44.entities.SystemicDimensionImpact.filter(
      { assessment_id: assessmentId }, '-leverage_score', 20
    ),
    enabled: !!assessmentId,
  });

  const isLoading = crossingsLoading || dimLoading;
  const hasCrossings = crossings.length > 0;
  const hasMqeData = crossings.some(c => c.has_mqe_data);

  // Síntese executiva vinda da computação mais recente
  const executiveSummary = crossings.length > 0
    ? buildSummary(crossings, dimImpacts)
    : null;

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    const res = await base44.functions.invoke('computeMfisAnalysis', { assessment_id: assessmentId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      await qc.invalidateQueries({ queryKey: ['mfis-crossings', assessmentId] });
      await qc.invalidateQueries({ queryKey: ['mfis-dim-impacts', assessmentId] });
    }
    setComputing(false);
  };

  const computedAt = crossings[0]?.computed_at
    ? format(new Date(crossings[0].computed_at), 'dd/MM/yyyy HH:mm')
    : null;

  return (
    <PageContainer variant="wide" className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            {assessment && (
              <Link to={createPageUrl(`AssessmentDetail?id=${assessmentId}`)} className="hover:text-slate-600 flex items-center gap-1">
                <Layers className="w-3 h-3" /> {assessment.title}
              </Link>
            )}
            <span>/</span>
            <span>MFIS™</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Matriz FAL de Interdependência Sistêmica™
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Análise das tensões estruturais entre dimensões organizacionais
            {computedAt && <span className="ml-2 text-slate-400">· Calculado em {computedAt}</span>}
          </p>
        </div>
        <PermissionGuard area="diagnosis">
        <Button
          onClick={handleCompute}
          disabled={computing || !assessmentId}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${computing ? 'animate-spin' : ''}`} />
          {computing ? 'Calculando...' : hasCrossings ? 'Recalcular MFIS' : 'Calcular MFIS'}
        </Button>
        </PermissionGuard>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando análise sistêmica...</p>
        </div>
      ) : !hasCrossings ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <Layers className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">MFIS ainda não calculado</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Clique em "Calcular MFIS" para gerar a análise de interdependência sistêmica com base nos scores do diagnóstico.
          </p>
          <PermissionGuard area="diagnosis">
          <Button onClick={handleCompute} disabled={computing || !assessmentId} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <RefreshCw className={`w-4 h-4 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Calculando...' : 'Calcular MFIS'}
          </Button>
          </PermissionGuard>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloco 1 — Painel executivo */}
          <section>
            <MfisExecutivePanel crossings={crossings} dimImpacts={dimImpacts} hasMqeData={hasMqeData} />
          </section>

          {/* Blocos 2 + 3 lado a lado em telas grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bloco 2 — Grid dos cruzamentos */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Mapa de Cruzamentos</h2>
              <MfisCrossingGrid crossings={crossings} onOpenCrossing={setSelectedCrossing} />
            </div>

            {/* Bloco 3 — Ranking */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <MfisTensionRanking crossings={crossings} />
            </div>
          </div>

          {/* Bloco 4 — Interpretação */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Interpretação Consultiva</h2>
            <MfisInterpretationPanel
              executiveSummary={executiveSummary}
              dimImpacts={dimImpacts}
              crossings={crossings}
            />
          </div>
        </div>
      )}

      {/* Drawer de detalhe */}
      {selectedCrossing && (
        <MfisCrossingDrawer
          crossing={selectedCrossing}
          onClose={() => setSelectedCrossing(null)}
        />
      )}
    </PageContainer>
  );
}

// Reconstrói síntese executiva a partir dos dados carregados
function buildSummary(crossings, dimImpacts) {
  const top3 = [...crossings].sort((a, b) => a.cross_score_final - b.cross_score_final).slice(0, 3);
  const leverage = dimImpacts.find(d => d.is_systemic_leverage_point);
  const top3Labels = top3.map(c => c.crossing_label);

  let text = `A análise de interdependência sistêmica indica que as principais tensões da organização se concentram em ${top3Labels.join(', ')}.`;
  if (leverage) {
    text += ` O ponto de alavanca identificado é ${leverage.dimension_label}, sugerindo que intervenções estruturais nesta dimensão tendem a gerar efeito multiplicador sobre os demais sistemas organizacionais.`;
  }
  if (crossings.some(c => (c.dimension_a_key === 'governanca' || c.dimension_b_key === 'governanca') && c.is_fragile)) {
    text += ` Fragilidades na governança e nos controles institucionais estão amplificando desequilíbrios em outras frentes de gestão.`;
  }
  return text;
}