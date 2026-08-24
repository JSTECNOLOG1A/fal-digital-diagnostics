import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ─── Mapeamentos ────────────────────────────────────────────────────────────

const effortMap = {
  baixo: 1,
  baixo_medio: 2,
  medio: 3,
  medio_alto: 4,
  alto: 5
};

const timeframeMap = {
  imediato: "30d",
  ate_30_dias: "30d",
  "30_60_dias": "60d",
  "30_90_dias": "90d",
  "90_180_dias": "180d",
  proxima_revisao: "180d"
};

const priorityMap = {
  baixa: { impact_level: 2, priority_weight: 20 },
  media: { impact_level: 3, priority_weight: 50 },
  media_alta: { impact_level: 4, priority_weight: 75 },
  alta: { impact_level: 5, priority_weight: 90 },
  critica: { impact_level: 5, priority_weight: 100 }
};

function deriveTriggerFields(triggerScore) {
  const score = Number(triggerScore);
  if (score === 0) return { gap_level: 0, is_actionable: true, recommendation_type: "structural" };
  if (score === 1) return { gap_level: 1, is_actionable: true, recommendation_type: "corrective" };
  if (score === 2) return { gap_level: 2, is_actionable: true, recommendation_type: "improvement" };
  // score === 3: sem lacuna acionável
  return { gap_level: null, is_actionable: false, recommendation_type: "monitoring" };
}

function parseImplementationSteps(raw) {
  if (!raw) return [];
  // Formato esperado: "1. passo; 2. passo; ..."  ou  "1. passo\n2. passo"
  return raw
    .split(/\d+\.\s+/)
    .map(s => s.replace(/;?\s*$/, '').trim())
    .filter(Boolean);
}

// Parsear CSV simples respeitando campos com vírgulas dentro de aspas
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Remover BOM se presente
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVLine(headerLine);

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? '').trim();
    });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin required' }, { status: 403 });

  const { file_url, tenant_id = null, method_version_id = null, mode = "upsert" } = await req.json();

  if (!file_url) {
    return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
  }

  // 1. Baixar o CSV
  const csvRes = await fetch(file_url);
  if (!csvRes.ok) {
    return Response.json({ error: `Falha ao baixar CSV: ${csvRes.status}` }, { status: 400 });
  }
  const csvText = await csvRes.text();
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return Response.json({ error: 'CSV vazio ou sem dados válidos' }, { status: 400 });
  }

  // 2. Se modo "replace", apagar registros existentes do mesmo tenant/global
  if (mode === "replace") {
    const existing = tenant_id
      ? await base44.asServiceRole.entities.FalRecommendationLibrary.filter({ tenant_id })
      : await base44.asServiceRole.entities.FalRecommendationLibrary.filter({ source: "global_library" });
    for (const rec of existing) {
      await base44.asServiceRole.entities.FalRecommendationLibrary.delete(rec.id);
    }
  }

  // 3. Processar cada linha
  const results = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const triggerScore = Number(row.trigger_rating ?? row.trigger_score ?? 0);
      const { gap_level, is_actionable, recommendation_type } = deriveTriggerFields(triggerScore);

      const effortRaw = (row.effort_level ?? '').toLowerCase().trim().replace(/\s+/g, '_');
      const effortNum = effortMap[effortRaw] ?? 3;

      const timeframeRaw = (row.estimated_timeframe ?? '').toLowerCase().trim();
      const timeframeMapped = timeframeMap[timeframeRaw] ?? "90d";

      const priorityRaw = (row.priority ?? 'media').toLowerCase().trim().replace(/\s+/g, '_');
      const { impact_level, priority_weight } = priorityMap[priorityRaw] ?? priorityMap.media;

      const recommendationKey = row.recommendation_id?.trim() || null;

      const payload = {
        recommendation_key: recommendationKey,
        source: tenant_id ? "tenant_custom" : "global_library",
        source_type: (row.source_type ?? 'cluster_rating').trim(),
        dimension_key: row.dimension_key?.trim() || null,
        subdimension_key: row.subdimension_key?.trim() || null,
        cluster_key: row.cluster_key?.trim() || null,
        question_id: row.question_id?.trim() || null,
        trigger_score: triggerScore,
        gap_level: gap_level,
        is_actionable,
        recommendation_type,
        recommendation_title: row.recommendation_title?.trim() || '',
        recommendation_description: row.recommendation_text?.trim() || '',
        implementation_steps: parseImplementationSteps(row.implementation_steps),
        evidence_required: row.evidence_to_request?.trim() || null,
        success_indicators: row.success_indicators?.trim() || null,
        routine_template: row.routine_template?.trim() || null,
        effort_level: effortNum,
        impact_level,
        priority_weight,
        typical_owner: row.suggested_owner?.trim() || null,
        estimated_timeframe: timeframeMapped,
        cluster_question_count: row.cluster_question_count ? Number(row.cluster_question_count) : null,
        method_version_id: method_version_id || row.method_version_id?.trim() || null,
        tenant_id: tenant_id || row.tenant_id?.trim() || null,
        version: row.version?.trim() || "1.0",
        notes: row.notes?.trim() || null,
        is_active: row.active === 'true' || row.active === true
      };

      // Upsert por recommendation_key
      if (mode === "upsert" && recommendationKey) {
        const existing = await base44.asServiceRole.entities.FalRecommendationLibrary.filter({
          recommendation_key: recommendationKey
        });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.FalRecommendationLibrary.update(existing[0].id, payload);
          results.updated++;
        } else {
          await base44.asServiceRole.entities.FalRecommendationLibrary.create(payload);
          results.inserted++;
        }
      } else {
        await base44.asServiceRole.entities.FalRecommendationLibrary.create(payload);
        results.inserted++;
      }
    } catch (err) {
      results.errors.push({ row: row.recommendation_id ?? '?', error: err.message });
    }
  }

  return Response.json({
    success: true,
    total_rows: rows.length,
    ...results
  });
});