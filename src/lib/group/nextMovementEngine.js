/**
 * nextMovementEngine — Motor de decisão do "Próximo Movimento" do Cockpit do Grupo.
 * Recebe o estado do grupo e retorna a ação mais relevante segundo a hierarquia FAL.
 *
 * Hierarquia de estados (10 cenários):
 *  1. Sem diagnóstico → Iniciar
 *  2. Diagnóstico incompleto → Continuar
 *  3. Diagnóstico 100%, não publicado → Publicar
 *  4. Publicado, sem análise financeira → Vincular Financeiro
 *  5. Publicado + financeiro, sem plano → Criar Plano de Ação
 *  6. Plano com tarefas críticas → Acompanhar Criticamente
 *  7. Plano sem revisões → Registrar Primeira Revisão
 *  8. Tem revisões, sem relatório → Gerar Relatório
 *  9. Tudo em dia → Acompanhar Evolução
 * 10. Fallback: plano ativo sem críticas → Acompanhar
 */

/**
 * @param {Object} ctx
 * @param {Object|null} ctx.assessment      - Assessment principal do grupo
 * @param {Object|null} ctx.falSnap         - FalDiagnosticSnapshot mais recente
 * @param {boolean}     ctx.hasFinancial    - Se há análise financeira ativa
 * @param {Object|null} ctx.plan            - ActionPlan principal
 * @param {number}      ctx.criticalOpen    - Tarefas críticas abertas
 * @param {number}      ctx.openTasks       - Tarefas abertas totais
 * @param {boolean}     ctx.hasReviews      - Se há revisões concluídas
 * @param {boolean}     ctx.hasReport       - Se há relatório gerado
 * @param {Function}    ctx.onGoTo          - Callback para navegar para aba do grupo
 * @param {Function}    ctx.createPageUrl   - Função de criação de URL
 * @returns {{ label?: string, description?: string, actionLabel?: string, destination?: string, severity?: string, onClick?: any, href?: any } | null}
 */
export function computeNextMovement(ctx) {
  const {
    assessment, falSnap, hasFinancial, plan,
    criticalOpen, openTasks, hasReviews, hasReport,
    onGoTo, createPageUrl,
  } = ctx;

  const hasDiag     = !!assessment;
  const isPublished = assessment?.status === 'published';
  const progress    = assessment?.progress_percentage ?? 0;
  const isComplete  = progress >= 100;
  const isActive    = hasDiag && ['draft', 'in_progress', 'scoring', 'review'].includes(assessment.status);
  const hasPlan     = !!plan;

  // 1. Sem diagnóstico — iniciar
  if (!hasDiag) {
    return {
      label: 'Iniciar Diagnóstico 8D',
      description: 'Nenhum diagnóstico FAL iniciado para este grupo.',
      actionLabel: 'Ir para Diagnóstico 8D',
      severity: 'critical',
      onClick: () => onGoTo('diagnostico-8d'),
    };
  }

  // 2. Diagnóstico incompleto — continuar
  if (isActive && !isComplete) {
    return {
      label: 'Continuar Diagnóstico 8D',
      description: `${Math.round(progress)}% preenchido — finalize para publicar e gerar o plano de ação.`,
      actionLabel: 'Continuar questionário',
      severity: 'high',
      href: createPageUrl ? createPageUrl(`AssessmentDetail?id=${assessment.id}`) : `/AssessmentDetail?id=${assessment.id}`,
    };
  }

  // 3. Diagnóstico 100% preenchido, não publicado — publicar
  if (isActive && isComplete) {
    return {
      label: 'Publicar Diagnóstico 8D',
      description: 'Questionário 100% preenchido — publique para liberar o Plano de Ação.',
      actionLabel: 'Ir para publicação',
      severity: 'high',
      href: createPageUrl ? createPageUrl(`AssessmentDetail?id=${assessment.id}`) : `/AssessmentDetail?id=${assessment.id}`,
    };
  }

  // 4. Publicado, sem análise financeira — registrar análise
  if (isPublished && !hasFinancial) {
    return {
      label: 'Vincular Análise Financeira',
      description: 'Diagnóstico publicado. Registre uma análise financeira para consolidar a leitura integrada FAL.',
      actionLabel: 'Ir para Análise Financeira',
      severity: 'medium',
      onClick: () => onGoTo('analise-financeira'),
    };
  }

  // 5. Publicado + financeiro existente, sem plano de ação — criar plano
  if (isPublished && hasFinancial && !hasPlan) {
    return {
      label: 'Criar Plano de Ação',
      description: 'Diagnóstico e análise financeira prontos. Crie o plano de ação para estruturar a execução.',
      actionLabel: 'Ir para Plano de Ação',
      severity: 'medium',
      onClick: () => onGoTo('plano-acao'),
    };
  }

  // 6. Plano com tarefas críticas abertas — acompanhar criticamente
  if (hasPlan && criticalOpen > 0) {
    return {
      label: 'Acompanhar Tarefas Críticas',
      description: `${criticalOpen} tarefa(s) crítica(s) em aberto. Priorize o desbloqueio antes da próxima revisão.`,
      actionLabel: 'Ver plano de ação',
      severity: 'danger',
      onClick: () => onGoTo('plano-acao'),
    };
  }

  // 7. Plano sem revisões — registrar primeira revisão
  if (hasPlan && !hasReviews) {
    return {
      label: 'Registrar Primeira Revisão',
      description: 'Plano de ação ativo sem nenhuma revisão formal registrada.',
      actionLabel: 'Ir para revisão',
      severity: 'medium',
      href: assessment ? `/assessment/${assessment.id}/action-plan` : null,
      onClick: assessment ? null : () => onGoTo('plano-acao'),
    };
  }

  // 8. Tem revisões, sem relatório — gerar relatório
  if (hasPlan && hasReviews && !hasReport) {
    return {
      label: 'Gerar Relatório Executivo',
      description: 'Diagnóstico e plano em andamento — gere o relatório para documentar a evolução.',
      actionLabel: 'Ir para Relatórios',
      severity: 'low',
      onClick: () => onGoTo('relatorios'),
    };
  }

  // 9. Tudo em dia — acompanhar evolução
  if (hasPlan && hasReviews && hasReport) {
    return {
      label: 'Acompanhar Evolução',
      description: 'Grupo em acompanhamento ativo. Continue registrando revisões e atualizando o plano.',
      actionLabel: 'Ver plano de ação',
      severity: 'ok',
      onClick: () => onGoTo('plano-acao'),
    };
  }

  // 10. Plano ativo sem tarefas críticas — acompanhar
  if (hasPlan) {
    return {
      label: 'Acompanhar Plano de Ação',
      description: `${openTasks} tarefa(s) em aberto.`,
      actionLabel: 'Ver plano',
      severity: 'low',
      onClick: () => onGoTo('plano-acao'),
    };
  }

  return null;
}

/** Cor de destaque baseada na severidade */
export const SEVERITY_COLOR = {
  critical: 'var(--fal-danger-text)',
  danger:   'var(--fal-danger-text)',
  high:     'var(--fal-warning-text)',
  medium:   'var(--fal-navy-700)',
  low:      'var(--fal-text-muted)',
  ok:       'var(--fal-success-text)',
};