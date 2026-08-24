import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const REQUIRED_DIM_KEYS = ['governanca', 'controles_internos', 'financeiro', 'contabil', 'tributario', 'juridico', 'operacional', 'sistemas'];
const REQUIRED_CROSSING_KEYS = ['GxF', 'GxC', 'FxO', 'TxJ', 'CtbxF', 'SxC', 'GxO', 'GxJ', 'FxT', 'SxO'];
const FROZEN_WEIGHTS = {
  governanca: 0.30, controles_internos: 0.15, financeiro: 0.18, contabil: 0.07,
  tributario: 0.10, juridico: 0.10, operacional: 0.05, sistemas: 0.05
};
const VALID_SECTORS = ['all', 'agriculture', 'livestock', 'agro_livestock', 'input_retail', 'agro_industry', 'general_business'];
const VALID_TYPES = ['core', 'sector', 'optional'];

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
    const { bank, version_code, notes, activate } = body;

    if (!bank) return Response.json({ error: 'Campo "bank" é obrigatório' }, { status: 400 });
    if (!version_code) return Response.json({ error: 'Campo "version_code" é obrigatório (ex: FAL v1.1)' }, { status: 400 });

    const errors = [];

    // Validate dimensions
    const importedDimKeys = (bank.dimensions || []).map(d => d.key);
    for (const key of REQUIRED_DIM_KEYS) {
      if (!importedDimKeys.includes(key)) errors.push(`Dimensão obrigatória ausente: ${key}`);
    }

    // Validate crossings
    const importedCrossKeys = (bank.crossings || []).map(c => c.key);
    for (const key of REQUIRED_CROSSING_KEYS) {
      if (!importedCrossKeys.includes(key)) errors.push(`Cruzamento obrigatório ausente: ${key}`);
    }

    // Validate questions per dimension
    for (const dim of (bank.dimensions || [])) {
      if (!dim.questions || dim.questions.length === 0) {
        errors.push(`Dimensão "${dim.key}" sem perguntas`);
      }
      for (const q of (dim.questions || [])) {
        if (!q.text) { errors.push(`Pergunta sem texto na dimensão "${dim.key}"`); continue; }
        const w = parseInt(q.weight);
        if (isNaN(w) || w < 1 || w > 3) errors.push(`Peso inválido (${q.weight}) em "${dim.key}" — deve ser 1, 2 ou 3`);
        const tags = q.sector_tags || [];
        for (const t of tags) {
          if (!VALID_SECTORS.includes(t)) errors.push(`sector_tag inválido: "${t}" em "${dim.key}"`);
        }
        if (q.sector_type && !VALID_TYPES.includes(q.sector_type)) {
          errors.push(`sector_type inválido: "${q.sector_type}" em "${dim.key}"`);
        }
      }
    }

    // Validate MQE questions per crossing
    for (const cross of (bank.crossings || [])) {
      if (!cross.mqe_questions || cross.mqe_questions.length === 0) {
        errors.push(`Cruzamento "${cross.key}" sem perguntas MQE`);
      }
      for (const q of (cross.mqe_questions || [])) {
        if (!q.text) { errors.push(`Pergunta MQE sem texto no cruzamento "${cross.key}"`); continue; }
        const w = parseInt(q.weight);
        if (isNaN(w) || w < 1 || w > 3) errors.push(`Peso MQE inválido (${q.weight}) em "${cross.key}"`);
        const tags = q.sector_tags || [];
        for (const t of tags) {
          if (!VALID_SECTORS.includes(t)) errors.push(`sector_tag MQE inválido: "${t}" em "${cross.key}"`);
        }
        if (q.sector_type && !VALID_TYPES.includes(q.sector_type)) {
          errors.push(`sector_type MQE inválido: "${q.sector_type}" em "${cross.key}"`);
        }
      }
    }

    if (errors.length > 0) {
      return Response.json({ error: 'Validação falhou', errors }, { status: 400 });
    }

    // Build dimensions with FROZEN weights — import cannot override global weights
    const dimensions = REQUIRED_DIM_KEYS.map((key, idx) => {
      const d = bank.dimensions.find(x => x.key === key);
      return { key, name: d?.name || key, global_weight: FROZEN_WEIGHTS[key], order: idx + 1 };
    });

    const crossings = REQUIRED_CROSSING_KEYS.map((key, idx) => {
      const c = bank.crossings.find(x => x.key === key);
      return { key, name: c?.name || key, dim_a: c?.dim_a || '', dim_b: c?.dim_b || '', order: idx + 1 };
    });

    // Inherit penalty profiles / classifications from current active version
    const activeMVs = await base44.entities.MethodVersion.filter({ status: 'active' }, '-created_date', 1);
    const basePenaltyProfiles = activeMVs[0]?.penalty_profiles || [{
      key: 'equilibrado', name: 'Equilibrado',
      fde_low_penalty: 0.07, fde_mid_penalty: 0.12, fde_critical_cap: 'Vulnerável',
      fag_low_penalty: 0.05, fag_high_penalty: 0.09, fas_low_penalty: 0.035, fas_high_penalty: 0.065
    }];
    const ifmeClassifications = activeMVs[0]?.ifme_classifications || [
      { min: 0, max: 39, label: 'Crítica' }, { min: 40, max: 59, label: 'Vulnerável' },
      { min: 60, max: 74, label: 'Instável' }, { min: 75, max: 89, label: 'Estruturada' },
      { min: 90, max: 100, label: 'Madura' }
    ];
    const mqeClassifications = activeMVs[0]?.mqe_classifications || [
      { min: 0, max: 39, label: 'Conflito Estrutural' }, { min: 40, max: 59, label: 'Dependência Vulnerável' },
      { min: 60, max: 74, label: 'Interdependência Instável' }, { min: 75, max: 89, label: 'Interdependência Funcional' },
      { min: 90, max: 100, label: 'Interdependência Integrada' }
    ];
    const igiClassifications = activeMVs[0]?.igi_classifications || [
      { min: 0, max: 39, label: 'Fragmentada' }, { min: 40, max: 59, label: 'Vulneráveis' },
      { min: 60, max: 74, label: 'Tensão Latente' }, { min: 75, max: 89, label: 'Coesa' },
      { min: 90, max: 100, label: 'Integração Sistêmica' }
    ];

    // 1. Create new MethodVersion
    const mv = await base44.entities.MethodVersion.create({
      version_code,
      status: activate ? 'active' : 'draft',
      dimensions,
      crossings,
      penalty_profiles: basePenaltyProfiles,
      ifme_classifications: ifmeClassifications,
      mqe_classifications: mqeClassifications,
      igi_classifications: igiClassifications,
      matrix_threshold: 75,
      notes: notes || `Importado por ${user.email} em ${new Date().toISOString()}`
    });

    // 2. Import IFME questions
    const questionData = [];
    for (const dim of bank.dimensions) {
      (dim.questions || []).forEach((q, i) => {
        const sectorTags = (q.sector_tags || ['all']).filter(t => VALID_SECTORS.includes(t));
        const sectorType = VALID_TYPES.includes(q.sector_type) ? q.sector_type : 'core';
        questionData.push({
          method_version_id: mv.id,
          dimension_key: dim.key,
          code: q.code || `${dim.key.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(2, '0')}`,
          text: q.text,
          weight: Math.min(3, Math.max(1, parseInt(q.weight) || 1)),
          order: q.order || (i + 1),
          guidance: q.guidance || '',
          sector_tags: sectorTags.length ? sectorTags : ['all'],
          sector_type: sectorType,
          evidence_hint: q.evidence_hint || '',
          risk_tag: q.risk_tag || '',
        });
      });
    }
    await base44.entities.Question.bulkCreate(questionData);

    // 3. Import MQE questions
    const mqeData = [];
    for (const cross of bank.crossings) {
      (cross.mqe_questions || []).forEach((q, i) => {
        const sectorTags = (q.sector_tags || ['all']).filter(t => VALID_SECTORS.includes(t));
        const sectorType = VALID_TYPES.includes(q.sector_type) ? q.sector_type : 'core';
        mqeData.push({
          method_version_id: mv.id,
          crossing_key: cross.key,
          code: q.code || `${cross.key}-${String(i + 1).padStart(2, '0')}`,
          text: q.text,
          weight: Math.min(3, Math.max(1, parseInt(q.weight) || 1)),
          order: q.order || (i + 1),
          guidance: q.guidance || '',
          sector_tags: sectorTags.length ? sectorTags : ['all'],
          sector_type: sectorType,
          evidence_hint: q.evidence_hint || '',
          risk_tag: q.risk_tag || '',
        });
      });
    }
    await base44.entities.MQEQuestion.bulkCreate(mqeData);

    // 4. Import checklist items (optional in bank)
    const checklistData = [];
    for (const dim of bank.dimensions) {
      (dim.checklist || []).forEach((item, i) => {
        checklistData.push({
          method_version_id: mv.id,
          dimension_key: dim.key,
          item_id: item.item_id || `${dim.key}_chk_${i + 1}`,
          label: item.label,
          required: item.required !== false,
          order: i + 1,
        });
      });
    }
    if (checklistData.length > 0) {
      await base44.entities.EvidenceChecklist.bulkCreate(checklistData);
    }

    await base44.entities.AuditLog.create({
      user_email: user.email,
      action: 'method_questions_imported',
      entity_type: 'MethodVersion',
      entity_id: mv.id,
      details: {
        version_code,
        ifme_questions: questionData.length,
        mqe_questions: mqeData.length,
        checklist_items: checklistData.length,
        activated: !!activate,
      }
    });

    return Response.json({
      success: true,
      method_version_id: mv.id,
      version_code,
      status: mv.status,
      ifme_questions_created: questionData.length,
      mqe_questions_created: mqeData.length,
      checklist_items_created: checklistData.length,
      note: activate
        ? 'MethodVersion ativada. Novos tenants usarão esta versão.'
        : 'MethodVersion criada como draft. Ative manualmente quando pronto.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});