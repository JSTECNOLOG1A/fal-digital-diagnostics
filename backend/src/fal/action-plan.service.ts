import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { GenerateActionPlanDto, ListActionPlansQueryDto } from './dto/action-plan.dto';

const ENGINE_VERSION = '2.0.1-nest';
const DEFAULT_MAX_TASKS = 20;

/** MethodVersion.code → sourceType exibido no Plano de Ação. Default (sem entrada) é 'fal_diagnostic'. */
const METHOD_SOURCE_TYPE: Record<string, string> = {
  reforma_tributaria_8d: 'tax_reform_diagnostic',
};
const DEFAULT_SCORE_THRESHOLD = 2.5;

/**
 * Catálogo embutido — mesmo conteúdo do BUILTIN_ACTION_LIBRARY do base44
 * original, fallback quando não há entradas no catálogo dinâmico (que ainda
 * não foi migrado — FalActionLibrary é conteúdo do Marco 4).
 */
/**
 * Catálogo builtin — subdimension_key CORRIGIDOS (2026-09) para bater com o
 * banco de perguntas atual (FalQuestion). Antes desta correção, referenciava
 * subdimensões de uma taxonomia antiga que não existe mais (ex.:
 * "previsibilidade_caixa", "governanca_societaria", "ritos_governanca",
 * "processos_controle", "gestao_tributaria") — subdimScoreIndex.get(...)
 * sempre retornava undefined pra essas chaves, então NENHUMA das 27 entradas
 * com subdimension_key definido jamais disparava um candidato, pra nenhum
 * assessment, de nenhum tipo. Descoberto ao investigar por que
 * candidateTasks (estratégico) sempre vinha vazio mesmo com dimensões
 * abaixo do threshold. Onde não havia subdimensão real equivalente
 * específica o bastante, subdimension_key foi deixado null (cai no
 * gatilho de nível de dimensão em vez de forçar um match impreciso).
 */
const BUILTIN_ACTION_LIBRARY = [
  { action_key: 'fin_dre_implantar', title: 'Implantar DRE mensal simplificado', description: 'Criar planilha de receitas x despesas por atividade. Separar por centro de custo.', dimension_key: 'financeiro', subdimension_key: 'acompanhamento_resultados', cluster_key: null, impact_score: 5, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 1.8, typical_owner: 'CFO / Controladoria', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'fin_cashflow_projecao', title: 'Mapear sazonalidade e projeção de caixa 6 meses', description: 'Identificar meses críticos. Projetar entradas e saídas para os próximos 6 meses.', dimension_key: 'financeiro', subdimension_key: 'gestao_caixa', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'CFO', dependency_action_keys: ['fin_dre_implantar'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'fin_dre_erp', title: 'Integrar DRE ao sistema ERP', description: 'Automatizar extração mensal sem planilhas manuais.', dimension_key: 'financeiro', subdimension_key: 'acompanhamento_resultados', cluster_key: null, impact_score: 4, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.5, typical_owner: 'TI / Controladoria', dependency_action_keys: ['fin_dre_implantar'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'fin_reserva_caixa', title: 'Definir limite mínimo de reserva de caixa', description: 'Calcular capital de giro mínimo e criar alerta quando atingir threshold.', dimension_key: 'financeiro', subdimension_key: 'gestao_caixa', cluster_key: null, impact_score: 4, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'CFO', dependency_action_keys: ['fin_cashflow_projecao'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_organograma', title: 'Elaborar organograma formal da família/sócios', description: 'Documentar participações e papéis de cada sócio/familiar na operação.', dimension_key: 'governanca', subdimension_key: 'estrutura_governanca', cluster_key: null, impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_acordo_socios', title: 'Iniciar processo de acordo de sócios', description: 'Reunião com advogado para estruturar documento de governança familiar/societária.', dimension_key: 'governanca', subdimension_key: 'estrutura_governanca', cluster_key: null, impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 1.8, typical_owner: 'Sócios / Jurídico', dependency_action_keys: ['gov_organograma'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_raci', title: 'Definir processo decisório formal (RACI)', description: 'Criar matriz RACI para decisões operacionais e estratégicas.', dimension_key: 'governanca', subdimension_key: 'processo_decisorio', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_reuniao_mensal', title: 'Implantar reunião mensal de resultados', description: 'Agenda fixa: DRE, metas, próximos passos. Máximo 2h.', dimension_key: 'governanca', subdimension_key: 'transparencia', cluster_key: null, impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_ata', title: 'Criar ata estruturada de decisões', description: 'Template simples: decisão, responsável, prazo.', dimension_key: 'governanca', subdimension_key: 'processo_decisorio', cluster_key: null, impact_score: 3, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Secretaria / Direção', dependency_action_keys: ['gov_reuniao_mensal'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_planejamento_estrategico', title: 'Realizar workshop de planejamento estratégico', description: 'Facilitado pelo consultor. Outputs: missão, visão, 3 objetivos para 2 anos.', dimension_key: 'financeiro', subdimension_key: 'planejamento_estrategico', cluster_key: null, impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: ['gov_reuniao_mensal'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_kpis', title: 'Criar painel de indicadores estratégicos (KPIs)', description: 'Máximo 5 KPIs. Revisar mensalmente na reunião de resultados.', dimension_key: 'financeiro', subdimension_key: 'indicadores_financeiros', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.5, typical_owner: 'Direção / Controladoria', dependency_action_keys: ['gov_planejamento_estrategico'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_diagnostico_maturidade', title: 'Diagnóstico de maturidade tecnológica', description: 'Mapear quais operações são manuais x digitalizadas. Priorizar por volume e risco.', dimension_key: 'sistemas', subdimension_key: 'sistemas_gestao', cluster_key: null, impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'TI / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_selecionar_erp', title: 'Selecionar sistema de gestão (ERP)', description: 'Avaliar 3 opções adequadas ao porte: Omie, TOTVS, Senior ou específico do setor.', dimension_key: 'sistemas', subdimension_key: 'sistemas_gestao', cluster_key: null, impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 1.5, typical_owner: 'TI / Direção', dependency_action_keys: ['tec_diagnostico_maturidade'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_modulos_erp', title: 'Avaliar módulos do ERP não utilizados', description: 'Fazer diagnóstico de uso atual vs funcionalidades disponíveis no sistema vigente.', dimension_key: 'sistemas', subdimension_key: 'sistemas_gestao', cluster_key: null, impact_score: 4, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'TI', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_qualidade_dados', title: 'Auditar cadastros mestres', description: 'Identificar duplicados, campos vazios e inconsistências críticas.', dimension_key: 'sistemas', subdimension_key: 'sistemas_gestao', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'TI / Data Owner', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_data_owner', title: 'Definir responsável pela qualidade de dados', description: 'Nomear Data Owner e criar checklist mensal de higiene de dados.', dimension_key: 'sistemas', subdimension_key: 'sistemas_gestao', cluster_key: null, impact_score: 3, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'TI / Direção', dependency_action_keys: ['tec_qualidade_dados'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_calendario_operacional', title: 'Criar calendário operacional anual', description: 'Mapear safras, picos de demanda, manutenções preventivas e temporadas.', dimension_key: 'operacional', subdimension_key: 'planejamento_produtivo', cluster_key: null, impact_score: 5, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'COO / Gerência Operacional', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_planejamento_compras', title: 'Implementar planejamento de compras antecipado', description: 'Definir lead times e pontos de ressuprimento por item crítico.', dimension_key: 'operacional', subdimension_key: 'gestao_insumos', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Compras / COO', dependency_action_keys: ['ops_calendario_operacional'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_organograma', title: 'Criar organograma e descrição de cargos', description: 'Documentar hierarquia, responsabilidades e expectativas de cada função.', dimension_key: 'operacional', subdimension_key: 'gestao_pessoas', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'RH / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_avaliacao_desempenho', title: 'Implantar avaliação de desempenho semestral', description: 'Criar formulário simples com metas e feedback estruturado.', dimension_key: 'operacional', subdimension_key: 'gestao_pessoas', cluster_key: null, impact_score: 4, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.5, typical_owner: 'RH', dependency_action_keys: ['ops_organograma'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ctrl_mapeamento_processos', title: 'Mapear processos críticos', description: 'Documentar fluxos de compras, vendas, financeiro e RH. Identificar controles ausentes.', dimension_key: 'controles_internos', subdimension_key: null, cluster_key: null, impact_score: 5, effort_score: 3, action_type: 'foundational', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Controladoria / COO', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ctrl_segregacao_funcoes', title: 'Implementar segregação de funções', description: 'Separar quem autoriza, executa e registra transações críticas.', dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', cluster_key: null, impact_score: 5, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 1.8, typical_owner: 'Controladoria / Auditoria', dependency_action_keys: ['ctrl_mapeamento_processos'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'jur_contratos_revisao', title: 'Revisar contratos críticos vigentes', description: 'Mapear contratos de fornecedores, clientes e parceiros. Identificar riscos e vencimentos.', dimension_key: 'juridico', subdimension_key: 'contratos_comerciais', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Jurídico', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'jur_compliance_basico', title: 'Implantar checklist de compliance básico', description: 'Criar rotina de verificação de obrigações legais, trabalhistas e regulatórias.', dimension_key: 'juridico', subdimension_key: null, cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Jurídico / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'cont_balancete_mensal', title: 'Implementar balancete mensal tempestivo', description: 'Garantir fechamento contábil até o 10º dia útil do mês seguinte.', dimension_key: 'contabil', subdimension_key: 'demonstracoes_financeiras', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Contabilidade', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'trib_planejamento_tributario', title: 'Realizar planejamento tributário anual', description: 'Avaliar regime tributário ideal e oportunidades de elisão fiscal lícita.', dimension_key: 'tributario', subdimension_key: 'enquadramento_tributario', cluster_key: null, impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.0, typical_owner: 'Tributário / CFO', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'trib_obrigacoes_acessorias', title: 'Auditar obrigações acessórias', description: 'Mapear todas as declarações e obrigações fiscais. Criar calendário fiscal.', dimension_key: 'tributario', subdimension_key: 'obrigacoes_acessorias', cluster_key: null, impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Tributário / Contabilidade', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
];

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function getHorizonDate(horizon: string): Date {
  const days: Record<string, number> = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
  const d = new Date();
  d.setDate(d.getDate() + (days[horizon] || 90));
  return d;
}
function horizonToPhase(horizon: string): 'curto_prazo' | 'medio_prazo' | 'longo_prazo' {
  if (horizon === '30d') return 'curto_prazo';
  if (horizon === '60d' || horizon === '90d') return 'medio_prazo';
  return 'longo_prazo';
}
function calcPriorityScore(impact: number, effort: number, evidenceSeverity = 1): number {
  return safeNum(impact, 3) * Math.max(1, safeNum(evidenceSeverity, 1)) * (6 - safeNum(effort, 3));
}
function scoreToPriority(pScore: number): string {
  if (pScore >= 30) return 'critical';
  if (pScore >= 15) return 'high';
  if (pScore >= 6) return 'medium';
  return 'low';
}
function buildTaskKey(actionKey: string, targetId: string | null, cycleId: string | null): string {
  return `${actionKey}::${targetId || 'notarget'}::${cycleId || 'default'}`;
}
/** Topological sort: dependências primeiro. */
function topoSort<T extends { task_key: string; dependency_task_keys?: string[] }>(tasks: T[]): T[] {
  const byKey = new Map(tasks.map((t) => [t.task_key, t]));
  const visited = new Set<string>();
  const result: T[] = [];
  function visit(t: T) {
    if (visited.has(t.task_key)) return;
    visited.add(t.task_key);
    for (const depKey of t.dependency_task_keys || []) {
      const dep = byKey.get(depKey);
      if (dep) visit(dep);
    }
    result.push(t);
  }
  for (const t of tasks) visit(t);
  return result;
}
function isActiveActionTask(task: { status?: string; operationStatus?: string | null }): boolean {
  return task?.status !== 'cancelled' && (!task?.operationStatus || task.operationStatus === 'active');
}

type CandidateTask = {
  action_key?: string;
  title: string;
  description: string;
  how_to_execute: string | null;
  reason: string | null;
  dimension_key: string;
  subdimension_key: string | null;
  cluster_key: string | null;
  action_type: string;
  typical_owner: string | null;
  impact_score: number;
  effort_score: number;
  priority: string;
  priority_score: number;
  evidence_severity: number;
  evidence_missing: boolean;
  evidence_questions: string[];
  origin_score: number;
  origin_type: string;
  origin_key?: string | null;
  origin_detail: string;
  horizon: string;
  due_date: Date;
  task_key: string;
  action_library_key: string | null;
  dependency_task_keys: string[];
  task_layer: string;
  playbook_key: string | null;
  source_recommendation_id?: string;
  question_action_id?: string;
  frequency?: string;
  expected_evidence?: string | null;
  evaluated_entity_id?: string | null;
  evaluated_entity_type?: string | null;
  evaluated_entity_name?: string | null;
};

@Injectable()
export class ActionPlanService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, query: ListActionPlansQueryDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) => {
      const where: Prisma.ActionPlanWhereInput = isHQ(actor.role) ? {} : { tenantId: actor.tenantId! };
      if (query.assessmentId) where.assessmentId = query.assessmentId;
      if (query.groupId) where.groupId = query.groupId;
      if (query.targetType) where.targetType = query.targetType;
      if (query.targetId) where.targetId = query.targetId;
      return tx.actionPlan.findMany({ where, orderBy: { createdAt: 'desc' } });
    });
  }

  async get(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await tx.actionPlan.findFirst({ where: { id } });
      if (!plan) throw new NotFoundException('ActionPlan not found');
      return plan;
    });
  }

  /**
   * Porta de base44/functions/recalculateActionPlanState. Reconta o estado
   * físico das tarefas e grava no plano — chamado após qualquer mutação de
   * ActionTask (criação, update, geração de plano).
   */
  async recalculate(tx: PrismaClient, planId: string) {
    const tasks = await tx.actionTask.findMany({ where: { planId } });
    const active = tasks.filter(isActiveActionTask);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validWeights = active.every((t) => Number.isFinite(Number(t.priorityScore)) && Number(t.priorityScore) > 0);
    const divisor = validWeights ? active.reduce((sum, t) => sum + Number(t.priorityScore), 0) : active.length;
    const progress = divisor
      ? active.reduce((sum, t) => sum + Number(t.progressPercentage || 0) * (validWeights ? Number(t.priorityScore) : 1), 0) / divisor
      : 0;
    const open = active.filter((t) => t.status !== 'done');
    const due = open.map((t) => t.dueDate).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime());

    const state = {
      totalTasks: active.length,
      doneTasks: active.filter((t) => t.status === 'done').length,
      blockedTasks: active.filter((t) => t.status === 'blocked' || t.isBlocked).length,
      overdueTasks: open.filter((t) => t.dueDate && t.dueDate < today).length,
      criticalOpenTasks: open.filter((t) => t.priority === 'critical').length,
      nextDueDate: due[0] || null,
      overallProgressPercentage: round2(progress),
    };
    return tx.actionPlan.update({ where: { id: planId }, data: state });
  }

  /** Porta de base44/functions/generateActionPlan — ver nota de escopo no schema.prisma. */
  async generate(actor: AuthUser, dto: GenerateActionPlanDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: dto.assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && actor.tenantId && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }
      const tenantId = assessment.tenantId;
      const targetType = assessment.targetType || 'company';
      const targetId = assessment.targetId || null;

      // Diagnósticos que não são o FAL 8D clássico (ex.: Reforma Tributária 8D)
      // reaproveitam este mesmo pipeline de geração — só muda a origem exibida
      // no Plano de Ação e, quando o MethodVersion define um owner padrão por
      // dimensão, o responsável sugerido nas recomendações operacionais (que
      // hoje, no FAL 8D, sempre saem sem responsável sugerido).
      const generationMethodVersion = assessment.methodVersionId
        ? await tx.methodVersion.findUnique({ where: { id: assessment.methodVersionId } })
        : null;
      const candidateSourceType = generationMethodVersion?.code
        ? METHOD_SOURCE_TYPE[generationMethodVersion.code] || 'fal_diagnostic'
        : 'fal_diagnostic';
      const dimensionOwnerDefaults: Record<string, string> = {};
      const methodDimensions = (generationMethodVersion?.payload as any)?.dimensions;
      if (Array.isArray(methodDimensions)) {
        for (const d of methodDimensions) {
          if (d?.key && d?.defaultOwner) dimensionOwnerDefaults[d.key] = d.defaultOwner;
        }
      }
      const effectiveCycleId = dto.cycleId || null;
      const MAX_TASKS = safeNum(dto.maxTasks, DEFAULT_MAX_TASKS);
      const SCORE_THRESHOLD = safeNum(dto.scoreThreshold, DEFAULT_SCORE_THRESHOLD);

      const falSnap = effectiveCycleId
        ? await tx.falDiagnosticSnapshot.findFirst({
            where: { tenantId, assessmentId: dto.assessmentId, cycleId: effectiveCycleId },
            orderBy: { computedAt: 'desc' },
          })
        : await tx.falDiagnosticSnapshot.findFirst({
            where: { tenantId, assessmentId: dto.assessmentId },
            orderBy: { computedAt: 'desc' },
          });
      if (!falSnap) throw new NotFoundException('No FalDiagnosticSnapshot found');

      // ── Killer questions que falharam (só evidencia, não bloqueia) ──
      // respByQuestion agrupa TODAS as respostas por pergunta (não só a
      // última) — um Map simples keyed só por falQuestionId colidiria
      // silenciosamente quando várias entidades (assessment multi_entity_
      // master) respondem a mesma pergunta compartilhada, descartando as
      // respostas de todas menos uma. Ver correção análoga em
      // fal-diagnostic.service.ts (computeDiagnostic).
      const questionSet = (falSnap.questionSet.length ? falSnap.questionSet : assessment.questionSet) || [];
      const responses = await tx.falResponse.findMany({ where: { assessmentId: dto.assessmentId } });
      const respByQuestion = new Map<string, typeof responses>();
      for (const r of responses) {
        if (!respByQuestion.has(r.falQuestionId)) respByQuestion.set(r.falQuestionId, [] as any);
        (respByQuestion.get(r.falQuestionId) as any[]).push(r);
      }
      const scopeRows = await tx.assessmentScope.findMany({ where: { assessmentId: dto.assessmentId } });
      const entityNameById = new Map(scopeRows.map((s) => [s.evaluatedEntityId, s.evaluatedEntityName]));
      const dimScores = (falSnap.dimensionScores as any) || {};
      const activeDimsList = Object.keys(dimScores).filter((k) => dimScores[k]?.active);
      const allQuestions = await tx.falQuestion.findMany({
        where: { dimensionKey: { in: activeDimsList.length ? activeDimsList : ['governanca'] } },
      });
      const killerFailedClusters = new Set<string>();
      for (const q of allQuestions) {
        if (!questionSet.includes(q.id) || !q.isKillerQuestion) continue;
        const resps = respByQuestion.get(q.id) || [];
        if (resps.some((r) => safeNum(r.score) <= 2) && q.clusterKey) killerFailedClusters.add(q.clusterKey);
      }

      // ── Catálogo de ações: builtin como base, FalActionLibrary (Marco 4)
      // sobrepõe por action_key — global primeiro, depois tenant-específico ──
      const [globalActions, tenantActions] = await Promise.all([
        tx.falActionLibrary.findMany({ where: { tenantId: null, isActive: true } }),
        tx.falActionLibrary.findMany({ where: { tenantId, isActive: true } }),
      ]);
      const actionLibraryMap = new Map<string, any>();
      for (const a of BUILTIN_ACTION_LIBRARY) actionLibraryMap.set(a.action_key, a);
      for (const a of [...globalActions, ...tenantActions]) {
        actionLibraryMap.set(a.actionKey, {
          action_key: a.actionKey, title: a.title, description: a.description || '',
          dimension_key: a.dimensionKey, subdimension_key: a.subdimensionKey, cluster_key: a.clusterKey,
          impact_score: a.impactScore ?? 3, effort_score: a.effortScore ?? 3,
          action_type: a.actionType || 'structural', default_horizon: a.defaultHorizon || '90d',
          score_trigger_max: Number(a.scoreTriggerMax), typical_owner: a.typicalOwner,
          dependency_action_keys: a.dependencyActionKeys, level_applicability: a.levelApplicability,
          sector_tags: a.sectorTags, killer_question_trigger: a.killerQuestionTrigger,
        });
      }
      const actionLibrary = [...actionLibraryMap.values()];

      // ── FalRecommendationLibrary — enriquece descrição/horizon por cluster ──
      const recLibraryRows = await tx.falRecommendationLibrary.findMany({ where: { isActive: true } });
      const recommendationsByCluster = new Map<string, typeof recLibraryRows>();
      for (const rec of recLibraryRows) {
        if (!rec.clusterKey) continue;
        if (!recommendationsByCluster.has(rec.clusterKey)) recommendationsByCluster.set(rec.clusterKey, [] as any);
        (recommendationsByCluster.get(rec.clusterKey) as any[]).push(rec);
      }
      for (const [k, list] of recommendationsByCluster.entries()) {
        recommendationsByCluster.set(k, [...list].sort((a: any, b: any) => Number(b.priorityWeight ?? 1) - Number(a.priorityWeight ?? 1)) as any);
      }

      // ── Índices de score por cluster/subdimensão ──
      const clusterScoreIndex = new Map<string, number>();
      const subdimScoreIndex = new Map<string, number>();
      for (const [dimKey, dimData] of Object.entries<any>(dimScores)) {
        if (!dimData.active || dimData.score === null) continue;
        for (const [subKey, subData] of Object.entries<any>(dimData.subdimension_scores || {})) {
          subdimScoreIndex.set(`${dimKey}:${subKey}`, safeNum(subData.score, 0));
          for (const [cluKey, cluData] of Object.entries<any>(subData.cluster_scores || {})) {
            const s = safeNum(typeof cluData === 'number' ? cluData : cluData?.score, 0);
            if (!clusterScoreIndex.has(cluKey) || s < clusterScoreIndex.get(cluKey)!) clusterScoreIndex.set(cluKey, s);
          }
        }
      }

      // ── Identidade do plano (upsert determinístico por plan_key) ──
      const planKey = [dto.assessmentId, targetType, targetId || 'no-target'].join('|');
      const previousPlan = await tx.actionPlan.findUnique({ where: { tenantId_planKey: { tenantId, planKey } } });

      // ── Recomendações aprovadas viram candidatos com prioridade absoluta ──
      const recommendationRows = await tx.actionRecommendation.findMany({
        where: { assessmentId: dto.assessmentId, tenantId },
      });
      const approvedRecs = recommendationRows.filter(
        (r) => r.status === 'approved' || (r.status === 'converted_to_tasks' && r.actionPlanId === previousPlan?.id),
      );

      const generationTriggers: Record<string, number> = { cluster: 0, subdimension: 0, dimension: 0, killer_question: 0, question: 0 };
      const recCandidates: CandidateTask[] = [];
      for (const rec of approvedRecs) {
        const clusterScore = rec.clusterKey ? clusterScoreIndex.get(rec.clusterKey) ?? 0 : 0;
        const pScore = calcPriorityScore(rec.impactScore || 4, rec.effortScore || 3, clusterScore <= 1 ? 3 : 1);
        // rec.horizon/taskLayer/etc só existem pra recomendações nascidas do
        // próprio motor (candidatos estratégicos/operacionais aprovados —
        // ver upsert de sugestões logo abaixo); pra recomendações de outras
        // origens (gerador simples por cluster fraco, ou manuais do
        // consultor) esses campos são null e caem no fallback de sempre.
        const horizon = rec.horizon || (rec.suggestedDeadlineDays
          ? rec.suggestedDeadlineDays <= 30 ? '30d' : rec.suggestedDeadlineDays <= 60 ? '60d' : rec.suggestedDeadlineDays <= 90 ? '90d' : '180d'
          : clusterScore < 1 ? '30d' : clusterScore < 2 ? '60d' : '90d');
        recCandidates.push({
          title: rec.title, description: rec.recommendationText || '', how_to_execute: rec.howToExecute || rec.practicalSteps || null,
          reason: rec.rationale || null, dimension_key: rec.dimensionKey || 'governanca', subdimension_key: rec.subdimensionKey,
          cluster_key: rec.clusterKey, action_type: 'structural', typical_owner: rec.suggestedOwnerArea || null,
          impact_score: rec.impactScore || 4, effort_score: rec.effortScore || 3, priority: scoreToPriority(pScore),
          priority_score: round2(pScore), evidence_severity: rec.evidenceSeverity ?? (clusterScore <= 1 ? 3 : 2),
          evidence_missing: rec.evidenceMissing ?? false, evidence_questions: rec.evidenceQuestions || [],
          origin_score: rec.originScore != null ? Number(rec.originScore) : round2(clusterScore),
          origin_type: rec.originType || 'cluster', origin_key: rec.originKey || null,
          origin_detail: rec.originDetail || `Recomendação aprovada: ${rec.title}`,
          expected_evidence: rec.expectedEvidence || null, frequency: rec.frequency || 'once',
          horizon, due_date: getHorizonDate(horizon),
          task_key: `rec::${rec.id}::${targetId || 'notarget'}::${effectiveCycleId || 'default'}`,
          action_library_key: rec.actionLibraryKey || rec.id, question_action_id: rec.questionActionId || undefined,
          dependency_task_keys: rec.dependencyTaskKeys || [], task_layer: rec.taskLayer || 'strategic', playbook_key: rec.playbookKey || null,
          source_recommendation_id: rec.id,
          evaluated_entity_id: rec.evaluatedEntityId || null, evaluated_entity_type: rec.evaluatedEntityType || null,
          evaluated_entity_name: rec.evaluatedEntityName || null,
        });
        generationTriggers.cluster++;
      }

      // ── Candidatos estratégicos vindos do catálogo (builtin) ──
      const candidateTasks: CandidateTask[] = [];
      for (const action of actionLibrary) {
        if (!action.level_applicability.includes(targetType)) continue;
        const dimData = dimScores[action.dimension_key];
        if (!dimData?.active || dimData.score === null) continue;

        let triggerScore: number | null = null;
        let originType = '';
        let originDetail = '';
        let horizon = action.default_horizon || '90d';

        if (action.cluster_key) {
          const cluScore = clusterScoreIndex.get(action.cluster_key);
          if (cluScore === undefined || cluScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;
          triggerScore = cluScore; originType = 'cluster'; originDetail = `Cluster ${action.cluster_key}: score ${round2(cluScore)}`;
          generationTriggers.cluster++;
        } else if (action.subdimension_key) {
          const subScore = subdimScoreIndex.get(`${action.dimension_key}:${action.subdimension_key}`);
          if (subScore === undefined || subScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;
          triggerScore = subScore; originType = 'subdimension'; originDetail = `Subdimensão ${action.subdimension_key}: score ${round2(subScore)}`;
          generationTriggers.subdimension++;
        } else {
          const dimScore = safeNum(dimData.score, 0);
          if (dimScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;
          triggerScore = dimScore; originType = 'dimension'; originDetail = `Dimensão ${action.dimension_key}: score ${round2(dimScore)}`;
          generationTriggers.dimension++;
        }

        // Killer question trigger override: ação só entra se a cluster teve
        // uma killer question reprovada — sobrepõe a elegibilidade normal.
        if (action.killer_question_trigger) {
          const relevantCluster = action.cluster_key || null;
          if (!relevantCluster || !killerFailedClusters.has(relevantCluster)) continue;
          originType = 'killer_question';
          originDetail = `Killer question falhou no cluster ${relevantCluster}`;
          generationTriggers.killer_question++;
        }

        if (triggerScore < 1.0) horizon = '30d';
        else if (triggerScore < 1.8) horizon = action.default_horizon === '180d' ? '90d' : action.default_horizon;

        const pScore = calcPriorityScore(action.impact_score, action.effort_score, 1);
        const taskKey = buildTaskKey(action.action_key, targetId, effectiveCycleId);
        const dependencyTaskKeys = (action.dependency_action_keys || []).map((ak: string) => buildTaskKey(ak, targetId, effectiveCycleId));

        let recEnrichment: any = {};
        if (action.cluster_key && recommendationsByCluster.has(action.cluster_key)) {
          const gapLevel = triggerScore < 1 ? 0 : triggerScore < 2 ? 1 : 2;
          const recs = recommendationsByCluster.get(action.cluster_key)!;
          const bestRec = (recs as any[]).find((r) => (r.gapLevel ?? 0) === gapLevel) || recs[0];
          if (bestRec) {
            recEnrichment = {
              description: action.description || bestRec.recommendationDescription || '',
              how_to_execute: bestRec.implementationSteps?.length ? bestRec.implementationSteps.join('\n') : null,
              horizon: bestRec.estimatedTimeframe || horizon,
              typical_owner: action.typical_owner || bestRec.typicalOwner || null,
            };
          }
        }

        candidateTasks.push({
          action_key: action.action_key, title: action.title,
          description: recEnrichment.description || action.description || '',
          how_to_execute: recEnrichment.how_to_execute || null, reason: null,
          dimension_key: action.dimension_key, subdimension_key: action.subdimension_key || null,
          cluster_key: action.cluster_key || null, action_type: action.action_type || 'structural',
          typical_owner: recEnrichment.typical_owner || action.typical_owner || null,
          impact_score: safeNum(action.impact_score, 3), effort_score: safeNum(action.effort_score, 3),
          priority: scoreToPriority(pScore), priority_score: round2(pScore), evidence_severity: 1, evidence_missing: true,
          evidence_questions: [], origin_score: round2(triggerScore), origin_type: originType, origin_detail: originDetail,
          horizon: recEnrichment.horizon || horizon, due_date: getHorizonDate(recEnrichment.horizon || horizon),
          task_key: taskKey, action_library_key: action.action_key, dependency_task_keys: dependencyTaskKeys,
          task_layer: 'strategic', playbook_key: action.action_key,
        });
      }

      // ── Tarefas operacionais via FalQuestionActionLibrary (por pergunta) ──
      const operationalCandidates: CandidateTask[] = [];
      const questionActions = await tx.falQuestionActionLibrary.findMany({ where: { isActive: true } });
      const questionActionsMap = new Map<string, typeof questionActions>();
      for (const qa of questionActions) {
        if (!questionActionsMap.has(qa.questionId)) questionActionsMap.set(qa.questionId, [] as any);
        (questionActionsMap.get(qa.questionId) as any[]).push(qa);
      }
      const questionById = new Map(allQuestions.map((q) => [q.id, q]));
      // Itera cada RESPOSTA (não cada pergunta) — numa assessment multi-
      // entidade, a mesma pergunta pode ter uma resposta por entidade, e
      // cada uma merece sua própria tarefa (a fragilidade de "Terminal
      // Amazônia" não é a mesma de "Agro Cangaia" mesmo quando a pergunta
      // é compartilhada).
      for (const resp of responses) {
        const qid = resp.falQuestionId;
        if (!questionSet.includes(qid)) continue;
        const q = questionById.get(qid);
        if (!q) continue;
        const score = safeNum(resp.score, 3);
        const entityName = resp.evaluatedEntityId ? entityNameById.get(resp.evaluatedEntityId) : null;
        const entityTag = resp.evaluatedEntityId ? `::${resp.evaluatedEntityId}` : '';
        const qActions = questionActionsMap.get(q.questionId) || [];
        for (const qa of qActions as any[]) {
          const triggerMax = safeNum(qa.triggerScoreMax, 2);
          if (score > triggerMax) continue;
          const pScore = calcPriorityScore(qa.impactLevel || 3, qa.effortLevel || 3, score <= 1 ? 3 : 1);
          const horizon = score <= 1 ? '30d' : score <= 2 ? '60d' : '90d';
          operationalCandidates.push({
            title: qa.actionTitle, description: qa.actionDescription || '', how_to_execute: qa.howToExecute || null,
            expected_evidence: qa.expectedEvidence || null, frequency: qa.frequency || 'once',
            reason: qa.reasonTemplate ? qa.reasonTemplate.replace('{score}', String(score)) : `Pergunta com score ${score} (≤ ${triggerMax}) indicando fragilidade operacional.`,
            dimension_key: qa.dimensionKey || q.dimensionKey, subdimension_key: qa.subdimensionKey || q.subdimensionKey,
            cluster_key: qa.clusterKey || q.clusterKey, action_type: qa.actionType || 'operational',
            typical_owner: qa.responsibleRole || null, impact_score: qa.impactLevel || 3, effort_score: qa.effortLevel || 3,
            priority: scoreToPriority(pScore), priority_score: round2(pScore), evidence_severity: score <= 1 ? 3 : 2,
            evidence_missing: false, evidence_questions: [q.id], origin_score: score, origin_type: 'question',
            origin_key: q.id, origin_detail: `Pergunta "${q.questionId}" score ${score}`, question_action_id: qa.id,
            task_layer: 'operational', horizon, due_date: getHorizonDate(horizon),
            task_key: `op::${qa.id}::${q.id}${entityTag}::${targetId || 'notarget'}::${effectiveCycleId || 'default'}`,
            action_library_key: qa.id, dependency_task_keys: [], playbook_key: null,
            evaluated_entity_id: resp.evaluatedEntityId || null, evaluated_entity_type: resp.evaluatedEntityType || null,
            evaluated_entity_name: entityName || null,
          });
          generationTriggers.question++;
        }
      }

      // ── Suprime recomendação estratégica de cluster quando já existem
      // recomendações operacionais (por pergunta) para o mesmo cluster — a
      // nota do cluster é derivada da média das perguntas dele, então quase
      // sempre que o cluster dispara, várias perguntas do mesmo cluster
      // também disparam, gerando duas recomendações pra descrever o mesmo
      // achado: uma genérica ("Estruturar rotina de X", template fixo) e
      // várias específicas por pergunta (checklist próprio, escrito nesta
      // sessão). Mantém a recomendação estratégica só quando o cluster está
      // fraco SEM nenhuma pergunta individual ter disparado gatilho — caso
      // raro/borda em que ela é a única sinalização disponível. Gatilhos de
      // subdimensão/dimensão (sem cluster_key) não são afetados por esta
      // regra — cobrem um recorte mais amplo que uma única pergunta.
      const clustersWithOperationalCandidates = new Set(
        operationalCandidates.map((c) => c.cluster_key).filter((k): k is string => !!k),
      );
      const candidateTasksFiltered = candidateTasks.filter(
        (c) => !(c.origin_type === 'cluster' && c.cluster_key && clustersWithOperationalCandidates.has(c.cluster_key)),
      );
      const suppressedStrategicByCluster = candidateTasks.length - candidateTasksFiltered.length;

      // ── Ordenação e seleção ──
      // Só candidatos vindos de RECOMENDAÇÃO JÁ APROVADA viram ActionTask
      // diretamente. Candidatos estratégicos (biblioteca) e operacionais
      // (pergunta) recém-descobertos pelo motor NÃO viram tarefa aqui — eles
      // nascem como ActionRecommendation pendente (status 'suggested') logo
      // abaixo, e só quando o consultor aprovar é que voltam a passar por
      // este mesmo generate() e entram no recCandidates. Decisão tomada com
      // o usuário: nenhuma tarefa deve ser criada automaticamente sem
      // aprovação humana — mesmo princípio já documentado como não-negociável
      // no briefing metodológico do produto.
      recCandidates.sort((a, b) => a.origin_score - b.origin_score || (b.priority_score || 0) - (a.priority_score || 0));
      const selectedStrategic = recCandidates.slice(0, MAX_TASKS);

      const sortedTasks = topoSort(selectedStrategic);
      const selectedTaskKeys = new Set(sortedTasks.map((t) => t.task_key));
      const isBlockedMap = new Map<string, boolean>();
      for (const t of sortedTasks) {
        isBlockedMap.set(t.task_key, (t.dependency_task_keys || []).some((dep) => !selectedTaskKeys.has(dep)));
      }

      const roadmap: Record<string, string[]> = { curto_prazo: [], medio_prazo: [], longo_prazo: [] };
      for (const t of sortedTasks) roadmap[horizonToPhase(t.horizon)].push(t.task_key);

      // ── Sugestões pendentes de aprovação (candidatos novos do motor) ──
      // Upsert por sourceRefId: se já existe uma ActionRecommendation com
      // essa referência (qualquer status — sugerida, aprovada, rejeitada,
      // convertida), a decisão humana já tomada é respeitada e nada é
      // recriado. Só reescreve o conteúdo se ainda estiver 'suggested'
      // (nada decidido ainda), pra refletir score atualizado.
      const existingRecBySourceRef = new Map(
        recommendationRows.filter((r) => r.sourceRefId).map((r) => [r.sourceRefId as string, r]),
      );
      let suggestedCreated = 0;
      let suggestedUpdated = 0;
      let suggestedSkipped = 0;
      for (const cand of [...candidateTasksFiltered, ...operationalCandidates]) {
        const sourceRefId = cand.task_key;
        const existingRec = existingRecBySourceRef.get(sourceRefId);
        const recPayload = {
          dimensionKey: cand.dimension_key, subdimensionKey: cand.subdimension_key, clusterKey: cand.cluster_key,
          questionId: cand.origin_type === 'question' ? cand.origin_key : null,
          evaluatedEntityId: cand.evaluated_entity_id, evaluatedEntityType: cand.evaluated_entity_type,
          evaluatedEntityName: cand.evaluated_entity_name,
          title: cand.title, recommendationText: cand.description, rationale: cand.reason,
          practicalSteps: cand.how_to_execute, evidenceRequired: cand.expected_evidence,
          suggestedOwnerArea: dimensionOwnerDefaults[cand.dimension_key] || undefined,
          priority: cand.priority, impactScore: cand.impact_score, effortScore: cand.effort_score,
          taskLayer: cand.task_layer, horizon: cand.horizon, howToExecute: cand.how_to_execute,
          expectedEvidence: cand.expected_evidence, frequency: cand.frequency || 'once',
          dependencyTaskKeys: cand.dependency_task_keys || [], playbookKey: cand.playbook_key,
          actionLibraryKey: cand.action_library_key, questionActionId: cand.question_action_id || null,
          evidenceSeverity: cand.evidence_severity, evidenceMissing: cand.evidence_missing,
          evidenceQuestions: cand.evidence_questions || [], originScore: cand.origin_score,
          originType: cand.origin_type, originKey: cand.origin_key, originDetail: cand.origin_detail,
        };
        if (!existingRec) {
          await tx.actionRecommendation.create({
            data: {
              tenantId, assessmentId: dto.assessmentId, actionPlanId: null, sourceType: candidateSourceType,
              sourceRefId, status: 'suggested', createdBy: actor.email, ...recPayload,
            } as any,
          });
          suggestedCreated++;
        } else if (existingRec.status === 'suggested') {
          await tx.actionRecommendation.update({ where: { id: existingRec.id }, data: recPayload as any });
          suggestedUpdated++;
        } else {
          suggestedSkipped++;
        }
      }

      const generationSummary = {
        candidates_total: candidateTasks.length + operationalCandidates.length,
        suggestions_created: suggestedCreated, suggestions_updated: suggestedUpdated, suggestions_already_decided: suggestedSkipped,
        tasks_selected: sortedTasks.length,
        strategic_tasks: sortedTasks.filter((t) => t.task_layer !== 'operational').length,
        operational_tasks: sortedTasks.filter((t) => t.task_layer === 'operational').length,
        quick_wins: sortedTasks.filter((t) => t.action_type === 'quick_win').length,
        structural_actions: sortedTasks.filter((t) => t.action_type === 'structural').length,
        foundational_actions: sortedTasks.filter((t) => t.action_type === 'foundational').length,
        dimensions_covered: [...new Set(sortedTasks.map((t) => t.dimension_key))],
        triggers: generationTriggers,
        killer_failed_clusters: [...killerFailedClusters],
      };
      const generationConfig = {
        max_tasks: MAX_TASKS, score_threshold: SCORE_THRESHOLD, engine_version: ENGINE_VERSION,
        killer_questions_checked: killerFailedClusters.size > 0,
        library_source: 'builtin + FalRecommendationLibrary + FalQuestionActionLibrary',
      };

      // ── Upsert do plano (Postgres já garante atomicidade via transação) ──
      const planData = {
        tenantId, assessmentId: dto.assessmentId, groupId: assessment.groupId, companyId: assessment.companyId,
        unitId: assessment.unitId, cycleId: effectiveCycleId, targetType, targetId, planKey,
        diagnosticSnapshotId: falSnap.id, status: 'active', engineVersion: ENGINE_VERSION,
        generationConfig, generationSummary, roadmap, generatedAt: new Date(), generatedBy: actor.email,
        updatedAt: new Date(), updatedBy: actor.email,
      };

      const plan = previousPlan
        ? await tx.actionPlan.update({ where: { id: previousPlan.id }, data: planData })
        : await tx.actionPlan.create({ data: planData as any });

      const operation = await tx.actionPlanGenerationOperation.create({
        data: {
          tenantId, assessmentId: dto.assessmentId, actionPlanId: plan.id,
          operationId: crypto.randomUUID(), status: 'active', generationSummary,
          startedBy: actor.email, completedAt: new Date(),
        },
      });

      // ── Upsert de ActionTasks por task_key ──
      const existingTasks = previousPlan ? await tx.actionTask.findMany({ where: { planId: plan.id } }) : [];
      const existingByKey = new Map(existingTasks.filter((t) => t.taskKey).map((t) => [t.taskKey, t]));
      const dedupStats = { created: 0, updated: 0, preserved: 0, cancelled: 0 };
      const finalTaskKeys = new Set(sortedTasks.map((t) => t.task_key));
      const resultTasks: any[] = [];

      for (const taskDef of sortedTasks) {
        const existing = existingByKey.get(taskDef.task_key);
        const isBlocked = isBlockedMap.get(taskDef.task_key) || false;
        const commonPayload = {
          dimensionKey: taskDef.dimension_key, subdimensionKey: taskDef.subdimension_key, clusterKey: taskDef.cluster_key,
          title: taskDef.title, description: taskDef.description, horizon: taskDef.horizon, priority: taskDef.priority,
          actionType: taskDef.action_type, taskLayer: taskDef.task_layer, typicalOwner: taskDef.typical_owner,
          impactScore: taskDef.impact_score, effortScore: taskDef.effort_score, evidenceSeverity: taskDef.evidence_severity,
          evidenceMissing: taskDef.evidence_missing, priorityScore: taskDef.priority_score, originScore: taskDef.origin_score,
          originType: taskDef.origin_type, originKey: taskDef.origin_key, originDetail: taskDef.origin_detail,
          questionActionId: taskDef.question_action_id, howToExecute: taskDef.how_to_execute,
          expectedEvidence: taskDef.expected_evidence, frequency: taskDef.frequency, reason: taskDef.reason,
          dependencyTaskKeys: taskDef.dependency_task_keys, isBlocked, dueDate: taskDef.due_date,
          evidenceQuestions: taskDef.evidence_questions, playbookKey: taskDef.playbook_key,
          actionLibraryKey: taskDef.action_library_key,
          evaluatedEntityId: taskDef.evaluated_entity_id, evaluatedEntityType: taskDef.evaluated_entity_type,
          evaluatedEntityName: taskDef.evaluated_entity_name,
        };

        if (existing) {
          if (['in_progress', 'done', 'blocked'].includes(existing.status)) {
            const updated = await tx.actionTask.update({
              where: { id: existing.id },
              data: {
                title: commonPayload.title, description: commonPayload.description, howToExecute: commonPayload.howToExecute,
                expectedEvidence: commonPayload.expectedEvidence, frequency: commonPayload.frequency, reason: commonPayload.reason,
                impactScore: commonPayload.impactScore, effortScore: commonPayload.effortScore, priorityScore: commonPayload.priorityScore,
                dependencyTaskKeys: commonPayload.dependencyTaskKeys, isBlocked: commonPayload.isBlocked,
              },
            });
            resultTasks.push(updated);
            dedupStats.preserved++;
          } else {
            const updated = await tx.actionTask.update({ where: { id: existing.id }, data: { ...commonPayload, status: 'todo' } });
            resultTasks.push(updated);
            dedupStats.updated++;
          }
        } else {
          const created = await tx.actionTask.create({
            data: {
              ...commonPayload, tenantId, planId: plan.id, assessmentId: dto.assessmentId, targetType, targetId,
              taskKey: taskDef.task_key, status: 'todo', operationId: operation.operationId, operationStatus: 'active',
            },
          });
          resultTasks.push(created);
          dedupStats.created++;
        }
      }

      for (const old of existingTasks) {
        const isManual = old.isManual || old.taskKey?.startsWith('manual::');
        if (old.taskKey && !finalTaskKeys.has(old.taskKey) && old.status === 'todo' && !isManual) {
          await tx.actionTask.update({ where: { id: old.id }, data: { status: 'cancelled' } });
          dedupStats.cancelled++;
        }
      }

      for (const rec of approvedRecs) {
        const convertedTaskIds = resultTasks.filter((t) => t.taskKey?.startsWith(`rec::${rec.id}::`)).map((t) => t.id);
        await tx.actionRecommendation.update({
          where: { id: rec.id },
          data: { status: 'converted_to_tasks', actionPlanId: plan.id, convertedTaskIds, convertedAt: new Date(), convertedBy: actor.email },
        });
      }

      await tx.actionPlan.update({ where: { id: plan.id }, data: { generationDiffSummary: dedupStats } });
      const recalculated = await this.recalculate(tx, plan.id);

      const staleUpdate = {
        actionPlanStatus: 'done', actionPlanGeneratedAt: new Date(), actionPlanId: plan.id,
        staleFromStep: null, updatedBy: actor.email,
      };
      await tx.assessmentFlowState.upsert({
        where: { assessmentId: dto.assessmentId },
        update: staleUpdate,
        create: { tenantId, assessmentId: dto.assessmentId, ...staleUpdate },
      });

      const activeTasks = resultTasks.filter((t) => isActiveActionTask(t));
      return { ok: true, plan: recalculated, tasks: activeTasks, roadmap, generationSummary, dedupStats, operation };
    });
  }
}
