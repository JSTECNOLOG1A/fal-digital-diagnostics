/**
 * importFalQuestions — v3 (novo schema)
 *
 * DEPRECATED: importador legado (schema antigo com campos 'dimension', 'subdimension', 'group', 'questionLevel').
 * Este endpoint REJEITA CSVs no formato antigo e aceita APENAS o novo schema v3:
 *
 * Colunas obrigatórias:
 *   question_id, dimension_key, subdimension_key, cluster_key, process_stage,
 *   sequence_order, diagnostic_depth, level_applicability, question_text
 *
 * Colunas opcionais:
 *   question_weight, dependency
 *
 * Dimensões válidas: governance, legal, internal_controls, financial, accounting, tax, operations, technology
 * process_stage válidos: existence, request, analysis, approval, execution, record, control, monitoring, audit
 * diagnostic_depth válidos: rapid, standard, deep (ou combinações separadas por vírgula/ponto-e-vírgula)
 * level_applicability válidos: group, company, unit (ou combinações)
 *
 * Apenas HQ Admin. Payload: { csv_text, dry_run?: boolean, purge_first?: boolean }
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

const VALID_DIMS    = ['governance','legal','internal_controls','financial','accounting','tax','operations','technology'];
const VALID_STAGES  = ['existence','request','analysis','approval','execution','record','control','monitoring','audit'];
const VALID_DEPTHS  = ['rapid','standard','deep'];
const VALID_LEVELS  = ['group','company','unit'];

// Campos legados que indicam schema antigo — rejeitar se presentes
const LEGACY_FIELDS = ['dimension','subdimension','group','questionlevel','question_level'];

// Novo schema v3 — colunas obrigatórias
const REQUIRED_COLS = ['question_id','dimension_key','subdimension_key','cluster_key','process_stage','diagnostic_depth','level_applicability','question_text'];

function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  if (lines.length < 2) return { rows: [], error: 'CSV vazio' };
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

function parseArray(val, valid) {
  if (!val) return [];
  return val.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(s => valid.includes(s));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (appRole !== 'hq_admin') {
        return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });
      }

    if (appRole !== 'hq_admin') {
      return Response.json({ error: 'Forbidden: HQ Admin apenas' }, { status: 403 });
    }

    const body = await req.json();
    const { csv_text, dry_run = false, purge_first = false } = body;
    if (!csv_text) return Response.json({ error: 'csv_text obrigatório' }, { status: 400 });

    const { rows, header, error: parseError } = parseCSV(csv_text);
    if (parseError) return Response.json({ error: parseError }, { status: 400 });

    // ── Detectar schema legado ──────────────────────────────────────────────
    const legacyFound = (header || []).filter(h => LEGACY_FIELDS.includes(h));
    if (legacyFound.length > 0) {
      return Response.json({
        error: 'CSV rejeitado: formato legado detectado.',
        legacy_fields_found: legacyFound,
        message: 'Use o novo schema v3 com as colunas: ' + REQUIRED_COLS.join(', '),
      }, { status: 400 });
    }

    // ── Verificar colunas obrigatórias ──────────────────────────────────────
    const missingCols = REQUIRED_COLS.filter(c => !(header || []).includes(c));
    if (missingCols.length > 0) {
      return Response.json({
        error: 'Colunas obrigatórias ausentes no CSV.',
        missing_columns: missingCols,
        required_columns: REQUIRED_COLS,
      }, { status: 400 });
    }

    const errors = [];
    const records = [];

    for (const { row, lineNumber } of rows) {
      // question_id e question_text obrigatórios
      if (!row['question_id']) { errors.push(`Linha ${lineNumber}: question_id ausente`); continue; }
      if (!row['question_text']) { errors.push(`Linha ${lineNumber}: question_text ausente`); continue; }

      // dimension_key
      const dimKey = row['dimension_key']?.toLowerCase().trim();
      if (!VALID_DIMS.includes(dimKey)) {
        errors.push(`Linha ${lineNumber}: dimension_key inválido "${dimKey}". Válidos: ${VALID_DIMS.join(', ')}`);
        continue;
      }

      // process_stage
      const stage = row['process_stage']?.toLowerCase().trim();
      if (!VALID_STAGES.includes(stage)) {
        errors.push(`Linha ${lineNumber}: process_stage inválido "${stage}". Válidos: ${VALID_STAGES.join(', ')}`);
        continue;
      }

      // diagnostic_depth — array
      const depths = parseArray(row['diagnostic_depth'], VALID_DEPTHS);
      if (depths.length === 0) {
        errors.push(`Linha ${lineNumber}: diagnostic_depth inválido "${row['diagnostic_depth']}". Válidos: ${VALID_DEPTHS.join(', ')}`);
        continue;
      }

      // level_applicability — array
      const levels = parseArray(row['level_applicability'], VALID_LEVELS);
      if (levels.length === 0) {
        errors.push(`Linha ${lineNumber}: level_applicability inválido "${row['level_applicability']}". Válidos: ${VALID_LEVELS.join(', ')}`);
        continue;
      }

      const weight = parseFloat(row['question_weight'] || '1');

      records.push({
        question_id:        row['question_id'],
        dimension_key:      dimKey,
        subdimension_key:   row['subdimension_key'] || '',
        cluster_key:        row['cluster_key'] || '',
        process_stage:      stage,
        sequence_order:     parseInt(row['sequence_order'] || '0'),
        diagnostic_depth:   depths,
        level_applicability: levels,
        question_weight:    isNaN(weight) ? 1 : weight,
        question_text:      row['question_text'],
        dependency:         row['dependency'] || '',
      });
    }

    if (errors.length > 0) {
      return Response.json({ success: false, errors, rows_parsed: rows.length }, { status: 400 });
    }

    if (dry_run) {
      const byDim = {};
      const byDepth = { rapid: 0, standard: 0, deep: 0 };
      for (const r of records) {
        byDim[r.dimension_key] = (byDim[r.dimension_key] || 0) + 1;
        for (const d of r.diagnostic_depth) byDepth[d] = (byDepth[d] || 0) + 1;
      }
      return Response.json({ dry_run: true, total: records.length, by_dimension: byDim, by_depth: byDepth });
    }

    // ── Purge banco antigo se solicitado ────────────────────────────────────
    let purged = 0;
    if (purge_first) {
      const existing = await base44.asServiceRole.entities.FalQuestion.list();
      for (const q of existing) {
        await base44.asServiceRole.entities.FalQuestion.delete(q.id);
        purged++;
      }
      console.log(`[importFalQuestions] Purge: ${purged} registros removidos`);
    }

    await base44.asServiceRole.entities.FalQuestion.bulkCreate(records);

    const byDim = {};
    const byDepth = { rapid: 0, standard: 0, deep: 0 };
    for (const r of records) {
      byDim[r.dimension_key] = (byDim[r.dimension_key] || 0) + 1;
      for (const d of r.diagnostic_depth) byDepth[d] = (byDepth[d] || 0) + 1;
    }

    console.log(`[importFalQuestions] imported=${records.length}, purged=${purged}`);
    return Response.json({ success: true, imported: records.length, purged, by_dimension: byDim, by_depth: byDepth });

  } catch (err) {
    console.error('[importFalQuestions] ERROR:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});