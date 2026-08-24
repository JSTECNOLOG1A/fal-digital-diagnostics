/**
 * FalRadarTab — Aba standalone do Radar FAL 8D™
 * Mostra o radar + evolução + tabela de dimensões + gaps
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import FalRadarChart from './FalRadarChart';
import FalDimensionTable from './FalDimensionTable';
import FalGapsPanel from './FalGapsPanel';
import ExecutiveReadingCard from './ExecutiveReadingCard';
import DimensionLegend from './DimensionLegend';
import FalEvolutionRadar from './FalEvolutionRadar';

/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.compact
 * @param {any=} props.hideChart
 */
export default function FalRadarTab({ assessment, compact = false, hideChart = false }) {
  const assessmentId = assessment?.id;

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

  if (!latestSnapshot) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum resultado calculado ainda.</p>
        <p className="text-xs mt-1">Responda as perguntas e clique em "Gerar diagnóstico completo".</p>
      </div>
    );
  }

  const firstSnapshot = allTargetSnapshots.length > 1 ? allTargetSnapshots[0] : null;

  // Modo compacto: Radar + Leitura Estruturada lado a lado — cockpit fixo no topo
  if (compact) {
    return (
      <Card className="border-0 shadow-md w-full bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Radar FAL 8D™ — 8 Dimensões de Maturidade</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <FalRadarChart
                radarPoints={latestSnapshot.radar_points}
                dimensionRiskSummary={latestSnapshot.dimension_risk_summary}
                showInstructions={false}
              />
            </div>
            <div className="lg:col-span-7">
              <DimensionLegend activeDimensions={assessment?.active_dimensions} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Modo completo: gráfico + leitura executiva side-by-side + evolução + tabelas
  return (
    <div className="space-y-4">
      {/* Gráfico + Leitura Executiva — só renderiza quando NÃO há cockpit compacto no topo (hideChart=false) */}
      {!hideChart && (
        <Card className="border-0 shadow-sm">
          <CardContent>
            <CardHeader className="pb-0 px-0">
              <CardTitle className="text-base">Radar FAL 8D™ — 8 Dimensões de Maturidade</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-4">
              <div className="lg:col-span-7">
                <FalRadarChart
                  radarPoints={latestSnapshot.radar_points}
                  dimensionRiskSummary={latestSnapshot.dimension_risk_summary}
                  showInstructions={true}
                />
              </div>
              <div className="lg:col-span-5">
                <ExecutiveReadingCard
                  dimensionScores={latestSnapshot.dimension_scores}
                  dimensionRiskSummary={latestSnapshot.dimension_risk_summary}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {firstSnapshot && latestSnapshot && firstSnapshot.assessment_id !== latestSnapshot.assessment_id && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Evolução — Inicial vs Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <FalEvolutionRadar firstSnapshot={firstSnapshot} latestSnapshot={latestSnapshot} />
          </CardContent>
        </Card>
      )}

      <DimensionLegend activeDimensions={assessment?.active_dimensions} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Scores por Dimensão</CardTitle></CardHeader>
          <CardContent>
            <FalDimensionTable
              dimensionScores={latestSnapshot.dimension_scores}
              activeDimensions={assessment?.active_dimensions}
            />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Principais Gaps</CardTitle></CardHeader>
          <CardContent>
            <FalGapsPanel gapsTop={latestSnapshot.gaps_top} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}