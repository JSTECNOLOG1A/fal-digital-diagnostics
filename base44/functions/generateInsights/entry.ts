import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// Rate limit: max 10 LLM calls per tenant per hour
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory store (resets on cold start — acceptable for rate limiting)
const tenantCallLog = new Map(); // tenantId → [timestamp, ...]

function checkRateLimit(tenantId) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const calls = (tenantCallLog.get(tenantId) || []).filter(t => t > windowStart);
  if (calls.length >= RATE_LIMIT) return false;
  calls.push(now);
  tenantCallLog.set(tenantId, calls);
  return true;
}

function isHQAdmin(user) {
  return appRole === 'hq_admin';
}

function buildFallbackInsights(snapshot, dimensions, quadrantLabel) {
  const low = Object.entries(snapshot.dimension_scores || {})
    .filter(([, v]) => v?.active && v?.score != null)
    .sort((a, b) => (a[1].score || 0) - (b[1].score || 0))
    .slice(0, 3);

  return {
    executive_summary: `O diagnóstico aponta score geral de ${snapshot.overall_score?.toFixed(2)} (${snapshot.overall_level}). Há ${snapshot.critical_clusters_count || 0} cluster(s) crítico(s). As dimensões de menor maturidade precisam de planos de ação prioritários.`,
    top_findings: [
      `Score geral: ${snapshot.overall_score?.toFixed(2)} — classificação "${snapshot.overall_level}"`,
      `Índice de maturidade: ${snapshot.maturity_index || 0}%`,
      low[0] ? `Dimensão mais vulnerável: ${low[0][0]} (score ${low[0][1]?.score?.toFixed(2)})` : 'Todas as dimensões acima do limiar mínimo',
    ],
    top_risks: [
      snapshot.critical_clusters_count > 0 ? `${snapshot.critical_clusters_count} cluster(s) com score crítico (< 1.0)` : 'Nenhum cluster crítico identificado',
      low[0] ? `Dimensão "${low[0][0]}" requer atenção prioritária` : 'Manutenção dos controles estabelecidos',
      'Necessidade de evidências complementares em dimensões críticas',
    ],
    next_actions_30d: [
      low[0] ? `Aprofundar diagnóstico nas dimensões: ${low.slice(0, 2).map(([k]) => k).join(', ')}` : 'Manter e documentar práticas atuais',
      'Definir responsável e prazo para cada cluster crítico',
      'Apresentar resultados ao TCWG e alinhar roadmap de melhorias',
    ],
    quadrant_explanation: `Diagnóstico gerado pelo motor FAL 2.0. Score geral: ${snapshot.overall_score?.toFixed(2)}. Revise os clusters críticos antes de publicar.`,
    confidence_note: 'Sugestões geradas automaticamente com base nos scores; revise antes de publicar.',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const assessment_id = body?.assessment_id;
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Not found' }, { status: 404 });

    if (!isHQAdmin(user)) {
      if (!user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (assessment.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limiting per tenant
    const tenantId = assessment.tenant_id;
    if (!checkRateLimit(tenantId)) {
      return Response.json({
        success: false,
        error_code: 'RATE_LIMIT_EXCEEDED',
        message: 'Limite de geração de insights atingido. Tente novamente mais tarde.',
      }, { status: 429 });
    }

    // Prefer FalDiagnosticSnapshot (FAL 2.0), fallback to ScoreSnapshot (legacy)
    const falSnaps = await base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id, tenant_id: tenantId }, '-computed_at', 1
    );

    let snapshot = null;
    let isLegacy = false;

    if (falSnaps.length > 0) {
      snapshot = falSnaps[0];
    } else {
      // Legacy fallback
      const legacySnaps = await base44.entities.ScoreSnapshot.filter(
        { assessment_id, tenant_id: tenantId }, '-computed_at', 1
      );
      if (!legacySnaps || legacySnaps.length === 0) {
        return Response.json({ error: 'Nenhum snapshot encontrado. Execute o cálculo primeiro.' }, { status: 400 });
      }
      snapshot = legacySnaps[0];
      isLegacy = true;
    }

    const methodVersion = await base44.entities.MethodVersion.get(assessment.method_version_id);
    const dimensions = methodVersion?.dimensions || [];
    const crossings  = methodVersion?.crossings  || [];

    let prompt;
    if (isLegacy) {
      const dimLines = dimensions.map(d => {
        const ds = snapshot.dimension_scores?.[d.key];
        return `- ${d.name}: ${ds?.raw_score?.toFixed(1) || 0}/100`;
      }).join('\n');
      const mqeLines = crossings.map(c => {
        const ms = snapshot.mqe_scores?.[c.key];
        return `- ${c.name} (${c.key}): ${ms?.score?.toFixed(1) || 0}/100 — ${ms?.classification || ''}`;
      }).join('\n');
      const alertLines = (snapshot.alerts || []).map(a => `- [${a.severity?.toUpperCase()}] ${a.message}`).join('\n') || '- Nenhum alerta';
      prompt = `Você é um consultor sênior de gestão empresarial. Analise os resultados e produza insights executivos em português do Brasil.

IFME Final: ${snapshot.ifme_final?.toFixed(1)} — ${snapshot.ifme_classification}
IGI: ${snapshot.igi?.toFixed(1)} — ${snapshot.igi_classification}
Quadrante: ${snapshot.quadrant_label}

Dimensões:\n${dimLines}
Cruzamentos MQE:\n${mqeLines}
Alertas:\n${alertLines}

Gere insights práticos e diretos. Cite números. Tom executivo.`;
    } else {
      const dimLines = Object.entries(snapshot.dimension_scores || {})
        .filter(([, v]) => v?.active && v?.score != null)
        .map(([k, v]) => `- ${k}: ${v.score?.toFixed(2)}/3.00 (${v.level})`)
        .join('\n');
      const gapLines = (snapshot.gaps_top || []).map(g => `- ${g.axis}: ${g.score?.toFixed(2)} (${g.level})`).join('\n');

      prompt = `Você é um consultor sênior de gestão empresarial especializado em diagnósticos FAL®. Analise os resultados e produza insights executivos objetivos em português do Brasil.

Score Geral: ${snapshot.overall_score?.toFixed(2)}/3.00 — ${snapshot.overall_level}
Índice de Maturidade: ${snapshot.maturity_index || 0}%
Clusters Críticos: ${snapshot.critical_clusters_count || 0} de ${snapshot.total_clusters_count || 0}
Evolução total: ${snapshot.total_evolution != null ? (snapshot.total_evolution > 0 ? '+' : '') + snapshot.total_evolution?.toFixed(2) : 'Primeiro diagnóstico'}

Dimensões FAL (0–3):
${dimLines}

Top 3 Gaps:
${gapLines}

Gere insights práticos e diretos. Cite os números. Tom: executivo, orientado a ação.`;
    }

    let insights;
    try {
      insights = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary:  { type: 'string' },
            top_findings:       { type: 'array', items: { type: 'string' } },
            top_risks:          { type: 'array', items: { type: 'string' } },
            next_actions_30d:   { type: 'array', items: { type: 'string' } },
            quadrant_explanation: { type: 'string' },
            confidence_note:    { type: 'string' },
          },
        },
      });
      insights.confidence_note = insights.confidence_note || 'Sugestões geradas por IA; revise antes de publicar.';
    } catch (_llmErr) {
      insights = buildFallbackInsights(snapshot, dimensions, snapshot.quadrant_label || snapshot.overall_level);
    }

    const existing = await base44.entities.Insight.filter(
      { assessment_id, tenant_id: tenantId }, '-created_date', 1
    );
    const version = existing.length > 0 ? (existing[0].version || 1) + 1 : 1;

    const savedInsight = await base44.entities.Insight.create({
      tenant_id: tenantId,
      assessment_id,
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      version,
      snapshot_id: snapshot.id,
      ...insights,
    });

    return Response.json({ success: true, insight: savedInsight });

  } catch (error) {
    console.error('[generateInsights] Error:', error);
    return Response.json({
      success: false,
      error_code: 'PROCESSING_ERROR',
      message: 'Erro ao gerar insights',
      suggestion: 'Tente novamente em alguns segundos',
    }, { status: 500 });
  }
});