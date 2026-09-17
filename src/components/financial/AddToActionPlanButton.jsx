/**
 * AddToActionPlanButton
 * Único ponto de criação de tarefa no Plano de Ação a partir de uma análise
 * financeira (achado, recomendação ou apontamento manual). Substitui a lógica
 * antes duplicada em FinancialActionsPanel (ConvertForm) e
 * FinancialIndicatorHelpDrawer (TaskCreateForm).
 *
 * Sempre cria a tarefa no plano central do grupo do diagnóstico (mesmo
 * comportamento de convertFinancialRecommendation hoje) e, quando a tarefa
 * é criada, mostra "✓ Já no Plano de Ação" em vez do botão.
 */
import React, { useState } from 'react';
import { Plus, Loader2, CheckCircle2, ArrowRight, Undo2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invalidateFinancialQueries, invalidateActionPlanQueries } from '@/lib/query-client';

const PRIORITY_OPTS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const HORIZON_OPTS = [
  { value: '30d', label: '30 dias' },
  { value: '60d', label: '60 dias' },
  { value: '90d', label: '90 dias' },
  { value: '180d', label: '180 dias' },
];

/**
 * @param {Object} props
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 * @param {string=} props.recommendationId - FinancialRecommendation.id, quando a origem tem recomendação gerada.
 * @param {string=} props.findingId - FinancialFinding.id, envio direto sem recomendação prévia (ex.: achados de cruzamento automático, que nunca geram recomendação pelo fluxo padrão).
 * @param {string} props.defaultTitle
 * @param {string=} props.defaultDescription
 * @param {string=} props.sourceLabel - rótulo da origem (ex.: nome do indicador), usado no origin_detail da tarefa.
 * @param {string=} props.indicatorCode
 * @param {boolean=} props.alreadyInPlan - quando true, mostra o selo "já no plano" + botão de estornar (em vez do formulário).
 * @param {string=} props.actionTaskId - ActionTask.id já criada, necessário pra "Estornar" saber qual tarefa cancelar quando alreadyInPlan vem true (achado/proposta já carregados do backend).
 * @param {() => void=} props.onCreated
 */
export default function AddToActionPlanButton({
  diagnosisId,
  tenantId,
  recommendationId,
  findingId,
  defaultTitle,
  defaultDescription = '',
  sourceLabel = 'Análise Financeira',
  indicatorCode = '',
  alreadyInPlan = false,
  actionTaskId = null,
  onCreated,
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  // Guarda o id da tarefa recém-criada NESTA sessão (alreadyInPlan/actionTaskId
  // só refletem o backend depois de um refetch) — sem isso "Estornar" não
  // teria o id pra cancelar logo após um "Criar Tarefa" na mesma tela.
  const [createdTaskId, setCreatedTaskId] = useState(null);
  const [unconverting, setUnconverting] = useState(false);
  const [unconvertError, setUnconvertError] = useState(null);
  const [unconverted, setUnconverted] = useState(false);
  const [form, setForm] = useState({
    title: defaultTitle || '',
    description: defaultDescription || '',
    ownerName: '',
    priority: 'medium',
    horizon: '90d',
  });

  const handle = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const effectiveTaskId = createdTaskId || actionTaskId;

  const unconvert = async () => {
    if (!effectiveTaskId) return;
    setUnconverting(true);
    setUnconvertError(null);
    try {
      await base44.functions.invoke('unconvertFinancialActionTask', {
        action_task_id: effectiveTaskId,
        financial_diagnosis_id: diagnosisId,
      });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      await invalidateActionPlanQueries(queryClient, null, null, tenantId);
      setDone(false);
      setCreatedTaskId(null);
      setUnconverted(true);
    } catch (e) {
      setUnconvertError(e.message || 'Erro ao estornar o envio.');
    } finally {
      setUnconverting(false);
    }
  };

  if ((alreadyInPlan || done) && !unconverted) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Já no Plano de Ação
          </span>
          <button
            type="button"
            onClick={unconvert}
            disabled={unconverting || !effectiveTaskId}
            title={effectiveTaskId ? 'Cancela a tarefa criada e devolve este ponto para "não enviado"' : 'Id da tarefa indisponível — recarregue a página'}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 px-2 py-0.5 disabled:opacity-50"
          >
            {unconverting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
            Estornar
          </button>
        </div>
        {unconvertError && <p className="text-[11px] text-red-700">{unconvertError}</p>}
      </div>
    );
  }

  const submit = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await base44.functions.invoke('convertFinancialRecommendation', {
        financial_recommendation_id: recommendationId || undefined,
        financial_finding_id: findingId || undefined,
        financial_diagnosis_id: diagnosisId,
        task_title: form.title,
        description: form.description,
        horizon: form.horizon,
        owner_name: form.ownerName,
        priority: form.priority,
        tenant_id: tenantId,
        indicator_code: indicatorCode,
        indicator_label: sourceLabel,
      });
      const taskCreated = resp?.data?.task;
      if (!taskCreated) {
        setError('Não foi possível criar a tarefa.');
        return;
      }
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      await invalidateActionPlanQueries(queryClient, null, null, tenantId);
      setCreatedTaskId(taskCreated.id);
      setDone(true);
      setUnconverted(false);
      setOpen(false);
      onCreated?.();
    } catch (e) {
      setError(e.message || 'Erro ao criar tarefa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 border border-slate-300 px-2.5 py-1 hover:bg-slate-50"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar ao Plano de Ação
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 border border-slate-300 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.title}
          onChange={(e) => handle('title', e.target.value)}
          placeholder="Título da tarefa"
          className="col-span-2 border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <textarea
          value={form.description}
          onChange={(e) => handle('description', e.target.value)}
          rows={2}
          placeholder="Descrição / passo a passo"
          className="col-span-2 border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
        />
        <input
          value={form.ownerName}
          onChange={(e) => handle('ownerName', e.target.value)}
          placeholder="Responsável"
          className="border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <select
          value={form.priority}
          onChange={(e) => handle('priority', e.target.value)}
          className="border border-slate-300 px-2 py-1.5 text-xs bg-white"
        >
          {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={form.horizon}
          onChange={(e) => handle('horizon', e.target.value)}
          className="col-span-2 border border-slate-300 px-2 py-1.5 text-xs bg-white"
        >
          {HORIZON_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-slate-600 bg-white border border-slate-200 px-2 py-1 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 shrink-0" /> A tarefa entra direto no plano de ação central do grupo, vinculada a esta análise.
      </p>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          Criar Tarefa
        </button>
      </div>
    </div>
  );
}
