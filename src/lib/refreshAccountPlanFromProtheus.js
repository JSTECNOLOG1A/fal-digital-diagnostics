/**
 * Atualiza um FinancialAccountPlan com o plano de contas atual do Protheus.
 * Substitui as linhas do mesmo plano (nunca cria plano novo / nunca duplica).
 * Preserva mapeamentos gerenciais (BP/DRE/DFC/EBITDA/chave) das contas já existentes.
 */
import { clarity } from '@/api/clarityClient';
import { base44 } from '@/api/base44Client';
import { buildAccountPlanLinesFromProtheus } from '@/lib/protheusAccountPlanImport';
import { normalizeAccountCode } from '@/lib/accountPlanHierarchy';
import { replaceAccountPlanLines } from '@/lib/replaceAccountPlanLines';

const PRESERVE_KEYS = [
  'statement_code',
  'bp_group',
  'ebitda_component',
  'dfc_classification',
  'canonical_key',
];

/**
 * @param {{ planId: string, tenantId: string, existingLines?: Array<Record<string, any>> }} opts
 * @returns {Promise<{ count: number, jobId: string, added: number, updated: number, removed: number }>}
 */
export async function refreshAccountPlanFromProtheus({
  planId,
  tenantId,
  existingLines = [],
}) {
  if (!planId) throw new Error('Plano não informado');
  if (!tenantId) throw new Error('Tenant não selecionado');

  const connection = await clarity.getProtheusConnection(tenantId);
  if (!connection?.isActive) {
    throw new Error(
      'Conexão Protheus não configurada. Salve URL, usuário e senha em Integrações.',
    );
  }

  const fetchResult = await clarity.fetchProtheusResource({
    tenantId,
    resource: 'chart_of_accounts',
  });

  const items = fetchResult?.items || [];
  if (items.length === 0) {
    throw new Error('Protheus não retornou contas. Verifique empresa/filial na conexão.');
  }

  /** @type {Map<string, Record<string, any>>} */
  const byCode = new Map();
  for (const l of existingLines || []) {
    const code = normalizeAccountCode(l.account_code || l.account_code_display);
    if (code && !byCode.has(code)) byCode.set(code, l);
  }

  const fresh = buildAccountPlanLinesFromProtheus(items, { planId, tenantId });
  const freshCodes = new Set(
    fresh.map((l) => normalizeAccountCode(l.account_code)).filter(Boolean),
  );

  let updated = 0;
  let added = 0;
  const merged = fresh.map((line) => {
    const code = normalizeAccountCode(line.account_code);
    const prev = byCode.get(code);
    if (!prev) {
      added += 1;
      return line;
    }
    updated += 1;
    const next = { ...line };
    for (const key of PRESERVE_KEYS) {
      if (prev[key] != null && String(prev[key]).trim() !== '') {
        next[key] = prev[key];
      }
    }
    const prevClass = String(prev.classification || '').trim();
    if (prevClass && prevClass !== '1' && prevClass !== '2') {
      next.classification = prev.classification;
    }
    return next;
  });

  const removed = [...byCode.keys()].filter((c) => !freshCodes.has(c)).length;

  // Substituição atômica do conteúdo do MESMO plano (sem criar outro)
  await replaceAccountPlanLines({
    planId,
    tenantId,
    lines: merged,
  });

  const jobId = fetchResult.jobId || '—';
  const when = new Date().toLocaleString('pt-BR');
  try {
    await base44.entities.FinancialAccountPlan.update(planId, {
      description: `Atualizado do Protheus em ${when} (job ${jobId}) · ${merged.length} conta(s)`,
    });
  } catch {
    // descrição é informativa; não bloqueia a sincronização
  }

  return {
    count: merged.length,
    jobId,
    added,
    updated,
    removed,
  };
}
