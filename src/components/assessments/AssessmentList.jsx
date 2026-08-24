import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FileText, TrendingUp, TrendingDown, Minus, Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/shared/StatusBadge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function currentCompetence() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {Object} props
 * @param {any=} props.delta
 */
function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  if (delta > 0) return <span className="text-xs text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{delta.toFixed(2)}</span>;
  if (delta < 0) return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{delta.toFixed(2)}</span>;
  return <span className="text-xs text-slate-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />0.00</span>;
}

function useAssessmentScore(assessmentId, tenantId) {
  return useQuery({
    queryKey: ['fal-snap-score', tenantId, assessmentId],
    queryFn: async () => {
      // prefer published snapshot, fallback to latest
      const published = await base44.entities.FalDiagnosticSnapshot.filter(
        { tenant_id: tenantId, assessment_id: assessmentId, status: 'published' },
        '-computed_at', 1
      );
      if (published.length > 0) return published[0];
      const latest = await base44.entities.FalDiagnosticSnapshot.filter(
        { tenant_id: tenantId, assessment_id: assessmentId },
        '-computed_at', 1
      );
      return latest[0] || null;
    },
    enabled: !!assessmentId && !!tenantId,
    staleTime: 60_000,
  });
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 */
function ScoreChip({ assessmentId, tenantId }) {
  const { data: snap } = useAssessmentScore(assessmentId, tenantId);
  if (!snap) return null;
  const score = snap.overall_score;
  if (score === null || score === undefined) return null;
  return (
    <span className="text-xs font-semibold text-slate-700 tabular-nums">
      {Number(score).toFixed(2)}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.node
 * @param {any=} props.tenantId
 * @param {any=} props.selectedId
 * @param {any=} props.onSelect
 * @param {any=} props.onNew
 */
export default function AssessmentList({ node, tenantId, selectedId, onSelect, onNew }) {
  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments-node', tenantId, node?.type, node?.id],
    queryFn: () => base44.entities.Assessment.filter(
      { tenant_id: tenantId, target_type: node.type, target_id: node.id },
      '-competence',
      50
    ),
    enabled: !!node && !!tenantId,
  });

  // snapshots fetched per-card via useAssessmentScore above
  // delta computed using snapshot data after all cards rendered
  // For delta we need all snapshots loaded; we pass ids to a bulk query
  const { data: allSnaps = [] } = useQuery({
    queryKey: ['fal-snaps-bulk', tenantId, assessments.map(a => a.id).join(',')],
    queryFn: async () => {
      if (!assessments.length) return [];
      const results = await Promise.all(
        assessments.map(a =>
          base44.entities.FalDiagnosticSnapshot.filter(
            { tenant_id: tenantId, assessment_id: a.id }, '-computed_at', 1
          ).then(r => r[0] || null)
        )
      );
      return results;
    },
    enabled: !!assessments.length && !!tenantId,
    staleTime: 60_000,
  });

  const snapByAssessmentId = {};
  allSnaps.forEach((s, i) => {
    if (s && assessments[i]) snapByAssessmentId[assessments[i].id] = s;
  });

  // Convert MM/AAAA to AAAA-MM for proper chronological sort
  function competenceToSortKey(comp) {
    if (!comp) return '';
    if (/^\d{2}\/\d{4}$/.test(comp)) {
      const [mm, aaaa] = comp.split('/');
      return `${aaaa}-${mm}`;
    }
    return comp; // fallback for old YYYY-MM format
  }

  const sortedByCompetence = [...assessments].sort((a, b) =>
    competenceToSortKey(b.competence).localeCompare(competenceToSortKey(a.competence))
  );

  function getDelta(assessment) {
    const snap = snapByAssessmentId[assessment.id];
    if (!snap || snap.overall_score === null || snap.overall_score === undefined) return null;
    const idx = sortedByCompetence.findIndex(a => a.id === assessment.id);
    const prev = sortedByCompetence.slice(idx + 1).find(a =>
      a.target_type === assessment.target_type && a.target_id === assessment.target_id
    );
    if (!prev) return null;
    const prevSnap = snapByAssessmentId[prev.id];
    if (!prevSnap || prevSnap.overall_score === null || prevSnap.overall_score === undefined) return null;
    return snap.overall_score - prevSnap.overall_score;
  }

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
        <FileText className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Selecione um nó na estrutura</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
            {{ group: 'Grupo', company: 'Empresa', unit: 'Unidade' }[node.type] || node.type}
          </p>
          <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{node.name}</p>
        </div>
        <Button size="sm" onClick={onNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" /> Novo
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : assessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs text-center">Nenhum assessment<br />para este nó</p>
            <Button size="sm" variant="outline" onClick={onNew} className="mt-3 text-xs gap-1">
              <Plus className="w-3 h-3" /> Criar primeiro
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5 p-2">
            {sortedByCompetence.map(a => {
              const delta = getDelta(a);
              const isSelected = selectedId === a.id;
              const isCurrentComp = a.competence === currentCompetence();

              const displayName = a.display_name || a.title || `Diagnóstico — sem data-base`;
              const competenceLabel = a.competence || '—';

              const isInProgress = a.status === 'in_progress';
              const progress = a.progress_percentage || 0;
              const lastSaved = a.last_saved_at
                ? formatDistanceToNow(new Date(a.last_saved_at), { locale: ptBR, addSuffix: true })
                : null;

              return (
                <div
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className={`p-3 rounded-lg cursor-pointer border transition-all
                    ${isSelected
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : isInProgress
                        ? 'border-orange-200 bg-orange-50/30 hover:bg-orange-50'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400">{competenceLabel}</span>
                        {a.cycle_number > 1 && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">ciclo {a.cycle_number}</span>
                        )}
                        {isCurrentComp && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-medium">atual</span>
                        )}
                      </div>
                      {a.context_note && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 italic">{a.context_note}</p>
                      )}

                      {/* In-progress indicator */}
                      {isInProgress && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-orange-600 font-medium">Em andamento · {progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                          {lastSaved && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {lastSaved}
                            </p>
                          )}
                          <Link
                            to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-medium mt-0.5"
                          >
                            <Play className="w-2.5 h-2.5" /> Continuar
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={a.status} />
                      <ScoreChip assessmentId={a.id} tenantId={tenantId} />
                      <DeltaBadge delta={delta} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}