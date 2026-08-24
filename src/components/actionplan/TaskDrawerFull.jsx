/**
 * TaskDrawerFull
 * Drawer completo da Central do Plano de Ação FAL.
 * 8 elementos obrigatórios + check-in + histórico de alterações.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  X, AlertTriangle, Zap, User, FileText, Link2, TrendingUp,
  Lock, ChevronDown, ChevronUp, Save, CheckCircle2, Clock,
  History, MessageSquare, Target, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { assessmentKey, invalidateActionPlanQueries } from '@/lib/query-client';

// ─── Config ───────────────────────────────────────────────────
const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Crítico', dot: 'bg-red-500' },
  high:     { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Alta', dot: 'bg-amber-500' },
  medium:   { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Média', dot: 'bg-blue-400' },
  low:      { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Baixa', dot: 'bg-slate-400' },
};

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A Fazer',      cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'in_progress', label: 'Em Andamento', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'blocked',     label: 'Bloqueada',    cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'done',        label: 'Concluído',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'cancelled',   label: 'Cancelado',    cls: 'bg-slate-100 text-slate-400 border-slate-200' },
];

const ACTION_TYPE_STYLE = {
  quick_win:    { label: 'Quick Win',   cls: 'bg-emerald-100 text-emerald-700' },
  structural:   { label: 'Estrutural',  cls: 'bg-indigo-100 text-indigo-700' },
  foundational: { label: 'Fundacional', cls: 'bg-purple-100 text-purple-700' },
  compliance:   { label: 'Compliance',  cls: 'bg-slate-100 text-slate-600' },
  operational:  { label: 'Operacional', cls: 'bg-teal-100 text-teal-700' },
};

const ORIGIN_TYPE_LABEL = {
  cluster:         'Cluster FAL',
  subdimension:    'Subdimensão FAL',
  dimension:       'Dimensão FAL',
  killer_question: 'Pergunta Crítica',
  question:        'Pergunta FAL',
  manual:          'Manual (Consultor)',
};

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

// ─── Sub-components ───────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.children
 * @param {any=} props.defaultOpen
 * @param {any=} props.accent
  * @param {any=} props.onUpdated
 */
function SectionBlock({ title, icon: Icon, children, defaultOpen = true, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-xl overflow-hidden ${accent || 'border-slate-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.children
 * @param {any=} props.required
 * @param {any=} props.missing
 */
function Field({ label, children, required, missing }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        {required && missing && (
          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">Pendente</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.allTasks
 * @param {any=} props.planId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onSaved
  * @param {any=} props.onUpdated
 */
export default function TaskDrawerFull({ task, allTasks = [], planId, tenantId, onClose, onSaved }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('execution');
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({}));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkinMode, setCheckinMode] = useState(false);
  const [checkin, setCheckin] = useState({ progress: 0, status: '', comment: '', blocked_reason: '', completion_evidence: '' });

  // Fetch task reviews (history) — always called (hooks can't be conditional)
  const taskId = task?.id;
  const { data: taskReviews = [] } = useQuery({
    queryKey: assessmentKey(tenantId, null, 'task-reviews', taskId),
    queryFn: () => base44.entities.ActionTaskReview.filter({ action_task_id: taskId, tenant_id: tenantId }, '-created_date', 50),
    enabled: !!taskId && !!tenantId,
  });

  useEffect(() => {
    if (task) {
      setForm({
        status: task.status || 'todo',
        assigned_to: task.assigned_to || '',
        owner_name: task.owner_name || '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        progress_percentage: task.progress_percentage ?? 0,
        consultant_notes: task.consultant_notes || '',
        priority: task.priority || 'medium',
        horizon: task.horizon || '90d',
        title: task.title || '',
        description: task.description || '',
        expected_evidence: task.expected_evidence || '',
        blocked_reason: task.blocked_reason || '',
        completion_evidence: task.completion_evidence || '',
        execution_guidance: task.execution_guidance || task.how_to_execute || '',
      });
      setCheckin({ progress: task.progress_percentage ?? 0, status: task.status || 'todo', comment: '', blocked_reason: task.blocked_reason || '', completion_evidence: task.completion_evidence || '' });
      setSaved(false);
      setCheckinMode(false);
    }
  }, [task?.id]);

  if (!task) return null;

  const p = PRIORITY_STYLE[form.priority] || PRIORITY_STYLE.medium;
  const at = ACTION_TYPE_STYLE[task.action_type] || ACTION_TYPE_STYLE.structural;
  const isManual = task.origin_type === 'manual';
  const isBlocked = form.status === 'blocked';
  const isDone = form.status === 'done';

  const depTasks = (task.dependency_task_keys || [])
    .map(k => allTasks.find(t => t.task_key === k))
    .filter(Boolean);

  const today = new Date();
  const isOverdue = task.due_date && !isDone && new Date(task.due_date) < today;

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      status: form.status,
      assigned_to: form.assigned_to || null,
      owner_name: form.owner_name || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      progress_percentage: Number(form.progress_percentage) || 0,
      consultant_notes: form.consultant_notes || null,
      priority: form.priority,
      horizon: form.horizon,
      expected_evidence: form.expected_evidence || null,
      blocked_reason: form.blocked_reason || null,
      completion_evidence: form.completion_evidence || null,
      execution_guidance: form.execution_guidance || null,
      ...(isManual ? { title: form.title, description: form.description } : {}),
    };
    if (isDone) { updates.progress_percentage = 100; }

    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates,
      source: 'drawer_full',
      comment: form.consultant_notes && form.consultant_notes !== task.consultant_notes
        ? form.consultant_notes : undefined,
    });

    setSaved(true);
    setSaving(false);
    onSaved?.();
  };

  const handleCheckin = async () => {
    if (!checkin.comment && checkin.progress === (task.progress_percentage ?? 0) && checkin.status === task.status) return;
    setSaving(true);
    const updates = {
      progress_percentage: Number(checkin.progress),
      status: checkin.status,
      last_checkin_at: new Date().toISOString(),
      last_checkin_comment: checkin.comment,
    };
    if (checkin.blocked_reason) updates.blocked_reason = checkin.blocked_reason;
    if (checkin.completion_evidence) updates.completion_evidence = checkin.completion_evidence;
    if (checkin.status === 'done') updates.progress_percentage = 100;

    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates,
      source: 'checkin',
      comment: checkin.comment,
    });

    setSaving(false);
    setCheckinMode(false);
    onSaved?.();
    await invalidateActionPlanQueries(qc, null, null, tenantId);
  };

  const tabs = [
    { key: 'execution', label: 'Execução' },
    { key: 'details', label: 'Detalhes' },
    { key: 'checkin', label: 'Check-in' },
    { key: 'history', label: 'Histórico' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* ── Header ────────────────────────────────── */}
        <div className="flex items-start justify-between p-4 border-b bg-white">
          <div className="flex-1 min-w-0 pr-3">
            {isManual ? (
              <textarea
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="text-sm font-bold text-slate-900 w-full resize-none border-0 p-0 focus:ring-0 focus:outline-none bg-transparent leading-snug"
                rows={2}
              />
            ) : (
              <h2 className="text-sm font-bold text-slate-900 leading-snug">{task.title}</h2>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${p.badge}`}>{p.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${at.cls}`}>{at.label}</span>
              {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencida</span>}
              {isBlocked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1"><Lock className="w-3 h-3" /> Bloqueada</span>}
              {!task.assigned_to && !task.owner_name && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold">Sem responsável</span>}
              {!task.due_date && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 font-semibold">Sem prazo</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5 p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab bar ───────────────────────────────── */}
        <div className="flex border-b bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 text-xs py-2.5 font-medium transition-colors border-b-2 ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ═══ TAB: EXECUÇÃO ═════════════════════════ */}
          {activeTab === 'execution' && (
            <>
              {/* POR QUÊ */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Por que esta tarefa existe</span>
                </div>
                {task.reason ? (
                  <p className="text-xs text-amber-900 leading-relaxed">{task.reason}</p>
                ) : task.origin_detail ? (
                  <p className="text-xs text-amber-900 leading-relaxed">{task.origin_detail}</p>
                ) : (
                  <p className="text-xs text-amber-500 italic">Sem justificativa registrada.</p>
                )}
                {(task.dimension_key || task.cluster_key) && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium mt-1">
                    <span>Diagnóstico FAL</span>
                    {task.dimension_key && <><ArrowRight className="w-3 h-3" /><span>{DIM_LABELS[task.dimension_key] || task.dimension_key}</span></>}
                    {task.cluster_key && <><ArrowRight className="w-3 h-3" /><span>{task.cluster_key.replace(/_/g, ' ')}</span></>}
                  </div>
                )}
                {task.origin_score != null && (
                  <div className="flex items-center gap-2 text-[10px] mt-1">
                    <div className={`w-2 h-2 rounded-full ${task.origin_score < 1 ? 'bg-red-500' : task.origin_score < 1.8 ? 'bg-amber-500' : 'bg-blue-400'}`} />
                    <span className="text-amber-700 font-bold">Score de origem: {Number(task.origin_score).toFixed(2)} / 3.00</span>
                  </div>
                )}
              </div>

              {/* COMO */}
              {(task.how_to_execute || task.execution_guidance) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Como executar</span>
                  </div>
                  <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-line">
                    {task.execution_guidance || task.how_to_execute}
                  </p>
                </div>
              )}

              {/* STATUS + PROGRESSO */}
              <SectionBlock title="Status & Progresso" icon={TrendingUp} defaultOpen={true}>
                <Field label="Status">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setForm(f => ({ ...f, status: s.value }))}
                        className={`text-xs px-3 py-1 rounded-full border-2 font-medium transition-all ${
                          form.status === s.value ? s.cls + ' shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </Field>

                {isBlocked && (
                  <Field label="Motivo do bloqueio" required missing={!form.blocked_reason}>
                    {!form.blocked_reason && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Bloqueio sem motivo registrado</span>
                      </div>
                    )}
                    <textarea
                      value={form.blocked_reason}
                      onChange={e => setForm(f => ({ ...f, blocked_reason: e.target.value }))}
                      placeholder="Ex: Aguardando fechamento contábil de abril..."
                      className="w-full text-xs border border-amber-300 bg-amber-50 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-amber-400 focus:outline-none"
                      rows={2}
                    />
                  </Field>
                )}

                <Field label="Avanço (%)">
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={100} step={5}
                      value={form.progress_percentage}
                      onChange={e => setForm(f => ({ ...f, progress_percentage: Number(e.target.value) }))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-sm font-bold text-slate-700 w-10 text-right">{form.progress_percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${form.progress_percentage}%` }} />
                  </div>
                </Field>
              </SectionBlock>

              {/* DONO + PRAZO */}
              <SectionBlock title="Responsável & Prazo" icon={User} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome do responsável" required missing={!form.owner_name && !form.assigned_to}>
                    <input
                      type="text"
                      value={form.owner_name}
                      onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                      placeholder="Ex: Ana Lima"
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    />
                  </Field>
                  <Field label="E-mail do responsável">
                    <input
                      type="text"
                      value={form.assigned_to}
                      onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                      placeholder="email@empresa.com"
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início previsto">
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    />
                  </Field>
                  <Field label="Prazo final" required missing={!form.due_date}>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className={`w-full text-xs border rounded-lg p-2 focus:ring-1 focus:outline-none ${
                        isOverdue ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-slate-200 focus:ring-blue-300'
                      }`}
                    />
                    {isOverdue && <p className="text-[10px] text-red-600 mt-0.5 font-medium">⚠ Prazo vencido</p>}
                  </Field>
                </div>
              </SectionBlock>

              {/* EVIDÊNCIA */}
              <SectionBlock title="Evidências" icon={FileText} defaultOpen={true} accent={!task.expected_evidence ? 'border-orange-200' : 'border-slate-200'}>
                <Field label="Evidência esperada ao concluir" required missing={!form.expected_evidence}>
                  {!form.expected_evidence && !task.expected_evidence && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-orange-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Sem evidência esperada — o que comprova que esta tarefa foi feita?</span>
                    </div>
                  )}
                  <textarea
                    value={form.expected_evidence}
                    onChange={e => setForm(f => ({ ...f, expected_evidence: e.target.value }))}
                    placeholder="Ex: Primeiro DRE mensal emitido e validado pelo gestor financeiro..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none bg-emerald-50/30"
                    rows={2}
                  />
                </Field>

                {(isDone || task.completion_evidence) && (
                  <Field label="Evidência entregue (comprovação)">
                    <textarea
                      value={form.completion_evidence}
                      onChange={e => setForm(f => ({ ...f, completion_evidence: e.target.value }))}
                      placeholder="Descreva a evidência que foi efetivamente entregue..."
                      className="w-full text-xs border border-emerald-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-emerald-300 focus:outline-none bg-emerald-50"
                      rows={2}
                    />
                  </Field>
                )}
              </SectionBlock>
            </>
          )}

          {/* ═══ TAB: DETALHES ══════════════════════════ */}
          {activeTab === 'details' && (
            <>
              {/* Origem diagnóstica completa */}
              <SectionBlock title="Origem diagnóstica" icon={Target} defaultOpen={true} accent="border-indigo-200">
                <div className="space-y-2">
                  <Field label="Tipo de origem">
                    <span className="text-xs font-semibold text-slate-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                      {ORIGIN_TYPE_LABEL[task.origin_type] || task.origin_type || '—'}
                    </span>
                  </Field>
                  {task.dimension_key && (
                    <Field label="Caminho diagnóstico">
                      <div className="flex items-center gap-1 text-xs text-slate-700 flex-wrap">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">FAL</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{DIM_LABELS[task.dimension_key] || task.dimension_key}</span>
                        {task.subdimension_key && <><ArrowRight className="w-3 h-3 text-slate-400" /><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">{task.subdimension_key.replace(/_/g, ' ')}</span></>}
                        {task.cluster_key && <><ArrowRight className="w-3 h-3 text-slate-400" /><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">{task.cluster_key.replace(/_/g, ' ')}</span></>}
                      </div>
                    </Field>
                  )}
                  {task.origin_score != null && (
                    <Field label="Score de origem">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${task.origin_score < 1 ? 'bg-red-500' : task.origin_score < 1.8 ? 'bg-amber-500' : 'bg-blue-400'}`} />
                        <span className="text-sm font-black text-slate-800">{Number(task.origin_score).toFixed(2)}</span>
                        <span className="text-xs text-slate-400">/ 3.00</span>
                        <span className="text-xs text-slate-400">
                          {task.origin_score < 1 ? '— Crítico' : task.origin_score < 1.8 ? '— Básico' : task.origin_score < 2.5 ? '— Estruturado' : '— Avançado'}
                        </span>
                      </div>
                    </Field>
                  )}
                  {task.origin_detail && (
                    <Field label="Detalhe de origem">
                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">{task.origin_detail}</p>
                    </Field>
                  )}
                </div>
              </SectionBlock>

              {/* Execução avançada */}
              <SectionBlock title="Guia de execução" icon={Zap} defaultOpen={true}>
                <Field label="Passo a passo / Como fazer">
                  <textarea
                    value={form.execution_guidance}
                    onChange={e => setForm(f => ({ ...f, execution_guidance: e.target.value }))}
                    placeholder="1. Levantar lançamentos&#10;2. Definir estrutura&#10;3. Validar com contador..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    rows={5}
                  />
                </Field>
              </SectionBlock>

              {/* Dependências */}
              {depTasks.length > 0 && (
                <SectionBlock title="Dependências" icon={Link2} defaultOpen={true} accent={depTasks.some(d => d.status !== 'done') ? 'border-amber-300' : 'border-slate-200'}>
                  <div className="space-y-2">
                    {depTasks.map(dep => (
                      <div key={dep.id} className={`flex items-center gap-2 p-2.5 rounded-lg border ${dep.status === 'done' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        {dep.status === 'done'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        }
                        <p className={`text-xs flex-1 ${dep.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{dep.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dep.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {dep.status === 'done' ? 'Concluída' : 'Pendente'}
                        </span>
                      </div>
                    ))}
                    {depTasks.some(d => d.status !== 'done') && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Esta tarefa depende de ações ainda não concluídas.</span>
                      </div>
                    )}
                  </div>
                </SectionBlock>
              )}

              {/* Prioridade e inteligência */}
              <SectionBlock title="Inteligência" icon={TrendingUp} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prioridade">
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none">
                      <option value="critical">Crítico</option>
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </Field>
                  <Field label="Horizonte">
                    <select value={form.horizon} onChange={e => setForm(f => ({ ...f, horizon: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none">
                      <option value="30d">30 Dias</option>
                      <option value="60d">60 Dias</option>
                      <option value="90d">90 Dias</option>
                      <option value="180d">180 Dias</option>
                    </select>
                  </Field>
                </div>
                {task.impact_score != null && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Impacto esperado (1-5)">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((task.impact_score || 0) / 5) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{task.impact_score}</span>
                      </div>
                    </Field>
                    <Field label="Esforço (1-5)">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${((task.effort_score || 0) / 5) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{task.effort_score}</span>
                      </div>
                    </Field>
                  </div>
                )}
                <Field label="Notas do consultor">
                  <textarea
                    value={form.consultant_notes}
                    onChange={e => setForm(f => ({ ...f, consultant_notes: e.target.value }))}
                    placeholder="Contexto adicional, observações..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    rows={3}
                  />
                </Field>
              </SectionBlock>
            </>
          )}

          {/* ═══ TAB: CHECK-IN ════════════════════════════ */}
          {activeTab === 'checkin' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-800">Registrar Check-in</span>
                </div>
                <p className="text-xs text-indigo-600">Atualize o progresso desta tarefa. O histórico será preservado.</p>
              </div>

              {/* Status */}
              <Field label="Novo status">
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setCheckin(c => ({ ...c, status: s.value }))}
                      className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                        checkin.status === s.value ? s.cls + ' shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}>{s.label}</button>
                  ))}
                </div>
              </Field>

              {/* Progress */}
              <Field label={`Progresso: ${checkin.progress}%`}>
                <input type="range" min={0} max={100} step={5}
                  value={checkin.progress}
                  onChange={e => setCheckin(c => ({ ...c, progress: Number(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${checkin.progress}%` }} />
                </div>
              </Field>

              {/* Comment */}
              <Field label="Comentário da visita">
                <textarea
                  value={checkin.comment}
                  onChange={e => setCheckin(c => ({ ...c, comment: e.target.value }))}
                  placeholder="O que foi avaliado nesta visita? Quais avanços foram registrados?"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  rows={4}
                />
              </Field>

              {/* Bloqueio se status blocked */}
              {checkin.status === 'blocked' && (
                <Field label="Motivo do bloqueio" required missing={!checkin.blocked_reason}>
                  <textarea
                    value={checkin.blocked_reason}
                    onChange={e => setCheckin(c => ({ ...c, blocked_reason: e.target.value }))}
                    placeholder="Ex: Aguardando retorno do contador..."
                    className="w-full text-xs border border-amber-300 bg-amber-50 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-amber-400 focus:outline-none"
                    rows={2}
                  />
                </Field>
              )}

              {/* Evidência se done */}
              {checkin.status === 'done' && (
                <Field label="Evidência entregue">
                  <textarea
                    value={checkin.completion_evidence}
                    onChange={e => setCheckin(c => ({ ...c, completion_evidence: e.target.value }))}
                    placeholder="Descreva o que foi efetivamente concluído e como pode ser verificado..."
                    className="w-full text-xs border border-emerald-200 bg-emerald-50 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                    rows={2}
                  />
                </Field>
              )}

              <Button onClick={handleCheckin} disabled={saving || (!checkin.comment && checkin.progress === (task.progress_percentage ?? 0) && checkin.status === task.status)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Registrando...' : 'Registrar check-in'}
              </Button>

              {/* Last checkin info */}
              {task.last_checkin_at && (
                <div className="text-xs text-slate-400 text-center pt-2">
                  Último check-in: {format(new Date(task.last_checkin_at), 'dd/MM/yyyy HH:mm')}
                  {task.last_checkin_comment && <p className="italic mt-1">"{task.last_checkin_comment}"</p>}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: HISTÓRICO ═══════════════════════════ */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <History className="w-4 h-4" />
                <span>{taskReviews.length} alteração{taskReviews.length !== 1 ? 'ões' : ''} registrada{taskReviews.length !== 1 ? 's' : ''}</span>
              </div>
              {taskReviews.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma alteração registrada.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-slate-200" />
                  <div className="space-y-3">
                    {taskReviews.map(review => (
                      <div key={review.id} className="relative flex gap-4 pl-1">
                        <div className="relative z-10 w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                          <History className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-700 capitalize">
                              {review.change_type?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {review.created_date ? format(new Date(review.created_date), 'dd/MM HH:mm') : '—'}
                            </span>
                          </div>
                          {review.consultant_comment && (
                            <p className="text-xs text-slate-600 italic">"{review.consultant_comment}"</p>
                          )}
                          <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400 flex-wrap">
                            {review.previous_status && review.new_status && review.previous_status !== review.new_status && (
                              <span>{review.previous_status} → {review.new_status}</span>
                            )}
                            {review.previous_progress_percentage != null && review.new_progress_percentage != null && review.previous_progress_percentage !== review.new_progress_percentage && (
                              <span>{review.previous_progress_percentage}% → {review.new_progress_percentage}%</span>
                            )}
                            {review.previous_owner_name && review.new_owner_name && review.previous_owner_name !== review.new_owner_name && (
                              <span>Dono: {review.previous_owner_name} → {review.new_owner_name}</span>
                            )}
                            {review.previous_due_date && review.new_due_date && review.previous_due_date !== review.new_due_date && (
                              <span>Prazo: {review.previous_due_date} → {review.new_due_date}</span>
                            )}
                          </div>
                          {review.created_by && (
                            <p className="text-[10px] text-slate-400 mt-1">por {review.created_by}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────── */}
        {(activeTab === 'execution' || activeTab === 'details') && (
          <div className="p-4 border-t bg-white flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
              Fechar
            </button>
            <Button onClick={handleSave} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[120px]">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar alterações'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}