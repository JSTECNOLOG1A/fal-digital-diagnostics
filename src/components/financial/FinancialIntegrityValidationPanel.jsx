/**
 * FinancialIntegrityValidationPanel — Tela da etapa Validação (F2-JRN-01, 3.2 / UX-08).
 *
 * Mostra: bloqueantes, avisos, duplicidades, órfãos, completude entidade × período,
 * runs ativos, outputs de runs superseded, ação corretiva, botão "Revalidar integridade".
 *
 * Props:
 *   diagnosisId  — ID do diagnóstico
 *   integrity   — objeto integrity da jornada
 *   onResolved   — callback após revalidação (invalida queries)
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw,
  Copy, GitBranch, FileWarning, Activity,
} from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.integrity
 * @param {any=} props.onResolved
 */
export default function FinancialIntegrityValidationPanel({ diagnosisId, integrity, onResolved }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateError, setRevalidateError] = useState(null);

  // Buscar integridade completa via checkFinancialDiagnosisIntegrity
  const { data: integrityData, isLoading, refetch } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'integrity-full'),
    queryFn: async () => {
      const result = await base44.functions.invoke('checkFinancialDiagnosisIntegrity', {
        financial_diagnosis_id: diagnosisId,
      });
      return result?.data || result;
    },
    enabled: !!diagnosisId,
  });

  // Buscar runs ativos
  const { data: runs = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'processing-runs'),
    queryFn: () => base44.entities.FinancialProcessingRun.filter(
      { financial_diagnosis_id: diagnosisId }, '-started_at', 50
    ),
    enabled: !!diagnosisId,
  });

  const handleRevalidate = async () => {
    setRevalidating(true);
    setRevalidateError(null);
    try {
      await refetch();
      if (onResolved) {
        await onResolved();
      }
    } catch (e) {
      setRevalidateError(e.message || 'Erro ao revalidar integridade');
    } finally {
      setRevalidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-400" />
        <p className="text-sm font-medium text-slate-600">Verificando integridade...</p>
      </div>
    );
  }

  const blocking = integrityData?.blocking_issues || integrity?.blocking_issues || [];
  const warnings = integrityData?.warnings || integrity?.warnings || [];
  const counts = integrityData?.counts || {};
  const orphans = integrityData?.orphans_no_upload_id || {};
  const linkedMissing = integrityData?.linked_to_missing_upload || {};
  const multiEntity = integrityData?.multi_entity || {};
  const fontesDetail = integrity?.fontes_detail || {};

  const activeRuns = runs.filter((r) => r.status === 'running');
  const supersededRuns = runs.filter((r) => r.status === 'succeeded' || r.status === 'partial_failed');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            blocking.length > 0 ? 'bg-red-100' : warnings.length > 0 ? 'bg-amber-100' : 'bg-emerald-100'
          }`}>
            {blocking.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Validação de Integridade</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {blocking.length > 0 ? `${blocking.length} bloqueante(s)` : warnings.length > 0 ? `${warnings.length} aviso(s)` : 'Íntegro'}
              {integrity?.fresh === false && ' · desatualizado'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRevalidate}
          disabled={revalidating}
          className="gap-1.5"
        >
          {revalidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {revalidating ? 'Revalidando...' : 'Revalidar integridade'}
        </Button>
      </div>

      {revalidateError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {revalidateError}
        </div>
      )}

      {/* Bloqueantes */}
      {blocking.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
              Bloqueantes
            </span>
            <span className="text-xs text-slate-400">({blocking.length})</span>
          </div>
          <div className="space-y-2">
            {blocking.map((issue, i) => (
              <div key={i} className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avisos */}
      {warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700">
              Avisos
            </span>
            <span className="text-xs text-slate-400">({warnings.length})</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {warnings.map((w, i) => (
              <div key={i} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completude entidade × período */}
      {fontesDetail && fontesDetail.expected_pairs !== undefined && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              Completude entidade × período
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-400">Recebidos esperados</p>
              <p className="text-sm font-bold text-slate-700">{fontesDetail.received_expected_pairs || 0} / {fontesDetail.expected_pairs || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-amber-600">Pendentes</p>
              <p className="text-sm font-bold text-amber-700">{fontesDetail.missing_pairs?.length || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-600">Fora do escopo</p>
              <p className="text-sm font-bold text-red-700">{fontesDetail.unexpected_pairs?.length || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-purple-600">Duplicidades</p>
              <p className="text-sm font-bold text-purple-700">{fontesDetail.duplicate_uploads || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Órfãos */}
      {(orphans.statement_lines > 0 || orphans.indicator_snapshots > 0 || orphans.trial_balance_lines > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileWarning className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 text-orange-700">
              Órfãos (sem upload_id)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {orphans.statement_lines > 0 && (
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-orange-600">Statement Lines</p>
                <p className="text-sm font-bold text-orange-700">{orphans.statement_lines}</p>
              </div>
            )}
            {orphans.indicator_snapshots > 0 && (
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-orange-600">Indicator Snapshots</p>
                <p className="text-sm font-bold text-orange-700">{orphans.indicator_snapshots}</p>
              </div>
            )}
            {orphans.trial_balance_lines > 0 && (
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-orange-600">Trial Balance Lines</p>
                <p className="text-sm font-bold text-orange-700">{orphans.trial_balance_lines}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Runs ativos */}
      {activeRuns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              Runs ativos
            </span>
            <span className="text-xs text-slate-400">({activeRuns.length})</span>
          </div>
          <div className="space-y-1.5">
            {activeRuns.map((r) => (
              <div key={r.id} className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-800">{r.operation_type}</span>
                  <span className="text-blue-600">{r.status}</span>
                </div>
                <p className="text-blue-500 mt-0.5 font-mono text-[10px] truncate">{r.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs de runs superseded */}
      {multiEntity.source_issues?.superseded_outputs > 0 && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <Copy className="w-3.5 h-3.5" />
            <span className="font-semibold">Outputs de runs superseded ainda ativos</span>
          </div>
          <p>{multiEntity.source_issues.superseded_outputs} StatementLine(s) vinculada(s) a run superseded — reprocesse para limpar.</p>
        </div>
      )}

      {/* Resumo de contagens */}
      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumo de dados</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
          <div className="text-center">
            <p className="text-slate-400">Uploads</p>
            <p className="text-sm font-bold text-slate-700">{counts.uploads || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Stmt Lines</p>
            <p className="text-sm font-bold text-slate-700">{counts.statement_lines || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Indicators</p>
            <p className="text-sm font-bold text-slate-700">{counts.indicator_snapshots || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Validações</p>
            <p className="text-sm font-bold text-slate-700">{counts.validation_results || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Prep Runs</p>
            <p className="text-sm font-bold text-slate-700">{counts.preparation_runs || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Findings</p>
            <p className="text-sm font-bold text-slate-700">{counts.findings || 0}</p>
          </div>
        </div>
      </div>

      {/* Ação corretiva */}
      {blocking.length > 0 && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800 mb-1">Ação corretiva necessária</p>
          <p className="text-xs text-red-700">
            Resolva os itens bloqueantes antes de prosseguir para a etapa de Análise.
            Use "Revalidar integridade" após corrigir as inconsistências.
          </p>
        </div>
      )}
    </div>
  );
}