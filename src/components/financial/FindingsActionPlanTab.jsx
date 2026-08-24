/**
 * FindingsActionPlanTab
 * Exibe os FinancialFindings do diagnóstico e permite enviá-los ao plano de ação.
 * Fluxo: FinancialFinding → (sendFindingToActionPlan) → ActionRecommendation (needs_classification)
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey, tenantKey, invalidateFinancialQueries, invalidateActionPlanQueries } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp, Plus } from 'lucide-react';

const SEVERITY_STYLE = {
  critical: { label: 'Crítico',  cls: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-500' },
  high:     { label: 'Alto',     cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  medium:   { label: 'Médio',   cls: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-400' },
  low:      { label: 'Baixo',    cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const ACTION_STATUS_STYLE = {
  not_sent:           { label: 'Não enviado',        cls: 'bg-slate-100 text-slate-500' },
  suggested:          { label: 'Sugerido',           cls: 'bg-blue-100 text-blue-700' },
  needs_classification:{ label: 'Aguardando org.',   cls: 'bg-amber-100 text-amber-700' },
  converted_to_task:  { label: 'Convertido',         cls: 'bg-emerald-100 text-emerald-700' },
  rejected:           { label: 'Rejeitado',          cls: 'bg-slate-100 text-slate-400' },
};

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.actionPlanId
 */
export default function FindingsActionPlanTab({ diagnosisId, tenantId, actionPlanId }) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(/** @type {Record<string, any>} */ ({}));
  const [selectedPlanId, setSelectedPlanId] = useState(actionPlanId || '');

  const { data: findings = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, 'severity', 100
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  // Busca planos de ação disponíveis para o tenant
  const { data: plans = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'action-plans-for-findings'),
    queryFn: () => base44.entities.ActionPlan.filter(
      { tenant_id: tenantId, status: 'active' }, '-generated_at', 20
    ),
    enabled: !!tenantId,
  });

  const handleSend = async (finding) => {
    if (!selectedPlanId) return;
    setSending(s => ({ ...s, [finding.id]: true }));
    await base44.functions.invoke('sendFindingToActionPlan', {
      finding_id: finding.id,
      action_plan_id: selectedPlanId,
    });
    await invalidateFinancialQueries(qc, diagnosisId, tenantId);
    await invalidateActionPlanQueries(qc, null, selectedPlanId, tenantId);
    setSending(s => ({ ...s, [finding.id]: false }));
  };

  const notSent = findings.filter(f => !f.action_plan_status || f.action_plan_status === 'not_sent');
  const sent    = findings.filter(f => f.action_plan_status && f.action_plan_status !== 'not_sent');

  if (isLoading) return (
    <div className="text-center py-12 text-slate-400">
      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
      <p className="text-sm">Carregando achados...</p>
    </div>
  );

  if (findings.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Nenhum achado financeiro registrado.</p>
      <p className="text-xs mt-1 text-slate-300">Achados são gerados automaticamente pela engine de alertas.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Seletor de plano */}
      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <ArrowRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-indigo-800 mb-1">Plano de ação de destino</p>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="h-8 text-xs bg-white border-indigo-300">
              <SelectValue placeholder="Selecione o plano de ação..." />
            </SelectTrigger>
            <SelectContent>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.assessment_id ? `Plano ${p.id.slice(-6)}` : `Plano ${p.id.slice(-6)}`}
                  {p.overall_progress_percentage != null && ` · ${p.overall_progress_percentage}% completo`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {plans.length === 0 && (
            <p className="text-xs text-indigo-600 mt-1">Nenhum plano ativo encontrado. Gere um plano de ação primeiro.</p>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',       value: findings.length,   cls: 'bg-slate-50 border-slate-200' },
          { label: 'Não enviados', value: notSent.length,   cls: 'bg-amber-50 border-amber-200' },
          { label: 'Enviados',    value: sent.length,       cls: 'bg-emerald-50 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-3 py-2 text-center ${s.cls}`}>
            <p className="text-xl font-black text-slate-800">{s.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Achados pendentes */}
      {notSent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Pendentes de envio ({notSent.length})
          </p>
          <div className="space-y-2">
            {notSent.map(f => {
              const sev = SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.medium;
              const isSending = sending[f.id];
              return (
                <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${sev.cls}`}>{sev.label}</span>
                      {f.financial_indicator && (
                        <span className="text-[10px] text-slate-400">{f.financial_indicator}</span>
                      )}
                      {f.period && (
                        <span className="text-[10px] text-slate-400">{f.period}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                    {f.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{f.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSend(f)}
                    disabled={isSending || !selectedPlanId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 flex-shrink-0 h-8 text-xs"
                  >
                    {isSending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />
                    }
                    Enviar ao plano
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achados já enviados */}
      {sent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Já enviados ({sent.length})
          </p>
          <div className="space-y-2">
            {sent.map(f => {
              const sev = SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.medium;
              const ast = ACTION_STATUS_STYLE[f.action_plan_status] || ACTION_STATUS_STYLE.not_sent;
              return (
                <div key={f.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3 opacity-80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${sev.cls}`}>{sev.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ast.cls}`}>{ast.label}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{f.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}