/**
 * FinancialIndicatorHelpDrawer
 * Drawer lateral com: fórmula, achados/recomendações/ações propostas vinculadas,
 * e formulário de criação de tarefa com incursão direta no plano de ação.
 */
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFinancialQueries, invalidateActionPlanQueries } from "@/lib/query-client";
import { base44 } from "@/api/base44Client";
import {
  X, Info, AlertCircle, Lightbulb, ClipboardList, Plus, Loader2,
  CheckCircle2, Calendar, User, Flag, Target, ArrowRight,
} from "lucide-react";
import { getFindingKeyFromRecommendation } from "@/components/financial/FinancialRecommendationsTab";

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

const SEVERITY_CLS = {
  low: "border-slate-200 bg-slate-50 text-slate-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

const PRIORITY_CLS = {
  critica: "border-red-200 bg-red-50 text-red-700",
  alta: "border-orange-200 bg-orange-50 text-orange-700",
  media: "border-amber-200 bg-amber-50 text-amber-700",
  baixa: "border-slate-200 bg-slate-50 text-slate-700",
};

// ── Matching helpers ─────────────────────────────────────────────────────────
function findFindingsForIndicator(findings, indicatorKey, indicatorLabel) {
  const k = indicatorKey.toLowerCase();
  const l = (indicatorLabel || "").toLowerCase();
  return findings.filter((f) => {
    const fi = (f.financial_indicator || "").toLowerCase();
    if (!fi) return false;
    return fi === k || fi === l || fi.includes(k) || (l && fi.includes(l));
  });
}

function findRecsForIndicator(recommendations, findings, indicatorKey, indicatorLabel) {
  const linkedFindingIds = new Set(findings.map((f) => f.id));
  const k = indicatorKey.toLowerCase();
  const l = (indicatorLabel || "").toLowerCase();
  return recommendations.filter((rec) => {
    // Check related_indicator_codes (non __fk__ entries)
    const codes = (rec.related_indicator_codes || []).filter(
      (c) => typeof c === "string" && !c.startsWith("__fk__:")
    );
    if (codes.some((c) => c.toLowerCase() === k || (l && c.toLowerCase() === l))) return true;
    // Check via finding key
    const fk = getFindingKeyFromRecommendation(rec);
    if (fk && linkedFindingIds.has(fk)) return true;
    return false;
  });
}

function findProposalsForIndicator(proposals, recommendations) {
  const recIds = new Set(recommendations.map((r) => r.id));
  return proposals.filter((p) => p.financial_recommendation_id && recIds.has(p.financial_recommendation_id));
}

// ── Task Creation Form ───────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.indicator
 * @param {any=} props.diagnosis
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.actionPlans
 * @param {any=} props.onCreated
 */
function TaskCreateForm({ indicator, diagnosis, diagnosisId, tenantId, actionPlans, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    ownerName: "",
    priority: "medium",
    horizon: "90d",
    planId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleField = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Título é obrigatório."); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Cria a tarefa diretamente no plano central do grupo (mesma lógica do 8D)
      const resp = await base44.functions.invoke("convertFinancialRecommendation", {
        financial_diagnosis_id: diagnosisId,
        task_title: form.title,
        description: form.description || "",
        horizon: form.horizon,
        owner_name: form.ownerName,
        priority: form.priority,
        tenant_id: tenantId,
        indicator_code: indicator.key,
        indicator_label: indicator.fullLabel || indicator.label,
      });
      const taskCreated = !!resp?.data?.task;

      setSuccess(taskCreated
        ? "Tarefa criada no plano de ação do grupo!"
        : "Não foi possível criar a tarefa.");

      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      await invalidateActionPlanQueries(queryClient, null, null, tenantId);

      setForm({ title: "", description: "", ownerName: "", priority: "medium", horizon: "90d", planId: form.planId });
      onCreated?.();
    } catch (e) {
      setError(e.message || "Erro ao criar tarefa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 mt-3">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1 mb-1">
          <Target className="w-3 h-3" /> Título da Tarefa
        </label>
        <input
          value={form.title}
          onChange={(e) => handleField("title", e.target.value)}
          placeholder={`Ação sobre: ${indicator.fullLabel || indicator.label}`}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1 block">
          Descrição / Passo a Passo
        </label>
        <textarea
          value={form.description}
          onChange={(e) => handleField("description", e.target.value)}
          rows={2}
          placeholder="O que precisa ser feito..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      </div>

      {/* Responsible */}
      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1 mb-1">
          <User className="w-3 h-3" /> Responsável
        </label>
        <input
          value={form.ownerName}
          onChange={(e) => handleField("ownerName", e.target.value)}
          placeholder="Nome ou área responsável"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Priority + Horizon */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Flag className="w-3 h-3" /> Prioridade
          </label>
          <select
            value={form.priority}
            onChange={(e) => handleField("priority", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Calendar className="w-3 h-3" /> Prazo
          </label>
          <select
            value={form.horizon}
            onChange={(e) => handleField("horizon", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {HORIZON_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Action Plan */}
      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1 block">
          Plano de Ação (para converter em tarefa)
        </label>
        <select
          value={form.planId}
          onChange={(e) => handleField("planId", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— Criar apenas recomendação (sem plano) —</option>
          {actionPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.target_type || "plano"} · {p.status || "draft"} · criado {p.created_date?.slice(0, 10) || "—"}
            </option>
          ))}
        </select>
        {actionPlans.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            Nenhum plano encontrado para este escopo. A recomendação ficará pendente para conversão posterior.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {submitting ? "Criando..." : form.planId ? "Criar Tarefa no Plano" : "Criar Recomendação"}
      </button>
    </div>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.icon
 * @param {any=} props.label
 * @param {any=} props.items
 * @param {any=} props.render
 */
function InsightCard({ icon: Icon, label, items, render }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-slate-400">({items.length})</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => render(item, i))}
      </div>
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.indicator
 * @param {any=} props.diagnosis
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.findings
 * @param {any=} props.recommendations
 * @param {any=} props.proposals
 * @param {any=} props.actionPlans
 */
export default function FinancialIndicatorHelpDrawer({
  open, onClose, indicator, diagnosis, diagnosisId, tenantId,
  findings = [], recommendations = [], proposals = [], actionPlans = [],
}) {
  const [showTaskForm, setShowTaskForm] = useState(false);

  if (!open || !indicator) return null;

  const linkedFindings = findFindingsForIndicator(findings, indicator.key, indicator.fullLabel);
  const linkedRecs = findRecsForIndicator(recommendations, linkedFindings, indicator.key, indicator.fullLabel);
  const linkedProposals = findProposalsForIndicator(proposals, linkedRecs);
  const hasInsights = linkedFindings.length > 0 || linkedRecs.length > 0 || linkedProposals.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{indicator.fullLabel || indicator.label}</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {indicator.groupLabel}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Formula */}
          {indicator.formula && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Fórmula</span>
              </div>
              <p className="text-xs text-blue-800 font-mono">{indicator.formula}</p>
            </div>
          )}

          {/* Referência de Mercado */}
          {indicator.benchmark && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Referência de Mercado</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-1">
                <span className="text-emerald-700">Saudável</span>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700">Médio</span>
                <span className="text-slate-300">·</span>
                <span className="text-red-700">Atenção</span>
              </div>
              <p className="text-xs text-slate-700 font-mono leading-relaxed">{indicator.benchmark.referencia}</p>
              {indicator.benchmark.descritivo && (
                <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{indicator.benchmark.descritivo}</p>
              )}
            </div>
          )}

          {/* Insights */}
          {hasInsights ? (
            <div className="space-y-4">
              <InsightCard
                icon={AlertCircle}
                label="Achados"
                items={linkedFindings}
                render={(f, i) => (
                  <div key={f.id || i} className={`border rounded-lg p-2.5 ${SEVERITY_CLS[f.severity] || SEVERITY_CLS.medium}`}>
                    <p className="text-xs font-semibold">{f.title}</p>
                    {f.description && <p className="text-[11px] mt-0.5 opacity-80">{f.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] opacity-60">
                      {f.severity && <span>· {f.severity}</span>}
                      {f.period && <span>· {f.period}</span>}
                    </div>
                  </div>
                )}
              />

              <InsightCard
                icon={Lightbulb}
                label="Recomendações"
                items={linkedRecs}
                render={(rec, i) => (
                  <div key={rec.id || i} className={`border rounded-lg p-2.5 ${PRIORITY_CLS[rec.priority] || PRIORITY_CLS.media}`}>
                    <p className="text-xs font-semibold">{rec.title}</p>
                    {rec.diagnostic_thesis && <p className="text-[11px] mt-0.5 opacity-80"><strong>Tese:</strong> {rec.diagnostic_thesis}</p>}
                    {rec.suggested_action && <p className="text-[11px] mt-0.5 opacity-80"><strong>Ação:</strong> {rec.suggested_action}</p>}
                  </div>
                )}
              />

              <InsightCard
                icon={ClipboardList}
                label="Ações Propostas"
                items={linkedProposals}
                render={(p, i) => (
                  <div key={p.id || i} className={`border rounded-lg p-2.5 ${PRIORITY_CLS[p.priority] || PRIORITY_CLS.media}`}>
                    <p className="text-xs font-semibold">{p.title}</p>
                    {p.description && <p className="text-[11px] mt-0.5 opacity-80">{p.description}</p>}
                    <span className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded bg-white/60 font-bold uppercase">{p.status || "proposed"}</span>
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Nenhum achado ou recomendação vinculado a este indicador.</p>
              <p className="text-[11px] mt-1">Crie uma tarefa abaixo para registrar uma ação.</p>
            </div>
          )}

          {/* Task creation */}
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={() => setShowTaskForm((v) => !v)}
              className="flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              {showTaskForm ? <ArrowRight className="w-4 h-4 rotate-90" /> : <Plus className="w-4 h-4" />}
              Criar Tarefa / Incursão no Plano
            </button>
            {showTaskForm && (
              <TaskCreateForm
                indicator={indicator}
                diagnosis={diagnosis}
                diagnosisId={diagnosisId}
                tenantId={tenantId}
                actionPlans={actionPlans}
                onCreated={() => {/* could close form or leave open */}}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}