import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SCORE_COLOR = (s) => {
  if (s < 40) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Crítico' };
  if (s < 65) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Básico' };
  if (s < 85) return { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Estruturado' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Avançado' };
};

/**
 * @param {Object} props
 * @param {any=} props.score
 */
function ScoreBar({ score }) {
  const c = SCORE_COLOR(score);
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${c.bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${c.text}`}>{score}</span>
      <Badge className={`text-[10px] ${c.bg} ${c.text} border-0 px-2 py-0.5`}>{c.label}</Badge>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.driverId
 * @param {any=} props.driverData
 * @param {any=} props.catalog
 * @param {any=} props.causes
 * @param {any=} props.evidence
 * @param {any=} props.insightSnap
 */
function DriverCard({ driverId, driverData, catalog, causes, evidence, insightSnap }) {
  const [expanded, setExpanded] = useState(false);
  const driverInfo = catalog.find(d => d.driver_id === driverId);
  const { score, hit_count, evidence_question_ids = [] } = driverData;
  const c = SCORE_COLOR(score);

  // Causas que referenciam este driver
  const relatedCauses = causes.filter(c => c.driver_ids?.includes(driverId));

  return (
    <div className={`rounded-xl border ${score < 40 ? 'border-red-200' : 'border-slate-200'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
          <Zap className={`w-4 h-4 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-slate-800 truncate">{driverInfo?.name || driverId}</span>
            {hit_count > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" />{hit_count} evidências
              </span>
            )}
          </div>
          <ScoreBar score={score} />
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
          {driverInfo?.description && (
            <p className="text-xs text-slate-600">{driverInfo.description}</p>
          )}

          {/* Evidências (perguntas que geraram hits) */}
          {evidence_question_ids.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Evidências detectadas</p>
              <div className="space-y-1.5">
                {evidence_question_ids.map(qId => {
                  const ev = evidence?.[qId];
                  return (
                    <div key={qId} className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-red-100">
                      <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-slate-600 min-w-0">
                        <span className="font-mono text-red-600 text-[10px]">{qId.slice(-8)}</span>
                        <span className="ml-2 text-slate-500">Score: {ev?.score ?? '?'} · Severidade: {ev?.severity ?? 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Causas prováveis */}
          {relatedCauses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Causas prováveis</p>
              <div className="space-y-1.5">
                {relatedCauses.slice(0, 3).map(cause => (
                  <div key={cause.cause_id} className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-amber-800">{cause.name}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{cause.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 */
export default function DriverView({ assessmentId }) {
  const { data: insightSnaps = [] } = useQuery({
    queryKey: ['insight-snap', assessmentId],
    queryFn: () => base44.entities.FalInsightSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1),
    enabled: !!assessmentId
  });
  const insightSnap = insightSnaps[0] || null;

  const { data: driverCatalog = [] } = useQuery({
    queryKey: ['driver-catalog'],
    queryFn: () => base44.entities.FalDriverCatalog.list('-created_date', 100)
  });

  const { data: rootCauses = [] } = useQuery({
    queryKey: ['root-causes'],
    queryFn: () => base44.entities.FalRootCauseCatalog.list('-created_date', 100)
  });

  if (!insightSnap) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma análise de inteligência disponível</p>
        <p className="text-xs mt-1">Execute o diagnóstico e calcule o plano de ação</p>
      </div>
    );
  }

  const driverScores = insightSnap.driver_scores || {};
  const topGaps = insightSnap.top_driver_gaps || [];

  // Separar gaps dos demais
  const gapDrivers = topGaps.filter(id => driverScores[id]);
  const otherDrivers = Object.keys(driverScores).filter(id => !topGaps.includes(id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Principais Gaps por Driver</h3>
        <p className="text-xs text-slate-500 mb-4">Drivers com maior impacto negativo no diagnóstico</p>
        <div className="space-y-2">
          {gapDrivers.map(id => (
            <DriverCard
              key={id}
              driverId={id}
              driverData={driverScores[id]}
              catalog={driverCatalog}
              causes={rootCauses}
              evidence={insightSnap.evidence}
              insightSnap={insightSnap}
            />
          ))}
        </div>
      </div>

      {otherDrivers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Outros Drivers Monitorados</h3>
          <div className="space-y-2">
            {otherDrivers.map(id => (
              <DriverCard
                key={id}
                driverId={id}
                driverData={driverScores[id]}
                catalog={driverCatalog}
                causes={rootCauses}
                evidence={insightSnap.evidence}
                insightSnap={insightSnap}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}