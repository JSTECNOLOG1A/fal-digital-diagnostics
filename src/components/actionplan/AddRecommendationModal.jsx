import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Zap, Lightbulb } from 'lucide-react';
import { DIM_LABELS, ORIGIN_CONTEXT_LABELS } from './APlanConstants';
import { invalidateActionPlanQueries } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onCreated
 */
export default function AddRecommendationModal({ planId, assessmentId, tenantId, onClose, onCreated }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [convertNow, setConvertNow] = useState(false);
  const [suggestToLibrary, setSuggestToLibrary] = useState(false);
  const [form, setForm] = useState({
    title: '',
    recommendation_text: '',
    rationale: '',
    dimension_key: '',
    subdimension_key: '',
    cluster_key: '',
    consultant_origin_context: 'reuniao',
    priority: 'medium',
    impact_score: '',
    effort_score: '',
    suggested_owner_area: '',
    suggested_deadline_days: '',
    evidence_required: '',
    expected_result: '',
    practical_steps: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.title || !form.recommendation_text) return;
    setSaving(true);

    // 1. Criar recomendação via backend
    const createRes = await base44.functions.invoke('manageActionRecommendation', {
      action: 'create_manual',
      recommendation_data: {
        tenant_id: tenantId,
        assessment_id: assessmentId,
        action_plan_id: planId,
        title: form.title,
        recommendation_text: form.recommendation_text,
        rationale: form.rationale || null,
        dimension_key: form.dimension_key || null,
        subdimension_key: form.subdimension_key || null,
        cluster_key: form.cluster_key || null,
        consultant_origin_context: form.consultant_origin_context || null,
        priority: form.priority,
        impact_score: form.impact_score ? Number(form.impact_score) : null,
        effort_score: form.effort_score ? Number(form.effort_score) : null,
        suggested_owner_area: form.suggested_owner_area || null,
        suggested_deadline_days: form.suggested_deadline_days ? Number(form.suggested_deadline_days) : null,
        evidence_required: form.evidence_required || null,
        expected_result: form.expected_result || null,
        practical_steps: form.practical_steps || null,
        suggest_to_library: suggestToLibrary,
      },
    });

    const rec = createRes.data?.recommendation;
    if (!rec) { setSaving(false); return; }

    // 2. Converter em tarefa se solicitado
    if (convertNow && planId) {
      const days = Number(form.suggested_deadline_days) || 90;
      const horizon = days <= 30 ? '30d' : days <= 60 ? '60d' : days <= 90 ? '90d' : '180d';
      await base44.functions.invoke('manageActionRecommendation', {
        action: 'convert',
        recommendation_id: rec.id,
        plan_id: planId,
        task_title: form.title,
        horizon,
        owner_name: form.suggested_owner_area || null,
        tenant_id: tenantId,
      });
    }

    // 3. Sugerir para biblioteca se solicitado
    if (suggestToLibrary && form.dimension_key && rec.id) {
      await base44.functions.invoke('manageActionRecommendation', {
        action: 'suggest_library',
        recommendation_id: rec.id,
      });
    }

    await Promise.all([
      await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
      await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
    ]);
    setSaving(false);
    onCreated?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Nova Recomendação Técnica do Consultor</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Implantar rotina mensal de planejamento financeiro" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Recomendação técnica *</label>
            <Textarea value={form.recommendation_text} onChange={e => set('recommendation_text', e.target.value)} rows={3} className="resize-none text-sm" placeholder="Descreva a recomendação com clareza técnica..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Racional — por que isso importa</label>
            <Textarea value={form.rationale} onChange={e => set('rationale', e.target.value)} rows={2} className="resize-none text-sm" placeholder="Justificativa metodológica..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Passos práticos de execução</label>
            <Textarea value={form.practical_steps} onChange={e => set('practical_steps', e.target.value)} rows={3} className="resize-none text-sm" placeholder="1. ...\n2. ...\n3. ..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Dimensão relacionada</label>
              <Select value={form.dimension_key} onValueChange={v => set('dimension_key', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Contexto de origem</label>
              <Select value={form.consultant_origin_context} onValueChange={v => set('consultant_origin_context', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGIN_CONTEXT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Prioridade</label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Responsável sugerido</label>
              <Input className="h-8 text-xs" value={form.suggested_owner_area} onChange={e => set('suggested_owner_area', e.target.value)} placeholder="Ex: Controller, CEO" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Prazo sugerido (dias)</label>
              <Input type="number" className="h-8 text-xs" value={form.suggested_deadline_days} onChange={e => set('suggested_deadline_days', e.target.value)} placeholder="Ex: 90" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Impacto (1-5)</label>
              <Input type="number" min={1} max={5} className="h-8 text-xs" value={form.impact_score} onChange={e => set('impact_score', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Esforço (1-5)</label>
              <Input type="number" min={1} max={5} className="h-8 text-xs" value={form.effort_score} onChange={e => set('effort_score', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Evidência esperada</label>
            <Textarea value={form.evidence_required} onChange={e => set('evidence_required', e.target.value)} rows={2} className="resize-none text-sm" placeholder="O que comprova que a ação foi executada?" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Resultado esperado</label>
            <Textarea value={form.expected_result} onChange={e => set('expected_result', e.target.value)} rows={2} className="resize-none text-sm" />
          </div>

          {/* Options */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={convertNow} onChange={e => setConvertNow(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-700 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-indigo-500" /> Converter em tarefa agora</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={suggestToLibrary} onChange={e => setSuggestToLibrary(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-700 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Sugerir para a Biblioteca FAL (como rascunho)</span>
            </label>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            onClick={handleSave}
            disabled={saving || !form.title || !form.recommendation_text}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Salvar recomendação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}