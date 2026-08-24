/**
 * generateFinancialRecommendations
 *
 * Gera FinancialRecommendation + FinancialActionProposal a partir de
 * FinancialFinding com origin="auto_interpretation" e status="open".
 *
 * LIMITAÇÃO DE SCHEMA (reportada, não contornada com campos inventados):
 * FinancialRecommendation NÃO possui finding_id, recommendation_key, status,
 * horizon, origin, source_type, source_ref_id, financial_upload_id ou group_id.
 * Para permitir rastreabilidade e deduplicação por finding_key sem inventar
 * campos fora do schema, usamos o array existente `related_indicator_codes`
 * para guardar uma tag `__fk__:<finding_key>` (além do código do indicador,
 * quando houver). Essa tag é o único mecanismo de rastreabilidade disponível
 * e é o que identifica registros como "automáticos" no modo replace.
 * Horizonte e área sugerida (não existem no schema) são registrados como
 * texto em `expected_impact`.
 *
 * FinancialActionProposal POSSUI financial_recommendation_id — vínculo seguro
 * usado normalmente, sem workaround.
 *
 * NÃO cria ActionTask. NÃO altera frontend. NÃO recalcula indicadores/DFC/Kanitz.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const FK_TAG_PREFIX = '__fk__:';

const PRIORITY_EN_TO_PT = {
  critical: 'critica',
  high: 'alta',
  medium: 'media',
  low: 'baixa',
};

const HORIZON_LABEL = {
  '30d': '30 dias',
  '60d': '60 dias',
  '90d': '90 dias',
};

// ── Mapeamento finding_type -> recomendação mínima (seção 5 do escopo) ──
const RECOMMENDATION_MAP = [
  {
    types: ['liquidez_corrente_baixa'],
    title: 'Revisar capital de giro e obrigações de curto prazo',
    description: 'Recomenda-se revisar a composição do ativo circulante e do passivo circulante, priorizando renegociação de obrigações de curto prazo, aceleração de recebíveis e controle de desembolsos recorrentes.',
    priority: 'high',
    horizon: '30d',
    area: 'Financeiro / Tesouraria',
  },
  {
    types: ['liquidez_seca_critica', 'liquidez_seca_pressao'],
    title: 'Reduzir dependência de estoques para cobertura de curto prazo',
    description: 'Avaliar giro de estoques, aging, liquidez real dos ativos circulantes e necessidade de conversão mais rápida em caixa.',
    priority: 'medium',
    horizon: '60d',
    area: 'Financeiro / Operações',
  },
  {
    types: ['endividamento_elevado', 'alta_participacao_capital_terceiros'],
    title: 'Reavaliar estrutura de capital e dependência de terceiros',
    description: 'Analisar composição da dívida, custo financeiro, vencimentos, garantias e alternativas de alongamento ou recomposição de capital próprio.',
    priority: 'high',
    horizon: '60d',
    area: 'Controladoria / Diretoria Financeira',
  },
  {
    types: ['pl_negativo', 'patrimonio_liquido_negativo', 'kanitz_pl_negativo_cautela', 'kanitz_leitura_prejudicada'],
    title: 'Diagnosticar recomposição patrimonial e solvência',
    description: 'Realizar análise específica do patrimônio líquido negativo, prejuízos acumulados, estrutura do passivo e capacidade de geração de caixa para recomposição de solvência. Atenção: não afirmar insolvência conclusiva — usar linguagem de cautela, especialmente em achados de Kanitz com PL negativo.',
    priority: 'critical',
    horizon: '30d',
    area: 'Diretoria / Controladoria',
  },
  {
    types: ['dfc_ausente_periodos', 'dfc_ausente_sem_comparativo'],
    title: 'Importar períodos comparáveis para geração da DFC',
    description: 'Providenciar balancete comparativo com pelo menos dois períodos no mesmo processamento para permitir a geração da DFC indireta e a leitura de geração/consumo de caixa.',
    priority: 'medium',
    horizon: '30d',
    area: 'Contabilidade / Controladoria',
  },
  {
    types: ['resultado_liquido_negativo'],
    title: 'Analisar causas do prejuízo e plano de reversão',
    description: 'Abrir composição do resultado, margens, despesas financeiras, despesas operacionais e eventos não recorrentes para definir plano de reversão de resultado.',
    priority: 'high',
    horizon: '60d',
    area: 'Controladoria / Diretoria',
  },
  {
    types: ['cobertura_juros_insuficiente'],
    title: 'Revisar capacidade de serviço da dívida',
    description: 'Avaliar geração operacional frente às despesas financeiras, custo médio da dívida, concentração de vencimentos e necessidade de renegociação.',
    priority: 'high',
    horizon: '30d',
    area: 'Financeiro / Diretoria',
  },
  // ── Achados comparativos (finding_scope: period_comparison) ──
  {
    types: ['comparison_liquidez_corrente'],
    title: 'Revisar deterioração da liquidez corrente',
    description: 'Elaborar plano de recomposição de capital de giro, revisar vencimentos de curto prazo, aging de recebíveis, estoques e fluxo de caixa projetado.',
    priority: 'high',
    horizon: '30d',
    area: 'Financeiro / Tesouraria',
  },
  {
    types: ['comparison_liquidez_seca'],
    title: 'Revisar deterioração da liquidez seca',
    description: 'Avaliar giro e qualidade dos estoques, aging de recebíveis e plano de conversão de ativos circulantes em caixa.',
    priority: 'medium',
    horizon: '60d',
    area: 'Financeiro / Operações',
  },
  {
    types: ['comparison_participacao_capital_terceiros'],
    title: 'Reavaliar evolução da dependência de capital de terceiros',
    description: 'Mapear composição do endividamento, custo financeiro, vencimentos, garantias e alternativas de alongamento ou recomposição patrimonial.',
    priority: 'high',
    horizon: '60d',
    area: 'Controladoria / Diretoria Financeira',
  },
  {
    types: ['comparison_patrimonio_liquido'],
    title: 'Definir plano de recomposição patrimonial',
    description: 'Analisar composição do patrimônio líquido, prejuízos acumulados, necessidade de aporte, retenção de resultados, renegociação de passivos e plano de reversão operacional.',
    priority: 'critical',
    horizon: '30d',
    area: 'Diretoria / Controladoria',
  },
  {
    types: ['comparison_resultado_liquido'],
    title: 'Analisar deterioração do resultado líquido entre períodos',
    description: 'Abrir composição do resultado entre os períodos (receitas, custos, despesas operacionais e financeiras) para identificar causas da piora e definir plano de reversão de resultado.',
    priority: 'high',
    horizon: '60d',
    area: 'Controladoria / Diretoria',
  },
  {
    types: ['comparison_cobertura_juros'],
    title: 'Revisar piora da cobertura de juros entre períodos',
    description: 'Avaliar evolução da geração operacional frente às despesas financeiras entre os períodos, identificando causas da piora e necessidade de renegociação da dívida.',
    priority: 'high',
    horizon: '30d',
    area: 'Financeiro / Diretoria',
  },
  {
    types: ['comparison_kanitz_fator_insolvencia'],
    title: 'Aprofundar diagnóstico de solvência e capacidade de continuidade',
    description: 'Executar análise integrada de solvência, endividamento, fluxo de caixa projetado, capacidade de pagamento e plano de recomposição de capital.',
    priority: 'critical',
    horizon: '30d',
    area: 'Diretoria / Controladoria',
  },
];

function findMapping(findingType) {
  return RECOMMENDATION_MAP.find(m => m.types.includes(findingType)) || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { financial_diagnosis_id, financial_upload_id, mode = 'replace' } = body;
    if (!financial_diagnosis_id) {
      return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    // ── Tenant Guard ──
      // SEG-03: Role guard — deny client_viewer from triggering mutations
      const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
      if (!WRITE_ROLES.includes(appRole)) {
        return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
      }

    if ((appRole !== 'hq_admin') && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
    }

    const tenant_id = diagnosis.tenant_id;

    // ── 1. Ler todos os achados automáticos (qualquer status) para mapear finding_key -> status atual ──
    const allAutoQuery = financial_upload_id
      ? { financial_diagnosis_id, financial_upload_id, origin: 'auto_interpretation' }
      : { financial_diagnosis_id, origin: 'auto_interpretation' };
    const allAutoFindings = await base44.asServiceRole.entities.FinancialFinding.filter(allAutoQuery, 'id', 2000);
    const findingStatusByKey = new Map(allAutoFindings.map(f => [f.finding_key, f.status]));

    // Achados a processar nesta execução: apenas os abertos (não ignored/converted/manual)
    const findings = allAutoFindings.filter(f => f.status === 'open');

    // ── 2. Replace seguro: apaga apenas recomendações/propostas automáticas (tag __fk__) CUJO achado
    // de origem ainda está "open" nesta execução — preserva recomendações já convertidas, evitando
    // perda de dados quando o achado correspondente não será reprocessado. ──
    let deletedRecommendations = 0;
    let deletedProposals = 0;
    if (mode === 'replace') {
      const existingRecs = await base44.asServiceRole.entities.FinancialRecommendation.filter(
        { financial_diagnosis_id }, 'id', 2000
      );
      for (const rec of existingRecs) {
        const tags = (rec.related_indicator_codes || []).filter(c => typeof c === 'string' && c.startsWith(FK_TAG_PREFIX));
        if (tags.length === 0) continue; // recomendação manual (sem tag) — nunca apagar
        const fkKey = tags[0].slice(FK_TAG_PREFIX.length);
        const currentStatus = findingStatusByKey.get(fkKey);
        // Apaga apenas se o achado ainda está "open" (será recriado) ou se o achado não existe mais (órfão)
        const shouldDelete = currentStatus === 'open' || currentStatus === undefined;
        if (!shouldDelete) continue;
        const proposals = await base44.asServiceRole.entities.FinancialActionProposal.filter(
          { financial_recommendation_id: rec.id }, 'id', 100
        );
        for (const p of proposals) {
          await base44.asServiceRole.entities.FinancialActionProposal.delete(p.id);
          deletedProposals++;
        }
        await base44.asServiceRole.entities.FinancialRecommendation.delete(rec.id);
        deletedRecommendations++;
      }
    }

    // ── 3. Deduplicação contra recomendações automáticas remanescentes (tag __fk__) ──
    const remainingRecs = await base44.asServiceRole.entities.FinancialRecommendation.filter(
      { financial_diagnosis_id }, 'id', 2000
    );
    const existingFkTags = new Set();
    remainingRecs.forEach(r => {
      (r.related_indicator_codes || []).forEach(c => {
        if (typeof c === 'string' && c.startsWith(FK_TAG_PREFIX)) existingFkTags.add(c);
      });
    });

    // ── 4. Gerar recomendações + propostas ──
    const seenInMemory = new Set();
    const createdSummary = [];
    const skippedNoMapping = [];
    const skippedExisting = [];
    const convertedFindingIds = [];

    for (const finding of findings) {
      const mapping = findMapping(finding.finding_type);
      if (!mapping) {
        skippedNoMapping.push({ finding_key: finding.finding_key, finding_type: finding.finding_type });
        continue;
      }

      const fkTag = `${FK_TAG_PREFIX}${finding.finding_key}`;
      if (seenInMemory.has(fkTag) || existingFkTags.has(fkTag)) {
        skippedExisting.push({ finding_key: finding.finding_key });
        continue;
      }
      seenInMemory.add(fkTag);

      const priorityPt = PRIORITY_EN_TO_PT[mapping.priority] || 'media';
      const horizonLabel = HORIZON_LABEL[mapping.horizon] || mapping.horizon;
      const relatedIndicatorCodes = [finding.financial_indicator, fkTag].filter(Boolean);

      const recommendation = await base44.asServiceRole.entities.FinancialRecommendation.create({
        financial_diagnosis_id,
        tenant_id,
        title: mapping.title,
        diagnostic_thesis: finding.title,
        probable_cause: finding.description || null,
        suggested_action: mapping.description,
        expected_impact: `Horizonte sugerido: ${horizonLabel}. Área sugerida: ${mapping.area}.`,
        priority: priorityPt,
        editable_text: mapping.description,
        related_indicator_codes: relatedIndicatorCodes,
      });

      // ── FinancialActionProposal — vínculo seguro via financial_recommendation_id ──
      const actionTitle = `Executar: ${mapping.title}`;
      const proposal = await base44.asServiceRole.entities.FinancialActionProposal.create({
        financial_diagnosis_id,
        financial_recommendation_id: recommendation.id,
        tenant_id,
        title: actionTitle,
        description: `${mapping.description} (Horizonte sugerido: ${horizonLabel}; Área sugerida: ${mapping.area})`,
        priority: priorityPt,
        status: 'proposed',
      });

      // ── Atualiza status do achado somente após sucesso ──
      await base44.asServiceRole.entities.FinancialFinding.update(finding.id, { status: 'converted_to_recommendation' });
      convertedFindingIds.push(finding.id);

      createdSummary.push({
        finding_key: finding.finding_key,
        recommendation_id: recommendation.id,
        recommendation_title: mapping.title,
        priority: priorityPt,
        horizon: mapping.horizon,
        action_proposal_id: proposal.id,
        action_proposal_title: actionTitle,
      });
    }

    return Response.json({
      success: true,
      mode_requested: mode,
      mode_applied: mode === 'replace' ? 'replace_auto_only' : 'append_with_dedup',
      schema_limitations: [
        'FinancialRecommendation não possui finding_id, recommendation_key, status, horizon, origin, source_type, source_ref_id, financial_upload_id ou group_id.',
        'Rastreabilidade e deduplicação por finding_key implementadas via tag "__fk__:<finding_key>" dentro de related_indicator_codes (único campo array disponível).',
        'Horizonte e área sugerida armazenados como texto em expected_impact, por ausência de campos dedicados.',
      ],
      findings_read: findings.length,
      recommendations_created: createdSummary.length,
      action_proposals_created: createdSummary.length,
      findings_converted: convertedFindingIds.length,
      deleted_recommendations: deletedRecommendations,
      deleted_action_proposals: deletedProposals,
      skipped_no_mapping: skippedNoMapping,
      skipped_existing: skippedExisting,
      created: createdSummary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});