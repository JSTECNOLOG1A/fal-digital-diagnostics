/**
 * FinancialActionsPanel
 * Painel executivo unificado: consolida Achados, Recomendações e Ações Propostas
 * em uma única visão coesa, agrupada por escopo (Data-base / Evolução / Validações).
 * Permite criar tarefas no plano de ação diretamente de cada recomendação.
 */
import React, { useMemo, useState } from "react";
import { financialKey, tenantKey } from '@/lib/query-client';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  AlertCircle, Lightbulb, ClipboardList, Plus, Loader2, CheckCircle2,
  Calendar, User, Flag, Target, ArrowRight, Sparkles,
} from "lucide-react";
import { getFindingKeyFromRecommendation } from "./FinancialRecommendationsTab";
import { financialIndicatorRegistry } from "./indicators/financialIndicatorRegistry";

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

const SCOPE_LABEL = {
  period_snapshot: "Data-base",
  period_comparison: "Evolução",
  structural_validation: "Validações Estruturais",
};

const SCOPES = ["period_snapshot", "period_comparison", "structural_validation"];

// ── ConvertForm: cria tarefa no plano a partir de uma recomendação ─────────────
/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.onDone
 */
function ConvertForm({ rec, diagnosisId, tenantId, onDone }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: rec.title || "",
    description: rec.suggested_action || rec.recommendation_text || "",
    ownerName: rec.suggested_owner_area || "",
    priority: rec.priority || "medium",
    horizon: "90d",
    planId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handle = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      // Extrai o indicador de origem da recomendação para preencher Dimensão/Cluster
      const recIndicatorCode = (rec.related_indicator_codes || []).find(
        (c) => typeof c === "string" && !c.startsWith("__fk__:")
      ) || "";
      const recIndicatorLabel = recIndicatorCode
        ? (INDICATOR_LABELS[recIndicatorCode] || recIndicatorCode)
        : "Análise Financeira";

      await base44.functions.invoke("convertFinancialRecommendation", {
        financial_recommendation_id: rec.id,
        task_title: form.title,
        description: form.description,
        horizon: form.horizon,
        owner_name: form.ownerName,
        priority: form.priority,
        tenant_id: tenantId,
        indicator_code: recIndicatorCode,
        indicator_label: recIndicatorLabel,
      });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'action-proposals') });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'recommendations') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'group-action-plan') });
      onDone?.();
    } catch (e) {
      setError(e.message || "Erro ao converter em tarefa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.title}
          onChange={(e) => handle("title", e.target.value)}
          placeholder="Título da tarefa"
          className="col-span-2 border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <input
          value={form.ownerName}
          onChange={(e) => handle("ownerName", e.target.value)}
          placeholder="Responsável"
          className="border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <select
          value={form.priority}
          onChange={(e) => handle("priority", e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={form.horizon}
          onChange={(e) => handle("horizon", e.target.value)}
          className="col-span-2 border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          {HORIZON_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> A tarefa será incluída automaticamente no plano de ação central do grupo.
      </p>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Criar Tarefa
        </button>
      </div>
    </div>
  );
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
  const [showConvert, setShowConvert] = useState(false);
  const linkedProposals = proposals.filter(
    (p) => p.financial_recommendation_id === rec.id
  );

  return (
    <div className="ml-3 pl-3 border-l-2 border-slate-200">
      <div className={`rounded-lg border p-2.5 ${PRIORITY_CLS[rec.priority] || PRIORITY_CLS.media}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold flex-1">{rec.title}</p>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/60 shrink-0">
            {rec.priority}
          </span>
        </div>
        {rec.diagnostic_thesis && <p className="text-[11px] mt-1 opacity-80"><strong>Tese:</strong> {rec.diagnostic_thesis}</p>}
        {rec.suggested_action && <p className="text-[11px] mt-0.5 opacity-80"><strong>Ação:</strong> {rec.suggested_action}</p>}
        {rec.expected_impact && <p className="text-[11px] mt-0.5 opacity-80"><strong>Impacto:</strong> {rec.expected_impact}</p>}

        {linkedProposals.length > 0 && (
          <div className="mt-2 space-y-1">
            {linkedProposals.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[11px] bg-white/50 rounded px-2 py-1">
                <ClipboardList className="w-3 h-3 shrink-0" />
                <span className="flex-1 truncate">{p.title}</span>
                <span className="text-[10px] uppercase font-bold opacity-70">{p.status}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowConvert((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
        >
          {showConvert ? <ArrowRight className="w-3 h-3 rotate-90" /> : <Plus className="w-3 h-3" />}
          {showConvert ? "Cancelar" : "Converter em Tarefa"}
        </button>
        {showConvert && (
          <ConvertForm
            rec={rec}
            diagnosisId={diagnosisId}
            tenantId={tenantId}
            onDone={() => setShowConvert(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── FindingCard (anchor) ──────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.finding
 * @param {any=} props.recs
 * @param {any=} props.proposals
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
function FindingCard({ finding, recs, proposals, diagnosisId, tenantId }) {
  return (
    <div className={`rounded-lg border p-3 ${SEVERITY_CLS[finding.severity] || SEVERITY_CLS.medium}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{finding.title}</p>
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/60 shrink-0">
          {finding.severity}
        </span>
      </div>
      {finding.description && <p className="text-xs mt-1 opacity-80">{finding.description}</p>}
      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] opacity-60">
        {finding.period && <span>período {finding.period}</span>}
        {finding.comparison_period && <span>· vs {finding.comparison_period}</span>}
        {finding.financial_indicator && <span>· {finding.financial_indicator}</span>}
      </div>

      {recs.length > 0 && (
        <div className="mt-3 space-y-2">
          {recs.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              proposals={proposals}
              diagnosisId={diagnosisId}
              tenantId={tenantId}
            />
          ))}
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
        indicator_label: "Análise Financeira",
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
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors"
      >
        {open ? <ArrowRight className="w-4 h-4 rotate-90" /> : <Plus className="w-4 h-4" />}
        Nova Tarefa / Incursão
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm">
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1 mb-1"><Target className="w-3 h-3" />Título</label>
            <input value={form.title} onChange={(e) => handle("title", e.target.value)} placeholder="Título da tarefa" className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => handle("description", e.target.value)} rows={2} placeholder="Passo a passo..." className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
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
          <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> A tarefa será incluída automaticamente no plano de ação central do grupo.
          </p>
          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
          <button onClick={submit} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
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