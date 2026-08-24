/**
 * FinancialDiagnosisDetail
 * Cockpit do Diagnóstico Financeiro Inteligente.
 * URL: /FinancialDiagnosisDetail?id=xxx
 * Updated: standardized toast system + DFC classification editor integration.
 */

/**
 * @typedef {Object} FinancialJourneyState
 * @property {boolean} can_open_analysis
 * @property {string} current_step
 * @property {string} [last_valid_step]
 * @property {string} [analysis_type]
 * @property {string} [diagnosis_status]
 * @property {Object} [integrity]
 * @property {Array<Object>} [steps]
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invalidateFinancialQueries, financialKey, tenantKey } from '@/lib/query-client';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, FileSpreadsheet,
  TrendingUp, Lock, AlertCircle, AlertTriangle, Loader2, RefreshCw, Trash2, RotateCcw } from
'lucide-react';
import FinancialMultiEntityPanel from '@/components/financial/FinancialMultiEntityPanel';
import PreparationPanel from '@/components/financial/PreparationPanel';
import ConsolidationEntryManager from '@/components/financial/ConsolidationEntryManager';
import IntercompanyReconciliationPanel from '@/components/financial/IntercompanyReconciliationPanel';
import DiagnosisPipelineHeader from '@/components/financial/DiagnosisPipelineHeader';
import { useDiagnosisJourney } from '@/lib/hooks/useDiagnosisJourney';
import SourceMatrixPanel from '@/components/financial/SourceMatrixPanel';
import ArchiveDeleteControls from '@/components/shared/ArchiveDeleteControls';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  DIAGNOSIS_STATUS_CONFIG, diagnosisStatusReached,
  VALIDATION_SEVERITY_CONFIG, UPLOAD_STATUS_CONFIG, MESSAGES, ANALYSIS_TYPE_CONFIG
} from '@/lib/financialConstants';
import CompositionPreview from '@/components/financial/CompositionPreview';
import ManagePeriodsPanel from '@/components/financial/ManagePeriodsPanel';
import ColumnOrderGuide from '@/components/financial/ColumnOrderGuide';
import BalanceSheetView from '@/components/financial/BalanceSheetView';
import IncomeStatementView from '@/components/financial/IncomeStatementView';
import CashFlowStatementView from '@/components/financial/CashFlowStatementView';
import AccountPlanEnrichmentModal from '@/components/financial/AccountPlanEnrichmentModal';
import ImportConfigModal from '@/components/financial/ImportConfigModal';
import BpBalanceAlert from '@/components/financial/BpBalanceAlert';
import DfcValidationAlert from '@/components/financial/DfcValidationAlert';
import SystemHelpBanner from '@/components/financial/SystemHelpBanner';
import KanitzInsolvencyCard from '@/components/financial/KanitzInsolvencyCard';
import FinancialActionsPanel from '@/components/financial/FinancialActionsPanel';
import FinancialIndicatorsPanel from '@/components/financial/indicators/FinancialIndicatorsPanel';
import PageContainer from '@/components/layout/PageContainer';
import FinancialDefinitionForm from '@/components/financial/FinancialDefinitionForm';
import FinancialIntegrityValidationPanel from '@/components/financial/FinancialIntegrityValidationPanel';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { sha256File } from '@/lib/sha256File';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';


// ─── OverviewTab ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosis
 * @param {any=} props.uploads
 * @param {any=} props.onDeleted
 * @param {any=} props.onUploaded
 * @param {any=} props.onDiagnosisUpdated
 * @param {any=} props.tenantId
 * @param {any=} props.diagnosisId
 * @param {any=} props.diagnosisStatus
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function OverviewTab({ diagnosis, uploads, onDeleted, onUploaded, onDiagnosisUpdated, tenantId, diagnosisId, diagnosisStatus }) {
  const latestUpload = uploads[0];
  const queryClient = useQueryClient();
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState(null);
  const [purgeProgress, setPurgeProgress] = useState(0); // 0-100

  const PURGE_STEPS = [
  { label: 'Removendo balancetes', pct: 20 },
  { label: 'Limpando demonstrativos', pct: 45 },
  { label: 'Limpando indicadores', pct: 65 },
  { label: 'Limpando alertas e validações', pct: 85 },
  { label: 'Finalizando', pct: 100 }];


  const handleFullPurge = async () => {
    setPurging(true);
    setPurgeError(null);
    setPurgeProgress(5);

    // Simula progresso incremental enquanto aguarda a resposta da função
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < PURGE_STEPS.length - 1) {
        stepIdx++;
        setPurgeProgress(PURGE_STEPS[stepIdx].pct);
      }
    }, 700);

    try {
      const purgeTask = base44.functions.invoke('purgeFinancialUploadData', { diagnosis_id: diagnosisId, confirm: true });
      const timeoutTask = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('A operação excedeu o tempo limite (30s). Tente novamente.')), 30000)
      );
      const result = await Promise.race([purgeTask, timeoutTask]);
      console.log('[purge] resultado:', result?.data);
      clearInterval(interval);
      setPurgeProgress(100);
      // Fecha o modal imediatamente sem aguardar invalidações
      setShowPurgeConfirm(false);
      setPurgeProgress(0);
      // Dispara invalidação em background (sem await)
      invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      onDiagnosisUpdated();
    } catch (e) {
      clearInterval(interval);
      setPurgeError(e.message || 'Erro ao limpar dados.');
      setPurgeProgress(0);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <SystemHelpBanner />

      {diagnosis.notes &&
      <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">Notas</p>
            <p className="text-sm text-slate-700">{diagnosis.notes}</p>
          </CardContent>
        </Card>
      }

      {/* Import de Balancete — sub-abas internas */}
      <UploadTab
        diagnosisId={diagnosisId}
        tenantId={tenantId}
        diagnosisStatus={diagnosisStatus}
        hasExistingUpload={uploads.length > 0}
        uploads={uploads}
        onUploaded={onUploaded}
        diagnosis={diagnosis}
        onDiagnosisUpdated={onDiagnosisUpdated} />
      

      {latestUpload &&
      <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Último arquivo enviado</p>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{latestUpload.file_name}</p>
                <p className="text-xs text-slate-400">
                  {latestUpload.created_date ? format(new Date(latestUpload.created_date), 'dd/MM/yyyy HH:mm') : '—'}
                  {' · '}v{latestUpload.version_number}
                </p>
              </div>
              <Badge className={UPLOAD_STATUS_CONFIG[latestUpload.upload_status]?.cls || 'bg-slate-100 text-slate-500'}>
                {UPLOAD_STATUS_CONFIG[latestUpload.upload_status]?.label || latestUpload.upload_status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      }

      {/* Limpeza total */}
      {uploads.length > 0 &&
      <Card className="border border-red-200 shadow-sm bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">Limpeza Total e Recomeçar</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Remove todos os balancetes importados, demonstrativos (BP/DRE), indicadores e alertas. O diagnóstico voltará ao estado inicial para uma nova importação.
                </p>
                {purgeError &&
              <p className="text-xs text-red-600 mt-2 font-medium">{purgeError}</p>
              }
              </div>
              <PermissionGuard requireDelete>
                <button
                onClick={() => setShowPurgeConfirm(true)}
                disabled={purging}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-red-700 border border-red-300 bg-white rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition-colors">

                  {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {purging ? 'Limpando...' : 'Limpar tudo'}
                </button>
              </PermissionGuard>
            </div>
          </CardContent>
        </Card>
      }

      {/* Modal confirmação limpeza total */}
      {showPurgeConfirm &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Confirmar limpeza total?</p>
                <p className="text-xs text-slate-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 space-y-1">
              <p><strong>Serão removidos permanentemente:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 mt-1">
                <li>{uploads.length} balancete(s) importado(s)</li>
                <li>Todas as linhas de BP e DRE geradas</li>
                <li>Todos os indicadores financeiros</li>
                <li>Todos os alertas e validações</li>
              </ul>
            </div>
            {/* Barra de progresso da limpeza */}
            {purging &&
          <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {PURGE_STEPS.find((s, i) => i === PURGE_STEPS.findIndex((x) => x.pct >= purgeProgress))?.label || 'Processando...'}
                  </p>
                  <span className="text-xs font-bold text-red-600">{purgeProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                className="h-2 rounded-full transition-all duration-700 ease-in-out bg-red-500"
                style={{ width: `${purgeProgress}%` }} />
              
                </div>
              </div>
          }

            <div className="flex gap-2 justify-end">
              <button
              onClick={() => {setShowPurgeConfirm(false);setPurgeError(null);}}
              disabled={purging}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              
                Cancelar
              </button>
              <button
              onClick={handleFullPurge}
              disabled={purging}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
              
                {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {purging ? 'Limpando...' : 'Sim, limpar tudo'}
              </button>
            </div>
          </div>
        </div>
      }

      {/* ArchiveDeleteControls foi movido para o menu "..." no banner */}
    </div>);

}

// ─── UploadTab ────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.diagnosisStatus
 * @param {any=} props.hasExistingUpload
 * @param {any=} props.uploads
 * @param {any=} props.onUploaded
 * @param {any=} props.diagnosis
 * @param {any=} props.onDiagnosisUpdated
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function UploadTab({ diagnosisId, tenantId, diagnosisStatus, hasExistingUpload, uploads, onUploaded, diagnosis, onDiagnosisUpdated }) {
  const queryClient = useQueryClient();
  const [pendingFile, setPendingFile] = useState(null); // arquivo aguardando config
  const [showConfig, setShowConfig] = useState(false); // modal de configuração
  const [showConfirm, setShowConfirm] = useState(false); // modal de substituição
  const [importConfig, setImportConfig] = useState(null); // config confirmada

  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [purging, setPurging] = useState(false);
  const [currentStep, setCurrentStep] = useState(null); // 'uploading' | 'validating' | 'processing' | 'done'
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null); // { entityId, entityName, entityPeriod, entityType } — multi-entidade
  const fileInputRef = useRef(null);

  const isMultiEntity = (diagnosis?.analysis_type || 'individual') !== 'individual';

  const { data: scopeEntities = [] } = useQuery({
    queryKey: ['scope-entities-upload', diagnosisId],
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId, is_active: true }, 'id', 100),
    enabled: !!diagnosisId && isMultiEntity,
  });

  const STEPS = [
  { key: 'uploading', label: 'Enviando arquivo', desc: 'Fazendo upload do Excel...' },
  { key: 'validating', label: 'Validando estrutura', desc: 'Verificando colunas e períodos...' },
  { key: 'processing', label: 'Processando balancete', desc: 'Compondo DRE e Balanço gerenciais...' },
  { key: 'done', label: 'Importação concluída', desc: 'Finalizando...' }];


  function StepProgress() {
    if (!currentStep) return null;
    const activeIdx = STEPS.findIndex((s) => s.key === currentStep);
    const isDoneStep = currentStep === 'done';
    return (
      <div className={`mt-4 p-4 rounded-xl border space-y-3 ${isDoneStep ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
        {STEPS.map((step, idx) => {
          const isDone = isDoneStep || idx < activeIdx;
          const isActive = !isDoneStep && idx === activeIdx;
          const isPending = !isDoneStep && idx > activeIdx;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all
                ${isDone ? 'bg-emerald-500 text-white' : ''}
                ${isActive ? 'bg-blue-600 text-white' : ''}
                ${isPending ? 'bg-slate-200 text-slate-400' : ''}`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isPending ? 'text-slate-400' : isDone ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {step.label}
                </p>
                {isActive &&
                <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {step.desc}
                  </p>
                }
                {isDoneStep && idx === activeIdx &&
                <p className="text-xs text-emerald-600 mt-0.5">✓ Importação concluída com sucesso!</p>
                }
              </div>
            </div>);

        })}
      </div>);

  }
  const [savingPlan, setSavingPlan] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [innerTab, setInnerTab] = useState('periods'); // 'periods' | 'validation' | 'plan'

  const { data: accountPlans = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'account-plans'),
    queryFn: () => base44.entities.FinancialAccountPlan.filter(
      { tenant_id: tenantId, is_active: true }, 'name', 50
    ),
    enabled: !!tenantId
  });

  const currentPlanId = diagnosis?.account_plan_id || '';

  const handlePlanChange = async (planId) => {
    setSavingPlan(true);
    try {
      await base44.entities.FinancialDiagnosis.update(diagnosisId, { account_plan_id: planId || null });
      onDiagnosisUpdated();
    } finally {
      setSavingPlan(false);
    }
  };

  // 1. Usuário seleciona o arquivo → abre modal de configuração
  // Multi-entidade: exige selectedSource (entidade + período da matriz) antes de importar.
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (isMultiEntity && !selectedSource) {
      setError('Selecione uma célula na matriz de fontes (entidade × período) para importar.');
      return;
    }
    setPendingFile(selectedFile);
    setError(null);
    setShowConfig(true);
  };

  // Matriz: usuário clica em célula → define entidade+período e abre seletor de arquivo
  const handleImportCell = (scopeEntity, period) => {
    setSelectedSource({
      entityId: scopeEntity.entity_id,
      entityName: scopeEntity.entity_name,
      entityPeriod: period,
      entityType: scopeEntity.entity_type,
    });
    setError(null);
    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.click(); }, 50);
  };

  // 2. Usuário confirma a configuração → verifica se há upload anterior COM MESMO PERÍODO
  const handleConfigConfirm = (config) => {
    setImportConfig(config);
    setShowConfig(false);

    // Detecta conflito em qualquer fonte já importada para a mesma entidade e período.
    const sourceEntityId = config.sourceEntityId || selectedSource?.entityId || null;
    const conflictingUpload = uploads.find((upload) => {
      try {
        const uploadConfig = JSON.parse(upload.notes || '{}');
        return upload.is_current !== false &&
          upload.source_entity_id === sourceEntityId &&
          uploadConfig.period_override === config.periodOverride &&
          uploadConfig.column_label === config.columnLabel;
      } catch {
        return false;
      }
    });

    if (conflictingUpload) {
      setShowConfirm(true);
    } else {
      doUpload(pendingFile, config);
    }
  };

  // 3. Upload efetivo
  const doUpload = async (fileToUpload, config) => {
    const f = fileToUpload || pendingFile;
    const cfg = config || importConfig;
    if (!f || !cfg) return;

    // Validar se há plano de contas vinculado
    if (!currentPlanId) {
      setError('Selecione um plano de contas antes de importar. O plano define as rubricas de BP e DRE que serão mapeadas.');
      return;
    }

    setUploading(true);
    setError(null);
    setCurrentStep('uploading');
    let taskCompleted = false;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });

      // 10: source_key e input_checksum na criação do upload
      const normalizePeriod = (p) => p ? String(p).replace(/[^0-9-]/g, '').slice(0, 7) : null;
      const sourceEntityIdForUpload = cfg.sourceEntityId || null;
      const normalizedPeriod = normalizePeriod(cfg.sourcePeriod || null);
      const sourceKey = `${diagnosisId}|${sourceEntityIdForUpload || ''}|${normalizedPeriod || ''}`;
      const inputChecksum = await sha256File(f);

      const upload = await base44.entities.FinancialUpload.create({
        financial_diagnosis_id: diagnosisId,
        tenant_id: tenantId,
        file_name: f.name,
        file_url,
        version_number: 1,
        upload_status: 'pending',
        is_current: true,
        source_entity_id: sourceEntityIdForUpload,
        source_entity_type: cfg.sourceEntityType || selectedSource?.entityType || (cfg.sourceEntityId ? 'company' : null),
        source_entity_name: cfg.sourceEntityName || null,
        source_period: cfg.sourcePeriod || null,
        source_key: sourceKey,
        input_checksum: inputChecksum,
        notes: JSON.stringify({
          column_label: cfg.columnLabel,
          period_override: cfg.periodOverride || null,
          pl_account_code: cfg.plAccountCode || null,
          pl_account_name: cfg.plAccountName || null,
          pl_canonical_key: cfg.plCanonicalKey || null
        })
      });

      await base44.entities.FinancialDiagnosis.update(diagnosisId, { status: 'uploaded' });
      setUploading(false);
      setCurrentStep('validating');
      setValidating(true);
      const validateResult = await base44.functions.invoke('validateFinancialUpload', {
        upload_id: upload.id,
        diagnosis_id: diagnosisId
      });

      const missing = validateResult?.data?.missing_from_plan || [];
      const hasBlockers = validateResult?.data?.blocking_count > 0;

      const analysisType = diagnosis?.analysis_type || 'individual';
      if (!hasBlockers) {
        if (analysisType === 'individual') {
          setCurrentStep('processing');
          const buildPayload = {
            upload_id: upload.id,
            diagnosis_id: diagnosisId,
            period_override: cfg.periodOverride || null
          };
          // 4: Execução única, sem retry automático cego. Em caso de falha,
          //    o usuário deve clicar em "Reprocessar" novamente.
          await base44.functions.invoke('buildFinancialStatements', buildPayload);
          // Gerar achados e recomendações automáticos (best-effort, não bloqueante)
          try {
            await base44.functions.invoke('finalizeFinancialInsights', {
              financial_diagnosis_id: diagnosisId
            });
          } catch (e) {
            console.warn('[FinancialDiagnosisDetail] finalizeFinancialInsights falhou', e);
          }
        } else {
          // Multi-entidade: build individual (dataset_scope='individual') para agregação posterior.
          // A análise final (séries combined/parent/consolidated) vem após preparação do conjunto.
          setCurrentStep('processing');
          const buildPayload = { upload_id: upload.id, diagnosis_id: diagnosisId, period_override: cfg.periodOverride || null };
          // 4: Execução única, sem retry automático cego.
          await base44.functions.invoke('buildFinancialStatements', buildPayload);
          // NÃO chamar finalizeFinancialInsights — vem após preparação do conjunto
        }
      }

      setCurrentStep('done');
      taskCompleted = true;
      setTimeout(() => {
        setCurrentStep(null);
        setSelectedSource(null);
        onUploaded(missing, !hasBlockers);
      }, 2000);
    } catch (e) {
      if (currentStep === 'processing') {
        setError('A importação pode ter sido concluída, mas a resposta demorou. Atualize a página para confirmar antes de tentar novamente.');
      } else {
        setError(e.message || 'Erro ao fazer upload. Tente novamente.');
      }
    } finally {
      setUploading(false);
      setValidating(false);
      if (!taskCompleted) setCurrentStep(null);
    }
  };

  // F2-PER-01: Substituição seletiva two-phase — não usa purge nuclear.
  // O novo upload é criado, validado e ativado sem destruir o anterior.
  const handleReplaceConfirm = async () => {
    setShowConfirm(false);
    setError(null);
    setUploading(true);
    setCurrentStep('uploading');
    try {
      // 1. Fazer upload do novo arquivo (is_current=false, replacement_status=pending)
      const f = pendingFile;
      const cfg = importConfig;
      if (!f || !cfg) throw new Error('Arquivo ou configuração ausente');
      if (!currentPlanId) throw new Error('Selecione um plano de contas antes de importar.');

      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const newUpload = await base44.entities.FinancialUpload.create({
        financial_diagnosis_id: diagnosisId,
        tenant_id: tenantId,
        file_name: f.name,
        file_url,
        version_number: 1,
        upload_status: 'pending',
        is_current: false, // F2-PER-01: novo upload começa inativo
        replacement_status: 'pending',
        source_entity_id: cfg.sourceEntityId || selectedSource?.entityId || null,
        source_entity_type: cfg.sourceEntityType || selectedSource?.entityType || null,
        source_entity_name: cfg.sourceEntityName || selectedSource?.entityName || null,
        source_period: cfg.sourcePeriod || null,
        source_key: `${diagnosisId}|${cfg.sourceEntityId || selectedSource?.entityId || ''}|${(cfg.sourcePeriod || '').replace(/[^0-9-]/g, '').slice(0, 7)}`,
        input_checksum: await sha256File(f),
        notes: JSON.stringify({
          column_label: cfg.columnLabel,
          period_override: cfg.periodOverride || null,
          pl_account_code: cfg.plAccountCode || null,
          pl_account_name: cfg.plAccountName || null,
          pl_canonical_key: cfg.plCanonicalKey || null,
        }),
      });

      // 6: Comparar também o período normalizado, não apenas a entidade
      const normalizePeriod = (p) => p ? String(p).replace(/[^0-9-]/g, '').slice(0, 7) : null;
      const requestedEntityId = cfg.sourceEntityId || selectedSource?.entityId || null;
      const requestedPeriod = normalizePeriod(cfg.sourcePeriod || selectedSource?.entityPeriod || null);

      const currentUploadForPeriod = uploads.find((upload) => {
        const sameEntity = upload.source_entity_id === requestedEntityId;
        const samePeriod = normalizePeriod(upload.source_period) === requestedPeriod;
        return upload.is_current !== false && sameEntity && samePeriod &&
          upload.upload_status !== 'error' &&
          upload.upload_status !== 'validation_failed';
      });

      if (!currentUploadForPeriod) {
        // 6: Sem upload anterior — NÃO ativar diretamente; executar fluxo normal validate/build/integrity
        setCurrentStep('validating');
        try {
          const valResp = await base44.functions.invoke('validateFinancialUpload', {
            upload_id: newUpload.id,
            financial_upload_id: newUpload.id,
            diagnosis_id: diagnosisId,
            financial_diagnosis_id: diagnosisId,
          });
          const valData = valResp?.data || valResp;
          if (valData?.blocking_issues?.length > 0) {
            throw new Error(`${valData.blocking_issues.length} issue(s) bloqueante(s) na validação`);
          }
          await base44.entities.FinancialUpload.update(newUpload.id, {
            upload_status: 'validated',
            is_current: true,
            replacement_status: 'activated',
          });
          // Build outputs
          setCurrentStep('processing');
          await base44.functions.invoke('buildFinancialStatements', {
            upload_id: newUpload.id,
            diagnosis_id: diagnosisId,
            financial_diagnosis_id: diagnosisId,
            period_override: cfg.periodOverride || null,
          });
          await base44.entities.FinancialDiagnosis.update(diagnosisId, { current_upload_id: newUpload.id });
          // Integrity check
          try {
            await base44.functions.invoke('checkFinancialDiagnosisIntegrity', { financial_diagnosis_id: diagnosisId });
          } catch (e) { console.warn('[replaceConfirm] integrity check falhou:', e.message); }
        } catch (e) {
          // Marcar novo upload como error
          await base44.entities.FinancialUpload.update(newUpload.id, {
            upload_status: 'error',
            replacement_status: 'failed',
          });
          throw e;
        }
      } else {
        // 3. Two-phase replacement via function autorizada
        setCurrentStep('validating');
        const result = await base44.functions.invoke('replaceFinancialSourcePeriod', {
          financial_diagnosis_id: diagnosisId,
          current_upload_id: currentUploadForPeriod.id,
          new_upload_id: newUpload.id,
        });
        if (!result?.data?.success && result?.data?.success !== undefined) {
          throw new Error(result?.data?.message || 'Falha na substituição seletiva');
        }
      }

      // 4. Invalidar queries e notificar
      setCurrentStep('processing');
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      onUploaded([], true);
      setSelectedSource(null);
      setPendingFile(null);
      setImportConfig(null);
    } catch (e) {
      setError(e.message || 'Erro ao substituir período.');
      setCurrentStep(null);
    } finally {
      setUploading(false);
      setValidating(false);
    }
  };

  const isWorking = uploading || validating || purging;

  return (
    <div className="space-y-4">
      {/* Modal de configuração de importação */}
      <ImportConfigModal
        open={showConfig}
        file={pendingFile}
        accountPlanId={currentPlanId}
        tenantId={tenantId}
        onConfirm={handleConfigConfirm}
        onCancel={() => {setShowConfig(false);setPendingFile(null);setSelectedSource(null);}}
        sourceEntityId={selectedSource?.entityId}
        sourceEntityName={selectedSource?.entityName}
        sourcePeriod={selectedSource?.entityPeriod} />
      

      {/* Modal de confirmação de substituição */}
      {showConfirm &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Substituir período {importConfig?.columnLabel}?</p>
                <p className="text-xs text-slate-500 mt-0.5">Os dados do mesmo período serão removidos e reprocessados com o novo arquivo.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>Dados históricos de outros períodos</strong> serão mantidos. Apenas este período será substituído.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => {setShowConfirm(false);setPendingFile(null);setImportConfig(null);}}>
                Cancelar
              </Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={handleReplaceConfirm}>
                <RefreshCw className="w-3.5 h-3.5" /> Sim, substituir este período
              </Button>
            </div>
          </div>
        </div>
      }

      {/* Multi-entidade: matriz de fontes entidade × período */}
      {isMultiEntity && (
        <SourceMatrixPanel
          diagnosis={diagnosis}
          scopeEntities={scopeEntities}
          uploads={uploads}
          onImportCell={handleImportCell}
          onViewSource={() => {}}
          onDeleteSource={async (u) => {
            if (!confirm(`Excluir a fonte "${u.file_name}"? Os demonstrativos derivados serão removidos.`)) return;
            try {
              // F2-DEL-01: exclusão segura via function autorizada (não delete direto)
              const result = await base44.functions.invoke('deleteFinancialUploadSafe', {
                financial_diagnosis_id: diagnosisId,
                financial_upload_id: u.id,
              });
              if (result?.data && result.data.success === false) {
                alert(`Falha na exclusão: ${result.data.message || 'erro desconhecido'}`);
              }
            } catch (e) {
              alert(`Erro ao excluir fonte: ${e.message}`);
            }
            queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'uploads') });
          }}
        />
      )}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} />

      {/* Layout em duas colunas: upload + conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Área de upload — coluna esquerda */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 transition-colors
            ${isWorking ? 'cursor-not-allowed opacity-60 border-slate-200 bg-slate-50' : 'cursor-pointer border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50'}`}>
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              {isWorking ? 'Processando...' : 'Clique para selecionar o arquivo Excel'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isWorking ? '' : '.xlsx · Após selecionar, configure o período antes de importar'}
            </p>
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={isWorking}
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} />
          </label>

          <StepProgress />
          {error &&
          <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          }
        </CardContent>
      </Card>

      {/* Sub-abas internas: Períodos Importados | Validação e Composição | Plano de Contas */}
      {uploads.length > 0 &&
      <div className="space-y-4">
          <div className="flex gap-2 border-b border-slate-200 pb-0 overflow-x-auto">
            {[
          { key: 'periods', label: 'Períodos Importados', count: uploads.length },
          { key: 'validation', label: 'Validação e Composição', count: null },
          { key: 'plan', label: 'Plano de Contas Gerencial', count: null }].
          map((t) =>
          <button
            key={t.key}
            onClick={() => setInnerTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                  ${innerTab === t.key ?
            'border-blue-600 text-blue-600' :
            'border-transparent text-slate-500 hover:text-slate-700 cursor-pointer'}`}>
            
                {t.label}
                {t.count != null && <span className="text-xs text-slate-400">({t.count})</span>}
              </button>
          )}
          </div>

          {innerTab === 'periods' &&
        <ManagePeriodsPanel
          uploads={uploads}
          diagnosisId={diagnosisId}
          tenantId={tenantId}
          onDeleted={() => queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'uploads') })} />

        }

          {innerTab === 'validation' &&
        <ValidationTab
          diagnosisId={diagnosisId}
          diagnosisStatus={diagnosisStatus}
          currentUploadId={diagnosis.current_upload_id}
          diagnosis={diagnosis}
          uploads={uploads} />

        }

          {innerTab === 'plan' &&
        <div className="space-y-4">
              <Card className={`${currentPlanId ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${currentPlanId ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {savingPlan ?
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> :
                  currentPlanId ?
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold mb-1 ${currentPlanId ? 'text-emerald-800' : 'text-red-800'}`}>
                        Plano de Contas Gerencial — OBRIGATÓRIO
                      </p>
                      <p className={`text-xs mb-2 ${currentPlanId ? 'text-emerald-700' : 'text-red-700'}`}>
                        {currentPlanId ?
                    'Plano vinculado. O balancete será mapeado automaticamente para as rubricas de BP e DRE deste plano.' :
                    'OBRIGATÓRIO: Selecione um plano antes de importar o balancete. Este plano define as rubricas de BP e DRE que serão geradas.'}
                      </p>
                      <select
                    value={currentPlanId}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    disabled={savingPlan}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60">
                    
                        <option value="">— Sem plano de contas (classificação manual no Excel) —</option>
                        {accountPlans.map((p) =>
                    <option key={p.id} value={p.id}>{p.name}{p.version ? ` · ${p.version}` : ''}</option>
                    )}
                      </select>
                      {accountPlans.length === 0 &&
                  <p className="text-xs text-slate-400 mt-1">Nenhum plano ativo. <a href="/FinancialAccountPlanManager" className="text-blue-500 underline">Cadastrar plano →</a></p>
                  }
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-100">
                


















            
              </Card>
            </div>
        }
      </div>
      }

      {/* Quando não há uploads, mostrar plano de contas + ajuda diretamente */}
      {uploads.length === 0 &&
      <div className="space-y-4">
          <Card className={`${currentPlanId ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${currentPlanId ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {savingPlan ?
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> :
                currentPlanId ?
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                <AlertCircle className="w-4 h-4 text-red-600" />
                }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold mb-1 ${currentPlanId ? 'text-emerald-800' : 'text-red-800'}`}>
                    Plano de Contas Gerencial — OBRIGATÓRIO
                  </p>
                  <p className={`text-xs mb-2 ${currentPlanId ? 'text-emerald-700' : 'text-red-700'}`}>
                    {currentPlanId ?
                  'Plano vinculado. O balancete será mapeado automaticamente para as rubricas de BP e DRE deste plano.' :
                  'OBRIGATÓRIO: Selecione um plano antes de importar o balancete. Este plano define as rubricas de BP e DRE que serão geradas.'}
                  </p>
                  <select
                  value={currentPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  disabled={savingPlan}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60">
                  
                    <option value="">— Sem plano de contas (classificação manual no Excel) —</option>
                    {accountPlans.map((p) =>
                  <option key={p.id} value={p.id}>{p.name}{p.version ? ` · ${p.version}` : ''}</option>
                  )}
                  </select>
                  {accountPlans.length === 0 &&
                <p className="text-xs text-slate-400 mt-1">Nenhum plano ativo. <a href="/FinancialAccountPlanManager" className="text-blue-500 underline">Cadastrar plano →</a></p>
                }
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4">
              <button onClick={() => setHelpExpanded((v) => !v)} className="flex items-center justify-between w-full text-left">
                <p className="text-sm font-semibold text-blue-800">Como o sistema funciona</p>
                <span className="text-[10px] text-blue-500 font-medium ml-2 shrink-0">
                  {helpExpanded ? '▲ Ocultar' : '▼ Expandir'}
                </span>
              </button>
              {helpExpanded &&
            <div className="mt-3 space-y-3">
                  <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                    <li>Arquivo <strong>.xlsx</strong> com aba <strong>Balancete</strong></li>
                    <li>Linha 1 = cabeçalho; demais = uma conta analítica por linha</li>
                    <li>Coluna <code>account_type</code>: <strong>A</strong> = analítica, <strong>S</strong> = sintética</li>
                    <li>Com plano vinculado, a coluna <code>classification</code> é opcional</li>
                    <li><strong>Padrão de sinais:</strong> importe contas <strong>devedoras positivas</strong> e <strong>credoras negativas</strong>. O motor normaliza para o padrão auditoria automaticamente.</li>
                  </ul>
                  <ColumnOrderGuide />
                </div>
            }
            </CardContent>
          </Card>
        </div>
      }
      </div>{/* fim grid 2 colunas */}
    </div>);

}

// ─── ValidationTab ────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.diagnosisStatus
 * @param {any=} props.currentUploadId
 * @param {any=} props.diagnosis
 * @param {any=} props.uploads
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function ValidationTab({ diagnosisId, diagnosisStatus, currentUploadId, diagnosis, uploads = [] }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const [missingAccounts, setMissingAccounts] = useState(null);

  const { data: validations = [], isLoading } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'validations'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialValidationResult.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id:currentScope.processing_run_id, publication_status:'active' }, 'severity', 100
    ),
    enabled: !!currentScope?.processing_run_id,
    refetchInterval: diagnosisStatus === 'validating' ? 3000 : false
  });

  const bloqueantes = validations.filter((v) => v.severity === 'blocking');
  const ressalvas = validations.filter((v) => v.severity === 'warning');
  const informativas = validations.filter((v) => v.severity === 'info');
  const hasBlocker = bloqueantes.length > 0;

  if (diagnosisStatus === 'validating') {
    return (
      <div className="text-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-400" />
        <p className="text-sm font-medium text-slate-600">Validação em andamento...</p>
        <p className="text-xs mt-1">Verificando estrutura e conteúdo do arquivo.</p>
      </div>);

  }

  if (diagnosisStatus === 'processing') {
    return (
      <div className="text-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-purple-400" />
        <p className="text-sm font-medium text-slate-600">Processando balancete...</p>
        <p className="text-xs mt-1">Compondo DRE e Balanço gerenciais.</p>
      </div>);

  }

  if (isLoading) return <p className="text-sm text-slate-400 py-8 text-center">Carregando...</p>;

  if (validations.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma validação registrada ainda.</p>
        <p className="text-xs mt-1">Envie um arquivo na aba Upload para iniciar.</p>
      </div>);

  }

  /**
   * @param {Object} props
   * @param {any=} props.items
   * @param {any=} props.severityKey
    * @param {any=} props.statement_code
    * @param {any=} props.statement_family
   */
  const Section = ({ items, severityKey }) => {
    if (items.length === 0) return null;
    const cfg = VALIDATION_SEVERITY_CONFIG[severityKey];
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cfg.badgeCls}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-400">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map((v) =>
          <div key={v.id} className={`p-3 rounded-lg border text-sm ${cfg.cls}`}>
              <p className="font-semibold">{v.title}</p>
              <p className="text-xs mt-0.5 opacity-80">{v.message}</p>
              {(v.sheet_name || v.row_ref) &&
            <p className="text-xs mt-1 font-mono opacity-60">
                  {v.sheet_name && `Aba: ${v.sheet_name}`}{v.row_ref && ` · Linha: ${v.row_ref}`}
                </p>
            }
            </div>
          )}
        </div>
      </div>);

  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Resumo + CTA processar */}
      <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border
        ${hasBlocker ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex items-center gap-3">
          {hasBlocker ?
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" /> :
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${hasBlocker ? 'text-red-800' : 'text-emerald-800'}`}>
              {hasBlocker ? MESSAGES.validationFailed : MESSAGES.validationOk}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {bloqueantes.length} bloqueante(s) · {ressalvas.length} ressalva(s) · {informativas.length} informativa(s)
            </p>
          </div>
        </div>


      </div>

      <Section items={bloqueantes} severityKey="blocking" />
      <Section items={ressalvas} severityKey="warning" />
      <Section items={informativas} severityKey="info" />

      {/* Preview de composição pós-processamento */}
      {diagnosisStatus === 'processed' && currentUploadId &&
      <CompositionPreview uploadId={currentUploadId} diagnosisId={diagnosisId} />
      }
    </div>);

}

// ─── PeriodFilterBar ─────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.periods
 * @param {any=} props.periodFilter
 * @param {any=} props.setPeriodFilter
 * @param {any=} props.annualCount
 * @param {any=} props.setAnnualCount
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function PeriodFilterBar({ periods, periodFilter, setPeriodFilter, annualCount, setAnnualCount }) {
  const hasMonthly = periods.some((p) => p.startsWith('M-'));
  const hasQuarterly = periods.some((p) => p.startsWith('Q-'));
  const hasAnnual = periods.some((p) => p.startsWith('A-'));

  const opts = [
  { key: 'annual', label: 'Anual', has: hasAnnual },
  { key: 'monthly', label: 'Mensal', has: hasMonthly },
  { key: 'quarterly', label: 'Trimestral', has: hasQuarterly }];


  return (
    <div className="flex gap-2 items-center">
      {opts.map((o) =>
      <button
        key={o.key}
        disabled={!o.has}
        onClick={() => o.has && setPeriodFilter(o.key)}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${periodFilter === o.key ?
        'bg-blue-600 text-white' :
        o.has ?
        'bg-slate-100 text-slate-600 hover:bg-slate-200' :
        'bg-slate-50 text-slate-300 cursor-not-allowed'}`}>
        
          {o.label}
        </button>
      )}
      {periodFilter === 'annual' &&
      <select
        value={annualCount}
        onChange={(e) => setAnnualCount(parseInt(e.target.value, 10))}
        className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
        
          <option value={2}>Últimos 2 anos</option>
          <option value={3}>Últimos 3 anos</option>
          <option value={4}>Últimos 4 anos</option>
        </select>
      }
    </div>);

}

// ─── StatementsTab ────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.uploadId
 * @param {any=} props.tenantId
 * @param {any=} props.uploadMeta
 * @param {any=} props.uploads
 * @param {any=} props.periodFilter
 * @param {any=} props.setPeriodFilter
 * @param {any=} props.annualCount
 * @param {any=} props.setAnnualCount
 * @param {any=} props.selectedYear
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function StatementsTab({ diagnosisId, uploadId, tenantId, uploadMeta, uploads = [], periodFilter, setPeriodFilter, annualCount = 2, setAnnualCount, selectedYear = null }) {
  const [activeView, setActiveView] = useState('bp');
  const { data: currentScope, isLoading: isLoadingScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const hasCurrentScope = !!currentScope?.processing_run_id;

  const { data: rawLines = [], isLoading } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'statements'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id: currentScope.processing_run_id, publication_status: 'active' }, 'period', 50000
    ),
    enabled: !!diagnosisId && hasCurrentScope
  });
  // Multi-entidade: excluir linhas individuais quando há séries preparadas (parent/consolidated/combined)
  const hasPreparedSeries = rawLines.some((l) => ['parent', 'consolidated', 'combined'].includes(l.dataset_scope));
  const lines = hasPreparedSeries ? rawLines.filter((l) => l.dataset_scope !== 'individual') : rawLines;

  // Normaliza: dados antigos sem column_key ganham prefixo M-
  const toColKey = (l) => l.column_key || (/^\d{4}-\d{2}$/.test(l.period || '') ? `M-${l.period}` : l.period);
  // Canonical reporting_entity_id por (dataset_scope, colKey): linhas com reporting_entity_id
  // vazio (ex.: DFC gerada via dfc_only) herdam o reporting_entity_id preenchido das linhas
  // BP/DRE do mesmo scope+período — GARANTE que nunca existam duas colunas do mesmo período.
  const canonicalEntity = {};
  for (const l of lines) {
    const k = `${l.dataset_scope || 'individual'}|${toColKey(l)}`;
    if (l.reporting_entity_id && !canonicalEntity[k]) canonicalEntity[k] = l.reporting_entity_id;
  }
  const seriesKey = (l) => `${l.dataset_scope || 'individual'}|${canonicalEntity[`${l.dataset_scope || 'individual'}|${toColKey(l)}`] || ''}|${toColKey(l)}`;
  const seriesLabelOf = (l) => {
    const ds = l.dataset_scope || 'individual';
    if (ds === 'parent') return 'Controladora';
    if (ds === 'consolidated') return 'Consolidado';
    if (ds === 'combined') return 'Combinado';
    return '';
  };
  const colKeyFromSeries = (s) => s.split('|').slice(-1)[0];

  const fmtColKey = (ck) => {
    if (!ck) return ck;
    const m = ck.match(/^M-(\d{4})-(\d{2})$/);
    if (m) return `${m[2]}/${m[1]}`;
    const a = ck.match(/^A-(\d{4})$/);
    if (a) return a[1];
    const q = ck.match(/^Q-(\d{4})-(\d{2})$/);
    if (q) {const n = Math.ceil(parseInt(q[2], 10) / 3);return `${n}ºtrim/${q[1]}`;}
    const p = ck.match(/^(\d{4})-(\d{2})$/);
    return p ? `${p[2]}/${p[1]}` : ck;
  };

  const PREFIX = periodFilter === 'monthly' ? 'M-' : periodFilter === 'quarterly' ? 'Q-' : 'A-';

  const linesWithKey = lines.map((l) => ({
    ...l,
    _col: toColKey(l),
    _series: seriesKey(l),
    _seriesLabel: seriesLabelOf(l),
    _label: l.column_label || null
  }));

  // Mapa series-key → label (inclui rótulo da série para multi-entidade)
  const columnLabelMap = {};
  for (const l of linesWithKey) {
    if (!columnLabelMap[l._series]) {
      const base = l._label || fmtColKey(l._col);
      columnLabelMap[l._series] = l._seriesLabel ? `${l._seriesLabel} ${base}` : base;
    }
  }

  // Colunas = series keys; filtra pelo column_key (prefix)
  const allCols = [...new Set(linesWithKey.map((l) => l._series))];
  const filteredCols = allCols.filter((s) => colKeyFromSeries(s).startsWith(PREFIX));
  const SERIES_ORDER = { parent: 0, combined: 0, consolidated: 1, individual: 0 };
  let periods = filteredCols.sort((a, b) => {
    const ka = colKeyFromSeries(a), kb = colKeyFromSeries(b);
    if (periodFilter === 'annual') {
      const yearA = parseInt(ka.match(/A-(\d{4})$/)?.[1] || '0', 10);
      const yearB = parseInt(kb.match(/A-(\d{4})$/)?.[1] || '0', 10);
      if (yearA !== yearB) return yearB - yearA;
    } else {
      const c = ka.localeCompare(kb);
      if (c !== 0) return c;
    }
    const dsa = a.split('|')[0], dsb = b.split('|')[0];
    return (SERIES_ORDER[dsa] ?? 2) - (SERIES_ORDER[dsb] ?? 2);
  });
  if (periodFilter === 'annual') {
    if (selectedYear) {
      periods = periods.filter((s) => colKeyFromSeries(s) === `A-${selectedYear}`);
    } else {
      // Limita aos `annualCount` anos mais recentes, mantendo todas as séries de cada ano.
      // Baseado em anos distintos — robusto contra séries fantasmas/inflação de seriesCount.
      const seenYears = new Set();
      periods = periods.filter((s) => {
        const yr = colKeyFromSeries(s).match(/A-(\d{4})$/)?.[1];
        if (!yr) return false;
        if (seenYears.has(yr)) return true;
        if (seenYears.size >= annualCount) return false;
        seenYears.add(yr);
        return true;
      });
    }
  }

  // Remap linhas para usar _series como "period" (as views indexam por period)
  const remappedLines = linesWithKey.map((l) => ({ ...l, period: l._series }));
  const remappedLinesFiltered = remappedLines.filter((l) => periods.includes(l.period));

  const dreLines = remappedLinesFiltered.filter((/** @type {any} */ l) => {
    if (l.statement_code) return l.statement_code === 'DRE';
    return l.statement_family === 'dre';
  });
  const bpLines = remappedLinesFiltered.filter((/** @type {any} */ l) => {
    if (l.statement_code) return l.statement_code === 'BP';
    return l.statement_family === 'balance_sheet';
  });
  const dfcLines = remappedLinesFiltered.filter((/** @type {any} */ l) => {
    if (l.statement_code) return l.statement_code === 'DFC';
    return l.statement_family === 'cash_flow';
  });

  // Diagnóstico: uploads cadastrados vs períodos com dados derivados
  const uploadsTotal = uploads.length;
  const processedUploads = uploads.filter((u) => u.upload_status === 'processed');
  const periodsWithData = periods.length;
  const hasDivergence = processedUploads.length > periodsWithData && !isLoading;

  if (isLoadingScope || isLoading) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-400" />
        <p className="text-sm">Carregando demonstrações do processamento atual...</p>
      </div>);
  }

  if (!hasCurrentScope || lines.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Demonstrações ainda não disponíveis.</p>
        <p className="text-xs mt-1">Conclua o processamento ou atualize a validação para publicar os resultados.</p>
      </div>);

  }

  const isAnnual = periodFilter === 'annual';

  return (
    <div className="space-y-3">
      {/* Barra única: seletor de demonstração + filtro de período */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
          { key: 'bp', label: 'BP' },
          { key: 'dre', label: 'DRE' },
          { key: 'dfc', label: 'DFC' }].
          map((f) =>
          <button key={f.key} onClick={() => setActiveView(f.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${activeView === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          )}
        </div>
        <PeriodFilterBar periods={allCols.map((s) => s.split('|').slice(-1)[0])} periodFilter={periodFilter} setPeriodFilter={setPeriodFilter} annualCount={annualCount} setAnnualCount={setAnnualCount} />
      </div>

      <div className="overflow-x-auto">
        {activeView === 'dre' && <IncomeStatementView lines={dreLines} periods={periods} periodLabelMap={columnLabelMap} isAnnual={isAnnual} />}
        {activeView === 'bp' && <BalanceSheetView lines={bpLines} periods={periods} periodLabelMap={columnLabelMap} isAnnual={isAnnual} />}
        {activeView === 'dfc' && <CashFlowStatementView lines={dfcLines} periods={periods} periodLabelMap={columnLabelMap} diagnosisId={diagnosisId} />}
      </div>

      {/* Banners de conferência de saldos abaixo das demonstrações */}
      {activeView === 'bp' && <BpBalanceAlert diagnosisId={diagnosisId} />}
      {activeView === 'dfc' && <DfcValidationAlert diagnosisId={diagnosisId} />}
    </div>);

}

// ─── YearQuickSelector ─────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosis
 * @param {any=} props.selectedYear
 * @param {any=} props.setSelectedYear
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function YearQuickSelector({ diagnosis, selectedYear, setSelectedYear }) {
  const startYear = parseInt(diagnosis?.first_period?.slice(0, 4) || '', 10);
  const endYear = parseInt(diagnosis?.last_period?.slice(0, 4) || '', 10);
  if (!startYear || !endYear) return null;

  const years = [];
  for (let y = endYear; y >= startYear; y--) years.push(y);
  if (years.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setSelectedYear(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${!selectedYear ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
        
        Todos
      </button>
      {years.map((y) =>
      <button
        key={y}
        onClick={() => setSelectedYear(y)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${selectedYear === y ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
        
          {y}
        </button>
      )}
    </div>);

}

// ─── AnalysisFinanceiraTab ────────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.diagnosis
 * @param {any=} props.diagnosisId
 * @param {any=} props.uploadId
 * @param {any=} props.tenantId
 * @param {any=} props.uploads
 * @param {any=} props.periodFilter
 * @param {any=} props.setPeriodFilter
 * @param {any=} props.annualCount
 * @param {any=} props.setAnnualCount
 * @param {any=} props.uploadMeta
 * @param {any=} props.activeStep
 * @param {any=} props.analysisSubTab
 * @param {any=} props.setAnalysisSubTab
 * @param {any=} props.journey
 * @param {any=} props.onStepChange
 * @param {any=} props.onDeleted
 * @param {any=} props.onUploaded
 * @param {any=} props.onDiagnosisUpdated
 * @param {any=} props.diagnosisStatus
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function AnalysisFinanceiraTab({ diagnosis, diagnosisId, uploadId, tenantId, uploads, periodFilter, setPeriodFilter, annualCount, setAnnualCount, uploadMeta, activeStep, analysisSubTab, setAnalysisSubTab, journey, onStepChange, onDeleted, onUploaded, onDiagnosisUpdated, diagnosisStatus }) {
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const [selectedYear, setSelectedYear] = useState(null);
  const isProcessed = diagnosisStatusReached(diagnosisStatus, 'processed');

  // ── Step bloqueado: mostrar mensagem ──
  if (activeStep && journey && !journey.canAccess(activeStep)) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Lock className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Etapa bloqueada</p>
        <p className="text-xs mt-1">Complete as etapas anteriores para liberar esta etapa.</p>
      </div>
    );
  }

  // ── Sub-abas da etapa ANÁLISE ──
  const ANALYSIS_SUBTABS = [
    { key: 'statements', label: 'Demonstrações', icon: FileSpreadsheet },
    { key: 'indicators', label: 'Indicadores', icon: TrendingUp },
    { key: 'kanitz', label: 'Kanitz', icon: AlertTriangle },
    { key: 'actions', label: 'Ações & Achados', icon: CheckCircle2 },
  ];


  // ── Etapa ESTRUTURA: formulário de definição inline (editável) ──
  if (activeStep === 'estrutura') {
    return (
      <FinancialDefinitionForm
        diagnosis={diagnosis}
        diagnosisId={diagnosisId}
        tenantId={tenantId}
        groupId={diagnosis.group_id}
        readOnly={!perms.canManageDiagnosis}
        onSaved={async () => {
          await onDiagnosisUpdated();
          // Após salvar a definição, refetchar a jornada para obter o current_step
          // atualizado do backend (estrutura → fontes quando completa).
          await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'journey-state') });
          /** @type {FinancialJourneyState|undefined} */
          const refreshedJourney = queryClient.getQueryData(financialKey(tenantId, diagnosisId, 'journey-state'));
          onStepChange(refreshedJourney?.current_step || 'fontes');
        }}
        onCancel={() => onStepChange(journey?.currentStep || 'fontes')}
      />
    );
  }

  // ── Etapa FONTES: upload + matriz + plano + purge ──
  if (activeStep === 'fontes') {
    return (
      <OverviewTab
        diagnosis={diagnosis}
        uploads={uploads}
        onDeleted={onDeleted}
        onUploaded={onUploaded}
        onDiagnosisUpdated={onDiagnosisUpdated}
        tenantId={tenantId}
        diagnosisId={diagnosisId}
        diagnosisStatus={diagnosisStatus}
      />
    );
  }

  // ── Etapa COMBINAÇÃO (combined): apenas preparação da combinação — sem conciliação/cédula ──
  if (activeStep === 'combinacao') {
    return <PreparationPanel diagnosisId={diagnosisId} diagnosis={diagnosis} />;
  }
  // ── Etapa CONCILIAÇÃO (consolidated): conciliação intragrupo ──
  // 3.1: Painel busca seu próprio escopo — não depende de journey.raw.scopeEntities
  if (activeStep === 'conciliacao') {
    return <IntercompanyReconciliationPanel diagnosisId={diagnosisId} />;
  }
  // ── Etapa CÉDULA (consolidated): eliminações, ajustes e reclassificações ──
  if (activeStep === 'cedula') {
    return <ConsolidationEntryManager diagnosisId={diagnosisId} />;
  }
  // ── Etapa PREPARAÇÃO (consolidated): preparação do dataset consolidado ──
  if (activeStep === 'preparacao') {
    return <PreparationPanel diagnosisId={diagnosisId} diagnosis={diagnosis} />;
  }
  // ── Etapa CONSOLIDAÇÃO (legado/compact): painel multi-entidade ciente do tipo ──
  if (activeStep === 'consolidacao') {
    return <FinancialMultiEntityPanel diagnosisId={diagnosisId} diagnosis={diagnosis} />;
  }

  // ── Etapa VALIDAÇÃO: painel de integridade (F2-JRN-01, 3.2 / UX-08) ──
  if (activeStep === 'validacao') {
    return (
      <FinancialIntegrityValidationPanel
        diagnosisId={diagnosisId}
        integrity={journey?.integrity}
        onResolved={async () => {
          await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
        }}
      />
    );
  }

  // ── Etapa ANÁLISE: sub-abas internas (statements, indicators, kanitz, actions) ──
  if (activeStep === 'analise' && isProcessed) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <YearQuickSelector diagnosis={diagnosis} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />
        </div>
        <div className="flex gap-2 border-b border-slate-200 pb-0 overflow-x-auto">
          {ANALYSIS_SUBTABS.map((subtab) =>
            <button
              key={subtab.key}
              onClick={() => setAnalysisSubTab(subtab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                ${analysisSubTab === subtab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 cursor-pointer'}`}>
              <subtab.icon className="w-4 h-4" />
              {subtab.label}
            </button>
          )}
        </div>

        {analysisSubTab === 'statements' &&
          <StatementsTab
            diagnosisId={diagnosisId}
            uploadId={uploadId}
            tenantId={tenantId}
            uploads={uploads}
            periodFilter={periodFilter}
            setPeriodFilter={setPeriodFilter}
            annualCount={annualCount}
            setAnnualCount={setAnnualCount}
            uploadMeta={uploadMeta}
            selectedYear={selectedYear}
          />
        }
        {analysisSubTab === 'indicators' &&
          <FinancialIndicatorsPanel
            diagnosisId={diagnosisId}
            periodFilter={periodFilter}
            setPeriodFilter={setPeriodFilter}
            tenantId={tenantId}
            diagnosis={diagnosis}
          />
        }
        {analysisSubTab === 'kanitz' &&
          <KanitzInsolvencyCard diagnosisId={diagnosisId} />
        }
        {analysisSubTab === 'actions' &&
          <FinancialActionsPanel diagnosisId={diagnosisId} tenantId={tenantId} diagnosis={diagnosis} />
        }
      </div>
    );
  }

  // ── Fallback: etapa não reconhecida ou não processada ──
  return (
    <div className="text-center py-16 text-slate-400">
      <Lock className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium">Etapa bloqueada</p>
      <p className="text-xs mt-1">{MESSAGES.lockedSection}</p>
    </div>
  );
  }

// ─── LockedTab ────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.label
  * @param {any=} props.statement_code
  * @param {any=} props.statement_family
 */
function LockedTab({ label }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <Lock className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium">Seção bloqueada</p>
      <p className="text-xs mt-1">{MESSAGES.lockedSection} (<strong>{label}</strong>)</p>
    </div>);

}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FinancialDiagnosisDetail() {
  const params = new URLSearchParams(window.location.search);
  const diagnosisId = params.get('id');
  const { user, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(null);
  const [stepTouched, setStepTouched] = useState(false); // usuário navegou manualmente entre etapas?
  const initialViewParams = new URLSearchParams(window.location.search);
  const [analysisSubTab, setAnalysisSubTab] = useState(initialViewParams.get('analysis_tab') || 'statements');
  const [periodFilter, setPeriodFilter] = useState(initialViewParams.get('period_mode') || 'annual');
  const [annualCount, setAnnualCount] = useState(Number(initialViewParams.get('annual_count')) || 2); // quantos exercícios anuais exibir (2, 3 ou 4)
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState(null);
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState(null);
  const archiveDeleteRef = React.useRef(null); // { step, total, uploadLabel, phase, percent }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('id', diagnosisId);
    params.set('analysis_tab', analysisSubTab);
    params.set('period_mode', periodFilter);
    params.set('annual_count', String(annualCount));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [diagnosisId, analysisSubTab, periodFilter, annualCount]);

  const handleReprocess = async () => {
    if (!uploads.length) return;
    setShowReprocessConfirm(false);
    setReprocessing(true);
    setReprocessError(null);
    setReprocessStatus(null);

    const analysisType = diagnosis?.analysis_type || 'individual';

    // Multi-entidade: re-preparar dataset + re-build todas as séries
    if (analysisType !== 'individual') {
      try {
        setReprocessStatus({ step: 1, total: 2, uploadLabel: 'Preparando dataset multi-entidade', phase: 'building', percent: 30 });
        await base44.functions.invoke('prepareFinancialAnalysisDataset', { diagnosis_id: diagnosisId });
        setReprocessStatus({ step: 2, total: 2, uploadLabel: 'Processando séries', phase: 'building', percent: 70 });
        const runs = await base44.entities.FinancialPreparationRun.filter({ financial_diagnosis_id: diagnosisId, status: 'prepared' }, '-run_number', 20);
        const preparedRuns = runs.filter((r) => !r.superseded_by_run_id);
        for (const run of preparedRuns) {
          await base44.functions.invoke('buildFinancialStatements', { diagnosis_id: diagnosisId, prepared_run_id: run.id });
        }
        try { await base44.functions.invoke('finalizeFinancialInsights', { financial_diagnosis_id: diagnosisId }); } catch (e) { console.warn('[reprocess] finalize falhou', e); }
        setReprocessStatus({ step: 2, total: 2, uploadLabel: '', phase: 'done', failures: [] });
      } catch (e) {
        setReprocessError(`Reprocessamento multi-entidade falhou: ${e.message || e}`);
        setReprocessStatus({ step: 2, total: 2, uploadLabel: '', phase: 'done', failures: [e.message] });
      }
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      // 12: Não forçar análise — refetch journey e usar current_step do backend
      await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'journey-state') });
      /** @type {FinancialJourneyState|undefined} */
      const refreshedJourney = queryClient.getQueryData(financialKey(tenantId, diagnosisId, 'journey-state'));
      if (refreshedJourney?.can_open_analysis && !reprocessError) {
        setActiveStep('analise'); setAnalysisSubTab('statements');
      } else {
        setActiveStep(refreshedJourney?.current_step || 'fontes');
      }
      setReprocessing(false);
      setTimeout(() => setReprocessStatus(null), 5000);
      return;
    }

    // Individual: loop por upload (fluxo existente)
    const sortedUploads = [...uploads].sort((a, b) =>
    (a.created_date || '').localeCompare(b.created_date || '')
    );
    const total = sortedUploads.length;
    const failures = [];

    const calcPercent = (uploadIdx) => Math.round(((uploadIdx + 1) / total) * 100);

    for (let i = 0; i < sortedUploads.length; i++) {
      const upload = sortedUploads[i];
      const notes = (() => {try {return JSON.parse(upload.notes || '{}');} catch {return {};}})();
      const uploadLabel = notes.column_label || `Período ${i + 1}`;

      try {
        // Cada período é reconstruído sem excluir os demais resultados ativos.
        setReprocessStatus({ step: i + 1, total, uploadLabel, phase: 'building', percent: calcPercent(i) });
        await base44.functions.invoke('buildFinancialStatements', {
          upload_id: upload.id,
          diagnosis_id: diagnosisId,
          period_override: notes.period_override || null
        });
      } catch (e) {
        failures.push(`${uploadLabel}: ${e.message || 'erro desconhecido'}`);
        console.error(`[reprocess] falha no upload ${uploadLabel}:`, e);
      }
    }

    // Gerar achados e recomendações após reprocessamento (best-effort)
    try {
      await base44.functions.invoke('finalizeFinancialInsights', {
        financial_diagnosis_id: diagnosisId
      });
    } catch (e) {
      console.warn('[FinancialDiagnosisDetail] finalizeFinancialInsights falhou no reprocessamento', e);
    }

    setReprocessStatus({ step: total, total, uploadLabel: '', phase: 'done', failures });
    if (failures.length > 0) {
      setReprocessError(`${failures.length} período(s) com falha: ${failures.join(' | ')}`);
    }

    await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
    // 12: Não forçar análise após falhas — refetch journey e usar current_step do backend
    await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'journey-state') });
    /** @type {FinancialJourneyState|undefined} */
    const refreshedJourney = queryClient.getQueryData(financialKey(tenantId, diagnosisId, 'journey-state'));
    if (refreshedJourney?.can_open_analysis && failures.length === 0) {
      setActiveStep('analise'); setAnalysisSubTab('statements');
    } else {
      setActiveStep(refreshedJourney?.current_step || 'fontes');
    }
    setReprocessing(false);
    setTimeout(() => setReprocessStatus(null), failures.length > 0 ? 8000 : 3000);
  };

  const { data: diagnosis } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'meta'),
    queryFn: () => base44.entities.FinancialDiagnosis.get(diagnosisId),
    enabled: !!diagnosisId,
    refetchInterval: (/** @type {any} */ data) =>
    data && ['validating', 'processing'].includes(data.status) ? 4000 : false
  });

  const { data: uploads = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'uploads'),
    queryFn: () => base44.entities.FinancialUpload.filter(
      { financial_diagnosis_id: diagnosisId }, '-created_date', 10
    ),
    enabled: !!diagnosisId
  });

  const journey = useDiagnosisJourney({ diagnosisId, diagnosis });
  useEffect(() => {
    // Sincroniza activeStep com currentStep até o usuário navegar manualmente.
    // Evita travar no step inicial (ex.: 'fontes') antes das queries resolverem,
    // fazendo a etapa Análise (demonstrações/indicadores/kanitz) ficar inacessível.
    if (journey.currentStep && (!activeStep || !stepTouched)) {
      setActiveStep(journey.currentStep);
    }
  }, [journey.currentStep, activeStep, stepTouched]);

  const [missingFromPlan, setMissingFromPlan] = useState([]);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);

  const handleUploaded = async (missingAccounts = [], wasProcessed = false) => {
    await Promise.all([
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'meta') }),
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'uploads') }),
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'validations') }),
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'statements') }),
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'indicators') })]
    );
    // Filtrar apenas contas analíticas (A) — só abrir modal se houver alguma
    const analyticMissing = (missingAccounts || []).filter((a) => a.account_type === 'analitica');
    if (analyticMissing.length > 0) {
      setMissingFromPlan(analyticMissing);
      setShowEnrichmentModal(true);
    }
    // 12: Não forçar análise — refetch journey e usar current_step do backend
    await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'journey-state') });
    /** @type {FinancialJourneyState|undefined} */
    const refreshedJourney = queryClient.getQueryData(financialKey(tenantId, diagnosisId, 'journey-state'));
    if (wasProcessed && refreshedJourney?.can_open_analysis) {
      setActiveStep('analise'); setAnalysisSubTab('statements');
    } else {
      setActiveStep(refreshedJourney?.current_step || 'fontes');
    }
  };

  const handleProcessed = async () => {
    await Promise.all([
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'meta') }),
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'uploads') })]
    );
    // Aguarda o refetch do diagnóstico antes de trocar de aba (garante currentUploadId atualizado)
    await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'meta') });
    // 12: Não forçar análise — refetch journey e usar current_step do backend
    await queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'journey-state') });
    /** @type {FinancialJourneyState|undefined} */
    const refreshedJourney = queryClient.getQueryData(financialKey(tenantId, diagnosisId, 'journey-state'));
    if (refreshedJourney?.can_open_analysis) {
      setActiveStep('analise'); setAnalysisSubTab('statements');
    } else {
      setActiveStep(refreshedJourney?.current_step || 'fontes');
    }
  };

  if (!diagnosis) {
    return (
      <PageContainer variant="wide" className="py-6 space-y-4">
        {/* Skeleton Pipeline Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-pulse">
          <Skeleton className="h-4 w-48" />
          <div className="border-t border-slate-100" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-4 h-4" />
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-4 h-4" />
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>);

  }

  const statusCfg = DIAGNOSIS_STATUS_CONFIG[diagnosis.status] || { label: diagnosis.status, cls: 'bg-slate-100 text-slate-500' };
  const currentUploadId = diagnosis.current_upload_id || uploads[0]?.id || null;

  const canReprocess = !!currentUploadId && !reprocessing &&
  !['processing', 'validating'].includes(diagnosis.status);

  // Após excluir, cair no hub do Grupo (tela nova) em vez do CompanyDetail legado.
  // UnitDetail mantido para diagnósticos de escopo unidade.
  const backUrl = diagnosis.unit_id ?
  createPageUrl(`UnitDetail?id=${diagnosis.unit_id}`) :
  diagnosis.group_id ?
  createPageUrl(`GroupDetail?id=${diagnosis.group_id}&tab=analise-financeira`) :
  diagnosis.company_id ?
  createPageUrl(`CompanyDetail?id=${diagnosis.company_id}`) :
  createPageUrl('Groups');

  const backLabel = diagnosis.unit_id ? 'Unidade' : 'Grupo';

  // Seletor de períodos diretamente controlado pelo usuário
  const effectivePeriodFilter = periodFilter;

  return (
    <PageContainer variant="wide" className="py-6">
      {/* Modal de confirmação de reprocessamento */}
      {showReprocessConfirm &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Reprocessar base financeira?</p>
                <p className="text-xs text-slate-500 mt-0.5">Demonstrações, indicadores e validações serão removidos e reconstruídos a partir do upload atual.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>Use após:</strong> correções de motor, ajustes de classificação ou agrupamento no Excel. O arquivo original não será alterado.
            </div>
            {reprocessError &&
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {reprocessError}
                  </div>
          }
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowReprocessConfirm(false)}>
                      Cancelar
                    </Button>
              <PermissionGuard area="financial">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={handleReprocess}>
                  <RotateCcw className="w-3.5 h-3.5" /> Sim, reprocessar agora
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>
      }

      {showEnrichmentModal && missingFromPlan.length > 0 &&
      <AccountPlanEnrichmentModal
        open={showEnrichmentModal}
        accountPlanId={diagnosis.account_plan_id}
        accountPlanName="Plano de Contas"
        tenantId={diagnosis.tenant_id}
        missingAccounts={missingFromPlan}
        onConfirmed={() => {setShowEnrichmentModal(false);setMissingFromPlan([]);}}
        onDismiss={() => {setShowEnrichmentModal(false);}} />

      }

      <DiagnosisPipelineHeader
        steps={journey.steps}
        activeStep={activeStep}
        onStepClick={async (key) => {
          if (journey.canAccess(key)) {
            setStepTouched(true); setActiveStep(key);
            // 3.3: Persistir last_active_step via backend (não só setActiveStep)
            try {
              await base44.functions.invoke('updateFinancialJourneyPosition', {
                financial_diagnosis_id: diagnosisId,
                step: key,
              });
            } catch (e) {
              console.warn('[journey] erro ao persistir step:', e.message);
            }
          }
        }}
        diagnosis={diagnosis}
        statusCfg={statusCfg}
        backLabel={backLabel}
        onBack={() => navigate(-1)}
        analysisTypeBadge={ANALYSIS_TYPE_CONFIG[diagnosis.analysis_type] || ANALYSIS_TYPE_CONFIG.individual}
        onReprocessar={() => setShowReprocessConfirm(true)}
        reprocessing={reprocessing}
        canReprocessar={canReprocess}
        onArchive={() => archiveDeleteRef.current?.openArchive?.()}
        onDelete={() => archiveDeleteRef.current?.openDelete?.()}
        isArchived={!!diagnosis.is_archived}
        integrity={journey.integrity}
        nextMovementLabel={(() => {
          const cs = journey.currentStep;
          const csStep = journey.steps?.find((s) => s.key === cs);
          if (csStep?.status === 'done') return 'Abrir demonstrações';
          const labels = {
            estrutura: 'Completar definição',
            fontes: 'Importar período pendente',
            combinacao: 'Preparar combinação',
            conciliacao: 'Revisar conciliação',
            cedula: 'Concluir cédula',
            preparacao: 'Preparar dataset',
            validacao: 'Resolver inconsistências',
            analise: 'Abrir demonstrações',
          };
          return labels[cs] || null;
        })()}
        onNextMovement={() => {
          const cs = journey.currentStep;
          if (cs && journey.canAccess(cs)) { setStepTouched(true); setActiveStep(cs); }
        }}
      />

      {/* ArchiveDeleteControls oculto — controlado via ref */}
      <div className="hidden">
        <ArchiveDeleteControls
          ref={archiveDeleteRef}
          entityType="financial_diagnosis"
          entityId={diagnosis.id}
          entityName={diagnosis.title}
          isArchived={!!diagnosis.is_archived}
          checkDependencies={async () => {
            const ups = await base44.entities.FinancialUpload.filter(
              { financial_diagnosis_id: diagnosis.id }, 'created_date', 1
            );
            const reasons = [];
            if (ups.length > 0) reasons.push(`${ups.length} upload(s) vinculado(s) — serão removidos junto`);
            return { ok: true, reasons };
          }}
          onArchived={() => window.location.reload()}
          onDeleted={() => {window.location.href = backUrl;}} />
      </div>

      {/* Status do reprocessamento */}
      {reprocessStatus &&
      <div className="mb-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            {reprocessStatus.phase === 'done' ?
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" /> :
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {reprocessStatus.phase === 'done' ?
                'Reprocessamento concluído!' :
                reprocessStatus.uploadLabel ?
                `${reprocessStatus.uploadLabel}` :
                'Processando...'}
                </p>
                {reprocessStatus.phase !== 'done' &&
              <span className="text-xs font-bold text-blue-600 shrink-0">
                    {reprocessStatus.percent ?? 0}%
                  </span>
              }
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {reprocessStatus.phase === 'purging' && '🧹 Limpando dados anteriores...'}
                {reprocessStatus.phase === 'building' && '⚙️ Reconstruindo demonstrativos e indicadores...'}
                {reprocessStatus.phase === 'done' && '✅ Demonstrativos e indicadores atualizados com sucesso.'}
              </p>
            </div>
          </div>

          {/* Barra de progresso principal */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
            className="h-2 rounded-full transition-all duration-700 ease-in-out"
            style={{
              width: reprocessStatus.phase === 'done' ? '100%' : `${reprocessStatus.percent ?? 2}%`,
              backgroundColor: reprocessStatus.phase === 'done' ? '#10b981' : '#3b82f6'
            }} />
          
          </div>

          {/* Etapas visuais */}
          {reprocessStatus.total > 1 && reprocessStatus.phase !== 'done' &&
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {Array.from({ length: reprocessStatus.total }, (_, i) => {
            const isDone = i < reprocessStatus.step - 1;
            const isActive = i === reprocessStatus.step - 1;
            return (
              <div key={i} className="flex items-center gap-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${isDone ? 'bg-emerald-500 text-white' : ''}
                      ${isActive ? 'bg-blue-600 text-white' : ''}
                      ${!isDone && !isActive ? 'bg-slate-200 text-slate-400' : ''}`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    {i < reprocessStatus.total - 1 &&
                <div className={`w-4 h-0.5 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                }
                  </div>);

          })}
              <span className="text-[11px] text-slate-400 ml-1">
                {reprocessStatus.step} de {reprocessStatus.total} período(s)
              </span>
            </div>
        }
        </div>
      }

      {/* Workspace da etapa ativa */}
      <AnalysisFinanceiraTab
        diagnosis={diagnosis}
        diagnosisId={diagnosisId}
        uploadId={currentUploadId}
        tenantId={diagnosis.tenant_id}
        uploads={uploads}
        periodFilter={effectivePeriodFilter}
        setPeriodFilter={setPeriodFilter}
        annualCount={annualCount}
        setAnnualCount={setAnnualCount}
        activeStep={activeStep}
        analysisSubTab={analysisSubTab}
        setAnalysisSubTab={setAnalysisSubTab}
        journey={journey}
        onStepChange={setActiveStep}
        onDeleted={() => window.location.href = backUrl}
        onUploaded={handleUploaded}
        onDiagnosisUpdated={() => invalidateFinancialQueries(queryClient, diagnosisId, tenantId)}
        diagnosisStatus={diagnosis.status}
        uploadMeta={(() => {
          const merged = {};
          for (const u of uploads) {
            try {
              const meta = JSON.parse(u.processing_log || '{}');
              Object.assign(merged, meta.period_label_map || {});
            } catch {}
          }
          return { period_label_map: merged };
        })()} />
      

    </PageContainer>);

}