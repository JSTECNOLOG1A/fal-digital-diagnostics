/**
 * CashFlowStatementView — DFC Indireta
 * - Renderiza a tabela de DFC quando há FinancialStatementLine com statement_code='DFC'
 * - Caso não haja linhas, exibe estado vazio inteligente baseado em FinancialValidationResult
 *   (especialmente o código DFC_REQUIRES_TWO_PERIODS)
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { Waves, Info, Pencil, ChevronDown, AlertTriangle, Plus } from 'lucide-react';
import { BP_RUBRICS } from '@/lib/financialConstants';
import { Button } from '@/components/ui/button';
import DfcAlertsBlock from '@/components/financial/DfcAlertsBlock';
import DfcClassificationEditor from '@/components/financial/DfcClassificationEditor';
import DfcManualAdjustmentDialog from '@/components/financial/DfcManualAdjustmentDialog';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

const fmtPeriod = (p) => {
  if (!p) return p;
  const m = p.match(/^M-(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  const a = p.match(/^A-(\d{4})$/);
  if (a) return a[1];
  const q = p.match(/^Q-(\d{4})-(\d{2})$/);
  if (q) {const n = Math.ceil(parseInt(q[2], 10) / 3);return `${n}ºtrim/${q[1]}`;}
  const leg = p.match(/^(\d{4})-(\d{2})$/);
  return leg ? `${leg[2]}/${leg[1]}` : p;
};

const COL_VALUE = 'w-32 shrink-0';
/** Régua fixa de largura de texto — mesma calibração do BalanceSheetView.jsx (ver comentário lá). */
const COL_LABEL = 'w-80 shrink-0';

const BP_ORDER_MAP = {};
for (const rubrics of Object.values(BP_RUBRICS)) {
  for (const r of rubrics) {
    BP_ORDER_MAP[r.canonical_key] = r.display_order;
  }
}

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.className
  * @param {any=} props.diagnosisId
 */
function ValueCell({ value, className = '' }) {
  if (value == null || value === '' || value === 0) return <div className={`w-full text-right tabular-nums text-slate-300 ${className}`}>-</div>;
  const isNeg = value < 0;
  const digits = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(value));
  return (
    <div className={`w-full text-right tabular-nums whitespace-nowrap ${className}`}>
      <span style={{ visibility: isNeg ? 'visible' : 'hidden' }}>(</span>
      {digits}
      <span style={{ visibility: isNeg ? 'visible' : 'hidden' }}>)</span>
    </div>);

}

// Ordem canônica esperada das linhas de DFC (fallback caso display_order não venha do backend)
const DFC_ORDER = [
'dfc_resultado_liquido_periodo',
'dfc_ajustes_sem_efeito_caixa',
'dfc_variacao_ativos_operacionais',
'dfc_variacao_passivos_operacionais',
'dfc_caixa_liquido_atividades_operacionais',
'dfc_caixa_liquido_atividades_investimento',
'dfc_caixa_liquido_atividades_financiamento',
'dfc_aumento_reducao_liquida_caixa',
'dfc_caixa_inicial',
'dfc_caixa_final',
'dfc_movimentacoes_nao_identificadas',
'dfc_diferenca_validacao'];


const DFC_TOTAL_KEYS = new Set([
'dfc_caixa_liquido_atividades_operacionais',
'dfc_caixa_liquido_atividades_investimento',
'dfc_caixa_liquido_atividades_financiamento']
);

// Linhas com estilo "Total escuro" (fundo slate-800, texto branco bold)
const DFC_DARK_KEYS = new Set([
  'dfc_aumento_reducao_liquida_caixa'
]);

// Subtotais intermediários que NÃO exibem valor — apenas suas rubricas analíticas e o total final do bloco
const DFC_HIDE_TOTAL_KEYS = new Set([
'dfc_variacao_ativos_operacionais',
'dfc_variacao_passivos_operacionais']
);

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 */
function EmptyDfcState({ diagnosisId }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const { data: validations = [], isLoading } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'dfc-validation'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialValidationResult.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id:currentScope.processing_run_id, publication_status:'active', category: 'dfc_composicao' }, 'severity', 20
    ),
    enabled: !!currentScope?.processing_run_id
  });

  const dfcValidation = validations.find((v) => v.code === 'DFC_REQUIRES_TWO_PERIODS') || validations[0] || null;

  return (
    <div className="text-center py-16 text-slate-400">
      <Waves className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-semibold text-slate-600">DFC não gerada</p>
      <p className="text-xs mt-2 max-w-md mx-auto leading-relaxed">
        {isLoading ?
        'Verificando motivo...' :
        dfcValidation?.message ||
        'A DFC indireta exige pelo menos dois períodos comparáveis no mesmo processamento. Os uploads atuais possuem períodos separados, por isso a demonstração ainda não foi gerada para este diagnóstico.'}
      </p>
      <div className="mt-4 max-w-md mx-auto flex items-start gap-2 text-left text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>Para gerar a DFC, importe um balancete comparativo com dois períodos no mesmo upload ou habilite a comparação multi-upload no diagnóstico financeiro.</span>
      </div>
    </div>);

}

// Buckets que aparecem DEPOIS da linha de subtotal correspondente
const AFTER_LINE_BUCKET = {
  'dfc_ajustes_sem_efeito_caixa': 'non_cash_adjustment',
  'dfc_variacao_ativos_operacionais': 'operating_asset',
  'dfc_variacao_passivos_operacionais': 'operating_liability'
};
// Buckets que aparecem ANTES da linha de total (investimento/financiamento não têm subtotal prévio)
const BEFORE_LINE_BUCKET = {
  'dfc_caixa_liquido_atividades_investimento': 'investing',
  'dfc_caixa_liquido_atividades_financiamento': 'financing'
};
const BEFORE_LINE_LABEL = {
  'dfc_caixa_liquido_atividades_investimento': 'Atividades de investimento',
  'dfc_caixa_liquido_atividades_financiamento': 'Atividades de financiamento'
};

const MANUAL_ADJUSTMENT_ACTIVITY = {
  'dfc_caixa_liquido_atividades_operacionais': 'operating',
  'dfc_caixa_liquido_atividades_investimento': 'investing',
  'dfc_caixa_liquido_atividades_financiamento': 'financing'
};

// Converte period raw ("2025", "2025-10") para column_key ("A-2025", "M-2025-10")
// — o parent remapeia DFC lines para column_key, então composition lines precisam do mesmo formato
const periodToColKey = (period) => {
  if (!period) return period;
  if (/^[AMQ]-/.test(period)) return period;
  if (/^\d{4}$/.test(period)) return `A-${period}`;
  if (/^\d{4}-\d{2}$/.test(period)) return `M-${period}`;
  return period;
};

/**
 * @param {Object} props
 * @param {any=} props.rubric
 * @param {any=} props.sortedPeriods
  * @param {any=} props.diagnosisId
 */
function AnalyticalRubricRow({ rubric, sortedPeriods }) {
  const colKey = rubric.column_key || periodToColKey(rubric.period);
  const valuesByPeriod = rubric._valuesByPeriod || { [colKey]: rubric.impact_on_dfc };
  return (
    <div className="flex items-center px-5 py-[2px] hover:bg-slate-50/70">
      <span className={`${COL_LABEL} text-[12px] pl-10 truncate text-slate-600 flex items-center gap-1.5`} title={rubric.rubric_label}>
        {rubric.rubric_label || rubric.rubric_key}
      </span>
      {sortedPeriods.map((p) =>
      <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={valuesByPeriod[p] ?? null} className="text-[12px] text-slate-600" />
        </div>
      )}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.adjustment
 * @param {any=} props.sortedPeriods
  * @param {any=} props.diagnosisId
 */
function ManualAdjustmentRow({ adjustment, sortedPeriods }) {
  const colKey = adjustment.column_key || periodToColKey(adjustment.period);
  const valuesByPeriod = adjustment._valuesByPeriod || { [colKey]: adjustment.value };
  return (
    <div className="flex items-center px-5 py-[2px] hover:bg-slate-50/70">
      <span className={`${COL_LABEL} text-[12px] pl-10 truncate text-slate-600 flex items-center gap-1.5`} title={adjustment.label}>

        {adjustment.label}
      </span>
      {sortedPeriods.map((p) =>
      <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={valuesByPeriod[p] ?? null} className="text-[12px] text-slate-600" />
        </div>
      )}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.sortedPeriods
  * @param {any=} props.diagnosisId
 */
function SectionLabelRow({ label, sortedPeriods }) {
  return (
    <div className="flex items-center px-5 py-[3px] mt-1 bg-slate-200 rounded-md">
      <span className={`${COL_LABEL} text-[12px] font-bold text-slate-700 uppercase tracking-wide pl-4 truncate`}>{label}</span>
      {sortedPeriods.map((p) =>
      <div key={p} className={`${COL_VALUE} shrink-0 pr-2`} />
      )}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.lines
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.diagnosisId
 */
export default function CashFlowStatementView({ lines, periods, periodLabelMap = {}, diagnosisId }) {
  const { tenantId } = useTenant();
  const { data: currentScope, isLoading: isLoadingScope, isError: isCurrentScopeError } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const { data: queriedCompositionLines = [] } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'dfc-composition'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialDfcCompositionLine.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id: currentScope.processing_run_id, publication_status: 'active' }, 'bucket', 5000
    ),
    enabled: !!currentScope?.processing_run_id
  });

  const compositionLines = useMemo(() => queriedCompositionLines.filter((line) =>
    line.processing_run_id === currentScope?.processing_run_id && line.publication_status === 'active'
  ), [queriedCompositionLines, currentScope?.processing_run_id]);

  const { data: manualAdjustments = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'dfc-manual-adjustments'),
    queryFn: () => base44.entities.FinancialDfcManualAdjustment.filter(
      { financial_diagnosis_id: diagnosisId }, 'created_date', 500
    ),
    enabled: !!diagnosisId
  });

  const manualByActivity = useMemo(() => {
    // Group by activity, then merge rows with the same label into a single row
    // so "Reorganização contábil" in period A and period B shows on one line
    const rawByActivity = {};
    for (const a of manualAdjustments) {
      if (!rawByActivity[a.activity]) rawByActivity[a.activity] = {};
      const label = a.label;
      if (!rawByActivity[a.activity][label]) {
        rawByActivity[a.activity][label] = { ...a, _valuesByPeriod: {} };
      }
      const colKey = a.column_key || periodToColKey(a.period);
      rawByActivity[a.activity][label]._valuesByPeriod[colKey] = (rawByActivity[a.activity][label]._valuesByPeriod[colKey] || 0) + (a.value || 0);
    }
    const m = {};
    for (const [activity, byLabel] of Object.entries(rawByActivity)) {
      m[activity] = Object.values(byLabel);
    }
    return m;
  }, [manualAdjustments]);

  const compByBucket = useMemo(() => {
    // Group composition lines by bucket, then merge lines with the same rubric_key
    // across periods into a single row (valuesByPeriod) so each rubric appears once.
    const rawByBucket = {};
    for (const c of compositionLines) {
      if (!rawByBucket[c.bucket]) rawByBucket[c.bucket] = {};
      const key = c.rubric_key;
      if (!rawByBucket[c.bucket][key]) {
        rawByBucket[c.bucket][key] = { ...c, _valuesByPeriod: {} };
      }
      const colKey = c.column_key || periodToColKey(c.period);
      rawByBucket[c.bucket][key]._valuesByPeriod[colKey] = (rawByBucket[c.bucket][key]._valuesByPeriod[colKey] || 0) + (c.impact_on_dfc || 0);
    }
    const m = {};
    for (const [bucket, byKey] of Object.entries(rawByBucket)) {
      m[bucket] = Object.values(byKey);
      m[bucket].sort((a, b2) => {
        const oa = BP_ORDER_MAP[a.canonical_key] ?? 999;
        const ob = BP_ORDER_MAP[b2.canonical_key] ?? 999;
        if (oa !== ob) return oa - ob;
        return Math.abs(b2._valuesByPeriod ? Object.values(b2._valuesByPeriod).reduce((s, v) => s + Math.abs(v), 0) : 0) -
               Math.abs(a._valuesByPeriod ? Object.values(a._valuesByPeriod).reduce((s, v) => s + Math.abs(v), 0) : 0);
      });
    }
    return m;
  }, [compositionLines]);

  if (isLoadingScope) {
    return <div className="py-12 text-center text-sm text-slate-500">Carregando escopo atual da DFC...</div>;
  }

  if (isCurrentScopeError || !currentScope?.processing_run_id) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Composição da DFC indisponível</p>
        <p className="mt-1 text-xs leading-relaxed">Não há um escopo de processamento atual e válido para esta DFC. Migre os dados financeiros ou reprocese o diagnóstico antes de consultar a composição.</p>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return <EmptyDfcState diagnosisId={diagnosisId} />;
  }

  const byKey = {};
  for (const l of lines) {
    const k = l.canonical_key;
    if (!k) continue;
    if (!byKey[k]) {
      byKey[k] = {
        canonical_key: k,
        rubric_label: l.rubric_label || k.replace(/^dfc_/, '').replace(/_/g, ' '),
        display_order: l.display_order ?? DFC_ORDER.indexOf(k),
        valuesByPeriod: {}
      };
    }
    byKey[k].valuesByPeriod[l.column_key || periodToColKey(l.period)] = l.value;
  }

  const orderedLines = Object.values(byKey).sort((a, b) => {
    const oa = a.display_order ?? DFC_ORDER.indexOf(a.canonical_key);
    const ob = b.display_order ?? DFC_ORDER.indexOf(b.canonical_key);
    return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
  });

  const dfcPeriodsFromLines = [...new Set((lines || []).map((l) => l.column_key || periodToColKey(l.period)).filter(Boolean))];
  const periodsToRender = dfcPeriodsFromLines.length > 0 ? dfcPeriodsFromLines : periods || [];
  const sortedPeriods = [...periodsToRender].sort((a, b) => {
    const yearA = parseInt(a.match(/A-(\d{4})$/)?.[1] || '0', 10);
    const yearB = parseInt(b.match(/A-(\d{4})$/)?.[1] || '0', 10);
    if (yearA > 0 && yearB > 0) return yearB - yearA;
    return a.localeCompare(b);
  });

  const renderableLines = orderedLines.filter((l) => l.canonical_key !== 'dfc_diferenca_validacao');

  return (
    <div className="font-sans">
      <div className="border border-slate-200 rounded-xl overflow-hidden w-fit">
        <div className="flex items-center bg-slate-800 px-5 py-1.5">
          <div className={`${COL_LABEL} flex items-center gap-3`}>
            <span className="block text-[11px] font-bold text-white uppercase tracking-widest truncate">descrição de rubricas</span>
          </div>
          {sortedPeriods.map((p) =>
          <div key={p} className={`${COL_VALUE} flex items-center justify-center shrink-0 pr-2`}>
              <span className="text-[11px] font-bold text-white uppercase tracking-widest">{periodLabelMap[p] || fmtPeriod(p)}</span>
            </div>
          )}
        </div>

        {renderableLines.map((line) => {
          const isTotal = DFC_TOTAL_KEYS.has(line.canonical_key);
          const isDarkTotal = DFC_DARK_KEYS.has(line.canonical_key);
          const hideTotal = DFC_HIDE_TOTAL_KEYS.has(line.canonical_key);
          const beforeBucket = BEFORE_LINE_BUCKET[line.canonical_key];
          const beforeRubrics = beforeBucket ? compByBucket[beforeBucket] || [] : [];
          const afterBucket = AFTER_LINE_BUCKET[line.canonical_key];
          const afterRubrics = afterBucket ? compByBucket[afterBucket] || [] : [];
          const manualActivity = MANUAL_ADJUSTMENT_ACTIVITY[line.canonical_key];
          const manualRows = manualActivity ? manualByActivity[manualActivity] || [] : [];
          // Não é somada a nenhuma atividade de caixa (ver financial-statements.
          // service.ts::buildDfc) — destaque em âmbar quando não-zero pra não
          // ficar escondida como uma linha qualquer: precisa de classificação
          // manual (aporte/dividendo com efeito caixa vs. ajuste sem efeito
          // caixa vs. reclassificação interna) antes da versão definitiva.
          const isUnidentifiedPending =
            line.canonical_key === 'dfc_movimentacoes_nao_identificadas' &&
            sortedPeriods.some((p) => Math.abs(line.valuesByPeriod?.[p] ?? 0) >= 0.01);

          const lineBg = isDarkTotal ?
          'bg-slate-800 border-t-2 border-slate-600 mt-2' :
          isTotal ?
          'bg-slate-100 border-t border-slate-300' :
          isUnidentifiedPending ?
          'bg-amber-50 border-t border-amber-200' :
          'hover:bg-slate-50';
          const lineTextClass = isDarkTotal ?
          'font-bold text-white' :
          isTotal ?
          'font-bold text-slate-800' :
          isUnidentifiedPending ?
          'font-semibold text-amber-800' :
          'text-slate-700';

          return (
            <React.Fragment key={line.canonical_key}>
              {beforeRubrics.length > 0 &&
              <SectionLabelRow label={BEFORE_LINE_LABEL[line.canonical_key]} sortedPeriods={sortedPeriods} />
              }
              {beforeRubrics.map((r) =>
              <AnalyticalRubricRow key={r.rubric_key} rubric={r} sortedPeriods={sortedPeriods} />
              )}

              {manualRows.length > 0 && !hideTotal &&
              manualRows.map((a) =>
              <ManualAdjustmentRow key={a.id} adjustment={a} sortedPeriods={sortedPeriods} />
              )
              }

              <div className={`flex items-center px-5 py-1.5 ${lineBg}`}>
                <span className={`${COL_LABEL} text-[13px] pl-4 truncate ${lineTextClass}`}>
                  {line.rubric_label}
                </span>
                {sortedPeriods.map((p) => {
                  if (hideTotal) return <div key={p} className={`${COL_VALUE} shrink-0 pr-2`} />;
                  const value = line.valuesByPeriod?.[p] ?? 0;
                  return (
                    <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
                      <ValueCell value={value !== 0 ? value : null} className={`text-[13px] ${lineTextClass}`} />
                    </div>);

                })}
              </div>

              {afterRubrics.map((r) =>
              <AnalyticalRubricRow key={r.rubric_key} rubric={r} sortedPeriods={sortedPeriods} />
              )}
            </React.Fragment>);

        })}
        {(() => {
          const caixaFinal = byKey['dfc_caixa_final'];
          const caixaInicial = byKey['dfc_caixa_inicial'];
          if (!caixaFinal) return null;
          return (
            <div className="flex items-center px-5 py-1.5 bg-slate-800 border-t-2 border-slate-600">
              <span className={`${COL_LABEL} text-[13px] pl-4 truncate font-bold text-white`}>
                Aumento do saldo de caixa e equivalentes de caixa
              </span>
              {sortedPeriods.map((p) => {
                const finalVal = caixaFinal.valuesByPeriod?.[p] ?? 0;
                const inicialVal = caixaInicial?.valuesByPeriod?.[p] ?? 0;
                const diff = finalVal - inicialVal;
                return (
                  <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
                    <ValueCell value={diff !== 0 ? diff : null} className="text-[13px] font-bold text-white" />
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
      <p className="text-[10px] text-slate-400 mt-2 px-1">Valores arredondados. DFC calculada pelo método indireto a partir do Resultado Líquido, ajustes e variações patrimoniais. As linhas analíticas mostram a variação de cada conta do BP e seu impacto no caixa.</p>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditorOpen(true)}
          className="h-7 text-[11px]">
          
          <Pencil className="w-3 h-3 mr-1" /> Editar classificação DFC
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdjustmentDialogOpen(true)}
          className="h-7 text-[11px] border-amber-300 text-amber-700 hover:bg-amber-50">
          <Plus className="w-3 h-3 mr-1" /> Ajuste Manual
        </Button>
      </div>

      <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
          
          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Ressalvas técnicas
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAlerts ? '' : '-rotate-90'}`} />
        </button>
        {showAlerts &&
        <div className="px-4 py-3 border-t border-slate-200">
            <DfcAlertsBlock diagnosisId={diagnosisId} />
          </div>
        }
      </div>

      <DfcClassificationEditor
        diagnosisId={diagnosisId}
        uploadId={lines[0]?.financial_upload_id || null}
        open={editorOpen}
        onOpenChange={setEditorOpen} />

      <DfcManualAdjustmentDialog
        diagnosisId={diagnosisId}
        uploadId={lines[0]?.financial_upload_id || null}
        periods={sortedPeriods}
        periodLabelMap={periodLabelMap}
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen} />
      

    </div>);

}