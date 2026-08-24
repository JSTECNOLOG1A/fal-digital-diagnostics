import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { invalidateAssessmentQueries } from '@/lib/query-client';
import FalRadarChart from './FalRadarChart';
import FalDimensionTable from './FalDimensionTable';
import FalGapsPanel from './FalGapsPanel';

const LEVEL_STYLE = {
  Crítico:     'bg-red-100 text-red-700 border-red-200',
  Básico:      'bg-amber-100 text-amber-700 border-amber-200',
  Estruturado: 'bg-blue-100 text-blue-700 border-blue-200',
  Avançado:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.tenantId
 */
export default function FalDiagnosticPanel({ assessment, tenantId }) {
  const assessmentId = assessment?.id;
  const queryClient = useQueryClient();
  const [building, setBuilding] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);

  const questionSet = assessment?.question_set || [];

  // Latest FAL snapshot
  const { data: latestSnapshot } = useQuery({
    queryKey: ['fal-snapshot', assessmentId],
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1);
      return snaps[0] || null;
    },
    enabled: !!assessmentId,
  });

  // FAL responses count
  const { data: falResponses = [] } = useQuery({
    queryKey: ['fal-responses-count', assessmentId],
    queryFn: () => base44.entities.FalResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  const handleBuildSet = async () => {
    setBuilding(true);
    setError(null);
    const res = await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      invalidateAssessmentQueries(queryClient, assessmentId, tenantId);
    }
    setBuilding(false);
  };

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

  const answeredCount = falResponses.length;
  const progressPct = questionSet.length > 0 ? Math.round((answeredCount / questionSet.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" /> Motor FAL — Diagnóstico Adaptativo IFME™
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question set status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700">
                {questionSet.length > 0
                  ? `Set gerado: ${questionSet.length} perguntas`
                  : 'Set de perguntas não gerado'}
              </p>
              {questionSet.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {answeredCount} respostas · {progressPct}% completo
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBuildSet}
                disabled={building}
                className="gap-1.5"
              >
                {building ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> {questionSet.length > 0 ? 'Regen. Set' : 'Gerar Set'}</>}
              </Button>
              {questionSet.length > 0 && (
                <Link to={createPageUrl(`DimensionQuestionnaire?assessment_id=${assessmentId}&dimension_key=${assessment?.active_dimensions?.[0] || 'governanca'}`)}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Responder <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {questionSet.length > 0 && (
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Compute button */}
          {questionSet.length > 0 && (
            <Button
              onClick={handleCompute}
              disabled={computing || answeredCount === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {computing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando Radar FAL...</>
                : <><Activity className="w-4 h-4" /> Calcular Radar FAL</>}
            </Button>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {latestSnapshot && (
        <>
          {/* Overall score */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500 mb-1">Índice FAL de Maturidade Empresarial (IFME™)</p>
                  <p className="text-4xl font-bold text-slate-900">{(latestSnapshot.overall_score || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">escala 0 – 3</p>
                </div>
                <div className="flex-1">
                  <Badge className={`text-sm px-4 py-1.5 ${LEVEL_STYLE[latestSnapshot.overall_level] || 'bg-slate-100 text-slate-600'}`}>
                    {latestSnapshot.overall_level}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-2">
                    Calculado em {new Date(latestSnapshot.computed_at).toLocaleString('pt-BR')} por {latestSnapshot.computed_by}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Radar chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Radar FAL 8D™ — Estrutura de Maturidade</CardTitle>
            </CardHeader>
            <CardContent>
              <FalRadarChart radarPoints={latestSnapshot.radar_points} />
            </CardContent>
          </Card>

          {/* Table + gaps */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scores por Dimensão</CardTitle>
              </CardHeader>
              <CardContent>
                <FalDimensionTable dimensionScores={latestSnapshot.dimension_scores} />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Principais Gaps</CardTitle>
              </CardHeader>
              <CardContent>
                <FalGapsPanel gapsTop={latestSnapshot.gaps_top} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}