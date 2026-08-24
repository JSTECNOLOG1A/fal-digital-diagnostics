/**
 * TaskFullDrawer — Drawer lateral completo da tarefa.
 * Exibe: Tarefa | Por Quê | Como | Dono | Prazo | Evidência | Status | Bloqueio | Dependências | Check-in | Histórico
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useReviewMode } from '@/context/ReviewModeContext';
import { Button } from '@/components/ui/button';
import {
  X, Save, AlertTriangle, Zap, User, FileText, Link2, TrendingUp,
  Lock, ChevronDown, ChevronUp, Clock, History
} from 'lucide-react';
import { format } from 'date-fns';
import { assessmentKey } from '@/lib/query-client';

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Crítico', dot: 'bg-red-500' },
  high:     { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Alta', dot: 'bg-amber-500' },
  medium:   { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Média', dot: 'bg-blue-400' },
  low:      { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Baixa', dot: 'bg-slate-400' },
};

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A Fazer',      cls: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'Em Andamento', cls: 'bg-blue-100 text-blue-700' },
  { value: 'blocked',     label: 'Bloqueada',    cls: 'bg-amber-100 text-amber-700' },
  { value: 'done',        label: 'Concluído',    cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',   label: 'Cancelado',    cls: 'bg-slate-100 text-slate-400' },
];

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

const ORIGIN_LABEL = {
  cluster: 'Cluster', subdimension: 'Subdimensão', dimension: 'Dimensão',
  killer_question: 'Pergunta Crítica', question: 'Pergunta', manual: 'Manual',
};

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.children
 * @param {any=} props.defaultOpen
 */
function SectionBlock({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</span>
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
 */
function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.allTasks
 * @param {any=} props.planId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onSaved
 * @param {boolean=} props.readOnly
 */
export default function TaskFullDrawer({ task, allTasks = [], planId, tenantId, onClose, onSaved, readOnly = false }) {
  const { isReviewMode, review_id } = useReviewMode();
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({}));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkinComment, setCheckinComment] = useState('');
  const [showCheckin, setShowCheckin] = useState(false);
  const [activeTab, setActiveTab] = useState('detail'); // 'detail' | 'history'

  useEffect(() => {
    if (task) {
      setForm({
        status: task.status || 'todo',
        assigned_to: task.assigned_to || '',
        owner_name: task.owner_name || '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        progress_percentage: task.progress_percentage ?? 0,
        priority: task.priority || 'medium',
        horizon: task.horizon || '90d',
        title: task.title || '',
        description: task.description || '',
        expected_evidence: task.expected_evidence || '',
        completion_evidence: task.completion_evidence || '',
        blocked_reason: task.blocked_reason || '',
        execution_guidance: task.execution_guidance || task.how_to_execute || '',
        consultant_notes: task.consultant_notes || '',
      });
      setSaved(false);
      setCheckinComment('');
      setShowCheckin(false);
    }
  }, [task?.id]);

  // History — must be called unconditionally before any early return
  const { data: history = [] } = useQuery({
    queryKey: assessmentKey(tenantId, null, 'task-reviews', task?.id),
    queryFn: () => base44.entities.ActionTaskReview.filter({ action_task_id: task.id }, '-created_date', 30),
    enabled: !!task?.id && activeTab === 'history',
  });

  if (!task) return null;

  const p = PRIORITY_STYLE[form.priority] || PRIORITY_STYLE.medium;
  const isManual = task.is_manual || task.origin_type === 'manual';
  const depTasks = (task.dependency_task_keys || []).map(k => allTasks.find(t => t.task_key === k)).filter(Boolean);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    const updates = {
      status: form.status,
      assigned_to: form.assigned_to || null,
      owner_name: form.owner_name || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      progress_percentage: Number(form.progress_percentage) || 0,
      priority: form.priority,
      horizon: form.horizon,
      expected_evidence: form.expected_evidence || null,
      completion_evidence: form.completion_evidence || null,
      blocked_reason: form.blocked_reason || null,
      execution_guidance: form.execution_guidance || null,
      consultant_notes: form.consultant_notes || null,
      title: form.title,
      description: form.description || null,
    };
    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates,
      source: 'central_drawer',
      comment: form.consultant_notes !== task.consultant_notes ? form.consultant_notes : undefined,
      review_id: isReviewMode ? review_id : undefined,
    });
    setSaved(true);
    setSaving(false);
    onSaved?.();
  };

  const handleCheckin = async () => {
    if (readOnly) return;
    if (!checkinComment.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates: {
        status: form.status,
        progress_percentage: Number(form.progress_percentage),
        last_checkin_at: now,
        last_checkin_comment: checkinComment,
      },
      source: 'checkin',
      comment: checkinComment,
      review_id: isReviewMode ? review_id : undefined,
    });
    setCheckinComment('');
    setShowCheckin(false);
    setSaving(false);
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b bg-white">
          <div className="flex-1 min-w-0 pr-3">
            <textarea
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              readOnly={readOnly}
              className="text-base font-semibold text-slate-900 w-full resize-none border-0 p-0 focus:ring-0 focus:outline-none bg-transparent leading-snug"
              rows={2}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${p.badge}`}>{p.label}</span>
              {task.action_type && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  task.action_type === 'quick_win' ? 'bg-emerald-100 text-emerald-700' :
                  task.action_type === 'structural' ? 'bg-indigo-100 text-indigo-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{{ quick_win: 'Quick Win', structural: 'Estrutural', foundational: 'Fundacional', compliance: 'Compliance', operational: 'Operacional' }[task.action_type] || task.action_type}</span>
              )}
              {form.status === 'blocked' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueada
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b bg-white">
          {[{ key: 'detail', label: 'Detalhe' }, { key: 'history', label: 'Histórico' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {activeTab === 'history' && (
            <HistoryView history={history} task={task} />
          )}

          {activeTab === 'detail' && (<>

            {/* CHECK-IN — hidden in read-only mode */}
            {!readOnly && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              {!showCheckin ? (
                <button
                  onClick={() => setShowCheckin(true)}
                  className="w-full flex items-center gap-2 text-sm font-semibold text-indigo-700"
                >
                  <Clock className="w-4 h-4" /> Registrar check-in de visita
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">Check-in de visita</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Status atual">
                      <select
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full text-xs border border-indigo-200 rounded p-1.5 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Progresso (%)">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} max={100} step={5}
                          value={form.progress_percentage}
                          onChange={e => setForm(f => ({ ...f, progress_percentage: Number(e.target.value) }))}
                          className="w-full text-xs border border-indigo-200 rounded p-1.5 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-indigo-700">%</span>
                      </div>
                    </Field>
                  </div>
                  <textarea
                    value={checkinComment}
                    onChange={e => setCheckinComment(e.target.value)}
                    placeholder="O que foi discutido nessa visita? Qual o ponto atual?"
                    className="w-full text-xs border border-indigo-200 rounded p-2 resize-none focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCheckin} disabled={saving || !checkinComment.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                      Salvar check-in
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCheckin(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* POR QUE EXISTS */}
            <SectionBlock title="Por que esta tarefa existe" icon={FileText}>
              <Field label="Origem diagnóstica">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {ORIGIN_LABEL[task.origin_type] || task.origin_type || '—'}
                  </span>
                  {task.dimension_key && (
                    <span className="text-xs text-slate-400">
                      › {DIM_LABELS[task.dimension_key] || task.dimension_key}
                      {task.subdimension_key && ` › ${task.subdimension_key.replace(/_/g, ' ')}`}
                      {task.cluster_key && ` › ${task.cluster_key.replace(/_/g, ' ')}`}
                    </span>
                  )}
                </div>
              </Field>
              {task.reason ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{task.reason}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Sem justificativa registrada.</p>
              )}
              {task.origin_score != null && (
                <Field label="Score de origem">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${task.origin_score < 1 ? 'bg-red-500' : task.origin_score < 1.8 ? 'bg-amber-500' : 'bg-blue-400'}`} />
                    <span className="text-xs font-bold text-slate-700">{Number(task.origin_score).toFixed(2)}</span>
                    <span className="text-xs text-slate-400">/ 3.00</span>
                  </div>
                </Field>
              )}
              <Field label="Descrição / Contexto">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50"
                  rows={3} placeholder="Contexto da tarefa..."
                />
              </Field>
            </SectionBlock>

            {/* COMO EXECUTAR */}
            <SectionBlock title="Como executar" icon={Zap}>
              <Field label="Orientação de execução">
                <textarea
                  value={form.execution_guidance}
                  onChange={e => setForm(f => ({ ...f, execution_guidance: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50"
                  rows={4} placeholder="Descreva os passos práticos..."
                />
              </Field>
              <Field label="Evidência esperada ao concluir">
                <textarea
                  value={form.expected_evidence}
                  onChange={e => setForm(f => ({ ...f, expected_evidence: e.target.value }))}
                  disabled={readOnly}
                  className={`w-full text-xs border rounded p-2 resize-none focus:ring-1 focus:ring-emerald-300 focus:outline-none ${
                    !form.expected_evidence ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                  }`}
                  rows={2} placeholder="O que comprova que esta tarefa foi concluída?"
                />
                {!form.expected_evidence && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Campo obrigatório para prestação de contas
                  </p>
                )}
              </Field>
            </SectionBlock>

            {/* EXECUÇÃO */}
            <SectionBlock title="Execução" icon={User}>
              <Field label="Status">
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setForm(f => ({ ...f, status: s.value }))}
                      disabled={readOnly}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                        form.status === s.value ? `${s.cls} border-current shadow-sm` : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              {form.status === 'blocked' && (
                <Field label="Motivo do bloqueio">
                  <textarea
                    value={form.blocked_reason}
                    onChange={e => setForm(f => ({ ...f, blocked_reason: e.target.value }))}
                    disabled={readOnly}
                    className={`w-full text-xs border rounded p-2 resize-none focus:ring-1 focus:ring-amber-300 focus:outline-none ${
                      !form.blocked_reason ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
                    }`}
                    rows={2} placeholder="Por que está bloqueada? O que precisa acontecer?"
                  />
                  {!form.blocked_reason && (
                    <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Bloqueio sem motivo não é válido
                    </p>
                  )}
                </Field>
              )}

              {form.status === 'done' && (
                <Field label="Evidência entregue">
                  <textarea
                    value={form.completion_evidence}
                    onChange={e => setForm(f => ({ ...f, completion_evidence: e.target.value }))}
                    disabled={readOnly}
                    className="w-full text-xs border border-emerald-200 bg-emerald-50 rounded p-2 resize-none focus:ring-1 focus:ring-emerald-300 focus:outline-none"
                    rows={2} placeholder="Descreva a evidência que comprova a conclusão..."
                  />
                </Field>
              )}

              <Field label="Avanço (%)">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={100} step={5}
                    value={form.progress_percentage}
                    onChange={e => setForm(f => ({ ...f, progress_percentage: Number(e.target.value) }))}
                    disabled={readOnly}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-700 w-10 text-right">{form.progress_percentage}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${form.progress_percentage}%` }} />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Responsável (nome)">
                  <input type="text" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                                    disabled={readOnly}
                                    placeholder="Ex: Ana Lima"
                    className={`w-full text-xs border rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none ${!form.owner_name && !form.assigned_to ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                  />
                </Field>
                <Field label="E-mail do responsável">
                  <input type="text" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                                    disabled={readOnly}
                                    placeholder="email@empresa.com"
                    className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de início">
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} disabled={readOnly}
                    className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  />
                </Field>
                <Field label="Prazo">
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} disabled={readOnly}
                    className={`w-full text-xs border rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none ${!form.due_date ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prioridade">
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} disabled={readOnly}
                    className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  >
                    <option value="critical">Crítico</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </Field>
                <Field label="Horizonte">
                  <select value={form.horizon} onChange={e => setForm(f => ({ ...f, horizon: e.target.value }))} disabled={readOnly}
                    className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  >
                    <option value="30d">30 dias</option>
                    <option value="60d">60 dias</option>
                    <option value="90d">90 dias</option>
                    <option value="180d">180 dias</option>
                  </select>
                </Field>
              </div>

              <Field label="Notas do consultor">
                <textarea value={form.consultant_notes} onChange={e => setForm(f => ({ ...f, consultant_notes: e.target.value }))}
                  disabled={readOnly}
                  placeholder="Contexto adicional, observações..." rows={2}
                  className="w-full text-xs border border-slate-200 rounded p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
                />
              </Field>
            </SectionBlock>

            {/* DEPENDÊNCIAS */}
            {(depTasks.length > 0 || task.is_blocked) && (
              <SectionBlock title="Dependências" icon={Link2}>
                {depTasks.map(dep => (
                  <div key={dep.id} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded border border-slate-100">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={dep.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}>{dep.title}</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${dep.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {dep.status === 'done' ? 'Concluída' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </SectionBlock>
            )}

            {/* INTELIGÊNCIA */}
            <SectionBlock title="Inteligência da ação" icon={TrendingUp} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {task.impact_score != null && (
                  <Field label="Impacto (1-5)"><span className="font-bold text-emerald-600">{task.impact_score}</span></Field>
                )}
                {task.effort_score != null && (
                  <Field label="Esforço (1-5)"><span className="font-bold text-amber-600">{task.effort_score}</span></Field>
                )}
                {task.priority_score != null && (
                  <Field label="Score de prioridade"><span className="font-bold text-indigo-700">{Number(task.priority_score).toFixed(2)}</span></Field>
                )}
                {task.typical_owner && (
                  <Field label="Perfil sugerido"><span className="text-slate-600">{task.typical_owner}</span></Field>
                )}
              </div>
            </SectionBlock>

          </>)}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Fechar</button>
          {activeTab === 'detail' && !readOnly && (
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[120px]">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar alterações'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.history
 * @param {any=} props.task
 */
function HistoryView({ history, task }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <History className="w-8 h-8 opacity-30" />
        <p className="text-sm">Nenhuma alteração registrada.</p>
      </div>
    );
  }

  const CHANGE_LABEL = {
    status_change: 'Status alterado',
    progress_update: 'Progresso atualizado',
    owner_change: 'Responsável alterado',
    date_change: 'Prazo alterado',
    no_change: 'Sem alteração',
    scope_change: 'Escopo alterado',
    cancelled: 'Cancelada',
    completed: 'Concluída',
    new_task_added: 'Tarefa adicionada',
    priority_change: 'Prioridade alterada',
  };

  return (
    <div className="space-y-3">
      {history.map(h => (
        <div key={h.id} className="bg-white border border-slate-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-700">{CHANGE_LABEL[h.change_type] || h.change_type}</span>
            <span className="text-[10px] text-slate-400">{h.created_date ? format(new Date(h.created_date), 'dd/MM/yy HH:mm') : '—'}</span>
          </div>
          {h.previous_status && h.new_status && h.previous_status !== h.new_status && (
            <div className="flex items-center gap-2 text-[10px] mb-1">
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{h.previous_status}</span>
              <span className="text-slate-300">→</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">{h.new_status}</span>
            </div>
          )}
          {h.previous_progress_percentage != null && h.new_progress_percentage != null && h.previous_progress_percentage !== h.new_progress_percentage && (
            <div className="flex items-center gap-2 text-[10px] mb-1">
              <span className="text-slate-400">{h.previous_progress_percentage}%</span>
              <span className="text-slate-300">→</span>
              <span className="font-semibold text-emerald-600">{h.new_progress_percentage}%</span>
            </div>
          )}
          {h.consultant_comment && (
            <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">"{h.consultant_comment}"</p>
          )}
          {h.created_by && (
            <p className="text-[10px] text-slate-400 mt-1">{h.created_by}</p>
          )}
        </div>
      ))}
    </div>
  );
}