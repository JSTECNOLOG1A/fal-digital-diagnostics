/**
 * ActionPlanReviewTimeline
 * Exibe o histórico de revisões do plano de ação em linha do tempo.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react';
import { actionPlanKey, invalidateActionPlanQueries } from '@/lib/query-client';

const STATUS_CONFIG = {
  completed:  { label: 'Concluída',  icon: CheckCircle2, cls: 'text-emerald-600', bg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  draft:      { label: 'Rascunho',   icon: Clock,        cls: 'text-amber-500',  bg: 'bg-amber-100',   badge: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: 'Cancelada',  icon: XCircle,      cls: 'text-slate-400',  bg: 'bg-slate-100',   badge: 'bg-slate-100 text-slate-500' },
};

const VISIT_LABELS = {
  intermediate:  'Intermediária',
  final:         'Final',
  extraordinary: 'Extraordinária',
};

/**
 * @param {Object} props
 * @param {any=} props.review
 */
function DeltaBadge({ review }) {
  // Usar progress_percentage do snapshot como fonte canônica, com fallback para overall_progress_*
  const snap = (field) => {
    const os = review.opening_snapshot?.summary;
    const cs = review.closing_snapshot?.summary;
    if (!os || !cs) return null;
    const b = os.progress_percentage ?? os.average_progress ?? null;
    const a = cs.progress_percentage ?? cs.average_progress ?? null;
    return { b, a };
  };

  const vals = snap();
  if (!vals || vals.b == null || vals.a == null) {
    // fallback para campos diretos da revisão
    const b = review.overall_progress_before;
    const a = review.overall_progress_after;
    if (b == null || a == null) return null;
    const delta = a - b;
    if (delta > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-bold"><TrendingUp className="w-3 h-3" />+{delta}%</span>;
    if (delta < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-bold"><TrendingDown className="w-3 h-3" />{delta}%</span>;
    return <span className="flex items-center gap-0.5 text-slate-400 text-xs"><Minus className="w-3 h-3" />Sem alteração</span>;
  }

  const delta = vals.a - vals.b;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-bold"><TrendingUp className="w-3 h-3" />+{delta}%</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-bold"><TrendingDown className="w-3 h-3" />{delta}%</span>;
  return <span className="flex items-center gap-0.5 text-slate-400 text-xs"><Minus className="w-3 h-3" />Sem alteração</span>;
}

/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.tenantId
 * @param {boolean=} props.expanded
 * @param {boolean=} props.readOnly
 */
export default function ActionPlanReviewTimeline({ planId, tenantId, expanded: _expanded = false, readOnly = false }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (review) => {
    if (readOnly || review.status === 'completed') return;
    const reason = window.prompt('Informe o motivo do cancelamento. As alterações já feitas nas tarefas serão preservadas.');
    if (!reason?.trim()) return;
    if (!window.confirm('Confirmar cancelamento? Alterações feitas durante a revisão continuarão preservadas nas tarefas.')) return;
    setDeletingId(review.id);
    const response = await base44.functions.invoke('cancelActionPlanReview', {
      review_id: review.id,
      reason: reason.trim(),
      confirm_live_changes: true,
    });
    if (response.data?.error) alert(`Não foi possível cancelar: ${response.data.error}`);
    invalidateActionPlanQueries(qc, null, planId, tenantId);
    setDeletingId(null);
  };

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: actionPlanKey(tenantId, null, planId, 'reviews'),
    queryFn: () => base44.entities.ActionPlanReview.filter(
      { action_plan_id: planId, ...(tenantId ? { tenant_id: tenantId } : {}) },
      'review_number',
      50
    ),
    enabled: !!planId,
  });

  if (isLoading) return <div className="text-sm text-slate-400 py-4 text-center">Carregando revisões...</div>;

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Clock className="w-7 h-7 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma revisão registrada ainda.</p>
        <p className="text-xs mt-1 text-slate-300">Crie uma nova revisão após uma visita ao cliente.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

      <div className="space-y-4">
        {reviews.map((review, idx) => {
          const cfg = STATUS_CONFIG[review.status] || STATUS_CONFIG.draft;
          const Icon = cfg.icon;
          const isLast = idx === reviews.length - 1;

          return (
            <div key={review.id} className="relative flex gap-4">
              {/* dot */}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.cls}`} />
              </div>

              {/* card */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-1">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div>
                    <span className="text-sm font-bold text-slate-800">
                      Revisão Nº {review.review_number}
                      {review.visit_type && (
                        <span className="ml-2 text-xs font-normal text-slate-400">— {VISIT_LABELS[review.visit_type]}</span>
                      )}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {review.review_date ? new Date(review.review_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      {review.consultant_name ? ` · ${review.consultant_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DeltaBadge review={review} />
                    <Badge className={`text-[10px] border-0 ${cfg.badge}`}>{cfg.label}</Badge>
                    {!readOnly && (
                    <button
                      onClick={() => handleDelete(review)}
                      disabled={deletingId === review.id}
                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Excluir revisão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </div>

                {review.executive_summary && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-2 italic">"{review.executive_summary}"</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  {review.key_advances && (
                    <div><span className="font-semibold text-emerald-600">Avanços: </span>{review.key_advances}</div>
                  )}
                  {review.key_delays && (
                    <div><span className="font-semibold text-amber-600">Atrasos: </span>{review.key_delays}</div>
                  )}
                  {review.next_steps && (
                    <div className="col-span-2"><span className="font-semibold text-blue-600">Próximos passos: </span>{review.next_steps}</div>
                  )}
                </div>

                {/* Progress bar */}
                {review.overall_progress_after != null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Progresso após revisão</span>
                      <span className="font-semibold text-slate-700">{review.overall_progress_after}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${review.overall_progress_after}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}