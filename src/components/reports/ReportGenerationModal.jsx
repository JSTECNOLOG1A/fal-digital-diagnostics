/**
 * ReportGenerationModal
 * Modal para gerar um novo relatório.
 * Step 1: Selecionar preset
 * Step 2: Configurar parâmetros (título, revisão vinculada, observações)
 * Step 3: Confirmação de emissão + feedback
 * 
 * Regras:
 * - Nunca sobrescreve versão anterior (o backend garante)
 * - Salva payload_snapshot e report_parameters automaticamente
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentKey, actionPlanKey } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REPORT_PRESETS, REPORT_TYPES } from '@/lib/reportConstants';
import {
  CheckCircle2, Loader2, AlertCircle, FileText, ChevronRight
} from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.prefillPreset
 * @param {any=} props.onGenerated
 */
export default function ReportGenerationModal({ open, onClose, assessmentId, tenantId, prefillPreset, onGenerated }) {
  const qc = useQueryClient();
  const [step, setStep] = useState('preset'); // 'preset' | 'params' | 'confirm' | 'done'
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [params, setParams] = useState({
    report_title: '',
    notes: '',
    action_plan_review_id: '',
    diagnostic_link_id: '',
    mark_as_official: false,
  });

  // Carregar revisões concluídas disponíveis
  const { data: plans = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId }, '-created_date', 1),
    enabled: !!assessmentId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: actionPlanKey(tenantId, assessmentId, plans[0]?.id, 'reviews'),
    queryFn: () => base44.entities.ActionPlanReview.filter(
      { action_plan_id: plans[0].id, tenant_id: tenantId },
      'review_number',
      50
    ),
    enabled: !!plans[0]?.id,
  });
  const completedReviews = reviews.filter(r => r.status === 'completed');

  useEffect(() => {
    if (open) {
      setStep(prefillPreset ? 'params' : 'preset');
      setSelectedPreset(prefillPreset || null);
      setError(null);
      setResult(null);
      setParams(/** @type {any} */ ({ report_title: '', notes: '', action_plan_review_id: '', mark_as_official: false }));
    }
  }, [open, prefillPreset]);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setParams(p => ({
      ...p,
      report_title: preset.label,
    }));
    setStep('params');
  };

  const handleGenerate = async () => {
    if (!params.report_title) { setError('Título do relatório é obrigatório.'); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('generateAssessmentReportVersion', {
        assessment_id: assessmentId,
        report_type: selectedPreset?.report_type || 'custom',
        report_title: params.report_title,
        preset_id: selectedPreset?.id,
        report_parameters: {
          ...(selectedPreset?.parameters || {}),
          notes: params.notes,
          mark_as_official: params.mark_as_official,
          audience: selectedPreset?.audience,
        },
        action_plan_review_id: params.action_plan_review_id || undefined,
        diagnostic_link_id: params.diagnostic_link_id || undefined,
      });

      if (res.data?.error) {
        setError(res.data.error);
        return;
      }

      let generated = res.data;
      if (params.mark_as_official) {
        const official = await base44.functions.invoke('setOfficialAssessmentReportVersion', {
          report_version_id: res.data.report_version_id,
        });
        if (official.data?.error) throw new Error(official.data.error);
        generated = { ...res.data, official: true };
      }
      setResult(generated);
      qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'report-versions') });
      setStep('done');
      onGenerated?.(res.data);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Erro ao gerar relatório. Verifique se o diagnóstico está publicado e tente novamente.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const typeCfg = selectedPreset ? (REPORT_TYPES[selectedPreset.report_type] || REPORT_TYPES.custom) : null;
  const needsReview = selectedPreset?.report_type === 'review_cycle';
  const needsSynthesis = selectedPreset?.report_type === 'synthetic_integrated';

  // Carregar DiagnosticLinks ativos para o assessment (quando necessário)
  const { data: diagLinks = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'diagnostic-links'),
    queryFn: async () => {
      const assessment = await base44.entities.Assessment.get(assessmentId);
      if (!assessment?.group_id) return [];
      return base44.entities.DiagnosticLink.filter(
        { fal_assessment_id: assessmentId, tenant_id: tenantId, status: 'active' },
        '-created_date', 10
      );
    },
    enabled: !!assessmentId && !!tenantId && needsSynthesis,
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {step === 'done' ? '✓ Relatório Gerado' : 'Gerar Novo Relatório'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">

          {/* STEP: Selecionar preset */}
          {step === 'preset' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-3">Selecione o tipo de relatório a emitir:</p>
              {REPORT_PRESETS.map(preset => {
                const cfg = REPORT_TYPES[preset.report_type] || REPORT_TYPES.custom;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50/30 border-slate-200 bg-white`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
                      <FileText className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{preset.label}</p>
                      <p className="text-xs text-slate-400 truncate">{preset.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP: Parâmetros */}
          {step === 'params' && selectedPreset && (
            <div className="space-y-4">
              {typeCfg && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${typeCfg.bg} border ${typeCfg.border}`}>
                  <FileText className={`w-4 h-4 ${typeCfg.color}`} />
                  <span className={`text-xs font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Título do relatório *</label>
                <Input
                  value={params.report_title}
                  onChange={e => setParams(p => ({ ...p, report_title: e.target.value }))}
                  placeholder={selectedPreset.label}
                />
              </div>

              {/* Seletor de revisão — só para review_cycle */}
              {needsReview && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">
                    Revisão vinculada *
                    {completedReviews.length === 0 && (
                      <span className="ml-2 text-red-500">(Nenhuma revisão concluída disponível)</span>
                    )}
                  </label>
                  <Select
                    value={params.action_plan_review_id}
                    onValueChange={v => setParams(p => ({ ...p, action_plan_review_id: v }))}
                    disabled={completedReviews.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a revisão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {completedReviews.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          Revisão Nº{r.review_number} — {r.review_date ? new Date(String(r.review_date).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                          {r.consultant_name ? ` · ${r.consultant_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Observações internas</label>
                <Textarea
                  value={params.notes}
                  onChange={e => setParams(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="resize-none text-sm"
                  placeholder="Observações sobre esta emissão (não aparece no relatório)..."
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.mark_as_official}
                  onChange={e => setParams(p => ({ ...p, mark_as_official: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-slate-600">Marcar como versão oficial entregue ao cliente</span>
              </label>

              {/* Seletor de vínculo — só para synthetic_integrated */}
              {needsSynthesis && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">
                    Vínculo FAL + Financeiro *
                    {diagLinks.length === 0 && (
                      <span className="ml-2 text-red-500">(Nenhum vínculo ativo — vincule um diagnóstico financeiro primeiro)</span>
                    )}
                  </label>
                  <Select
                    value={params.diagnostic_link_id}
                    onValueChange={v => setParams(p => ({ ...p, diagnostic_link_id: v }))}
                    disabled={diagLinks.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vínculo ativo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {diagLinks.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          Vínculo ativo — criado em {l.linked_at ? new Date(l.linked_at).toLocaleDateString('pt-BR') : '—'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Aviso de não sobrescrita */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Regenerar criará uma nova versão e <strong>não substituirá</strong> o relatório anterior. Todos os relatórios anteriores permanecem acessíveis.</span>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">Relatório gerado com sucesso!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Código: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{result.report_code}</code>
                  {' · '} Versão {result.report_version_number}
                </p>
              </div>
              {result.payload_summary && (
                <div className="grid grid-cols-3 gap-3 text-center w-full max-w-xs">
                  {result.payload_summary.has_diagnostic && (
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-[10px] text-blue-500 font-semibold">Diagnóstico</p>
                      <p className="text-xs text-blue-800">✓</p>
                    </div>
                  )}
                  {result.payload_summary.task_count > 0 && (
                    <div className="bg-indigo-50 rounded-lg p-2">
                      <p className="text-[10px] text-indigo-500 font-semibold">Tarefas</p>
                      <p className="text-xs text-indigo-800">{result.payload_summary.task_count}</p>
                    </div>
                  )}
                  {result.payload_summary.review_count > 0 && (
                    <div className="bg-violet-50 rounded-lg p-2">
                      <p className="text-[10px] text-violet-500 font-semibold">Revisões</p>
                      <p className="text-xs text-violet-800">{result.payload_summary.review_count}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          {step === 'preset' && (
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          )}
          {step === 'params' && (
            <>
              <Button variant="outline" onClick={() => setStep('preset')}>Voltar</Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !params.report_title || (needsReview && !params.action_plan_review_id) || (needsSynthesis && !params.diagnostic_link_id)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : 'Gerar relatório'}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white">Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}