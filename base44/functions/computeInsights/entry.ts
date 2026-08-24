import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determina se uma resposta é "ruim" (sinaliza problema).
 * Centralizado aqui para garantir consistência entre computeInsights e qualquer
 * futuro módulo que precise da mesma lógica.
 */
function isBadAnswer(resp, signal) {
  if (!signal) return false;
  // Checagem explícita de bad_answers (suporta string e número)
  if (signal.bad_answers?.length) {
    if (signal.bad_answers.includes(String(resp.score))) return true;
    if (signal.bad_answers.includes(resp.score)) return true;
  }
  // Fallback semântico para escala likert: 0 ou 1 são problemáticos
  if (signal.signal_type === 'likert' && resp.score <= 1) return true;
  return false;
}

/**
 * Valor de hit de uma resposta ruim = severity × weight × confidence.
 * Representa o "peso do problema detectado".
 */
function calcHit(signal) {
  return (signal.severity || 1) * (signal.weight || 1) * (signal.confidence || 1);
}

/**
 * Máximo possível para normalização.
 * Não é mais fixo em 3; usa os metadados reais do signal.
 * severity_max = 3 (teto da escala), weight e confidence conforme cadastro.
 */
function calcMaxPossible(signal) {
  return 3 * (signal.weight || 1) * (signal.confidence || 1);
}

function normalize(value, maxPossible) {
  if (maxPossible <= 0) return 0;
  return Math.min(1, value / maxPossible);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Tenant Guard ──────────────────────────────────────────────────────────────
function isHQ(user) { return appRole === 'hq_admin'; }

function assertTenantAccess(user, entityTenantId) {
  if (isHQ(user)) return;
  if (!user.tenant_id) throw Object.assign(new Error('Forbidden: user has no tenant_id'), { status: 403 });
  if (user.tenant_id !== entityTenantId) throw Object.assign(new Error('Forbidden: tenant mismatch'), { status: 403 });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { assessmentId, cycleId } = body;
  if (!assessmentId) return Response.json({ error: 'assessmentId required' }, { status: 400 });

  // 1. Carregar assessment (fonte de tenant_id, target, etc.)
  const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
  if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });
  const tenantId = assessment.tenant_id;

  // Tenant guard
  try { assertTenantAccess(user, tenantId); } catch (e) {
    return Response.json({ error: e.message }, { status: 403 });
  }

  // 2. Buscar FalDiagnosticSnapshot (inclui tenant_id para isolamento)
  let snap = null;
  if (cycleId) {
    const withCycle = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId, cycle_id: cycleId }, '-computed_at', 1
    );
    snap = withCycle[0] || null;
  }
  if (!snap) {
    const latest = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId }, '-computed_at', 1
    );
    snap = latest[0] || null;
  }
  if (!snap) return Response.json({ error: 'No FalDiagnosticSnapshot found' }, { status: 404 });

  // 3. Carregar respostas FAL do assessment (scoped por tenant)
  const responses = await base44.asServiceRole.entities.FalResponse.filter(
    { tenant_id: tenantId, assessment_id: assessmentId }, '-created_date', 500
  );

  // 4. Carregar signals: global primeiro, depois tenant sobrescreve (por question_id)
  const [signalsGlobal, signalsTenant] = await Promise.all([
    base44.asServiceRole.entities.FalQuestionSignal.filter({ tenant_id: 'global' }, '-created_date', 1000),
    tenantId !== 'global'
      ? base44.asServiceRole.entities.FalQuestionSignal.filter({ tenant_id: tenantId }, '-created_date', 1000)
      : Promise.resolve([]),
  ]);
  const signalMap = {};
  for (const sig of signalsGlobal) signalMap[sig.question_id] = sig;
  for (const sig of signalsTenant) signalMap[sig.question_id] = sig; // tenant sobrescreve global

  // 5. Carregar catálogo de root causes: global + tenant (tenant sobrescreve por cause_id)
  const [causesGlobal, causesTenant] = await Promise.all([
    base44.asServiceRole.entities.FalRootCauseCatalog.filter({ tenant_id: 'global' }, '-created_date', 500),
    tenantId !== 'global'
      ? base44.asServiceRole.entities.FalRootCauseCatalog.filter({ tenant_id: tenantId }, '-created_date', 500)
      : Promise.resolve([]),
  ]);
  const causeMap = {};
  for (const c of causesGlobal) causeMap[c.cause_id] = c;
  for (const c of causesTenant) causeMap[c.cause_id] = c; // tenant sobrescreve
  const allCauses = Object.values(causeMap);

  // 6. Processar hits por driver
  // driverAccum: driver_id → { hit_sum, max_possible_sum, count, evidence_question_ids[] }
  const driverAccum = {};
  // evidenceMap: question_id → { score, severity, driver_ids, bad, dimension, subdimension }
  const evidenceMap = {};

  for (const resp of responses) {
    const sig = signalMap[resp.fal_question_id];
    if (!sig) continue; // degrada graciosamente

    if (!isBadAnswer(resp, sig)) continue;

    const hitValue = calcHit(sig);
    const maxForThis = calcMaxPossible(sig);

    evidenceMap[resp.fal_question_id] = {
      score: resp.score,
      severity: sig.severity || 1,
      driver_ids: sig.driver_ids || [],
      bad: true,
      subdimension_key: sig.subdimension_key || null,
      dimension_key: sig.dimension_key || null
    };

    for (const driverId of (sig.driver_ids || [])) {
      if (!driverAccum[driverId]) {
        driverAccum[driverId] = { hit_sum: 0, max_possible_sum: 0, count: 0, evidence_question_ids: [] };
      }
      driverAccum[driverId].hit_sum += hitValue;
      driverAccum[driverId].max_possible_sum += maxForThis;
      driverAccum[driverId].count += 1;
      if (!driverAccum[driverId].evidence_question_ids.includes(resp.fal_question_id)) {
        driverAccum[driverId].evidence_question_ids.push(resp.fal_question_id);
      }
    }
  }

  // 7. Calcular driver_scores (0-100, maior = melhor)
  const driver_scores = {};
  for (const [driverId, accum] of Object.entries(driverAccum)) {
    const normalized = normalize(accum.hit_sum, accum.max_possible_sum);
    driver_scores[driverId] = {
      score: Math.round((1 - normalized) * 100),
      hit_count: accum.count,
      severity_sum: accum.hit_sum,
      evidence_question_ids: accum.evidence_question_ids
    };
  }

  // 8. Rankear top driver gaps (piores = menor score)
  // Ignorar drivers que não têm evidência em dimensões aplicáveis
  const snap_active_dims = new Set(snap.active_dimensions || []);
  const top_driver_gaps = Object.entries(driver_scores)
    .filter(([_, scoreData]) => scoreData.evidence_question_ids.length > 0) // Apenas drivers com evidência
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 10)
    .map(([id]) => id);

  // 9. Rankear causas prováveis baseado nos drivers com gap
  // Ignorar causas que dependem só de dimensões não aplicáveis
  const causeScores = {};
  for (const cause of allCauses) {
    // Apenas drivers mapeados nos gaps (que têm evidência)
    const matchingDrivers = (cause.driver_ids || []).filter(d => top_driver_gaps.includes(d));
    if (matchingDrivers.length === 0) continue;

    let totalSeverity = 0;
    for (const dId of matchingDrivers) {
      totalSeverity += driver_scores[dId]?.severity_sum || 0;
    }
    causeScores[cause.cause_id] = {
      cause_id: cause.cause_id,
      name: cause.name,
      description: cause.description || null,
      score: totalSeverity,
      evidence_count: matchingDrivers.length,
      playbook_keys: cause.playbook_keys || [],
      driver_ids: matchingDrivers
    };
  }

  const root_causes_ranked = Object.values(causeScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // 10. Montar lista de playbooks recomendados (union causas + signals de evidências ruins)
  const playbookSet = new Set();
  for (const c of root_causes_ranked) c.playbook_keys.forEach(k => playbookSet.add(k));
  for (const qId of Object.keys(evidenceMap)) {
    const sig = signalMap[qId];
    if (sig) (sig.recommended_playbook_keys || []).forEach(k => playbookSet.add(k));
  }
  const recommended_playbooks = [...playbookSet];

  // 11. Persistir FalInsightSnapshot com chave composta (tenant_id, assessment_id, cycle_id)
  //     Garante isolamento entre ciclos e entre tenants.
  const effectiveCycleId = cycleId || null;

  const insightFilter = { tenant_id: tenantId, assessment_id: assessmentId };
  if (effectiveCycleId) insightFilter.cycle_id = effectiveCycleId;

  const existingInsights = await base44.asServiceRole.entities.FalInsightSnapshot.filter(
    insightFilter, '-computed_at', 1
  );

  const insightData = {
    tenant_id: tenantId,
    assessment_id: assessmentId,
    cycle_id: effectiveCycleId,
    target_type: assessment.target_type || null,
    target_id: assessment.target_id || null,
    driver_scores,
    top_driver_gaps,
    root_causes_ranked,
    recommended_playbooks,
    evidence: evidenceMap,
    computed_at: new Date().toISOString()
  };

  let insightSnapshot;
  if (existingInsights.length > 0) {
    insightSnapshot = await base44.asServiceRole.entities.FalInsightSnapshot.update(
      existingInsights[0].id, insightData
    );
  } else {
    insightSnapshot = await base44.asServiceRole.entities.FalInsightSnapshot.create(insightData);
  }

  return Response.json({ ok: true, insight: insightSnapshot });
});