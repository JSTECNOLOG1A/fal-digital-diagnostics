/**
 * TaskDrawer
 * Drawer lateral com detalhes completos de uma ActionTask.
 * Ordem dos blocos: Cabeçalho → Por que existe → Execução → Dependências → Inteligência
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  X, AlertTriangle, Zap, User, FileText,
  Link2, TrendingUp, Shield, Lock, ChevronDown, ChevronUp, Save
} from 'lucide-react';

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Crítico' },
  high:     { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Alta' },
  medium:   { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Média' },
  low:      { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Baixa' },
};

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A Fazer',      cls: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'Em Andamento', cls: 'bg-blue-100 text-blue-700' },
  { value: 'blocked',     label: 'Bloqueada',    cls: 'bg-amber-100 text-amber-700' },
  { value: 'done',        label: 'Concluído',    cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',   label: 'Cancelado',    cls: 'bg-slate-100 text-slate-400' },
];

const HORIZON_LABEL = { '30d': '30 Dias', '60d': '60 Dias', '90d': '90 Dias', '180d': '180 Dias' };

const ACTION_TYPE_STYLE = {
  quick_win:   { label: 'Quick Win',   cls: 'bg-emerald-100 text-emerald-700' },
  structural:  { label: 'Estrutural',  cls: 'bg-indigo-100 text-indigo-700' },
  foundational:{ label: 'Fundacional', cls: 'bg-purple-100 text-purple-700' },
  compliance:  { label: 'Compliance',  cls: 'bg-slate-100 text-slate-600' },
};

const ORIGIN_TYPE_LABEL = {
  cluster:        'Cluster',
  subdimension:   'Subdimensão',
  dimension:      'Dimensão',
  killer_question:'Pergunta Crítica',
  manual:         'Manual (Consultor)',
};

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.max
 * @param {any=} props.color
 */
function ScoreBar({ value, max = 5, color = 'bg-blue-500' }) {
  const pct = Math.round((Math.min(value || 0, max) / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-6 text-right">{value || '—'}</span>
    </div>
  );
}

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
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
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
 * @param {any=} props.onUpdated
 * @param {boolean=} props.readOnly
 */
export default function TaskDrawer({ task, allTasks = [], onClose, onSaved, readOnly = false }) {
  const [form, setForm] = useState({
    status: task?.status || 'todo',
    assigned_to: task?.assigned_to || '',
    owner_name: task?.owner_name || '',
    start_date: task?.start_date || '',
    due_date: task?.due_date || '',
    progress_percentage: task?.progress_percentage ?? 0,
    consultant_notes: task?.consultant_notes || '',
    priority: task?.priority || 'medium',
    horizon: task?.horizon || '90d',
    title: task?.title || '',
    description: task?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      });
      setSaved(false);
    }
  }, [task?.id]);

  if (!task) return null;

  const p = PRIORITY_STYLE[form.priority] || PRIORITY_STYLE.medium;
  const at = ACTION_TYPE_STYLE[task.action_type] || ACTION_TYPE_STYLE.structural;
  const isManual = task.origin_type === 'manual';

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
      consultant_notes: form.consultant_notes || null,
      priority: form.priority,
      horizon: form.horizon,
      ...(isManual ? { title: form.title, description: form.description } : {}),
    };

    // Atualiza via backend — garante histórico + validação de tenant
    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates,
      source: 'drawer',
      comment: form.consultant_notes && form.consultant_notes !== task.consultant_notes
        ? form.consultant_notes
        : undefined,
    });

    setSaved(true);
    setSaving(false);
    onSaved && onSaved();
  };

  // Resolve dependency names
  const depTasks = (task.dependency_task_keys || [])
    .map(k => allTasks.find(t => t.task_key === k))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex-1 min-w-0 pr-3">
            {isManual ? (
              <textarea
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                readOnly={readOnly}
                className="text-base font-semibold text-slate-900 w-full resize-none border-0 p-0 focus:ring-0 focus:outline-none bg-transparent leading-snug"
                rows={2}
              />
            ) : (
              <h2 className="text-base font-semibold text-slate-900 leading-snug">{task.title}</h2>
            )}
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${p.badge}`}>{p.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${at.cls}`}>{at.label}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{HORIZON_LABEL[form.horizon] || form.horizon}</span>
              {task.is_blocked && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueada
                </span>
              )}
              {isManual && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">Manual</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* BLOCO 1 — Por que existe */}
          <SectionBlock title="Por que esta tarefa existe" icon={FileText} defaultOpen={true}>
            <Field label="Origem">
              <span className="text-xs font-medium text-slate-700">
                {ORIGIN_TYPE_LABEL[task.origin_type] || task.origin_type || '—'}
              </span>
            </Field>
            {task.origin_detail && (
              <Field label="Detalhe">
                <p className="text-xs text-slate-700 bg-slate-50 rounded p-2">{task.origin_detail}</p>
              </Field>
            )}
            {task.reason && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">{task.reason}</p>
              </div>
            )}
            {task.origin_score != null && (
              <Field label="Score de origem">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${task.origin_score < 1 ? 'bg-red-500' : task.origin_score < 1.8 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <span className="text-xs font-bold text-slate-700">{Number(task.origin_score).toFixed(2)}</span>
                  <span className="text-xs text-slate-400">/ 3.00</span>
                </div>
              </Field>
            )}
            {(task.dimension_key || task.cluster_key) && (
              <Field label="Dimensão / Cluster">
                <p className="text-xs text-slate-700">
                  {DIM_LABELS[task.dimension_key] || task.dimension_key || '—'}
                  {task.cluster_key && <span className="text-slate-400"> › {task.cluster_key.replace(/_/g, ' ')}</span>}
                </p>
              </Field>
            )}
            {task.description && !isManual && (
              <Field label="Descrição">
                <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
              </Field>
            )}
            {isManual && (
              <Field label="Descrição">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs text-slate-700 border border-slate-200 rounded p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50"
                  rows={3}
                  placeholder="Descreva o contexto desta tarefa..."
                />
              </Field>
            )}
          </SectionBlock>

          {/* BLOCO 1b — Como executar (ações operacionais e estratégicas com how_to_execute) */}
          {(task.how_to_execute || task.expected_evidence) && (
            <SectionBlock title="Guia de execução" icon={Zap} defaultOpen={true}>
              {task.how_to_execute && (
                <Field label="Como executar">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{task.how_to_execute}</p>
                  </div>
                </Field>
              )}
              {task.expected_evidence && (
                <Field label="Evidência esperada ao concluir">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs text-emerald-800 leading-relaxed">{task.expected_evidence}</p>
                  </div>
                </Field>
              )}
              {task.frequency && task.frequency !== 'once' && (
                <Field label="Frequência de execução">
                  <span className="text-xs font-semibold text-slate-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                    {{ once: 'Única vez', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral', event: 'Por evento' }[task.frequency] || task.frequency}
                  </span>
                </Field>
              )}
            </SectionBlock>
          )}

          {/* BLOCO 2 — Execução */}
          <SectionBlock title="Execução" icon={User} defaultOpen={true}>
            <Field label="Status">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    disabled={readOnly}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                      form.status === s.value
                        ? `${s.cls} border-current shadow-sm`
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridade">
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50"
                >
                  <option value="critical">Crítico</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </Field>
              <Field label="Horizonte">
                <select
                  value={form.horizon}
                  onChange={e => setForm(f => ({ ...f, horizon: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50"
                >
                  <option value="30d">30 Dias</option>
                  <option value="60d">60 Dias</option>
                  <option value="90d">90 Dias</option>
                  <option value="180d">180 Dias</option>
                </select>
              </Field>
            </div>

            <Field label="Avanço (%)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
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
              <Field label="Início previsto">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                />
              </Field>
              <Field label="Prazo">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  disabled={readOnly}
                  className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsável (e-mail)">
                <input
                  type="text"
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  disabled={readOnly}
                  placeholder={task.typical_owner || 'email@empresa.com'}
                  className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                />
              </Field>
              <Field label="Nome do responsável">
                <input
                  type="text"
                  value={form.owner_name}
                  onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                  disabled={readOnly}
                  placeholder="Ex: João Silva"
                  className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
                />
              </Field>
            </div>

            <Field label="Notas do consultor">
              <textarea
                value={form.consultant_notes}
                onChange={e => setForm(f => ({ ...f, consultant_notes: e.target.value }))}
                disabled={readOnly}
                placeholder="Contexto adicional, observações, recomendações..."
                className="w-full text-xs border border-slate-200 rounded p-2 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
                rows={3}
              />
            </Field>
          </SectionBlock>

          {/* BLOCO 3 — Dependências */}
          {(depTasks.length > 0 || task.is_blocked) && (
            <SectionBlock title="Dependências" icon={Link2} defaultOpen={true}>
              {task.is_blocked && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Esta tarefa está bloqueada porque depende de outra ação ainda não concluída.</span>
                </div>
              )}
              {depTasks.length > 0 && (
                <div className="space-y-1.5">
                  {depTasks.map(dep => (
                    <div key={dep.id} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded border border-slate-100">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className={dep.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}>{dep.title}</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${dep.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {dep.status === 'done' ? 'Concluída' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>
          )}

          {/* BLOCO 4 — Inteligência */}
          <SectionBlock title="Inteligência da ação" icon={TrendingUp} defaultOpen={false}>
            {task.typical_owner && (
              <Field label="Perfil responsável sugerido">
                <p className="text-xs text-slate-700">{task.typical_owner}</p>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Impacto esperado (1-5)">
                <ScoreBar value={task.impact_score} color="bg-emerald-500" />
              </Field>
              <Field label="Esforço necessário (1-5)">
                <ScoreBar value={task.effort_score} color="bg-amber-500" />
              </Field>
            </div>
            {task.priority_score != null && (
              <Field label="Score de prioridade">
                <span className="text-xs font-bold text-indigo-700">{Number(task.priority_score).toFixed(2)}</span>
              </Field>
            )}
            {task.evidence_missing && (
              <div className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Evidência baseada em estrutura da biblioteca. Nenhum sinal direto encontrado nas respostas.</span>
              </div>
            )}
          </SectionBlock>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Fechar
          </button>
          {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[120px]"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar'}
          </Button>
          )}
        </div>
      </div>
    </div>
  );
}