/**
 * seedMqeQuestions — Gera e persiste perguntas técnicas reais do MQE
 * via IA (InvokeLLM) para os 10 cruzamentos do MethodVersion ativo.
 * 
 * Limpa as perguntas placeholder existentes antes de inserir as novas.
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const METHOD_VERSION_ID = '69a736c173d69123aca40516';

const CROSSINGS = [
  { key: 'GxF',   name: 'Governança × Financeiro',    dim_a: 'governanca',         dim_b: 'financeiro' },
  { key: 'GxC',   name: 'Governança × Controles',     dim_a: 'governanca',         dim_b: 'controles_internos' },
  { key: 'FxO',   name: 'Financeiro × Operacional',   dim_a: 'financeiro',         dim_b: 'operacional' },
  { key: 'TxJ',   name: 'Tributário × Jurídico',       dim_a: 'tributario',         dim_b: 'juridico' },
  { key: 'CtbxF', name: 'Contábil × Financeiro',       dim_a: 'contabil',           dim_b: 'financeiro' },
  { key: 'SxC',   name: 'Sistemas × Controles',        dim_a: 'sistemas',           dim_b: 'controles_internos' },
  { key: 'GxO',   name: 'Governança × Operacional',    dim_a: 'governanca',         dim_b: 'operacional' },
  { key: 'GxJ',   name: 'Governança × Jurídico',       dim_a: 'governanca',         dim_b: 'juridico' },
  { key: 'FxT',   name: 'Financeiro × Tributário',     dim_a: 'financeiro',         dim_b: 'tributario' },
  { key: 'SxO',   name: 'Sistemas × Operacional',      dim_a: 'sistemas',           dim_b: 'operacional' },
];

const SYSTEM_CONTEXT = `
Você é especialista em diagnóstico organizacional pelo Método FAL® — Framework de Avaliação de Liquidez e Governança para empresas do agronegócio brasileiro (fazendas, grupos rurais, empresas de revenda de insumos).

O MQE™ (Módulo de Qualidade dos Cruzamentos) é um questionário complementar ao diagnóstico IFME™ que avalia a INTERDEPENDÊNCIA entre duas dimensões organizacionais. 

Cada pergunta MQE deve:
1. Avaliar diretamente a INTEGRAÇÃO entre as duas dimensões (não apenas uma delas)
2. Ser respondida com score 0, 1, 2 ou 3 (0=inexistente/crítico, 1=básico/incipiente, 2=estruturado, 3=maduro/integrado)
3. Ser objetiva, prática e verificável por um consultor em campo
4. Ser focada em empresas do agronegócio brasileiro (fazendas, grupos familiares, revendas de insumos)
5. Ter evidência observável (o consultor sabe o que procurar)

Formato das respostas para cada nível:
- Score 0: Inexistente ou conflito ativo
- Score 1: Existe de forma informal ou parcial
- Score 2: Estruturado mas não monitorado regularmente  
- Score 3: Integrado, monitorado e com melhoria contínua

Gere 5 perguntas por cruzamento. Cada pergunta deve cobrir um aspecto diferente da interdependência.
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Gerar TODOS os cruzamentos em paralelo
    console.log('[MQE Seed] Gerando todos os cruzamentos em paralelo...');
    const aiResults = await Promise.all(CROSSINGS.map(async (crossing) => {
      const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${SYSTEM_CONTEXT}

Cruzamento: ${crossing.name}
Dimensão A: ${crossing.dim_a}
Dimensão B: ${crossing.dim_b}

Gere 5 perguntas MQE técnicas e práticas que avaliem a interdependência entre ${crossing.name} em empresas do agronegócio brasileiro.

Para cada pergunta forneça:
- text: O enunciado da pergunta (direto, objetivo, 1-2 linhas)
- guidance: Orientação ao consultor sobre o que observar e perguntar (2-3 linhas práticas)
- evidence_hint: Exemplo concreto de documento ou evidência que comprova o score 2 ou 3
- risk_tag: Tag de risco associado (ex: "risco_liquidez", "risco_compliance", "risco_governanca", "risco_operacional", "risco_fiscal")
`,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text:          { type: 'string' },
                  guidance:      { type: 'string' },
                  evidence_hint: { type: 'string' },
                  risk_tag:      { type: 'string' },
                }
              }
            }
          }
        }
      });
      // InvokeLLM com response_json_schema pode retornar { response: "..." } ou { questions: [...] }
      let questions = [];
      const raw = aiResponse?.questions
        || aiResponse?.response
        || aiResponse;

      if (Array.isArray(raw)) {
        questions = raw;
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          questions = parsed?.questions || (Array.isArray(parsed) ? parsed : []);
        } catch (_) {}
      } else if (raw && typeof raw === 'object') {
        const vals = Object.values(raw);
        for (const v of vals) {
          if (Array.isArray(v)) { questions = v; break; }
        }
      }

      console.log(`[MQE Seed] ${crossing.key}: questions=${questions.length}`);
      return { crossing, questions };
    }));

    // Persistir resultados (delete old → insert new) em paralelo por cruzamento
    const results = [];
    let totalCreated = 0;

    await Promise.all(aiResults.map(async ({ crossing, questions }) => {
      if (questions.length === 0) {
        results.push({ crossing: crossing.key, status: 'error', message: 'IA não retornou perguntas' });
        return;
      }

      // Deletar placeholders existentes
      const existing = await base44.asServiceRole.entities.MQEQuestion.filter({
        crossing_key: crossing.key,
        method_version_id: METHOD_VERSION_ID,
      });
      await Promise.all(existing.map(q => base44.asServiceRole.entities.MQEQuestion.delete(q.id)));

      // Inserir novas perguntas em paralelo
      await Promise.all(questions.map((q, i) =>
        base44.asServiceRole.entities.MQEQuestion.create({
          method_version_id: METHOD_VERSION_ID,
          crossing_key:      crossing.key,
          code:              `${crossing.key}-${String(i + 1).padStart(2, '0')}`,
          text:              q.text,
          guidance:          q.guidance,
          evidence_hint:     q.evidence_hint,
          risk_tag:          q.risk_tag,
          weight:            1.0,
          order:             i + 1,
          sector_type:       'core',
          sector_tags:       ['all'],
        })
      ));

      totalCreated += questions.length;
      results.push({ crossing: crossing.key, name: crossing.name, status: 'ok', count: questions.length });
    }));

    return Response.json({
      success: true,
      total_created: totalCreated,
      results,
    });

  } catch (error) {
    console.error('[MQE Seed] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});