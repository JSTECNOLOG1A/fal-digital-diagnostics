import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle, ChevronRight, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RANK_STYLE = ['border-red-200 bg-red-50', 'border-amber-200 bg-amber-50', 'border-blue-200 bg-blue-50'];
const RANK_BADGE = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-blue-100 text-blue-700'];
const RANK_LABEL = ['#1 Causa Principal', '#2 Causa Secundária', '#3 Causa Associada'];

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 */
export default function RootCausePanel({ assessmentId }) {
  const { data: insightSnaps = [] } = useQuery({
    queryKey: ['insight-snap', assessmentId],
    queryFn: () => base44.entities.FalInsightSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1),
    enabled: !!assessmentId
  });
  const insightSnap = insightSnaps[0] || null;

  const { data: rootCauseCatalog = [] } = useQuery({
    queryKey: ['root-causes'],
    queryFn: () => base44.entities.FalRootCauseCatalog.list('-created_date', 100)
  });

  if (!insightSnap?.root_causes_ranked?.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma causa identificada</p>
        <p className="text-xs mt-1">Execute a análise de inteligência para ver as causas prováveis</p>
      </div>
    );
  }

  const top3 = insightSnap.root_causes_ranked.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <p className="text-sm text-slate-600">
          Causas prováveis identificadas com base em <strong>{Object.keys(insightSnap.evidence || {}).length}</strong> evidências coletadas
        </p>
      </div>

      {top3.map((cause, i) => {
        const catalogEntry = rootCauseCatalog.find(c => c.cause_id === cause.cause_id);
        const driverScores = insightSnap.driver_scores || {};

        // Listar drivers impactados desta causa
        const impactedDrivers = (cause.driver_ids || []).filter(d => driverScores[d]);

        return (
          <div key={cause.cause_id} className={`rounded-xl border p-5 ${RANK_STYLE[i] || 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Badge className={`text-xs ${RANK_BADGE[i] || 'bg-slate-100 text-slate-700'}`}>{RANK_LABEL[i] || `#${i+1}`}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{cause.name}</h4>
                {catalogEntry?.description && (
                  <p className="text-xs text-slate-600 mt-1">{catalogEntry.description}</p>
                )}

                {/* Por que achamos isso */}
                {impactedDrivers.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Por que identificamos isso</p>
                    <div className="flex flex-wrap gap-1.5">
                      {impactedDrivers.map(dId => {
                        const score = driverScores[dId]?.score;
                        return (
                          <span key={dId} className="flex items-center gap-1 text-[11px] bg-white border rounded-full px-2 py-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${score < 40 ? 'bg-red-500' : score < 65 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <span className="text-slate-600">{dId.replace(/_/g, ' ')}</span>
                            <span className="font-medium text-slate-800">{score}/100</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evidências count */}
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {cause.evidence_count} drivers impactados
                  </span>
                  {cause.playbook_keys?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      {cause.playbook_keys.length} ação(ões) recomendada(s)
                    </span>
                  )}
                </div>

                {/* Perfis típicos */}
                {catalogEntry?.typical_roles?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {catalogEntry.typical_roles.map(r => (
                      <span key={r} className="text-[10px] bg-white text-slate-500 border rounded px-1.5 py-0.5">{r.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}