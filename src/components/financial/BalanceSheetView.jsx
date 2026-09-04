/**
 * BalanceSheetView — Balanço Patrimonial
 * - Linhas com zero em TODOS os períodos são ocultadas automaticamente
 * - Colunas comparativas: primeiro período = "Saldo Inicial", último = "Saldo Final"
 * - Total Ativo e Total Passivo+PL sempre na mesma linha de fechamento (rodapé único)
 */
import React from 'react';
import { BP_GROUPS, BP_RUBRICS } from '@/lib/financialConstants';

// Índice reverso: canonical_key → group key (para fallback quando group_label não bate)
const CANONICAL_TO_GROUP = {};
for (const [groupKey, rubrics] of Object.entries(BP_RUBRICS)) {
  for (const r of rubrics) {
    CANONICAL_TO_GROUP[r.canonical_key] = groupKey;
  }
}

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
  if (q) { const n = Math.ceil(parseInt(q[2], 10) / 3); return `${n}ºtrim/${q[1]}`; }
  // Legado YYYY-MM → MM/YYYY
  const leg = p.match(/^(\d{4})-(\d{2})$/);
  return leg ? `${leg[2]}/${leg[1]}` : p;
};

const fmt = (v) => {
  if (v == null) return '—';
  const abs = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(v));
  return v < 0 ? `(${abs})` : abs;
};

const hasAnyValue = (valuesByPeriod, periods) =>
  periods.some(p => {
    const v = valuesByPeriod?.[p];
    return v != null && v !== 0;
  });

const COL_VALUE = 'w-32 shrink-0';
/**
 * Largura fixa da coluna de texto — antes era flex-1 (preenchia o espaço
 * sobrando e truncava sem aviso quando a janela era estreita: rótulos como
 * "Total do Passivo e Patrimônio Líquido" ou "Caixa Líquido das Atividades
 * de Financiamento" cortavam com "…"). Calibrada medindo o rótulo real mais
 * largo entre BP/DRE/DFC em negrito 13px ("Caixa Líquido das Atividades de
 * Financiamento", ~287px) com folga — mesma régua fixa nas três telas,
 * padrão auditoria (não redistribui conforme o conteúdo da linha).
 */
const COL_LABEL = 'w-80 shrink-0';

/**
 * ValueCell — alinhamento contábil padrão.
 * Os dígitos ficam sempre alinhados à direita (mesma posição horizontal),
 * e os parênteses dos valores negativos "penduram" à esquerda/direita do bloco
 * numérico sem deslocar os dígitos. Para positivos, os parênteses são
 * renderizados invisíveis (opacity-0) reservando exatamente a mesma largura,
 * garantindo alinhamento perfeito entre linhas positivas e negativas.
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
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.subtotalValues
 * @param {any=} props.periods
  * @param {any=} props.isAnnual
 */
function GroupHeaderRow({ label, subtotalValues, periods }) {
  return (
    <div className="flex items-center px-5 py-[3px] mt-1 bg-slate-200 rounded-md">
      <span className={`${COL_LABEL} text-[12px] font-bold text-slate-700 uppercase tracking-wide truncate pr-2`}>{label}</span>
      {periods.map(p => (
        <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={subtotalValues?.[p] ?? null} className="text-[12px] font-bold text-slate-700" />
        </div>
      ))}
    </div>
  );
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
  if (!hasAnyValue(valuesByPeriod, periods)) return null;
  return (
    <div className="flex items-center px-5 py-[3px] hover:bg-slate-50">
      <span className={`${COL_LABEL} text-[13px] text-slate-700 pl-4 leading-snug truncate`}>
        {label}
        {noteRef && <sup className="text-[9px] text-slate-400 ml-0.5">{noteRef}</sup>}
      </span>
      {periods.map(p => (
        <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
          <ValueCell value={valuesByPeriod?.[p] ?? null} className="text-[13px] text-slate-700" />
        </div>
      ))}
    </div>
  );
}



/**
 * @param {Object} props
 * @param {any=} props.sideLabel
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.isAnnual
 */
function ColHeader({ sideLabel, periods, periodLabelMap = {} }) {
  const showComparative = periods.length > 1;
  return (
    <div className="flex items-center bg-slate-800 px-5 py-1.5">
      <span className={`${COL_LABEL} text-[11px] font-bold text-white uppercase tracking-widest truncate`}>{sideLabel}</span>
      {periods.map((p, idx) => {
        const label = periodLabelMap[p] || fmtPeriod(p);
        return (
          <div key={p} className={`${COL_VALUE} flex items-center justify-center shrink-0 pr-2`}>
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any} props.sideLabel
 * @param {any} props.groups
 * @param {any} props.groupedLines
 * @param {any} props.periods
 * @param {any=} props.periodLabelMap
 * @param {any=} props.totalValues
 * @param {any=} props.totalLabel
 * @param {boolean=} props.auditorStyle
 */
function SidePanel({ sideLabel, groups, groupedLines, periods, periodLabelMap = {}, totalValues = null, totalLabel, auditorStyle = false }) {
  const getOrderedLines = (groupKey) => {
    const canonicalRubrics = BP_RUBRICS[groupKey] || [];
    const dataLines = groupedLines[groupKey] || [];
    const dataByKey = Object.fromEntries(dataLines.map(l => [l.canonical_key, l]));
    const canonicalKeys = new Set(canonicalRubrics.map(r => r.canonical_key));
    const ordered = canonicalRubrics
      .filter(r => dataByKey[r.canonical_key])
      .map(r => ({ ...dataByKey[r.canonical_key], rubric_label: dataByKey[r.canonical_key].rubric_label || r.rubric_label, display_order: r.display_order }));
    const extras = dataLines
      .filter(l => !canonicalKeys.has(l.canonical_key))
      .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
    return [...ordered, ...extras];
  };

  // No modo auditoria, cada painel calcula e exibe seu próprio subtotal de lado
  const sideSubtotals = {};
  if (auditorStyle) {
    for (const p of periods) {
      sideSubtotals[p] = groups.reduce((sum, g) => {
        const gLines = (groupedLines[g.key] || []).filter(l => hasAnyValue(l.valuesByPeriod, periods));
        return sum + gLines.reduce((s, l) => s + (l.valuesByPeriod?.[p] ?? 0), 0);
      }, 0);
    }
  }

  return (
    <div className="flex flex-col">
      <ColHeader sideLabel={sideLabel} periods={periods} periodLabelMap={periodLabelMap} />

      {groups.map(groupDef => {
        const lines = getOrderedLines(groupDef.key);
        const visibleLines = lines.filter(l => hasAnyValue(l.valuesByPeriod, periods));
        if (visibleLines.length === 0) return null;
        const subtotals = {};
        for (const p of periods) {
          subtotals[p] = visibleLines.reduce((acc, l) => acc + (l.valuesByPeriod?.[p] ?? 0), 0);
        }
        // Adiciona espaço vazio antes de "Ativo não circulante", "Passivo não circulante" e "Patrimônio líquido"
        const isSpecialGroup = ['Ativo não circulante', 'Passivo não circulante', 'Patrimônio líquido'].includes(groupDef.key);
        return (
          <div key={groupDef.key}>
            {isSpecialGroup && <div className="h-2" />}
            <GroupHeaderRow label={groupDef.label} subtotalValues={subtotals} periods={periods} />
            {visibleLines.map((line, i) => (
              <ComposedRow key={line.canonical_key || i} label={line.rubric_label} noteRef={line.note_reference} valuesByPeriod={line.valuesByPeriod} periods={periods} />
            ))}
          </div>
        );
      })}

      {/* Rodapé de total por lado — estilo auditoria, alinhado dentro de cada painel */}
      {auditorStyle && (
        <div className="mt-auto">
          <div className="h-2" />
          <div className="flex bg-slate-800 border-t-2 border-slate-600">
            <div className="flex-1 flex items-center px-5 py-1.5">
              <span className={`${COL_LABEL} text-[13px] font-bold text-white truncate pr-2`}>{totalLabel || `Total ${sideLabel}`}</span>
              {periods.map(p => (
                <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
                  <ValueCell value={sideSubtotals[p] ?? null} className="text-[13px] font-bold text-white" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!auditorStyle && totalValues ? (
        <>
          <div className="h-2" />
          <div className="flex bg-slate-800 border-t-2 border-slate-600">
          <div className="flex-1 flex items-center px-5 py-2">
            <span className={`${COL_LABEL} text-[13px] font-bold text-white truncate pr-2`}>{totalLabel}</span>
            {periods.map(p => (
              <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
                <ValueCell value={totalValues?.[p] ?? null} className="text-[13px] font-bold text-white" />
              </div>
            ))}
          </div>
          </div>
          </>
          ) : (
          !auditorStyle && <div className="flex-1" />
          )}
    </div>
  );
}

/** Barra de totais unificada — cobre toda a largura, sempre alinhada */
function TotalFooter({ ativoData, passivoData, periods }) {
  return (
    <div className="flex bg-slate-800 border-t-2 border-slate-600">
      {/* Lado Ativo */}
      <div className="flex-1 flex items-center px-5 py-1.5">
        <span className={`${COL_LABEL} text-[13px] font-bold text-white truncate pr-2`}>{ativoData.label}</span>
        {periods.map(p => (
          <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
            <ValueCell value={ativoData.valuesByPeriod?.[p] ?? null} className="text-[13px] font-bold text-white" />
          </div>
        ))}
      </div>
      {/* Divisor */}
      <div className="w-px bg-slate-600" />
      {/* Lado Passivo+PL */}
      <div className="flex-1 flex items-center px-5 py-1.5">
        <span className={`${COL_LABEL} text-[13px] font-bold text-white truncate pr-2`}>{passivoData.label}</span>
        {periods.map(p => (
          <div key={p} className={`${COL_VALUE} flex justify-end shrink-0 pr-2`}>
            <ValueCell value={passivoData.valuesByPeriod?.[p] ?? null} className="text-[13px] font-bold text-white" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.lines
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.isAnnual
 */
export default function BalanceSheetView({ lines, periods, periodLabelMap = {}, isAnnual = true }) {
  const byKey = {};
  for (const l of lines) {
    const k = l.canonical_key || l.managerial_rubric;
    if (!k) continue;
    if (!byKey[k]) {
      byKey[k] = {
        canonical_key: k,
        rubric_label: l.rubric_label || l.group_label || k.replace(/_/g, ' '),
        group_label: l.group_label || l.statement_section || '',
        statement_code: l.statement_code || null,
        line_type: l.line_type || 'composed',
        display_order: l.display_order ?? 0,
        note_reference: l.note_reference || null,
        valuesByPeriod: {},
      };
    }
    byKey[k].valuesByPeriod[l.period] = l.value;
  }

  // Filtrar apenas linhas compostas que pertencem ao BP (via canonical_key ou statement_code)
  const allComposed = Object.values(byKey).filter(l => l.line_type === 'composed');
  const composedLines = allComposed.filter(l => {
    // Se o statement_code estiver presente, usar como filtro definitivo
    const sc = l.statement_code;
    if (sc) return sc === 'BP';
    // Senão, aceitar apenas se o canonical_key consta no BP_RUBRICS (via CANONICAL_TO_GROUP)
    return !!CANONICAL_TO_GROUP[l.canonical_key];
  });

  const groupedLines = {};
  for (const line of composedLines) {
    // 1. Resolve pelo canonical_key → grupo canônico fixo (mais confiável)
    let gk = CANONICAL_TO_GROUP[line.canonical_key];
    // 2. Fallback: bate o group_label salvo no banco (que o backend normaliza) contra os grupos do BP
    if (!gk) {
      const gl = (line.group_label || '').toLowerCase().trim();
      gk = BP_GROUPS.find(g =>
        g.key.toLowerCase() === gl ||
        g.label.toLowerCase() === gl
      )?.key;
    }
    // 3. Fallback final: aceita qualquer grupo cujo label esteja contido no group_label da linha
    if (!gk && line.group_label) {
      const gl = line.group_label.toLowerCase();
      gk = BP_GROUPS.find(g => gl.includes(g.key.toLowerCase()) || gl.includes(g.label.toLowerCase()))?.key;
    }
    // 4. Se não resolveu de jeito nenhum, descarta
    if (!gk) continue;
    if (!groupedLines[gk]) groupedLines[gk] = [];
    groupedLines[gk].push(line);
  }

  const ativoGroups   = BP_GROUPS.filter(g => g.side === 'ativo');
  const passivoGroups = BP_GROUPS.filter(g => g.side === 'passivo');

  const sortedPeriods = [...periods].sort((a, b) => {
    // Anual: A-2025, A-2024, A-2023... (decrescente por ano)
    const yearA = parseInt(a.match(/A-(\d{4})$/)?.[1] || '0', 10);
    const yearB = parseInt(b.match(/A-(\d{4})$/)?.[1] || '0', 10);
    if (yearA > 0 && yearB > 0) return yearB - yearA;
    return a.localeCompare(b);
  });
  const firstPeriod   = sortedPeriods[0];
  const lastPeriod    = sortedPeriods.slice(-1)[0];
  const comparative   = sortedPeriods.length > 1;

  // Totais — usa linha do banco se existir, senão calcula somando grupos
  const calcSideTotal = (sideGroups) => {
    const totals = {};
    for (const p of sortedPeriods) {
      totals[p] = sideGroups.reduce((sum, g) => {
        const gLines = (groupedLines[g.key] || []).filter(l => hasAnyValue(l.valuesByPeriod, sortedPeriods));
        return sum + gLines.reduce((s, l) => s + (l.valuesByPeriod?.[p] ?? 0), 0);
      }, 0);
    }
    return totals;
  };

  const ativoTotalValues   = byKey['total_ativo']?.valuesByPeriod   || calcSideTotal(ativoGroups);
  const passivoTotalValues = byKey['total_passivo_pl']?.valuesByPeriod || calcSideTotal(passivoGroups);

  // Layout não-anual: empilhado
  if (!isAnnual) {
    return (
      <div className="font-sans space-y-3">
        <div className="border border-slate-200 rounded-xl overflow-hidden w-fit">
          <SidePanel sideLabel="ATIVO" groups={ativoGroups} groupedLines={groupedLines}
            periods={sortedPeriods} periodLabelMap={periodLabelMap}
            totalValues={ativoTotalValues} totalLabel="Total do ativo" />
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden w-fit">
          <SidePanel sideLabel="PASSIVO E PATRIMÔNIO LÍQUIDO" groups={passivoGroups} groupedLines={groupedLines}
            periods={sortedPeriods} periodLabelMap={periodLabelMap}
            totalValues={passivoTotalValues} totalLabel="Total passivo e patrimônio líquido" />
        </div>
        <p className="text-[10px] text-slate-400 px-1">Valores arredondados. Linhas sem saldo em nenhum período são ocultadas automaticamente.</p>
      </div>
    );
  }

  // Layout anual = Balanço de Auditoria: largura total, rubricas amplas, colunas comparativas fixas,
  // totais de cada lado alinhados na base do painel (mt-auto) — sem rodapé duplicado.
  return (
    <div className="font-sans">
      <div className="border border-slate-200 rounded-xl overflow-hidden w-fit">
        <div className="flex divide-x divide-slate-300">
          <SidePanel sideLabel="ATIVO" groups={ativoGroups} groupedLines={groupedLines} periods={sortedPeriods} periodLabelMap={periodLabelMap} auditorStyle totalLabel="Total do ativo" />
          <SidePanel sideLabel="PASSIVO E PATRIMÔNIO LÍQUIDO" groups={passivoGroups} groupedLines={groupedLines} periods={sortedPeriods} periodLabelMap={periodLabelMap} auditorStyle totalLabel="Total do passivo e patrimônio líquido" />
        </div>
      </div>
    </div>
  );
}