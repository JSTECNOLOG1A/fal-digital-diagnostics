import React, { useState } from 'react';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { invalidateFinancialQueries } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.diagnosis
 */
export default function PreparationPanel({ diagnosisId, diagnosis }) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [preparing, setPreparing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState(null);

  const { data: scopeEntities = [], isLoading: loadingScope } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'scope-entities'),
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId }, 'id', 100),
    enabled: !!diagnosisId,
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'prep-runs'),
    queryFn: () => base44.entities.FinancialPreparationRun.filter({ financial_diagnosis_id: diagnosisId }, '-run_number', 20),
    enabled: !!diagnosisId,
  });

  const { data: uploads = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'prep-uploads'),
    queryFn: () => base44.entities.FinancialUpload.filter({ financial_diagnosis_id: diagnosisId }, '-created_date', 100),
    enabled: !!diagnosisId,
  });

  const analysisType = diagnosis?.analysis_type || 'individual';
  const isMulti = analysisType !== 'individual';

  const handlePrepare = async () => {
    setPreparing(true);
    setMessage(null);
    try {
      const resp = await base44.functions.invoke('prepareFinancialAnalysisDataset', { diagnosis_id: diagnosisId });
      const data = resp.data || resp;
      setMessage({ type: 'success', text: `Dataset preparado: ${data.prepared_line_count} linhas. Bruto: ${data.gross_total?.toFixed(0)} | Eliminações: ${data.elimination_total?.toFixed(0)} | Final: ${data.final_total?.toFixed(0)}` });
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'prep-runs') });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao preparar: ' + (e.response?.data?.error || e.message) });
    } finally {
      setPreparing(false);
    }
  };

  const handleBuildAll = async () => {
    const preparedRuns = runs.filter((r) => r.status === 'prepared' && !r.superseded_by_run_id);
    if (preparedRuns.length === 0) {
      setMessage({ type: 'error', text: 'Nenhum run preparado. Execute "Preparar Dataset" primeiro.' });
      return;
    }
    setBuilding(true);
    setMessage(null);
    try {
      let totalStmt = 0, totalInd = 0, totalDfc = 0;
      const allPeriods = new Set();
      for (const run of preparedRuns) {
        const resp = await base44.functions.invoke('buildFinancialStatements', { diagnosis_id: diagnosisId, prepared_run_id: run.id });
        const data = resp.data || resp;
        totalStmt += data.statement_lines || 0;
        totalInd += data.indicators || 0;
        totalDfc += data.dfc_lines || 0;
        (data.periods || []).forEach((p) => allPeriods.add(p));
      }
      // Gerar achados e recomendações após processar todas as séries (best-effort)
      try { await base44.functions.invoke('finalizeFinancialInsights', { financial_diagnosis_id: diagnosisId }); } catch (e) { console.warn('[PreparationPanel] finalizeFinancialInsights falhou', e); }
      setMessage({ type: 'success', text: `${preparedRuns.length} série(s) processada(s): ${totalStmt} linhas, ${totalInd} indicadores, ${totalDfc} linhas DFC. Períodos: ${[...allPeriods].sort().join(', ')}` });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'prep-runs') });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao processar: ' + (e.response?.data?.error || e.message) });
    } finally {
      setBuilding(false);
    }
  };

  if (!isMulti) {
    return <div className="p-4 text-sm text-slate-500">Análise individual não requer preparação de dataset multi-entidade.</div>;
  }

  const activeRun = runs.find(r => r.status === 'prepared' && !r.superseded_by_run_id);

  return (
    <div className="space-y-4">
      {/* Entidades do escopo */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Perímetro da Análise ({analysisType})</h3>
        {loadingScope ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="space-y-1">
            {scopeEntities.map(se => (
              <div key={se.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-slate-700">{se.entity_name || se.entity_id}</span>
                  <span className="ml-2 text-xs text-slate-400 capitalize">{se.role?.replace('_', ' ')}</span>
                </div>
                <div className="flex gap-2 text-xs text-slate-400">
                  {se.control_type && se.control_type !== 'none' && <span className="capitalize">{se.control_type}</span>}
                  {se.consolidation_method && se.consolidation_method !== 'not_applicable' && <span className="capitalize">{se.consolidation_method}</span>}
                  {se.direct_ownership_pct != null && <span>{se.direct_ownership_pct}%</span>}
                </div>
              </div>
            ))}
            {scopeEntities.length === 0 && <p className="text-sm text-slate-400">Nenhuma entidade no escopo.</p>}
          </div>
        )}
      </div>

      {/* Uploads por entidade */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Fontes Contábeis Importadas</h3>
        <div className="space-y-1">
          {uploads.map(u => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <div>
                <span className="text-sm font-medium text-slate-700">{u.file_name}</span>
                {u.source_entity_id && <span className="ml-2 text-xs text-slate-400">Entidade: {u.source_entity_id}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${u.upload_status === 'processed' ? 'bg-emerald-50 text-emerald-700' : u.upload_status === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{u.upload_status}</span>
            </div>
          ))}
          {uploads.length === 0 && <p className="text-sm text-slate-400">Nenhum upload importado ainda.</p>}
        </div>
      </div>

      {/* Ações */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handlePrepare} disabled={preparing || building || scopeEntities.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {preparing ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparando...</> : <><Play className="w-4 h-4" /> Preparar Dataset</>}
          </Button>
          {activeRun && (
            <Button onClick={() => handleBuildAll()} disabled={preparing || building} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {building ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : <><RefreshCw className="w-4 h-4" /> Processar Análise ({runs.filter((r) => r.status === 'prepared' && !r.superseded_by_run_id).length} série(s))</>}
            </Button>
          )}
        </div>

        {message && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Runs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Runs de Preparação</h3>
        {loadingRuns ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="space-y-1">
            {runs.map(run => (
              <div key={run.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-slate-700">Run #{run.run_number}</span>
                  <span className="ml-2 text-xs text-slate-400 capitalize">{run.dataset_scope}</span>
                  {run.prepared_line_count != null && <span className="ml-2 text-xs text-slate-400">{run.prepared_line_count} linhas</span>}
                </div>
                <div className="flex items-center gap-2">
                  {run.gross_total != null && <span className="text-xs text-slate-400">Bruto: {run.gross_total?.toFixed(0)}</span>}
                  {run.elimination_total != null && <span className="text-xs text-slate-400">Elim: {run.elimination_total?.toFixed(0)}</span>}
                  {run.final_total != null && <span className="text-xs font-medium text-slate-600">Final: {run.final_total?.toFixed(0)}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    run.status === 'prepared' ? 'bg-emerald-50 text-emerald-700' :
                    run.status === 'superseded' ? 'bg-slate-100 text-slate-400' :
                    run.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>{run.status}</span>
                </div>
              </div>
            ))}
            {runs.length === 0 && <p className="text-sm text-slate-400">Nenhum run executado ainda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}