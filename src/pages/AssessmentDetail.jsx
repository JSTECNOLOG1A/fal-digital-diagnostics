import React, { useState, useEffect, useRef } from 'react';
import { tenantKey, assessmentKey, groupKey, invalidateActionPlanQueries } from '@/lib/query-client';
import PageContainer from '@/components/layout/PageContainer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, BarChart3, AlertCircle, ChevronDown, Loader2, Activity, Settings2, Zap, FileText
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import StatusBadge from '@/components/shared/StatusBadge';
import CrossingProgress from '@/components/assessment/CrossingProgress';
import PendenciesModal from '@/components/assessment/PendenciesModal';
import FalDimensionProgress from '@/components/fal/FalDimensionProgress';
import FalResultsPanel from '@/components/fal/FalResultsPanel';
import FalMotorPanel from '@/components/fal/FalMotorPanel';
import ScopeSelector from '@/components/fal/ScopeSelector';
import ArchiveDeleteControls from '@/components/shared/ArchiveDeleteControls';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import FalPriorityPanel from '@/components/fal/FalPriorityPanel';
import FalIntelligencePanel from '@/components/fal/FalIntelligencePanel';
import ActionPlanWorkflow from '@/components/fal/ActionPlanWorkflow';
import PlanSummaryWidget from '@/components/actionplan/PlanSummaryWidget';
import FalSimulatorPanel from '@/components/fal/FalSimulatorPanel';
import FalValueLeversSection from '@/components/fal/FalValueLeversSection';
import FalRadarTab from '@/components/fal/FalRadarTab';
import MfisEmbedded from '@/components/mfis/MfisEmbedded';
import DimensionScopePanel from '@/components/fal/DimensionScopePanel';
import FlowStepGuard from '@/components/shared/FlowStepGuard';
import { useAssessmentFlow } from '@/components/shared/useAssessmentFlow';
import AssessmentWorkflowStepper from '@/components/assessment/AssessmentWorkflowStepper';
import ReportsCenter from '@/components/reports/ReportsCenter';


export default function AssessmentDetail() {
  const params = new URLSearchParams(window.location.search);
  const assessmentId = params.get('id');
  const { user, tenantId, methodVersion, loading: authLoading, isHQ } = useTenant();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Auth guard — redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [authLoading, user]);

  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId),
    queryFn: async () => {
      const a = await base44.entities.Assessment.get(assessmentId);
      // Frontend tenant guard: ensure this assessment belongs to user's tenant (if not HQ)
      if (!perms.isHQ && user?.tenant_id && a.tenant_id !== user.tenant_id) {
        throw new Error('Forbidden');
      }
      return a;
    },
    enabled: !!assessmentId && !!user,
  });

  const { data: client } = useQuery({
    queryKey: tenantKey(tenantId, 'client', assessment?.client_id),
    queryFn: () => base44.entities.Client.get(assessment.client_id),
    enabled: !!assessment?.client_id,
  });

  // ── Unified flow state (replaces all individual snapshot/plan/report queries) ──
  const flow = useAssessmentFlow(assessmentId, { enabled: !!assessmentId && !!user });

  // Legacy aliases for components that still read these directly
  const latestSnapshot = flow.flowState?.snapshot_id ? { id: flow.flowState.snapshot_id } : null;
  const report = flow.flowState?.report_id ? { id: flow.flowState.report_id, pdf_url: flow.flowState?.report_id ? true : null } : null;
  const actionPlan = flow.flowState?.action_plan_id ? { id: flow.flowState.action_plan_id } : null;
  const prioritySnapshot = flow.flowState?.priorities_snapshot_id ? { id: flow.flowState.priorities_snapshot_id } : null;

  // Fetch canonical snapshot — always uses the snapshot_id from flow state, never "latest by assessment"
  const canonicalSnapshotId = flow.flowState?.snapshot_id || null;
  const { data: fullSnapshot } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'snapshot-full', canonicalSnapshotId),
    queryFn: async () => {
      if (canonicalSnapshotId) {
        return base44.entities.FalDiagnosticSnapshot.get(canonicalSnapshotId);
      }
      // Fallback apenas se flow ainda não carregou e o diagnóstico está done
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1);
      return snaps[0] || null;
    },
    enabled: !!assessmentId && flow.steps?.diagnostic?.status === 'done',
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  // Fetch actual report for PDF URL
  const { data: fullReport } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'report-full'),
    queryFn: async () => {
      const reps = await base44.entities.Report.filter({ assessment_id: assessmentId }, '-created_date', 1);
      return reps[0] || null;
    },
    enabled: !!assessmentId,
  });

  // Progresso do questionário (para colorir o stepper)
  const { data: falResponses = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'responses-count'),
    queryFn: async () => {
      const res = await base44.functions.invoke('getFalResponses', { assessment_id: assessmentId });
      return res.data?.responses || [];
    },
    enabled: !!assessmentId,
  });

  // Progresso do MQE (para colorir o stepper)
  const { data: mqeResponses = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'mqe-responses'),
    queryFn: () => base44.entities.MQEResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });
  const { data: mqeQuestions = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'mqe-questions-count', assessment?.method_version_id),
    queryFn: () => base44.entities.MQEQuestion.filter({ method_version_id: assessment.method_version_id }),
    enabled: !!assessment?.method_version_id,
  });

  // questionnaireComplete: todas as perguntas do questionSet foram respondidas
  const questionnaireComplete = React.useMemo(() => {
    const qs = assessment?.question_set || [];
    if (qs.length === 0) return false;
    const answeredIds = new Set(falResponses.map(r => r.fal_question_id));
    return qs.every(id => answeredIds.has(id));
  }, [assessment?.question_set, falResponses]);

  // mqeComplete: usa a mesma lógica do CrossingProgress (sem filtro de setor) para consistência visual
  const mqeComplete = React.useMemo(() => {
    if (mqeQuestions.length === 0) return false;
    if (mqeResponses.length === 0) return false;
    // Agrupa perguntas por crossing_key (sem filtro de setor — igual ao CrossingProgress)
    const qByCrossing = {};
    for (const q of mqeQuestions) {
      if (!q.crossing_key) continue;
      qByCrossing[q.crossing_key] = (qByCrossing[q.crossing_key] || 0) + 1;
    }
    const crossingKeys = Object.keys(qByCrossing);
    if (crossingKeys.length === 0) return false;
    // Agrupa respostas por crossing_key
    const rByCrossing = {};
    for (const r of mqeResponses) {
      if (!r.crossing_key) continue;
      rByCrossing[r.crossing_key] = (rByCrossing[r.crossing_key] || 0) + 1;
    }
    return crossingKeys.every(key => (rByCrossing[key] || 0) >= qByCrossing[key]);
  }, [mqeQuestions, mqeResponses]);

  const [running, setRunning] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [error, setError] = useState(null);
  const [pendencies, setPendencies] = useState(null);
  const [pendenciesOpen, setPendenciesOpen] = useState(false);
  const [buildingSet, setBuildingSet] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [buildWarnings, setBuildWarnings] = useState([]);
  const [orphanWarning, setOrphanWarning] = useState(null);
  // Must be declared here (before any early return) to respect Rules of Hooks
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Multi-entity mode — derived after hooks, before early returns
  const isMultiEntity = assessment?.assessment_mode === 'fal_scoped' || assessment?.assessment_mode === 'multi_entity_master';
  const linkedEntities = assessment?.linked_entities || [];

  const buildQuestionnaireUrl = (dimKey) => {
    let url = `DimensionQuestionnaire?assessment_id=${assessmentId}&dimension_key=${dimKey}`;
    if (isMultiEntity && selectedEntity) {
      url += `&entity_type=${selectedEntity.entity_type}&entity_id=${selectedEntity.entity_id}`;
    }
    return createPageUrl(url);
  };
  // Contador de tentativas automáticas — evita loop infinito
  const buildAttemptsRef = React.useRef(0);
  const MAX_AUTO_BUILD_ATTEMPTS = 1;
  // Hash estável do escopo ativo — detecta mudança de composição mesmo com mesmo tamanho
  const prevScopeHashRef = React.useRef(null);

  // Aba ativa controlada — permite navegação programática pós-análise
  const [activeTab, setActiveTab] = useState('diagnostico');
  const tabContentRef = useRef(null);
  const initialTabSetRef = useRef(false);

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      if (!tabContentRef.current) return;
      // Encontra o scroll container real (o <main> do layout)
      let el = tabContentRef.current;
      let scrollParent = null;
      while (el.parentElement) {
        el = el.parentElement;
        const { overflow, overflowY } = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(overflow + overflowY)) { scrollParent = el; break; }
      }
      if (scrollParent) {
        const offset = tabContentRef.current.getBoundingClientRect().top
          - scrollParent.getBoundingClientRect().top
          + scrollParent.scrollTop
          - 16;
        scrollParent.scrollTo({ top: offset, behavior: 'smooth' });
      } else {
        tabContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  useEffect(() => {
    if (!initialTabSetRef.current && !flow.loading) {
      initialTabSetRef.current = true;
      setActiveTab('diagnostico');
    }
  }, [flow.loading]);

  /**
   * Decide se o question_set é válido.
   * Inválido = null | undefined | array vazio | IDs vazios | todos IDs órfãos (sem FalQuestion real).
   * allQuestions é passado como argumento quando disponível para detecção de IDs órfãos.
   */
  function isQuestionSetValid(qs, knownQuestionIds = null) {
    if (!Array.isArray(qs) || qs.length === 0) return false;
    const nonEmpty = qs.filter(id => typeof id === 'string' && id.trim().length > 0);
    if (nonEmpty.length === 0) return false;
    // Se temos os IDs reais disponíveis, verifica se pelo menos 1 ID é válido (não órfão)
    if (knownQuestionIds && knownQuestionIds.size > 0) {
      const resolvedCount = nonEmpty.filter(id => knownQuestionIds.has(id)).length;
      return resolvedCount > 0;
    }
    return true;
  }

  /**
   * Detecta IDs órfãos no question_set (IDs que não encontram FalQuestion real).
   * Retorna array de IDs órfãos ou [] se allQuestions não estiver disponível ainda.
   */
  function findOrphanIds(qs, knownQuestionIds) {
    if (!Array.isArray(qs) || !knownQuestionIds || knownQuestionIds.size === 0) return [];
    return qs.filter(id => typeof id === 'string' && id.trim().length > 0 && !knownQuestionIds.has(id));
  }

  // Callback do FalDimensionProgress quando detecta IDs órfãos
  const handleOrphanDetected = (orphanIds) => {
    if (orphanIds?.length > 0) {
      setOrphanWarning(`${orphanIds.length} pergunta(s) no questionário não encontradas no banco FAL. O questionário está inconsistente e deve ser regerado.`);
    }
  };

  // Detecta se o erro é 500 (provável redeploy em andamento)
  const isDeployError = (msg) => msg && (msg.includes('500') || msg.includes('status code 500'));

  // Trigger manual de rebuild (botão "Regerar questionário")
  const handleRebuildQuestionSet = async () => {
    setBuildingSet(true);
    setBuildError(null);
    setBuildWarnings([]);
    setOrphanWarning(null);
    try {
      const res = await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId });
      if (res.data?.error) {
        setBuildError(res.data.error);
      } else {
        if (res.data?.empty_dimensions?.length > 0) setBuildWarnings(res.data.empty_dimensions);
        await queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao gerar questionário. Tente novamente.';
      setBuildError(msg);
    } finally {
      setBuildingSet(false);
    }
  };

  // Hash estável do escopo ativo — detecta mudança de composição mesmo sem mudança de tamanho.
  const scopeHash = assessment
    ? [...(assessment.active_dimensions || [])].sort().join('|') + '::' + (assessment.scope_mode || '')
    : null;

  // Ref para evitar rebuild no primeiro mount com question_set já válido
  const initializedRef = React.useRef(false);

  // Auto-build: apenas quando question_set inválido OU escopo realmente mudou após inicialização
  useEffect(() => {
    if (!assessment || buildingSet) return;
    const scopeDefined = assessment.active_dimensions?.length > 0 || assessment.scope_mode;
    if (!scopeDefined) return;

    const questionSetInvalid = !isQuestionSetValid(assessment.question_set);

    // Primeira carga: registra hash e sai se question_set já é válido (evita rebuild desnecessário)
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevScopeHashRef.current = scopeHash;
      if (!questionSetInvalid) return; // Já tem questionário válido, não rebuilda
    }

    const scopeChanged = scopeHash !== prevScopeHashRef.current;

    // Se o escopo mudou, reset de tentativas e prepara rebuild
    if (scopeChanged) {
      prevScopeHashRef.current = scopeHash;
      buildAttemptsRef.current = 0;
      setBuildError(null);
      setBuildWarnings([]);
      setOrphanWarning(null);
    }

    // Não auto-build se já tem um erro de build (502, etc)
    if (buildError) return;
    if (!questionSetInvalid && !scopeChanged) return;
    if (buildAttemptsRef.current >= MAX_AUTO_BUILD_ATTEMPTS) return;

    buildAttemptsRef.current += 1;
    setBuildingSet(true);
    setBuildError(null);
    setBuildWarnings([]);
    setOrphanWarning(null);

    (async () => {
      try {
        const res = await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId });
        if (res.data?.error) {
          setBuildError(res.data.error);
        } else {
          if (res.data?.empty_dimensions?.length > 0) setBuildWarnings(res.data.empty_dimensions);
          await queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
        }
      } catch (err) {
        setBuildError(err?.message || 'Erro ao montar questionário FAL.');
      } finally {
        setBuildingSet(false);
      }
    })();
     
  }, [scopeHash, assessment?.question_set?.length]);

  const handleScopeConfirm = async (scopeData) => {
    await base44.entities.Assessment.update(assessmentId, scopeData);
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
  };

  // Pipeline steps definition — order matters
  const PIPELINE = [
    {
      key: 'diagnostic',
      label: 'Calculando diagnóstico...',
      run: () => base44.functions.invoke('computeFalDiagnostic', { assessment_id: assessmentId }),
    },
    {
      key: 'priorities',
      label: 'Calculando prioridades...',
      run: () => base44.functions.invoke('computeFalPriority', { assessment_id: assessmentId }),
    },
    {
      key: 'intelligence',
      label: 'Gerando diagnóstico inteligente...',
      run: () => base44.functions.invoke('computeClusterIntelligence', { assessment_id: assessmentId }),
    },
  ];

  // Step progress for pipeline UI
  const [pipelineProgress, setPipelineProgress] = useState(/** @type {Record<string, any>} */ ({})); // key → 'pending'|'running'|'done'|'error'

  // PRIMARY ACTION: step-aware, resumable pipeline
  const handleRunFullAnalysis = async (resumeFrom = null) => {
    setRunning(true);
    setError(null);
    setPendencies(null);

    // Determine which steps to run
    const currentSteps = flow.steps || {};
    const stepsToRun = PIPELINE.filter(p => {
      if (resumeFrom) return PIPELINE.indexOf(p) >= PIPELINE.findIndex(s => s.key === resumeFrom);
      const s = currentSteps[p.key];
      return !s || s.status !== 'done' || s.stale;
    });

    // Init progress display
    const initProgress = {};
    PIPELINE.forEach(p => {
      const s = currentSteps[p.key];
      initProgress[p.key] = (s?.status === 'done' && !s?.stale) ? 'done' : 'pending';
    });
    stepsToRun.forEach(p => { initProgress[p.key] = 'pending'; });
    setPipelineProgress(initProgress);

    try {
      for (const pipelineStep of stepsToRun) {
        setAnalysisStep(pipelineStep.label);
        setPipelineProgress(prev => ({ ...prev, [pipelineStep.key]: 'running' }));

        const res = await pipelineStep.run();

        if (res.data?.error) {
          setPipelineProgress(prev => ({ ...prev, [pipelineStep.key]: 'error' }));
          if (res.data?.pendencies) {
            setPendencies(res.data.pendencies);
            setPendenciesOpen(true);
          } else {
            setError(res.data.error);
          }
          // Update flow state to record the error step
          return;
        }

        setPipelineProgress(prev => ({ ...prev, [pipelineStep.key]: 'done' }));
        
        // Invalidate and refetch flow state immediately to sync snapshots before next pipeline step
        queryClient.setQueryData(['assessment-flow', assessmentId], prev => 
          prev ? { ...(/** @type {any} */ (prev)), _refetch_trigger: Date.now() } : prev
        );
        await queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'flow'), type: 'active' });
      }

      // Optional: update group aggregate
      const groupId = assessment?.group_id || (assessment?.target_type === 'group' ? assessment?.target_id : null);
      if (groupId) {
        await base44.functions.invoke('computeGroupAggregate', { group_id: groupId, tenant_id: assessment.tenant_id })
          .catch(() => {}); // best-effort
      }

      // Refresh flow state and supporting queries
      await flow.invalidate();
      // Após invalidar flow, as queries de snapshot usarão os novos IDs canônicos automaticamente
      await Promise.all([
        queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'snapshot-full') }),
        queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'priority-snapshot') }),
        queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'intelligence-snapshot') }),
        queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'report-full') }),
        queryClient.refetchQueries({ queryKey: assessmentKey(tenantId, assessmentId) }),
        queryClient.refetchQueries({ queryKey: groupKey(tenantId, assessment?.group_id, 'agg-snapshot') }),
      ]);

      // Não redireciona automaticamente — usuário permanece onde está
      // O cockpit compacto no topo já exibe o radar atualizado

    } catch (err) {
      setError(err?.message || 'Erro ao gerar diagnóstico completo. Tente novamente.');
    } finally {
      setRunning(false);
      setAnalysisStep('');
    }
  };

  // Secondary: compute FAL diagnostic only
  const handleComputeScores = async () => {
    setRunning(true);
    setAnalysisStep('Calculando scores...');
    setError(null);
    const res = await base44.functions.invoke('computeFalDiagnostic', { assessment_id: assessmentId });
    if (res.data?.error) setError(res.data.error);
    else {
      queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'snapshot') });
      await base44.entities.Assessment.update(assessmentId, { status: 'scoring' });
      queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
    }
    setRunning(false);
    setAnalysisStep('');
  };

  const [publishing, setPublishing] = useState(false);


  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    const res = await base44.functions.invoke('publishFalAssessment', { assessmentId });
    if (res.data?.error) {
      if (res.data?.pendencias) {
        setPendencies(res.data.pendencias);
        setPendenciesOpen(true);
      } else {
        setError(res.data.error);
      }
      setPublishing(false);
      return;
    }
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'report') });
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
    setPublishing(false);
  };

  if (authLoading || !user) return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  if (!assessment) return <div className="p-8 text-center text-slate-400">Carregando assessment...</div>;

  const dimensions = methodVersion?.dimensions || [];
  const crossings = methodVersion?.crossings || [];
  const isConsultant = perms.canWrite;

  return (
    <PageContainer variant="wide" className="py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {assessment?.unit_id ? 'Unidade' : assessment?.company_id ? 'Empresa' : assessment?.group_id ? 'Grupo' : 'Grupos'}
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{assessment.title}</h1>
            <StatusBadge status={assessment.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">{client?.name || '—'}</p>
        </div>

        <PermissionGuard area="diagnosis" fallback={null}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => handleRunFullAnalysis()}
              disabled={running}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
            >
              {running && analysisStep
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {analysisStep}</>
                : <><Zap className="w-4 h-4" /> Gerar diagnóstico completo</>}
            </Button>

            {/* Resume button — shown when last run failed */}
            {!running && flow.steps && Object.values(flow.steps).some(s => s.status === 'error') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRunFullAnalysis(flow.flowState?.last_error_step)}
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Zap className="w-3.5 h-3.5" /> Retomar pipeline
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Avançado <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleComputeScores} disabled={running}>
                  <BarChart3 className="w-4 h-4 mr-2" /> Calcular Scores apenas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={() => navigateToTab('relatorios')}
            >
              <FileText className="w-3.5 h-3.5" /> Relatórios
            </Button>

            {isHQ && (
              <Button
                size="sm"
                variant="outline"
                className={`gap-1.5 ${activeTab === 'configuracoes' ? 'bg-slate-100 border-slate-400 text-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                onClick={() => navigateToTab('configuracoes')}
              >
                <Settings2 className="w-3.5 h-3.5" /> Configurações
              </Button>
            )}
          </div>
        </PermissionGuard>
      </div>

      {error && (
        <div className={`mb-4 p-3 border rounded-lg text-sm flex items-start gap-2 ${isDeployError(error) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {isDeployError(error)
            ? <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin text-amber-500" />
            : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          }
          <div>
            {isDeployError(error) ? (
              <><span className="font-semibold">Sistema em atualização (deploy em andamento). </span><span className="text-xs">Aguarde ~30 segundos e clique em "Retomar pipeline".</span></>
            ) : (
              <span>{error}</span>
            )}
          </div>
        </div>
      )}



      {/* Radar fixo no topo — visível sempre que o snapshot existir */}
      {isConsultant && flow.steps?.diagnostic?.status === 'done' && activeTab !== 'radar' && activeTab !== 'resultados' && (
        <div className="mb-5">
          <FalRadarTab assessment={assessment} compact />
        </div>
      )}

      {/* Tabs: consultores veem tudo, clientes veem versão simplificada */}
      {isConsultant ? (
        <Tabs value={activeTab} onValueChange={navigateToTab} className="space-y-4">

          {/* Workflow Stepper — corredor de fluxo com status integrado */}
          <AssessmentWorkflowStepper
            activeTab={activeTab}
            steps={flow.steps}
            flowState={flow.flowState}
            responseVersion={flow.response_version}
            loading={flow.loading}
            running={running}
            pipelineProgress={pipelineProgress}
            questionnaireComplete={questionnaireComplete}
            mqeComplete={mqeComplete}
            onNavigate={navigateToTab}
            onRun={() => {
              if (flow.flowState?.last_error_step) {
                handleRunFullAnalysis(flow.flowState.last_error_step);
              } else {
                handleRunFullAnalysis();
              }
            }}
            assessment={assessment}
            linkedEntities={linkedEntities}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
            buildQuestionnaireUrl={buildQuestionnaireUrl}
            isMultiEntity={isMultiEntity}
            hasValidQuestionSet={isQuestionSetValid(assessment.question_set) && !buildingSet && !buildError}
            crossings={crossings}
          />

          {/* Scroll anchor — rola até aqui ao navegar entre abas */}
          <div ref={tabContentRef} style={{ scrollMarginTop: '16px' }} />

          <TabsContent value="diagnostico">
            {!assessment.scope_mode && !assessment.active_dimensions?.length ? (
              <ScopeSelector assessment={assessment} onConfirm={handleScopeConfirm} />
            ) : (
              <>
                {buildingSet ? (
                  /* Estado 1: Preparando */
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <p className="text-sm font-medium">Preparando questionário FAL...</p>
                    <p className="text-xs text-slate-300">Isso leva alguns segundos.</p>
                  </div>

                ) : buildError ? (
                  /* Estado 2: Erro */
                  <div className={`p-4 border rounded-lg flex items-start gap-3 text-sm ${isDeployError(buildError) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {isDeployError(buildError)
                      ? <Loader2 className="w-5 h-5 mt-0.5 flex-shrink-0 animate-spin text-amber-500" />
                      : <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    }
                    <div className="flex-1">
                      {isDeployError(buildError) ? (
                        <>
                          <p className="font-semibold mb-1">Sistema em atualização (deploy em andamento)</p>
                          <p className="text-xs text-amber-700">As funções do servidor estão sendo reimplantadas. Aguarde ~30 segundos e tente novamente.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold mb-1">Não foi possível gerar o questionário.</p>
                          <p className="text-xs opacity-80">{buildError}</p>
                        </>
                      )}
                      <button
                        className={`mt-3 text-xs font-medium underline ${isDeployError(buildError) ? 'text-amber-800 hover:text-amber-900' : 'text-red-700 hover:text-red-900'}`}
                        onClick={handleRebuildQuestionSet}
                      >
                        Tentar novamente
                      </button>
                    </div>
                  </div>

                ) : !isQuestionSetValid(assessment.question_set) ? (
                  /* Estado 3: Questionário não gerado (esgotou tentativas automáticas) */
                  <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 mb-1">Questionário ainda não foi gerado.</p>
                      <p className="text-xs text-amber-700">
                        O escopo está definido, mas nenhuma pergunta foi selecionada. Isso pode ocorrer se o banco de perguntas ainda não foi populado para este perfil de alvo.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-2 border-amber-400 text-amber-800 hover:bg-amber-100"
                        onClick={handleRebuildQuestionSet}
                        disabled={buildingSet}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Regerar questionário
                      </Button>
                    </div>
                  </div>

                ) : (
                  /* Estado 4 / 5: Questionário carregado (com ou sem warnings) */
                  <>
                    {buildWarnings.length > 0 && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          Dimensões sem perguntas elegíveis: <strong>{buildWarnings.join(', ')}</strong>. Verifique os critérios de aplicabilidade do banco FAL.
                        </span>
                      </div>
                    )}
                    {orphanWarning && (
                      <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2 text-xs text-orange-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
                        <div className="flex-1">
                          <span>{orphanWarning}</span>
                          <button
                            className="ml-2 font-medium underline hover:text-orange-900"
                            onClick={handleRebuildQuestionSet}
                            disabled={buildingSet}
                          >
                            Regerar agora
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Multi-entity: subfluxo renderizado no stepper (Fase 01). Single-entity: dimensões direto aqui */}
                    {!isMultiEntity && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">{assessment.question_set?.length} perguntas no questionário</span>
                          <button
                            className="text-xs text-slate-400 hover:text-blue-600 underline"
                            onClick={handleRebuildQuestionSet}
                            disabled={buildingSet}
                          >
                            Regerar questionário
                          </button>
                        </div>
                        <FalDimensionProgress
                          assessmentId={assessmentId}
                          questionSet={assessment.question_set || []}
                          activeDimensions={assessment.active_dimensions}
                          scopeLocked={assessment.scope_locked}
                          onOrphanDetected={handleOrphanDetected}
                        />
                      </>
                    )}
                    {isMultiEntity && (
                      <p className="text-xs text-slate-400 italic">Selecione uma entidade no painel acima para iniciar o questionário.</p>
                    )}
                  </>
                )}

              </>
            )}
          </TabsContent>

          <TabsContent value="radar">
            <>
              <FalRadarTab assessment={assessment} />
              {flow.steps?.diagnostic?.status === 'done' && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => navigateToTab('resultados')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    Ver IFME™ Completo <BarChart3 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          </TabsContent>

          <TabsContent value="resultados">
            <FlowStepGuard step={flow.steps?.diagnostic} stepKey="diagnostic" onRun={() => handleRunFullAnalysis()} running={running && analysisStep.includes('diagnós')}>
              <>
                <FalResultsPanel assessment={assessment} />
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => navigateToTab('prioridades')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    Analisar Prioridades <AlertCircle className="w-4 h-4" />
                  </Button>
                </div>
              </>
            </FlowStepGuard>
          </TabsContent>

          <TabsContent value="prioridades">
            <FlowStepGuard step={flow.steps?.priorities} stepKey="priorities" onRun={() => handleRunFullAnalysis()} running={running && analysisStep.includes('prioridade')}>
              <>
                <FalPriorityPanel assessmentId={assessmentId} snapshotId={flow.flowState?.priorities_snapshot_id} />
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => navigateToTab('inteligencia')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    Ver Diagnóstico Inteligente <Activity className="w-4 h-4" />
                  </Button>
                </div>
              </>
            </FlowStepGuard>
          </TabsContent>

          <TabsContent value="plano-acao">
            <FlowStepGuard step={flow.steps?.intelligence} stepKey="intelligence" onRun={() => handleRunFullAnalysis()} running={running && analysisStep.includes('inteligente')}>
              <ActionPlanWorkflow
                assessmentId={assessmentId}
                snapshotDone={flow.steps?.diagnostic?.status === 'done'}
              />
            </FlowStepGuard>
          </TabsContent>

          <TabsContent value="inteligencia">
            <FlowStepGuard step={flow.steps?.intelligence} stepKey="intelligence" onRun={() => handleRunFullAnalysis()} running={running && analysisStep.includes('inteligente')}>
              <>
                <FalIntelligencePanel
                  assessmentId={assessmentId}
                  snapshot={fullSnapshot}
                  prioritiesStatus={flow.steps?.priorities?.status}
                  intelligenceSnapshotId={flow.flowState?.intelligence_snapshot_id}
                />
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => navigateToTab('plano-acao')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    Gerar Plano de Ação <Zap className="w-4 h-4" />
                  </Button>
                </div>
              </>
            </FlowStepGuard>
          </TabsContent>

          <TabsContent value="simulacao">
            <FlowStepGuard step={flow.steps?.simulation} stepKey="simulation" onRun={() => handleRunFullAnalysis()} running={running && analysisStep.includes('simulaç')}>
              <FalSimulatorPanel assessmentId={assessmentId} snapshot={fullSnapshot} />
            </FlowStepGuard>
          </TabsContent>

          <TabsContent value="alavancas">
            <FalValueLeversSection snapshot={fullSnapshot} />
          </TabsContent>

          {isHQ && (
            <TabsContent value="configuracoes">
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4" /> Escopo do Diagnóstico</h3>
                  <DimensionScopePanel
                    entityId={assessment.group_id || assessment.company_id || assessment.unit_id || assessment.target_id}
                    entityType={assessment.target_type}
                    tenantId={assessment.tenant_id}
                    assessmentActiveDimensions={assessment.active_dimensions}
                    onScopeChanged={async () => {
                      await queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
                      // Rebuildamos o questionário para aplicar os overrides manuais imediatamente
                      buildAttemptsRef.current = 0;
                      await handleRebuildQuestionSet();
                    }}
                  />
                </div>
                <FalMotorPanel assessment={assessment} />
                <div className="border-t pt-6">
                  <ArchiveDeleteControls
                    entityType="assessment"
                    entityId={assessmentId}
                    entityName={assessment.title}
                    isArchived={assessment.is_archived}
                    checkDependencies={async () => ({ ok: true, reasons: [] })}
                    onArchived={() => {
                      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'assessments') });
                      navigate(createPageUrl('Assessments'));
                    }}
                    onDeleted={() => {
                      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'assessments') });
                      // Volta para a entidade pai (unidade > empresa > grupo > lista de grupos)
                      if (assessment.unit_id) {
                        navigate(createPageUrl(`UnitDetail?id=${assessment.unit_id}`));
                      } else if (assessment.company_id) {
                        navigate(createPageUrl(`CompanyDetail?id=${assessment.company_id}`));
                      } else if (assessment.group_id) {
                        navigate(createPageUrl(`GroupDetail?id=${assessment.group_id}`));
                      } else {
                        navigate(createPageUrl('Groups'));
                      }
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="mqe">
            <CrossingProgress
              assessmentId={assessmentId}
              crossings={crossings}
              methodVersionId={methodVersion?.id}
              tenantId={assessment.tenant_id}
              activeDimensions={assessment.active_dimensions || []}
            />
          </TabsContent>

          <TabsContent value="analise">
            <MfisEmbedded assessmentId={assessmentId} />
          </TabsContent>

          <TabsContent value="relatorios">
            <ReportsCenter
              assessmentId={assessmentId}
              tenantId={assessment.tenant_id}
              snapshot={fullSnapshot}
            />
          </TabsContent>
        </Tabs>
      ) : (
        /* Visão simplificada para clientes */
        <Tabs defaultValue="resultados" className="space-y-4">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="resultados" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> IFME™ — Resultados</TabsTrigger>
            <TabsTrigger value="plano-acao" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Plano de Ação Estratégico</TabsTrigger>
          </TabsList>

          <TabsContent value="resultados">
            {!fullSnapshot ? (
              <div className="text-center py-16 text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Resultados ainda não disponíveis.</p>
              </div>
            ) : (
              <FalResultsPanel assessment={assessment} />
            )}
          </TabsContent>

          <TabsContent value="plano-acao">
            <PlanSummaryWidget
              assessmentId={assessmentId}
              tenantId={assessment.tenant_id}
              onGenerate={async () => {
                await base44.functions.invoke('generateActionPlan', { assessmentId, cycleId: null });
                invalidateActionPlanQueries(queryClient, assessmentId, null, assessment.tenant_id);
              }}
              generating={false}
            />
          </TabsContent>
        </Tabs>
      )}

      <PendenciesModal
        open={pendenciesOpen}
        onClose={() => setPendenciesOpen(false)}
        pendencies={pendencies}
      />
    </PageContainer>
  );
}