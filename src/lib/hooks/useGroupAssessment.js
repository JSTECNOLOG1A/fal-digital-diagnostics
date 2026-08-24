/**
 * useGroupAssessment — Hook centralizado para busca do assessment principal do grupo.
 * Estratégia dupla: target_type/target_id + group_id. Deduplica e prioriza em 5 níveis.
 * Usado obrigatoriamente em: GroupCockpit, GroupDiagnostic8DTab,
 * GroupReportsCentral, DiagnosticLinkPanelWrapper e qualquer componente
 * que precise do assessment do grupo.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupKey } from '@/lib/query-client';

/** Utilitário de formatação IFME™ — única fonte de verdade */
export const formatIFME = (value) => value != null ? Number(value).toFixed(2) : '—';

/**
 * Seleciona o assessment principal com 5 níveis de prioridade:
 * 1. Publicado + multi_entity_master (diagnóstico FAL consolidado)
 * 2. Publicado + target_type='group' (diagnóstico FAL de grupo)
 * 3. Publicado (qualquer tipo ativo)
 * 4. 100% preenchido (pronto para publicar) — mais recente
 * 5. Em andamento — mais recente pelo updated_date/created_date
 */
function selectMainAssessment(list) {
  const active = list
    .filter(a => a.status !== 'archived')
    .sort((a, b) => {
      const da = new Date(b.updated_date || b.created_date || 0);
      const db = new Date(a.updated_date || a.created_date || 0);
      return da.getTime() - db.getTime();
    });

  return (
    // 1. Publicado consolidado multi-entidade
    active.find(a => a.status === 'published' && a.assessment_mode === 'multi_entity_master') ||
    // 2. Publicado de grupo
    active.find(a => a.status === 'published' && a.target_type === 'group') ||
    // 3. Qualquer publicado
    active.find(a => a.status === 'published') ||
    // 4. 100% preenchido não publicado
    active.find(a => (a.progress_percentage ?? 0) >= 100) ||
    // 5. Qualquer ativo mais recente
    active[0] ||
    null
  );
}

async function fetchAllAssessments(filter) {
  const rows = [];
  let cursor = null;
  while (true) {
    const page = await base44.entities.Assessment.filter(cursor ? { ...filter, id: { $gt: cursor } } : filter, 'id', 500);
    if (!page.length) break;
    rows.push(...page);
    cursor = page.at(-1).id;
    if (page.length < 500) break;
  }
  return rows;
}

export function useGroupAssessment(groupId, tenantId) {
  const { data: byTarget = [], isLoading: l1, error: e1, refetch: r1 } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'assessment-target'),
    queryFn: () => fetchAllAssessments({ target_type: 'group', target_id: groupId, tenant_id: tenantId }),
    enabled: !!groupId && !!tenantId,
  });

  const { data: byGroup = [], isLoading: l2, error: e2, refetch: r2 } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'assessment-group'),
    queryFn: () => fetchAllAssessments({ group_id: groupId, tenant_id: tenantId }),
    enabled: !!groupId && !!tenantId,
  });

  const assessments = Array.from(
    new Map([...byTarget, ...byGroup].map(a => [a.id, a])).values()
  );

  const assessment = selectMainAssessment(assessments);

  return {
    assessment,
    assessments,
    loading: l1 || l2,
    error: e1 || e2,
    refresh: () => { r1(); r2(); },
  };
}