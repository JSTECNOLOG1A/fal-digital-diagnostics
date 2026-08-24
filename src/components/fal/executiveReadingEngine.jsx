/**
 * executiveReadingEngine.js
 * Motor de leitura executiva automática do gráfico 8D.
 * A tensão por dimensão é usada como inteligência interna — nunca exibida ao cliente.
 */

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operacional',
  sistemas:           'Tecnologia / Sistemas',
};

// Camadas organizacionais
const LAYERS = {
  structure:  ['governanca', 'juridico'],
  control:    ['controles_internos'],
  economic:   ['financeiro', 'contabil', 'tributario'],
  execution:  ['operacional', 'sistemas'],
};

const LAYER_LABELS = {
  structure:  'estrutura societária e de governança',
  control:    'controles internos',
  economic:   'base econômico-financeira',
  execution:  'capacidade de execução e tecnologia',
};

function classifyDimension(score) {
  if (score < 1.0) return 'critical';
  if (score < 2.0) return 'attention';
  if (score < 2.6) return 'moderate';
  return 'strong';
}

function stdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function classifyDispersion(sd) {
  if (sd < 0.35) return 'balanced';
  if (sd < 0.7) return 'moderate';
  return 'high';
}

/**
 * Deriva sinais narrativos a partir dos scores e tensões das dimensões.
 * @param {Array<{dimension_key, score, tension?}>} dimensions
 */
export function deriveNarrativeSignals(dimensions) {
  if (!dimensions?.length) return null;

  const activeDims = dimensions.filter(d => d.score !== undefined && d.score !== null);
  const scores = activeDims.map(d => d.score);
  const sd = stdDev(scores);
  const dispersion_profile = classifyDispersion(sd);

  const critical_dimensions = activeDims.filter(d => classifyDimension(d.score) === 'critical').map(d => d.dimension_key);
  const attention_dimensions = activeDims.filter(d => classifyDimension(d.score) === 'attention').map(d => d.dimension_key);
  const strong_dimensions = activeDims.filter(d => classifyDimension(d.score) === 'strong').map(d => d.dimension_key);
  const top_fragile = [...activeDims].sort((a, b) => a.score - b.score).slice(0, 3).map(d => d.dimension_key);

  // Identifica camada dominante de fragilidade
  const layerScores = {};
  for (const [layer, keys] of Object.entries(LAYERS)) {
    const layerDims = activeDims.filter(d => keys.includes(d.dimension_key));
    if (!layerDims.length) continue;
    layerScores[layer] = layerDims.reduce((s, d) => s + d.score, 0) / layerDims.length;
  }
  const dominant_layer = Object.entries(layerScores).sort((a, b) => a[1] - b[1])[0]?.[0] || 'execution';

  // Tensão sistêmica: usa média das tensões se disponível, senão usa range de scores
  const tensions = activeDims.filter(d => d.tension != null).map(d => d.tension);
  let systemic_tension;
  if (tensions.length >= 2) {
    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    systemic_tension = avgTension < 0.3 ? 'low' : avgTension < 0.6 ? 'moderate' : 'high';
  } else {
    const range = Math.max(...scores) - Math.min(...scores);
    systemic_tension = range < 0.5 ? 'low' : range < 1.2 ? 'moderate' : 'high';
  }

  return {
    dispersion: sd,
    dispersion_profile,
    critical_dimensions,
    attention_dimensions,
    strong_dimensions,
    top_fragile_dimensions: top_fragile,
    dominant_layer,
    systemic_tension,
    layer_scores: layerScores,
  };
}

/**
 * Gera o texto da Leitura Executiva do Diagnóstico.
 * @param {object} signals — resultado de deriveNarrativeSignals
 * @param {Array<{dimension_key, score}>} dimensions
 * @returns {string} — texto em parágrafos
 */
export function generateExecutive8DReading(signals, dimensions) {
  if (!signals || !dimensions?.length) return '';

  const { dispersion_profile, critical_dimensions, attention_dimensions, top_fragile_dimensions, dominant_layer, systemic_tension } = signals;

  const fragileDims = top_fragile_dimensions
    .filter(k => critical_dimensions.includes(k) || attention_dimensions.includes(k))
    .map(k => DIM_LABELS[k] || k);

  const dominantLayerLabel = LAYER_LABELS[dominant_layer] || dominant_layer;

  // BLOCO 1 — Visão geral
  let block1;
  if (dispersion_profile === 'balanced') {
    block1 = 'O gráfico 8D indica relativa uniformidade entre as dimensões avaliadas, sugerindo uma estrutura de gestão com desenvolvimento mais homogêneo.';
  } else if (dispersion_profile === 'moderate') {
    block1 = 'O gráfico 8D revela maturidade desigual entre as dimensões avaliadas, com variações relevantes que indicam desenvolvimento diferenciado entre as áreas da gestão.';
  } else {
    block1 = 'O gráfico 8D evidencia dispersão expressiva entre as dimensões avaliadas, com assimetria relevante que indica que a empresa evoluiu de forma desequilibrada entre as diferentes camadas da gestão.';
  }

  // BLOCO 2 — Concentração das fragilidades
  let block2 = '';
  if (fragileDims.length > 0) {
    const listed = fragileDims.slice(0, 3).join(', ');
    if (dominant_layer === 'execution') {
      block2 = `As maiores fragilidades concentram-se em ${listed}, indicando que os principais desafios estão menos relacionados ao direcionamento e mais à capacidade de transformar gestão em rotina consistente.`;
    } else if (dominant_layer === 'economic') {
      block2 = `Há concentração de fragilidades nas dimensões ${listed}, sugerindo vulnerabilidade na ${dominantLayerLabel} — com impacto potencial sobre previsibilidade, confiabilidade da informação e segurança tributária.`;
    } else if (dominant_layer === 'control') {
      block2 = `As dimensões ${listed} concentram os principais desvios, com destaque para fragilidades na camada de ${dominantLayerLabel}, que tende a ampliar a exposição operacional e reduzir a confiabilidade dos processos.`;
    } else {
      block2 = `Os maiores desvios aparecem em ${listed}, com concentração na camada de ${dominantLayerLabel}.`;
    }
  } else if (signals.strong_dimensions.length >= 4) {
    block2 = 'As oportunidades identificadas concentram-se em pontos específicos de evolução, sem evidência de ruptura sistêmica relevante.';
  }

  // BLOCO 3 — Leitura sistêmica com tensão invisível
  let block3 = '';
  if (systemic_tension === 'high') {
    block3 = 'Observa-se desalinhamento entre áreas mais maduras e áreas mais frágeis, o que indica que parte do esforço gerencial pode não estar se convertendo em eficiência operacional. A distância entre dimensões sugere um crescimento não acompanhado por padronização equivalente.';
  } else if (systemic_tension === 'moderate') {
    block3 = 'Embora existam sinais de estabilidade em algumas frentes, há tensão perceptível entre as camadas analisadas, indicando que certas fragilidades podem estar exercendo pressão sobre dimensões aparentemente mais sólidas.';
  } else {
    if (dispersion_profile === 'balanced') {
      block3 = 'A coerência entre as dimensões avaliadas sugere que a empresa construiu uma base relativamente integrada, o que favorece ganhos incrementais e iniciativas de escala com menor risco de ruptura.';
    } else {
      block3 = 'As variações identificadas, ainda que não críticas, merecem atenção para evitar que desequilíbrios pontuais limitem o desempenho de áreas com maior maturidade.';
    }
  }

  // BLOCO 4 — Implicação executiva
  let block4;
  if (dominant_layer === 'execution') {
    block4 = 'De forma consolidada, o maior potencial de ganho está no fortalecimento da base operacional, dos mecanismos de controle e da sustentação tecnológica — fatores que aumentam a previsibilidade e a capacidade de escala.';
  } else if (dominant_layer === 'economic') {
    block4 = 'A priorização recomendada deve concentrar-se no fortalecimento da base de controle e leitura econômica do negócio, elevando a confiabilidade das informações e a segurança nas decisões financeiras e tributárias.';
  } else if (dominant_layer === 'control') {
    block4 = 'Os avanços mais relevantes tendem a ocorrer onde a empresa melhorar capacidade de controle, reduzir dependência de informalidade e elevar a disciplina de gestão dos processos críticos.';
  } else {
    block4 = 'O diagnóstico sugere que os avanços mais relevantes tendem a ocorrer no fortalecimento da estrutura de governança e formalização das relações societárias, como base para crescimento sustentável.';
  }

  return [block1, block2, block3, block4].filter(Boolean).join('\n\n');
}