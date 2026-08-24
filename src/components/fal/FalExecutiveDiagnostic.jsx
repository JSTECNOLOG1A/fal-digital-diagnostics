/**
 * FalExecutiveDiagnostic.jsx
 *
 * Componente que exibe o resumo executivo do diagnóstico FAL.
 * Consome o motor local (falDiagnosticEngine) para cálculos reativos em tempo real.
 *
 * INTEGRAÇÃO:
 *   <FalExecutiveDiagnostic questions={falQuestions} responses={falResponses} />
 */
import React, { useMemo } from 'react';
import { runFullDiagnostic } from '@/components/engine/falDiagnosticEngine';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Target } from 'lucide-react';
import SystemicFindingsPanel from './SystemicFindingsPanel';

// ── Maturity Badge ────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.maturity
 * @param {any=} props.score
 * @param {any=} props.size
 */
function MaturityBadge({ maturity, score, size = 'md' }) {
  if (!maturity) return null;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1 font-semibold';
  return (
    <span
      className={`inline-flex items-center rounded-full border ${maturity.bg_class} ${maturity.text_class} ${maturity.border_class} ${sizeClass}`}
    >
      {maturity.label}
      {score !== undefined && ` · ${typeof score === 'number' ? score.toFixed(2) : score}`}
    </span>
  );
}

// ── Priority Dot ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.priority
 */
function PriorityDot({ priority }) {
  const colors = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-yellow-500',
    low:      'bg-green-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[priority] || 'bg-slate-400'}`} />;
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.score
 * @param {any=} props.max
 */
function ScoreBar({ score, max = 3 }) {
  const pct = score !== null && score !== undefined ? Math.round((score / max) * 100) : 0;
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct >= 25 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.questions
 * @param {any=} props.responses
 * @param {any=} props.activeDimensions
 * @param {any=} props.compact
 */
export default function FalExecutiveDiagnostic({ questions = [], responses = [], activeDimensions = null, compact = false }) {
  const result = useMemo(
    () => runFullDiagnostic({ questions, responses, activeDimensions }),
    [questions, responses, activeDimensions]
  );

  const { overall, dimensions, executive_summary, action_plan, clusters, system_findings } = result;

  if (!overall || overall.score === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400">
        <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Responda perguntas para visualizar o diagnóstico executivo.</p>
      </div>
    );
  }

  const completionPct = Math.round((overall.completion_rate || 0) * 100);
  const activeDims    = dimensions.filter(d => d.active && d.score !== null);

  return (
    <div className="space-y-4">
      {/* ── Score geral ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Score Geral FAL</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-slate-900">{overall.score?.toFixed(2)}</span>
              <span className="text-sm text-slate-400">/3.00</span>
            </div>
          </div>
          <MaturityBadge maturity={overall.maturity} />
        </div>
        <ScoreBar score={overall.score} />
        <p className="text-xs text-slate-400 mt-2">{completionPct}% das perguntas respondidas · Índice de maturidade: {overall.maturity_index}%</p>
      </div>

      {!compact && (
        <>
          {/* ── Narrativa executiva ─────────────────────────────────────────────── */}
          {executive_summary?.executive_narrative && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resumo Executivo</p>
              <p className="text-sm text-slate-700 leading-relaxed">{executive_summary.executive_narrative}</p>
            </div>
          )}

          {/* ── Score por dimensão ──────────────────────────────────────────────── */}
          {activeDims.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score por Dimensão</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[...activeDims].sort((a, b) => a.score - b.score).map(dim => (
                  <div key={dim.dimension_key} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700 truncate">{dim.dimension_label}</span>
                        <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                          {dim.score?.toFixed(2)} · <MaturityBadge maturity={dim.maturity} size="sm" />
                        </span>
                      </div>
                      <ScoreBar score={dim.score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Riscos críticos ─────────────────────────────────────────────────── */}
          {executive_summary?.critical_risks?.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Riscos Críticos Identificados</p>
              </div>
              <div className="space-y-1.5">
                {executive_summary.critical_risks.map(risk => (
                  <div key={risk.cluster_key} className="flex items-center gap-2 text-xs text-red-800">
                    <PriorityDot priority="critical" />
                    <span className="font-medium">{risk.cluster_label}</span>
                    <span className="text-red-500">({risk.dimension_key}) · Score: {risk.score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top prioridades do plano de ação ───────────────────────────────── */}
          {action_plan?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Prioridades de Ação</p>
              </div>
              <div className="divide-y divide-slate-50">
                {action_plan.slice(0, 5).map((action, idx) => (
                  <div key={action.cluster_key} className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <PriorityDot priority={action.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{action.action_title}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{action.suggested_deadline}</span>
                          <span className="text-[10px] font-medium capitalize" style={{ color: action.priority === 'critical' ? '#dc2626' : action.priority === 'high' ? '#ea580c' : '#ca8a04' }}>
                            {action.priority_label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{action.action_description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Achados Sistêmicos ──────────────────────────────────────────────── */}
          {system_findings?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <SystemicFindingsPanel findings={system_findings} />
            </div>
          )}

          {/* ── Forças vs Gaps ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executive_summary?.top_strengths?.length > 0 && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Pontos de Força</p>
                </div>
                {executive_summary.top_strengths.map(s => (
                  <div key={s.dimension} className="flex items-center justify-between text-xs text-emerald-800 mt-1">
                    <span>{s.label}</span>
                    <span className="font-semibold">{s.score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {executive_summary?.top_gaps?.length > 0 && (
              <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Principais Gaps</p>
                </div>
                {executive_summary.top_gaps.map(g => (
                  <div key={g.dimension} className="flex items-center justify-between text-xs text-orange-800 mt-1">
                    <span>{g.label}</span>
                    <span className="font-semibold">{g.score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}