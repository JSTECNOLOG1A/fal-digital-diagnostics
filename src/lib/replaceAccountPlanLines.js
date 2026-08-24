/**
 * Substitui 100% das linhas de um plano de contas (sem duplicar).
 * Fluxo: listar → apagar → verificar → gravar (deduplicado por account_code).
 */
import { base44 } from '@/api/base44Client';
import { normalizeAccountCode } from '@/lib/accountPlanHierarchy';

/**
 * @param {string} planId
 * @param {string} [tenantId]
 */
async function listPlanLines(planId, tenantId) {
  let rows = await base44.entities.FinancialAccountPlanLine.filter(
    tenantId
      ? { account_plan_id: planId, tenant_id: tenantId }
      : { account_plan_id: planId },
    'account_code',
    20000,
  );
  if ((!rows || rows.length === 0) && tenantId) {
    // Fallback: linhas gravadas com tenant diferente / ausente
    rows = await base44.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: planId },
      'account_code',
      20000,
    );
  }
  return Array.isArray(rows) ? rows : [];
}

/**
 * Remove todas as linhas do plano. Lança se sobrar algo.
 * @param {{ planId: string, tenantId: string }} opts
 */
export async function clearAccountPlanLines({ planId, tenantId }) {
  if (!planId) throw new Error('Plano não informado');

  // 1) Função Base44 (quando disponível)
  try {
    await base44.functions.invoke('deleteAccountPlanLines', {
      account_plan_id: planId,
      tenant_id: tenantId,
    });
  } catch {
    // segue com delete direto
  }

  // 2) Delete direto do que ainda existir (local / falha parcial)
  let remaining = await listPlanLines(planId, tenantId);
  if (remaining.length > 0) {
    const ids = remaining.map((l) => l.id).filter(Boolean);
    if (typeof base44.entities.FinancialAccountPlanLine.deleteMany === 'function') {
      await base44.entities.FinancialAccountPlanLine.deleteMany(ids);
    } else {
      for (const id of ids) {
        await base44.entities.FinancialAccountPlanLine.delete(id);
      }
    }
  }

  // 3) Confirma vazio
  remaining = await listPlanLines(planId, tenantId);
  if (remaining.length > 0) {
    for (const row of remaining) {
      try {
        await base44.entities.FinancialAccountPlanLine.delete(row.id);
      } catch {
        // ignora item a item; revalida abaixo
      }
    }
    remaining = await listPlanLines(planId, tenantId);
  }

  if (remaining.length > 0) {
    throw new Error(
      `Não foi possível limpar o plano antes de atualizar (${remaining.length} linha(s) restantes). Evitando duplicação.`,
    );
  }
}

/**
 * Deduplica por account_code (mantém a primeira).
 * @param {Array<Record<string, any>>} lines
 * @param {{ planId: string, tenantId: string }} ctx
 */
export function dedupeAccountPlanLines(lines, { planId, tenantId }) {
  const seen = new Set();
  /** @type {Array<Record<string, any>>} */
  const out = [];
  for (const line of lines || []) {
    const code = normalizeAccountCode(line?.account_code || line?.account_code_display);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const { id: _omitId, ...rest } = line;
    out.push({
      ...rest,
      account_plan_id: planId,
      tenant_id: tenantId,
      account_code: code,
      account_code_display:
        line.account_code_display || line.account_code || code,
    });
  }
  return out;
}

/**
 * Apaga linhas atuais e grava o conjunto novo (sem duplicar plano nem códigos).
 * @param {{ planId: string, tenantId: string, lines: Array<Record<string, any>>, chunkSize?: number }} opts
 */
export async function replaceAccountPlanLines({
  planId,
  tenantId,
  lines,
  chunkSize = 200,
}) {
  if (!planId) throw new Error('Plano não informado');
  if (!tenantId) throw new Error('Tenant não selecionado');

  const unique = dedupeAccountPlanLines(lines, { planId, tenantId });
  if (unique.length === 0) {
    throw new Error('Nenhuma conta válida para gravar após deduplicação.');
  }

  await clearAccountPlanLines({ planId, tenantId });

  for (let i = 0; i < unique.length; i += chunkSize) {
    await base44.entities.FinancialAccountPlanLine.bulkCreate(
      unique.slice(i, i + chunkSize),
    );
  }

  // Sanity: não deve haver códigos duplicados no plano
  const saved = await listPlanLines(planId, tenantId);
  const codes = saved.map((l) => normalizeAccountCode(l.account_code));
  const uniqueCodes = new Set(codes);
  if (codes.length !== uniqueCodes.size) {
    throw new Error(
      'Detectada duplicidade de códigos após gravar. Limpe o plano e tente de novo.',
    );
  }

  return {
    count: unique.length,
    saved: saved.length,
  };
}
