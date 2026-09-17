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
import { useTaxReformMethodVersion } from '@/lib/hooks/useTaxReformMethodVersion';

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

/**
 * @param {string} groupId
 * @param {string} tenantId
 * @param {{ methodVersionId?: string|null }=} options Sem essa opção (padrão):
 *   busca o diagnóstico FAL 8D clássico — que pode ter method_version_id nulo
 *   OU apontar pro MethodVersion "FAL" real (isso já acontecia antes de
 *   existir um segundo método; não dá pra distinguir por null-vs-id), então
 *   o padrão exclui especificamente diagnósticos de métodos com banco de
 *   perguntas próprio (ex.: Reforma Tributária 8D) em vez de assumir null.
 *   Passe methodVersionId explícito para escopar a um método específico.
 */
export function useGroupAssessment(groupId, tenantId, options = {}) {
  const hasExplicitScope = Object.prototype.hasOwnProperty.call(options, 'methodVersionId');
  const explicitMethodVersionId = options.methodVersionId ?? null;
  // Só precisa resolver o id da Reforma Tributária quando operando no modo
  // padrão (exclusão) — no modo explícito o filtro já vai direto no id pedido.
  const { methodVersion: taxReformMethodVersion } = useTaxReformMethodVersion();

  const { data: byTarget = [], isLoading: l1, error: e1, refetch: r1 } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'assessment-target', hasExplicitScope ? (explicitMethodVersionId || 'null') : 'default'),
    queryFn: () => fetchAllAssessments({
      target_type: 'group', target_id: groupId, tenant_id: tenantId,
      ...(hasExplicitScope ? { method_version_id: explicitMethodVersionId } : {}),
    }),
    enabled: !!groupId && !!tenantId,
  });

  const { data: byGroup = [], isLoading: l2, error: e2, refetch: r2 } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'assessment-group', hasExplicitScope ? (explicitMethodVersionId || 'null') : 'default'),
    queryFn: () => fetchAllAssessments({
      group_id: groupId, tenant_id: tenantId,
      ...(hasExplicitScope ? { method_version_id: explicitMethodVersionId } : {}),
    }),
    enabled: !!groupId && !!tenantId,
  });

  const merged = Array.from(
    new Map([...byTarget, ...byGroup].map(a => [a.id, a])).values()
  );
  // Modo padrão: exclui diagnósticos de métodos com banco próprio (hoje só a
  // Reforma Tributária 8D) — o resto (method_version_id nulo ou apontando pro
  // MethodVersion "FAL") é o diagnóstico FAL 8D clássico.
  const assessments = hasExplicitScope
    ? merged
    : merged.filter(a => (a.method_version_id || null) !== (taxReformMethodVersion?.id || '__none__'));

  const assessment = selectMainAssessment(assessments);

  return {
    assessment,
    assessments,
    loading: l1 || l2,
    error: e1 || e2,
    refresh: () => { r1(); r2(); },
  };
}