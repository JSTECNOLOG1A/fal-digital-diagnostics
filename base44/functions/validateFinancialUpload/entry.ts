/**
 * validateFinancialUpload
 * Primeira engine backend real do módulo Diagnóstico Financeiro Inteligente V1.
 *
 * Responsabilidades:
 *   1. Ler o arquivo Excel do FinancialUpload via URL
 *   2. Validar estrutura (abas, colunas obrigatórias, período mínimo)
 *   3. Persistir FinancialValidationResult (severidade canônica V1)
 *   4. Atualizar upload_status do FinancialUpload
 *   5. Atualizar status do FinancialDiagnosis (transição de estado canônica)
 *
 * Severidades canônicas V1: bloqueante | ressalva | informativa
 * Transições: uploaded → validating → validated | validation_failed
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

function stripStylesFromXlsx(uint8Array) {
  try {
    const files = unzipSync(uint8Array);
    const enc = new TextEncoder();
    const patched = { ...files, 'xl/styles.xml': enc.encode(MINIMAL_STYLES) };
    return zipSync(patched);
  } catch {
    return uint8Array;
  }
}

// Tenta ler com opções permissivas para evitar erros de estilo corrompido
function readXlsxSafely(uint8Array) {
  try {
    // Primeira tentativa: com as opções mais agressivas possível
    return XLSX.read(uint8Array, {
      type: 'array',
      cellStyles: false,
      cellNF: false,
      cellFormula: false,
      cellHTML: false,
      defval: '',
      dense: false,
      raw: true,
    });
  } catch (e1) {
    try {
      // Segunda tentativa: ignorar completamente estilos via options
      return XLSX.read(uint8Array, {
        type: 'array',
        cellStyles: false,
        cellNF: false,
        cellFormula: false,
        cellHTML: false,
        defval: '',
      });
    } catch (e2) {
      console.warn('[validateFinancialUpload] Falha ao ler XLSX:', e2.message);
      throw new Error(`Não foi possível ler o arquivo Excel. Detalhes: ${e2.message}`);
    }
  }
}

// ─── Constantes canônicas ─────────────────────────────────────────────────────
const SEVERITY = { BLOQUEANTE: 'blocking', RESSALVA: 'warning', INFORMATIVA: 'info' };
const CATEGORY = {
  ESTRUTURA:    'estrutura_arquivo',
  MAPEAMENTO:   'mapeamento',
  BALANCETE:    'balancete',
  PERIODICIDADE:'periodicidade',
};

// Abas obrigatórias e seus aliases aceitos
const REQUIRED_SHEETS = [
  { canonical: 'Balancete', aliases: ['balancete', 'BALANCETE', 'Trial Balance', 'trialbalance'] },
];

// Colunas da aba Balancete (alinhadas com blueprint V1)
// Obrigatórias (blocking: true): account_code | account_description | classification | closing_balance
// Recomendadas (blocking: false): statement_code | statement_group | opening_balance | debits | credits
// Opcionais (optional: true): display_order | note_reference | classification_source | cash_flow_tag
// Nota: "sign_rule" (Sinal) não é mais solicitado — o sinal é sempre derivado
// automaticamente pelo motor (statement_code + sinal original do balancete),
// nunca informado manualmente pelo usuário.
const REQUIRED_COLUMNS_PATTERNS = [
  { key: 'account_code',          patterns: ['account_code','conta','codigo','cod','code','account'],                 blocking: true,  message: 'Coluna obrigatória de código da conta não encontrada (account_code).' },
  { key: 'account_description',   patterns: ['account_description','descricao','description','nome','name'],          blocking: true,  message: 'Coluna obrigatória de descrição da conta não encontrada (account_description).' },
  { key: 'classification',        patterns: ['classification','classificacao','rubrica','categoria'],                  blocking: true,  message: 'A coluna "classification" é OBRIGATÓRIA. É a fonte primária de composição do BP e DRE. Preencha com a rubrica gerencial de cada conta (ex: "Caixa e equivalentes de caixa", "Receita Bruta", "Fornecedores").' },
  { key: 'closing_balance',       patterns: ['closing_balance','saldo final','saldofinal','closing'],                  blocking: true,  message: 'Coluna de saldo final não encontrada (closing_balance). Necessária para calcular os valores por período.' },
  // Recomendadas
  { key: 'statement_code',        patterns: ['statement_code','demonstracao','demonstração','statement'],              blocking: false, message: 'Coluna "statement_code" (BP ou DRE) não encontrada. Recomendada para definir explicitamente em qual demonstrativo cada rubrica entra.' },
  { key: 'statement_group',       patterns: ['statement_group','grupo_demonstracao','grupo gerencial','section'],      blocking: false, message: 'Coluna "statement_group" não encontrada. Recomendada para definir o bloco visual (ex: Ativo circulante, Receita operacional).' },
  { key: 'opening_balance',       patterns: ['opening_balance','saldo inicial','saldoinicial','opening'],              blocking: false, message: 'Coluna de saldo inicial (opening_balance) não encontrada. Recomendada para conferência de integridade.' },
  { key: 'debits',                patterns: ['debits','débitos','debitos','debit'],                                    blocking: false, message: 'Coluna de débitos (debits) não encontrada. Recomendada para conferência de integridade.' },
  { key: 'credits',               patterns: ['credits','créditos','creditos','credit'],                                blocking: false, message: 'Coluna de créditos (credits) não encontrada. Recomendada para conferência de integridade.' },
  // Opcionais — informativas quando presentes, não geram alerta se ausentes
  { key: 'display_order',         patterns: ['display_order','ordem','order'],                                         blocking: false, optional: true },
  { key: 'note_reference',        patterns: ['note_reference','nota_explicativa_ref','nota_ref','note_ref','nota'],    blocking: false, optional: true },
  { key: 'classification_source', patterns: ['classification_source','fonte_classificacao'],                           blocking: false, optional: true },
  { key: 'cash_flow_tag',         patterns: ['cash_flow_tag','tag_fluxo','fluxo_tag'],                                 blocking: false, optional: true },
];

// Períodos mínimos exigidos (linhas de dados com conteúdo numérico)
const MIN_DATA_ROWS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Canonical(value) {
  const stable = JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  return sha256Bytes(new TextEncoder().encode(stable));
}

function normalizeHeader(h) {
  return String(h ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findSheet(workbook, required) {
  const names = workbook.SheetNames;
  const lc = names.map(n => n.toLowerCase().trim());
  // exact match canonical
  if (names.includes(required.canonical)) return required.canonical;
  // alias match
  for (const alias of required.aliases) {
    const idx = lc.indexOf(alias.toLowerCase().trim());
    if (idx >= 0) return names[idx];
  }
  return null;
}

function findColumn(headers, required) {
  try {
    if (!required || !Array.isArray(required.patterns)) return null;
    if (!Array.isArray(headers)) return null;
    const normalized = headers.map(h => {
      try {
        return normalizeHeader(h);
      } catch {
        return '';
      }
    });
    for (const pattern of required.patterns) {
      const idx = normalized.findIndex(h => h.includes(pattern.toLowerCase().trim()));
      if (idx >= 0) return headers[idx];
    }
  } catch (e) {
    console.warn(`[findColumn] Erro ao procurar coluna ${required?.key}:`, e.message);
  }
  return null;
}

function extractPeriods(sheet) {
  // Períodos podem aparecer:
  //   1. Como cabeçalho isolado: "01/2024" ou "2024-01"
  //   2. Embutidos em: "Saldo Final 01/2024", "Saldo Final (01/2024)"
  //   3. Coluna "closing_balance" sem sufixo (período único sem data)
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
  const periodPattern = /(20\d{2}[-/]\d{2}|\d{2}[-/]20\d{2})/;
  const found = new Set();
  for (const h of headers) {
    const m = String(h ?? '').trim().match(periodPattern);
    if (m) found.add(m[1]);
  }
  // Se não encontrou períodos explícitos mas tem coluna closing_balance, aceita como período único
  if (found.size === 0) {
    const hNorm = headers.map(h => String(h ?? '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const hasClosing = hNorm.some(h => h.includes('closing_balance') || h.includes('saldo final') || h.includes('closing'));
    if (hasClosing) found.add('SEM_DATA');
  }
  return [...found];
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

  if (!user) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { upload_id, diagnosis_id } = body;

  if (!upload_id || !diagnosis_id) {
    return Response.json({ error: 'upload_id e diagnosis_id são obrigatórios' }, { status: 400 });
  }

  // 1. Buscar entidades
  const [upload, diagnosis] = await Promise.all([
    base44.entities.FinancialUpload.get(upload_id),
    base44.entities.FinancialDiagnosis.get(diagnosis_id),
  ]);

  if (!upload || !diagnosis) {
    return Response.json({ error: 'Upload ou diagnóstico não encontrado' }, { status: 404 });
  }

  // ── Tenant Guard ──
    // SEG-03: Role guard — deny client_viewer from triggering mutations
    const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
    if (!WRITE_ROLES.includes(appRole)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

  if ((appRole !== 'hq_admin') && diagnosis.tenant_id !== user.tenant_id) {
    return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
  }

  const previousValidationState = {
    current_validation_run_id: upload.current_validation_run_id || null,
    current_validation_checksum: upload.current_validation_checksum || null,
    validated_at: upload.validated_at || null,
    upload_status: upload.upload_status,
    diagnosis_status: diagnosis.status,
  };

  // ── R4-HASH: backend recalcula SHA-256 dos bytes antes da aquisição do run ──
  const checksumResponse = await fetch(upload.file_url);
  if (!checksumResponse.ok) return Response.json({ error: `Falha ao baixar arquivo para checksum: HTTP ${checksumResponse.status}` }, { status: 503 });
  const verifiedChecksum = await sha256Bytes(await checksumResponse.arrayBuffer());
  if (upload.input_checksum !== verifiedChecksum) {
    await base44.entities.FinancialUpload.update(upload_id, { input_checksum: verifiedChecksum });
  }

  // ── F2-UPL-01: Idempotência vinculada ao conteúdo real ──
  const validationFingerprint = await sha256Canonical({ operation: 'validate_upload', tenant_id: diagnosis.tenant_id, diagnosis_id, upload_id, upload_input_checksum: verifiedChecksum, account_plan_id: diagnosis.account_plan_id || null, mapping_version: upload.mapping_version || null, validation_formula_version: 'FAL-FIN-VALIDATION-1.0.0' });
  const operationKey = [diagnosis.tenant_id, diagnosis_id, upload_id, 'validate_upload', validationFingerprint].join('|');
  const previousValidationRunId = previousValidationState.current_validation_run_id;
  let valRunId = null;
  const existingValRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
    { operation_key: operationKey, status: { $in: ['running', 'succeeded'] } }, 'id', 10
  );
  if (existingValRuns.length > 0) {
    const existingValRun = existingValRuns[0];
    if (['running', 'committing'].includes(existingValRun.status)) {
      return Response.json({ success: false, in_progress: true, reused: true, run_id: existingValRun.id, status: existingValRun.status }, { status: 202 });
    }
    const activeResults = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: existingValRun.id, publication_status: 'active' }, 'id', 50000);
    const candidates = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: existingValRun.id, publication_status: 'candidate' }, 'id', 1);
    const invalid = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: existingValRun.id, publication_status: 'invalid' }, 'id', 1);
    const expectedCount = Number(existingValRun.result_summary?.results_count || 0);
    const isCurrent = upload.current_validation_run_id === existingValRun.id && upload.current_validation_checksum === existingValRun.input_checksum;
    if (!isCurrent) return Response.json({ error: 'REUSED_VALIDATION_NOT_CURRENT', run_id: existingValRun.id }, { status: 409 });
    if (activeResults.length !== expectedCount || candidates.length || invalid.length || upload.upload_status !== (existingValRun.result_summary?.upload_status || upload.upload_status) || diagnosis.status !== (existingValRun.result_summary?.diagnosis_status || diagnosis.status)) return Response.json({ error: 'REUSED_VALIDATION_INTEGRITY_FAILED', run_id: existingValRun.id }, { status: 409 });
    return Response.json({ success: true, reused: true, run_id: existingValRun.id, status: 'succeeded', results_count: expectedCount });
  }
  const valRun = await base44.asServiceRole.entities.FinancialProcessingRun.create({
    tenant_id: diagnosis.tenant_id,
    financial_diagnosis_id: diagnosis_id,
    financial_upload_id: upload_id,
    operation_type: 'validate_upload',
    operation_key: operationKey,
    status: 'running',
    started_at: new Date().toISOString(),
    triggered_by: user.email,
    source_entity_id: upload.source_entity_id || null,
    source_period: upload.source_period || null,
    input_checksum: validationFingerprint,
  });
  valRunId = valRun.id;
  // Se há plano de contas vinculado, classification NÃO é bloqueante (o plano substitui)
  const hasAccountPlan = !!diagnosis.account_plan_id;

  // Usar cópia local para não mutar a constante global (evita bugs em chamadas concorrentes)
  const columnsToCheck = REQUIRED_COLUMNS_PATTERNS.map(c => ({ ...c }));
  if (hasAccountPlan) {
    // Com plano vinculado: classification, statement_code e statement_group
    // são todos opcionais — o plano de contas fornece essa informação automaticamente
    ['classification', 'statement_code', 'statement_group'].forEach(k => {
      const col = columnsToCheck.find(c => c.key === k);
      if (col) {
        col.blocking = false;
        col.optional = true;
      }
    });
  }

  // 2. Marcar como "validando"
  await Promise.all([
    base44.entities.FinancialUpload.update(upload_id, { upload_status: 'reading' }),
    base44.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'validating' }),
  ]);

  const results = []; // { severity, category, code, title, message, sheet_name?, row_ref? }
  const missingFromPlan = []; // contas S ausentes do plano de contas

  // Informativo: plano de contas vinculado
  if (hasAccountPlan) {
    results.push({
      severity: SEVERITY.INFORMATIVA,
      category: CATEGORY.MAPEAMENTO,
      code: 'ACCOUNT_PLAN_LINKED',
      title: 'Plano de contas gerencial vinculado',
      message: 'A classificação gerencial será feita automaticamente pelo plano de contas vinculado. As colunas "classification", "statement_code" e "statement_group" são opcionais neste modo.',
      blocking: false,
    });
  }

  try {
    // 3. Baixar o arquivo Excel
    const fileResp = await fetch(upload.file_url);
    if (!fileResp.ok) {
      results.push({
        severity: SEVERITY.BLOQUEANTE,
        category: CATEGORY.ESTRUTURA,
        code: 'FILE_DOWNLOAD_ERROR',
        title: 'Erro ao acessar arquivo',
        message: `Não foi possível baixar o arquivo (HTTP ${fileResp.status}). Verifique se a URL ainda é válida.`,
        blocking: true,
      });
    } else {
      const arrayBuffer = await fileResp.arrayBuffer();
      const raw = new Uint8Array(arrayBuffer);
      let workbook;
      try {
        const cleaned = stripStylesFromXlsx(raw);
        workbook = readXlsxSafely(cleaned);
      } catch (xlsxErr) {
        results.push({
          severity: SEVERITY.BLOQUEANTE,
          category: CATEGORY.ESTRUTURA,
          code: 'XLSX_READ_ERROR',
          title: 'Erro ao ler arquivo Excel',
          message: `Não foi possível interpretar o arquivo. Verifique se é um arquivo Excel válido (.xlsx). Detalhe: ${xlsxErr.message}`,
          blocking: true,
        });
        workbook = null;
      }

      // 4. Verificar abas obrigatórias
      if (!workbook) throw new Error('Erro ao processar Excel');
      
      let balanceteSheetName = null;
      for (const req of REQUIRED_SHEETS) {
        const found = findSheet(workbook, req);
        if (!found) {
          results.push({
            severity: SEVERITY.BLOQUEANTE,
            category: CATEGORY.ESTRUTURA,
            code: 'MISSING_SHEET',
            title: `Aba obrigatória não encontrada: ${req.canonical}`,
            message: `O arquivo deve conter uma aba chamada "${req.canonical}". Abas encontradas: ${workbook.SheetNames.join(', ')}.`,
            blocking: true,
          });
        } else {
          if (req.canonical === 'Balancete') balanceteSheetName = found;
          if (found !== req.canonical) {
            results.push({
              severity: SEVERITY.INFORMATIVA,
              category: CATEGORY.ESTRUTURA,
              code: 'SHEET_NAME_ALIAS',
              title: `Aba "${req.canonical}" encontrada com nome alternativo`,
              message: `A aba foi identificada como "${found}". Recomendamos usar o nome padrão "${req.canonical}".`,
              sheet_name: found,
              blocking: false,
            });
          }
        }
      }

      // 5. Validar conteúdo da aba Balancete (se existir)
      if (balanceteSheetName) {
        const sheet = workbook.Sheets[balanceteSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        if (rows.length < 2) {
          results.push({
            severity: SEVERITY.BLOQUEANTE,
            category: CATEGORY.BALANCETE,
            code: 'EMPTY_SHEET',
            title: 'Aba Balancete está vazia',
            message: 'A aba Balancete não contém dados. Verifique se o arquivo foi exportado corretamente.',
            sheet_name: balanceteSheetName,
            blocking: true,
          });
        } else {
          const headers = (rows[0] || []).map(h => String(h ?? '').trim());

          // 5a. Verificar colunas obrigatórias / recomendadas / opcionais
          for (const required of columnsToCheck) {
            if (!required || !required.patterns || required.optional) continue;
            try {
              const found = findColumn(headers, required);
              if (!found) {
                results.push({
                  severity: required.blocking ? SEVERITY.BLOQUEANTE : SEVERITY.RESSALVA,
                  category: required.blocking ? CATEGORY.BALANCETE : CATEGORY.MAPEAMENTO,
                  code: `MISSING_COLUMN_${required.key.toUpperCase()}`,
                  title: required.blocking
                    ? `Coluna obrigatória ausente: ${required.key}`
                    : `Coluna recomendada ausente: ${required.key}`,
                  message: required.message || `Padrões aceitos: ${(required.patterns || []).join(', ')}.`,
                  sheet_name: balanceteSheetName,
                  blocking: required.blocking,
                });
              }
            } catch (err) {
              console.error(`[validateFinancialUpload] Erro ao validar coluna ${required.key}:`, err.message);
            }
          }

          // 5a-bis. Detectar colunas opcionais presentes e registrar como informativo positivo
          const optionalPresent = columnsToCheck.filter(r => {
            try {
              return r.optional && findColumn(headers, r);
            } catch {
              return false;
            }
          });
          if (optionalPresent.length > 0) {
            results.push({
              severity: SEVERITY.INFORMATIVA,
              category: CATEGORY.MAPEAMENTO,
              code: 'OPTIONAL_COLUMNS_DETECTED',
              title: 'Colunas opcionais detectadas',
              message: `As seguintes colunas opcionais foram encontradas e serão utilizadas: ${optionalPresent.map(r => r.key).join(', ')}.`,
              sheet_name: balanceteSheetName,
              blocking: false,
            });
          }

          // 5a-ter. Verificar completude da coluna classification (linhas sem classificação)
          const classColDef = columnsToCheck.find(c => c.key === 'classification');
          const classColFound = classColDef ? findColumn(headers, classColDef) : null;
          if (classColFound) {
            const classIdx = headers.indexOf(classColFound);
            const dataRowsAll = rows.slice(1).filter(row => row?.some(c => c != null && c !== ''));
            const semClassificacao = dataRowsAll.filter(row => {
              const val = row[classIdx];
              return val == null || String(val).trim() === '';
            });
            if (semClassificacao.length > 0) {
              const pct = Math.round((semClassificacao.length / dataRowsAll.length) * 100);
              results.push({
                severity: SEVERITY.INFORMATIVA,
                category: CATEGORY.MAPEAMENTO,
                code: 'MISSING_CLASSIFICATION_VALUES',
                title: `${semClassificacao.length} linha(s) sem classificação gerencial`,
                message: `${semClassificacao.length} de ${dataRowsAll.length} linhas (${pct}%) não possuem classificação preenchida. Contas sintéticas ou analíticas sem mapeamento não entrarão nas demonstrações gerenciais, o que é esperado.`,
                sheet_name: balanceteSheetName,
                blocking: false,
              });
            }
          }

          // 5b. Verificar linhas de dados
          const dataRows = rows.slice(1).filter(row =>
            row && row.some(cell => cell !== null && cell !== '')
          );

          if (dataRows.length < MIN_DATA_ROWS) {
            results.push({
              severity: SEVERITY.RESSALVA,
              category: CATEGORY.BALANCETE,
              code: 'INSUFICIENT_DATA_ROWS',
              title: 'Poucas linhas de dados no Balancete',
              message: `Encontradas ${dataRows.length} linhas com dados. O mínimo esperado é ${MIN_DATA_ROWS}. Verifique se o arquivo está completo.`,
              sheet_name: balanceteSheetName,
              blocking: false,
            });
          }

          // 5c. Verificar presença de colunas de período
          const periods = extractPeriods(sheet);
          if (periods.length === 0) {
            results.push({
              severity: SEVERITY.RESSALVA,
              category: CATEGORY.PERIODICIDADE,
              code: 'NO_PERIOD_COLUMNS',
              title: 'Nenhuma coluna de período identificada',
              message: 'Não foram encontradas colunas com formato de período (YYYY-MM ou MM/YYYY). Verifique se os períodos estão corretamente nomeados nas colunas.',
              sheet_name: balanceteSheetName,
              blocking: false,
            });
          } else if (periods.length === 1) {
            results.push({
              severity: SEVERITY.INFORMATIVA,
              category: CATEGORY.PERIODICIDADE,
              code: 'SINGLE_PERIOD',
              title: 'Apenas um período identificado',
              message: `Encontrado apenas o período "${periods[0]}". Para análise evolutiva, recomendamos ao menos 3 períodos consecutivos.`,
              sheet_name: balanceteSheetName,
              blocking: false,
            });
          }

          // 5d. Verificar células numéricas na coluna de saldo
          const saldoColDef = columnsToCheck.find(c => c.key === 'closing_balance');
          const saldoColFound = saldoColDef ? findColumn(headers, saldoColDef) : null;
          if (saldoColFound) {
            const saldoIdx = headers.indexOf(saldoColFound);
            const nonNumericRows = dataRows.filter(row => {
              const val = row[saldoIdx];
              return val !== null && val !== '' && isNaN(Number(val));
            });
            if (nonNumericRows.length > 0) {
              results.push({
                severity: SEVERITY.RESSALVA,
                category: CATEGORY.BALANCETE,
                code: 'NON_NUMERIC_BALANCE',
                title: 'Valores não numéricos na coluna de saldo',
                message: `${nonNumericRows.length} linha(s) com valores não numéricos na coluna de saldo final. Verifique formatação das células.`,
                sheet_name: balanceteSheetName,
                blocking: false,
              });
            }
          }
        }
      }

      // 6. Verificar abas extras disponíveis (informativo)
      const extraSheets = workbook.SheetNames.filter(n =>
        !REQUIRED_SHEETS.some(r => r.canonical === n || r.aliases.map(a => a.toLowerCase()).includes(n.toLowerCase()))
      );
      if (extraSheets.length > 0) {
        results.push({
          severity: SEVERITY.INFORMATIVA,
          category: CATEGORY.ESTRUTURA,
          code: 'EXTRA_SHEETS_FOUND',
          title: 'Abas adicionais encontradas',
          message: `O arquivo contém abas adicionais: ${extraSheets.join(', ')}. Elas serão ignoradas nesta versão.`,
          blocking: false,
        });
      }

      // 6b. Verificar contas sintéticas (S) não encontradas no plano de contas vinculado
      if (hasAccountPlan && balanceteSheetName) {
        try {
          const planLines = await base44.asServiceRole.entities.FinancialAccountPlanLine.filter(
            { account_plan_id: diagnosis.account_plan_id }, 'account_code', 5000
          );
          const planByCode = {};
          for (const line of (Array.isArray(planLines) ? planLines : [])) {
            const norm = String(line.account_code || '').replace(/\./g, '').trim();
            planByCode[norm] = true;
          }
          const bSheet = workbook.Sheets[balanceteSheetName];
          const bRows = XLSX.utils.sheet_to_json(bSheet, { header: 1, defval: null });
          const bHeaders = (bRows[0] || []).map(h => String(h ?? '').trim());
          const nh = (h) => String(h ?? '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const typeIdx = bHeaders.findIndex(h => nh(h) === 'account_type' || nh(h) === 'tipo' || nh(h) === 'type');
          const codeIdx = bHeaders.findIndex(h => nh(h).includes('account_code') || nh(h).includes('conta') || nh(h).includes('codigo'));
          const descIdx = bHeaders.findIndex(h => nh(h).includes('account_description') || nh(h).includes('descricao') || nh(h).includes('nome'));

          if (typeIdx >= 0 && codeIdx >= 0) {
            const missing = [];
            for (const row of bRows.slice(1)) {
              if (!row?.some(c => c != null && c !== '')) continue;
              const typeVal = String(row[typeIdx] ?? '').trim().toUpperCase();
              if (typeVal !== 'S' && typeVal !== 'SINTETICA' && typeVal !== 'SINTÉTICA') continue;
              const code = String(row[codeIdx] ?? '').trim();
              const desc = descIdx >= 0 ? String(row[descIdx] ?? '').trim() : code;
              const normalized = code.replace(/\./g, '').trim();
              if (normalized && !planByCode[normalized]) {
                missing.push({ account_code: code, account_description: desc });
              }
            }
            if (missing.length > 0) {
              missingFromPlan.push(...missing);
              results.push({
                severity: SEVERITY.RESSALVA,
                category: CATEGORY.MAPEAMENTO,
                code: 'SYNTHETIC_ACCOUNTS_MISSING_FROM_PLAN',
                title: `${missing.length} conta(s) sintética(s) não encontrada(s) no plano`,
                message: `Contas marcadas como "S" não constam no plano "${diagnosis.account_plan_id}": ${missing.slice(0,5).map(a => a.account_code).join(', ')}${missing.length > 5 ? '...' : ''}. Você poderá incluí-las ao plano após a validação.`,
                sheet_name: balanceteSheetName,
                blocking: false,
              });
            }
          }
        } catch (e) {
          console.warn('[validateFinancialUpload] Erro ao verificar contas S no plano:', e.message);
        }
      }
    }
  } catch (parseError) {
    results.push({
      severity: SEVERITY.BLOQUEANTE,
      category: CATEGORY.ESTRUTURA,
      code: 'FILE_PARSE_ERROR',
      title: 'Erro ao ler arquivo Excel',
      message: `Não foi possível interpretar o arquivo. Verifique se é um arquivo Excel válido (.xlsx ou .xls). Detalhe: ${parseError.message}`,
      blocking: true,
    });
  }

  // 7. O histórico permanece preservado até o novo ponteiro de validação ser confirmado.
  const invalidateValidationRunOutputs = async ({ base44, diagnosisId, uploadId, runId, reason }) => {
    await base44.asServiceRole.entities.FinancialValidationResult.updateMany(
      { financial_diagnosis_id: diagnosisId, financial_upload_id: uploadId, processing_run_id: runId, publication_status: { $in: ['candidate', 'active'] } },
      { $set: { publication_status: 'invalid', invalidated_at: new Date().toISOString(), invalidation_reason: reason } },
    );
  };
  const restorePreviousValidationState = async () => {
    await Promise.all([
      base44.entities.FinancialUpload.update(upload_id, {
        upload_status: previousValidationState.upload_status,
        current_validation_run_id: previousValidationState.current_validation_run_id,
        current_validation_checksum: previousValidationState.current_validation_checksum,
        validated_at: previousValidationState.validated_at,
      }),
      base44.entities.FinancialDiagnosis.update(diagnosis_id, { status: previousValidationState.diagnosis_status }),
    ]);
  };
  const hasBlocker = results.some(r => r.severity === SEVERITY.BLOQUEANTE);
  const summary = { bloqueante: results.filter(r => r.severity === SEVERITY.BLOQUEANTE).length, ressalva: results.filter(r => r.severity === SEVERITY.RESSALVA).length, informativa: results.filter(r => r.severity === SEVERITY.INFORMATIVA).length };
  const newUploadStatus = hasBlocker ? 'validation_failed' : 'validated';
  const newDiagnosisStatus = hasBlocker ? 'validation_failed' : 'validated';
  const toInsert = results.map(r => ({ financial_upload_id: upload_id, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, processing_run_id: valRunId, publication_status: 'candidate', severity: r.severity, category: r.category, code: r.code, title: r.title, message: r.message, sheet_name: r.sheet_name || null, row_ref: r.row_ref || null, blocking: r.blocking === true }));
  const expectedCount = toInsert.length;
  let pointerCommitted = false;
  try {
    if (expectedCount > 0) await base44.asServiceRole.entities.FinancialValidationResult.bulkCreate(toInsert);
    const candidates = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: valRunId, publication_status: 'candidate' }, 'id', 50000);
    if (candidates.length !== expectedCount) throw new Error('VALIDATION_CANDIDATE_COUNT_MISMATCH');
    const publishedAt = new Date().toISOString();
    await base44.asServiceRole.entities.FinancialValidationResult.updateMany({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: valRunId, publication_status: 'candidate' }, { $set: { publication_status: 'active', published_at: publishedAt } });
    const active = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: valRunId, publication_status: 'active' }, 'id', 50000);
    if (active.length !== expectedCount) throw new Error('VALIDATION_PROMOTION_COUNT_MISMATCH');
    await base44.asServiceRole.entities.FinancialProcessingRun.update(valRunId, { status: 'committing' });
    await base44.asServiceRole.entities.FinancialProcessingRun.update(valRunId, { status: 'succeeded', completed_at: new Date().toISOString(), result_summary: { success: !hasBlocker, upload_status: newUploadStatus, diagnosis_status: newDiagnosisStatus, summary, results_count: expectedCount, validation_fingerprint: validationFingerprint, has_blockers: hasBlocker } });
    const persistedRun = await base44.asServiceRole.entities.FinancialProcessingRun.get(valRunId);
    if (persistedRun.status !== 'succeeded') throw new Error('VALIDATION_RUN_POSTCONDITION_FAILED');
    await Promise.all([
      base44.entities.FinancialUpload.update(upload_id, { upload_status: newUploadStatus, validation_summary: summary, current_validation_run_id: valRunId, current_validation_checksum: validationFingerprint, validated_at: publishedAt }),
      base44.entities.FinancialDiagnosis.update(diagnosis_id, { status: newDiagnosisStatus }),
    ]);
    const [persistedUpload, persistedDiagnosis] = await Promise.all([base44.entities.FinancialUpload.get(upload_id), base44.entities.FinancialDiagnosis.get(diagnosis_id)]);
    if (persistedUpload.current_validation_run_id !== valRunId || persistedUpload.current_validation_checksum !== validationFingerprint || persistedUpload.upload_status !== newUploadStatus || persistedDiagnosis.status !== newDiagnosisStatus) throw new Error('VALIDATION_POINTER_POSTCONDITION_FAILED');
    pointerCommitted = true;
    try {
      if (previousValidationRunId && previousValidationRunId !== valRunId) await base44.asServiceRole.entities.FinancialValidationResult.updateMany({ financial_diagnosis_id: diagnosis_id, financial_upload_id: upload_id, processing_run_id: previousValidationRunId, publication_status: 'active' }, { $set: { publication_status: 'superseded', superseded_at: publishedAt } });
    } catch (cleanupError) {
      await base44.asServiceRole.entities.FinancialProcessingRun.update(valRunId, { cleanup_pending: true, error_details: { cleanup_error: cleanupError.message } });
    }
  } catch (error) {
    if (!pointerCommitted) {
      await invalidateValidationRunOutputs({ base44, diagnosisId: diagnosis_id, uploadId: upload_id, runId: valRunId, reason: error.message });
      await restorePreviousValidationState();
      await base44.asServiceRole.entities.FinancialProcessingRun.update(valRunId, { status: 'partial_failed', completed_at: new Date().toISOString(), error_details: { error: error.message, stage: 'validation_commit' } });
    }
    return Response.json({ error: 'Falha ao confirmar validação', details: error.message, run_id: valRunId }, { status: 500 });
  }

  return Response.json({
    success: true,
    run_id: valRunId,
    status: newDiagnosisStatus,
    summary,
    results_count: results.length,
    has_blockers: hasBlocker,
    missing_from_plan: missingFromPlan,
  });
});