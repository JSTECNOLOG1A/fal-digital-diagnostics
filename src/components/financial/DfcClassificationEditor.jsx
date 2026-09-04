/**
 * DfcClassificationEditor — Modal de edição/reclassificação da DFC.
 *
 * Permite ao usuário reclassificar o bucket DFC de cada rubrica via dropdown.
 * Não edita valores monetários — apenas a classificação (bucket).
 *
 * Fluxo:
 *   1. Carrega FinancialDfcCompositionLine (composição atual) + FinancialDfcClassificationOverride (overrides ativos)
 *   2. Usuário altera bucket via dropdown por rubrica
 *   3. "Salvar e Reprocessar" → salva overrides + invoca buildFinancialStatements (dfc_only=true)
 *   4. DFC é reprocessada respeitando overrides; BP/DRE/indicadores/etc. não mudam
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { financialKey, invalidateFinancialQueries } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

const BUCKET_OPTIONS = [
  { value: 'cash', label: 'Caixa e equivalentes' },
  { value: 'operating_asset', label: 'Ativo operacional' },
  { value: 'operating_liability', label: 'Passivo operacional' },
  { value: 'investing', label: 'Investimento' },
  { value: 'financing', label: 'Financiamento' },
  { value: 'non_cash_adjustment', label: 'Ajuste sem efeito caixa' },
  { value: 'ignored', label: 'Ignorar na DFC' },
  { value: 'requires_review', label: 'Revisar' },
];

const BUCKET_LABEL = Object.fromEntries(BUCKET_OPTIONS.map(o => [o.value, o.label]));

const SOURCE_LABEL = {
  canonical_map: 'Automático',
  text_inference: 'Inferência textual',
  dfc_classification: 'dfc_classification',
  manual_override: 'Manual',
};

function fmtR(v) {
  if (v == null || v === '') return '—';
  const isNeg = v < 0;
  const abs = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.abs(v));
  return isNeg ? `(${abs})` : abs;
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.uploadId
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 */
export default function DfcClassificationEditor({ diagnosisId, uploadId, open, onOpenChange }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState(/** @type {Record<string, any>} */ ({})); // rubric_key → { manual_bucket, reason }
  const [pendingClears, setPendingClears] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Carregar composição atual
  const { data: compositionLines = [], isLoading: loadingComp } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'dfc-composition'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialDfcCompositionLine.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id:currentScope.processing_run_id, publication_status:'active' }, 'bucket', 5000
    ),
    enabled: !!currentScope?.processing_run_id && open,
  });

  // Carregar overrides ativos
  const { data: overrides = [], isLoading: loadingOv } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'dfc-overrides'),
    queryFn: () => base44.entities.FinancialDfcClassificationOverride.filter(
      { financial_diagnosis_id: diagnosisId, status: 'active' }, 'id', 500
    ),
    enabled: !!diagnosisId && open,
  });

  const overrideByRubricKey = useMemo(() => {
    const m = new Map();
    for (const ov of overrides) {
      if (ov.rubric_key) m.set(ov.rubric_key, ov);
    }
    return m;
  }, [overrides]);

  // Agrupar composition lines por bucket para exibição ordenada
  const sortedLines = useMemo(() => {
    return [...compositionLines].sort((a, b) => {
      const ga = a.group_label || '';
      const gb = b.group_label || '';
      if (ga !== gb) return ga.localeCompare(gb);
      return Math.abs(b.impact_on_dfc || 0) - Math.abs(a.impact_on_dfc || 0);
    });
  }, [compositionLines]);

  // Determina o valor atual do dropdown para uma rubrica
  function getCurrentDropdownValue(line) {
    const pending = pendingChanges[line.rubric_key];
    if (pending) return pending.manual_bucket || '__auto__';
    if (pendingClears.has(line.rubric_key)) return '__auto__';
    const ov = overrideByRubricKey.get(line.rubric_key);
    if (ov?.manual_bucket) return ov.manual_bucket;
    return '__auto__';
  }

  function getCurrentReason(line) {
    const pending = pendingChanges[line.rubric_key];
    if (pending?.reason !== undefined) return pending.reason;
    const ov = overrideByRubricKey.get(line.rubric_key);
    return ov?.reason || '';
  }

  function handleBucketChange(line, value) {
    setPendingClears(prev => {
      const next = new Set(prev);
      next.delete(line.rubric_key);
      return next;
    });
    if (value === '__auto__') {
      // Marcar para limpar override
      const ov = overrideByRubricKey.get(line.rubric_key);
      if (ov) {
        setPendingClears(prev => new Set(prev).add(line.rubric_key));
      }
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[line.rubric_key];
        return next;
      });
    } else {
      setPendingChanges(prev => ({
        ...prev,
        [line.rubric_key]: {
          manual_bucket: value,
          reason: prev[line.rubric_key]?.reason || overrideByRubricKey.get(line.rubric_key)?.reason || '',
        },
      }));
    }
  }

  function handleReasonChange(line, reason) {
    const currentValue = getCurrentDropdownValue(line);
    if (currentValue === '__auto__') return; // não tem override, não precisa de reason
    setPendingChanges(prev => ({
      ...prev,
      [line.rubric_key]: {
        manual_bucket: currentValue,
        reason,
      },
    }));
  }

  async function handleSaveAndReprocess() {
    setSaving(true);
    try {
      // 1. Salvar overrides pendentes
      const savePromises = Object.entries(pendingChanges).map(([rubric_key, change]) => {
        const line = compositionLines.find(l => l.rubric_key === rubric_key);
        if (!line) return null;
        return base44.functions.invoke('saveDfcClassificationOverride', {
          financial_diagnosis_id: diagnosisId,
          rubric_key,
          rubric_label: line.rubric_label,
          canonical_key: line.canonical_key,
          group_label: line.group_label,
          auto_bucket: line.bucket,
          manual_bucket: change.manual_bucket,
          reason: change.reason || null,
          period: line.period,
          comparison_period: line.comparison_period,
        });
      }).filter(Boolean);

      // 2. Limpar overrides pendentes
      const clearPromises = [...pendingClears].map(rubric_key => {
        return base44.functions.invoke('saveDfcClassificationOverride', {
          action: 'clear',
          financial_diagnosis_id: diagnosisId,
          rubric_key,
        });
      });

      await Promise.all([...savePromises, ...clearPromises]);
      toast({ title: `${savePromises.length} override(s) salvo(s) | ${clearPromises.length} limpo(s)` });

      // 3. Reprocessar DFC — chama buildFinancialStatements DIRETAMENTE com dfc_only=true
      const rebuildToast = toast({ title: 'Reprocessando DFC...', description: 'Aguarde...', duration: 0 });
      const rebuildRes = await base44.functions.invoke('buildFinancialStatements', {
        upload_id: uploadId,
        diagnosis_id: diagnosisId,
        dfc_only: true,
      });
      rebuildToast.dismiss();

      const rebuildData = rebuildRes?.data || rebuildRes;
      if (rebuildData?.success) {
        toast({ title: `DFC reprocessada | ${rebuildData.dfc_lines || 0} linhas | ${rebuildData.overrides_applied || 0} override(s) aplicado(s)` });
      } else {
        toast({ title: 'DFC reprocessada com avisos', variant: 'destructive' });
      }

      // 4. Invalidar caches para refresh
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-composition') });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-overrides') });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-validation') });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);

      // 5. Fechar modal
      setPendingChanges({});
      setPendingClears(new Set());
      onOpenChange(false);
    } catch (err) {
      toast({ title: `Erro: ${err.message}`, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.keys(pendingChanges).length > 0 || pendingClears.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-500" />
            Editar classificação da DFC
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Reclassifique o bucket DFC de cada rubrica. Os valores monetários não são editáveis — apenas a classificação.
            Após salvar, a DFC é reprocessada respeitando os overrides. BP, DRE, indicadores e Kanitz não são alterados.
          </p>
        </DialogHeader>

        {(loadingComp || loadingOv) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Carregando composição...</span>
          </div>
        ) : sortedLines.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            Composição da DFC não encontrada. Reprocesse o diagnóstico primeiro.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-slate-800 px-3 py-2 gap-2">
              <span className="flex-1 text-[10px] font-bold text-white uppercase tracking-wider">Rubrica</span>
              <span className="w-20 text-[10px] font-bold text-white uppercase tracking-wider text-right pr-1">Variação</span>
              <span className="w-28 text-[10px] font-bold text-white uppercase tracking-wider">Bucket atual</span>
              <span className="w-44 text-[10px] font-bold text-white uppercase tracking-wider">Override manual</span>
              <span className="w-32 text-[10px] font-bold text-white uppercase tracking-wider">Motivo</span>
            </div>

            {/* Rows */}
            {sortedLines.map((line) => {
              const dropdownValue = getCurrentDropdownValue(line);
              const hasOverride = !!overrideByRubricKey.get(line.rubric_key);
              const isPending = pendingChanges[line.rubric_key] || pendingClears.has(line.rubric_key);
              const reason = getCurrentReason(line);

              return (
                <div
                  key={line.rubric_key}
                  className={`flex items-center px-3 py-1.5 gap-2 border-b border-slate-50 hover:bg-slate-50/50 ${isPending ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] text-slate-700 truncate block" title={line.rubric_label}>
                      {line.rubric_label || line.rubric_key}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">{line.group_label || '—'}</span>
                  </div>
                  <span className={`w-20 text-right text-[11px] tabular-nums pr-1 ${
                    line.delta > 0 ? 'text-emerald-600' : line.delta < 0 ? 'text-red-500' : 'text-slate-400'
                  }`}>{fmtR(line.delta)}</span>
                  <div className="w-28 flex flex-col items-start gap-0.5">
                    <span className="text-[11px] font-medium text-slate-600">{BUCKET_LABEL[line.bucket] || line.bucket}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${
                      line.bucket_source === 'manual_override' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                      line.bucket_source === 'text_inference' ? 'border-amber-300 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-500 bg-slate-50'
                    }`}>
                      {SOURCE_LABEL[line.bucket_source] || line.bucket_source}
                    </Badge>
                  </div>
                  <div className="w-44">
                    <Select value={dropdownValue} onValueChange={(v) => handleBucketChange(line, v)}>
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Automático (sem override)</SelectItem>
                        {BUCKET_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input
                      value={reason}
                      onChange={(e) => handleReasonChange(line, e.target.value)}
                      placeholder="Opcional"
                      className="h-7 text-[11px]"
                      disabled={dropdownValue === '__auto__'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
            <span>
              {hasChanges
                ? `${Object.keys(pendingChanges).length} alteração(ões) + ${pendingClears.size} limpeza(s) pendente(s)`
                : 'Selecione "Automático" para limpar override de uma rubrica'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAndReprocess}
              disabled={saving || !hasChanges}
              className="bg-slate-700 hover:bg-slate-800 text-white"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processando...</>
              ) : (
                <><Save className="w-3.5 h-3.5 mr-1.5" /> Salvar e Reprocessar DFC</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}