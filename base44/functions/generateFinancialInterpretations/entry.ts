/**
 * generateFinancialInterpretations
 *
 * Camada de interpretação consultiva automática.
 * NÃO recalcula BP/DRE/DFC/Kanitz — apenas lê dados já persistidos por
 * buildFinancialStatements e gera FinancialFinding.
 *
 * FinancialFinding possui financial_upload_id, finding_key, source_type,
 * source_ref_id, origin, confidence_level, status, finding_scope e
 * comparison_period. mode="replace" apaga apenas achados com
 * origin="auto_interpretation" (nunca achados manuais) e PRESERVA o status
 * (ex: converted_to_recommendation) de achados que já geraram recomendação,
 * usando o finding_key como chave estável.
 *
 * Achados são classificados em três óticas (finding_scope):
 * - period_snapshot: leitura estática de um período (ex: liquidez baixa em 2024)
 * - period_comparison: variação entre dois períodos consecutivos do diagnóstico
 *   inteiro (não depende de financial_upload_id — cruza uploads)
 * - structural_validation: limitação técnica de leitura (DFC ausente, PL
 *   negativo, Kanitz com leitura prejudicada)
 *
 * Se financial_upload_id for informado, apenas period_snapshot e
 * structural_validation daquele upload são gerados — comparação entre
 * períodos depende do diagnóstico completo.
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

const STRUCTURAL_FINDING_TYPES = new Set([
  'dfc_ausente_periodos',
  'pl_negativo',
  'kanitz_pl_negativo_cautela',
  'kanitz_critico',
]);

function scopeForFindingType(findingType) {
  return STRUCTURAL_FINDING_TYPES.has(findingType) ? 'structural_validation' : 'period_snapshot';
}

function inferSourceType(findingType) {
  const t = findingType || '';
  if (t.includes('kanitz')) return 'kanitz';
  if (t.includes('dfc')) return 'dfc';
  if (t.includes('pl_negativo')) return 'financial_validation';
  if (t.includes('liquidez') || t.includes('endividamento') || t.includes('cobertura')) return 'financial_indicator';
  return 'financial_statement';
}

function inferConfidence(findingType, sourceType, plNonPositiveForPeriod) {
  if (findingType === 'kanitz_pl_negativo_cautela' || plNonPositiveForPeriod) return 'low';
  if (sourceType === 'financial_validation') return 'high';
  return 'medium';
}

function getIndicatorCode(indicator) {
  return indicator.indicator_code || indicator.indicator_key || indicator.code || null;
}

function getIndicator(indicators, code, period) {
  return indicators.find(i => getIndicatorCode(i) === code && (!period || i.period === period));
}

function getIndicatorValue(indicators, code, period) {
  const item = getIndicator(indicators, code, period);
  const value = Number(item?.value);
  return Number.isFinite(value) ? value : null;
}

function getStatementValue(statementLines, canonicalKey, period) {
  const line = statementLines.find(l => l.canonical_key === canonicalKey && (!period || l.period === period));
  if (!line) return null;
  const value = Number(line.value ?? line.amount ?? line.balance ?? line.saldo ?? 0);
  return Number.isFinite(value) ? value : null;
}

function isPlNonPositiveForPeriod(validations, period) {
  return validations.some(v => v.code === 'KANITZ_PL_NON_POSITIVE' && (v.message || '').includes(period));
}

// ── Regras de direção para achados comparativos ──
const HIGHER_IS_BETTER = new Set([
  'liquidez_corrente', 'liquidez_seca', 'liquidez_geral', 'cobertura_juros',
  'margem_liquida', 'rentabilidade_patrimonio_liquido', 'resultado_liquido', 'patrimonio_liquido',
]);
const LOWER_IS_BETTER = new Set(['participacao_capital_terceiros', 'endividamento', 'imobilizacao_pl']);

function isDeterioration(code, previousValue, currentValue) {
  if (HIGHER_IS_BETTER.has(code)) return currentValue < previousValue;
  if (LOWER_IS_BETTER.has(code)) return currentValue > previousValue;
  return false;
}

function crossedCriticalBand(code, previousValue, currentValue) {
  switch (code) {
    case 'liquidez_corrente': return previousValue >= 1 && currentValue < 1;
    case 'liquidez_seca': return previousValue >= 0.8 && currentValue < 0.8;
    case 'cobertura_juros': return previousValue >= 1 && currentValue < 1;
    case 'resultado_liquido': return previousValue >= 0 && currentValue < 0;
    case 'patrimonio_liquido': return previousValue >= 0 && currentValue < 0;
    default: return false;
  }
}

const COMPARISON_METRICS = [
  {
    code: 'liquidez_corrente', source: 'indicator',
    title: (p, c) => `Liquidez corrente deteriorou de ${p} para ${c}`,
    description: 'A liquidez corrente apresentou piora entre os períodos, indicando redução da capacidade relativa de cobertura das obrigações de curto prazo.',
  },
  {
    code: 'liquidez_seca', source: 'indicator',
    title: (p, c) => `Liquidez seca deteriorou de ${p} para ${c}`,
    description: 'A liquidez seca apresentou piora entre os períodos, indicando maior pressão sobre a capacidade de pagamento de curto prazo sem depender da realização de estoques.',
  },
  {
    code: 'participacao_capital_terceiros', source: 'indicator',
    title: (p, c) => `Dependência de capital de terceiros aumentou de ${p} para ${c}`,
    description: 'A participação de capital de terceiros aumentou no período comparativo, indicando maior pressão da estrutura de passivos sobre o patrimônio líquido.',
  },
  {
    code: 'patrimonio_liquido', source: 'statement', canonical_key: 'patrimonio_liquido',
    title: (p, c) => `Patrimônio líquido deteriorou de ${p} para ${c}`,
    description: 'O patrimônio líquido ficou mais negativo entre os períodos, reforçando fragilidade patrimonial e necessidade de análise de recomposição de capital.',
  },
  {
    code: 'resultado_liquido', source: 'statement', canonical_key: 'resultado_liquido',
    title: (p, c) => `Resultado líquido deteriorou de ${p} para ${c}`,
    description: 'O resultado líquido apresentou piora entre os períodos, pressionando patrimônio líquido, capacidade de autofinanciamento e indicadores de solvência.',
  },
  {
    code: 'cobertura_juros', source: 'indicator',
    title: (p, c) => `Cobertura de juros deteriorou de ${p} para ${c}`,
    description: 'A cobertura de juros piorou entre os períodos, indicando maior pressão da despesa financeira sobre a geração operacional.',
  },
];

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

    const tenant_id = body.tenant_id || diagnosis.tenant_id;

    // 1. Ler exclusivamente outputs do run apontado pelo snapshot atual.
    const scopeResponse = await base44.functions.invoke('resolveCurrentFinancialOutputScope', { diagnosis_id:financial_diagnosis_id });
    const currentScope = scopeResponse?.data || scopeResponse;
    if (!currentScope?.processing_run_id) return Response.json({ error:currentScope?.error || 'CURRENT_FINANCIAL_SNAPSHOT_REQUIRED' }, { status:409 });
    const qBase = { financial_diagnosis_id, processing_run_id:currentScope.processing_run_id, publication_status:'active' };
    const [allIndicators, allValidations, allStatementLines] = await Promise.all([
      base44.asServiceRole.entities.FinancialIndicatorSnapshot.filter(qBase, 'period', 5000),
      base44.asServiceRole.entities.FinancialValidationResult.filter(qBase, 'id', 500),
      base44.asServiceRole.entities.FinancialStatementLine.filter(qBase, 'period', 5000),
    ]);

    const indicators = financial_upload_id
      ? allIndicators.filter(i => i.financial_upload_id === financial_upload_id)
      : allIndicators;
    const validations = financial_upload_id
      ? allValidations.filter(v => v.financial_upload_id === financial_upload_id)
      : allValidations;

    const periods = [...new Set(indicators.map(i => i.period).filter(Boolean))].sort();

    const groupId = diagnosis.group_id || null;
    const companyId = diagnosis.company_id || null;
    const unitId = diagnosis.unit_id || null;

    // ── Preservar status de achados já existentes (ex: converted_to_recommendation) ──
    // Lido ANTES do delete/recreate para não recriar como "open" o que já virou recomendação.
    const existingAutoFindingsAll = await base44.asServiceRole.entities.FinancialFinding.filter(
      { financial_diagnosis_id, origin: 'auto_interpretation' }, 'id', 2000
    );
    const existingStatusByFindingKey = new Map(
      existingAutoFindingsAll.filter(f => f.finding_key).map(f => [f.finding_key, f.status || 'open'])
    );

    const existingRecommendations = await base44.asServiceRole.entities.FinancialRecommendation.filter(
      { financial_diagnosis_id }, 'id', 2000
    );
    const recommendationFindingKeys = new Set();
    for (const rec of existingRecommendations) {
      for (const tag of rec.related_indicator_codes || []) {
        if (typeof tag === 'string' && tag.startsWith('__fk__:')) {
          recommendationFindingKeys.add(tag.slice('__fk__:'.length));
        }
      }
    }

    const resolveStatus = (findingKey) => {
      if (recommendationFindingKeys.has(findingKey)) return 'converted_to_recommendation';
      return existingStatusByFindingKey.get(findingKey) || 'open';
    };

    const findingsToCreate = [];

    const pushFinding = ({ finding_type, period, title, description, severity, financial_indicator, source_ref_id, confidence_level_override }) => {
      const source_type = inferSourceType(finding_type);
      const confidence_level = confidence_level_override || inferConfidence(finding_type, source_type, false);
      const finding_key = [financial_upload_id || 'diagnosis', period || 'geral', finding_type].join('|');
      findingsToCreate.push({
        tenant_id,
        financial_diagnosis_id,
        group_id: groupId,
        company_id: companyId,
        unit_id: unitId,
        title,
        description,
        severity,
        finding_type,
        financial_indicator: financial_indicator || null,
        period: period || null,
        financial_upload_id: financial_upload_id || null,
        finding_key,
        finding_scope: scopeForFindingType(finding_type),
        source_type,
        source_ref_id: source_ref_id || null,
        origin: 'auto_interpretation',
        confidence_level,
        status: resolveStatus(finding_key),
      });
    };

    // ── Achado estrutural: DFC ausente por falta de comparativo ──
    const dfcRequiresTwoPeriods = validations.find(v => v.code === 'DFC_REQUIRES_TWO_PERIODS');
    if (dfcRequiresTwoPeriods) {
      pushFinding({
        finding_type: 'dfc_ausente_periodos',
        period: null,
        title: 'DFC não gerada por ausência de períodos comparáveis',
        description: 'A demonstração de fluxo de caixa indireta exige pelo menos dois períodos comparáveis. O upload atual possui apenas um período, impedindo a leitura de geração e consumo de caixa.',
        severity: 'low',
        source_ref_id: dfcRequiresTwoPeriods.id || null,
      });
    }

    // ── Achados por período (finding_scope: period_snapshot / structural_validation) ──
    for (const period of periods) {
      const plNonPositiveForPeriod = isPlNonPositiveForPeriod(validations, period);

      const liquidezCorrente = getIndicatorValue(indicators, 'liquidez_corrente', period);
      if (liquidezCorrente !== null && liquidezCorrente < 1) {
        pushFinding({
          finding_type: 'liquidez_corrente_baixa',
          period,
          title: 'Liquidez corrente abaixo de 1,0',
          description: 'A empresa não apresenta ativos circulantes suficientes para cobrir integralmente as obrigações de curto prazo no período analisado.',
          severity: 'medium',
          financial_indicator: 'liquidez_corrente',
          source_ref_id: getIndicator(indicators, 'liquidez_corrente', period)?.id || null,
        });
      }

      const liquidezSeca = getIndicatorValue(indicators, 'liquidez_seca', period);
      if (liquidezSeca !== null && liquidezSeca < 0.8) {
        pushFinding({
          finding_type: 'liquidez_seca_critica',
          period,
          title: 'Liquidez seca pressionada',
          description: 'A capacidade de pagamento de curto prazo sem considerar estoques está pressionada, indicando dependência de realização de estoques ou renegociação de passivos.',
          severity: 'medium',
          financial_indicator: 'liquidez_seca',
          source_ref_id: getIndicator(indicators, 'liquidez_seca', period)?.id || null,
        });
      }

      const pct = getIndicatorValue(indicators, 'participacao_capital_terceiros', period);
      if (pct !== null && pct > 2) {
        const lowConfidenceNote = plNonPositiveForPeriod
          ? ' Atenção: o patrimônio líquido negativo neste período reduz a confiabilidade desta leitura (confiança baixa).'
          : '';
        pushFinding({
          finding_type: 'endividamento_elevado',
          period,
          title: 'Alta participação de capital de terceiros',
          description: `A estrutura patrimonial demonstra elevada dependência de capital de terceiros em relação ao patrimônio líquido.${lowConfidenceNote}`,
          severity: 'high',
          financial_indicator: 'participacao_capital_terceiros',
          source_ref_id: getIndicator(indicators, 'participacao_capital_terceiros', period)?.id || null,
          confidence_level_override: plNonPositiveForPeriod ? 'low' : 'medium',
        });
      }

      if (plNonPositiveForPeriod) {
        pushFinding({
          finding_type: 'pl_negativo',
          period,
          title: 'Patrimônio líquido negativo prejudica leitura de solvência',
          description: 'O patrimônio líquido negativo reduz a confiabilidade da leitura convencional dos indicadores de solvência e exige análise específica da composição do passivo, prejuízos acumulados e capacidade de geração de caixa.',
          severity: 'high',
          source_ref_id: validations.find(v => v.code === 'KANITZ_PL_NON_POSITIVE' && (v.message || '').includes(period))?.id || null,
          confidence_level_override: 'high',
        });
      }

      const kanitzFI = getIndicatorValue(indicators, 'kanitz_fator_insolvencia', period);
      if (kanitzFI !== null) {
        if (plNonPositiveForPeriod) {
          pushFinding({
            finding_type: 'kanitz_pl_negativo_cautela',
            period,
            title: 'Leitura de Kanitz prejudicada por PL negativo',
            description: 'O Fator de Insolvência de Kanitz foi calculado com baixa confiabilidade neste período devido ao patrimônio líquido negativo. O resultado não deve ser interpretado como afirmação conclusiva de insolvência.',
            severity: 'medium',
            financial_indicator: 'kanitz_fator_insolvencia',
            source_ref_id: getIndicator(indicators, 'kanitz_fator_insolvencia', period)?.id || null,
            confidence_level_override: 'low',
          });
        } else if (kanitzFI < -3) {
          pushFinding({
            finding_type: 'kanitz_critico',
            period,
            title: 'Fator de Insolvência de Kanitz em zona crítica',
            description: 'O Fator de Insolvência de Kanitz está em zona crítica (< -3), indicando alto risco de insolvência conforme o modelo Kanitz.',
            severity: 'high',
            financial_indicator: 'kanitz_fator_insolvencia',
            source_ref_id: getIndicator(indicators, 'kanitz_fator_insolvencia', period)?.id || null,
          });
        }
      }

      const resultadoLiquido = getIndicatorValue(indicators, 'resultado_liquido_r', period);
      if (resultadoLiquido !== null && resultadoLiquido < 0) {
        pushFinding({
          finding_type: 'resultado_liquido_negativo',
          period,
          title: 'Resultado líquido negativo',
          description: 'O período apresenta prejuízo contábil, pressionando patrimônio líquido, indicadores de solvência e capacidade de autofinanciamento.',
          severity: 'medium',
          financial_indicator: 'resultado_liquido_r',
          source_ref_id: getIndicator(indicators, 'resultado_liquido_r', period)?.id || null,
        });
      }

      const coberturaJuros = getIndicatorValue(indicators, 'cobertura_juros', period);
      if (coberturaJuros !== null && coberturaJuros < 1) {
        pushFinding({
          finding_type: 'cobertura_juros_insuficiente',
          period,
          title: 'Cobertura de juros insuficiente',
          description: 'A geração operacional não demonstra cobertura adequada das despesas financeiras, indicando pressão sobre a capacidade de serviço da dívida.',
          severity: 'medium',
          financial_indicator: 'cobertura_juros',
          source_ref_id: getIndicator(indicators, 'cobertura_juros', period)?.id || null,
        });
      }
    }

    // ── Achados comparativos (finding_scope: period_comparison) — nível do diagnóstico inteiro ──
    const shouldGenerateComparisons = !financial_upload_id;
    const comparisonPeriods = [...new Set([
      ...allIndicators.map(i => i.period).filter(Boolean),
      ...allStatementLines.map(l => l.period).filter(Boolean),
    ])].sort();

    const pushComparisonFinding = ({ metric_code, previousPeriod, currentPeriod, title, description, severity, source_type, confidence_level_override }) => {
      const finding_key = ['diagnosis', 'comparison', previousPeriod, currentPeriod, metric_code].join('|');
      findingsToCreate.push({
        tenant_id,
        financial_diagnosis_id,
        group_id: groupId,
        company_id: companyId,
        unit_id: unitId,
        title,
        description,
        severity,
        finding_type: `comparison_${metric_code}`,
        financial_indicator: metric_code,
        period: currentPeriod,
        financial_upload_id: null,
        finding_key,
        finding_scope: 'period_comparison',
        comparison_period: previousPeriod,
        source_type,
        source_ref_id: null,
        origin: 'auto_interpretation',
        confidence_level: confidence_level_override || 'medium',
        status: resolveStatus(finding_key),
      });
    };

    if (shouldGenerateComparisons) {
      for (let i = 1; i < comparisonPeriods.length; i++) {
        const previousPeriod = comparisonPeriods[i - 1];
        const currentPeriod = comparisonPeriods[i];

        for (const metric of COMPARISON_METRICS) {
          const previousValue = metric.source === 'statement'
            ? getStatementValue(allStatementLines, metric.canonical_key, previousPeriod)
            : getIndicatorValue(allIndicators, metric.code, previousPeriod);
          const currentValue = metric.source === 'statement'
            ? getStatementValue(allStatementLines, metric.canonical_key, currentPeriod)
            : getIndicatorValue(allIndicators, metric.code, currentPeriod);

          if (previousValue === null || currentValue === null) continue;
          if (!isDeterioration(metric.code, previousValue, currentValue)) continue;

          const absoluteDelta = currentValue - previousValue;
          const relativeDelta = previousValue !== 0 ? absoluteDelta / Math.abs(previousValue) : null;
          const relevant = relativeDelta === null ? true : Math.abs(relativeDelta) >= 0.10;
          const critical = crossedCriticalBand(metric.code, previousValue, currentValue);
          if (!relevant && !critical) continue;

          pushComparisonFinding({
            metric_code: metric.code,
            previousPeriod,
            currentPeriod,
            title: metric.title(previousPeriod, currentPeriod),
            description: metric.description,
            severity: critical ? 'high' : 'medium',
            source_type: metric.source === 'statement' ? 'financial_statement' : 'financial_indicator',
          });
        }

        // ── Kanitz / solvência — tratamento especial quando há limitação de PL negativo ──
        const kanitzPrevious = getIndicatorValue(allIndicators, 'kanitz_fator_insolvencia', previousPeriod);
        const kanitzCurrent = getIndicatorValue(allIndicators, 'kanitz_fator_insolvencia', currentPeriod);
        if (kanitzPrevious !== null && kanitzCurrent !== null) {
          const plIssue = isPlNonPositiveForPeriod(allValidations, previousPeriod) || isPlNonPositiveForPeriod(allValidations, currentPeriod);
          if (plIssue) {
            pushComparisonFinding({
              metric_code: 'kanitz_fator_insolvencia',
              previousPeriod,
              currentPeriod,
              title: `Solvência permaneceu pressionada entre ${previousPeriod} e ${currentPeriod}`,
              description: 'O Fator de Kanitz e a condição de patrimônio líquido negativo indicam manutenção de fragilidade patrimonial relevante, exigindo cautela na leitura convencional do modelo.',
              severity: 'medium',
              source_type: 'financial_indicator',
              confidence_level_override: 'low',
            });
          } else if (kanitzCurrent < kanitzPrevious) {
            const absoluteDelta = kanitzCurrent - kanitzPrevious;
            const relativeDelta = kanitzPrevious !== 0 ? absoluteDelta / Math.abs(kanitzPrevious) : null;
            const relevant = relativeDelta === null ? true : Math.abs(relativeDelta) >= 0.10;
            const critical = crossedCriticalBand('kanitz_fator_insolvencia', kanitzPrevious, kanitzCurrent);
            if (relevant || critical) {
              pushComparisonFinding({
                metric_code: 'kanitz_fator_insolvencia',
                previousPeriod,
                currentPeriod,
                title: `Fator de Insolvência de Kanitz deteriorou de ${previousPeriod} para ${currentPeriod}`,
                description: 'O Fator de Insolvência de Kanitz piorou entre os períodos, indicando aumento do risco de insolvência conforme o modelo Kanitz.',
                severity: critical ? 'high' : 'medium',
                source_type: 'financial_indicator',
              });
            }
          }
        }
      }
    }

    // ── Deduplicação em memória (mesma chave: finding_key) ──
    const seenInMemory = new Set();
    const dedupedFindings = [];
    for (const f of findingsToCreate) {
      if (seenInMemory.has(f.finding_key)) continue;
      seenInMemory.add(f.finding_key);
      dedupedFindings.push(f);
    }

    // ── Replace seguro: apaga apenas achados automáticos (origin=auto_interpretation) ──
    let deletedCount = 0;
    if (mode === 'replace') {
      const deleteQuery = financial_upload_id
        ? { financial_diagnosis_id, financial_upload_id, origin: 'auto_interpretation' }
        : { financial_diagnosis_id, origin: 'auto_interpretation' };
      const toDelete = await base44.asServiceRole.entities.FinancialFinding.filter(deleteQuery, 'id', 2000);
      if (toDelete.length > 0) {
        await base44.asServiceRole.entities.FinancialFinding.deleteMany(deleteQuery);
        deletedCount = toDelete.length;
      }
    }

    // ── Deduplicação contra achados automáticos remanescentes (por finding_key) ──
    const remainingAutoFindings = await base44.asServiceRole.entities.FinancialFinding.filter(
      { financial_diagnosis_id, origin: 'auto_interpretation' }, 'id', 2000
    );
    const existingKeys = new Set(remainingAutoFindings.map(f => f.finding_key).filter(Boolean));

    const toCreate = dedupedFindings.filter(f => !existingKeys.has(f.finding_key));
    const skippedAsExisting = dedupedFindings.length - toCreate.length;

    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.FinancialFinding.bulkCreate(toCreate);
    }

    return Response.json({
      success: true,
      mode_requested: mode,
      mode_applied: mode === 'replace' ? 'replace_auto_only' : 'append_with_dedup',
      deleted_auto_findings: deletedCount,
      created_count: toCreate.length,
      skipped_existing_count: skippedAsExisting,
      periods_analyzed: periods,
      comparisons_generated: shouldGenerateComparisons,
      comparison_periods_considered: comparisonPeriods,
      findings_created: toCreate.map(f => ({
        finding_type: f.finding_type,
        title: f.title,
        severity: f.severity,
        period: f.period,
        comparison_period: f.comparison_period || null,
        financial_indicator: f.financial_indicator,
        finding_key: f.finding_key,
        finding_scope: f.finding_scope,
        source_type: f.source_type,
        confidence_level: f.confidence_level,
        status: f.status,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});