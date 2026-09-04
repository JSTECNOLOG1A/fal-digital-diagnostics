import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as XLSX from 'xlsx';
import { canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/auth.types';
import { FinancialEngineService } from './financial-engine.service';
import {
  ALIAS_TO_CANONICAL,
  CANONICAL_DFC_BUCKET,
  CANONICAL_META,
  DfcTreatment,
  DRE_DERIVED_ALIASES,
  FINANCIAL_FORMULA_VERSION,
  FINANCIAL_REGISTRY_VALIDATION,
  FINANCIAL_REGISTRY_VERSION,
  STATEMENT_TOTALS,
} from './financial-canonical-registry.constants';

/**
 * Porta local de buildFinancialStatements (função serverless Base44, 2181
 * linhas). Cobre só o "ramo cheio" (parse de Excel a partir de um upload) e
 * analysisType='individual' — o ramo "prepared_run_id" (multi-empresa) e o
 * ramo "dfc_only" (rebuild de DFC sem reprocessar o Excel) do original
 * ficam para uma fase futura.
 *
 * Simplificação deliberada de arquitetura (documentada em schema.prisma):
 * o original usa uma máquina de estados manual candidate→committing→active
 * com uma tabela de snapshot imutável separada e compensação de rollback
 * escrita à mão. Aqui, uma única transação Postgres (withTenantContext)
 * garante atomicidade de graça — se o BP não fechar ou qualquer coisa
 * falhar, nada é persistido. O FinancialProcessingRun já criado na Fase 1
 * faz o papel de "run" e de "build atual" (seu id vai para
 * FinancialDiagnosis.currentProcessingSnapshotId).
 *
 * Gap conhecido e assumido nesta primeira versão: a DFC indireta do
 * original cruza uploads de anos diferentes automaticamente. Aqui isso
 * também acontece (buscamos as linhas de BP já publicadas de outros
 * períodos deste diagnóstico), mas os cross-checks de materialidade
 * (DFC_CROSS_UPLOAD_MAPPING_MISMATCH etc.) do original não foram portados
 * — a DFC calcula normalmente, só não gera os alertas extras de
 * consistência entre uploads.
 */

const SHEET_ALIASES = ['balancete', 'trial balance', 'trialbalance'];
const SYNTHETIC_TYPES = new Set(['S', 'SINTETICA', 'SINTÉTICA']);
const DFC_TOLERANCE = 0.01;

interface ColumnBlock {
  period: string; // YYYY-MM
  columnKey: string;
  columnLabel: string;
  periodType: 'monthly' | 'annual' | 'quarterly' | 'ytd';
  colIndex: number;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function normalizeAccountCode(code: unknown): string {
  return String(code ?? '').replace(/\./g, '').trim();
}

function matchColumn(headers: string[], patterns: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const pattern of patterns) {
    const idx = normalized.findIndex((h) => h.includes(pattern));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * resolveClassification(): normaliza um texto livre de classificação e
 * procura na tabela de aliases (exato primeiro, depois substring — igual
 * ao original, incluindo o "footgun" de a ordem dos aliases decidir quem
 * ganha quando mais de um é substring do mesmo texto).
 */
function resolveClassification(text: string): string | undefined {
  const n = normalizeHeader(text);
  if (!n) return undefined;
  if (ALIAS_TO_CANONICAL.has(n)) return ALIAS_TO_CANONICAL.get(n);
  for (const [alias, key] of ALIAS_TO_CANONICAL) {
    if (n.includes(alias)) return key;
  }
  return undefined;
}

function applySign(value: number, canonicalKey: string): number {
  const meta = CANONICAL_META[canonicalKey];
  if (!meta) return value;
  if (meta.statementCode === 'DRE') return -value;
  // BP: mantém sinal cru (débito=+) só para chaves de Ativo; inverte o resto (Passivo/PL).
  const isAtivo = meta.group === 'AC' || meta.group === 'ANC' || canonicalKey.startsWith('ativo');
  return isAtivo ? value : -value;
}

function classifyDfcBucket(canonicalKey: string, override?: string): DfcTreatment {
  if (override) return override as DfcTreatment;
  return CANONICAL_DFC_BUCKET[canonicalKey] ?? 'requires_review';
}

/**
 * Porta fiel de deriveColumnMeta() do original: decide o TIPO de coluna
 * (anual/trimestral/YTD/mensal) a partir do column_label que o usuário
 * escolheu no import (ImportConfigModal/ManagePeriodsPanel, persistido em
 * upload.notes), NÃO do texto cru do cabeçalho do Excel — um balancete
 * típico só tem "closing_balance" como cabeçalho da coluna de saldo, sem
 * nenhuma pista de periodicidade nele. Bug corrigido: a versão anterior
 * tentava adivinhar "é anual?" olhando o cabeçalho do Excel (nunca batia,
 * já que o cabeçalho não diz "anual" em lugar nenhum), então toda coluna
 * caía no padrão mensal (columnKey "M-2023" em vez de "A-2023") — e como o
 * filtro de período do frontend é por prefixo de columnKey, isso fazia a
 * tela de demonstrações nunca encontrar nenhuma linha no modo "Anual".
 */
function deriveColumnMeta(
  userColumnLabel: string | null,
  period: string,
): { columnKey: string; columnLabel: string; periodType: ColumnBlock['periodType'] } {
  const [year = '', mm = ''] = period.split('-');
  if (userColumnLabel) {
    const lower = normalizeHeader(userColumnLabel);
    if (lower.startsWith('anual')) {
      return { columnKey: `A-${year}`, columnLabel: year, periodType: 'annual' };
    }
    if (/^\d[°º]?\s*trim/.test(lower)) {
      return { columnKey: `Q-${period}`, columnLabel: userColumnLabel, periodType: 'quarterly' };
    }
    if (lower.startsWith('acum') || lower.startsWith('ytd')) {
      return { columnKey: `Y-${period}`, columnLabel: userColumnLabel, periodType: 'ytd' };
    }
  }
  const label = mm && year ? `${mm}/${year}` : userColumnLabel || period;
  return { columnKey: `M-${period}`, columnLabel: label, periodType: 'monthly' };
}

@Injectable()
export class FinancialStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly engine: FinancialEngineService,
  ) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  async build(actor: AuthUser, uploadId: string, diagnosisId: string, periodOverride?: string | null) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    if (!FINANCIAL_REGISTRY_VALIDATION.valid) {
      throw new BadRequestException(
        `Registro canônico financeiro inválido: ${FINANCIAL_REGISTRY_VALIDATION.errors.join('; ')}`,
      );
    }

    const { upload, diagnosis, planLines } = await this.prisma.withTenantContext(
      this.rlsOpts(actor),
      async (tx) => {
        const uploadRow = await tx.financialUpload.findFirst({ where: { id: uploadId, deletedAt: null } });
        if (!uploadRow) throw new NotFoundException('FinancialUpload not found');
        const diagnosisRow = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
        if (!diagnosisRow) throw new NotFoundException('FinancialDiagnosis not found');
        if (uploadRow.financialDiagnosisId !== diagnosisRow.id) {
          throw new ForbiddenException('Upload não pertence a esse diagnóstico.');
        }
        if (!isHQ(actor.role) && actor.tenantId !== diagnosisRow.tenantId) {
          throw new ForbiddenException('Tenant scope violation');
        }
        if (diagnosisRow.analysisType !== 'individual') {
          throw new BadRequestException(
            `analysisType '${diagnosisRow.analysisType}' ainda não é suportado pela montagem de demonstrações (só 'individual').`,
          );
        }
        const lines = diagnosisRow.accountPlanId
          ? await tx.financialAccountPlanLine.findMany({ where: { accountPlanId: diagnosisRow.accountPlanId }, take: 20000 })
          : [];
        return { upload: uploadRow, diagnosis: diagnosisRow, planLines: lines };
      },
    );

    const fileBuffer = await this.storage.getFile(upload.fileUrl);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    // Vazão do resultado líquido da DRE para uma conta do PL, sem
    // encerramento formal — porta de importConfig.pl_account_code /
    // pl_canonical_key do original (buildFinancialStatements/entry.ts).
    // Balancetes "abertos" (não encerrados) só fecham a equação contábil
    // (Ativo = Passivo + PL) depois que o resultado do período é somado à
    // conta do PL indicada; isso não é um erro de dados, é o comportamento
    // contábil esperado. O usuário escolhe essa conta no ImportConfigModal
    // e ela já é persistida em upload.notes (JSON) na criação do upload —
    // aqui só lemos de volta o que já está gravado.
    let importConfig: { pl_account_code?: string | null; pl_canonical_key?: string | null; column_label?: string | null } = {};
    try {
      importConfig = JSON.parse(upload.notes || '{}');
    } catch {
      importConfig = {};
    }
    const plAccountCode = importConfig.pl_account_code ?? null;
    const plCanonicalKey = importConfig.pl_canonical_key ?? null;
    // column_label (ex: "Anual/2023") é o que o usuário escolheu no import —
    // é a única forma confiável de saber se essa coluna é anual/trimestral/
    // YTD, já que o cabeçalho do Excel em si (normalmente "closing_balance")
    // não carrega essa informação. Ver deriveColumnMeta().
    const columnLabel = importConfig.column_label ?? null;

    const parsed = this.parseAndCompute(fileBuffer, planLines, periodOverride ?? null, plAccountCode, plCanonicalKey, columnLabel);

    const unbalancedPeriods = Object.entries(parsed.byPeriod).filter(([, p]) => !p.engineResult.bp.balanced);
    if (unbalancedPeriods.length > 0) {
      const details = unbalancedPeriods
        .map(([period, p]) => `${period}: Ativo=${p.engineResult.bp.totalAtivo ?? 'indisponível'} vs Passivo+PL=${p.engineResult.bp.totalPassivoPl ?? 'indisponível'} (diferença ${p.engineResult.bp.difference ?? '?'})`)
        .join(' | ');
      // Diagnóstico: sem isso, uma falha de fechamento do BP é uma caixa
      // preta — não dá pra saber se é "nenhuma conta foi mapeada pra rubrica
      // canônica" (problema de classificação/plano de contas) ou "contas
      // mapeadas mas os números não fecham" (problema no arquivo em si).
      // Os mappingResolutions em si não são persistidos quando o build falha
      // (só a transação de sucesso grava — ver comentário no topo do
      // arquivo), então resumimos aqui no próprio erro.
      const totalAccounts = parsed.mappingResolutions.length;
      const mappedAccounts = parsed.mappingResolutions.filter((m) => m.canonicalKey).length;
      const sampleUnmapped = parsed.mappingResolutions
        .filter((m) => !m.canonicalKey)
        .slice(0, 8)
        .map((m) => m.accountCode)
        .join(', ');
      const mappingSummary =
        totalAccounts === 0
          ? 'Nenhuma conta foi lida do balancete (verifique a coluna de código da conta).'
          : `${mappedAccounts}/${totalAccounts} conta(s) mapeada(s) para rubrica canônica.` +
            (mappedAccounts < totalAccounts ? ` Sem mapeamento: ${sampleUnmapped}${totalAccounts - mappedAccounts > 8 ? '…' : ''}` : '');
      const run = (await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialProcessingRun.create({
          data: {
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            financialUploadId: upload.id,
            operationType: 'build_statements',
            operationKey: `build_statements:${upload.id}:${checksum}:failed:${Date.now()}`,
            status: 'failed',
            completedAt: new Date(),
            triggeredBy: actor.email,
            inputChecksum: checksum,
            errorDetails: { code: 'BP_ACCOUNTING_EQUATION_MISMATCH', details, mappedAccounts, totalAccounts },
          },
        }),
      )) as { id: string };
      await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialUpload.update({ where: { id: upload.id }, data: { uploadStatus: 'validation_failed' } }),
      );
      throw new BadRequestException(
        `O Balanço Patrimonial não fecha (Ativo ≠ Passivo + PL) — corrija o balancete antes de montar as demonstrações. ${details} — ${mappingSummary} (run ${run.id})`,
      );
    }

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, diagnosis.tenantId);

      const run = await tx.financialProcessingRun.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          financialUploadId: upload.id,
          operationType: 'build_statements',
          operationKey: `build_statements:${upload.id}:${checksum}`,
          status: 'succeeded',
          completedAt: new Date(),
          triggeredBy: actor.email,
          inputChecksum: checksum,
          resultSummary: {
            registry_version: FINANCIAL_REGISTRY_VERSION,
            formula_version: FINANCIAL_FORMULA_VERSION,
            output_checksum: checksum,
            periods: Object.keys(parsed.byPeriod),
          },
        },
      });

      // Supersede — igual ao original (supersedePrevious em
      // buildFinancialStatements/entry.ts): escopado por ESTE upload (não
      // pelo diagnóstico inteiro), exceto DFC, que é sempre recalculada
      // cruzando todos os períodos e por isso é sempre superseded por
      // completo. Bug corrigido: a versão anterior superseded tudo do
      // diagnóstico em qualquer build — num diagnóstico com um upload por
      // período (comum: um Excel por ano), reprocessar todos os uploads em
      // sequência fazia cada build apagar o resultado do build anterior,
      // sobrando só o último período processado.
      const periodsInBuild = Object.keys(parsed.byPeriod);
      await Promise.all([
        tx.financialStatementLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, financialUploadId: upload.id, publicationStatus: 'active', statementCode: { not: 'DFC' } },
          data: { publicationStatus: 'superseded', supersededAt: new Date() },
        }),
        // FinancialIndicatorSnapshot não tem financial_upload_id no schema —
        // escopa pelos períodos deste build (equivalente na prática).
        tx.financialIndicatorSnapshot.updateMany({
          where: { financialDiagnosisId: diagnosis.id, publicationStatus: 'active', period: { in: periodsInBuild } },
          data: { publicationStatus: 'superseded', supersededAt: new Date() },
        }),
        tx.financialStatementLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, publicationStatus: 'active', statementCode: 'DFC' },
          data: { publicationStatus: 'superseded', supersededAt: new Date() },
        }),
        tx.financialDfcCompositionLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, publicationStatus: 'active' },
          data: { publicationStatus: 'superseded' },
        }),
        tx.financialTrialBalanceLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, financialUploadId: upload.id, publicationStatus: 'active' },
          data: { publicationStatus: 'superseded' },
        }),
        tx.financialMappingResolution.updateMany({
          where: { financialDiagnosisId: diagnosis.id, financialUploadId: upload.id, publicationStatus: 'active' },
          data: { publicationStatus: 'superseded' },
        }),
      ]);

      const now = new Date();
      const statementLines: Array<Record<string, unknown>> = [];
      const indicatorSnapshots: Array<Record<string, unknown>> = [];

      for (const [period, data] of Object.entries(parsed.byPeriod)) {
        const { values } = data.engineResult;
        for (const [key, value] of Object.entries(values)) {
          if (value === null || value === undefined) continue;
          // Aliases legados de DRE (resultado_antes_ir, resultado_operacional,
          // resultado_financeiro_liquido) não têm entrada própria em
          // CANONICAL_META — resolve via DRE_DERIVED_ALIASES pra achar a meta
          // da chave calculada real, mas persiste sob o NOME DO ALIAS (abaixo,
          // canonicalKey: key), que é o que o frontend (DRE_FORMULAS/
          // DRE_CALCULATED_AFTER_GROUP) efetivamente consulta. Sem isso essas
          // três linhas nunca viravam registro nenhum — "Resultado Antes dos
          // Impostos" ficava sempre em branco no DRE.
          const meta = CANONICAL_META[key] ?? (DRE_DERIVED_ALIASES[key] ? CANONICAL_META[DRE_DERIVED_ALIASES[key]] : undefined);
          if (!meta) continue; // aliases legados sem mapeamento (total_passivo_pl etc.) não viram linha própria
          statementLines.push({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            financialUploadId: upload.id,
            processingRunId: run.id,
            period,
            columnKey: data.columnKey,
            columnLabel: data.columnLabel,
            periodType: data.periodType,
            statementCode: meta.statementCode,
            statementFamily: meta.statementCode === 'BP' ? 'balance_sheet' : 'dre',
            groupLabel: meta.group,
            rubricLabel: meta.label,
            canonicalKey: key,
            // O frontend (herdado do Base44 sem alterações) espera 'composed'
            // para linhas de rubrica normais e só usa 'calculated'/'total'
            // para os totais/subtotais (BalanceSheetView.jsx,
            // IncomeStatementView.jsx, CompositionPreview.jsx todos filtram
            // por line_type === 'composed' para decidir o que exibir como
            // linha). O registro canônico local usa 'source' para essas
            // mesmas rubricas (nome interno, sem relação com o schema do
            // Base44) — traduz aqui na escrita para não quebrar as telas.
            lineType: meta.lineType === 'source' ? 'composed' : meta.lineType,
            displayOrder: STATEMENT_TOTALS[key] ? 999 : undefined,
            value,
            datasetScope: 'individual',
            publicationStatus: 'active',
            publishedAt: now,
          });
        }

        const indicators = this.engine.calculateIndicators(values);
        for (const ind of indicators) {
          indicatorSnapshots.push({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            processingRunId: run.id,
            period,
            columnKey: data.columnKey,
            columnLabel: data.columnLabel,
            periodType: data.periodType,
            indicatorCode: ind.indicatorCode,
            value: ind.value,
            confidenceLevel: ind.confidenceLevel,
            validationCode: ind.validationCode,
            datasetScope: 'individual',
            publicationStatus: 'active',
            publishedAt: now,
          });
        }
      }

      if (statementLines.length > 0) await tx.financialStatementLine.createMany({ data: statementLines as never });
      if (indicatorSnapshots.length > 0) await tx.financialIndicatorSnapshot.createMany({ data: indicatorSnapshots as never });

      if (parsed.trialBalanceLines.length > 0) {
        await tx.financialTrialBalanceLine.createMany({
          data: parsed.trialBalanceLines.map((l) => ({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            financialUploadId: upload.id,
            processingRunId: run.id,
            accountCode: l.accountCode,
            accountName: l.accountName,
            period: l.period,
            value: l.value,
            sourceSheet: l.sourceSheet,
            sourceRow: l.sourceRow,
            publicationStatus: 'active',
          })) as never,
        });
      }
      if (parsed.mappingResolutions.length > 0) {
        await tx.financialMappingResolution.createMany({
          data: parsed.mappingResolutions.map((m) => ({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            financialUploadId: upload.id,
            processingRunId: run.id,
            accountCode: m.accountCode,
            canonicalKey: m.canonicalKey,
            mappingSource: m.mappingSource,
            blockingIssue: !m.canonicalKey,
            publicationStatus: 'active',
          })) as never,
        });
      }

      // DFC — precisa de pelo menos 2 períodos de BP (os deste build; se só
      // vier 1, buscamos o período anterior mais recente já publicado para
      // este diagnóstico, cobrindo o caso de builds em uploads separados
      // por ano).
      const dfcResult = await this.buildDfc(tx, diagnosis, run.id, parsed, planLines, now, upload.id);
      if (dfcResult.length > 0) {
        await tx.financialStatementLine.createMany({ data: dfcResult.statementLines as never });
        await tx.financialDfcCompositionLine.createMany({ data: dfcResult.compositionLines as never });
        // Supersede alertas de dfc_composicao de runs anteriores deste
        // diagnóstico antes de publicar os novos — sem isso, cada
        // build/rebuild acumula um alerta bloqueante novo por período em
        // cima dos anteriores (nunca retirados), poluindo a tela de
        // integridade com duplicatas.
        await tx.financialValidationResult.updateMany({
          where: { financialDiagnosisId: diagnosis.id, category: 'dfc_composicao', publicationStatus: 'active' },
          data: { publicationStatus: 'superseded', supersededAt: now },
        });
        if (dfcResult.validationResults.length > 0) {
          await tx.financialValidationResult.createMany({ data: dfcResult.validationResults as never });
        }
      }

      await tx.financialUpload.update({
        where: { id: upload.id },
        data: { uploadStatus: 'processed' },
      });
      await tx.financialDiagnosis.update({
        where: { id: diagnosis.id },
        data: { status: 'processed', currentProcessingSnapshotId: run.id, currentUploadId: upload.id },
      });

      return {
        success: true,
        run_id: run.id,
        periods: Object.keys(parsed.byPeriod),
        statement_lines_count: statementLines.length,
        indicator_snapshots_count: indicatorSnapshots.length,
        dfc_lines_count: dfcResult.length,
      };
    });
  }

  // ── Parsing + mapeamento + cálculo (fora da transação — I/O de Excel não deve segurar lock) ──

  private parseAndCompute(
    fileBuffer: Buffer,
    planLines: Array<{
      accountCode: string;
      canonicalKey: string | null;
      classification: string | null;
      accountName: string;
      accountType: string | null;
    }>,
    periodOverride: string | null,
    plAccountCode: string | null = null,
    plCanonicalKey: string | null = null,
    userColumnLabel: string | null = null,
  ) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
    const sheetNames = workbook.SheetNames ?? [];
    let sheetName: string | undefined = sheetNames.find((n) => n === 'Balancete');
    if (!sheetName) sheetName = sheetNames.find((n) => SHEET_ALIASES.includes(normalizeHeader(n)));
    if (!sheetName) throw new BadRequestException('Aba "Balancete" não encontrada no arquivo.');

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    if (rows.length < 2) throw new BadRequestException('Aba do balancete está vazia.');

    const headerRow = (rows[0] ?? []).map((h) => String(h ?? ''));
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));

    const codeIdx = matchColumn(headerRow, ['account_code', 'conta', 'codigo', 'cod', 'code', 'account']);
    const descIdx = matchColumn(headerRow, ['account_description', 'descricao', 'description', 'nome', 'name']);
    const typeIdx = matchColumn(headerRow, ['account_type', 'tipo', 'type']);
    const classIdx = matchColumn(headerRow, ['classification', 'classificacao', 'rubrica', 'categoria']);
    if (codeIdx === -1) throw new BadRequestException('Coluna de código da conta não encontrada.');

    const periodBlocks = this.extractPeriodBlocks(headerRow, periodOverride, userColumnLabel);
    if (periodBlocks.length === 0) {
      throw new BadRequestException(
        'Não foi possível identificar nenhuma coluna de período (saldo final) no balancete.',
      );
    }

    const planByExactCode = new Map<string, (typeof planLines)[number]>();
    for (const l of planLines) planByExactCode.set(normalizeAccountCode(l.accountCode), l);

    const findPlanBySuffix = (code: string) => {
      for (const [planCode, l] of planByExactCode) {
        if (planCode.endsWith(code) || code.endsWith(planCode)) return l;
      }
      return undefined;
    };

    const aggregated: Record<string, Record<string, number>> = {};
    for (const b of periodBlocks) aggregated[b.period] = {};

    const trialBalanceLines: Array<{ accountCode: string; accountName: string; period: string; value: number; sourceSheet: string; sourceRow: number }> = [];
    const mappingResolutions: Array<{ accountCode: string; canonicalKey: string | null; mappingSource: string }> = [];
    const seenAccounts = new Set<string>();

    dataRows.forEach((row, rowIdx) => {
      const rawCode = row[codeIdx];
      const rawName = descIdx !== -1 ? row[descIdx] : null;
      const rawType = typeIdx !== -1 ? String(row[typeIdx] ?? '').trim().toUpperCase() : '';
      if (rawCode === null || rawCode === undefined || String(rawCode).trim() === '') return;
      if (SYNTHETIC_TYPES.has(rawType)) return; // contas sintéticas não carregam saldo

      const codeNorm = normalizeAccountCode(rawCode);
      const plan = planByExactCode.get(codeNorm) ?? findPlanBySuffix(codeNorm);
      const excelClassText = classIdx !== -1 ? String(row[classIdx] ?? '') : '';

      let canonicalKey: string | undefined;
      let mappingSource = 'unmapped';
      if (plan) {
        if (plan.canonicalKey) {
          canonicalKey = plan.canonicalKey;
          mappingSource = 'account_plan';
        } else if (plan.classification) {
          canonicalKey = resolveClassification(plan.classification);
          mappingSource = canonicalKey ? 'account_plan' : 'unmapped';
        }
      }
      if (!canonicalKey && excelClassText) {
        canonicalKey = resolveClassification(excelClassText);
        mappingSource = canonicalKey ? 'excel_mapping' : 'unmapped';
      }

      if (!seenAccounts.has(codeNorm)) {
        seenAccounts.add(codeNorm);
        mappingResolutions.push({ accountCode: String(rawCode), canonicalKey: canonicalKey ?? null, mappingSource });
      }

      for (const block of periodBlocks) {
        const raw = row[block.colIndex];
        if (raw === null || raw === undefined || raw === '') continue;
        const num = Number(raw);
        if (!Number.isFinite(num)) return;

        trialBalanceLines.push({
          accountCode: String(rawCode),
          accountName: rawName ? String(rawName) : '',
          period: block.period,
          value: num,
          sourceSheet: sheetName!,
          sourceRow: rowIdx + 2,
        });

        if (!canonicalKey) continue;
        const signed = applySign(num, canonicalKey);
        aggregated[block.period][canonicalKey] = (aggregated[block.period][canonicalKey] ?? 0) + signed;
      }
    });

    // Vazão DRE→PL — resolve a canonical_key de destino para a conta de
    // "encerramento" indicada no import. Ordem de resolução igual ao
    // original: canonical_key explícito > mapeamento já resolvido da
    // própria conta do plano > classificação da conta > nome da conta.
    // Diferença deliberada do original: aqui a chave resolvida precisa já
    // existir no registro canônico estático (CANONICAL_META) — o original
    // registrava uma rubrica nova dinamicamente por request (rubricMeta era
    // um objeto local), mas aqui CANONICAL_META é compartilhado entre
    // requests/tenants, então criar uma chave nova em tempo de execução não
    // é seguro. Na prática isso não é uma limitação real: contas de PL como
    // "Lucros Acumulados" já resolvem por classificação para uma chave
    // existente (patrimonio_liquido). Se nada resolver, a vazão é
    // simplesmente ignorada — não é erro, o build segue normal.
    const resolvedPlCanonicalKey: string | null = (() => {
      if (plCanonicalKey) return plCanonicalKey;
      if (!plAccountCode) return null;
      const normalizedPl = normalizeAccountCode(plAccountCode);
      const planEntry = planByExactCode.get(normalizedPl) ?? findPlanBySuffix(normalizedPl);
      if (planEntry?.canonicalKey) return planEntry.canonicalKey;
      if (planEntry?.classification) {
        const resolved = resolveClassification(planEntry.classification);
        if (resolved) return resolved;
      }
      if (planEntry?.accountName) {
        const resolved = resolveClassification(planEntry.accountName);
        if (resolved) return resolved;
      }
      return null;
    })();

    const byPeriod: Record<
      string,
      { columnKey: string; columnLabel: string; periodType: string; engineResult: ReturnType<FinancialEngineService['buildStatements']> }
    > = {};
    for (const block of periodBlocks) {
      let engineResult = this.engine.buildStatements(aggregated[block.period]);

      // Segunda passada: soma o resultado líquido do período (já calculado
      // pela engine na primeira passada) na conta do PL indicada e
      // recalcula. A soma "lenient" de STATEMENT_TOTALS na engine já
      // propaga isso pros totais (total_patrimonio_liquido,
      // total_passivo_patrimonio_liquido etc.) automaticamente — sem
      // precisar recompor os totais na mão como o original fazia.
      if (resolvedPlCanonicalKey) {
        const resultadoLiquido = engineResult.values['resultado_liquido'];
        if (typeof resultadoLiquido === 'number' && resultadoLiquido !== 0) {
          aggregated[block.period][resolvedPlCanonicalKey] =
            (aggregated[block.period][resolvedPlCanonicalKey] ?? 0) + resultadoLiquido;
          engineResult = this.engine.buildStatements(aggregated[block.period]);
        }
      }

      byPeriod[block.period] = {
        columnKey: block.columnKey,
        columnLabel: block.columnLabel,
        periodType: block.periodType,
        engineResult,
      };
    }

    return { byPeriod, trialBalanceLines, mappingResolutions, sheetName: sheetName! };
  }

  private extractPeriodBlocks(headerRow: string[], periodOverride: string | null, userColumnLabel: string | null): ColumnBlock[] {
    const periodRegex = /(20\d{2})[-/](\d{2})|(\d{2})[-/](20\d{2})/;
    const closingPatterns = ['closing_balance', 'saldo final', 'saldofinal', 'closing'];
    const blocks: ColumnBlock[] = [];

    headerRow.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      const isClosing = closingPatterns.some((p) => norm.includes(p));
      const match = String(h ?? '').match(periodRegex);
      let period: string | undefined;
      if (match) {
        period = match[1] ? `${match[1]}-${match[2]}` : `${match[4]}-${match[3]}`;
      } else if (isClosing && periodOverride) {
        period = periodOverride;
      }
      if (!period) return;
      if (!isClosing && !match) return;

      const meta = deriveColumnMeta(userColumnLabel, period);
      blocks.push({
        period,
        columnKey: meta.columnKey,
        columnLabel: meta.columnLabel,
        periodType: meta.periodType,
        colIndex: idx,
      });
    });

    // dedup por período (fica com a primeira coluna encontrada)
    const seen = new Set<string>();
    return blocks.filter((b) => (seen.has(b.period) ? false : (seen.add(b.period), true)));
  }

  // ── DFC indireta ────────────────────────────────────────────────────────

  private async buildDfc(
    tx: any,
    diagnosis: { id: string; tenantId: string },
    processingRunId: string,
    parsed: ReturnType<FinancialStatementsService['parseAndCompute']>,
    planLines: Array<{ accountCode: string; canonicalKey: string | null; dfcClassification: string | null }>,
    now: Date,
    uploadId: string | null = null,
  ): Promise<{ length: number; statementLines: Array<Record<string, unknown>>; compositionLines: Array<Record<string, unknown>>; validationResults: Array<Record<string, unknown>> }> {
    const overridesByKey = new Map<string, string>();
    const overrides = await tx.financialDfcClassificationOverride.findMany({
      where: { financialDiagnosisId: diagnosis.id, status: 'active' },
    });
    for (const o of overrides as Array<{ canonicalKey: string; manualBucket: string }>) {
      overridesByKey.set(o.canonicalKey, o.manualBucket);
    }

    const manualAdjustments = await tx.financialDfcManualAdjustment.findMany({
      where: { financialDiagnosisId: diagnosis.id },
    });
    const manualByPeriod = new Map<string, { operating: number; investing: number; financing: number }>();
    for (const adj of manualAdjustments as Array<{ activity: string; value: unknown; period: string; columnKey?: string | null }>) {
      // DfcManualAdjustmentDialog.jsx grava `period` como o column_key
      // selecionado pelo usuário (ex: "A-2025"), não o período cru
      // ("2025") que este método usa como chave de bpByPeriod/allPeriods.
      // Indexa pelas duas formas (período cru E column_key, quando
      // diferentes) pra o lookup abaixo (por currPeriod) bater sempre,
      // não importa qual formato foi persistido — sem isso o ajuste é
      // salvo e aparece como linha na tela, mas nunca soma no total
      // (bug: "inserido, mas a DFC não foi recalculada").
      const v = Number(adj.value);
      for (const key of new Set([adj.period, adj.columnKey].filter((k): k is string => !!k))) {
        const bucket = manualByPeriod.get(key) ?? { operating: 0, investing: 0, financing: 0 };
        if (adj.activity === 'operating') bucket.operating += v;
        else if (adj.activity === 'investing') bucket.investing += v;
        else if (adj.activity === 'financing') bucket.financing += v;
        manualByPeriod.set(key, bucket);
      }
    }

    // BP desta build, por período: { canonicalKey: value }
    const bpByPeriodNew: Record<string, Record<string, number>> = {};
    for (const [period, data] of Object.entries(parsed.byPeriod)) {
      bpByPeriodNew[period] = {};
      for (const [k, v] of Object.entries(data.engineResult.values)) {
        if (v !== null && CANONICAL_META[k]?.statementCode === 'BP') bpByPeriodNew[period][k] = v;
      }
    }
    const newPeriods = Object.keys(bpByPeriodNew).sort();

    // Períodos anteriores já publicados para este diagnóstico (para o caso
    // cross-upload: só 1 período novo, mas já existe BP de anos anteriores).
    // Igual ao original (buildFinancialStatements V2, bloco "DFC cross-upload"):
    // também carrega colMeta (column_key/label/period_type) desses períodos,
    // já que este build não tem essa informação para períodos que não são
    // dele.
    const priorLines = await tx.financialStatementLine.findMany({
      where: {
        financialDiagnosisId: diagnosis.id,
        statementCode: 'BP',
        publicationStatus: 'active',
        period: { notIn: newPeriods },
      },
    });
    const bpByPeriodPrior: Record<string, Record<string, number>> = {};
    const colMetaByPeriodPrior: Record<string, { columnKey: string | null; columnLabel: string | null; periodType: string | null }> = {};
    for (const l of priorLines as Array<{ period: string; canonicalKey: string; value: unknown; columnKey: string | null; columnLabel: string | null; periodType: string | null }>) {
      bpByPeriodPrior[l.period] = bpByPeriodPrior[l.period] ?? {};
      bpByPeriodPrior[l.period][l.canonicalKey] = Number(l.value);
      if (!colMetaByPeriodPrior[l.period]) {
        colMetaByPeriodPrior[l.period] = { columnKey: l.columnKey, columnLabel: l.columnLabel, periodType: l.periodType };
      }
    }

    // Resultado líquido e depreciação/amortização (para "ajustes sem efeito
    // caixa") dos períodos de OUTROS uploads — sem isso, a DFC de um período
    // histórico recalculada aqui (ver loop abaixo) ficaria com essas duas
    // linhas zeradas. Vêm de FinancialStatementLine (DRE) porque não
    // reprocessamos o Excel de uploads antigos aqui.
    const priorDreLines = await tx.financialStatementLine.findMany({
      where: {
        financialDiagnosisId: diagnosis.id,
        statementCode: 'DRE',
        publicationStatus: 'active',
        period: { notIn: newPeriods },
        canonicalKey: { in: ['resultado_liquido', 'depreciacao_amortizacao'] },
      },
    });
    const netIncomeByPeriodPrior: Record<string, number> = {};
    const nonCashAdjByPeriodPrior: Record<string, number> = {};
    for (const l of priorDreLines as Array<{ period: string; canonicalKey: string; value: unknown }>) {
      if (l.canonicalKey === 'resultado_liquido') netIncomeByPeriodPrior[l.period] = Number(l.value);
      else if (l.canonicalKey === 'depreciacao_amortizacao') nonCashAdjByPeriodPrior[l.period] = -Number(l.value);
    }

    const allPeriods = Array.from(new Set([...Object.keys(bpByPeriodNew), ...Object.keys(bpByPeriodPrior)])).sort();
    const bpByPeriod: Record<string, Record<string, number>> = { ...bpByPeriodPrior, ...bpByPeriodNew };

    const statementLines: Array<Record<string, unknown>> = [];
    const compositionLines: Array<Record<string, unknown>> = [];
    const validationResults: Array<Record<string, unknown>> = [];

    for (let i = 1; i < allPeriods.length; i++) {
      const prevPeriod = allPeriods[i - 1];
      const currPeriod = allPeriods[i];
      // Recalcula TODOS os pares de período, não só os que envolvem o
      // upload deste build. Motivo: supersedePrevious() desativa a DFC
      // inteira do diagnóstico a cada build (statementCode:'DFC' não é
      // escopado por upload — ver comentário acima, e igual ao original
      // em supersedePrevious()/buildFinancialStatements/entry.ts). Pular
      // os pares "só históricos" aqui deixava esses pares sem nenhuma
      // linha ativa depois do build seguinte — com 3 períodos importados
      // um de cada vez, só a DFC do último par sobrevivia (bug real:
      // "3 períodos, deveriam ser 2 DFCs, só aparecia 1").
      const prevBp = bpByPeriod[prevPeriod] ?? {};
      const currBp = bpByPeriod[currPeriod] ?? {};
      const allKeys = new Set([...Object.keys(prevBp), ...Object.keys(currBp)]);

      let operatingAssetVariation = 0;
      let operatingLiabilityVariation = 0;
      let investingCashFlow = 0;
      let financingCashFlow = 0;
      let cashInitial = 0;
      let cashFinal = 0;
      // Contas sem bucket de caixa (ignored/requires_review/not_applicable)
      // não somem mais silenciosamente: toda variação real delas é somada
      // aqui e divulgada como linha própria ("Movimentações Patrimoniais/
      // Contábeis Não Identificadas"), sem entrar automaticamente em
      // nenhuma atividade de caixa (decisão do usuário — evita "plug
      // sofisticado" que fecha a matemática mas pode estar financeiramente
      // errado). Exclui totalizadores de BP (total_ativo etc.): eles também
      // caem em 'requires_review' por não terem dfcTreatment próprio, mas
      // são somas de outras contas já processadas — incluí-los aqui
      // duplicaria toda a movimentação.
      let unidentifiedMovementRaw = 0;

      for (const key of allKeys) {
        const prev = prevBp[key] ?? 0;
        const curr = currBp[key] ?? 0;
        const delta = curr - prev;
        const bucket = classifyDfcBucket(key, overridesByKey.get(key));
        let impact = 0;
        if (bucket === 'cash') {
          cashInitial += prev;
          cashFinal += curr;
        } else if (bucket === 'operating_asset') {
          impact = -delta;
          operatingAssetVariation += impact;
        } else if (bucket === 'operating_liability') {
          impact = delta;
          operatingLiabilityVariation += impact;
        } else if (bucket === 'investing') {
          impact = -delta;
          investingCashFlow += impact;
        } else if (bucket === 'financing') {
          impact = delta;
          financingCashFlow += impact;
        } else if ((bucket === 'ignored' || bucket === 'requires_review' || bucket === 'not_applicable') && !STATEMENT_TOTALS[key]) {
          unidentifiedMovementRaw += delta;
        }

        if (bucket !== 'ignored' && bucket !== 'not_applicable' && (prev !== 0 || curr !== 0)) {
          compositionLines.push({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            processingRunId,
            period: currPeriod,
            rubricKey: key,
            rubricLabel: CANONICAL_META[key]?.label,
            canonicalKey: key,
            bucket,
            bucketSource: overridesByKey.has(key) ? 'manual_override' : 'registry',
            previousValue: prev,
            currentValue: curr,
            delta,
            impactOnDfc: impact,
            datasetScope: 'individual',
            publicationStatus: 'active',
          });
        }
      }

      // currPeriod pode não ser deste build (ver comentário acima) — nesse
      // caso usa o resultado_liquido/depreciação já publicados (DRE) desse
      // período, carregados em priorDreLines. getNetIncome() generaliza essa
      // busca pra qualquer período (precisamos do ANTERIOR agora também,
      // ver unidentifiedMovementRaw abaixo).
      const getNetIncome = (period: string): number =>
        parsed.byPeriod[period]?.engineResult.values.resultado_liquido ?? netIncomeByPeriodPrior[period] ?? 0;
      const netIncome = getNetIncome(currPeriod);
      const nonCashAdjustments =
        currPeriod in parsed.byPeriod
          ? -(parsed.byPeriod[currPeriod]?.engineResult.values.depreciacao_amortizacao ?? 0)
          : (nonCashAdjByPeriodPrior[currPeriod] ?? 0);
      const currColumnKey = parsed.byPeriod[currPeriod]?.columnKey ?? colMetaByPeriodPrior[currPeriod]?.columnKey ?? null;
      const manual =
        manualByPeriod.get(currPeriod) ??
        (currColumnKey ? manualByPeriod.get(currColumnKey) : undefined) ??
        { operating: 0, investing: 0, financing: 0 };
      operatingAssetVariation += 0;
      const operatingCashFlow = (netIncome ?? 0) + nonCashAdjustments + operatingAssetVariation + operatingLiabilityVariation + manual.operating;
      investingCashFlow += manual.investing;
      financingCashFlow += manual.financing;
      const cashVariationCalculated = operatingCashFlow + investingCashFlow + financingCashFlow;
      const cashVariationReal = cashFinal - cashInitial;

      // "Vazão DRE→PL" (ver parseAndCompute acima, ~linha 611-624): o
      // resultado líquido de CADA período já foi somado à conta de PL de
      // fechamento configurada pro diagnóstico, pra o BP bater (Ativo =
      // Passivo + PL) antes do encerramento formal. Isso contamina a
      // variação bruta dessa conta entre dois períodos com a DIFERENÇA
      // entre os dois resultados líquidos — sem descontar isso, qualquer
      // movimentação real de patrimônio nessa conta fica escondida atrás
      // dessa diferença (ex.: resultado de -18,6M num período e +29,5M no
      // outro cria ~48M de "ruído" que nunca é patrimônio de verdade).
      // Descontar (currNetIncome - prevNetIncome) UMA vez do total já
      // isola a movimentação pura, não importa qual conta específica
      // recebeu a vazão.
      const netIncomeDelta = netIncome - getNetIncome(prevPeriod);
      const unidentifiedMovement = Math.round((unidentifiedMovementRaw - netIncomeDelta) * 100) / 100;

      // Identidade contábil completa (Ativo = Passivo + PL, com cash
      // isolado): Δcaixa = Δpassivo_operacional + Δpassivo_financiamento +
      // Δcapital(financing) + Δprejuizos_RAW(ignored) − Δativo_operacional
      // − Δativo_investimento. cashVariationCalculated já soma netIncome +
      // ajustes não-caixa + variação de WC + investimento + financiamento
      // — ou seja, netIncome (e os ajustes não-caixa) SÓ entram por esse
      // caminho. unidentifiedMovementRaw é a variação BRUTA da conta de PL
      // que recebe a "vazão DRE→PL" (patrimonio_prejuizos) e por isso já
      // embute esse MESMO netIncome de novo (ver comentário acima, ~linha
      // 881). Somar cashVariationCalculated + unidentifiedMovementRaw sem
      // corrigir isso conta o resultado do período DUAS vezes — daí
      // "diff" nunca fechar (ficava preso em |netIncome|, gerando alerta
      // bloqueante mesmo com tudo corretamente capturado). Subtrair
      // netIncome + nonCashAdjustments antes de somar o bruto remove essa
      // segunda contagem e fecha a identidade em ~0 (verificado
      // numericamente). "diff" vira então uma checagem de integridade
      // pura: só sobra resíduo se alguma conta ficou fora do registro
      // canônico ou há erro de arredondamento — não esperado, e esse sim
      // deve travar a versão definitiva do relatório.
      const diff =
        Math.round(Math.abs(cashVariationCalculated - netIncome - nonCashAdjustments - cashVariationReal + unidentifiedMovementRaw) * 100) / 100;

      const dfcRows: Array<[string, string, number]> = [
        ['dfc_resultado_liquido', 'Resultado líquido do exercício', netIncome ?? 0],
        ['dfc_ajustes_nao_caixa', '(+) Ajustes de itens sem efeito caixa', nonCashAdjustments],
        ['dfc_variacao_ativos_operacionais', '(+/-) Variação de ativos operacionais', operatingAssetVariation],
        ['dfc_variacao_passivos_operacionais', '(+/-) Variação de passivos operacionais', operatingLiabilityVariation],
        ['dfc_caixa_liquido_atividades_operacionais', 'Caixa líquido das atividades operacionais', operatingCashFlow],
        ['dfc_caixa_liquido_atividades_investimento', 'Caixa líquido das atividades de investimento', investingCashFlow],
        ['dfc_caixa_liquido_atividades_financiamento', 'Caixa líquido das atividades de financiamento', financingCashFlow],
        ['dfc_variacao_liquida_caixa', 'Variação líquida de caixa e equivalentes', cashVariationCalculated],
        ['dfc_saldo_inicial_caixa', 'Saldo inicial de caixa e equivalentes', cashInitial],
        ['dfc_saldo_final_caixa', 'Saldo final de caixa e equivalentes', cashFinal],
        // Divulgada sempre (mesmo quando zero) — não é somada a nenhuma
        // atividade de caixa; representa contas de PL/BP sem classificação
        // de DFC (ou com vazão de resultado descontada) que precisam de
        // revisão manual antes da versão definitiva do relatório.
        ['dfc_movimentacoes_nao_identificadas', 'Movimentações patrimoniais não identificadas', unidentifiedMovement],
        ['dfc_diferenca_validacao', 'Diferença de validação (calc. vs. real, já líquida do não identificado)', diff],
      ];

      dfcRows.forEach(([key, label, value], order) => {
        statementLines.push({
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          processingRunId,
          period: currPeriod,
          columnKey: parsed.byPeriod[currPeriod]?.columnKey ?? colMetaByPeriodPrior[currPeriod]?.columnKey ?? null,
          columnLabel: parsed.byPeriod[currPeriod]?.columnLabel ?? colMetaByPeriodPrior[currPeriod]?.columnLabel ?? null,
          periodType: parsed.byPeriod[currPeriod]?.periodType ?? colMetaByPeriodPrior[currPeriod]?.periodType ?? null,
          statementCode: 'DFC',
          statementFamily: 'cash_flow',
          groupLabel: 'DFC',
          rubricLabel: label,
          canonicalKey: key,
          lineType: key.includes('caixa_liquido') || key.includes('saldo') || key === 'dfc_variacao_liquida_caixa' ? 'total' : 'composed',
          displayOrder: order,
          value,
          datasetScope: 'individual',
          publicationStatus: 'active',
          publishedAt: now,
        });
      });

      // Gate de reconciliação: dispara só quando sobra resíduo ALÉM do que
      // já está divulgado em "Movimentações Patrimoniais Não
      // Identificadas" — ou seja, uma inconsistência nova/real (conta fora
      // do registro canônico, arredondamento etc.), não o caso normal de
      // ter um item pendente de classificação manual (esse já está
      // visível na própria linha divulgada, sem precisar de alerta
      // bloqueante separado). Exige um financialUploadId válido
      // (constraint do schema) — nos poucos casos em que o diagnóstico não
      // tem nenhum upload associado (não deveria acontecer em prática),
      // pula o registro do alerta em vez de falhar o build inteiro por
      // causa só da validação.
      if (diff > DFC_TOLERANCE && uploadId) {
        validationResults.push({
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          financialUploadId: uploadId,
          processingRunId,
          severity: 'error',
          category: 'dfc_composicao',
          code: 'DFC_RECONCILIATION_MISMATCH',
          title: 'DFC não reconcilia com o saldo de caixa do balanço',
          message: `A diferença entre o fluxo de caixa calculado e a variação real do saldo de caixa em ${currPeriod} é de R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, além do que já está divulgado em "Movimentações patrimoniais não identificadas". Investigue antes de finalizar o relatório.`,
          blocking: true,
          publicationStatus: 'active',
          publishedAt: now,
        });
      }
    }

    return { length: statementLines.length, statementLines, compositionLines, validationResults };
  }

  // ── Ajustes manuais de DFC ──────────────────────────────────────────
  // Porta de manageDfcManualAdjustment/entry.ts (Base44): lá o CRUD e o
  // recálculo da DFC ("dfc_only") eram uma coisa só, com compensação
  // manual em caso de falha do recálculo. Aqui dividimos em métodos
  // menores mas preservamos o mesmo contrato: toda escrita em
  // FinancialDfcManualAdjustment é seguida de um rebuildDfcOnly, e se o
  // rebuild falhar a escrita é desfeita (o ajuste nunca fica "órfão",
  // gravado mas sem efeito nenhum na DFC publicada).

  /**
   * Recalcula só a DFC (sem reprocessar Excel/BP/DRE) usando as linhas de
   * BP/DRE já ativas do diagnóstico + os ajustes manuais atualmente
   * cadastrados. Usa buildDfc() com parsed.byPeriod vazio — isso faz
   * buildDfc tratar TODOS os períodos como "anteriores" (bpByPeriodPrior/
   * priorDreLines), cobrindo o diagnóstico inteiro a partir do que já está
   * publicado, igual ao ramo dfc_only do original.
   */
  async rebuildDfcOnly(actor: AuthUser, diagnosisId: string) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, diagnosis.tenantId);

      // resolveOutputScope() (financial-output.service.ts) exige um
      // output_checksum não-vazio no resultSummary do run apontado por
      // currentProcessingSnapshotId — sem isso ele devolve
      // CURRENT_FINANCIAL_SNAPSHOT_INVALID e a tela inteira de
      // demonstrações (não só a DFC) cai em "ainda não disponíveis"/
      // "Composição da DFC indisponível". Um build normal usa o checksum
      // do Excel; aqui não há arquivo novo, então geramos um a partir do
      // id do run + timestamp só pra satisfazer esse contrato.
      const rebuildChecksum = createHash('sha256').update(`rebuild_dfc:${diagnosis.id}:${Date.now()}`).digest('hex');

      const run = await tx.financialProcessingRun.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          financialUploadId: diagnosis.currentUploadId ?? null,
          operationType: 'rebuild_dfc',
          operationKey: `rebuild_dfc:${diagnosis.id}:${Date.now()}`,
          status: 'succeeded',
          completedAt: new Date(),
          triggeredBy: actor.email,
          inputChecksum: rebuildChecksum,
          resultSummary: {
            registry_version: FINANCIAL_REGISTRY_VERSION,
            formula_version: FINANCIAL_FORMULA_VERSION,
            output_checksum: rebuildChecksum,
          },
        },
      });

      await Promise.all([
        tx.financialStatementLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, publicationStatus: 'active', statementCode: 'DFC' },
          data: { publicationStatus: 'superseded', supersededAt: new Date() },
        }),
        tx.financialDfcCompositionLine.updateMany({
          where: { financialDiagnosisId: diagnosis.id, publicationStatus: 'active' },
          data: { publicationStatus: 'superseded' },
        }),
      ]);

      const now = new Date();
      const emptyParsed = { byPeriod: {} } as unknown as ReturnType<FinancialStatementsService['parseAndCompute']>;
      const dfcResult = await this.buildDfc(tx, diagnosis, run.id, emptyParsed, [], now, diagnosis.currentUploadId ?? null);
      if (dfcResult.length > 0) {
        await tx.financialStatementLine.createMany({ data: dfcResult.statementLines as never });
        await tx.financialDfcCompositionLine.createMany({ data: dfcResult.compositionLines as never });
        await tx.financialValidationResult.updateMany({
          where: { financialDiagnosisId: diagnosis.id, category: 'dfc_composicao', publicationStatus: 'active' },
          data: { publicationStatus: 'superseded', supersededAt: now },
        });
        if (dfcResult.validationResults.length > 0) {
          await tx.financialValidationResult.createMany({ data: dfcResult.validationResults as never });
        }
      }

      // A DFC é diagnóstico-inteiro (não por upload), mas o "ponteiro"
      // currentProcessingSnapshotId precisa apontar pro build mais recente
      // pra useCurrentFinancialOutputScope enxergar essa DFC nova —
      // currentUploadId não muda (nenhum upload novo entrou aqui).
      await tx.financialDiagnosis.update({
        where: { id: diagnosis.id },
        data: { currentProcessingSnapshotId: run.id },
      });

      return { success: true, run_id: run.id, dfc_lines_count: dfcResult.length };
    });
  }

  private async loadDiagnosisForWrite(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      return diagnosis;
    });
  }

  async createDfcManualAdjustment(
    actor: AuthUser,
    dto: {
      financialDiagnosisId: string;
      financialUploadId?: string | null;
      activity: string;
      label: string;
      value: number;
      period: string;
      columnKey?: string | null;
      adjustmentType?: string | null;
      justification: string;
      notes?: string | null;
    },
  ) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    const diagnosis = await this.loadDiagnosisForWrite(actor, dto.financialDiagnosisId);

    // Cast explícito: o Prisma Client deste ambiente foi gerado antes dos
    // campos label/column_key/financial_upload_id/adjustment_type/
    // justification existirem no schema (ver comentário no topo do
    // arquivo sobre a limitação de rede do sandbox pra rodar `prisma
    // generate`/`migrate` aqui — isso roda de verdade no ambiente do
    // usuário). Sem o cast, o TS enxerga o tipo antigo do model e reclama
    // de campo inexistente nas linhas abaixo que leem essas colunas de
    // volta.
    const created = (await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          financialUploadId: dto.financialUploadId ?? null,
          activity: dto.activity,
          label: dto.label,
          value: dto.value,
          period: dto.period,
          columnKey: dto.columnKey ?? dto.period,
          adjustmentType: dto.adjustmentType ?? null,
          justification: dto.justification,
          notes: dto.notes ?? null,
          createdBy: actor.email,
        } as never,
      }),
    )) as DfcManualAdjustmentRow;

    try {
      const rebuild = await this.rebuildDfcOnly(actor, diagnosis.id);
      return { adjustment: created, ...rebuild };
    } catch (err) {
      await this.prisma
        .withTenantContext(this.rlsOpts(actor), (tx) => tx.financialDfcManualAdjustment.delete({ where: { id: created.id } }))
        .catch(() => null);
      throw err;
    }
  }

  async updateDfcManualAdjustment(
    actor: AuthUser,
    adjustmentId: string,
    dto: {
      financialDiagnosisId: string;
      activity?: string;
      label?: string;
      value?: number;
      period?: string;
      columnKey?: string | null;
      adjustmentType?: string | null;
      justification?: string;
      notes?: string | null;
    },
  ) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    const diagnosis = await this.loadDiagnosisForWrite(actor, dto.financialDiagnosisId);

    const previous = (await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.findFirst({ where: { id: adjustmentId, financialDiagnosisId: diagnosis.id } }),
    )) as DfcManualAdjustmentRow | null;
    if (!previous) throw new NotFoundException('Ajuste manual de DFC não encontrado');

    const updated = (await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.update({
        where: { id: adjustmentId },
        data: {
          activity: dto.activity ?? previous.activity,
          label: dto.label ?? previous.label,
          value: dto.value ?? previous.value,
          period: dto.period ?? previous.period,
          columnKey: dto.columnKey ?? previous.columnKey,
          adjustmentType: dto.adjustmentType ?? previous.adjustmentType,
          justification: dto.justification ?? previous.justification,
          notes: dto.notes ?? previous.notes,
        } as never,
      }),
    )) as DfcManualAdjustmentRow;

    try {
      const rebuild = await this.rebuildDfcOnly(actor, diagnosis.id);
      return { adjustment: updated, ...rebuild };
    } catch (err) {
      await this.prisma
        .withTenantContext(this.rlsOpts(actor), (tx) =>
          tx.financialDfcManualAdjustment.update({
            where: { id: adjustmentId },
            data: {
              activity: previous.activity,
              label: previous.label,
              value: previous.value,
              period: previous.period,
              columnKey: previous.columnKey,
              adjustmentType: previous.adjustmentType,
              justification: previous.justification,
              notes: previous.notes,
            } as never,
          }),
        )
        .catch(() => null);
      throw err;
    }
  }

  async deleteDfcManualAdjustment(actor: AuthUser, adjustmentId: string, financialDiagnosisId: string) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    const diagnosis = await this.loadDiagnosisForWrite(actor, financialDiagnosisId);

    const previous = (await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.findFirst({ where: { id: adjustmentId, financialDiagnosisId: diagnosis.id } }),
    )) as DfcManualAdjustmentRow | null;
    if (!previous) return { success: true, already_deleted: true, run_id: null as string | null };

    await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.delete({ where: { id: adjustmentId } }),
    );

    try {
      const rebuild = await this.rebuildDfcOnly(actor, diagnosis.id);
      return { already_deleted: false, ...rebuild };
    } catch (err) {
      await this.prisma
        .withTenantContext(this.rlsOpts(actor), (tx) =>
          tx.financialDfcManualAdjustment.create({
            data: {
              tenantId: previous.tenantId,
              financialDiagnosisId: previous.financialDiagnosisId,
              financialUploadId: previous.financialUploadId,
              activity: previous.activity,
              label: previous.label,
              value: previous.value,
              period: previous.period,
              columnKey: previous.columnKey,
              adjustmentType: previous.adjustmentType,
              justification: previous.justification,
              notes: previous.notes,
              createdBy: previous.createdBy,
            } as never,
          }),
        )
        .catch(() => null);
      throw err;
    }
  }
}

/**
 * Ver comentário em createDfcManualAdjustment: shape de leitura de
 * FinancialDfcManualAdjustment usado só pra contornar o Prisma Client
 * gerado antes dos campos novos existirem no schema neste sandbox.
 */
export interface DfcManualAdjustmentRow {
  id: string;
  tenantId: string;
  financialDiagnosisId: string;
  financialUploadId: string | null;
  activity: string;
  label: string | null;
  value: unknown;
  period: string;
  columnKey: string | null;
  adjustmentType: string | null;
  justification: string | null;
  notes: string | null;
  createdBy: string | null;
}
