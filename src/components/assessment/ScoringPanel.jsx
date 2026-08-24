import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import DimensionInfoTooltip from '@/components/fal/DimensionInfoTooltip';
import { getDimensionLabel } from '@/components/fal/falOfficialMatrix';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

// ScoringPanel agora aceita FalDiagnosticSnapshot (campos: overall_score, dimension_scores, radar_points)
// ou ScoreSnapshot legado (campos: ifme_base, ifme_final, mqe_scores, igi)
/**
 * @param {Object} props
 * @param {any=} props.snapshot
 * @param {any=} props.dimensions
 * @param {any=} props.crossings
 * @param {any=} props.activeDimensions
 */
export default function ScoringPanel({ snapshot, dimensions, crossings, activeDimensions }) {
  if (!snapshot) {
    return (
      <div className="text-center py-16 text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum cálculo realizado ainda. Clique em "Gerar diagnóstico completo".</p>
      </div>
    );
  }

  // Detectar qual formato de snapshot está sendo passado
  const isFalSnapshot = snapshot.overall_score !== undefined || snapshot.dimension_scores !== undefined;

  // Filter dimensions to show only active ones
  const active = activeDimensions?.length ? activeDimensions : null;

  // Radar data — suporte aos dois formatos
  const radarData = isFalSnapshot
    ? (snapshot.radar_points || []).filter(p => !active || active.includes(p.dimension)).map(p => ({
        dimension: p.axis?.split(' ')[0] || p.dimension,
        score: Math.round(((p.score || 0) / 3) * 100), // normalizar 0-3 → 0-100
        fullMark: 100,
      }))
    : (active ? dimensions.filter(d => active.includes(d.key)) : dimensions).map(d => ({
        dimension: d.name.split(' ')[0],
        score: snapshot.dimension_scores?.[d.key]?.raw_score || 0,
        fullMark: 100,
      }));

  // MQE data — apenas disponível no ScoreSnapshot legado
  const mqeData = !isFalSnapshot ? crossings.map(c => ({
    crossing: c.key,
    name: c.name,
    score: snapshot.mqe_scores?.[c.key]?.score || 0,
    classification: snapshot.mqe_scores?.[c.key]?.classification || '—',
  })) : [];

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      {isFalSnapshot ? (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-slate-900 text-white">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-400 mb-2">IFME™ Score Geral</p>
              <p className="text-3xl font-bold">{(snapshot.overall_score || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-1">/ 3.00</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-500 mb-2">Nível de Maturidade</p>
              <p className="text-2xl font-bold text-slate-900">{snapshot.overall_level || '—'}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-500 mb-2">Índice de Maturidade</p>
              <p className="text-3xl font-bold text-blue-600">{snapshot.maturity_index ?? '—'}%</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-500 mb-2">IFME Base</p>
              <p className="text-3xl font-bold text-slate-900">{snapshot.ifme_base?.toFixed(1) ?? '—'}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-500 mb-2">Penalidades</p>
              <p className="text-3xl font-bold text-red-600">−{snapshot.penalties?.total?.toFixed(1) ?? '0.0'}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-slate-900 text-white">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-slate-400 mb-2">IFME Final</p>
              <p className="text-3xl font-bold">{snapshot.ifme_final?.toFixed(1) ?? '—'}</p>
              <ScoreBadge label={snapshot.ifme_classification} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm">Radar 8 Dimensões</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scores por Dimensão (FalDiagnosticSnapshot) */}
      {isFalSnapshot && snapshot.dimension_scores && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm">Scores por Dimensão</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(snapshot.dimension_scores)
                .filter(([, d]) => d.active && d.score !== null)
                .sort((a, b) => (a[1].score || 0) - (b[1].score || 0))
                .map(([key, d]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-36 flex-shrink-0">
                    <span className="text-xs text-slate-500 truncate">{getDimensionLabel(key)}</span>
                    <DimensionInfoTooltip dimKey={key} align="left" />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{minWidth:0}}>
                    <div
                      className={`h-full rounded-full ${d.score < 1 ? 'bg-red-500' : d.score < 1.8 ? 'bg-amber-500' : d.score < 2.5 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.round((d.score / 3) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-10 text-right">{(d.score || 0).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 w-20">{d.level}</span>
                </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MQE Heatmap (ScoreSnapshot legado) */}
      {!isFalSnapshot && mqeData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm">Cruzamentos MQE</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {mqeData.map(m => (
                <div key={m.crossing} className={`p-3 rounded-lg text-center ${
                  m.score >= 75 ? 'bg-emerald-50' : m.score >= 60 ? 'bg-blue-50' : m.score >= 40 ? 'bg-amber-50' : 'bg-red-50'
                }`}>
                  <p className="text-xs font-bold text-slate-700">{m.crossing}</p>
                  <p className="text-lg font-bold mt-1">{m.score.toFixed(1)}</p>
                  <p className="text-[9px] text-slate-500 leading-tight mt-0.5">{m.classification}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gaps críticos */}
      {isFalSnapshot && snapshot.gaps_top?.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Top Gaps (Dimensões Mais Críticas)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshot.gaps_top.map((g, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 text-sm text-red-700">
                  <span className="font-mono text-xs w-4">{i + 1}</span>
                  <span className="flex-1 font-medium">{g.axis}</span>
                  <span className="font-bold">{(g.score || 0).toFixed(2)}</span>
                  <span className="text-xs">{g.level}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts (ScoreSnapshot legado) */}
      {!isFalSnapshot && snapshot.alerts?.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Alertas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshot.alerts.map((alert, i) => (
                <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${alert.severity === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.severity === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  {alert.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}