import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, CheckCircle2, XCircle, Zap,
  Target, Lightbulb, Loader2, AlertCircle, Tag, Sparkles
} from 'lucide-react';
import { REC_STATUS_STYLE, SOURCE_CFG, DIM_LABELS, PRIORITY_STYLE } from './APlanConstants';
import { format } from 'date-fns';
import { invalidateActionPlanQueries } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.tasks
 * @param {any=} props.onClose
 * @param {any=} props.onUpdated
 * @param {boolean=} props.readOnly
 */
export default function RecommendationDrawer({ rec, planId, assessmentId, tenantId, tasks, onClose, onUpdated, readOnly = false }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'reject' | 'convert'
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editForm, setEditForm] = useState({ ...rec });
  const [convertTaskTitle, setConvertTaskTitle] = useState(rec.title || '');
  const [convertDescription, setConvertDescription] = useState(rec.recommendation_text || '');
  const [convertHorizon, setConvertHorizon] = useState('90d');
  const [convertOwner, setConvertOwner] = useState(rec.suggested_owner_area || '');
  const [convertPriority, setConvertPriority] = useState(rec.priority || 'medium');
  const [convertEvidence, setConvertEvidence] = useState(rec.evidence_required || '');
  const [convertExpectedResult, setConvertExpectedResult] = useState(rec.expected_result || '');
  const [aiLoading, setAiLoading] = useState(false);

  // Cluster linking state (for recs without cluster_key)
  const [availableClusters, setAvailableClusters] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [clusterSuggesting, setClusterSuggesting] = useState(false);
  const [clusterSuggestion, setClusterSuggestion] = useState(null); // { cluster_key, cluster_name, reason }
  const [linkingCluster, setLinkingCluster] = useState(false);

  const noCluster = !rec.cluster_key;

  // Load clusters for this dimension when rec has no cluster
  useEffect(() => {
    if (readOnly || !noCluster || !rec.dimension_key || !tenantId) return;
    base44.entities.FalCluster.filter({ tenant_id: tenantId, dimension_key: rec.dimension_key }, 'key', 200)
      .then(clusters => setAvailableClusters(clusters || []))
      .catch(() => {});
  }, [noCluster, rec.dimension_key, tenantId]);

  const handleSuggestCluster = async () => {
    if (readOnly) return;
    if (!availableClusters.length) return;
    setClusterSuggesting(true);
    const clusterList = availableClusters.map(c => `${c.key}: ${c.name}`).join('\n');
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um especialista no Método FAL de diagnóstico empresarial.
Dado o título e texto de uma recomendação, identifique qual cluster da lista abaixo é o mais adequado para vincular esta recomendação.

RECOMENDAÇÃO:
Título: "${rec.title}"
Texto: "${rec.recommendation_text}"
Dimensão: "${DIM_LABELS[rec.dimension_key] || rec.dimension_key}"

CLUSTERS DISPONÍVEIS NESTA DIMENSÃO:
${clusterList}

Responda com o cluster_key exato do cluster mais adequado e uma justificativa curta (1 frase).`,
      response_json_schema: {
        type: 'object',
        properties: {
          cluster_key: { type: 'string' },
          cluster_name: { type: 'string' },
          reason: { type: 'string' },
        }
      }
    }).catch(() => null);
    if (result?.cluster_key) {
      setClusterSuggestion(result);
      setSelectedCluster(result.cluster_key);
    }
    setClusterSuggesting(false);
  };

  const handleLinkCluster = async () => {
    if (readOnly) return;
    if (!selectedCluster) return;
    setLinkingCluster(true);
    const cluster = availableClusters.find(c => c.key === selectedCluster);
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'link_cluster',
      recommendation_id: rec.id,
      cluster_key: selectedCluster,
      subdimension_key: cluster?.subdimension_key || rec.subdimension_key || null,
    });
    await await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
    onUpdated?.();
    setLinkingCluster(false);
    onClose();
  };

  const statusCfg = REC_STATUS_STYLE[rec.status] || REC_STATUS_STYLE.suggested;
  const srcCfg = SOURCE_CFG[rec.source_type] || SOURCE_CFG.manual;
  const priCfg = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.medium;

  const linkedTasks = tasks.filter(t => rec.converted_task_ids?.includes(t.id));

  const handleApprove = async () => {
    if (readOnly) return;
    if (!planId) return;
    setSaving(true);
    // Aprovar + converter em tarefa automaticamente
    const res = await base44.functions.invoke('manageActionRecommendation', {
      action: 'convert',
      recommendation_id: rec.id,
      plan_id: planId,
      task_title: rec.title,
      description: rec.recommendation_text,
      horizon: rec.suggested_deadline_days
        ? (rec.suggested_deadline_days <= 30 ? '30d' : rec.suggested_deadline_days <= 60 ? '60d' : rec.suggested_deadline_days <= 90 ? '90d' : '180d')
        : '90d',
      owner_name: rec.suggested_owner_area || '',
      priority: rec.priority || 'medium',
      evidence_required: rec.evidence_required || '',
      expected_result: rec.expected_result || '',
      tenant_id: tenantId,
    });
    if (!res.data?.error) {
      await Promise.all([
        await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
        await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
      ]);
      onUpdated?.();
      onClose();
    }
    setSaving(false);
  };

  const handleReject = async () => {
    if (readOnly) return;
    setSaving(true);
    const res = await base44.functions.invoke('manageActionRecommendation', {
      action: 'reject',
      recommendation_id: rec.id,
      rejected_reason: rejectReason,
    });
    if (!res.data?.error) {
      await await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
      onUpdated?.();
      onClose();
    }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (readOnly) return;
    setSaving(true);
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'edit',
      recommendation_id: rec.id,
      edit_data: {
        title: editForm.title,
        recommendation_text: editForm.recommendation_text,
        rationale: editForm.rationale,
        practical_steps: editForm.practical_steps,
        evidence_required: editForm.evidence_required,
        expected_result: editForm.expected_result,
        suggested_owner_area: editForm.suggested_owner_area,
        priority: editForm.priority,
        impact_score: editForm.impact_score ? Number(editForm.impact_score) : undefined,
        effort_score: editForm.effort_score ? Number(editForm.effort_score) : undefined,
      },
    });
    await await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
    onUpdated?.();
    setSaving(false);
    setMode('view');
  };

  const handleConvert = async () => {
    if (readOnly) return;
    if (!planId || !convertTaskTitle) return;
    setSaving(true);
    const res = await base44.functions.invoke('manageActionRecommendation', {
      action: 'convert',
      recommendation_id: rec.id,
      plan_id: planId,
      task_title: convertTaskTitle,
      description: convertDescription,
      horizon: convertHorizon,
      owner_name: convertOwner,
      priority: convertPriority,
      evidence_required: convertEvidence,
      expected_result: convertExpectedResult,
      tenant_id: tenantId,
    });
    if (!res.data?.error) {
      await Promise.all([
        await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
        await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId),
      ]);
      onUpdated?.();
      onClose();
    }
    setSaving(false);
  };

  const handleImproveWithAI = async () => {
    if (readOnly) return;
    setAiLoading(true);
    const res = await base44.functions.invoke('manageActionRecommendation', {
      action: 'improve_ai',
      recommendation_id: rec.id,
    });
    if (res.data?.improved_text) {
      setEditForm(f => ({
        ...f,
        recommendation_text: res.data.improved_text,
        practical_steps: res.data.improved_steps || f.practical_steps,
        evidence_required: res.data.improved_evidence || f.evidence_required,
      }));
      setMode('edit');
    }
    setAiLoading(false);
  };

  const canApprove = ['suggested', 'needs_classification', 'approved'].includes(rec.status);
  const canEdit = rec.status !== 'converted_to_tasks';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${srcCfg.cls}`}>{srcCfg.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${priCfg.badge}`}>{priCfg.label}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">{rec.title}</h2>
            {rec.dimension_key && (
              <p className="text-xs text-slate-400 mt-0.5">{DIM_LABELS[rec.dimension_key] || rec.dimension_key}{rec.subdimension_key ? ` › ${rec.subdimension_key}` : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mode === 'view' && (
            <>
              {/* Banner: sem cluster — solicitar vinculação */}
              {noCluster && rec.status !== 'converted_to_tasks' && !readOnly && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Recomendação sem cluster vinculado</p>
                  </div>
                  <p className="text-xs text-amber-700">Para converter em tarefa do plano, vincule esta recomendação a um cluster da dimensão <strong>{DIM_LABELS[rec.dimension_key] || rec.dimension_key}</strong>.</p>

                  {clusterSuggestion && (
                    <div className="bg-white border border-amber-200 rounded-lg p-2 text-xs text-slate-700 space-y-0.5">
                      <p className="font-semibold text-emerald-700">✦ Sugestão da IA: <span className="font-bold">{clusterSuggestion.cluster_name || clusterSuggestion.cluster_key}</span></p>
                      <p className="text-slate-500 italic">{clusterSuggestion.reason}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {availableClusters.length > 0 && (
                      <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                        <SelectTrigger className="h-7 text-xs flex-1 min-w-[140px] bg-white">
                          <SelectValue placeholder="Selecionar cluster..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClusters.map(c => (
                            <SelectItem key={c.key} value={c.key} className="text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={handleSuggestCluster} disabled={clusterSuggesting || !availableClusters.length}>
                      {clusterSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Sugerir
                    </Button>
                    {selectedCluster && (
                      <Button size="sm" className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={handleLinkCluster} disabled={linkingCluster}>
                        {linkingCluster ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Vincular
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {rec.recommendation_text && (
                <Section title="Recomendação técnica" icon={Target}>
                  <p className="text-sm text-slate-700 leading-relaxed">{rec.recommendation_text}</p>
                </Section>
              )}
              {rec.rationale && (
                <Section title="Racional — por que isso importa" icon={Lightbulb}>
                  <p className="text-sm text-slate-600 italic">{rec.rationale}</p>
                </Section>
              )}
              {rec.practical_steps && (
                <Section title="Passos práticos">
                  <p className="text-sm text-slate-700 whitespace-pre-line">{rec.practical_steps}</p>
                </Section>
              )}
              {rec.evidence_required && (
                <Section title="Evidência necessária">
                  <p className="text-sm text-slate-600">{rec.evidence_required}</p>
                </Section>
              )}
              {rec.expected_result && (
                <Section title="Resultado esperado">
                  <p className="text-sm text-slate-600">{rec.expected_result}</p>
                </Section>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                {rec.suggested_owner_area && <MetaRow label="Responsável sugerido" value={rec.suggested_owner_area} />}
                {rec.suggested_deadline_days && <MetaRow label="Prazo sugerido" value={`${rec.suggested_deadline_days} dias`} />}
                {rec.impact_score && <MetaRow label="Impacto" value={`${rec.impact_score}/5`} />}
                {rec.effort_score && <MetaRow label="Esforço" value={`${rec.effort_score}/5`} />}
                {rec.created_by && <MetaRow label="Criado por" value={rec.created_by} />}
                {rec.created_date && <MetaRow label="Data" value={format(new Date(rec.created_date), 'dd/MM/yyyy')} />}
              </div>
              {rec.rejected_reason && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span><strong>Motivo da rejeição:</strong> {rec.rejected_reason}</span>
                </div>
              )}
              {linkedTasks.length > 0 && (
                <Section title={`Tarefas criadas (${linkedTasks.length})`}>
                  <div className="space-y-1">
                    {linkedTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {t.title}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {mode === 'edit' && (
            <div className="space-y-3">
              <Field label="Título *">
                <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </Field>
              <Field label="Recomendação técnica *">
                <Textarea value={editForm.recommendation_text} onChange={e => setEditForm(f => ({ ...f, recommendation_text: e.target.value }))} rows={3} className="resize-none text-sm" />
              </Field>
              <Field label="Racional">
                <Textarea value={editForm.rationale || ''} onChange={e => setEditForm(f => ({ ...f, rationale: e.target.value }))} rows={2} className="resize-none text-sm" />
              </Field>
              <Field label="Passos práticos">
                <Textarea value={editForm.practical_steps || ''} onChange={e => setEditForm(f => ({ ...f, practical_steps: e.target.value }))} rows={3} className="resize-none text-sm" />
              </Field>
              <Field label="Evidência necessária">
                <Textarea value={editForm.evidence_required || ''} onChange={e => setEditForm(f => ({ ...f, evidence_required: e.target.value }))} rows={2} className="resize-none text-sm" />
              </Field>
              <Field label="Resultado esperado">
                <Textarea value={editForm.expected_result || ''} onChange={e => setEditForm(f => ({ ...f, expected_result: e.target.value }))} rows={2} className="resize-none text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Responsável sugerido">
                  <Input value={editForm.suggested_owner_area || ''} onChange={e => setEditForm(f => ({ ...f, suggested_owner_area: e.target.value }))} />
                </Field>
                <Field label="Prioridade">
                  <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Informe o motivo da rejeição (preservado no histórico):</p>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ex: já implementado, não aplicável ao contexto atual, substituído por outra recomendação..."
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {mode === 'convert' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-600 mb-2">Estruturar tarefa do plano:</p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-1.5">Rastreabilidade FAL</div>
                <p><strong>Diagnóstico:</strong> {rec.assessment_id ? 'Diagnóstico FAL' : '—'}</p>
                <p><strong>Dimensão › Cluster:</strong> {DIM_LABELS[rec.dimension_key]} {rec.cluster_key ? `› ${rec.cluster_key}` : ''}</p>
                <p className="text-[9px]"><strong>Deduplic.:</strong> <code className="bg-slate-200/60 px-0.5 py-0.5 rounded font-mono">{rec.source_ref_id?.substring(0, 20)}...</code></p>
              </div>

              <Field label="Título da tarefa *">
                <Input value={convertTaskTitle} onChange={e => setConvertTaskTitle(e.target.value)} />
              </Field>

              <Field label="Descrição detalhada *">
                <Textarea value={convertDescription} onChange={e => setConvertDescription(e.target.value)} rows={3} className="resize-none text-sm" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prazo / Horizonte">
                  <Select value={convertHorizon} onValueChange={setConvertHorizon}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30d">30 dias</SelectItem>
                      <SelectItem value="60d">60 dias</SelectItem>
                      <SelectItem value="90d">90 dias</SelectItem>
                      <SelectItem value="180d">180 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Responsável / Área">
                  <Input value={convertOwner} onChange={e => setConvertOwner(e.target.value)} placeholder="Ex: Gestor de Compras" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prioridade">
                  <Select value={convertPriority} onValueChange={setConvertPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status Inicial">
                  <Input value="A Estruturar" disabled className="bg-slate-50 text-slate-500 cursor-not-allowed" />
                </Field>
              </div>

              <Field label="Evidência esperada">
                <Textarea value={convertEvidence} onChange={e => setConvertEvidence(e.target.value)} rows={2} className="resize-none text-sm" />
              </Field>

              <Field label="Resultado esperado / Critério de conclusão">
                <Textarea value={convertExpectedResult} onChange={e => setConvertExpectedResult(e.target.value)} rows={2} className="resize-none text-sm" />
              </Field>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {mode === 'view' && !readOnly && (
            <>
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 disabled:opacity-50"
                    onClick={handleApprove}
                    disabled={saving || !planId || noCluster}
                    title={noCluster ? 'Vincule a um cluster antes de converter em tarefa' : undefined}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Aprovar e converter em tarefa
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setMode('edit')}>Editar</Button>
                )}
                {aiLoading
                  ? <Button size="sm" variant="outline" disabled><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />IA...</Button>
                  : <Button size="sm" variant="outline" onClick={handleImproveWithAI} className="gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Melhorar com IA</Button>
                }
              </div>
              {!['rejected', 'cancelled', 'converted_to_tasks'].includes(rec.status) && (
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5" onClick={() => setMode('reject')}>
                  <XCircle className="w-3.5 h-3.5" /> Rejeitar recomendação
                </Button>
              )}
            </>
          )}
          {mode === 'edit' && !readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancelar</Button>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar alterações
              </Button>
            </div>
          )}
          {mode === 'reject' && !readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={handleReject} disabled={saving || !rejectReason}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar rejeição
              </Button>
            </div>
          )}
          {mode === 'convert' && !readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancelar</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2" onClick={handleConvert} disabled={saving || !convertTaskTitle}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} <Zap className="w-3.5 h-3.5" /> Criar tarefa
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.children
 */
function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 */
function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
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
      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}