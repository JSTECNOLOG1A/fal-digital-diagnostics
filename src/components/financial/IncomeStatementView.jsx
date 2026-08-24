/**
 * IncomeStatementView — DRE Gerencial
 * - Linhas com zero em TODOS os períodos são ocultadas automaticamente
 * - Colunas comparativas: primeiro período rotulado "Saldo Inicial", último "Saldo Final"
 */
import React from 'react';
import { DRE_GROUPS, DRE_RUBRICS, DRE_CALCULATED_AFTER_GROUP, DRE_FORMULAS } from '@/lib/financialConstants';

const fmtPeriod = (p) => {
  if (!p) return p;
  // Mensal: M-YYYY-MM → MM/YYYY
  const m = p.match(/^M-(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  // Anual: A-YYYY → YYYY
  const a = p.match(/^A-(\d{4})$/);
  if (a) return a[1];
  // Trimestral: Q-YYYY-MM → Nºtrim/YYYY
  const q = p.match(/^Q-(\d{4})-(\d{2})$/);
  if (q) {const n = Math.ceil(parseInt(q[2], 10) / 3);return `${n}ºtrim/${q[1]}`;}
  // Legado YYYY-MM → MM/YYYY
  const leg = p.match(/^(\d{4})-(\d{2})$/);
  return leg ? `${leg[2]}/${leg[1]}` : p;
};

const fmt = (v) => {
  if (v == null) return '—';
  const abs = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(v));
  return v < 0 ? `(${abs})` : abs;
};

// Retorna true se a linha tem valor não-zero em ao menos um período
const hasAnyValue = (valuesByPeriod, periods) =>
periods.some((p) => {
  const v = valuesByPeriod?.[p];
  return v != null && v !== 0;
});

const COL_VALUE = 'w-32 shrink-0';

/**
 * ValueCell — alinhamento contábil padrão (mesmo do BalanceSheetView).
 * Dígitos sempre alinhados à direita; parênteses dos negativos "pendurados"
 * em slot de largura fixa, garantindo alinhamento perfeito entre linhas.
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

/**
 * @param {Object} props
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.isAnnual
 */
function PeriodColHeader({ periods, periodLabelMap = {} }) {
  const showComparative = periods.length > 1;
  return (
    <div className="flex items-center bg-slate-700 px-5 py-1.5">
      <span className="flex-1 min-w-0 text-[11px] font-bold text-white uppercase tracking-widest">descrição de rubricas</span>
      {periods.map((p, idx) => {
        const label = periodLabelMap[p] || fmtPeriod(p);
        return (
          <div key={p} className={`${COL_VALUE} flex justify-center shrink-0 pr-2`}>
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">{label}</span>
          </div>);

      })}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.subtotalValues
 * @param {any=} props.periods
  * @param {any=} props.isAnnual
 */
function GroupHeaderRow({ label, subtotalValues, periods }) {
  const subtotal = subtotalValues && Object.values(subtotalValues).some((v) => v != null && v !== 0);
  return (
    <div className="flex items-center px-5 py-[3px] mt-1 bg-slate-200 rounded-md">
      <span className="flex-1 text-[12px] font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      {subtotal && periods.map((p) =>
      <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={subtotalValues?.[p] ?? null} className="text-[12px] font-bold text-slate-700" />
        </div>
      )}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.noteRef
 * @param {any=} props.valuesByPeriod
 * @param {any=} props.periods
  * @param {any=} props.isAnnual
 */
function ComposedRow({ label, noteRef, valuesByPeriod, periods }) {
  // Ocultar se zero em todos os períodos
  if (!hasAnyValue(valuesByPeriod, periods)) return null;
  return (
    <div className="flex items-center px-5 py-[3px] hover:bg-slate-50">
      <span className="flex-1 text-[13px] text-slate-700 pl-5 truncate">
        {label}
        {noteRef && <sup className="text-[9px] text-slate-400 ml-0.5">{noteRef}</sup>}
      </span>
      {periods.map((p) =>
      <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={valuesByPeriod?.[p] ?? null} className="text-[13px] text-slate-700" />
        </div>
      )}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.valuesByPeriod
 * @param {any=} props.periods
 * @param {any=} props.isSubtotal
  * @param {any=} props.isAnnual
 */
function CalculatedRow({ label, valuesByPeriod, periods, isSubtotal = false }) {
  return (
    <div className={`flex items-center px-5 py-1.5 border-t mt-0.5 ${isSubtotal ? 'border-slate-200 bg-slate-50' : 'border-slate-300 bg-slate-100'}`}>
      <span className={`flex-1 text-[13px] font-semibold ${isSubtotal ? 'text-slate-700' : 'text-slate-800'}`}>{isSubtotal ? '' : label}</span>
      {periods.map((p) => {
        const v = valuesByPeriod?.[p] ?? null;
        return (
          <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
            <ValueCell value={v} className="text-[13px] font-semibold text-slate-800" />
          </div>);

      })}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.valuesByPeriod
 * @param {any=} props.periods
  * @param {any=} props.isAnnual
 */
function TotalRow({ label, valuesByPeriod, periods }) {
  return (
    <div className="flex items-center px-5 py-1.5 bg-slate-800 border-t-2 border-slate-600 mt-2">
      <span className="flex-1 text-[13px] font-bold text-white">{label}</span>
      {periods.map((p) => {
        const v = valuesByPeriod?.[p] ?? null;
        return (
          <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
            <ValueCell value={v} className="text-[13px] font-bold text-white" />
          </div>);

      })}
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.lines
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.isAnnual
 */
export default function IncomeStatementView({ lines, periods, periodLabelMap = {}, isAnnual = true }) {
  // Indexar linhas por canonical_key
  const byKey = {};
  for (const l of lines) {
    const k = l.canonical_key || l.managerial_rubric;
    if (!k) continue;
    if (!byKey[k]) {
      byKey[k] = {
        canonical_key: k,
        rubric_label: l.rubric_label || l.group_label || k.replace(/_/g, ' '),
        group_label: l.group_label || l.statement_section || '',
        line_type: l.line_type || 'composed',
        display_order: l.display_order ?? 0,
        note_reference: l.note_reference || null,
        valuesByPeriod: {}
      };
    }
    byKey[k].valuesByPeriod[l.period] = l.value;
  }

  // Separar compostas e calculadas
  const composedLines = Object.values(byKey).filter((l) => l.line_type === 'composed');
  const calculatedByKey = {};
  for (const l of Object.values(byKey).filter((l) => l.line_type === 'calculated' || l.line_type === 'total')) {
    calculatedByKey[l.canonical_key] = l;
  }
  // Fallback: fórmulas do constants se o backend não gerou
  for (const f of DRE_FORMULAS) {
    if (!calculatedByKey[f.canonical_key]) {
      calculatedByKey[f.canonical_key] = { ...f, valuesByPeriod: {} };
    }
  }

  // Ajusta label do resultado líquido conforme tipo de período
  const labelResultado = isAnnual ? 'Resultado Líquido do Exercício' : 'Resultado Líquido do Período';
  if (calculatedByKey['resultado_liquido']) {
    calculatedByKey['resultado_liquido'] = { ...calculatedByKey['resultado_liquido'], rubric_label: labelResultado };
  }

  // Agrupar linhas compostas por grupo
  const dreRubricsByGroup = {};
  for (const r of DRE_RUBRICS) {
    if (!dreRubricsByGroup[r.group]) dreRubricsByGroup[r.group] = [];
    dreRubricsByGroup[r.group].push(r);
  }

  // Mapa canonical_key → grupo da DRE (para fallback confiável)
  const DRE_CANONICAL_TO_GROUP = {};
  for (const r of DRE_RUBRICS) {
    DRE_CANONICAL_TO_GROUP[r.canonical_key] = r.group;
  }

  const groupedLines = {};
  for (const line of composedLines) {
    // 1. Resolve via canonical_key (mais confiável)
    let gk = DRE_CANONICAL_TO_GROUP[line.canonical_key];
    // 2. Fallback: bate o group_label salvo no banco contra os grupos da DRE
    if (!gk) {
      const gl = (line.group_label || '').toLowerCase().trim();
      gk = DRE_GROUPS.find((g) =>
      g.key.toLowerCase() === gl ||
      g.label.toLowerCase() === gl
      )?.key;
    }
    // 3. Fallback final: contém
    if (!gk && line.group_label) {
      const gl = line.group_label.toLowerCase();
      gk = DRE_GROUPS.find((g) => gl.includes(g.key.toLowerCase()) || gl.includes(g.label.toLowerCase()))?.key;
    }
    // 4. Se não resolveu, descarta
    if (!gk) continue;
    if (!groupedLines[gk]) groupedLines[gk] = [];
    groupedLines[gk].push(line);
  }

  const getOrderedGroupLines = (groupKey) => {
    const canonical = dreRubricsByGroup[groupKey] || [];
    const dataLines = groupedLines[groupKey] || [];
    const dataByKey = Object.fromEntries(dataLines.map((l) => [l.canonical_key, l]));
    const canonicalKeys = new Set(canonical.map((r) => r.canonical_key));

    const ordered = canonical.
    filter((r) => dataByKey[r.canonical_key])
    // Preserva o rubric_label que veio do banco (digitado pelo usuário); usa o canônico só se estiver vazio
    .map((r) => ({ ...dataByKey[r.canonical_key], rubric_label: dataByKey[r.canonical_key].rubric_label || r.rubric_label, display_order: r.display_order }));

    const extras = dataLines.
    filter((l) => !canonicalKeys.has(l.canonical_key)).
    sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

    return [...ordered, ...extras];
  };

  const sortedPeriods = [...periods].sort((a, b) => {
    // Anual: A-2025, A-2024, A-2023... (decrescente por ano)
    const yearA = parseInt(a.match(/A-(\d{4})$/)?.[1] || '0', 10);
    const yearB = parseInt(b.match(/A-(\d{4})$/)?.[1] || '0', 10);
    if (yearA > 0 && yearB > 0) return yearB - yearA;
    return a.localeCompare(b);
  });

  // Grupos a renderizar — apenas os que têm dados
  const allGroups = DRE_GROUPS.filter((g) => groupedLines[g.key]?.length > 0 || DRE_CALCULATED_AFTER_GROUP[g.key]);

  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods.slice(-1)[0];
  const comparative = sortedPeriods.length > 1;

  const maxW = sortedPeriods.length === 1 ? 'max-w-2xl' : sortedPeriods.length === 2 ? 'max-w-3xl' : '';

  return (
    <div className="font-sans">
      <div className={`border border-slate-200 rounded-xl overflow-hidden ${maxW}`}>
        <PeriodColHeader periods={sortedPeriods} periodLabelMap={periodLabelMap} />

        {allGroups.map((groupDef) => {
          const groupLines = getOrderedGroupLines(groupDef.key);
          const visibleLines = groupLines.filter((l) => hasAnyValue(l.valuesByPeriod, sortedPeriods));
          const calcKeys = DRE_CALCULATED_AFTER_GROUP[groupDef.key] || [];
          const subtotals = {};
          for (const p of sortedPeriods) {
            subtotals[p] = visibleLines.reduce((acc, l) => acc + (l.valuesByPeriod?.[p] ?? 0), 0);
          }

          return (
            <div key={groupDef.key}>
              {visibleLines.length > 0 && <GroupHeaderRow label={groupDef.label} subtotalValues={subtotals} periods={sortedPeriods} />}
              {visibleLines.map((line, i) =>
              <ComposedRow
                key={line.canonical_key || i}
                label={line.rubric_label}
                noteRef={line.note_reference}
                valuesByPeriod={line.valuesByPeriod}
                periods={sortedPeriods} />

              )}

              {calcKeys.map((calcKey, idx) => {
                const calcLine = calculatedByKey[calcKey];
                if (!calcLine) return null;
                const isTotal = calcLine.line_type === 'total';
                if (isTotal) {
                  return <TotalRow key={calcKey} label={calcLine.rubric_label} valuesByPeriod={calcLine.valuesByPeriod} periods={sortedPeriods} />;
                }
                const isSecondary = idx > 0;
                if (!isSecondary) return null; // Pula o subtotal (já está no GroupHeaderRow acima)
                return (
                  <CalculatedRow
                    key={calcKey}
                    label={calcLine.rubric_label}
                    valuesByPeriod={calcLine.valuesByPeriod}
                    periods={sortedPeriods}
                    isSubtotal={false} />);


              })}
            </div>);

        })}
      </div>
    </div>);

}