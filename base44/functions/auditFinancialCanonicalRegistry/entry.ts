/**
 * auditFinancialCanonicalRegistry
 * Função técnica de auditoria — delega para getFinancialCanonicalRegistry via invoke.
 * Retorna validação + hash + counts para verificação de integridade.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const result = await base44.functions.invoke('getFinancialCanonicalRegistry', {});
    const data = result.data;

    return Response.json({
      valid: data.valid,
      version: data.version,
      hash: data.hash,
      generated_at: data.generated_at,
      counts: data.counts,
      errors: data.errors,
      warnings: data.warnings,
      audit_endpoint: true,
    });
  } catch (error) {
    return Response.json({ error: error.message, audit_endpoint: true }, { status: 500 });
  }
});