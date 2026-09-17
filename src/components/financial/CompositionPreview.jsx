/**
 * CompositionPreview
 * Exibe o resumo da composição pós-processamento: rubricas geradas, contagem de contas,
 * linhas pendentes de classificação e status de fechamento do BP.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

/**
 * @param {Object} props
 * @param {any=} props.uploadId
 * @param {any=} props.diagnosisId
 */
export default function CompositionPreview({ uploadId, diagnosisId }) {
  const [expandUnmapped, setExpandUnmapped] = useState(false);
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId);

  const { data: statements = [], isLoading: loadingStmt } = useQuery({
    queryKey: ['fin-composition-stmts', uploadId, currentScope?.snapshot_id, currentScope?.processing_run_id],
    // Já filtra por financial_upload_id (este upload específico); somar
    // processing_run_id em cima disso quebrava a pré-visualização de
    // QUALQUER upload que não fosse o último processado no diagnóstico
    // inteiro (currentScope aponta só pro build mais recente).
    queryFn: () => base44.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id:diagnosisId, financial_upload_id:uploadId, publication_status:'active' }, 'period', 1000
    ),
    enabled: !!uploadId && !!currentScope?.processing_run_id
  });

  const { data: mappings = [], isLoading: loadingMap } = useQuery({
    queryKey: ['fin-composition-maps', uploadId, currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialMappingResolution.filter(
      { financial_diagnosis_id:diagnosisId, financial_upload_id:uploadId, publication_status:'active' }, 'account_code', 1000
    ),
    enabled: !!uploadId && !!currentScope?.processing_run_id
  });

  if (loadingStmt || loadingMap) return null;
  if (statements.length === 0 && mappings.length === 0) return null;

  // Estatísticas
  const classified = mappings.filter((m) => !m.blocking_issue);
  const unclassified = mappings.filter((m) => m.blocking_issue);

  // Rubricas compostas (line_type = 'composed') do último período
  const periods = [...new Set(statements.map((s) => s.period))].sort();
  const lastPeriod = periods.slice(-1)[0];
  const composedLines = statements.filter((s) => s.period === lastPeriod && s.line_type === 'composed');
  const bpLines = composedLines.filter((s) => s.statement_family === 'balance_sheet');
  const dreLines = composedLines.filter((s) => s.statement_family === 'dre');

  // Verificação de fechamento BP (Total Ativo vs Total Passivo+PL)
  const bpTotals = statements.filter((s) => s.period === lastPeriod && ['total_ativo', 'total_passivo_pl'].includes(s.managerial_rubric));
  const totalAtivo = bpTotals.find((s) => s.managerial_rubric === 'total_ativo')?.value ?? null;
  const totalPassPL = bpTotals.find((s) => s.managerial_rubric === 'total_passivo_pl')?.value ?? null;
  const bpDiff = totalAtivo != null && totalPassPL != null ? Math.abs(totalAtivo - totalPassPL) : null;
  const bpBalanced = bpDiff != null && totalAtivo !== 0 ? bpDiff / Math.abs(totalAtivo) <= 0.001 : null;

  const fmt = (v) => {
    if (v == null) return '—';
    const abs = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(v));
    return v < 0 ? `(${abs})` : abs;
  };

  return (
    <div className="space-y-4 mt-2">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Resumo da composição</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
        { label: 'Contas classificadas', value: classified.length, color: 'text-emerald-700' },
        { label: 'Sem classificação', value: unclassified.length, color: unclassified.length > 0 ? 'text-amber-600' : 'text-emerald-600' },
        { label: 'Rubricas BP geradas', value: bpLines.length, color: 'text-blue-700' },
        { label: 'Rubricas DRE geradas', value: dreLines.length, color: 'text-purple-700' }].
        map((kpi) =>
        <Card key={kpi.label} className="border-0 shadow-sm">
            


          
          </Card>
        )}
      </div>

      {/* Fechamento BP */}
      {bpBalanced != null &&
      <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${bpBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          {bpBalanced ?
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        }
          <div>
            <p className={`font-semibold text-xs ${bpBalanced ? 'text-emerald-800' : 'text-amber-800'}`}>
              {bpBalanced ? 'BP fechado dentro da tolerância' : 'BP com diferença acima da tolerância (0,1%)'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Ativo: {fmt(totalAtivo)} · Passivo+PL: {fmt(totalPassPL)} · Diferença: {fmt(bpDiff)}
            </p>
          </div>
        </div>
      }

      {/* Rubricas compostas (tabela) */}
      {composedLines.length > 0 &&
      <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-2">Rubricas compostas ({lastPeriod})</p>
          






























        
        </div>
      }

      {/* Contas sem classificação */}
      {unclassified.length > 0 &&
      <div>
          <button
          onClick={() => setExpandUnmapped((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 hover:text-amber-900">
          
            {expandUnmapped ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {unclassified.length} conta(s) sem classificação — não entraram nas demonstrações
          </button>
          {expandUnmapped &&
        <div className="mt-2 rounded-xl border border-amber-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white">Código</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {unclassified.slice(0, 50).map((m, i) =>
              <tr key={i} className="bg-white/80">
                      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-600">{m.account_code || '—'}</td>
                      <td className="px-3 py-1.5 text-slate-700">{m.account_description || '—'}</td>
                    </tr>
              )}
                  {unclassified.length > 50 &&
              <tr><td colSpan={2} className="px-3 py-2 text-[10px] text-slate-400 text-center">... e mais {unclassified.length - 50} conta(s)</td></tr>
              }
                </tbody>
              </table>
            </div>
        }
        </div>
      }
    </div>);

}