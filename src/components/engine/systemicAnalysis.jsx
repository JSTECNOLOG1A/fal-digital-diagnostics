/**
 * systemicAnalysis.js — Detecção de fragilidades sistêmicas e geração de achados FAL
 *
 * Analisa correlações entre clusters relacionados para identificar riscos estruturais
 * que não seriam capturados pela análise isolada de cada cluster.
 */

import { CLUSTER_RELATIONS } from '../config/clusterRelations';

const SYSTEMIC_THRESHOLD = 1.8; // score abaixo deste valor = cluster frágil (escala 0–3: limiar "Estruturado")
const MIN_WEAK_RATIO     = 0.5; // proporção mínima de clusters frágeis para disparar alerta

/**
 * Detecta fragilidades sistêmicas a partir dos resultados de clusters.
 *
 * @param {Array} clusters - Array de cluster results do runFullDiagnostic
 * @returns {Array} systemicWeaknesses - Ciclos com fragilidade detectada
 */
export function detectSystemicWeaknesses(clusters) {
  if (!clusters || clusters.length === 0) return [];

  // Mapa rápido: cluster_key → weighted_score
  const scoreMap = new Map();
  for (const c of clusters) {
    if (c.cluster_key && c.weighted_score !== null && c.weighted_score !== undefined) {
      scoreMap.set(c.cluster_key, c.weighted_score);
    }
  }

  const weaknesses = [];

  for (const [cycleKey, cycleDef] of Object.entries(CLUSTER_RELATIONS)) {
    const cycleClusterKeys = cycleDef.clusters;

    // Apenas clusters que foram avaliados (estão no scoreMap)
    const evaluated = cycleClusterKeys.filter(k => scoreMap.has(k));
    if (evaluated.length === 0) continue;

    const weakClusters = evaluated.filter(k => scoreMap.get(k) < SYSTEMIC_THRESHOLD);
    const weakRatio    = weakClusters.length / evaluated.length;

    if (weakRatio >= MIN_WEAK_RATIO) {
      const clusterDetails = evaluated.map(k => ({
        cluster_key: k,
        score:       scoreMap.get(k),
        is_weak:     scoreMap.get(k) < SYSTEMIC_THRESHOLD,
      }));

      const avgScore = evaluated.reduce((s, k) => s + scoreMap.get(k), 0) / evaluated.length;

      weaknesses.push({
        cycle_key:       cycleKey,
        cycle_label:     cycleDef.label,
        alert:           cycleDef.alert,
        business_impact: cycleDef.business_impact,
        clusters:        clusterDetails,
        weak_count:      weakClusters.length,
        total_evaluated: evaluated.length,
        weak_ratio:      Math.round(weakRatio * 100),
        avg_score:       Math.round(avgScore * 100) / 100,
        severity:        weakClusters.length === evaluated.length ? 'critical' : 'high',
      });
    }
  }

  // Ordenar: críticos primeiro, depois por maior proporção de fraqueza
  return weaknesses.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return b.weak_ratio - a.weak_ratio;
  });
}

/**
 * Gera achados formais a partir das fragilidades sistêmicas detectadas.
 *
 * @param {Array} systemicWeaknesses - resultado de detectSystemicWeaknesses
 * @returns {Array} findings
 */
export function generateFindings(systemicWeaknesses) {
  if (!systemicWeaknesses || systemicWeaknesses.length === 0) return [];

  return systemicWeaknesses.map(weakness => {
    const weakLabels = weakness.clusters
      .filter(c => c.is_weak)
      .map(c => _formatClusterKey(c.cluster_key))
      .join(', ');

    const allLabels = weakness.clusters
      .map(c => _formatClusterKey(c.cluster_key))
      .join(', ');

    const severityText = weakness.severity === 'critical'
      ? 'Todos os processos do ciclo apresentam fragilidades críticas'
      : `${weakness.weak_count} de ${weakness.total_evaluated} processos do ciclo estão abaixo do nível aceitável`;

    return {
      finding_key:       `systemic_${weakness.cycle_key}`,
      title:             `Fragilidade Sistêmica: ${weakness.cycle_label}`,
      description:       `${severityText}. ${weakness.alert} Processos avaliados: ${allLabels}. Processos críticos: ${weakLabels}.`,
      clusters_involved: weakness.clusters.map(c => c.cluster_key),
      weak_clusters:     weakness.clusters.filter(c => c.is_weak).map(c => c.cluster_key),
      impact:            weakness.business_impact,
      severity:          weakness.severity,
      avg_score:         weakness.avg_score,
      weak_ratio:        weakness.weak_ratio,
      cycle_key:         weakness.cycle_key,
      cycle_label:       weakness.cycle_label,
    };
  });
}

function _formatClusterKey(key) {
  if (!key) return '';
  return key
    .replace(/_cluster$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}