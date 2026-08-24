/**
 * importQuestionsCSV — DEPRECATED (schema IFME legado)
 *
 * Este endpoint importa perguntas para a entidade `Question` (banco IFME legado).
 * NÃO use para o banco FAL v3. Para o banco FAL, use `importFalQuestions`.
 *
 * Este endpoint REJEITA qualquer tentativa de importar com campos legados FAL:
 *   dimension, subdimension, group, questionLevel
 *
 * Colunas esperadas (IFME legado):
 *   id, dimension, question_text, sector_applicability, weight, subdimension, trigger_condition
 *
 * Dimensões IFME válidas: governance, legal, internal_controls, financial, accounting, tax, operations, technology
 *
 * Apenas HQ Admin. Payload: { csv_text, method_version_id?, dry_run? }
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

const VALID_DIM_KEYS = ['governance','legal','internal_controls','financial','accounting','tax','operations','technology'];

// Aliases legados → novo padrão inglês
const DIM_ALIASES = {
  'governanca': 'governance', 'governança': 'governance', 'gov': 'governance',
  'controles_internos': 'internal_controls', 'controles internos': 'internal_controls', 'ci': 'internal_controls',
  'financeiro': 'financial', 'fin': 'financial',
  'contabil': 'accounting', 'contábil': 'accounting', 'ctb': 'accounting',
  'tributario': 'tax', 'tributário': 'tax', 'fiscal': 'tax', 'trb': 'tax',
  'juridico': 'legal', 'jurídico': 'legal', 'jur': 'legal',
  'operacional': 'operations', 'opr': 'operations',
  'sistemas': 'technology', 'tecnologia': 'technology', 'sis': 'technology', 'ti': 'technology',
};

// Campos FAL v3 — proibidos neste importador
const FAL_V3_FIELDS = ['question_id','dimension_key','subdimension_key','cluster_key','process_stage','diagnostic_depth','level_applicability'];

function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  if (lines.length < 2) return { rows: [], error: 'CSV vazio ou sem linhas de dados' };
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = [];
    let inQuote = false, current = '';
    for (const ch of line) {
      if (ch === '"' && !inQuote) { inQuote = true; continue; }
      if (ch === '"' && inQuote) { inQuote = false; continue; }
      if (ch === ',' && !inQuote) { cols.push(current); current = ''; continue; }
      current += ch;
    }
    cols.push(current);
    const row = {};
    header.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });
    rows.push({ row, lineNumber: i + 1 });
  }
  return { rows, header };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') {
      return Response.json({ error: 'Forbidden: HQ Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { csv_text, method_version_id, dry_run = false } = body;
    if (!csv_text) return Response.json({ error: 'Campo "csv_text" é obrigatório' }, { status: 400 });

    const { rows, header, error: parseError } = parseCSV(csv_text);
    if (parseError) return Response.json({ error: parseError }, { status: 400 });

    // ── Detectar CSV FAL v3 enviado para o endpoint errado ──────────────────
    const falV3Found = (header || []).filter(h => FAL_V3_FIELDS.includes(h));
    if (falV3Found.length > 0) {
      return Response.json({
        error: 'CSV FAL v3 detectado. Use o endpoint "importFalQuestions" para importar o banco FAL.',
        fal_v3_fields_found: falV3Found,
        correct_endpoint: 'importFalQuestions',
      }, { status: 400 });
    }

    // Resolve MethodVersion
    let mv;
    if (method_version_id) {
      mv = await base44.entities.MethodVersion.get(method_version_id);
    } else {
      const active = await base44.entities.MethodVersion.filter({ status: 'active' }, '-created_date', 1);
      mv = active[0];
    }
    if (!mv) return Response.json({ error: 'Nenhuma MethodVersion encontrada' }, { status: 404 });

    const errors = [];
    const questionData = [];

    for (const { row, lineNumber } of rows) {
      const missingFields = ['id','dimension','question_text'].filter(f => !row[f]);
      if (missingFields.length > 0) {
        errors.push(`Linha ${lineNumber}: campos obrigatórios ausentes: ${missingFields.join(', ')}`);
        continue;
      }

      const dimRaw = row['dimension'].toLowerCase().trim();
      const dimKey = DIM_ALIASES[dimRaw] || (VALID_DIM_KEYS.includes(dimRaw) ? dimRaw : null);
      if (!dimKey) {
        errors.push(`Linha ${lineNumber}: dimensão inválida "${row['dimension']}". Válidos: ${VALID_DIM_KEYS.join(', ')}`);
        continue;
      }

      const weight = parseInt(row['weight'] || '1');
      if (isNaN(weight) || weight < 1 || weight > 3) {
        errors.push(`Linha ${lineNumber}: peso inválido "${row['weight']}" — deve ser 1, 2 ou 3`);
        continue;
      }

      questionData.push({
        method_version_id: mv.id,
        dimension_key: dimKey,
        code: row['id'],
        text: row['question_text'],
        weight,
        order: questionData.filter(q => q.dimension_key === dimKey).length + 1,
        guidance: row['subdimension'] || '',
        sector_tags: ['all'],
        sector_type: 'core',
        risk_tag: row['trigger_condition'] || '',
      });
    }

    if (errors.length > 0) {
      return Response.json({ success: false, errors, rows_processed: rows.length }, { status: 400 });
    }

    if (dry_run) {
      const preview = {};
      for (const q of questionData) {
        preview[q.dimension_key] = (preview[q.dimension_key] || 0) + 1;
      }
      return Response.json({ dry_run: true, method_version_id: mv.id, questions_to_import: questionData.length, by_dimension: preview });
    }

    await base44.entities.Question.bulkCreate(questionData);
    return Response.json({ success: true, questions_imported: questionData.length, method_version_id: mv.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});