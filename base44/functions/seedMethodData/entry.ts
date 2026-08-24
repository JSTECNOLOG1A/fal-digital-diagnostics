import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ Admin access required' }, { status: 403 });

    // Order: Governança → Controles Internos → Financeiro → Contábil → Tributário → Jurídico → Operacional → Sistemas
    const dimensions = [
      { key: 'governanca',       name: 'Governança (TCWG)',  global_weight: 0.30, order: 1 },
      { key: 'controles_internos', name: 'Controles Internos', global_weight: 0.15, order: 2 },
      { key: 'financeiro',       name: 'Financeiro',          global_weight: 0.18, order: 3 },
      { key: 'contabil',         name: 'Contábil',            global_weight: 0.07, order: 4 },
      { key: 'tributario',       name: 'Tributário',          global_weight: 0.10, order: 5 },
      { key: 'juridico',         name: 'Jurídico',            global_weight: 0.10, order: 6 },
      { key: 'operacional',      name: 'Operacional',         global_weight: 0.05, order: 7 },
      { key: 'sistemas',         name: 'Sistemas',            global_weight: 0.05, order: 8 }
    ];

    const crossings = [
      { key: 'GxF', name: 'Governança × Financeiro', dim_a: 'governanca', dim_b: 'financeiro', order: 1 },
      { key: 'GxC', name: 'Governança × Controles', dim_a: 'governanca', dim_b: 'controles_internos', order: 2 },
      { key: 'FxO', name: 'Financeiro × Operacional', dim_a: 'financeiro', dim_b: 'operacional', order: 3 },
      { key: 'TxJ', name: 'Tributário × Jurídico', dim_a: 'tributario', dim_b: 'juridico', order: 4 },
      { key: 'CtbxF', name: 'Contábil × Financeiro', dim_a: 'contabil', dim_b: 'financeiro', order: 5 },
      { key: 'SxC', name: 'Sistemas × Controles', dim_a: 'sistemas', dim_b: 'controles_internos', order: 6 },
      { key: 'GxO', name: 'Governança × Operacional', dim_a: 'governanca', dim_b: 'operacional', order: 7 },
      { key: 'GxJ', name: 'Governança × Jurídico', dim_a: 'governanca', dim_b: 'juridico', order: 8 },
      { key: 'FxT', name: 'Financeiro × Tributário', dim_a: 'financeiro', dim_b: 'tributario', order: 9 },
      { key: 'SxO', name: 'Sistemas × Operacional', dim_a: 'sistemas', dim_b: 'operacional', order: 10 }
    ];

    const penaltyProfiles = [
      {
        key: 'equilibrado',
        name: 'Equilibrado',
        fde_low_penalty: 0.07,
        fde_mid_penalty: 0.12,
        fde_critical_cap: 'Vulnerável',
        fag_low_penalty: 0.05,
        fag_high_penalty: 0.09,
        fas_low_penalty: 0.035,
        fas_high_penalty: 0.065
      }
    ];

    const ifmeClassifications = [
      { min: 0, max: 39, label: 'Crítica' },
      { min: 40, max: 59, label: 'Vulnerável' },
      { min: 60, max: 74, label: 'Instável' },
      { min: 75, max: 89, label: 'Estruturada' },
      { min: 90, max: 100, label: 'Madura' }
    ];

    const mqeClassifications = [
      { min: 0, max: 39, label: 'Conflito Estrutural' },
      { min: 40, max: 59, label: 'Dependência Vulnerável' },
      { min: 60, max: 74, label: 'Interdependência Instável' },
      { min: 75, max: 89, label: 'Interdependência Funcional' },
      { min: 90, max: 100, label: 'Interdependência Integrada' }
    ];

    const igiClassifications = [
      { min: 0, max: 39, label: 'Fragmentada' },
      { min: 40, max: 59, label: 'Vulneráveis' },
      { min: 60, max: 74, label: 'Tensão Latente' },
      { min: 75, max: 89, label: 'Coesa' },
      { min: 90, max: 100, label: 'Integração Sistêmica' }
    ];

    // Create MethodVersion
    const mv = await base44.entities.MethodVersion.create({
      version_code: 'FAL v1.0',
      status: 'active',
      dimensions,
      crossings,
      penalty_profiles: penaltyProfiles,
      ifme_classifications: ifmeClassifications,
      mqe_classifications: mqeClassifications,
      igi_classifications: igiClassifications,
      matrix_threshold: 75,
      notes: 'Versão inicial do método FAL® Digital'
    });

    // Create questions: 4 core (universal) + sector examples per dimension
    const questionData = [];
    const sectorExamples = {
      governanca: [
        { sectors: ['agriculture', 'agro_livestock'], text: 'Existe planejamento formal de safra com definição de metas estratégicas?', evidence_hint: 'plano de safra aprovado', risk_tag: 'agro_governance_planning' },
        { sectors: ['livestock', 'agro_livestock'], text: 'Existe governança formal sobre decisões do ciclo produtivo do rebanho?', evidence_hint: 'atas de decisão de manejo', risk_tag: 'livestock_governance' },
        { sectors: ['input_retail'], text: 'Há estrutura de governança para gestão do portfólio de produtos e fornecedores?', evidence_hint: 'política de compras', risk_tag: 'retail_governance' },
      ],
      operacional: [
        { sectors: ['agriculture', 'agro_livestock'], text: 'Existe planejamento formal de safra e gestão de risco climático?', evidence_hint: 'plano de safra', risk_tag: 'agricultural_planning' },
        { sectors: ['livestock', 'agro_livestock'], text: 'Existe controle estruturado do ciclo produtivo do rebanho?', evidence_hint: 'ficha de manejo zootécnico', risk_tag: 'livestock_cycle' },
        { sectors: ['agro_industry'], text: 'Há controle formal do processo produtivo industrial e rastreabilidade de insumos?', evidence_hint: 'sistema de rastreabilidade', risk_tag: 'agro_industry_traceability' },
        { sectors: ['input_retail'], text: 'Há controle de estoque e logística de insumos agrícolas?', evidence_hint: 'relatório de movimentação de estoque', risk_tag: 'retail_inventory' },
      ],
    };

    for (const dim of dimensions) {
      for (let i = 1; i <= 4; i++) {
        questionData.push({
          method_version_id: mv.id,
          dimension_key: dim.key,
          code: `${dim.key.toUpperCase().substring(0, 3)}-${String(i).padStart(2, '0')}`,
          text: `Pergunta ${i} da dimensão ${dim.name}`,
          weight: i <= 2 ? 3 : 2,
          order: i,
          guidance: `Orientação para avaliação da pergunta ${i}`,
          sector_tags: ['all'],
          sector_type: 'core',
          evidence_hint: '',
          risk_tag: `${dim.key}_core_${i}`,
        });
      }
      const examples = sectorExamples[dim.key] || [];
      examples.forEach((ex, idx) => {
        questionData.push({
          method_version_id: mv.id,
          dimension_key: dim.key,
          code: `${dim.key.toUpperCase().substring(0, 3)}-S${String(idx + 1).padStart(2, '0')}`,
          text: ex.text,
          weight: 2,
          order: 10 + idx,
          guidance: `Pergunta setorial — ${ex.sectors.join(', ')}`,
          sector_tags: ex.sectors,
          sector_type: 'sector',
          evidence_hint: ex.evidence_hint || '',
          risk_tag: ex.risk_tag || '',
        });
      });
    }
    await base44.entities.Question.bulkCreate(questionData);

    // MQE questions: all core/universal
    const mqeData = [];
    for (const cross of crossings) {
      for (let i = 1; i <= 5; i++) {
        mqeData.push({
          method_version_id: mv.id,
          crossing_key: cross.key,
          code: `${cross.key}-${String(i).padStart(2, '0')}`,
          text: `Pergunta MQE ${i} do cruzamento ${cross.name}`,
          weight: 1,
          order: i,
          guidance: `Orientação para avaliação MQE ${i}`,
          sector_tags: ['all'],
          sector_type: 'core',
          evidence_hint: '',
          risk_tag: `${cross.key}_mqe_${i}`,
        });
      }
    }
    await base44.entities.MQEQuestion.bulkCreate(mqeData);

    // Create 2 checklist items per dimension
    const checklistData = [];
    for (const dim of dimensions) {
      for (let i = 1; i <= 2; i++) {
        checklistData.push({
          method_version_id: mv.id,
          dimension_key: dim.key,
          item_id: `${dim.key}_chk_${i}`,
          label: `Evidência obrigatória ${i} — ${dim.name}`,
          required: true,
          order: i
        });
      }
    }
    await base44.entities.EvidenceChecklist.bulkCreate(checklistData);

    return Response.json({
      success: true,
      method_version_id: mv.id,
      questions_created: questionData.length,
      mqe_questions_created: mqeData.length,
      checklist_items_created: checklistData.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});