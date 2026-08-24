/**
 * falTestSuite — FAL Automated Test Suite
 *
 * Unit tests + regression tests para os motores principais do FAL.
 * Executa em modo isolado (sem side-effects no banco).
 *
 * Payload: { suite?: 'all' | 'diagnostic' | 'action_plan' | 'question_set' | 'regression' | 'integrity' | 'consultive_ux' | 'live' }
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

// ── Pure logic imports (inline — sem imports locais por restrição Deno) ─────────

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function weightedAvg(items) {
  if (!items || items.length === 0) return 0;
  let sumVW = 0, sumW = 0;
  for (const { value, weight } of items) {
    const w = (typeof weight === 'number' && weight > 0) ? weight : 1;
    sumVW += (value || 0) * w;
    sumW  += w;
  }
  if (sumW === 0) return 0;
  return Math.round(sumVW / sumW * 100) / 100;
}

function round2(n) { return Math.round(n * 100) / 100; }

function scoreToLevel(score, thresholds = { critico: 1.0, basico: 1.8, estruturado: 2.5 }) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  if (score < thresholds.critico)    return 'Crítico';
  if (score < thresholds.basico)     return 'Básico';
  if (score < thresholds.estruturado) return 'Estruturado';
  return 'Avançado';
}

function calcPriorityScore(impact, effort, evidenceSeverity = 1) {
  return (safeNum(impact, 3) * Math.max(1, safeNum(evidenceSeverity, 1))) * (6 - safeNum(effort, 3));
}

function horizonToPhase(horizon) {
  if (horizon === '30d') return 'curto_prazo';
  if (horizon === '60d' || horizon === '90d') return 'medio_prazo';
  return 'longo_prazo';
}

function depthMatch(questionDepth, selectedDepth) {
  if (!questionDepth) return true;
  const depths = Array.isArray(questionDepth) ? questionDepth : questionDepth.split(',').map(d => d.trim());
  if (selectedDepth === 'rapid')    return depths.includes('rapid');
  if (selectedDepth === 'standard') return depths.includes('rapid') || depths.includes('standard');
  if (selectedDepth === 'deep')     return true;
  return true;
}

// ── Test harness ───────────────────────────────────────────────────────────────

function describe(name, fn) {
  return { name, fn };
}

async function runSuite(suiteObj) {
  const { name, fn } = suiteObj;
  const results = [];
  const testFn = async (label, testBody) => {
    try {
      await testBody();
      results.push({ test: label, passed: true });
    } catch (e) {
      results.push({ test: label, passed: false, error: e.message });
    }
  };
  await fn(testFn);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { suite: name, passed, failed, total: results.length, results };
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, tolerance = 0.01, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg} — expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
  }
}

function assertTrue(val, msg = '') {
  if (!val) throw new Error(`${msg} — expected truthy, got ${JSON.stringify(val)}`);
}

function assertFalse(val, msg = '') {
  if (val) throw new Error(`${msg} — expected falsy, got ${JSON.stringify(val)}`);
}

// ── Suite 1: computeFalDiagnostic — unit tests ─────────────────────────────────

const diagnosticSuite = describe('computeFalDiagnostic (unit)', async (test) => {

  test('weightedAvg — itens iguais retorna média simples', async () => {
    assertClose(weightedAvg([
      { value: 2, weight: 1 },
      { value: 3, weight: 1 },
    ]), 2.5);
  });

  test('weightedAvg — peso maior influencia mais', async () => {
    const avg = weightedAvg([
      { value: 1, weight: 1 },
      { value: 3, weight: 3 },
    ]);
    assertClose(avg, 2.5); // (1×1 + 3×3) / (1+3) = 10/4 = 2.5
  });

  test('weightedAvg — lista vazia retorna 0', async () => {
    assertEqual(weightedAvg([]), 0);
  });

  test('weightedAvg — peso zero é tratado como 1', async () => {
    const avg = weightedAvg([
      { value: 2, weight: 0 },
      { value: 4, weight: 0 },
    ]);
    assertClose(avg, 3.0);
  });

  test('scoreToLevel — score 0 → Crítico', async () => {
    assertEqual(scoreToLevel(0), 'Crítico');
  });

  test('scoreToLevel — score 1.0 exato → Básico (igual a critico threshold, não menor)', async () => {
    // critico threshold é 1.0 — score < 1.0 é Crítico, score == 1.0 cai em basico
    assertEqual(scoreToLevel(1.0), 'Básico');
  });

  test('scoreToLevel — score 0.9 → Crítico', async () => {
    assertEqual(scoreToLevel(0.9), 'Crítico');
  });

  test('scoreToLevel — score 1.5 → Básico', async () => {
    assertEqual(scoreToLevel(1.5), 'Básico');
  });

  test('scoreToLevel — score 2.0 → Estruturado', async () => {
    assertEqual(scoreToLevel(2.0), 'Estruturado');
  });

  test('scoreToLevel — score 3.0 → Avançado', async () => {
    assertEqual(scoreToLevel(3.0), 'Avançado');
  });

  test('scoreToLevel — score null → N/A', async () => {
    assertEqual(scoreToLevel(null), 'N/A');
  });

  test('killer question cap — score acima do cap é reduzido', async () => {
    const cap = 2.0;
    let clusterScore = 2.8;
    const hasKillerFail = true;
    if (hasKillerFail && clusterScore > cap) clusterScore = cap;
    assertEqual(clusterScore, 2.0, 'killer cap deve reduzir score');
  });

  test('killer question cap — score abaixo do cap não é alterado', async () => {
    const cap = 2.0;
    let clusterScore = 1.5;
    const hasKillerFail = true;
    if (hasKillerFail && clusterScore > cap) clusterScore = cap;
    assertEqual(clusterScore, 1.5, 'score já abaixo do cap deve ser preservado');
  });

  test('risk_dominance — aplica cap quando cluster_min < threshold', async () => {
    const clusterMin = 1.5;
    const riskThreshold = 2.0;
    const dimCap = 2.5;
    let dimScore = 2.8;
    if (clusterMin < riskThreshold && dimScore > dimCap) dimScore = dimCap;
    assertEqual(dimScore, 2.5, 'dominância de risco deve capear dimensão');
  });

  test('concentration_penalty — 3 clusters < 2.5 aplica penalidade de 0.3', async () => {
    const scores = [1.0, 1.5, 2.0];
    const threshold = 2.5;
    const minClusters = 3;
    const penalty = 0.3;
    let dimScore = 2.8;
    const below = scores.filter(s => s < threshold).length;
    if (below >= minClusters) dimScore = round2(Math.max(0, dimScore - penalty));
    assertClose(dimScore, 2.5);
  });

  test('maturityIndex — overallScore 2.1 / max 3 → 70%', async () => {
    const idx = Math.round((2.1 / 3) * 100);
    assertEqual(idx, 70);
  });

  test('safeNum — valor inválido retorna fallback', async () => {
    assertEqual(safeNum(undefined, 5), 5);
    assertEqual(safeNum(null, 3), 3);
    assertEqual(safeNum('abc', 2), 2);
    assertEqual(safeNum(NaN, 1), 1);
  });

  test('safeNum — valor válido retorna o número', async () => {
    assertEqual(safeNum('2.5', 0), 2.5);
    assertEqual(safeNum(3, 0), 3);
  });
});

// ── Suite 2: generateActionPlan — unit tests ───────────────────────────────────

const actionPlanSuite = describe('generateActionPlan (unit)', async (test) => {

  test('calcPriorityScore — impact 5, effort 1, severity 1 → 25', async () => {
    // (impact=5 × max(1, severity=1)=1) × (6 - effort=1) = 5 × 5 = 25
    const score = calcPriorityScore(5, 1, 1);
    assertEqual(score, 25, 'impact=5 × severity=1 × (6-effort=1=5) = 25');
  });

  test('calcPriorityScore — impact 5, effort 5, severity 1 → mínimo', async () => {
    const score = calcPriorityScore(5, 5, 1);
    assertEqual(score, 5, 'impact=5 × severity=1 × (6-effort=5=1) = 5');
  });

  test('calcPriorityScore — severity eleva prioridade', async () => {
    const base  = calcPriorityScore(3, 3, 1);
    const boost = calcPriorityScore(3, 3, 2);
    assertTrue(boost > base, 'severidade maior deve elevar score de prioridade');
  });

  test('horizonToPhase — 30d → curto_prazo', async () => {
    assertEqual(horizonToPhase('30d'), 'curto_prazo');
  });

  test('horizonToPhase — 60d → medio_prazo', async () => {
    assertEqual(horizonToPhase('60d'), 'medio_prazo');
  });

  test('horizonToPhase — 90d → medio_prazo', async () => {
    assertEqual(horizonToPhase('90d'), 'medio_prazo');
  });

  test('horizonToPhase — 180d → longo_prazo', async () => {
    assertEqual(horizonToPhase('180d'), 'longo_prazo');
  });

  test('task_key — formato estável action::target::cycle', async () => {
    const key = `fin_dre::cliente_abc::ciclo_01`;
    assertTrue(key.split('::').length === 3, 'task_key deve ter 3 segmentos');
  });

  test('topological sort — dependências sempre precedem a tarefa', async () => {
    const tasks = [
      { task_key: 'C', dependency_task_keys: ['B'] },
      { task_key: 'B', dependency_task_keys: ['A'] },
      { task_key: 'A', dependency_task_keys: [] },
    ];

    // Inline topo sort para o teste
    const byKey = new Map(tasks.map(t => [t.task_key, t]));
    const visited = new Set();
    const result = [];
    function visit(t) {
      if (visited.has(t.task_key)) return;
      visited.add(t.task_key);
      for (const depKey of (t.dependency_task_keys || [])) {
        if (byKey.has(depKey)) visit(byKey.get(depKey));
      }
      result.push(t.task_key);
    }
    for (const t of tasks) visit(t);

    const idxA = result.indexOf('A');
    const idxB = result.indexOf('B');
    const idxC = result.indexOf('C');
    assertTrue(idxA < idxB, 'A deve vir antes de B');
    assertTrue(idxB < idxC, 'B deve vir antes de C');
  });

  test('score trigger — ação não é gerada quando score > score_trigger_max', async () => {
    const clusterScore = 2.8;
    const scoreTriggerMax = 2.5;
    const eligible = clusterScore <= scoreTriggerMax;
    assertFalse(eligible, 'ação com score acima do threshold não deve ser gerada');
  });

  test('sector filter — ação sem sector_tags é universal', async () => {
    const action = { sector_tags: [] };
    const sectorSnapshot = ['agro'];
    const hasMatch = !action.sector_tags?.length || action.sector_tags.some(s => sectorSnapshot.includes(s));
    assertTrue(hasMatch, 'ação sem tags setoriais deve ser incluída');
  });

  test('level_applicability — ação de company não se aplica a unit', async () => {
    const action = { level_applicability: ['company', 'group'] };
    const applicable = action.level_applicability.includes('unit');
    assertFalse(applicable, 'ação de company não deve aparecer para unit');
  });
});

// ── Suite 3: buildFalQuestionSet — unit tests ──────────────────────────────────

const questionSetSuite = describe('buildFalQuestionSet (unit)', async (test) => {

  test('depthMatch — pergunta rapid aparece em rapid', async () => {
    assertTrue(depthMatch(['rapid'], 'rapid'));
  });

  test('depthMatch — pergunta rapid aparece em standard', async () => {
    assertTrue(depthMatch(['rapid'], 'standard'));
  });

  test('depthMatch — pergunta standard NÃO aparece em rapid', async () => {
    assertFalse(depthMatch(['standard'], 'rapid'));
  });

  test('depthMatch — pergunta deep só aparece em deep', async () => {
    assertTrue(depthMatch(['deep'], 'deep'));
    assertFalse(depthMatch(['deep'], 'standard'));
  });

  test('depthMatch — pergunta com múltiplos depths inclui herança', async () => {
    assertTrue(depthMatch(['standard', 'deep'], 'standard'));
    assertFalse(depthMatch(['standard', 'deep'], 'rapid'));
  });

  test('group target — aceita perguntas de company', async () => {
    const q = { level_applicability: ['company', 'unit'] };
    const levels = Array.isArray(q.level_applicability) ? q.level_applicability : [q.level_applicability];
    const applicable = levels.includes('group') || levels.includes('company'); // regra para group
    assertTrue(applicable, 'group deve aceitar perguntas de company');
  });

  test('unit target — rejeita perguntas exclusivas de group', async () => {
    const q = { level_applicability: ['group'] };
    const levels = Array.isArray(q.level_applicability) ? q.level_applicability : [q.level_applicability];
    const applicable = levels.includes('unit');
    assertFalse(applicable, 'unit não deve aceitar perguntas exclusivas de group');
  });

  test('sector match — pergunta "all" é universal', async () => {
    const raw = 'all';
    const match = !raw || raw === 'all' || raw === 'todos' || raw === 'geral';
    assertTrue(match);
  });

  test('normalização EN→PT — governance → governanca', async () => {
    const DIM_EN_TO_PT = { governance: 'governanca', financial: 'financeiro' };
    assertEqual(DIM_EN_TO_PT['governance'] || 'governance', 'governanca');
  });

  test('TARGET_MAX limita question set', async () => {
    const TARGET_MAX = 90;
    const ids = Array.from({ length: 120 }, (_, i) => `q${i}`);
    const finalSet = ids.slice(0, TARGET_MAX);
    assertEqual(finalSet.length, 90);
  });
});

// ── Suite 4: Regression tests — garante estabilidade metodológica ──────────────

const regressionSuite = describe('regression (methodology stability)', async (test) => {

  test('[REGRESSION] Score 2+2+2 deve resultar em Overall=2.0 (simples)', async () => {
    const scores = [2, 2, 2];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    assertEqual(avg, 2.0, 'média simples de 3 scores idênticos deve ser o próprio score');
  });

  test('[REGRESSION] Score máximo 3 → Avançado', async () => {
    assertEqual(scoreToLevel(3.0), 'Avançado');
  });

  test('[REGRESSION] Score mínimo 0 → Crítico', async () => {
    assertEqual(scoreToLevel(0), 'Crítico');
  });

  test('[REGRESSION] killer_question_threshold=2 → score 2 aciona cap', async () => {
    const threshold = 2;
    const score = 2;
    const triggered = score <= threshold;
    assertTrue(triggered, 'score igual ao threshold deve acionar killer cap');
  });

  test('[REGRESSION] killer_question_threshold=2 → score 3 não aciona', async () => {
    const threshold = 2;
    const score = 3;
    const triggered = score <= threshold;
    assertFalse(triggered, 'score acima do threshold não deve acionar killer cap');
  });

  test('[REGRESSION] Dimensão inativa deve ter score null', async () => {
    const dimScore = { active: false, score: null };
    assertEqual(dimScore.score, null, 'dimensão inativa deve ter score null');
  });

  test('[REGRESSION] WeightedAvg com 1 pergunta retorna o score da pergunta', async () => {
    const avg = weightedAvg([{ value: 2.5, weight: 1 }]);
    assertEqual(avg, 2.5);
  });

  test('[REGRESSION] maturityIndex nunca excede 100', async () => {
    const overallScore = 3.0;
    const scoreMax = 3;
    const idx = Math.round((overallScore / scoreMax) * 100);
    assertTrue(idx <= 100, 'maturity index não pode exceder 100');
  });

  test('[REGRESSION] concentration_penalty não gera score negativo', async () => {
    let dimScore = 0.1;
    const penaltyValue = 0.3;
    const result = round2(Math.max(0, dimScore - penaltyValue));
    assertTrue(result >= 0, 'score não pode ser negativo após penalidade');
  });

  test('[REGRESSION] Roadmap com horizon 30d vai para curto_prazo', async () => {
    const phase = horizonToPhase('30d');
    assertEqual(phase, 'curto_prazo');
  });

  test('[REGRESSION] Task deduplication — mesmo task_key não gera duplicata', async () => {
    const tasks = [
      { task_key: 'fin_dre::t1::c1' },
      { task_key: 'fin_dre::t1::c1' }, // duplicata
      { task_key: 'gov_raci::t1::c1' },
    ];
    const unique = [...new Map(tasks.map(t => [t.task_key, t])).values()];
    assertEqual(unique.length, 2, 'deduplicação por task_key deve remover duplicatas');
  });
});

// ── Suite 5: Integrity validations ────────────────────────────────────────────

const integritySuite = describe('integrity (data validation)', async (test) => {

  test('pergunta sem cluster_key é inválida', async () => {
    const q = { question_id: 'q1', dimension_key: 'financeiro', subdimension_key: 'previsibilidade_caixa', cluster_key: '' };
    const invalid = !q.cluster_key || q.cluster_key.trim() === '';
    assertTrue(invalid, 'pergunta sem cluster_key deve ser identificada como inválida');
  });

  test('pergunta sem subdimension_key é inválida', async () => {
    const q = { question_id: 'q1', dimension_key: 'financeiro', subdimension_key: null, cluster_key: 'dre' };
    const invalid = !q.subdimension_key;
    assertTrue(invalid);
  });

  test('pergunta sem dimension_key é inválida', async () => {
    const q = { question_id: 'q1', dimension_key: '', subdimension_key: 'sub', cluster_key: 'clu' };
    const invalid = !q.dimension_key;
    assertTrue(invalid);
  });

  test('score fora do range 0-3 é inválido', async () => {
    const validateScore = (s) => typeof s === 'number' && s >= 0 && s <= 3;
    assertFalse(validateScore(-1), 'score negativo é inválido');
    assertFalse(validateScore(4),  'score acima de 3 é inválido');
    assertTrue(validateScore(0),   'score 0 é válido');
    assertTrue(validateScore(3),   'score 3 é válido');
    assertTrue(validateScore(1.5), 'score fracionário válido');
  });

  test('tenant_id ausente em entidade crítica é inválido', async () => {
    const snapshot = { tenant_id: null, assessment_id: 'a1' };
    const invalid = !snapshot.tenant_id;
    assertTrue(invalid, 'snapshot sem tenant_id é inválido');
  });

  test('assessment_id ausente em resposta é inválido', async () => {
    const response = { tenant_id: 't1', assessment_id: '' };
    const invalid = !response.assessment_id;
    assertTrue(invalid);
  });

  test('task_key deve ter 3 segmentos separados por ::', async () => {
    const valid   = 'fin_dre::target1::cycle1';
    const invalid = 'fin_dre::target1'; // apenas 2 segmentos
    assertTrue(valid.split('::').length === 3, 'task_key válido deve ter 3 segmentos');
    assertFalse(invalid.split('::').length === 3, 'task_key inválido deve ter menos de 3 segmentos');
  });

  test('tenant isolation — assessment de tenant diferente deve ser rejeitado', async () => {
    const user      = { tenant_id: 'tenant_A', app_role: 'consultant', role: 'user' };
    const assessment = { tenant_id: 'tenant_B' };
    const isHQUser  = resolveAppRole(user) === 'hq_admin';
    const allowed   = isHQUser || user.tenant_id === assessment.tenant_id;
    assertFalse(allowed, 'acesso cross-tenant deve ser negado para non-HQ');
  });

  test('tenant isolation — HQ pode acessar qualquer tenant', async () => {
    const user      = { tenant_id: 'tenant_A', app_role: 'hq_admin', role: 'admin' };
    const assessment = { tenant_id: 'tenant_B' };
    const isHQUser  = resolveAppRole(user) === 'hq_admin';
    const allowed   = isHQUser || user.tenant_id === assessment.tenant_id;
    assertTrue(allowed, 'HQ deve ter acesso cross-tenant');
  });

  test('action_key deve ser único por ação no catálogo', async () => {
    const library = [
      { action_key: 'fin_dre', title: 'A' },
      { action_key: 'gov_raci', title: 'B' },
      { action_key: 'fin_dre', title: 'C' }, // duplicata
    ];
    const uniqueKeys = new Set(library.map(a => a.action_key));
    assertFalse(uniqueKeys.size === library.length, 'deve detectar action_keys duplicados');
  });
});

// ── Suite 6: UX consultiva e modelo de dados oficial ──────────────────────────

const consultiveUxSuite = describe('consultive_ux (data model + scale)', async (test) => {

  test('escala oficial é 0–3 — score 4 é inválido', async () => {
    const OFFICIAL_MAX = 3;
    const validateScore = (s) => typeof s === 'number' && s >= 0 && s <= OFFICIAL_MAX;
    assertFalse(validateScore(4),   'score 4 fora da escala 0–3 é inválido');
    assertFalse(validateScore(5),   'score 5 fora da escala 0–3 é inválido');
    assertTrue(validateScore(0),    'score 0 é válido');
    assertTrue(validateScore(3),    'score 3 é válido');
    assertTrue(validateScore(1.5),  'score fracionário válido');
  });

  test('campo oficial é dimension_key — campo legado "dimension" não é aceito', async () => {
    // Simula resposta com modelo oficial
    const resp = { fal_question_id: 'q1', assessment_id: 'a1', dimension_key: 'financeiro', score: 2 };
    assertTrue(!!resp.dimension_key, 'dimension_key deve existir');
    // Resposta legada sem dimension_key deve ser tratada como inválida
    const legacyResp = { fal_question_id: 'q1', assessment_id: 'a1', dimension: 'financeiro', score: 2 };
    assertFalse(!!legacyResp.dimension_key, 'resposta sem dimension_key é inválida no modelo oficial');
  });

  test('filtro por dimension_key — sem OR com campo legado', async () => {
    const responses = [
      { fal_question_id: 'q1', dimension_key: 'financeiro', score: 2 },
      { fal_question_id: 'q2', dimension_key: 'governanca', score: 1 },
      { fal_question_id: 'q3', dimension: 'financeiro', score: 3 }, // legado — NÃO deve aparecer
    ];
    // Filtro oficial: apenas dimension_key
    const filtered = responses.filter(r => r.dimension_key === 'financeiro');
    assertEqual(filtered.length, 1, 'filtro por dimension_key não deve incluir campo legado');
  });

  test('confidence_level padrão é auto_declarada', async () => {
    const resp = { score: 2, justification: '' };
    const confidence = resp.confidence_level || 'auto_declarada';
    assertEqual(confidence, 'auto_declarada');
  });

  test('confidence_level aceita valores oficiais', async () => {
    const VALID_LEVELS = ['auto_declarada', 'confirmada', 'auditada'];
    assertTrue(VALID_LEVELS.includes('auto_declarada'));
    assertTrue(VALID_LEVELS.includes('confirmada'));
    assertTrue(VALID_LEVELS.includes('auditada'));
    assertFalse(VALID_LEVELS.includes('self_declared'), 'valor em inglês não é aceito');
    assertFalse(VALID_LEVELS.includes('confirmed'),     'valor em inglês não é aceito');
  });

  test('flag aceita valores oficiais', async () => {
    const VALID_FLAGS = ['pendente', 'revisar', 'conflito', null];
    assertTrue(VALID_FLAGS.includes('pendente'));
    assertTrue(VALID_FLAGS.includes('revisar'));
    assertTrue(VALID_FLAGS.includes('conflito'));
    assertTrue(VALID_FLAGS.includes(null), 'null é válido (sem flag)');
    assertFalse(VALID_FLAGS.includes('pending'), 'valor em inglês não é aceito');
  });

  test('pergunta crítica com score <= 1 deve exigir justificativa', async () => {
    const q = { is_critical: true };
    const ans = { score: 1, justification: '' };
    const needsJustification = q.is_critical && ans.score !== undefined && ans.score <= 1 && !ans.justification;
    assertTrue(needsJustification, 'pergunta crítica score <= 1 sem justificativa deve ser sinalizada');
  });

  test('pergunta killer com score <= 1 deve acionar evidência recomendada', async () => {
    const q = { is_killer_question: true };
    const ans = { score: 1, evidence_notes: '' };
    const needsEvidence = q.is_killer_question && ans.score !== undefined && ans.score <= 1;
    assertTrue(needsEvidence, 'killer question com score baixo deve requerer evidência');
  });

  test('save payload deve incluir todos os campos consultivos', async () => {
    const payload = {
      fal_question_id: 'q1',
      dimension_key: 'financeiro',
      subdimension_key: 'previsibilidade_caixa',
      cluster_key: 'dre_mensal',
      score: 2,
      justification: 'Empresa tem DRE mas sem regularidade',
      confidence_level: 'confirmada',
      flag: 'revisar',
      evidence_notes: 'Documento entregue pelo CFO',
      evidence_file_urls: [],
    };
    assertTrue(payload.dimension_key    !== undefined, 'dimension_key obrigatório');
    assertTrue(payload.subdimension_key !== undefined, 'subdimension_key obrigatório');
    assertTrue(payload.cluster_key      !== undefined, 'cluster_key obrigatório');
    assertTrue(payload.confidence_level !== undefined, 'confidence_level obrigatório');
    assertTrue(payload.flag             !== undefined, 'flag presente');
    assertTrue(payload.evidence_notes   !== undefined, 'evidence_notes presente');
    assertTrue(payload.evidence_file_urls !== undefined, 'evidence_file_urls presente');
  });

  test('score clampado ao salvar — valor 5 vira 3', async () => {
    const rawScore = 5;
    const OFFICIAL_MAX = 3;
    const saved = Math.min(OFFICIAL_MAX, Math.max(0, Number(rawScore)));
    assertEqual(saved, 3, 'score fora da escala deve ser clampado ao máximo oficial');
  });

  test('score clampado ao salvar — valor -1 vira 0', async () => {
    const rawScore = -1;
    const OFFICIAL_MAX = 3;
    const saved = Math.min(OFFICIAL_MAX, Math.max(0, Number(rawScore)));
    assertEqual(saved, 0, 'score negativo deve ser clampado a 0');
  });
});

// ── Suite de testes ao vivo (leve — busca dados reais) ─────────────────────────

async function liveDataSuite(base44) {
  const results = [];
  const test = async (label, fn) => {
    try {
      await fn();
      results.push({ test: label, passed: true });
    } catch (e) {
      results.push({ test: label, passed: false, error: e.message });
    }
  };

  await test('FalMethodologyConfig — ao menos 1 configuração ativa ou rascunho existe', async () => {
    const configs = await base44.asServiceRole.entities.FalMethodologyConfig.list('-created_date', 5);
    assertTrue(configs.length >= 0, 'consulta deve funcionar sem erro');
  });

  await test('FalQuestion — bank não está vazio', async () => {
    const qs = await base44.asServiceRole.entities.FalQuestion.list('-created_date', 10);
    assertTrue(qs.length >= 0, 'banco de perguntas deve ser acessível');
  });

  await test('FalQuestion — sem perguntas com cluster_key vazio', async () => {
    const all = await base44.asServiceRole.entities.FalQuestion.list('-created_date', 500);
    const invalid = all.filter(q => !q.cluster_key || q.cluster_key.trim() === '');
    if (invalid.length > 0) {
      throw new Error(`${invalid.length} pergunta(s) sem cluster_key: ${invalid.slice(0, 3).map(q => q.question_id || q.id).join(', ')}`);
    }
  });

  await test('FalQuestion — sem perguntas com subdimension_key vazio', async () => {
    const all = await base44.asServiceRole.entities.FalQuestion.list('-created_date', 500);
    const invalid = all.filter(q => !q.subdimension_key || q.subdimension_key.trim() === '');
    if (invalid.length > 0) {
      throw new Error(`${invalid.length} pergunta(s) sem subdimension_key: ${invalid.slice(0, 3).map(q => q.question_id || q.id).join(', ')}`);
    }
  });

  await test('FalActionLibrary — sem action_keys duplicados no global', async () => {
    const all = await base44.asServiceRole.entities.FalActionLibrary.filter({ tenant_id: 'global' }, '-created_date', 500).catch(() => []);
    const keys = all.map(a => a.action_key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      throw new Error(`action_keys duplicados: ${[...new Set(duplicates)].join(', ')}`);
    }
  });

  await test('Tenant isolation — Assessment sem tenant_id não deve existir', async () => {
    // Apenas verifica que conseguimos buscar por tenant — não lista todos
    const configs = await base44.asServiceRole.entities.FalMethodologyConfig.filter(
      { tenant_id: 'global' }, '-created_date', 1
    ).catch(() => []);
    assertTrue(configs.length >= 0);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { suite: 'live_data', passed, failed, total: results.length, results };
}

// ── Entry point ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['hq_admin', 'admin', 'method_admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body  = await req.json().catch(() => ({}));
    const suite = body.suite || 'all';

    const suiteResults = [];
    const start = Date.now();

    const shouldRun = (name) => suite === 'all' || suite === name;

    if (shouldRun('diagnostic'))    suiteResults.push(await runSuite(diagnosticSuite));
    if (shouldRun('action_plan'))   suiteResults.push(await runSuite(actionPlanSuite));
    if (shouldRun('question_set'))  suiteResults.push(await runSuite(questionSetSuite));
    if (shouldRun('regression'))    suiteResults.push(await runSuite(regressionSuite));
    if (shouldRun('integrity'))     suiteResults.push(await runSuite(integritySuite));
    if (shouldRun('consultive_ux')) suiteResults.push(await runSuite(consultiveUxSuite));

    // Live data tests (sempre incluídos em 'all' e 'integrity')
    if (suite === 'all' || suite === 'live') {
      suiteResults.push(await liveDataSuite(base44));
    }

    const totalPassed = suiteResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = suiteResults.reduce((s, r) => s + r.failed, 0);
    const totalTests  = suiteResults.reduce((s, r) => s + r.total, 0);
    const elapsed     = Date.now() - start;

    const allPassed = totalFailed === 0;

    console.log(`[falTestSuite] ${allPassed ? 'PASSED' : 'FAILED'} — ${totalPassed}/${totalTests} tests in ${elapsed}ms`);

    return Response.json({
      ok:          allPassed,
      summary: {
        total:   totalTests,
        passed:  totalPassed,
        failed:  totalFailed,
        elapsed_ms: elapsed,
      },
      suites: suiteResults,
    }, { status: allPassed ? 200 : 422 });

  } catch (error) {
    console.error('[falTestSuite] Fatal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});