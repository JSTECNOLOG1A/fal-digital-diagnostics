/**
 * MfisEmbedded — versão inline da análise MFIS para a tab do AssessmentDetail
 * Mesma lógica do MfisPage mas sem header/page wrapper
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Layers, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import MfisExecutivePanel from './MfisExecutivePanel';
import MfisCrossingGrid from './MfisCrossingGrid';
import MfisTensionRanking from './MfisTensionRanking';
import MfisInterpretationPanel from './MfisInterpretationPanel';
import MfisCrossingDrawer from './MfisCrossingDrawer';

function buildSummary(crossings, dimImpacts) {
  const top3 = [...crossings].sort((a, b) => a.cross_score_final - b.cross_score_final).slice(0, 3);
  const leverage = dimImpacts.find(d => d.is_systemic_leverage_point);
  const top3Labels = top3.map(c => c.crossing_label);
  let text = `A análise de interdependência sistêmica indica que as principais tensões da organização se concentram em ${top3Labels.join(', ')}.`;
  if (leverage) {
    text += ` O ponto de alavanca identificado é ${leverage.dimension_label}, sugerindo que intervenções estruturais nesta dimensão tendem a gerar efeito multiplicador sobre os demais sistemas organizacionais.`;
  }
  return text;
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 */
export default function MfisEmbedded({ assessmentId }) {
  const qc = useQueryClient();
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCrossing, setSelectedCrossing] = useState(null);

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

  // Verifica MQE diretamente nas respostas do banco (não depende do campo has_mqe_data dos registros antigos)
  const { data: mqeResponses = [] } = useQuery({
    queryKey: ['mqe-responses-count', assessmentId],
    queryFn: () => base44.entities.MQEResponse.filter({ assessment_id: assessmentId }, '-created_date', 10),
    enabled: !!assessmentId,
    staleTime: 2 * 60_000,
  });
  const hasMqeData = mqeResponses.length > 0;
  const executiveSummary = hasCrossings ? buildSummary(crossings, dimImpacts) : null;
  const computedAt = crossings[0]?.computed_at
    ? format(new Date(crossings[0].computed_at), 'dd/MM/yyyy HH:mm')
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

  return (
    <div className="space-y-5">
      {/* Header MFIS */}
      <div className="mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800">MFIS™ — Matriz FAL de Interdependência Sistêmica</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-slate-400 hover:text-slate-600">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                O MFIS mapeia as <strong>tensões estruturais entre pares de dimensões</strong> organizacionais. Combina os scores do IFME™ com os dados do MQE™ para identificar onde estão as rupturas sistêmicas e qual dimensão tem maior poder de alavanca sobre as demais.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Análise de interdependência sistêmica entre dimensões
          {computedAt && <span className="ml-1 text-slate-400">· {computedAt}</span>}
        </p>
      </div>

      {/* Subheader actions */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <Link
            to={createPageUrl(`MfisPage?assessment_id=${assessmentId}`)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir em tela cheia
          </Link>
          <Button
            size="sm"
            onClick={handleCompute}
            disabled={computing || !assessmentId}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Calculando...' : hasCrossings ? 'Recalcular' : 'Calcular MFIS'}
          </Button>
        </div>
      </div>

      {/* Aviso análise preliminar — sem dados MQE */}
      {hasCrossings && !hasMqeData && (
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Análise sistêmica preliminar</p>
            <p className="text-xs text-amber-700 mt-0.5">Baseada apenas nos scores dimensionais. Responda o MQE™ na aba correspondente para refinar a análise com dados de interdependência direta.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando análise sistêmica...</p>
        </div>
      ) : !hasCrossings ? (
        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-2xl">
          <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-700 mb-2">MFIS ainda não calculado</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
            Clique em "Calcular MFIS" para gerar a análise de interdependência sistêmica com base nos scores do diagnóstico.
          </p>
          <Button onClick={handleCompute} disabled={computing || !assessmentId} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <RefreshCw className={`w-4 h-4 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Calculando...' : 'Calcular MFIS'}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <MfisExecutivePanel crossings={crossings} dimImpacts={dimImpacts} hasMqeData={hasMqeData} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Mapa de Cruzamentos</h2>
              <MfisCrossingGrid crossings={crossings} onOpenCrossing={setSelectedCrossing} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <MfisTensionRanking crossings={crossings} />
            </div>
          </div>

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

      {selectedCrossing && (
        <MfisCrossingDrawer crossing={selectedCrossing} onClose={() => setSelectedCrossing(null)} />
      )}
    </div>
  );
}