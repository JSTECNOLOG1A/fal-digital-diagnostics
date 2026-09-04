import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as XLSX from 'xlsx';
import { canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/auth.types';

/**
 * Porta local de validateFinancialUpload (função serverless Base44,
 * 671 linhas no original). Mesmas regras de negócio (colunas obrigatórias/
 * recomendadas/opcionais, checagem de período, cruzamento com o plano de
 * contas), mas usando uma transação Postgres real em vez do mecanismo de
 * "candidate → active → superseded/invalid" com rollback manual do
 * original — uma transação de banco já dá atomicidade de graça, então essa
 * parte foi simplificada (não é perda de funcionalidade: o resultado final
 * é o mesmo, só a forma de garantir consistência mudou).
 *
 * Fase 1: validação de sinal/canonical_key continua fora daqui (assim como
 * no original) — quem decide sinal é a engine de cálculo (Fase 2), nunca o
 * validador de upload.
 */

const MIN_DATA_ROWS = 5;

type ColumnKey =
  | 'account_code'
  | 'account_description'
  | 'classification'
  | 'closing_balance'
  | 'statement_code'
  | 'statement_group'
  | 'opening_balance'
  | 'debits'
  | 'credits'
  | 'display_order'
  | 'note_reference'
  | 'classification_source'
  | 'cash_flow_tag';

const REQUIRED_COLUMNS: Record<string, { patterns: string[] }> = {
  account_code: { patterns: ['account_code', 'conta', 'codigo', 'cod', 'code', 'account'] },
  account_description: { patterns: ['account_description', 'descricao', 'description', 'nome', 'name'] },
  classification: { patterns: ['classification', 'classificacao', 'rubrica', 'categoria'] },
  closing_balance: { patterns: ['closing_balance', 'saldo final', 'saldofinal', 'closing'] },
};

const RECOMMENDED_COLUMNS: Record<string, { patterns: string[] }> = {
  statement_code: { patterns: ['statement_code', 'demonstracao', 'demonstração', 'statement'] },
  statement_group: { patterns: ['statement_group', 'grupo_demonstracao', 'grupo gerencial', 'section'] },
  opening_balance: { patterns: ['opening_balance', 'saldo inicial', 'saldoinicial', 'opening'] },
  debits: { patterns: ['debits', 'débitos', 'debitos', 'debit'] },
  credits: { patterns: ['credits', 'créditos', 'creditos', 'credit'] },
};

const OPTIONAL_COLUMNS: Record<string, { patterns: string[] }> = {
  display_order: { patterns: ['display_order', 'ordem', 'order'] },
  note_reference: { patterns: ['note_reference', 'nota_explicativa_ref', 'nota_ref', 'note_ref', 'nota'] },
  classification_source: { patterns: ['classification_source', 'fonte_classificacao'] },
  cash_flow_tag: { patterns: ['cash_flow_tag', 'tag_fluxo', 'fluxo_tag'] },
};

const SHEET_ALIASES = ['balancete', 'trial balance', 'trialbalance'];

type Finding = {
  severity: 'blocking' | 'warning' | 'informative';
  category: string;
  code: string;
  title: string;
  message: string;
  sheetName?: string;
  rowRef?: string;
  blocking: boolean;
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isDataRow(row: unknown[]): boolean {
  return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
}

@Injectable()
export class FinancialValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  async validateUpload(actor: AuthUser, uploadId: string, diagnosisId: string) {
    if (!canWrite(actor.role)) throw new ForbiddenException();

    const { upload, diagnosis, planCodes } = await this.prisma.withTenantContext(
      this.rlsOpts(actor),
      async (tx) => {
        const uploadRow = await tx.financialUpload.findFirst({ where: { id: uploadId, deletedAt: null } });
        if (!uploadRow) throw new NotFoundException('FinancialUpload not found');
        const diagnosisRow = await tx.financialDiagnosis.findFirst({
          where: { id: diagnosisId, deletedAt: null },
        });
        if (!diagnosisRow) throw new NotFoundException('FinancialDiagnosis not found');
        if (uploadRow.financialDiagnosisId !== diagnosisRow.id) {
          throw new ForbiddenException('Upload não pertence a esse diagnóstico.');
        }
        if (!isHQ(actor.role) && actor.tenantId !== diagnosisRow.tenantId) {
          throw new ForbiddenException('Tenant scope violation');
        }

        let planCodesRow: Set<string> = new Set();
        if (diagnosisRow.accountPlanId) {
          const lines = await tx.financialAccountPlanLine.findMany({
            where: { accountPlanId: diagnosisRow.accountPlanId },
            select: { accountCode: true },
            take: 5000,
          });
          planCodesRow = new Set(
            lines.map((l: { accountCode: string }) => l.accountCode.replace(/\./g, '').trim()),
          );
        }
        return { upload: uploadRow, diagnosis: diagnosisRow, planCodes: planCodesRow };
      },
    );

    // Baixa o arquivo do MinIO e recalcula checksum (fora da transação —
    // I/O de storage não deve segurar lock de banco).
    const fileBuffer = await this.storage.getFile(upload.fileUrl);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    const { findings, missingFromPlan } = this.runValidation(fileBuffer, {
      hasAccountPlan: !!diagnosis.accountPlanId,
      planCodes,
    });

    const hasBlocker = findings.some((f) => f.blocking);
    const newStatus = hasBlocker ? 'validation_failed' : 'validated';
    const summary = {
      bloqueante: findings.filter((f) => f.severity === 'blocking').length,
      ressalva: findings.filter((f) => f.severity === 'warning').length,
      informativa: findings.filter((f) => f.severity === 'informative').length,
    };

    // withTenantContext já roda tudo dentro de uma única transação
    // Postgres (via $transaction no PrismaService) — é essa transação, e
    // não uma aninhada, que dá atomicidade ao passo abaixo.
    const result = await this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const run = await tx.financialProcessingRun.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          financialUploadId: upload.id,
          operationType: 'validate_upload',
          operationKey: `validate_upload:${upload.id}:${checksum}`,
          status: 'succeeded',
          completedAt: new Date(),
          triggeredBy: actor.email,
          sourceEntityId: upload.sourceEntityId,
          sourcePeriod: upload.sourcePeriod,
          inputChecksum: checksum,
          resultSummary: { success: true, upload_status: newStatus, diagnosis_status: newStatus, summary },
        },
      });

      // Supersede resultados ativos de runs anteriores deste upload.
      await tx.financialValidationResult.updateMany({
        where: { financialUploadId: upload.id, publicationStatus: 'active' },
        data: { publicationStatus: 'superseded', supersededAt: new Date() },
      });

      if (findings.length > 0) {
        await tx.financialValidationResult.createMany({
          data: findings.map((f) => ({
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: diagnosis.id,
            financialUploadId: upload.id,
            processingRunId: run.id,
            publicationStatus: 'active',
            publishedAt: new Date(),
            severity: f.severity,
            category: f.category,
            code: f.code,
            title: f.title,
            message: f.message,
            sheetName: f.sheetName,
            rowRef: f.rowRef,
            blocking: f.blocking,
          })),
        });
      }

      await tx.financialUpload.update({
        where: { id: upload.id },
        data: {
          inputChecksum: checksum,
          uploadStatus: newStatus,
          validationSummary: summary,
          currentValidationRunId: run.id,
          currentValidationChecksum: checksum,
          validatedAt: new Date(),
        },
      });

      await tx.financialDiagnosis.update({
        where: { id: diagnosis.id },
        data: { status: newStatus },
      });

      return run;
    });

    return {
      success: true,
      run_id: result.id,
      status: newStatus,
      summary,
      results_count: findings.length,
      has_blockers: hasBlocker,
      missing_from_plan: missingFromPlan,
    };
  }

  private matchColumn(headers: string[], patterns: string[]): number {
    const normalized = headers.map(normalizeHeader);
    for (const pattern of patterns) {
      const idx = normalized.findIndex((h) => h.includes(pattern));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  private extractPeriods(headers: string[]): Set<string> {
    const periodRegex = /(20\d{2}[-/]\d{2}|\d{2}[-/]20\d{2})/;
    const periods = new Set<string>();
    for (const h of headers) {
      const match = String(h ?? '').match(periodRegex);
      if (match) periods.add(match[0]);
    }
    if (periods.size === 0) {
      const hasClosing = headers.some((h) => {
        const n = normalizeHeader(h);
        return n.includes('closing_balance') || n.includes('saldo final') || n.includes('closing');
      });
      if (hasClosing) periods.add('SEM_DATA');
    }
    return periods;
  }

  private runValidation(
    fileBuffer: Buffer,
    ctx: { hasAccountPlan: boolean; planCodes: Set<string> },
  ): { findings: Finding[]; missingFromPlan: Array<{ account_code: string; account_description: string }> } {
    const findings: Finding[] = [];
    const push = (f: Finding) => findings.push(f);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
    } catch (err) {
      push({
        severity: 'blocking',
        category: 'arquivo',
        code: 'XLSX_READ_ERROR',
        title: 'Falha ao ler o arquivo',
        message: `Não foi possível interpretar o arquivo como planilha Excel: ${(err as Error).message}`,
        blocking: true,
      });
      return { findings, missingFromPlan: [] };
    }

    const sheetNames = workbook.SheetNames ?? [];
    let sheetName: string | undefined = sheetNames.find((n) => n === 'Balancete');
    if (!sheetName) {
      const alias = sheetNames.find((n) => SHEET_ALIASES.includes(normalizeHeader(n)));
      if (alias) {
        sheetName = alias;
        push({
          severity: 'informative',
          category: 'estrutura',
          code: 'SHEET_NAME_ALIAS',
          title: 'Aba encontrada por nome alternativo',
          message: `A aba "${alias}" foi reconhecida como o balancete (nome recomendado: "Balancete").`,
          blocking: false,
        });
      }
    }
    const extraSheets = sheetNames.filter((n) => n !== sheetName);
    if (extraSheets.length > 0) {
      push({
        severity: 'informative',
        category: 'estrutura',
        code: 'EXTRA_SHEETS_FOUND',
        title: 'Abas extras ignoradas',
        message: `As abas [${extraSheets.join(', ')}] não foram processadas — só a aba do balancete é lida.`,
        blocking: false,
      });
    }

    if (!sheetName) {
      push({
        severity: 'blocking',
        category: 'estrutura',
        code: 'MISSING_SHEET',
        title: 'Aba "Balancete" não encontrada',
        message: 'A planilha precisa ter uma aba chamada "Balancete" com os dados do balancete.',
        blocking: true,
      });
      return { findings, missingFromPlan: [] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

    if (rows.length < 2) {
      push({
        severity: 'blocking',
        category: 'balancete',
        code: 'EMPTY_SHEET',
        title: 'Aba do balancete está vazia',
        message: 'A aba do balancete não tem linhas de dados além do cabeçalho.',
        sheetName,
        blocking: true,
      });
      return { findings, missingFromPlan: [] };
    }

    const headerRow = (rows[0] ?? []).map((h) => String(h ?? ''));
    const dataRows = rows.slice(1).filter(isDataRow);

    const colIndex: Partial<Record<string, number>> = {};
    for (const [key, { patterns }] of Object.entries(REQUIRED_COLUMNS)) {
      colIndex[key] = this.matchColumn(headerRow, patterns);
    }
    for (const [key, { patterns }] of Object.entries(RECOMMENDED_COLUMNS)) {
      colIndex[key] = this.matchColumn(headerRow, patterns);
    }
    const optionalFound: string[] = [];
    for (const [key, { patterns }] of Object.entries(OPTIONAL_COLUMNS)) {
      if (this.matchColumn(headerRow, patterns) !== -1) optionalFound.push(key);
    }
    if (optionalFound.length > 0) {
      push({
        severity: 'informative',
        category: 'mapeamento',
        code: 'OPTIONAL_COLUMNS_DETECTED',
        title: 'Colunas opcionais detectadas',
        message: `Colunas opcionais encontradas: ${optionalFound.join(', ')}.`,
        sheetName,
        blocking: false,
      });
    }

    // Com plano de contas vinculado, classification/statement_code/
    // statement_group deixam de ser obrigatórias — a classificação vem do
    // plano em vez do arquivo.
    const relaxedByPlan = ctx.hasAccountPlan
      ? new Set(['classification', 'statement_code', 'statement_group'])
      : new Set<string>();
    if (ctx.hasAccountPlan) {
      push({
        severity: 'informative',
        category: 'mapeamento',
        code: 'ACCOUNT_PLAN_LINKED',
        title: 'Classificação virá do plano de contas',
        message:
          'Como esta análise tem um plano de contas vinculado, a classificação BP/DRE/DFC virá do plano, não do arquivo importado.',
        sheetName,
        blocking: false,
      });
    }

    for (const key of Object.keys(REQUIRED_COLUMNS)) {
      if (colIndex[key] === -1 && !relaxedByPlan.has(key)) {
        push({
          severity: 'blocking',
          category: 'estrutura',
          code: `MISSING_COLUMN_${key.toUpperCase()}`,
          title: `Coluna obrigatória ausente: ${key}`,
          message: `Não encontramos uma coluna para "${key}" no cabeçalho do balancete.`,
          sheetName,
          blocking: true,
        });
      }
    }
    for (const key of Object.keys(RECOMMENDED_COLUMNS)) {
      if (colIndex[key] === -1 && !relaxedByPlan.has(key)) {
        push({
          severity: 'warning',
          category: 'mapeamento',
          code: `MISSING_COLUMN_${key.toUpperCase()}`,
          title: `Coluna recomendada ausente: ${key}`,
          message: `Não encontramos uma coluna para "${key}" — recomendado, mas não obrigatório.`,
          sheetName,
          blocking: false,
        });
      }
    }

    if (dataRows.length < MIN_DATA_ROWS) {
      push({
        severity: 'warning',
        category: 'balancete',
        code: 'INSUFICIENT_DATA_ROWS',
        title: 'Poucas linhas de dados',
        message: `Foram encontradas apenas ${dataRows.length} linha(s) de dados (recomendado: ${MIN_DATA_ROWS}+).`,
        sheetName,
        blocking: false,
      });
    }

    const periods = this.extractPeriods(headerRow);
    if (periods.size === 0) {
      push({
        severity: 'warning',
        category: 'periodicidade',
        code: 'NO_PERIOD_COLUMNS',
        title: 'Nenhum período identificado',
        message: 'Não conseguimos identificar colunas de período (ex: 2024-01) no cabeçalho.',
        sheetName,
        blocking: false,
      });
    } else if (periods.size === 1) {
      push({
        severity: 'informative',
        category: 'periodicidade',
        code: 'SINGLE_PERIOD',
        title: 'Apenas um período encontrado',
        message: 'Recomendamos 3+ períodos consecutivos para permitir análise evolutiva.',
        sheetName,
        blocking: false,
      });
    }

    if (colIndex.classification !== -1 && colIndex.classification !== undefined) {
      const idx = colIndex.classification;
      const missing = dataRows.filter((r) => {
        const v = r[idx];
        return v === null || v === undefined || String(v).trim() === '';
      }).length;
      if (missing > 0) {
        // Igual ao original: isso é só informativo, nunca bloqueante. Com
        // plano de contas vinculado (caso comum), a classificação real vem
        // do plano (por código da conta) — a coluna "classification" do
        // próprio arquivo é só um fallback de última instância (ver
        // parseAndCompute em financial-statements.service.ts). Uma conta
        // sem essa coluna preenchida no arquivo ainda pode mapear
        // normalmente via plano; a mensagem só avisa que, para as que não
        // mapearem por nenhuma via, a rubrica ficará de fora.
        const planNote = ctx.hasAccountPlan
          ? ' Como há um plano de contas vinculado, isso é esperado — a classificação real vem do plano (por código da conta), não desta coluna do arquivo.'
          : '';
        push({
          severity: 'informative',
          category: 'mapeamento',
          code: 'MISSING_CLASSIFICATION_VALUES',
          title: 'Linhas sem classificação',
          message: `${missing} de ${dataRows.length} linha(s) (${((missing / dataRows.length) * 100).toFixed(1)}%) não têm classificação preenchida nesta coluna do arquivo.${planNote} Contas que não mapearem por nenhuma via (plano ou arquivo) não vão aparecer nas demonstrações gerenciais.`,
          sheetName,
          blocking: false,
        });
      }
    }

    if (colIndex.closing_balance !== -1 && colIndex.closing_balance !== undefined) {
      const idx = colIndex.closing_balance;
      const nonNumeric = dataRows.filter((r) => {
        const v = r[idx];
        if (v === null || v === undefined || v === '') return false;
        return Number.isNaN(Number(v));
      }).length;
      if (nonNumeric > 0) {
        push({
          severity: 'warning',
          category: 'balancete',
          code: 'NON_NUMERIC_BALANCE',
          title: 'Saldos não numéricos',
          message: `${nonNumeric} linha(s) têm valor não numérico na coluna de saldo final.`,
          sheetName,
          blocking: false,
        });
      }
    }

    // Cruzamento com o plano de contas: contas sintéticas do balancete que
    // não existem no plano vinculado.
    const missingFromPlan: Array<{ account_code: string; account_description: string }> = [];
    if (ctx.hasAccountPlan && ctx.planCodes.size > 0) {
      try {
        const typeIdx = this.matchColumn(headerRow, ['account_type', 'tipo', 'type']);
        const codeIdx = colIndex.account_code ?? -1;
        const descIdx = colIndex.account_description ?? -1;
        if (typeIdx !== -1 && codeIdx !== -1) {
          for (const row of dataRows) {
            const typeVal = String(row[typeIdx] ?? '').trim().toUpperCase();
            if (!['S', 'SINTETICA', 'SINTÉTICA'].includes(typeVal)) continue;
            const code = String(row[codeIdx] ?? '').replace(/\./g, '').trim();
            if (!code || ctx.planCodes.has(code)) continue;
            missingFromPlan.push({
              account_code: String(row[codeIdx] ?? ''),
              account_description: descIdx !== -1 ? String(row[descIdx] ?? '') : '',
            });
          }
        }
        if (missingFromPlan.length > 0) {
          const examples = missingFromPlan.slice(0, 5).map((m) => m.account_code);
          push({
            severity: 'warning',
            category: 'mapeamento',
            code: 'SYNTHETIC_ACCOUNTS_MISSING_FROM_PLAN',
            title: 'Contas sintéticas fora do plano',
            message: `${missingFromPlan.length} conta(s) sintética(s) do balancete não estão no plano de contas vinculado (ex: ${examples.join(', ')}${missingFromPlan.length > 5 ? '...' : ''}).`,
            sheetName,
            blocking: false,
          });
        }
      } catch {
        // Cruzamento é best-effort — nunca bloqueia a validação.
      }
    }

    return { findings, missingFromPlan };
  }
}
