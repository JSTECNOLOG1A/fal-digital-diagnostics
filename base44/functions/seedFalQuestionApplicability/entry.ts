/**
 * seedFalQuestionApplicability.js
 * 
 * Seed script para atualizar perguntas FAL existentes com level_applicability
 * baseado em suas dimensões e subdimensões.
 * 
 * Regras V1:
 * - Governança: {"Societária": ["group","company"], "Operacional": ["company","unit"]}
 * - Jurídico/Societário: ["group","company"]
 * - Controles Internos: ["company","unit"]
 * - Financeiro/Contábil/Tributário: ["company","unit"]
 * - Operacional: ["unit"] (ou ["company","unit"] se gestão central)
 * - Tecnologia/Sistemas: ["company","unit"]
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

const MAPPING = {
  // Governança: subdivisão por tipo
  'governanca': {
    default: ['company', 'unit'],
    subdim_overrides: {
      'Governança Societária': ['group', 'company'],
      'Acordo de Sócios': ['group', 'company'],
      'Sucessão': ['group', 'company'],
      'Organograma Familiar': ['group', 'company'],
      'Conselho de Administração': ['group', 'company'],
      'Ritos de Decisão': ['company', 'unit'],
      'Indicadores de Gestão': ['company', 'unit'],
      'Reuniões de Alinhamento': ['company', 'unit'],
      'Delegação de Autoridade': ['company', 'unit'],
    }
  },
  // Jurídico: grupo e empresa
  'juridico': {
    default: ['group', 'company'],
    subdim_overrides: {}
  },
  // Controles Internos: empresa e unidade
  'controles_internos': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  },
  // Financeiro: empresa e unidade
  'financeiro': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  },
  // Contábil: empresa e unidade
  'contabil': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  },
  // Tributário: empresa e unidade
  'tributario': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  },
  // Operacional: unidade (ou empresa se gestão central)
  'operacional': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  },
  // Tecnologia/Sistemas: empresa e unidade
  'sistemas': {
    default: ['company', 'unit'],
    subdim_overrides: {}
  }
};

function getApplicableLevels(dimension, subdimension) {
  const dimRule = MAPPING[dimension];
  if (!dimRule) return ['group', 'company', 'unit']; // fallback
  
  if (subdimension && dimRule.subdim_overrides[subdimension]) {
    return dimRule.subdim_overrides[subdimension];
  }
  
  return dimRule.default;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Apenas admin
    if (appRole !== 'hq_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Listar todas as perguntas
    const allQuestions = await base44.entities.FalQuestion.list();
    console.log(`[seedFalQuestionApplicability] Found ${allQuestions.length} questions`);

    let updated = 0;
    for (const q of allQuestions) {
      // Se já tem level_applicability e não é default, pular
      if (q.level_applicability?.length > 0 && q.level_applicability.length < 3) {
        console.log(`  [SKIP] ${q.code} já tem level_applicability: ${q.level_applicability.join(', ')}`);
        continue;
      }

      const levels = getApplicableLevels(q.dimension, q.subdimension);
      
      // Atualizar
      await base44.entities.FalQuestion.update(q.id, {
        level_applicability: levels
      });
      
      console.log(`  [UPDATE] ${q.code} (${q.dimension}/${q.subdimension || 'geral'}) → ${levels.join(', ')}`);
      updated++;
    }

    return Response.json({
      ok: true,
      message: `Atualizado ${updated}/${allQuestions.length} perguntas`,
      updated,
      total: allQuestions.length
    });
  } catch (error) {
    console.error('[seedFalQuestionApplicability] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});