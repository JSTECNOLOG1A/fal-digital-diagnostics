/**
 * ActionPlanReviewModal
 * Modal para criar e concluir uma revisão intermediária do plano de ação.
 * Permite revisar status, prazo, responsável, percentual e comentário de cada tarefa.
 * Preserva histórico em ActionTaskReview via backend createActionPlanReview.
 */
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { invalidateActionPlanQueries } from '@/lib/query-client';

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A fazer' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'blocked',     label: 'Bloqueada' },
  { value: 'done',        label: 'Concluída' },
  { value: 'cancelled',   label: 'Cancelada' },
];

const STATUS_STYLE = {
  todo:        'bg-slate-100 text-slate-500',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked:     'bg-amber-100 text-amber-700',
  done:        'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-slate-100 text-slate-400 line-through',
};

const VISIT_TYPES = [
  { value: 'intermediate',  label: 'Visita Intermediária' },
  { value: 'final',         label: 'Visita Final' },
  { value: 'extraordinary', label: 'Visita Extraordinária' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high',     label: 'Alta' },
  { value: 'medium',   label: 'Média' },
  { value: 'low',      label: 'Baixa' },
];



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
export default function ActionPlanReviewModal({ open, onClose, plan, tasks, reviewNumber, tenantId, onReviewCompleted }) {
  const qc = useQueryClient();
  const [step, setStep] = useState('form'); // 'form' | 'tasks' | 'summary'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Review metadata
  const [reviewData, setReviewData] = useState({
    action_plan_id: plan?.id ?? '',
    assessment_id: plan?.assessment_id ?? '',
    tenant_id: tenantId ?? '',
    group_id: plan?.group_id ?? '',
    company_id: plan?.company_id ?? '',
    unit_id: plan?.unit_id ?? '',
    review_number: reviewNumber ?? 1,
    review_date: new Date().toISOString().slice(0, 10),
    visit_type: 'intermediate',
    consultant_name: '',
    executive_summary: '',
    key_advances: '',
    key_delays: '',
    new_risks: '',
    next_steps: '',
  });

  const [createdReview, setCreatedReview] = useState(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setError(null);
      setCreatedReview(null);
      setReviewData(d => ({
        ...d,
        action_plan_id: plan?.id ?? '',
        assessment_id: plan?.assessment_id ?? '',
        tenant_id: tenantId ?? '',
        group_id: plan?.group_id ?? '',
        company_id: plan?.company_id ?? '',
        unit_id: plan?.unit_id ?? '',
        review_number: reviewNumber ?? 1,
        review_date: new Date().toISOString().slice(0, 10),
      }));
    }
  }, [open, plan, reviewNumber, tenantId]);

  const handleCreateDraft = async () => {
    setSaving(true);
    setError(null);
    const res = await base44.functions.invoke('createActionPlanReview', {
      action: 'create',
      review_data: reviewData,
    });
    setSaving(false);
    if (res.data?.error) { setError(res.data.error); return; }
    setCreatedReview(res.data.review);
    setStep('tasks');
  };

  const handleComplete = async () => {
    if (!createdReview) { setError('Revisão não foi criada corretamente.'); return; }
    setSaving(true);
    setError(null);

    const res = await base44.functions.invoke('completeActionPlanReview', {
      review_id: createdReview.id,
      review_data: {
        executive_summary: reviewData.executive_summary,
        key_advances: reviewData.key_advances,
        key_delays: reviewData.key_delays,
        new_risks: reviewData.new_risks,
        next_steps: reviewData.next_steps,
        consultant_name: reviewData.consultant_name,
      },
    });

    setSaving(false);
    if (res.data?.error) { setError(res.data.error); return; }

    await invalidateActionPlanQueries(qc, reviewData.assessment_id, reviewData.action_plan_id, tenantId);

    setStep('summary');
    onReviewCompleted?.(res.data);
  };

  const activeTasks = (tasks || []).filter(t => t.status !== 'cancelled');

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {step === 'summary' ? '✓ Revisão Concluída' : `Nova Revisão do Plano de Ação — Nº ${reviewData.review_number}`}
          </DialogTitle>
        </DialogHeader>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* STEP 1: Dados da revisão */}
          {step === 'form' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Data da visita *</label>
                  <Input
                    type="date"
                    value={reviewData.review_date}
                    onChange={e => setReviewData(d => ({ ...d, review_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo de visita *</label>
                  <Select value={reviewData.visit_type} onValueChange={v => setReviewData(d => ({ ...d, visit_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISIT_TYPES.map(vt => (
                        <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Consultor responsável</label>
                <Input
                  value={reviewData.consultant_name}
                  onChange={e => setReviewData(d => ({ ...d, consultant_name: e.target.value }))}
                  placeholder="Nome do consultor"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Resumo executivo</label>
                <Textarea
                  value={reviewData.executive_summary}
                  onChange={e => setReviewData(d => ({ ...d, executive_summary: e.target.value }))}
                  rows={3}
                  placeholder="Síntese da visita para o cliente..."
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Principais avanços</label>
                  <Textarea value={reviewData.key_advances} onChange={e => setReviewData(d => ({ ...d, key_advances: e.target.value }))} rows={2} className="resize-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Principais atrasos</label>
                  <Textarea value={reviewData.key_delays} onChange={e => setReviewData(d => ({ ...d, key_delays: e.target.value }))} rows={2} className="resize-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Novos riscos</label>
                  <Textarea value={reviewData.new_risks} onChange={e => setReviewData(d => ({ ...d, new_risks: e.target.value }))} rows={2} className="resize-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Próximos passos</label>
                  <Textarea value={reviewData.next_steps} onChange={e => setReviewData(d => ({ ...d, next_steps: e.target.value }))} rows={2} className="resize-none text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Confirmação antes de concluir */}
           {step === 'tasks' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">Revisão pronta para conclusão</p>
                <p className="text-xs text-blue-700">
                  As edições das tarefas devem ser feitas diretamente na <strong>Lista Executiva</strong> ou <strong>Kanban</strong> em modo de revisão.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Tarefas ativas no plano:</p>
                {activeTasks.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeTasks.map(task => (
                      <div key={task.id} className="flex items-start gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${task.priority === 'critical' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                          <p className="text-xs text-slate-500">Status: <span className="font-semibold">{STATUS_OPTIONS.find(s => s.value === task.status)?.label ?? task.status}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-sm">Nenhuma tarefa ativa no plano.</div>
                )}
              </div>
            </div>
           )}

          {/* STEP 3: Summary */}
          {step === 'summary' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-base font-bold text-slate-800">Revisão Nº {reviewData.review_number} concluída!</p>
              <p className="text-sm text-slate-500 max-w-sm">
                O histórico das alterações foi preservado em ActionTaskReview. O estado atual das tarefas foi atualizado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleCreateDraft}
                disabled={saving || !reviewData.review_date || !reviewData.visit_type}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Avançar — Revisar tarefas
              </Button>
            </>
          )}
          {step === 'tasks' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>Voltar</Button>
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Concluir revisão
              </Button>
            </>
          )}
          {step === 'summary' && (
            <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white">Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}