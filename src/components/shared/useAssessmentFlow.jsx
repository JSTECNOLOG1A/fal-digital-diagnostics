/**
 * useAssessmentFlow
 * =====================================================================
 * Shared hook — single source of truth for all post-diagnostic tabs.
 *
 * Replaces independent queries across FalResultsPanel, FalPriorityPanel,
 * FalIntelligencePanel, ActionPlanEmbed, FalSimulatorPanel, ScoringPanel.
 *
 * Usage:
 *   const flow = useAssessmentFlow(assessmentId);
 *
 *   flow.loading
 *   flow.assessment
 *   flow.flowState
 *   flow.steps.diagnostic   → { status, stale, can_run, message }
 *   flow.steps.priorities
 *   flow.steps.intelligence
 *   flow.steps.action_plan
 *   flow.steps.simulation
 *   flow.steps.report
 *   flow.next_best_step
 *   flow.is_complete
 *   flow.stale_from_step
 *   flow.refetch()
 * =====================================================================
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useAssessmentFlow(assessmentId, options = {}) {
  const queryClient = useQueryClient();
  const { enabled = true, refetchInterval } = options;

  const queryKey = ['assessment-flow', assessmentId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssessmentFlow', { assessment_id: assessmentId });
      return res.data;
    },
    enabled: !!assessmentId && enabled,
    staleTime: 0,   // always re-fetch after invalidation
    refetchInterval,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
    return await refetch();
  };

  return {
    loading: isLoading,
    error: error?.message || null,
    assessment:       data?.assessment || null,
    flowState:        data?.flow_state || null,
    steps:            data?.steps || defaultSteps(),
    next_best_step:   data?.next_best_step || null,
    is_complete:      data?.is_complete || false,
    stale_from_step:  data?.stale_from_step || null,
    response_version: data?.response_version || 0,
    refetch,
    invalidate,
  };
}

function defaultSteps() {
  const keys = ['diagnostic', 'priorities', 'intelligence', 'action_plan', 'simulation', 'report'];
  return Object.fromEntries(keys.map(k => [k, {
    status: 'not_started',
    stale: false,
    can_run: k === 'diagnostic',
    depends_on: null,
    generated_at: null,
    message: null,
  }]));
}