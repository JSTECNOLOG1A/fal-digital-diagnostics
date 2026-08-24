import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// Helper: check if user is HQ/global admin
function isHQAdmin(user) {
  return appRole === 'hq_admin' || user.role === 'method_admin' || user.role === 'superadmin';
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

    const { assessment_id } = await req.json();
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    // Fetch assessment
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Not found' }, { status: 404 });

    // ===== TENANT GUARD =====
    if (!isHQAdmin(user)) {
      if (!user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (assessment.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch method version
    const methodVersion = await base44.entities.MethodVersion.get(assessment.method_version_id);
    if (!methodVersion) return Response.json({ error: 'Method version not found' }, { status: 404 });

    const dimensions = methodVersion.dimensions || [];
    const crossings = methodVersion.crossings || [];
    const penaltyProfiles = methodVersion.penalty_profiles || [];
    const penaltyProfile = penaltyProfiles.find(p => p.key === (assessment.penalty_profile_key || 'equilibrado')) || penaltyProfiles[0];

    // Fetch questions and responses (scoped to assessment's tenant via tenant_id filter)
    const questions = await base44.entities.Question.filter({ method_version_id: assessment.method_version_id });
    const mqeQuestions = await base44.entities.MQEQuestion.filter({ method_version_id: assessment.method_version_id });
    const responses = await base44.entities.Response.filter({ assessment_id, tenant_id: assessment.tenant_id });
    const mqeResponses = await base44.entities.MQEResponse.filter({ assessment_id, tenant_id: assessment.tenant_id });

    // ===== IFME CALCULATION =====
    const dimensionScores = {};
    for (const dim of dimensions) {
      const dimQuestions = questions.filter(q => q.dimension_key === dim.key);
      const dimResponses = responses.filter(r => r.dimension_key === dim.key);

      if (dimQuestions.length === 0) {
        dimensionScores[dim.key] = { raw_score: 0, weighted_score: 0, response_count: 0, question_count: 0 };
        continue;
      }

      let weightedSum = 0;
      let totalWeight = 0;
      for (const q of dimQuestions) {
        const resp = dimResponses.find(r => r.question_id === q.id);
        const score = resp ? (resp.score / 5) * 100 : 0;
        const w = q.weight || 1;
        weightedSum += score * w;
        totalWeight += w;
      }

      const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      dimensionScores[dim.key] = {
        raw_score: Math.round(rawScore * 100) / 100,
        weighted_score: Math.round(rawScore * dim.global_weight * 100) / 100,
        response_count: dimResponses.length,
        question_count: dimQuestions.length
      };
    }

    // IFME Base
    let ifmeBase = 0;
    for (const dim of dimensions) {
      ifmeBase += (dimensionScores[dim.key]?.raw_score || 0) * dim.global_weight;
    }
    ifmeBase = Math.round(ifmeBase * 100) / 100;

    // ===== PENALTIES =====
    // FDE — Governance anchor penalty
    // Faixas: gov < 40 = crítico (high penalty + cap), gov 40-49 = mid penalty, gov 50-59 = low penalty
    const govScore = dimensionScores['governanca']?.raw_score || 0;
    const otherDims = dimensions.filter(d => d.key !== 'governanca');
    const otherAvg = otherDims.length > 0
      ? otherDims.reduce((s, d) => s + (dimensionScores[d.key]?.raw_score || 0), 0) / otherDims.length
      : 0;
    const fag = otherAvg - govScore;

    const allScores = dimensions.map(d => dimensionScores[d.key]?.raw_score || 0);
    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const fas = Math.sqrt(allScores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / allScores.length);

    let fdePenalty = 0;
    let fagPenalty = 0;
    let fasPenalty = 0;
    let maxClassCap = null;

    if (penaltyProfile) {
      // FDE: gov < 40 → critical cap + high penalty; gov 40-49 → mid; gov 50-59 → low
      if (govScore < 40) {
        fdePenalty = (penaltyProfile.fde_mid_penalty || 0.12) * ifmeBase;
        maxClassCap = 'Vulnerável'; // cap classification
      } else if (govScore < 50) {
        fdePenalty = (penaltyProfile.fde_mid_penalty || 0.12) * ifmeBase;
      } else if (govScore < 60) {
        fdePenalty = (penaltyProfile.fde_low_penalty || 0.07) * ifmeBase;
      }

      // FAG: gap > 25 → high; gap > 15 → low
      if (fag > 25) {
        fagPenalty = (penaltyProfile.fag_high_penalty || 0.09) * ifmeBase;
      } else if (fag > 15) {
        fagPenalty = (penaltyProfile.fag_low_penalty || 0.05) * ifmeBase;
      }

      // FAS: std > 25 → high; std > 18 → low
      if (fas > 25) {
        fasPenalty = (penaltyProfile.fas_high_penalty || 0.065) * ifmeBase;
      } else if (fas > 18) {
        fasPenalty = (penaltyProfile.fas_low_penalty || 0.035) * ifmeBase;
      }
    }

    const totalPenalty = fdePenalty + fagPenalty + fasPenalty;
    let ifmeFinal = Math.max(0, ifmeBase - totalPenalty);
    ifmeFinal = Math.round(ifmeFinal * 100) / 100;

    // IFME Classification
    const ifmeClassifications = methodVersion.ifme_classifications || [
      { min: 0, max: 39, label: 'Crítica' },
      { min: 40, max: 59, label: 'Vulnerável' },
      { min: 60, max: 74, label: 'Instável' },
      { min: 75, max: 89, label: 'Estruturada' },
      { min: 90, max: 100, label: 'Madura' }
    ];

    let ifmeClass = ifmeClassifications.find(c => ifmeFinal >= c.min && ifmeFinal <= c.max)?.label || 'Crítica';
    if (maxClassCap) {
      const capIndex = ifmeClassifications.findIndex(c => c.label === maxClassCap);
      const currentIndex = ifmeClassifications.findIndex(c => c.label === ifmeClass);
      if (currentIndex > capIndex) ifmeClass = maxClassCap;
    }

    // ===== MQE / MFIS CALCULATION =====
    const mqeScores = {};
    const mqeClassifications = methodVersion.mqe_classifications || [
      { min: 0, max: 39, label: 'Conflito Estrutural' },
      { min: 40, max: 59, label: 'Dependência Vulnerável' },
      { min: 60, max: 74, label: 'Interdependência Instável' },
      { min: 75, max: 89, label: 'Interdependência Funcional' },
      { min: 90, max: 100, label: 'Interdependência Integrada' }
    ];

    for (const cross of crossings) {
      const cQuestions = mqeQuestions.filter(q => q.crossing_key === cross.key);
      const cResponses = mqeResponses.filter(r => r.crossing_key === cross.key);

      if (cQuestions.length === 0) {
        mqeScores[cross.key] = { score: 0, classification: 'Conflito Estrutural', response_count: 0, question_count: 0 };
        continue;
      }

      let wSum = 0;
      let tWeight = 0;
      for (const q of cQuestions) {
        const resp = cResponses.find(r => r.mqe_question_id === q.id);
        const score = resp ? (resp.score / 5) * 100 : 0;
        const w = q.weight || 1;
        wSum += score * w;
        tWeight += w;
      }

      const mqeScore = tWeight > 0 ? Math.round((wSum / tWeight) * 100) / 100 : 0;
      const mqeClass = mqeClassifications.find(c => mqeScore >= c.min && mqeScore <= c.max)?.label || 'Conflito Estrutural';

      mqeScores[cross.key] = {
        score: mqeScore,
        classification: mqeClass,
        response_count: cResponses.length,
        question_count: cQuestions.length
      };
    }

    // ===== IGI =====
    const mqeValues = Object.values(mqeScores).map(m => m.score);
    const igi = mqeValues.length > 0
      ? Math.round((mqeValues.reduce((a, b) => a + b, 0) / mqeValues.length) * 100) / 100
      : 0;

    const igiClassifications = methodVersion.igi_classifications || [
      { min: 0, max: 39, label: 'Fragmentada' },
      { min: 40, max: 59, label: 'Vulneráveis' },
      { min: 60, max: 74, label: 'Tensão Latente' },
      { min: 75, max: 89, label: 'Coesa' },
      { min: 90, max: 100, label: 'Integração Sistêmica' }
    ];
    const igiClass = igiClassifications.find(c => igi >= c.min && igi <= c.max)?.label || 'Fragmentada';

    // ===== ALERTS =====
    const alerts = [];
    for (const [key, val] of Object.entries(mqeScores)) {
      if (val.score < 40) {
        alerts.push({ type: 'mqe_critical', severity: 'red', message: `MQE ${key} está em nível crítico (${val.score.toFixed(1)})` });
      }
    }
    const mqeBelow60 = Object.values(mqeScores).filter(m => m.score < 60).length;
    if (mqeBelow60 >= 3) {
      alerts.push({ type: 'tension', severity: 'orange', message: `${mqeBelow60} cruzamentos MQE abaixo de 60 — tensão relevante` });
    }
    const mqeStd = mqeValues.length > 0
      ? Math.sqrt(mqeValues.reduce((s, v) => s + Math.pow(v - igi, 2), 0) / mqeValues.length)
      : 0;
    if (mqeStd > 20) {
      alerts.push({ type: 'asymmetry', severity: 'orange', message: `Assimetria cruzada detectada (desvio padrão ${mqeStd.toFixed(1)})` });
    }

    // ===== MATRIX 2D =====
    const threshold = methodVersion.matrix_threshold || 75;
    const highIFME = ifmeFinal >= threshold;
    const highIGI = igi >= threshold;
    let quadrant, quadrantLabel;
    if (highIFME && highIGI) { quadrant = 'high_high'; quadrantLabel = 'Arquitetura Integrada'; }
    else if (highIFME && !highIGI) { quadrant = 'high_low'; quadrantLabel = 'Crescimento com Tensão'; }
    else if (!highIFME && highIGI) { quadrant = 'low_high'; quadrantLabel = 'Alinhada porém Imatura'; }
    else { quadrant = 'low_low'; quadrantLabel = 'Risco Sistêmico Elevado'; }

    // Save snapshot — record who computed it
    const snapshot = {
      tenant_id: assessment.tenant_id,
      assessment_id,
      computed_at: new Date().toISOString(),
      computed_by: user.email,
      dimension_scores: dimensionScores,
      ifme_base: ifmeBase,
      penalties: {
        fde: Math.round(fdePenalty * 100) / 100,
        fag: Math.round(fagPenalty * 100) / 100,
        fas: Math.round(fasPenalty * 100) / 100,
        total: Math.round(totalPenalty * 100) / 100,
        details: `FDE: ${fdePenalty.toFixed(2)}, FAG(${fag.toFixed(1)}): ${fagPenalty.toFixed(2)}, FAS(${fas.toFixed(1)}): ${fasPenalty.toFixed(2)}`
      },
      ifme_final: ifmeFinal,
      ifme_classification: ifmeClass,
      mqe_scores: mqeScores,
      igi,
      igi_classification: igiClass,
      alerts,
      quadrant,
      quadrant_label: quadrantLabel
    };

    const saved = await base44.entities.FalDiagnosticSnapshot.create(snapshot);

    // Log audit
    await base44.entities.AuditLog.create({
      tenant_id: assessment.tenant_id,
      user_email: user.email,
      action: 'scores_computed',
      entity_type: 'ScoreSnapshot',
      entity_id: saved.id,
      details: { ifme_base: ifmeBase, ifme_final: ifmeFinal, igi, quadrant },
      method_version_id: assessment.method_version_id
    });

    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});