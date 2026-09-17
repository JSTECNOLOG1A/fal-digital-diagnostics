/**
 * QuickReviewDrawer
 * Drawer lateral para criar uma revisão do plano de ação de forma rápida e fluida.
 * Passo 1 → metadados da visita
 * Passo 2 → revisão inline de cada tarefa (status + progresso + comentário)
 * Passo 3 → confirmação com delta de progresso
 */
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Minus, ArrowRight
} from 'lucide-react';
import { STATUS_STYLE } from '../APlanConstants';
import { format } from 'date-fns';
import { invalidateActionPlanQueries } from '@/lib/query-client';

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'blocked',     label: 'Bloqueada' },
  { value: 'done',        label: 'Concluída' },
  { value: 'cancelled',   label: 'Cancelada' },
];

const VISIT_TYPES = [
  { value: 'intermediate',  label: 'Visita Intermediária' },
  { value: 'final',         label: 'Visita Final' },
  { value: 'extraordinary', label: 'Visita Extraordinária' },
];

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
 */
function ProgressSlider({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range" min={0} max={100} step={5} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-600"
      />
      <span className="text-xs font-bold text-slate-600 w-10 text-right">{value}%</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.change
 * @param {any=} props.onChange
 */
function TaskRow({ task, change, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const currentStatus = change?.status ?? task.status;
  const currentProgress = change?.progress_percentage ?? task.progress_percentage ?? 0;
  const hasChange = change && (
    (change.status && change.status !== task.status) ||
    (change.progress_percentage !== undefined && change.progress_percentage !== (task.progress_percentage ?? 0)) ||
    change.comment
  );
  const s = STATUS_STYLE[currentStatus] || STATUS_STYLE.todo;

  return (
    <div className={`rounded-xl border transition-all ${hasChange ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
      {/* Row header — click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 text-sm font-medium text-slate-800 truncate">{task.title}</span>
        {hasChange && <span className="text-[10px] font-semibold text-blue-600 flex-shrink-0">editado</span>}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.cls}`}>{s.label}</span>
        <span className="text-[10px] text-slate-400 flex-shrink-0 w-8 text-right">{currentProgress}%</span>
        {expanded ? <ChevronLeft className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 rotate-90" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Status</label>
            <Select value={currentStatus} onValueChange={v => onChange('status', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Progresso */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              Progresso — atual: {task.progress_percentage ?? 0}%
            </label>
            <ProgressSlider value={currentProgress} onChange={v => onChange('progress_percentage', v)} />
          </div>

          {/* Comentário */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Comentário do consultor</label>
            <Textarea
              value={change?.comment ?? ''}
              onChange={e => onChange('comment', e.target.value)}
              rows={2}
              placeholder="Observação sobre esta tarefa..."
              className="text-xs resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.plan
 * @param {any=} props.tasks
 * @param {any=} props.reviewNumber
 * @param {any=} props.tenantId
 * @param {any=} props.onReviewCompleted
 */
export default function QuickReviewDrawer({ open, onClose, plan, tasks, reviewNumber, tenantId, onReviewCompleted }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [meta, setMeta] = useState({
    review_date: new Date().toISOString().slice(0, 10),
    visit_type: 'intermediate',
    consultant_name: '',
    executive_summary: '',
    key_advances: '',
    key_delays: '',
    next_steps: '',
  });

  // Per-task changes: { [task_id]: { status?, progress_percentage?, comment? } }
  const [changes, setChanges] = useState(/** @type {Record<string, any>} */ ({}));
  const [createdReview, setCreatedReview] = useState(null);

  useEffect(() => {
    if (open) { setStep(1); setChanges({}); setCreatedReview(null); setResult(null); setError(null); }
  }, [open]);

  const activeTasks = (tasks || []).filter(t => t.status !== 'cancelled');
  const changedCount = Object.keys(changes).filter(id => {
    const c = changes[id];
    return c.status || c.progress_percentage !== undefined || c.comment;
  }).length;

  const handleTaskChange = (taskId, field, value) => {
    setChanges(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }));
  };

  // Step 1 → Step 2: create draft review
  const handleNext = async () => {
    setSaving(true);
    setError(null);
    const res = await base44.functions.invoke('createActionPlanReview', {
      action: 'create',
      review_data: {
        action_plan_id: plan.id,
        assessment_id: plan.assessment_id,
        tenant_id: tenantId,
        group_id: plan.group_id ?? '',
        company_id: plan.company_id ?? '',
        unit_id: plan.unit_id ?? '',
        review_number: reviewNumber,
        review_date: meta.review_date,
        visit_type: meta.visit_type,
        consultant_name: meta.consultant_name,
      },
    });
    setSaving(false);
    if (res.data?.error) { setError(res.data.error); return; }
    setCreatedReview(res.data.review);
    setStep(2);
  };

  // Step 2 → Step 3: complete review
  const handleComplete = async () => {
    if (!createdReview) return;
    setSaving(true);
    setError(null);

    const task_changes = activeTasks
      .filter(t => changes[t.id])
      .map(t => {
        const c = changes[t.id] || {};
        return {
          action_task_id: t.id,
          updates: {
            ...(c.status ? { status: c.status } : {}),
            ...(c.progress_percentage !== undefined ? { progress_percentage: c.progress_percentage } : {}),
          },
          consultant_comment: c.comment || '',
        };
      });

    const res = await base44.functions.invoke('createActionPlanReview', {
      action: 'complete',
      review_id: createdReview.id,
      task_changes,
      review_data: {
        executive_summary: meta.executive_summary,
        key_advances: meta.key_advances,
        key_delays: meta.key_delays,
        next_steps: meta.next_steps,
        consultant_name: meta.consultant_name,
      },
    });

    setSaving(false);
    if (res.data?.error) { setError(res.data.error); return; }
    setResult(res.data);
    await invalidateActionPlanQueries(qc, null, (plan?.id || null), tenantId);
    await invalidateActionPlanQueries(qc, null, (plan?.id || null), tenantId);
    await invalidateActionPlanQueries(qc, null, (plan?.id || null), tenantId);
    setStep(3);
    onReviewCompleted?.(res.data);
  };

  const delta = result ? (result.overall_progress_after - result.overall_progress_before) : 0;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <SheetTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {step === 3 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full px-2 py-0.5">
                Revisão #{reviewNumber}
              </span>
            )}
            {step === 1 && 'Dados da Visita'}
            {step === 2 && `Revisar Tarefas (${changedCount} editadas)`}
            {step === 3 && 'Revisão Concluída!'}
          </SheetTitle>
          {/* Step dots */}
          {step < 3 && (
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-indigo-600' : s < step ? 'w-3 bg-indigo-300' : 'w-3 bg-slate-200'}`} />
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* STEP 1 — Metadados */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Data da visita *</label>
                  <Input type="date" value={meta.review_date} onChange={e => setMeta(m => ({ ...m, review_date: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Tipo *</label>
                  <Select value={meta.visit_type} onValueChange={v => setMeta(m => ({ ...m, visit_type: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISIT_TYPES.map(vt => <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Consultor</label>
                <Input value={meta.consultant_name} onChange={e => setMeta(m => ({ ...m, consultant_name: e.target.value }))} placeholder="Nome do consultor" className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Resumo executivo</label>
                <Textarea value={meta.executive_summary} onChange={e => setMeta(m => ({ ...m, executive_summary: e.target.value }))} rows={3} placeholder="Síntese da visita..." className="resize-none text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Principais avanços</label>
                  <Textarea value={meta.key_advances} onChange={e => setMeta(m => ({ ...m, key_advances: e.target.value }))} rows={2} className="resize-none text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Principais atrasos</label>
                  <Textarea value={meta.key_delays} onChange={e => setMeta(m => ({ ...m, key_delays: e.target.value }))} rows={2} className="resize-none text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Próximos passos</label>
                <Textarea value={meta.next_steps} onChange={e => setMeta(m => ({ ...m, next_steps: e.target.value }))} rows={2} className="resize-none text-xs" />
              </div>
            </>
          )}

          {/* STEP 2 — Tarefas */}
          {step === 2 && (
            <>
              <p className="text-xs text-slate-500">
                <strong>{activeTasks.length}</strong> tarefas ativas · clique em uma para revisar
              </p>
              <div className="space-y-2">
                {activeTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    change={changes[task.id]}
                    onChange={(field, value) => handleTaskChange(task.id, field, value)}
                  />
                ))}
              </div>
            </>
          )}

          {/* STEP 3 — Resultado */}
          {step === 3 && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">Revisão #{reviewNumber} concluída</p>
                <p className="text-xs text-slate-500 mt-1">
                  {format(new Date(String(meta.review_date).slice(0, 10) + 'T12:00'), 'dd/MM/yyyy')} · {VISIT_TYPES.find(v => v.value === meta.visit_type)?.label}
                </p>
              </div>
              {/* Progress delta */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-6 py-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Antes</p>
                  <p className="text-2xl font-black text-slate-700">{result.overall_progress_before}%</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300" />
                <div className="text-center">
                  <p className="text-xs text-slate-400">Depois</p>
                  <p className="text-2xl font-black text-slate-800">{result.overall_progress_after}%</p>
                </div>
                <div className={`flex items-center gap-1 font-bold text-sm ml-2 ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {delta > 0 ? <TrendingUp className="w-4 h-4" /> : delta < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {delta > 0 ? '+' : ''}{delta}%
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {result.task_reviews_created ?? 0} alterações registradas no histórico
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex justify-between gap-3 flex-shrink-0">
          {step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={saving || !meta.review_date || !meta.visit_type}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Revisar tarefas <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Concluir revisão
              </Button>
            </>
          )}
          {step === 3 && (
            <Button className="w-full" size="sm" onClick={onClose}>Fechar</Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}