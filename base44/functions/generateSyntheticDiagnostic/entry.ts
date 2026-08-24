/**
 * generateSyntheticDiagnostic
 * Gera síntese interpretativa integrada FAL + Financeiro.
 * 
 * Guards obrigatórios:
 * - diagnostic_link_id obrigatório
 * - DiagnosticLink.status deve ser "active"
 * - tenant_id do link deve bater com o do usuário autenticado (exceto HQ)
 * - Nunca sobrescreve — cria novo SyntheticDiagnosticSnapshot
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal/Tributário',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

function scoreToLevel(s) {
  if (s == null || isNaN(s)) return 'N/A';
  if (s < 1.0) return 'Crítico';
  if (s < 1.8) return 'Básico';
  if (s < 2.5) return 'Estruturado';
  return 'Avançado';
}

function riskFromScore(s) {
  if (s == null) return 'high';
  if (s < 1.0) return 'critical';
  if (s < 1.8) return 'high';
  if (s < 2.5) return 'medium';
  return 'low';
}

function buildCorrelations(falSnap, finDiagnosis) {
  const correlations = [];
  const dimScores = falSnap?.dimension_scores || {};

  // Controles internos baixos + indicadores financeiros
  const ci = dimScores['controles_internos'];
  if (ci?.score < 1.5) {
    correlations.push({
      fal_dimension: 'Controles Internos',
      financial_indicator: 'Confiabilidade das Informações Financeiras',
      interpretation: 'Controles internos baixos aumentam o risco de inconsistência nas demonstrações financeiras e dificultam a auditoria dos números.',
      risk_level: riskFromScore(ci.score),
    });
  }

  // Financeiro FAL baixo + dados financeiros
  const fin = dimScores['financeiro'];
  if (fin?.score < 1.8) {
    correlations.push({
      fal_dimension: 'Financeiro',
      financial_indicator: 'Gestão Financeira',
      interpretation: 'Dimensão financeira baixa no FAL sugere fragilidade na gestão do caixa, crédito ou planejamento financeiro, alinhando-se com possíveis pressões nos indicadores financeiros.',
      risk_level: riskFromScore(fin.score),
    });
  }

  // Governança boa + resultado ruim = problema econômico, não de governança
  const gov = dimScores['governanca'];
  if (gov?.score >= 2.0 && finDiagnosis?.status === 'completed') {
    correlations.push({
      fal_dimension: 'Governança',
      financial_indicator: 'Resultado Econômico',
      interpretation: 'Boa governança com pressão financeira pode indicar problema econômico, operacional ou mercadológico — não necessariamente falha de gestão. Avaliar contexto setorial e de mercado.',
      risk_level: 'medium',
    });
  }

  // Contábil baixo = risco de confiabilidade
  const cont = dimScores['contabil'];
  if (cont?.score < 1.5) {
    correlations.push({
      fal_dimension: 'Contábil',
      financial_indicator: 'Qualidade da Informação Contábil',
      interpretation: 'Dimensão contábil baixa pode sinalizar inconsistências no balancete, risco de informações não confiáveis para tomada de decisão.',
      risk_level: 'critical',
    });
  }

  // FAL baixo geral + financeiro aparentemente bom = sustentabilidade
  const overallScore = falSnap?.overall_score;
  if (overallScore < 1.8 && finDiagnosis?.status === 'completed') {
    correlations.push({
      fal_dimension: 'Geral (IFME™)',
      financial_indicator: 'Sustentabilidade Operacional',
      interpretation: 'Maturidade operacional baixa com performance financeira atual pode não ser sustentável no longo prazo. Empresas com IFME™ baixo tendem a apresentar deterioração financeira progressiva.',
      risk_level: overallScore < 1.0 ? 'critical' : 'high',
    });
  }

  return correlations;
}

function buildContradictions(falSnap, finDiagnosis) {
  const contradictions = [];
  const dimScores = falSnap?.dimension_scores || {};
  const gov = dimScores['governanca'];
  const fin = dimScores['financeiro'];

  // Governança alta + pressão financeira
  if (gov?.score >= 2.0) {
    contradictions.push({
      title: 'Governança estruturada com pressão financeira',
      description: 'A empresa demonstra maturidade em governança, mas pode apresentar dificuldades financeiras. Isso sugere que o problema pode ser de natureza econômica (mercado, margens, competição) e não de gestão.',
      possible_explanation: 'Pressão setorial, ciclo econômico desfavorável ou estrutura de custos não ajustada ao porte atual.',
    });
  }

  // Financeiro FAL alto + indicadores financeiros comprometidos
  if (fin?.score >= 2.0) {
    contradictions.push({
      title: 'Gestão financeira madura com dados financeiros divergentes',
      description: 'A empresa demonstra práticas maduras de gestão financeira, mas os dados do balancete ou DRE indicam pressões. Pode haver desfasagem temporal ou situação conjuntural.',
      possible_explanation: 'Momento de transição, investimentos em crescimento, ou fatores externos temporários.',
    });
  }

  return contradictions;
}

function buildRecommendations(falSnap, finDiagnosis, correlations) {
  const recs = [];
  const overallScore = falSnap?.overall_score;
  const dimScores = falSnap?.dimension_scores || {};

  // Recomendações baseadas em correlações críticas
  const criticalCorr = correlations.filter(c => c.risk_level === 'critical');
  criticalCorr.forEach(c => {
    recs.push({
      title: `Atenção prioritária: ${c.fal_dimension}`,
      description: `Dado o risco crítico identificado em ${c.fal_dimension}, recomenda-se ação imediata para mitigar impacto financeiro.`,
      priority: 'critical',
    });
  });

  // Recomendação geral de maturidade
  if (overallScore < 1.5) {
    recs.push({
      title: 'Programa estruturado de melhoria de maturidade',
      description: 'O nível de maturidade global (IFME™) indica necessidade de intervenção estruturada. Recomenda-se plano de ação com acompanhamento periódico.',
      priority: 'high',
    });
  }

  // Controles internos + financeiro
  const ci = dimScores['controles_internos'];
  if (ci?.score < 1.5) {
    recs.push({
      title: 'Fortalecer controles internos para confiabilidade financeira',
      description: 'Controles internos fracos comprometem a qualidade das informações financeiras. Priorizar implantação de rotinas de conciliação, aprovação e registro.',
      priority: 'high',
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Manter monitoramento periódico integrado',
      description: 'A empresa demonstra nível razoável de maturidade. Recomenda-se monitoramento contínuo com revisões semestrais do plano de ação.',
      priority: 'medium',
    });
  }

  return recs;
}

function computeSyntheticRisk(falSnap, correlations) {
  const score = falSnap?.overall_score;
  const hasCritical = correlations.some(c => c.risk_level === 'critical');
  const hasHigh = correlations.some(c => c.risk_level === 'high');

  if (hasCritical || (score != null && score < 1.0)) return 'critical';
  if (hasHigh || (score != null && score < 1.5)) return 'high';
  if (score != null && score < 2.0) return 'medium';
  return 'low';
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard — blocks client_viewer from mutations (WRITE_OPERATION)
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const { diagnostic_link_id } = body;
    if (!diagnostic_link_id) return Response.json({ error: 'diagnostic_link_id obrigatório' }, { status: 400 });

    // Carregar DiagnosticLink
    const link = await base44.asServiceRole.entities.DiagnosticLink.get(diagnostic_link_id);
    if (!link) return Response.json({ error: 'DiagnosticLink não encontrado' }, { status: 404 });

    // Guard: status ativo
    if (link.status !== 'active') return Response.json({ error: 'Vínculo inativo. Reative o vínculo antes de gerar a síntese.' }, { status: 422 });

    // Guard: tenant
    if (!isHQ && link.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: vínculo pertence a outro tenant' }, { status: 403 });
    }

    // Carregar dados FAL
    const falAssessment = await base44.asServiceRole.entities.Assessment.get(link.fal_assessment_id);
    if (!falAssessment) return Response.json({ error: 'Assessment FAL não encontrado' }, { status: 404 });

    const falSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: link.fal_assessment_id }, '-computed_at', 1
    );
    const falSnap = falSnaps[0] || null;
    if (!falSnap) return Response.json({ error: 'Nenhum snapshot FAL encontrado. Execute o diagnóstico FAL antes de gerar a síntese.' }, { status: 422 });

    // Carregar dados Financeiro
    const finDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(link.financial_diagnosis_id);
    if (!finDiagnosis) return Response.json({ error: 'Diagnóstico Financeiro não encontrado' }, { status: 404 });

    // Construir síntese interpretativa
    const correlations = buildCorrelations(falSnap, finDiagnosis);
    const contradictions = buildContradictions(falSnap, finDiagnosis);
    const recommendations = buildRecommendations(falSnap, finDiagnosis, correlations);
    const syntheticRisk = computeSyntheticRisk(falSnap, correlations);

    const overallScore = falSnap.overall_score;
    const overallLevel = falSnap.overall_level || scoreToLevel(overallScore);

    const maturity_summary = `IFME™ ${overallScore?.toFixed(2) || 'N/A'} — ${overallLevel}. ${
      overallScore < 1.0 ? 'Maturidade crítica com necessidade de intervenção imediata em todas as frentes.' :
      overallScore < 1.8 ? 'Maturidade básica com lacunas estruturais relevantes que comprometem a sustentabilidade operacional.' :
      overallScore < 2.5 ? 'Maturidade estruturada com oportunidades de evolução em dimensões específicas.' :
      'Maturidade avançada com práticas sólidas de gestão organizacional.'
    }`;

    const financial_summary = finDiagnosis.status === 'completed'
      ? `Diagnóstico financeiro concluído em ${finDiagnosis.last_period || '—'}. Análise disponível para correlação com maturidade operacional.`
      : `Diagnóstico financeiro em status "${finDiagnosis.status}". Dados financeiros parciais podem limitar a profundidade da síntese.`;

    const integrated_summary = `A leitura integrada aponta nível de risco ${syntheticRisk === 'critical' ? 'crítico' : syntheticRisk === 'high' ? 'alto' : syntheticRisk === 'medium' ? 'moderado' : 'baixo'} para o grupo. ${
      correlations.length > 0
        ? `Foram identificadas ${correlations.length} correlação(ões) relevante(s) entre a maturidade operacional e a situação financeira.`
        : 'Não foram identificadas correlações diretas de alto risco entre as duas dimensões.'
    } ${contradictions.length > 0 ? `Há ${contradictions.length} contradição(ões) que merecem atenção interpretativa.` : ''}`;

    const snapshot = await base44.asServiceRole.entities.SyntheticDiagnosticSnapshot.create({
      tenant_id: link.tenant_id,
      diagnostic_link_id,
      group_id: link.group_id,
      fal_assessment_id: link.fal_assessment_id,
      financial_diagnosis_id: link.financial_diagnosis_id,
      maturity_summary,
      financial_summary,
      integrated_summary,
      correlations,
      contradictions,
      recommendations,
      synthetic_risk_level: syntheticRisk,
      generated_at: new Date().toISOString(),
      generated_by: user.email,
    });

    return Response.json({
      snapshot_id: snapshot.id,
      synthetic_risk_level: syntheticRisk,
      correlations_count: correlations.length,
      contradictions_count: contradictions.length,
      recommendations_count: recommendations.length,
      maturity_summary,
      financial_summary,
      integrated_summary,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});