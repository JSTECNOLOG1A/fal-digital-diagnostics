import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, Calculator } from 'lucide-react';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

// Coeficientes oficiais do Fator de Insolvência de Kanitz
// FI = 0,05·RPL + 1,65·LG + 3,55·LS − 1,06·LC − 0,33·PCT
const KANITZ_COMPONENTS = [
  { code: 'rentabilidade_patrimonio_liquido', symbol: 'RPL', name: 'Rentabilidade do PL', coef: 0.05, sign: '+', formula: 'Lucro Líquido ÷ Patrimônio Líquido' },
  { code: 'liquidez_geral',                   symbol: 'LG',  name: 'Liquidez Geral',      coef: 1.65, sign: '+', formula: '(Ativo Circ. + Realizável LP) ÷ Passivo Exigível' },
  { code: 'liquidez_seca',                    symbol: 'LS',  name: 'Liquidez Seca',      coef: 3.55, sign: '+', formula: '(Ativo Circ. − Estoques) ÷ Passivo Circulante' },
  { code: 'liquidez_corrente',                symbol: 'LC',  name: 'Liquidez Corrente',  coef: 1.06, sign: '−', formula: 'Ativo Circulante ÷ Passivo Circulante' },
  { code: 'participacao_capital_terceiros',   symbol: 'PCT', name: 'Part. Capital de Terceiros', coef: 0.33, sign: '−', formula: 'Passivo Exigível ÷ Patrimônio Líquido' },
];

const fmtColLabel = (ck) => {
  if (!ck) return '—';
  const a = ck.match(/^A-(\d{4})$/);
  if (a) return a[1];
  const m = ck.match(/^M-(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : ck;
};

function fmtNum(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n > 0 ? `+${n.toFixed(4)}` : n.toFixed(4);
}

// Replica das funções de agregação do backend (buildFinancialStatements)
// para recompute consistente a partir das FinancialStatementLine.
function calcAtivoCirculante(d) {
  return (d.ativo_circulante_caixa ?? 0)
       + (d.ativo_circulante_receber ?? 0)
       + (d.ativo_circulante_estoques ?? 0)
       + (d.ativo_circulante_impostos ?? 0)
       + (d.ativo_circulante_biologicos ?? 0)
       + (d.ativo_biologico ?? 0)
       + (d.ativo_circulante_outros ?? 0);
}
function calcPassivoCirculante(d) {
  return (d.passivo_circulante_fornecedores ?? 0)
       + (d.passivo_circulante_emprestimos ?? 0)
       + (d.passivo_circulante_impostos ?? 0)
       + (d.passivo_circulante_salarios ?? 0)
       + (d.passivo_circulante_imoveis ?? 0)
       + (d.passivo_circulante_arrendamentos ?? 0)
       + (d.passivo_circulante_adiantamentos ?? 0)
       + (d.passivo_circulante_outros ?? 0);
}
function calcAtivoPLP(d) {
  return (d.ativo_nc_aplicacoes ?? 0)
       + (d.ativo_nc_receber_lp ?? 0)
       + (d.ativo_nc_impostos_lp ?? 0)
       + (d.ativo_nc_impostos_diferidos ?? 0)
       + (d.ativo_nc_outros_creditos ?? 0);
}
function calcPassivoExigivel(d) {
  return calcPassivoCirculante(d)
       + (d.passivo_nao_circulante ?? 0)
       + (d.passivo_nc_imoveis_lp ?? 0)
       + (d.passivo_nc_arrendamentos_lp ?? 0);
}
function calcPatrimonioLiquido(d) {
  return (d.patrimonio_capital ?? 0)
       + (d.patrimonio_reservas ?? 0)
       + (d.patrimonio_reservas_fiscais ?? 0)
       + (d.patrimonio_liquido ?? 0)
       + (d.patrimonio_prejuizos ?? 0);
}
const safeDiv = (n, den) =>
  (den == null || Math.abs(den) < 1e-6) ? null : n / den;

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.selectedIndicators
 */
export default function KanitzFormulaBreakdown({ diagnosisId, selectedIndicators }) {
  const [open, setOpen] = useState(false);
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId);

  const periods = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.period).filter(Boolean))],
    [selectedIndicators]
  );
  const entityCodes = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.entity_code).filter(Boolean))],
    [selectedIndicators]
  );
  // Cada exercício pode estar em um upload distinto. O snapshot de Kanitz
  // carrega o financial_upload_id da versão válida daquele exercício — usamos
  // esses IDs para buscar as linhas, sem misturar uploads dentro do mesmo ano.
  const uploadIds = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.financial_upload_id).filter(Boolean))],
    [selectedIndicators]
  );
  // Series identity para datasets preparados (upload_id nulo)
  const prepRunIds = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.preparation_run_id).filter(Boolean))],
    [selectedIndicators]
  );
  const datasetScopes = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.dataset_scope).filter(Boolean))],
    [selectedIndicators]
  );
  const reportingEntityIds = useMemo(
    () => [...new Set((selectedIndicators || []).map(i => i.reporting_entity_id).filter(Boolean))],
    [selectedIndicators]
  );
  const useUploadPath = uploadIds.length > 0;

  const { data: lines = [] } = useQuery({
    queryKey: ['fin-statement-lines-kanitz', diagnosisId, currentScope?.snapshot_id, currentScope?.processing_run_id, useUploadPath ? uploadIds.join(',') : `${prepRunIds.join(',')}|${datasetScopes.join(',')}|${reportingEntityIds.join(',')}`, periods.join(','), entityCodes.join(',')],
    queryFn: () => base44.entities.FinancialStatementLine.filter(
      useUploadPath
        ? { financial_diagnosis_id: diagnosisId, publication_status: 'active', financial_upload_id: { $in: uploadIds }, period: { $in: periods }, entity_code: { $in: entityCodes }, statement_code: { $in: ['BP', 'DRE'] } }
        : { financial_diagnosis_id: diagnosisId, publication_status: 'active', preparation_run_id: { $in: prepRunIds }, dataset_scope: { $in: datasetScopes }, reporting_entity_id: { $in: reportingEntityIds }, period: { $in: periods }, statement_code: { $in: ['BP', 'DRE'] } },
      '-period', 2000
    ),
    enabled: open && periods.length > 0 && (useUploadPath ? (entityCodes.length > 0 && uploadIds.length > 0) : (prepRunIds.length > 0 && datasetScopes.length > 0)),
  });

  if (!selectedIndicators || selectedIndicators.length === 0) return null;

  // Agrega linhas por (upload_id || entity_code || period) → canonical_key → soma.
  // A chave inclui o upload_id para evitar misturar linhas de exercícios/upload
  // diferentes que compartilhem o mesmo period (ex.: anual 2024 vs 2025).
  const aggKey = (l) => useUploadPath
    ? `${l.financial_upload_id}||${l.entity_code}||${l.period}`
    : `${l.dataset_scope}||${l.reporting_entity_id}||${l.period}`;
  const indAggKey = (ind) => useUploadPath
    ? `${ind.financial_upload_id}||${ind.entity_code}||${ind.period}`
    : `${ind.dataset_scope}||${ind.reporting_entity_id}||${ind.period}`;
  const agg = {};
  for (const l of lines) {
    const k = aggKey(l);
    if (!agg[k]) agg[k] = {};
    agg[k][l.canonical_key] = (agg[k][l.canonical_key] || 0) + (Number(l.value) || 0);
  }

  // Recomputa os 5 componentes + FI a partir das linhas do balanço/DRE
  // da versão válida daquele exercício (fonte de verdade), garantindo
  // consistência com o FI exibido no topo.
  const computeComps = (ind) => {
    const d = agg[indAggKey(ind)] || {};
    const pl = calcPatrimonioLiquido(d);
    const ac = calcAtivoCirculante(d);
    const pc = calcPassivoCirculante(d);
    const rlp = calcAtivoPLP(d);
    const pe = calcPassivoExigivel(d);
    const estoques = d.ativo_circulante_estoques ?? 0;
    const ll = d.resultado_liquido ?? 0;

    const rpl = safeDiv(ll, pl);
    const lg  = safeDiv(ac + rlp, pe);
    const ls  = safeDiv(ac - estoques, pc);
    const lc  = safeDiv(ac, pc);
    const pct = safeDiv(pe, pl);

    const fiRecalc =
      rpl != null && lg != null && ls != null && lc != null && pct != null
        ? 0.05 * rpl + 1.65 * lg + 3.55 * ls - 1.06 * lc - 0.33 * pct
        : null;

    return {
      comps: {
        rentabilidade_patrimonio_liquido: rpl,
        liquidez_geral: lg,
        liquidez_seca: ls,
        liquidez_corrente: lc,
        participacao_capital_terceiros: pct,
      },
      fiRecalc,
    };
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Calculator className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-700">
            Fórmula e composição do Fator de Kanitz
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Fórmula geral */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Fórmula do Fator de Insolvência
            </p>
            <p className="text-sm font-mono text-slate-700 leading-relaxed">
              FI = <span className="text-emerald-600 font-semibold">0,05</span>·RPL
              {' + '}<span className="text-emerald-600 font-semibold">1,65</span>·LG
              {' + '}<span className="text-emerald-600 font-semibold">3,55</span>·LS
              {' − '}<span className="text-rose-600 font-semibold">1,06</span>·LC
              {' − '}<span className="text-rose-600 font-semibold">0,33</span>·PCT
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Componentes recomputados a partir das linhas do balanço e da DRE do mesmo período e entidade.
            </p>
          </div>

          {/* Tabela por período selecionado */}
          {selectedIndicators.map(ind => {
            const { comps, fiRecalc } = computeComps(ind);
            const label = fmtColLabel(ind.column_key || ind.period);
            const fiValue = ind.value;
            const recalcValid = fiRecalc != null;

            return (
              <div key={`${ind.financial_upload_id}||${ind.entity_code}||${ind.column_key || ind.period}`} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5">
                  <span className="text-sm font-bold text-white">{label}</span>
                  <span className="text-sm font-mono font-bold text-emerald-300">
                    FI = {fiValue != null ? fiValue.toFixed(4) : '—'}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <th className="text-left font-semibold px-3 py-2">Componente</th>
                      <th className="text-center font-semibold px-2 py-2">Coef.</th>
                      <th className="text-right font-semibold px-3 py-2">Valor</th>
                      <th className="text-right font-semibold px-3 py-2">Contribuição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KANITZ_COMPONENTS.map(c => {
                      const v = comps[c.code];
                      const contrib = v != null ? (c.sign === '+' ? c.coef * v : -c.coef * v) : null;
                      return (
                        <tr key={c.code} className="border-b border-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-700">
                              {c.symbol} <span className="text-slate-400 font-normal">· {c.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{c.formula}</div>
                          </td>
                          <td className="text-center px-2 py-2 font-mono text-slate-500">
                            {c.sign}{c.coef.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="text-right px-3 py-2 font-mono text-slate-700">
                            {fmtNum(v)}
                          </td>
                          <td className="text-right px-3 py-2 font-mono font-semibold text-slate-800">
                            {contrib != null ? fmtNum(contrib) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {recalcValid && (
                    <tfoot>
                      <tr className="bg-emerald-50 border-t-2 border-emerald-100">
                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-slate-600 text-right">
                          FI calculado (conferência):
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                          {fiRecalc.toFixed(4)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {fiValue != null && recalcValid && Math.abs(fiRecalc - fiValue) > 0.01 && (
                  <div className="px-3 py-1.5 text-[10px] text-amber-700 bg-amber-50 border-t border-amber-100">
                    Diferença entre fator armazenado e recálculo das linhas — pode indicar reprocessamento pendente ou arredondamento.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}