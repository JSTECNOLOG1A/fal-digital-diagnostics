import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { FinancialOutputService } from '../financial/financial-output.service';
import { FinancialNarrativeLlmService } from './financial-narrative-llm.service';
import {
  INDICATOR_GROUP_LABELS,
  INDICATOR_REGISTRY,
  IndicatorGroup,
  KANITZ_COMPONENT_WEIGHTS,
  KANITZ_ZONE_LABELS,
  kanitzZone,
} from './financial-indicator-registry.const';
import {
  formatAnnualPeriodLabel,
  formatCurrencyCompact,
  formatKanitzFi,
  formatPercentagePoints,
  formatValueByKind,
  IndicatorFormatKind,
  relativeVariation,
  statementDateLabel,
} from './financial-report-formatting.util';
import {
  BP_GROUPS,
  BP_RUBRICS,
  BP_SIDE_BY_GROUP,
  BP_TOTALS,
  DFC_DARK_KEYS,
  DFC_HIDE_VALUE_KEYS,
  DFC_LABEL_OVERRIDE,
  DFC_ORDER,
  DFC_TOTAL_KEYS,
  DFC_UNIDENTIFIED_KEY,
  DRE_CALCULATED_AFTER_GROUP,
  DRE_FORMULAS,
  DRE_GROUPS,
  DRE_RUBRICS,
} from './financial-statement-layout.const';

/** Linha "achatada" por canonicalKey — só para materialidade/narrativa, nunca exposta como tabela. */
interface FlatStatementRow {
  canonicalKey: string;
  rubricLabel: string;
  lineType: string;
  values: Record<string, number | null>;
  verticalPercent: number | null;
}

/** Linha como efetivamente plotada na tabela — mesma hierarquia das telas de Demonstrações já existentes. */
interface DisplayRow {
  kind: 'group' | 'detail' | 'calculated' | 'total';
  label: string;
  values: Record<string, number | null>;
  hideValues?: boolean;
  /** Linha precisa de atenção antes da versão definitiva (ex.: DFC não identificada, pendente de classificação manual). */
  highlight?: 'warning';
}

interface StatementPanelOut {
  label: string;
  rows: DisplayRow[];
  totalLabel: string;
  totalValues: Record<string, number | null>;
}

interface StatementSectionOut {
  statementCode: 'BP' | 'DRE' | 'DFC';
  title: string;
  dateLabel: string;
  periods: string[];
  panels?: StatementPanelOut[]; // BP: [Ativo, Passivo+PL] lado a lado
  rows?: DisplayRow[]; // DRE/DFC: lista única
  currentComment: string;
  historicalComment: string | null;
  dfcOrigin?: 'imported' | 'calculated' | 'reconstructed';
  dfcReconciliation?: DfcReconciliation;
}

/**
 * Status de reconciliação da DFC — decide se a versão do relatório pode ser
 * finalizada (ver finalize() em financial-report-version.service.ts):
 * - 'automatica': "Movimentações patrimoniais não identificadas" é ~0 em
 *   todos os períodos — a identidade contábil fechou sem nenhum resíduo a
 *   classificar.
 * - 'manual': sobra resíduo em ao menos um período, mas há pelo menos um
 *   ajuste manual de DFC cadastrado pro diagnóstico — sinal de que um
 *   consultor já revisou e classificou a composição (financiamento com
 *   efeito caixa / movimentação sem efeito caixa / reclassificação interna),
 *   mesmo sem uma UI dedicada de "classificar linha" ainda.
 * - 'nao_conciliada': sobra resíduo e ninguém classificou — bloqueia
 *   finalize() por decisão explícita do usuário (não esconder diferença
 *   contábil atrás de uma linha genérica).
 */
interface DfcReconciliation {
  status: 'automatica' | 'manual' | 'nao_conciliada';
  unclassifiedPeriods: string[];
}

function hasAnyValue(values: Record<string, number | null>, periods: string[]): boolean {
  return periods.some((p) => values[p] !== null && values[p] !== 0);
}

/**
 * Monta o payload canônico do Relatório da Análise a partir dos dados já
 * persistidos (FinancialOutputService) + achados aprovados. Não recalcula
 * BP/DRE/DFC/indicadores/Kanitz — só lê, deriva AV/AH e narrativa.
 */
@Injectable()
export class FinancialReportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly output: FinancialOutputService,
    private readonly narrativeLlm: FinancialNarrativeLlmService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadDiagnosis(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({
        where: { id: diagnosisId, deletedAt: null },
        include: { group: true, company: true, unit: true },
      });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) throw new ForbiddenException('Tenant scope violation');
      return diagnosis;
    });
  }

  async buildPayload(actor: AuthUser, diagnosisId: string) {
    const diagnosis = await this.loadDiagnosis(actor, diagnosisId);

    // Sem processingRunId: cada período tem seu próprio processing run
    // "active" (upload por ano) — a mesma regra de agregação usada pelas
    // telas reais de Demonstrações (BalanceSheetView etc., que consultam
    // FinancialStatementLine.filter({ publication_status: 'active' }) sem
    // travar num único run). Restringir a um processing_run_id (o "snapshot
    // atual") descartava todos os períodos exceto o mais recente.
    const [rawStatementLines, rawIndicators, findings, recommendations, mappingResolutions, uploads, manualAdjustments] = await Promise.all([
      this.output.listStatementLines(actor, diagnosisId, { publicationStatus: 'active' }),
      this.output.listIndicatorSnapshots(actor, diagnosisId, { publicationStatus: 'active' }),
      this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialFinding.findMany({ where: { financialDiagnosisId: diagnosisId, reportInclusionStatus: { in: ['approved', 'edited'] } } }),
      ),
      this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialRecommendation.findMany({ where: { financialDiagnosisId: diagnosisId, reportInclusionStatus: { in: ['approved', 'edited'] } }, orderBy: { createdAt: 'asc' } }),
      ),
      this.output.listMappingResolutions(actor, diagnosisId, { publicationStatus: 'active' }),
      this.output.listProcessingRuns(actor, diagnosisId),
      this.output.listDfcManualAdjustments(actor, diagnosisId),
    ]);

    const statementLines = rawStatementLines.filter((l) => !l.entityCode);
    const indicators = rawIndicators.filter((i) => !i.entityCode);
    const periods = [...new Set(indicators.map((i) => i.period).filter(Boolean))].sort();
    const basePeriod = periods[periods.length - 1] ?? null;
    const comparativePeriods = periods.slice(0, -1);

    const periodMode: 'single' | 'comparative' | 'historical' =
      periods.length <= 1 ? 'single' : periods.length === 2 ? 'comparative' : 'historical';

    // Mês de fechamento fiscal — só temos o mês/dia reais em data_base_fechamento
    // (a mesma data serve de referência pra todo o diagnóstico); ano de cada
    // período vem do próprio período. Sem isso, cai no calendário civil
    // (dezembro), que é o caso mais comum.
    const fiscalCloseMonth = diagnosis.dataBaseFechamento ? diagnosis.dataBaseFechamento.getUTCMonth() + 1 : 12;
    const isAnnual = diagnosis.periodicidade === 'anual' || diagnosis.periodicidade === 'annual' || !diagnosis.periodicidade;
    const columnLabelByPeriod = new Map(rawStatementLines.filter((l) => l.period && l.columnLabel).map((l) => [l.period, l.columnLabel as string]));
    const labelFor = (p: string | null) => {
      if (!p) return '';
      if (isAnnual && /^\d{4}$/.test(p)) return formatAnnualPeriodLabel(p, fiscalCloseMonth);
      return columnLabelByPeriod.get(p) || p;
    };

    const bp = this.buildBpSection(statementLines, periods, basePeriod, diagnosis.periodicidade, labelFor);
    const dre = this.buildDreSection(statementLines, periods, basePeriod, diagnosis.periodicidade, labelFor);
    const dfc = this.buildDfcSection(statementLines, periods, basePeriod, diagnosis.periodicidade, labelFor, manualAdjustments.length > 0);

    const indicatorSections = this.buildIndicatorSections(indicators, periods, basePeriod, labelFor);
    const kanitz = this.buildKanitzSection(indicators, periods, basePeriod, labelFor);

    // Achados de cruzamento automático (sourceType 'cross_statement' — ver
    // detectCrossStatementFindings) alimentam exclusivamente "Achados
    // integrados para decisão": cada um já combina duas demonstrações
    // diferentes, então repeti-los também em 3.1/3.2 (que agrupam por
    // demonstração isolada) duplicaria a leitura.
    const findingBuckets = {
      dataBaseAtual: findings.filter((f) => (f.findingScope === 'period_snapshot' || f.findingScope === 'structural_validation') && f.sourceType !== 'cross_statement'),
      evolucaoHistorica: findings.filter((f) => f.findingScope === 'period_comparison' && f.sourceType !== 'cross_statement'),
      integrados: findings.filter((f) => (f.classification !== null && f.origin === 'manual') || f.sourceType === 'cross_statement'),
    };

    const cover = {
      companyName: diagnosis.company?.name || diagnosis.group?.name || diagnosis.title,
      groupName: diagnosis.group?.name || null,
      unitName: diagnosis.unit?.name || null,
      analysisType: diagnosis.analysisType,
      analysisTypeLabel: { individual: 'Individual', combined: 'Combinada', consolidated: 'Consolidada' }[diagnosis.analysisType] || diagnosis.analysisType,
      baseDatePeriod: basePeriod,
      baseDateLabel: labelFor(basePeriod),
      comparativePeriods,
      comparativePeriodLabels: comparativePeriods.map(labelFor),
      issueDate: new Date().toISOString(),
      confidential: true,
    };

    // Síntese executiva por LLM (opcional — ver FinancialNarrativeLlmService).
    // Grounding a partir das linhas cruas (statementLines), não das rows já
    // formatadas em bp/dre/dfc, pra buscar por canonicalKey em vez de
    // depender do texto do label renderizado.
    const findValue = (canonicalKey: string): number | null => {
      if (!basePeriod) return null;
      const raw = statementLines.find((l) => l.canonicalKey === canonicalKey && l.period === basePeriod)?.value;
      return raw === undefined || raw === null ? null : Number(raw);
    };
    const approvedFindings = findings
      .filter((f) => f.reportInclusionStatus === 'approved' || f.reportInclusionStatus === 'edited')
      .map((f) => ({ title: f.title, description: f.reportInclusionEditedText || f.description, classification: f.classification }));
    // Linhas de uma demonstração já renderizada (bp.panels[].rows / dre.rows
    // / dfc.rows) no formato que generateStatementCommentary espera —
    // formata os valores brutos aqui (compacto, mesma função usada no resto
    // do payload) em vez de expor números crus ao prompt.
    const toLlmRows = (rows: DisplayRow[]): Array<{ label: string; values: Array<{ period: string; formatted: string | null }> }> =>
      rows
        .filter((r) => !r.hideValues)
        .map((r) => ({
          label: r.label,
          values: periods.map((p) => ({ period: p, formatted: r.values[p] != null ? formatCurrencyCompact(r.values[p]) : null })),
        }));

    // Um comentário por GRUPO de indicador (liquidez/endividamento/
    // rentabilidade/eficiência), não um bloco único cobrindo todos —
    // reaproveita generateStatementCommentary (mesma função de BP/DRE/DFC,
    // só muda o "statementLabel" pro nome do grupo), pra cada quadro ter
    // seu próprio "posição atual"/"evolução histórica" logo abaixo dele.
    const indicatorGroupPromises = indicatorSections.map((g) =>
      g.rows.length === 0
        ? Promise.resolve({ current: null, historical: null })
        : this.narrativeLlm.generateStatementCommentary({
            statementLabel: g.label,
            cover,
            rows: g.rows.map((r) => ({ label: r.label, values: r.values.map((v) => ({ period: v.period, formatted: v.formatted })) })),
          }),
    );

    // Todas as chamadas ao LLM (síntese executiva + BP + DRE + DFC + um
    // grupo de indicador por vez) são independentes entre si — Promise.all
    // evita pagar a latência de todas em série.
    const [executiveSummaryLlm, bpCommentaryLlm, dreCommentaryLlm, dfcCommentaryLlm, ...indicatorGroupCommentaries] = await Promise.all([
      this.narrativeLlm.generateExecutiveSummary({
        cover,
        kanitz,
        statements: {
          bp: { totalAtivo: findValue('total_ativo') },
          dre: { resultadoLiquido: findValue('resultado_liquido') },
          dfc: { caixaOperacional: findValue('dfc_caixa_liquido_atividades_operacionais') },
        },
        findings: approvedFindings,
      }),
      this.narrativeLlm.generateStatementCommentary({
        statementLabel: 'Balanço Patrimonial',
        cover,
        rows: toLlmRows((bp.panels ?? []).flatMap((p) => p.rows)),
      }),
      this.narrativeLlm.generateStatementCommentary({
        statementLabel: 'Demonstração do Resultado',
        cover,
        rows: toLlmRows(dre.rows ?? []),
      }),
      this.narrativeLlm.generateStatementCommentary({
        statementLabel: 'Demonstração dos Fluxos de Caixa',
        cover,
        rows: toLlmRows(dfc.rows ?? []),
      }),
      ...indicatorGroupPromises,
    ]);

    // Substitui os comentários determinísticos SÓ quando o LLM teve
    // sucesso — buildCurrentStatementComment/buildHistoricalStatementComment
    // (chamados dentro de buildBpSection/buildDreSection/buildDfcSection)
    // continuam sendo o fallback sempre calculado, nunca removido. Os
    // grupos de indicador não têm fallback determinístico (nunca tiveram
    // narrativa antes desta feature) — null aqui só significa "sem
    // comentário", a tabela renderiza normalmente do mesmo jeito.
    if (bpCommentaryLlm.current) bp.currentComment = bpCommentaryLlm.current;
    if (bpCommentaryLlm.historical) bp.historicalComment = bpCommentaryLlm.historical;
    if (dreCommentaryLlm.current) dre.currentComment = dreCommentaryLlm.current;
    if (dreCommentaryLlm.historical) dre.historicalComment = dreCommentaryLlm.historical;
    if (dfcCommentaryLlm.current) dfc.currentComment = dfcCommentaryLlm.current;
    if (dfcCommentaryLlm.historical) dfc.historicalComment = dfcCommentaryLlm.historical;
    indicatorSections.forEach((g: any, i) => {
      if (indicatorGroupCommentaries[i]?.current) g.currentComment = indicatorGroupCommentaries[i].current;
      if (indicatorGroupCommentaries[i]?.historical) g.historicalComment = indicatorGroupCommentaries[i].historical;
    });

    return {
      cover,
      periodContext: { mode: periodMode, periods, basePeriod, comparativePeriods, periodicidade: diagnosis.periodicidade },
      statements: { bp, dre, dfc },
      dfcReconciliation: dfc.dfcReconciliation ?? null,
      indicators: indicatorSections,
      kanitz,
      narrative: { executiveSummaryLlm },
      insights: {
        dataBaseAtual: findingBuckets.dataBaseAtual,
        evolucaoHistorica: findingBuckets.evolucaoHistorica,
        integrados: findingBuckets.integrados,
      },
      recommendations: recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        diagnosticThesis: r.diagnosticThesis,
        suggestedAction: r.suggestedAction,
        expectedImpact: r.expectedImpact,
        priority: r.priority,
      })),
      methodology: {
        uploadsCount: uploads.length,
        mappedAccountsCount: mappingResolutions.length,
        dfcOrigin: dfc.dfcOrigin ?? 'indisponivel',
        indicatorsNotCalculated: INDICATOR_REGISTRY.filter((m) => !indicators.some((i) => i.indicatorCode === m.code)).map((m) => m.label),
      },
    };
  }

  // ── BP / DRE / DFC ──────────────────────────────────────────────────
  //
  // Duas representações da mesma linha crua (FinancialStatementLine):
  // 1) "flat rows" (buildFlatRows) — só para materialidade/narrativa (AV%,
  //    concentrações, maiores variações), nunca vira tabela.
  // 2) "display rows" (buildBpSection/buildDreSection/buildDfcSection) — a
  //    tabela que efetivamente vai pro relatório, replicando EXATAMENTE a
  //    hierarquia (grupo → detalhe → subtotal/total) das telas de
  //    Demonstrações já existentes (BalanceSheetView/IncomeStatementView/
  //    CashFlowStatementView.jsx) via financial-statement-layout.const.ts —
  //    não uma tabela nova com colunas de AV/AH.

  private buildFlatRows(
    lines: Array<{ canonicalKey: string; statementCode: string; period: string; value: unknown; rubricLabel: string | null; lineType: string }>,
    statementCode: 'BP' | 'DRE' | 'DFC',
    periods: string[],
    basePeriod: string | null,
    avBaseKey: string | null,
  ): FlatStatementRow[] {
    const scoped = lines.filter((l) => l.statementCode === statementCode);
    const byKey = new Map<string, typeof scoped>();
    for (const l of scoped) {
      if (!byKey.has(l.canonicalKey)) byKey.set(l.canonicalKey, []);
      byKey.get(l.canonicalKey)!.push(l);
    }
    const baseTotal = avBaseKey && basePeriod ? Number(scoped.find((l) => l.canonicalKey === avBaseKey && l.period === basePeriod)?.value ?? NaN) : NaN;

    const rows: FlatStatementRow[] = [];
    for (const [canonicalKey, group] of byKey) {
      const values: Record<string, number | null> = {};
      for (const p of periods) {
        const row = group.find((l) => l.period === p);
        values[p] = row ? Number(row.value) : null;
      }
      const currentValue = basePeriod ? values[basePeriod] : null;
      rows.push({
        canonicalKey,
        rubricLabel: group[0].rubricLabel || canonicalKey,
        lineType: group[0].lineType,
        values,
        verticalPercent: Number.isFinite(baseTotal) && baseTotal !== 0 && currentValue !== null ? (currentValue / baseTotal) * 100 : null,
      });
    }
    return rows;
  }

  private buildBpSection(
    lines: Array<{ canonicalKey: string; statementCode: string; period: string; value: unknown; rubricLabel: string | null; lineType: string }>,
    periods: string[],
    basePeriod: string | null,
    periodicidade: string | null,
    labelFor: (p: string | null) => string,
  ): StatementSectionOut {
    const flatRows = this.buildFlatRows(lines, 'BP', periods, basePeriod, BP_TOTALS.ativo.canonicalKey);
    const byCanonical = new Map(flatRows.map((r) => [r.canonicalKey, r]));

    const buildPanel = (side: 'ativo' | 'passivo', totalDef: { canonicalKey: string; label: string }): StatementPanelOut => {
      const rows: DisplayRow[] = [];
      for (const group of BP_GROUPS.filter((g) => BP_SIDE_BY_GROUP[g.key] === side)) {
        const rubricsInGroup = BP_RUBRICS.filter((r) => r.group === group.key).sort((a, b) => a.displayOrder - b.displayOrder);
        const detailRows = rubricsInGroup
          .map((r) => byCanonical.get(r.canonicalKey))
          .filter((r): r is FlatStatementRow => !!r && hasAnyValue(r.values, periods));
        if (detailRows.length === 0) continue;
        const subtotal: Record<string, number | null> = {};
        for (const p of periods) subtotal[p] = detailRows.reduce((sum, r) => sum + (r.values[p] ?? 0), 0);
        rows.push({ kind: 'group', label: group.label, values: subtotal });
        for (const r of detailRows) rows.push({ kind: 'detail', label: r.rubricLabel, values: r.values });
      }
      const totalRow = byCanonical.get(totalDef.canonicalKey);
      const totalValues = totalRow?.values ?? Object.fromEntries(periods.map((p) => [p, rows.filter((r) => r.kind === 'group').reduce((s, r) => s + (r.values[p] ?? 0), 0)]));
      return { label: side === 'ativo' ? 'Ativo' : 'Passivo e patrimônio líquido', rows, totalLabel: totalDef.label, totalValues };
    };

    const panels = [buildPanel('ativo', BP_TOTALS.ativo), buildPanel('passivo', BP_TOTALS.passivo)];
    const dateLabel = basePeriod ? statementDateLabel('BP', labelFor(basePeriod), periodicidade) : 'Data-base indisponível';

    return {
      statementCode: 'BP',
      title: 'Balanço Patrimonial',
      dateLabel,
      // Coluna mais recente primeiro (2025, 2024, 2023...) — mesma ordem das
      // telas reais de Demonstrações (BalanceSheetView.jsx ordena
      // sortedPeriods decrescente); `periods` internamente segue crescente
      // (basePeriod/comparativePeriods dependem disso), só a saída pro
      // template inverte — values continuam indexados por string de
      // período, não por posição no array.
      periods: [...periods].reverse(),
      panels,
      currentComment: this.buildCurrentStatementComment('BP', flatRows, basePeriod, labelFor),
      historicalComment: periods.length >= 2 ? this.buildHistoricalStatementComment(flatRows, periods, labelFor) : null,
    };
  }

  private buildDreSection(
    lines: Array<{ canonicalKey: string; statementCode: string; period: string; value: unknown; rubricLabel: string | null; lineType: string }>,
    periods: string[],
    basePeriod: string | null,
    periodicidade: string | null,
    labelFor: (p: string | null) => string,
  ): StatementSectionOut {
    const flatRows = this.buildFlatRows(lines, 'DRE', periods, basePeriod, 'receita_liquida');
    const byCanonical = new Map(flatRows.map((r) => [r.canonicalKey, r]));
    const formulaByKey = new Map(DRE_FORMULAS.map((f) => [f.canonicalKey, f]));

    const rows: DisplayRow[] = [];
    for (const group of DRE_GROUPS) {
      const rubricsInGroup = DRE_RUBRICS.filter((r) => r.group === group.key).sort((a, b) => a.displayOrder - b.displayOrder);
      const detailRows = rubricsInGroup
        .map((r) => byCanonical.get(r.canonicalKey))
        .filter((r): r is FlatStatementRow => !!r && hasAnyValue(r.values, periods));
      const calcKeys = DRE_CALCULATED_AFTER_GROUP[group.key] ?? [];
      if (detailRows.length === 0 && calcKeys.every((k) => !byCanonical.get(k) || !hasAnyValue(byCanonical.get(k)!.values, periods))) continue;

      const subtotal: Record<string, number | null> = {};
      for (const p of periods) subtotal[p] = detailRows.reduce((sum, r) => sum + (r.values[p] ?? 0), 0);
      rows.push({ kind: 'group', label: group.label, values: subtotal });
      for (const r of detailRows) rows.push({ kind: 'detail', label: r.rubricLabel, values: r.values });

      calcKeys.forEach((calcKey, idx) => {
        const formula = formulaByKey.get(calcKey);
        const dataRow = byCanonical.get(calcKey);
        const values = dataRow?.values ?? Object.fromEntries(periods.map((p) => [p, null]));
        if (formula?.lineType === 'total') {
          rows.push({ kind: 'total', label: formula.rubricLabel, values });
          return;
        }
        if (idx === 0) return; // primeiro totalizador do grupo == o próprio subtotal já mostrado na linha de grupo
        rows.push({ kind: 'calculated', label: formula?.rubricLabel ?? calcKey, values });
      });
    }

    const dateLabel = basePeriod ? statementDateLabel('DRE', labelFor(basePeriod), periodicidade) : 'Data-base indisponível';

    return {
      statementCode: 'DRE',
      title: 'Demonstração do Resultado',
      dateLabel,
      periods: [...periods].reverse(),
      rows,
      currentComment: this.buildCurrentStatementComment('DRE', flatRows, basePeriod, labelFor),
      historicalComment: periods.length >= 2 ? this.buildHistoricalStatementComment(flatRows, periods, labelFor) : null,
    };
  }

  private buildDfcSection(
    lines: Array<{ canonicalKey: string; statementCode: string; period: string; value: unknown; rubricLabel: string | null; lineType: string }>,
    periods: string[],
    basePeriod: string | null,
    periodicidade: string | null,
    labelFor: (p: string | null) => string,
    hasManualAdjustments: boolean,
  ): StatementSectionOut {
    const flatRows = this.buildFlatRows(lines, 'DFC', periods, basePeriod, null);
    const byCanonical = new Map(flatRows.map((r) => [r.canonicalKey, r]));

    const rows: DisplayRow[] = [];
    for (const key of DFC_ORDER) {
      if (key === 'dfc_diferenca_validacao') continue;
      const flat = byCanonical.get(key);
      if (!flat) continue;
      const label = DFC_LABEL_OVERRIDE[key] ?? flat.rubricLabel;
      if (DFC_HIDE_VALUE_KEYS.has(key)) {
        rows.push({ kind: 'group', label, values: Object.fromEntries(periods.map((p) => [p, null])), hideValues: true });
        continue;
      }
      const kind: DisplayRow['kind'] = DFC_DARK_KEYS.has(key) ? 'total' : DFC_TOTAL_KEYS.has(key) ? 'calculated' : 'detail';
      // Não é somada a nenhuma atividade de caixa (ver buildDfc()) — destaque
      // quando não-zero pra não ficar escondida como uma linha qualquer:
      // precisa de classificação manual antes da versão definitiva.
      const highlight: DisplayRow['highlight'] =
        key === DFC_UNIDENTIFIED_KEY && periods.some((p) => Math.abs(flat.values[p] ?? 0) >= 0.01) ? 'warning' : undefined;
      rows.push({ kind, label, values: flat.values, highlight });
    }

    const dateLabel = basePeriod ? statementDateLabel('DFC', labelFor(basePeriod), periodicidade) : 'Data-base indisponível';

    const unidentified = byCanonical.get(DFC_UNIDENTIFIED_KEY);
    const unclassifiedPeriods = unidentified ? periods.filter((p) => Math.abs(unidentified.values[p] ?? 0) >= 0.01) : [];
    const dfcReconciliation: DfcReconciliation | undefined =
      rows.length === 0
        ? undefined
        : {
            status: unclassifiedPeriods.length === 0 ? 'automatica' : hasManualAdjustments ? 'manual' : 'nao_conciliada',
            unclassifiedPeriods,
          };

    return {
      statementCode: 'DFC',
      title: 'Demonstração dos Fluxos de Caixa',
      dateLabel,
      periods: [...periods].reverse(),
      rows,
      dfcOrigin: rows.length > 0 ? 'calculated' : undefined,
      dfcReconciliation,
      currentComment: this.buildDfcComment(flatRows, basePeriod, labelFor),
      historicalComment: periods.length >= 2 ? this.buildHistoricalStatementComment(flatRows, periods, labelFor) : null,
    };
  }

  /** Comentário sobre a data-base atual, por materialidade (maiores participações sobre o total). */
  private buildCurrentStatementComment(
    statementCode: 'BP' | 'DRE' | 'DFC',
    rows: FlatStatementRow[],
    basePeriod: string | null,
    labelFor: (p: string | null) => string,
  ): string {
    if (!basePeriod) return 'Data-base indisponível para leitura da posição atual.';
    const detailRows = rows.filter((r) => r.lineType !== 'total' && r.values[basePeriod] !== null);
    const totalRow = rows.find((r) => r.lineType === 'total' && r.canonicalKey.startsWith('total_ativo') === (statementCode === 'BP'));
    const topByShare = [...detailRows]
      .filter((r) => r.verticalPercent !== null)
      .sort((a, b) => Math.abs(b.verticalPercent ?? 0) - Math.abs(a.verticalPercent ?? 0))
      .slice(0, 3);

    if (topByShare.length === 0) return `Dados insuficientes para comentário automático da posição em ${labelFor(basePeriod)}.`;

    const totalLabel = totalRow ? formatCurrencyCompact(totalRow.values[basePeriod]) : null;
    const intro = totalRow
      ? `Em ${labelFor(basePeriod)}, o total ${statementCode === 'BP' ? 'do ativo' : 'analisado'} somou ${totalLabel}.`
      : `Em ${labelFor(basePeriod)}:`;
    const concentrations = topByShare
      .map((r) => `${r.rubricLabel}, com ${formatCurrencyCompact(r.values[basePeriod])} (${formatPercentagePoints(Math.abs(r.verticalPercent ?? 0))} do total)`)
      .join('; ');
    return `${intro} As principais concentrações estavam em ${concentrations}.`;
  }

  /**
   * Comentário dedicado da DFC (fluxos operacional/investimento/financiamento
   * + variação de caixa) — a leitura por "maior participação sobre o total"
   * usada em BP/DRE não faz sentido aqui (DFC não tem uma base de 100% única).
   */
  private buildDfcComment(rows: FlatStatementRow[], basePeriod: string | null, labelFor: (p: string | null) => string): string {
    if (!basePeriod) return 'Data-base indisponível para leitura da geração de caixa.';
    const get = (key: string) => rows.find((r) => r.canonicalKey === key)?.values[basePeriod] ?? null;
    const operacional = get('dfc_caixa_liquido_atividades_operacionais');
    const investimento = get('dfc_caixa_liquido_atividades_investimento');
    const financiamento = get('dfc_caixa_liquido_atividades_financiamento');
    const resultadoLiquido = get('dfc_resultado_liquido');
    const variacaoLiquida = get('dfc_variacao_liquida_caixa');
    const saldoFinal = get('dfc_saldo_final_caixa');

    if (operacional === null) return `Dados insuficientes para comentário automático da geração de caixa em ${labelFor(basePeriod)}.`;

    let sentence = `Em ${labelFor(basePeriod)}, as atividades operacionais ${operacional >= 0 ? 'geraram' : 'consumiram'} ${formatCurrencyCompact(Math.abs(operacional))}`;
    if (resultadoLiquido !== null) sentence += `, frente a um resultado líquido de ${formatCurrencyCompact(resultadoLiquido)} no período`;
    sentence += '.';
    if (investimento !== null) sentence += ` As atividades de investimento ${investimento >= 0 ? 'geraram' : 'consumiram'} ${formatCurrencyCompact(Math.abs(investimento))}.`;
    if (financiamento !== null) sentence += ` As atividades de financiamento ${financiamento >= 0 ? 'geraram' : 'consumiram'} ${formatCurrencyCompact(Math.abs(financiamento))}.`;
    if (variacaoLiquida !== null && saldoFinal !== null) {
      sentence += ` O caixa ${variacaoLiquida >= 0 ? 'aumentou' : 'reduziu'} ${formatCurrencyCompact(Math.abs(variacaoLiquida))} no período, encerrando em ${formatCurrencyCompact(saldoFinal)}.`;
    }
    return sentence;
  }

  /** Comentário de evolução histórica — maiores variações absolutas entre o primeiro e o último período. */
  private buildHistoricalStatementComment(
    rows: FlatStatementRow[],
    periods: string[],
    labelFor: (p: string | null) => string,
  ): string {
    // Compara o par mais recente (penúltimo → último), não o mais antigo
    // vs. o mais novo do histórico inteiro — com 3+ períodos, comparar
    // ponta a ponta mascara a evolução real do último ano (ex.: dois
    // períodos com valores parecidos e um "ano ruim" no meio somem da
    // leitura, gerando falso "sem variações materiais").
    const first = periods[periods.length - 2];
    const last = periods[periods.length - 1];
    const withDelta = rows
      .filter((r) => r.lineType !== 'total' && r.values[first] !== null && r.values[last] !== null)
      .map((r) => ({
        r,
        delta: (r.values[last] as number) - (r.values[first] as number),
        deltaPct: relativeVariation(r.values[first], r.values[last]),
      }))
      .filter((x) => Math.abs(x.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    if (withDelta.length === 0) return `Sem variações materiais identificadas entre ${labelFor(first)} e ${labelFor(last)}.`;

    const sentences = withDelta.map(({ r, delta, deltaPct }) => {
      const direction = delta >= 0 ? 'aumentou' : 'reduziu';
      const pctLabel = deltaPct !== null ? ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : '';
      return `${r.rubricLabel} ${direction} de ${formatCurrencyCompact(r.values[first])} em ${labelFor(first)} para ${formatCurrencyCompact(r.values[last])} em ${labelFor(last)}${pctLabel}`;
    });
    return `Evolução histórica entre ${labelFor(first)} e ${labelFor(last)}: ${sentences.join('; ')}.`;
  }

  // ── Indicadores ─────────────────────────────────────────────────────

  private buildIndicatorSections(
    indicators: Array<{ indicatorCode: string; period: string; value: unknown; previousValue: unknown; variationPercent: unknown; signal: string | null }>,
    periods: string[],
    basePeriod: string | null,
    labelFor: (p: string | null) => string,
  ) {
    const groups: IndicatorGroup[] = ['liquidez', 'endividamento', 'rentabilidade', 'eficiencia'];
    return groups.map((group) => {
      const metas = INDICATOR_REGISTRY.filter((m) => m.group === group);
      const rows = metas
        .map((meta) => {
          const byPeriod = periods.map((p) => {
            const row = indicators.find((i) => i.indicatorCode === meta.code && i.period === p);
            const rawValue = row && row.value !== null ? Number(row.value) : null;
            return { period: p, value: rawValue, formatted: rawValue === null ? null : formatValueByKind(meta.format, rawValue, meta.decimals) };
          });
          const hasAnyValue = byPeriod.some((b) => b.value !== null);
          if (!hasAnyValue) return null; // omitido — sem snapshot calculado
          const currentRow = basePeriod ? indicators.find((i) => i.indicatorCode === meta.code && i.period === basePeriod) : null;
          return {
            code: meta.code,
            label: meta.label,
            fullLabel: meta.fullLabel,
            format: meta.format,
            values: byPeriod,
            currentValue: currentRow ? Number(currentRow.value) : null,
            variationPercent: currentRow?.variationPercent !== undefined && currentRow?.variationPercent !== null ? Number(currentRow.variationPercent) : null,
            signal: currentRow?.signal ?? null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return {
        group,
        label: INDICATOR_GROUP_LABELS[group],
        rows,
        // Fallback determinístico — mesmo padrão de buildCurrentStatementComment/
        // buildHistoricalStatementComment (BP/DRE): sempre calculado, só
        // sobrescrito quando o LLM (generateStatementCommentary) tem sucesso.
        // Sem isso, uma falha de cota/rede no Gemini apaga os comentários dos
        // quadros de indicadores por inteiro (BP/DRE/DFC já não tinham esse
        // problema por já terem fallback — bug real visto em produção).
        currentComment: this.buildIndicatorGroupCurrentComment(rows, basePeriod, labelFor),
        historicalComment: periods.length >= 2 ? this.buildIndicatorGroupHistoricalComment(rows, periods, labelFor) : null,
      };
    });
  }

  /** Fallback determinístico do "posição atual" de um quadro de indicadores — lista todos os valores da data-base numa frase corrida. */
  private buildIndicatorGroupCurrentComment(
    rows: Array<{ fullLabel: string; format: IndicatorFormatKind; values: Array<{ period: string; formatted: string | null }> }>,
    basePeriod: string | null,
    labelFor: (p: string | null) => string,
  ): string | null {
    if (!basePeriod) return null;
    const parts = rows
      .map((r) => {
        const formatted = r.values.find((v) => v.period === basePeriod)?.formatted;
        return formatted ? `${r.fullLabel} de ${formatted}` : null;
      })
      .filter((p): p is string => p !== null);
    if (parts.length === 0) return null;
    const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
    return `Em ${labelFor(basePeriod)}, a companhia apresenta ${joined}.`;
  }

  /** Fallback determinístico da "evolução histórica" de um quadro de indicadores — direção de variação de cada indicador entre os dois períodos mais recentes. */
  private buildIndicatorGroupHistoricalComment(
    rows: Array<{ fullLabel: string; format: IndicatorFormatKind; values: Array<{ period: string; formatted: string | null }> }>,
    periods: string[],
    labelFor: (p: string | null) => string,
  ): string | null {
    const first = periods[periods.length - 2];
    const last = periods[periods.length - 1];
    const sentences = rows
      .map((r) => {
        const firstFormatted = r.values.find((v) => v.period === first)?.formatted;
        const lastFormatted = r.values.find((v) => v.period === last)?.formatted;
        if (!firstFormatted || !lastFormatted || firstFormatted === lastFormatted) return null;
        return `${r.fullLabel} passou de ${firstFormatted} para ${lastFormatted}`;
      })
      .filter((s): s is string => s !== null);
    if (sentences.length === 0) return `Sem variações materiais identificadas entre ${labelFor(first)} e ${labelFor(last)}.`;
    return `Entre ${labelFor(first)} e ${labelFor(last)}: ${sentences.join('; ')}.`;
  }

  // ── Kanitz ──────────────────────────────────────────────────────────

  private buildKanitzSection(
    indicators: Array<{ indicatorCode: string; period: string; value: unknown }>,
    periods: string[],
    basePeriod: string | null,
    labelFor: (p: string | null) => string,
  ) {
    const fiByPeriod = new Map(
      periods.map((p) => [p, indicators.find((i) => i.indicatorCode === 'kanitz_fator_insolvencia' && i.period === p)?.value]),
    );
    const fiCurrent = basePeriod ? (fiByPeriod.get(basePeriod) !== undefined && fiByPeriod.get(basePeriod) !== null ? Number(fiByPeriod.get(basePeriod)) : null) : null;
    const zone = kanitzZone(fiCurrent);

    const composition = Object.entries(KANITZ_COMPONENT_WEIGHTS).map(([code, meta]) => {
      const row = basePeriod ? indicators.find((i) => i.indicatorCode === code && i.period === basePeriod) : null;
      const result = row && row.value !== null ? Number(row.value) : null;
      return {
        label: meta.label,
        result,
        weight: meta.weight,
        contribution: result !== null ? result * meta.weight : null,
      };
    });

    const history = periods.map((p) => {
      const v = fiByPeriod.get(p);
      const fi = v !== undefined && v !== null ? Number(v) : null;
      return { period: p, periodLabel: labelFor(p), fi, zone: kanitzZone(fi) };
    });

    let comment = 'Fator de Insolvência de Kanitz não calculável na data-base atual (dados insuficientes).';
    if (fiCurrent !== null && zone) {
      const limite = zone === 'insolvencia' ? -3 : zone === 'penumbra' ? 0 : 0;
      const distancia = Math.abs(fiCurrent - limite);
      const positives = composition.filter((c) => c.contribution !== null && c.contribution > 0).sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0)).slice(0, 2);
      const negatives = composition.filter((c) => c.contribution !== null && c.contribution < 0).sort((a, b) => (a.contribution ?? 0) - (b.contribution ?? 0)).slice(0, 1);
      const posLabel = positives.map((c) => `${c.label} (contribuição de ${formatKanitzFi(c.contribution)})`).join(' e ');
      const negLabel = negatives.map((c) => `${c.label} (contribuição de ${formatKanitzFi(c.contribution)})`).join(', ');
      comment = `Em ${labelFor(basePeriod)}, o Fator de Insolvência de Kanitz foi de ${formatKanitzFi(fiCurrent)}, posicionando a empresa na ${KANITZ_ZONE_LABELS[zone].toLowerCase()}, a ${formatKanitzFi(distancia)} pontos do limite de referência (${limite}).${posLabel ? ` Os componentes que mais contribuíram positivamente foram ${posLabel}.` : ''}${negLabel ? ` O principal efeito negativo decorreu de ${negLabel}.` : ''} A permanência em ${KANITZ_ZONE_LABELS[zone].toLowerCase()} não substitui a leitura conjunta de liquidez, endividamento e rentabilidade apresentada nas demais seções.`;
    }

    let historicalComment: string | null = null;
    if (history.filter((h) => h.fi !== null).length >= 2) {
      const withValues = history.filter((h) => h.fi !== null);
      const first = withValues[0];
      const last = withValues[withValues.length - 1];
      const zoneChanged = first.zone !== last.zone;
      const delta = (last.fi as number) - (first.fi as number);
      historicalComment = zoneChanged
        ? `Entre ${first.periodLabel} e ${last.periodLabel}, a empresa migrou de ${KANITZ_ZONE_LABELS[first.zone!].toLowerCase()} para ${KANITZ_ZONE_LABELS[last.zone!].toLowerCase()}, com o Fator de Insolvência passando de ${formatKanitzFi(first.fi as number)} para ${formatKanitzFi(last.fi as number)}.`
        : delta === 0
          ? `O Fator de Insolvência se manteve em ${formatKanitzFi(first.fi as number)} entre ${first.periodLabel} e ${last.periodLabel}, sem variação no intervalo e sem mudança de zona.`
          : `O Fator de Insolvência evoluiu de ${formatKanitzFi(first.fi as number)} em ${first.periodLabel} para ${formatKanitzFi(last.fi as number)} em ${last.periodLabel}, variação de ${formatKanitzFi(delta, true)} pontos, sem mudança de zona.`;
    }

    let insight: string | null = null;
    const zoneChanges = history.filter((h) => h.fi !== null).length >= 2 && history[0].zone !== history[history.length - 1].zone;
    if (zoneChanges || (fiCurrent !== null && zone === 'penumbra') || (fiCurrent !== null && zone === 'insolvencia')) {
      insight = `${zoneChanges ? 'Mudança de zona detectada no Termômetro de Kanitz.' : `Fator de Insolvência em ${KANITZ_ZONE_LABELS[zone!]?.toLowerCase()}.`} Recomenda-se leitura conjunta com liquidez, endividamento e rentabilidade antes de qualquer conclusão sobre continuidade.`;
    }

    return {
      current: { fi: fiCurrent, zone, zoneLabel: zone ? KANITZ_ZONE_LABELS[zone] : null, periodLabel: labelFor(basePeriod) },
      composition,
      history,
      comment,
      historicalComment,
      insight,
    };
  }
}
