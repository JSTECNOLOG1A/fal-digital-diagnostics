import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { FileText, Zap, ExternalLink, BarChart3, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import FalRadarChart from '@/components/fal/FalRadarChart';

/**
 * @param {Object} props
 * @param {any=} props.score
 * @param {any=} props.level
 */
function ScoreLevel({ score, level }) {
  if (score === null || score === undefined) return null;
  const colors = {
    'Crítico': 'text-red-600 bg-red-50',
    'Básico': 'text-amber-600 bg-amber-50',
    'Estruturado': 'text-blue-600 bg-blue-50',
    'Avançado': 'text-emerald-600 bg-emerald-50',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-sm font-semibold ${colors[level] || 'text-slate-600 bg-slate-100'}`}>
      {score?.toFixed(1)} · {level}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.node
 */
export default function AssessmentDetailPanel({ assessment, node }) {
  const { data: snapshot, isLoading: loadingSnap } = useQuery({
    queryKey: ['fal-snap-detail', assessment?.id],
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter(
        { assessment_id: assessment.id }, '-computed_at', 1
      );
      return snaps[0] || null;
    },
    enabled: !!assessment?.id,
  });

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm font-medium text-slate-500">Selecione um assessment</p>
        <p className="text-xs text-slate-400 mt-1">Clique em um card na coluna central</p>
      </div>
    );
  }

  const isGroupReport = node?.type === 'group' || assessment.target_type === 'group';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            {isGroupReport && (
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Relatório Global do Cliente</span>
              </div>
            )}
            <p className="text-sm font-bold text-slate-900">{assessment.display_name || assessment.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Data-base: <span className="font-mono font-semibold text-slate-600">{assessment.competence || '—'}</span>
              {assessment.cycle_number > 1 && <span className="ml-1.5 text-slate-400">· Ciclo {assessment.cycle_number}</span>}
            </p>
            {assessment.context_note && (
              <p className="text-[11px] text-slate-400 italic mt-0.5">{assessment.context_note}</p>
            )}
          </div>
          <Link to={createPageUrl(`AssessmentDetail?id=${assessment.id}`)}>
            <Button size="sm" variant="outline" className="gap-1 text-xs flex-shrink-0">
              <ExternalLink className="w-3 h-3" /> Abrir
            </Button>
          </Link>
        </div>
      </div>

      {/* Score Summary */}
      {loadingSnap ? (
        <div className="p-4"><Skeleton className="h-24 rounded-xl" /></div>
      ) : snapshot ? (
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score Geral</p>
            <ScoreLevel score={snapshot.overall_score} level={snapshot.overall_level} />
          </div>
          <div className="h-[200px]">
            <FalRadarChart radarPoints={snapshot.radar_points} />
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-slate-100 text-center">
          <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          <p className="text-xs text-slate-400">Diagnóstico ainda não calculado</p>
        </div>
      )}

      {/* Top Gaps */}
      {snapshot?.gaps_top?.length > 0 && (
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Gaps</p>
          <div className="space-y-1.5">
            {snapshot.gaps_top.map(g => (
              <div key={g.dimension} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate">{g.axis}</span>
                <span className="text-red-600 font-semibold ml-2">{g.score?.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-2">
        <Link to={createPageUrl(`AssessmentDetail?id=${assessment.id}`)}>
          <Button variant="outline" size="sm" className="w-full gap-2 justify-start text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            {isGroupReport ? 'Ver Relatório Global' : 'Ver Relatório Completo'}
          </Button>
        </Link>
        <Link to={createPageUrl(`ActionPlanPage?assessment_id=${assessment.id}`)}>
          <Button variant="outline" size="sm" className="w-full gap-2 justify-start text-xs">
            <Zap className="w-3.5 h-3.5" /> Ver Plano de Ação
          </Button>
        </Link>
      </div>
    </div>
  );
}