/**
 * useDiagnosisJourney — Hook frontend que consome a fonte canônica backend (F2-JRN-01).
 *
 * A regra de negócio vive em getFinancialJourneyState (backend). O frontend
 * NÃO possui uma segunda regra divergente. Existe apenas um fallback local
 * identificado, que NÃO marca etapas como concluídas e NÃO permite avançar
 * à análise — usado apenas durante indisponibilidade temporária da function.
 *
 * Compatibilidade: mantém o mesmo shape de retorno para os consumers
 * (DiagnosisPipelineHeader, JourneyProgressBar, AnalysisFinanceiraTab).
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';

const STEP_LABELS = {
  estrutura: 'Estrutura', fontes: 'Fontes', combinacao: 'Combinação',
  conciliacao: 'Conciliação', cedula: 'Cédula', preparacao: 'Preparação',
  validacao: 'Validação', analise: 'Análise', consolidacao: 'Consolidação',
};

/**
 * Fallback local — identificado, conservador.
 * NÃO marca etapas como concluídas. NÃO permite avançar à análise.
 * Retorna apenas a etapa atual como 'current' e as demais como 'pending'.
 */
function buildFallback(diagnosis) {
  const analysisType = diagnosis?.analysis_type || 'individual';
  const isMultiEntity = analysisType !== 'individual';
  const stepKeys = isMultiEntity
    ? analysisType === 'consolidated'
      ? ['estrutura', 'fontes', 'conciliacao', 'cedula', 'preparacao', 'validacao', 'analise']
      : ['estrutura', 'fontes', 'conciliacao', 'cedula', 'combinacao', 'validacao', 'analise']
    : ['estrutura', 'fontes', 'validacao', 'analise'];

  const steps = stepKeys.map((key, i) => ({
    key,
    label: STEP_LABELS[key] || key,
    status: i === 0 ? 'current' : 'pending',
    accessible: i === 0,
    completed: false,
    detail: 'fallback — aguardando backend',
    blocking_reasons: [],
  }));

  return {
    steps,
    currentStep: stepKeys[0],
    analysisType,
    isMultiEntity,
    conditions: {},
    canAccess: (key) => steps.find((s) => s.key === key)?.accessible || false,
    raw: { scopeEntities: [], uploads: [], reconciliations: [], entries: [], validations: [], activeRuns: [] },
    integrity: { status: 'unknown', blocking_count: 0, warning_count: 0, blocking_issues: [], warnings: [] },
    isFallback: true,
    canOpenAnalysis: false,
  };
}

export function useDiagnosisJourney({ diagnosisId, diagnosis }) {
  const tenantId = diagnosis?.tenant_id;

  const { data: journeyState, isLoading, isError } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'journey-state'),
    queryFn: async () => {
      const response = await base44.functions.invoke('getFinancialJourneyState', {
        financial_diagnosis_id: diagnosisId,
      });
      return response?.data || response;
    },
    enabled: !!diagnosisId,
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (data?.integrity?.status === 'blocked') return 5000;
      return false;
    },
  });

  // Fallback: function unavailable or error — conservador, não conclui etapas
  if (isError || (!isLoading && !journeyState)) {
    return buildFallback(diagnosis);
  }

  if (isLoading || !journeyState) {
    return buildFallback(diagnosis);
  }

  // ── Map backend response to frontend shape ──
  const analysisType = journeyState.analysis_type || diagnosis?.analysis_type || 'individual';
  const isMultiEntity = analysisType !== 'individual';

  const steps = (journeyState.steps || []).map((s) => ({
    key: s.key,
    label: s.label || STEP_LABELS[s.key] || s.key,
    status: s.status, // done | current | blocked | pending
    accessible: s.accessible,
    completed: s.completed,
    detail: s.detail || '',
    blocking_reasons: s.blocking_reasons || [],
  }));

  const conditions = {};
  for (const s of steps) conditions[s.key] = s.completed;

  // Build raw data for consumers that need it (e.g., conciliacao/cedula tabs)
  // These are fetched separately by the consumers via their own queries,
  // but we expose an empty object for compatibility — the consumers fetch their own data.
  const raw = { scopeEntities: [], uploads: [], reconciliations: [], entries: [], validations: [], activeRuns: [] };

  return {
    steps,
    currentStep: journeyState.current_step || steps[0]?.key,
    lastValidStep: journeyState.last_valid_step,
    analysisType,
    isMultiEntity,
    conditions,
    canAccess: (key) => steps.find((s) => s.key === key)?.accessible || false,
    canOpenAnalysis: journeyState.can_open_analysis || false,
    integrity: journeyState.integrity || { status: 'unknown', blocking_count: 0, warning_count: 0 },
    raw,
    isFallback: false,
  };
}