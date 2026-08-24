/**
 * PendingRecommendationsPanel — Aba "Sugestões Pendentes" no Plano de Ação
 * Exibe ActionRecommendations não organizadas e permite convertê-las em tarefas.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  TrendingUp, BarChart3, BookOpen, User, Lightbulb,
  CheckCircle2, X, Plus, ArrowRight, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { actionPlanKey, invalidateActionPlanQueries } from '@/lib/query-client';

const SOURCE_CFG = {
  financial_diagnostic: { label: 'Financeiro',    icon: TrendingUp, cls: 'bg-emerald-100 text-emerald-700' },
  fal_diagnostic:       { label: 'FAL',           icon: BarChart3,  cls: 'bg-blue-100 text-blue-700' },
  library:              { label: 'Biblioteca',    icon: BookOpen,   cls: 'bg-violet-100 text-violet-700' },
  ai:                   { label: 'IA',            icon: Lightbulb,  cls: 'bg-amber-100 text-amber-700' },
  manual:               { label: 'Consultor',     icon: User,       cls: 'bg-slate-100 text-slate-600' },
};

const STATUS_CFG = {
  needs_classification: { label: 'Pendente de organização', cls: 'bg-amber-100 text-amber-700' },
  suggested:            { label: 'Sugerido',                cls: 'bg-blue-100 text-blue-700' },
  accepted:             { label: 'Aceito',                  cls: 'bg-indigo-100 text-indigo-700' },
  approved:             { label: 'Aprovado',                cls: 'bg-green-100 text-green-700' },
  converted_to_task:    { label: 'Convertido em tarefa',    cls: 'bg-emerald-100 text-emerald-700' }, // legado leitura
  converted_to_tasks:   { label: 'Convertido em tarefa',    cls: 'bg-emerald-100 text-emerald-700' },
  rejected:             { label: 'Rejeitado',               cls: 'bg-slate-100 text-slate-400' },
};

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

// ─── Organizar Modal ──────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onConverted
 */
function OrganizeModal({ rec, planId, assessmentId, tenantId, onClose, onConverted }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: rec.title || '',
    description: rec.recommendation_text || '',
    dimension_key: rec.suggested_dimension_key || '',
    subdimension_key: rec.suggested_subdimension_key || '',
    typical_owner: rec.suggested_owner_area || '',
    priority: rec.suggested_priority || 'medium',
    horizon: '90d',
    impact_score: rec.suggested_impact_score || 3,
    effort_score: rec.suggested_effort_score || 3,
  });

  const handleConvert = async () => {
    if (!planId) return;
    setSaving(true);
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'convert',
      recommendation_id: rec.id,
      plan_id: planId,
      task_title: form.title,
      horizon: form.horizon,
      owner_name: form.typical_owner || null,
      tenant_id: tenantId,
    });
    await invalidateActionPlanQueries(qc, assessmentId, planId, tenantId);
    setSaving(false);
    onConverted?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Organizar sugestão no plano</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Título da tarefa *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição / Recomendação</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="resize-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Dimensão</label>
              <Select value={form.dimension_key} onValueChange={v => setForm(f => ({ ...f, dimension_key: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Prioridade</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
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
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Horizonte</label>
              <Select value={form.horizon} onValueChange={v => setForm(f => ({ ...f, horizon: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 dias</SelectItem>
                  <SelectItem value="60d">60 dias</SelectItem>
                  <SelectItem value="90d">90 dias</SelectItem>
                  <SelectItem value="180d">180 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Responsável sugerido</label>
              <Input className="h-8 text-xs" value={form.typical_owner} onChange={e => setForm(f => ({ ...f, typical_owner: e.target.value }))} placeholder="Área / papel" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Impacto (1-5)</label>
              <Input type="number" min={1} max={5} className="h-8 text-xs" value={form.impact_score} onChange={e => setForm(f => ({ ...f, impact_score: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Esforço (1-5)</label>
              <Input type="number" min={1} max={5} className="h-8 text-xs" value={form.effort_score} onChange={e => setForm(f => ({ ...f, effort_score: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            onClick={handleConvert}
            disabled={saving || !form.title || !planId}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Converter em tarefa do plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Manual Recommendation Modal ─────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onAdded
 */
function AddRecommendationModal({ planId, assessmentId, tenantId, onClose, onAdded }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    recommendation_text: '',
    rationale: '',
    suggested_dimension_key: '',
    suggested_owner_area: '',
    suggested_priority: 'medium',
    suggested_impact_score: 3,
    suggested_effort_score: 3,
  });

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'create_manual',
      recommendation_data: {
        tenant_id: tenantId,
        assessment_id: assessmentId,
        action_plan_id: planId,
        title: form.title,
        recommendation_text: form.recommendation_text,
        rationale: form.rationale,
        dimension_key: form.suggested_dimension_key || null,
        suggested_owner_area: form.suggested_owner_area || null,
        priority: form.suggested_priority,
        impact_score: Number(form.suggested_impact_score),
        effort_score: Number(form.suggested_effort_score),
      },
    });
    await invalidateActionPlanQueries(qc, assessmentId, planId, tenantId);
    setSaving(false);
    onAdded?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Recomendação do consultor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Recomendação técnica *</label>
            <Textarea value={form.recommendation_text} onChange={e => setForm(f => ({ ...f, recommendation_text: e.target.value }))} rows={3} className="resize-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Racional / Justificativa</label>
            <Textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} rows={2} className="resize-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Dimensão</label>
              <Select value={form.suggested_dimension_key} onValueChange={v => setForm(f => ({ ...f, suggested_dimension_key: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Prioridade sugerida</label>
              <Select value={form.suggested_priority} onValueChange={v => setForm(f => ({ ...f, suggested_priority: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            onClick={handleSave}
            disabled={saving || !form.title || !form.recommendation_text}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar recomendação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 */
export default function PendingRecommendationsPanel({ planId, assessmentId, tenantId }) {
  const qc = useQueryClient();
  const [organizeRec, setOrganizeRec] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: actionPlanKey(tenantId, assessmentId, planId, 'recommendations'),
    queryFn: async () => {
      const [byPlan, byAssessment] = await Promise.all([
        planId ? base44.entities.ActionRecommendation.filter({ action_plan_id: planId, tenant_id: tenantId }, '-created_date', 100) : Promise.resolve([]),
        assessmentId ? base44.entities.ActionRecommendation.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-created_date', 100) : Promise.resolve([]),
      ]);
      const map = new Map();
      [...byPlan, ...byAssessment].forEach(r => map.set(r.id, r));
      return [...map.values()].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    },
    enabled: !!(planId || assessmentId),
  });

  const handleReject = async (rec) => {
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'reject',
      recommendation_id: rec.id,
    });
    invalidateActionPlanQueries(qc, assessmentId, planId, tenantId);
  };

  const visible = recommendations.filter(r => {
    if (filterStatus === 'pending') return ['needs_classification', 'suggested', 'accepted'].includes(r.status);
    if (filterStatus === 'converted') return r.status === 'converted_to_task' || r.status === 'converted_to_tasks';
    if (filterStatus === 'rejected') return r.status === 'rejected';
    return true;
  });

  const pendingCount = recommendations.filter(r => ['needs_classification', 'suggested', 'accepted'].includes(r.status)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Sugestões Pendentes</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Recomendações de financeiro, FAL, biblioteca, IA e consultor
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Recomendação do consultor
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'pending', label: `Pendentes${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'converted', label: 'Convertidas' },
          { key: 'rejected', label: 'Rejeitadas' },
          { key: 'all', label: 'Todas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterStatus === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {filterStatus === 'pending'
              ? 'Nenhuma sugestão pendente de organização.'
              : 'Nenhuma sugestão nesta categoria.'}
          </p>
          {filterStatus === 'pending' && (
            <p className="text-xs mt-1 text-slate-300">
              Achados financeiros enviados ao plano aparecerão aqui.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(rec => {
            const src = SOURCE_CFG[rec.source_type] || SOURCE_CFG.manual;
            const sta = STATUS_CFG[rec.status] || STATUS_CFG.needs_classification;
            const isPending = ['needs_classification', 'suggested', 'accepted'].includes(rec.status);

            return (
              <div
                key={rec.id}
                className={`bg-white border rounded-xl p-4 space-y-2 ${isPending ? 'border-amber-200' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${src.cls}`}>
                        {React.createElement(src.icon, { className: 'w-3 h-3' })} {src.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sta.cls}`}>
                        {sta.label}
                      </span>
                      {rec.suggested_priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                          ${rec.suggested_priority === 'critical' ? 'bg-red-100 text-red-700' :
                            rec.suggested_priority === 'high' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'}`}>
                          {rec.suggested_priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                    {rec.recommendation_text && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rec.recommendation_text}</p>
                    )}
                    {rec.rationale && (
                      <p className="text-xs text-slate-400 mt-0.5 italic line-clamp-1">{rec.rationale}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[10px] text-slate-400">
                    {rec.created_date ? format(new Date(rec.created_date), 'dd/MM/yyyy') : ''}
                    {rec.created_by ? ` · ${rec.created_by}` : ''}
                  </p>
                  {isPending && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-slate-600 h-7 px-2 text-xs"
                        onClick={() => handleReject(rec)}
                      >
                        <X className="w-3 h-3 mr-1" /> Ignorar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-7 px-3 text-xs"
                        onClick={() => setOrganizeRec(rec)}
                        disabled={!planId}
                      >
                        Organizar no plano <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {organizeRec && (
        <OrganizeModal
          rec={organizeRec}
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          onClose={() => setOrganizeRec(null)}
          onConverted={() => invalidateActionPlanQueries(qc, assessmentId, planId, tenantId)}
        />
      )}
      {showAddModal && (
        <AddRecommendationModal
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}