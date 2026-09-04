/**
 * FinancialActionsPanel
 * Painel executivo unificado: consolida Achados, Recomendações e Ações Propostas
 * em uma única visão coesa, agrupada por escopo (Data-base / Evolução / Validações).
 * Permite criar tarefas no plano de ação diretamente de cada recomendação.
 */
import React, { useMemo, useState } from "react";
import { financialKey, tenantKey } from '@/lib/query-client';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  AlertCircle, Lightbulb, ClipboardList, Plus, Loader2, CheckCircle2,
  Calendar, User, Flag, Target, ArrowRight, Sparkles, Check, X, EyeOff, Pencil, ChevronDown, ChevronRight, RotateCcw,
} from "lucide-react";
import { getFindingKeyFromRecommendation } from "./FinancialRecommendationsTab";
import { financialIndicatorRegistry } from "./indicators/financialIndicatorRegistry";
import AddToActionPlanButton from "./AddToActionPlanButton";

// Mapa código → label legível para preencher o cluster_key da tarefa
const INDICATOR_LABELS = Object.fromEntries(
  financialIndicatorRegistry.map((i) => [i.key, i.fullLabel || i.label])
);

const PRIORITY_OPTS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const HORIZON_OPTS = [
  { value: "30d", label: "30 dias" },
  { value: "60d", label: "60 dias" },
  { value: "90d", label: "90 dias" },
  { value: "180d", label: "180 dias" },
];

// Fallback só usado quando o achado ainda não tem classification (curadoria
// do consultor) — 3 cores, mesma paleta do semáforo acima.
const SEVERITY_ACCENT = {
  low: "#047857",
  medium: "#FFFF00",
  high: "#DC2626",
  critical: "#DC2626",
};

const PRIORITY_ACCENT = {
  critica: "#DC2626",
  alta: "#D97706",
  media: "#D9A420",
  baixa: "#94a3b8",
};

const CARD_CLS = "border border-slate-200 bg-white text-slate-700";

const SCOPE_LABEL = {
  period_snapshot: "Data-base",
  period_comparison: "Evolução",
  structural_validation: "Validações estruturais",
};

const SCOPES = ["period_snapshot", "period_comparison", "structural_validation"];

// ── Curadoria pro Relatório da Análise (semáforo, aprovar/editar/excluir) ──
// Mesma paleta de 3 cores do relatório (financial-report-html.service.ts,
// semaforoColor — vermelho/âmbar/verde, igual ao termômetro de Kanitz) — um
// ponto, não um badge cheio de cor, e nunca mais que 3 cores.
const SEMAFORO_RED = "#DC2626";
const SEMAFORO_AMBER = "#FFFF00";
const SEMAFORO_GREEN = "#047857";
const SEMAFORO_DOT = {
  critico: SEMAFORO_RED, atencao: SEMAFORO_AMBER, oportunidade: SEMAFORO_GREEN, informativo: SEMAFORO_GREEN,
};
const CLASSIFICATION_LABEL = { critico: "Crítico", atencao: "Atenção", oportunidade: "Oportunidade", informativo: "Informativo" };
const CLASSIFICATION_OPTS = Object.entries(CLASSIFICATION_LABEL);

const INCLUSION_LABEL = {
  candidate: "Candidato", approved: "Aprovado", edited: "Editado (aprovado)", excluded: "Excluído", internal_only: "Uso interno",
};
const INCLUSION_CLASS = {
  candidate: "bg-slate-100 text-slate-500",
  approved: "bg-emerald-100 text-emerald-700",
  edited: "bg-blue-100 text-blue-700",
  excluded: "bg-red-50 text-red-600",
  internal_only: "bg-slate-100 text-slate-500",
};

function semaforoDotColor(finding) {
  if (finding.classification && SEMAFORO_DOT[finding.classification]) return SEMAFORO_DOT[finding.classification];
  return SEVERITY_ACCENT[finding.severity] || SEVERITY_ACCENT.medium;
}

// ── RecommendationRow ──────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.proposals
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
function RecommendationRow({ rec, proposals, diagnosisId, tenantId }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: rec.title || "",
    diagnostic_thesis: rec.diagnostic_thesis || "",
    suggested_action: rec.suggested_action || "",
    expected_impact: rec.expected_impact || "",
  });

  const manageMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialRecommendation.update(rec.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'recommendations') }),
  });

  const status = rec.report_inclusion_status || "candidate";

  const saveEdit = () => {
    manageMutation.mutate({ report_inclusion_status: "edited", ...draft });
    setEditing(false);
  };

  const linkedProposals = proposals.filter(
    (p) => p.financial_recommendation_id === rec.id
  );
  const exportedProposal = linkedProposals.find((p) => p.status === "exported");
  const alreadyExported = !!exportedProposal;
  const recIndicatorCode = (rec.related_indicator_codes || []).find(
    (c) => typeof c === "string" && !c.startsWith("__fk__:")
  ) || "";
  const recIndicatorLabel = recIndicatorCode
    ? (INDICATOR_LABELS[recIndicatorCode] || recIndicatorCode)
    : "Análise financeira";

  return (
    <div className="ml-3 pl-3 border-l-2 border-slate-200">
      <div className={`${CARD_CLS} p-2.5 border-l-[3px]`} style={{ borderLeftColor: PRIORITY_ACCENT[rec.priority] || PRIORITY_ACCENT.media }}>
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="flex-1 text-xs font-semibold border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <p className="text-xs font-semibold flex-1">{rec.title}</p>
          )}
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 shrink-0">
            {rec.priority}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${INCLUSION_CLASS[status] || INCLUSION_CLASS.candidate}`}>
            {INCLUSION_LABEL[status] || status}
          </span>
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-1.5">
            <label className="block text-[11px] text-slate-500">Tese
              <textarea value={draft.diagnostic_thesis} onChange={(e) => setDraft((d) => ({ ...d, diagnostic_thesis: e.target.value }))} rows={2} className="w-full mt-0.5 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </label>
            <label className="block text-[11px] text-slate-500">Ação
              <textarea value={draft.suggested_action} onChange={(e) => setDraft((d) => ({ ...d, suggested_action: e.target.value }))} rows={2} className="w-full mt-0.5 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </label>
            <label className="block text-[11px] text-slate-500">Impacto
              <textarea value={draft.expected_impact} onChange={(e) => setDraft((d) => ({ ...d, expected_impact: e.target.value }))} rows={2} className="w-full mt-0.5 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancelar</button>
              <button
                onClick={saveEdit}
                disabled={manageMutation.isPending}
                className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-60"
              >
                {manageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salvar e aprovar
              </button>
            </div>
          </div>
        ) : (
          <>
            {rec.diagnostic_thesis && <p className="text-[11px] mt-1 text-slate-600"><strong>Tese:</strong> {rec.diagnostic_thesis}</p>}
            {rec.suggested_action && <p className="text-[11px] mt-0.5 text-slate-600"><strong>Ação:</strong> {rec.suggested_action}</p>}
            {rec.expected_impact && <p className="text-[11px] mt-0.5 text-slate-600"><strong>Impacto:</strong> {rec.expected_impact}</p>}
          </>
        )}

        {!editing && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {status !== "approved" && status !== "edited" && (
              <button
                onClick={() => manageMutation.mutate({ report_inclusion_status: "approved" })}
                disabled={manageMutation.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded disabled:opacity-50"
              >
                <Check className="w-3 h-3" /> Aprovar
              </button>
            )}
            {(status === "approved" || status === "edited") && (
              <button
                onClick={() => manageMutation.mutate({ report_inclusion_status: "candidate" })}
                disabled={manageMutation.isPending}
                title="Remove da seção 'Recomendações avulsas' do relatório sem excluir a recomendação — não afeta o envio ao Plano de Ação (é uma decisão independente)."
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" /> Desaprovar
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              disabled={manageMutation.isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50"
            >
              <Pencil className="w-3 h-3" /> Editar
            </button>
            {status !== "excluded" && (
              <button
                onClick={() => manageMutation.mutate({ report_inclusion_status: "excluded" })}
                disabled={manageMutation.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
              >
                <X className="w-3 h-3" /> Excluir
              </button>
            )}
            {status !== "internal_only" && (
              <button
                onClick={() => manageMutation.mutate({ report_inclusion_status: "internal_only" })}
                disabled={manageMutation.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50"
              >
                <EyeOff className="w-3 h-3" /> Uso interno
              </button>
            )}
          </div>
        )}

        {linkedProposals.length > 0 && (
          <div className="mt-2 space-y-1">
            {linkedProposals.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[11px] bg-slate-50 px-2 py-1">
                <ClipboardList className="w-3 h-3 shrink-0" />
                <span className="flex-1 truncate">{p.title}</span>
                <span className="text-[10px] uppercase font-bold text-slate-500">{p.status}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2">
          <AddToActionPlanButton
            diagnosisId={diagnosisId}
            tenantId={tenantId}
            recommendationId={rec.id}
            defaultTitle={rec.title}
            defaultDescription={rec.suggested_action || ""}
            sourceLabel={recIndicatorLabel}
            indicatorCode={recIndicatorCode}
            alreadyInPlan={alreadyExported}
            actionTaskId={exportedProposal?.fal_action_task_id ?? null}
          />
        </div>
      </div>
    </div>
  );
}

// ── FindingCard (anchor) ──────────────────────────────────────────────────────
/**
 * Curadoria completa do achado pro Relatório da Análise: aprovar/editar/
 * excluir/uso interno (report_inclusion_status — só achados aprovados ou
 * editados entram no relatório gerado, tela e PDF, mesma fonte de dados) +
 * envio direto ao Plano de Ação (sem depender de uma FinancialRecommendation
 * já existir — necessário pros achados de cruzamento automático, que não
 * têm mapeamento em RECOMMENDATION_MAP e por isso nunca geram recomendação
 * pelo fluxo automático).
 * @param {Object} props
 * @param {any=} props.finding
 * @param {any=} props.recs
 * @param {any=} props.proposals
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
function FindingCard({ finding, recs, proposals, diagnosisId, tenantId }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(finding.report_inclusion_edited_text || finding.description || "");
  const [classification, setClassification] = useState(finding.classification || "atencao");

  const manageMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialFinding.update(finding.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'findings') }),
  });

  const status = finding.report_inclusion_status || "candidate";
  const displayText = finding.report_inclusion_edited_text || finding.description || "";

  const saveEdit = () => {
    manageMutation.mutate({ report_inclusion_edited_text: draftText, classification });
    setEditing(false);
    setExpanded(true);
  };

  return (
    <div className={`${CARD_CLS} rounded-lg overflow-hidden`}>
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full flex items-center gap-2.5 p-3 text-left">
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: semaforoDotColor(finding) }} />
        <p className="text-sm font-semibold flex-1">{finding.title}</p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${INCLUSION_CLASS[status] || INCLUSION_CLASS.candidate}`}>
          {INCLUSION_LABEL[status] || status}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 pt-2.5">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500">Classificação:</label>
                <select value={classification} onChange={(e) => setClassification(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                  {CLASSIFICATION_OPTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancelar</button>
                <button
                  onClick={saveEdit}
                  disabled={manageMutation.isPending}
                  className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-60"
                >
                  {manageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Salvar e aprovar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">{displayText}</p>
          )}

          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
            {finding.period && <span>período {finding.period}</span>}
            {finding.comparison_period && <span>· vs {finding.comparison_period}</span>}
            {finding.financial_indicator && <span>· {finding.financial_indicator}</span>}
          </div>

          {!editing && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {status !== "approved" && status !== "edited" && (
                <button
                  onClick={() => manageMutation.mutate({ report_inclusion_status: "approved", classification })}
                  disabled={manageMutation.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Aprovar
                </button>
              )}
              {(status === "approved" || status === "edited") && (
                <button
                  onClick={() => manageMutation.mutate({ report_inclusion_status: "candidate" })}
                  disabled={manageMutation.isPending}
                  title="Remove do relatório sem excluir o achado — mantém o texto editado, caso exista, pra reaprovar depois. Não afeta o envio ao Plano de Ação (é uma decisão independente)."
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Desaprovar
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                disabled={manageMutation.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50"
              >
                <Pencil className="w-3 h-3" /> Editar
              </button>
              {status !== "excluded" && (
                <button
                  onClick={() => manageMutation.mutate({ report_inclusion_status: "excluded" })}
                  disabled={manageMutation.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                >
                  <X className="w-3 h-3" /> Excluir
                </button>
              )}
              {status !== "internal_only" && (
                <button
                  onClick={() => manageMutation.mutate({ report_inclusion_status: "internal_only" })}
                  disabled={manageMutation.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50"
                >
                  <EyeOff className="w-3 h-3" /> Uso interno
                </button>
              )}
              <div className="ml-auto">
                <AddToActionPlanButton
                  diagnosisId={diagnosisId}
                  tenantId={tenantId}
                  findingId={finding.id}
                  defaultTitle={finding.title}
                  defaultDescription={displayText}
                  sourceLabel={finding.financial_indicator || "Análise Financeira"}
                  alreadyInPlan={finding.action_plan_status === "converted_to_task"}
                  actionTaskId={finding.action_task_id ?? null}
                />
              </div>
            </div>
          )}

          {recs.length > 0 && (
            <div className="pt-2 space-y-2">
              {recs.map((rec) => (
                <RecommendationRow key={rec.id} rec={rec} proposals={proposals} diagnosisId={diagnosisId} tenantId={tenantId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ManualTaskCreator (top-level) ─────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
function ManualTaskCreator({ diagnosisId, tenantId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", ownerName: "", priority: "medium", horizon: "90d",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const handle = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const submit = async () => {
    if (!form.title.trim()) { setError("Título é obrigatório."); return; }
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      // Cria a tarefa diretamente no plano central do grupo (mesma lógica do 8D):
      // resolve o plano a partir do diagnóstico financeiro → grupo.
      const resp = await base44.functions.invoke("convertFinancialRecommendation", {
        financial_diagnosis_id: diagnosisId,
        task_title: form.title,
        description: form.description || "",
        horizon: form.horizon,
        owner_name: form.ownerName,
        priority: form.priority,
        tenant_id: tenantId,
        indicator_label: "Análise financeira",
      });
      const taskCreated = !!resp?.data?.task;
      setSuccess(taskCreated ? "Tarefa criada no plano de ação do grupo!" : "Não foi possível criar a tarefa.");
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'findings') });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'recommendations') });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'action-proposals') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'group-action-plan') });
      setForm({ title: "", description: "", ownerName: "", priority: "medium", horizon: "90d" });
    } catch (e) {
      setError(e.message || "Erro ao criar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors"
      >
        {open ? <ArrowRight className="w-4 h-4 rotate-90" /> : <Plus className="w-4 h-4" />}
        Nova Tarefa / Incursão
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm">
          {success && (
            <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1 mb-1"><Target className="w-3 h-3" />Título</label>
            <input value={form.title} onChange={(e) => handle("title", e.target.value)} placeholder="Título da tarefa" className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => handle("description", e.target.value)} rows={2} placeholder="Passo a passo..." className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1 mb-1"><User className="w-3 h-3" />Responsável</label>
              <input value={form.ownerName} onChange={(e) => handle("ownerName", e.target.value)} placeholder="Nome/área" className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1 mb-1"><Flag className="w-3 h-3" />Prioridade</label>
              <select value={form.priority} onChange={(e) => handle("priority", e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
                {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" />Prazo</label>
              <select value={form.horizon} onChange={(e) => handle("horizon", e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
                {HORIZON_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> A tarefa será incluída automaticamente no plano de ação central do grupo.
          </p>
          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
          <button onClick={submit} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Tarefa no Plano do Grupo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.diagnosis
 */
export default function FinancialActionsPanel({ diagnosisId, tenantId, diagnosis }) {
  const { data: findings = [], isLoading: lf } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, "-created_date", 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });
  const { data: recommendations = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'recommendations'),
    queryFn: () => base44.entities.FinancialRecommendation.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, "-created_date", 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });
  const { data: proposals = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'action-proposals'),
    queryFn: () => base44.entities.FinancialActionProposal.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, "-created_date", 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });
  const recsByFindingKey = useMemo(() => {
    const map = {};
    for (const rec of recommendations) {
      const fk = getFindingKeyFromRecommendation(rec);
      if (fk) (map[fk] = map[fk] || []).push(rec);
    }
    return map;
  }, [recommendations]);

  const orphanRecs = useMemo(
    () => recommendations.filter((r) => !getFindingKeyFromRecommendation(r)),
    [recommendations]
  );

  const groups = useMemo(() => {
    const g = { period_snapshot: [], period_comparison: [], structural_validation: [], other: [] };
    for (const f of findings) {
      const fk = f.finding_key || f.id;
      const recs = recsByFindingKey[fk] || [];
      const entry = { finding: f, recs };
      const scope = f.finding_scope;
      if (scope && g[scope]) g[scope].push(entry);
      else g.other.push(entry);
    }
    return g;
  }, [findings, recsByFindingKey]);

  if (lf) return <p className="text-sm text-slate-400 py-8 text-center">Carregando…</p>;

  const total = findings.length + orphanRecs.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <strong>{findings.length}</strong> achados
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <strong>{recommendations.length}</strong> recomendações
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ClipboardList className="w-4 h-4 text-emerald-500" />
          <strong>{proposals.length}</strong> ações propostas
        </div>
      </div>

      <ManualTaskCreator diagnosisId={diagnosisId} tenantId={tenantId} />

      {total === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum achado ou recomendação gerada ainda.</p>
          <p className="text-xs mt-1">Use "Nova Tarefa / Incursão" acima para registrar uma ação manual.</p>
        </div>
      )}

      {SCOPES.map((scope) => {
        const items = groups[scope];
        if (!items || items.length === 0) return null;
        return (
          <div key={scope}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{SCOPE_LABEL[scope]}</span>
              <span className="text-xs text-slate-400">({items.length})</span>
            </div>
            <div className="space-y-2.5">
              {items.map(({ finding, recs }) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  recs={recs}
                  proposals={proposals}
                  diagnosisId={diagnosisId}
                  tenantId={tenantId}
                />
              ))}
            </div>
          </div>
        );
      })}

      {orphanRecs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Recomendações Avulsas</span>
            <span className="text-xs text-slate-400">({orphanRecs.length})</span>
          </div>
          <div className="space-y-2.5">
            {orphanRecs.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                proposals={proposals}
                diagnosisId={diagnosisId}
                tenantId={tenantId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}