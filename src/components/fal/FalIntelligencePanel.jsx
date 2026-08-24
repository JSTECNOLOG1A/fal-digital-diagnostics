import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, ChevronDown, ChevronRight, TrendingUp, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

const PRIORITY_COLORS = {
  'CRÍTICA': 'bg-red-100 text-red-800 border-red-300',
  'ALTA':    'bg-orange-100 text-orange-800 border-orange-300',
  'MÉDIA':   'bg-yellow-100 text-yellow-800 border-yellow-300',
  'BAIXA':   'bg-slate-100 text-slate-600 border-slate-300',
};

const BENCHMARK_COLORS = {
  top10:          'text-emerald-700 bg-emerald-50',
  acima:          'text-blue-700 bg-blue-50',
  medio:          'text-yellow-700 bg-yellow-50',
  abaixo:         'text-red-700 bg-red-50',
  sem_benchmark:  'text-slate-400 bg-slate-50',
};

/**
 * @param {Object} props
 * @param {any=} props.value
 */
function ComplexityDots({ value }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= value ? 'bg-indigo-500' : 'bg-slate-200'}`} />
      ))}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.data
 */
function ClusterCard({ data }) {
  const [open, setOpen] = useState(false);
  const priorityColor = PRIORITY_COLORS[data.priority_level] || PRIORITY_COLORS['BAIXA'];
  const bmColor = BENCHMARK_COLORS[data.benchmark?.position] || BENCHMARK_COLORS['sem_benchmark'];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 capitalize truncate">{data.cluster?.replace(/_/g,' ')}</p>
            <p className="text-xs text-slate-400 truncate">{data.dimension?.replace(/_/g,' ')} → {data.subdimension?.replace(/_/g,' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-sm font-bold text-slate-700">{(data.score || 0).toFixed(2)}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityColor}`}>
            {data.priority_level}
          </span>
          {data.benchmark?.icon && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bmColor}`}>
              {data.benchmark.icon} {data.benchmark.label}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t bg-slate-50 px-4 py-4 space-y-4">
          {/* Benchmark detail */}
          {data.benchmark?.avg_score !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Benchmark de Mercado</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Média: <strong>{data.benchmark.avg_score?.toFixed(1)}</strong></span>
                <span>P75: <strong>{data.benchmark.p75_score?.toFixed(1)}</strong></span>
                <span>P90: <strong>{data.benchmark.p90_score?.toFixed(1)}</strong></span>
                {data.benchmark.gap_to_avg > 0 && (
                  <span className="text-red-600">Gap para média: <strong>−{data.benchmark.gap_to_avg?.toFixed(2)}</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Root causes */}
          {data.root_causes?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-500" /> Causas Prováveis</p>
              {data.root_causes.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-white rounded p-2 border border-orange-100">
                  <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${c.probability === 'Alta' ? 'bg-red-100 text-red-700' : c.probability === 'Média' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.probability}
                  </span>
                  <span>{c.cause_description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Lightbulb className="w-3 h-3 text-blue-500" /> Ações Recomendadas</p>
              {data.recommendations.map((r, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded p-2.5 space-y-1">
                  <p className="text-xs text-blue-900">{r.recommendation_text}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Impacto: <strong className="text-blue-700">{r.impact_level}/5</strong></span>
                    <span className="flex items-center gap-1">Complexidade: <ComplexityDots value={r.implementation_complexity} /></span>
                    <span>Prazo: <strong>{r.estimated_time}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.root_causes?.length === 0 && data.recommendations?.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4" /> Cluster com boa maturidade — sem causas críticas identificadas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BENCHMARK_GROUPS = [
  { value: 'agronegocio', label: 'Agronegócio' },
  { value: 'fazenda_grande', label: 'Fazenda Grande' },
  { value: 'fazenda_media', label: 'Fazenda Média' },
  { value: 'grupo_familiar', label: 'Grupo Familiar' },
  { value: 'revenda_insumos', label: 'Revenda de Insumos' },
  { value: 'geral', label: 'Geral' },
];

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.snapshot
 * @param {any=} props.prioritiesStatus
 * @param {any=} props.intelligenceSnapshotId
 */
export default function FalIntelligencePanel({ assessmentId, snapshot: snapshotProp, prioritiesStatus, intelligenceSnapshotId }) {
  const queryClient = useQueryClient();
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);
  const [benchmarkGroup, setBenchmarkGroup] = useState('agronegocio');
  const [filter, setFilter] = useState('all');
  const [freshAnalysis, setFreshAnalysis] = useState(null);

  // Usa o intelligence_snapshot_id canônico do flow — não "latest by assessment"
  const { data: cachedSnapshot } = useQuery({
    queryKey: ['fal-intelligence-snapshot', assessmentId, intelligenceSnapshotId],
    queryFn: async () => {
      if (intelligenceSnapshotId) {
        return base44.entities.FalDiagnosticSnapshot.get(intelligenceSnapshotId);
      }
      // Fallback: mesma query do diagnóstico (snapshotProp já carregado acima)
      return snapshotProp || null;
    },
    enabled: !!assessmentId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const snapshotData = cachedSnapshot || snapshotProp;

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    setFreshAnalysis(null);
    const res = await base44.functions.invoke('computeClusterIntelligence', {
      assessment_id: assessmentId,
      benchmark_group: benchmarkGroup,
    });
    if (res.data?.error) {
      setError(typeof res.data.error === 'string' ? res.data.error : JSON.stringify(res.data.error));
    } else {
      setFreshAnalysis(res.data);
      // Invalida o flow primeiro (atualiza intelligence_snapshot_id), depois as queries de snapshot
      await queryClient.invalidateQueries({ queryKey: ['assessment-flow', assessmentId] });
      await queryClient.invalidateQueries({ queryKey: ['fal-intelligence-snapshot', assessmentId] });
      await queryClient.invalidateQueries({ queryKey: ['fal-snapshot-full', assessmentId] });
    }
    setComputing(false);
  };

  if (!snapshotData && !computing) return (
    <div className="text-center py-12 text-slate-400">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm">Carregando dados do diagnóstico...</p>
    </div>
  );

  // Pré-condição: usa o prioritiesStatus do flow (fonte canônica) — não infere do snapshot
  const hasPriorities = prioritiesStatus === 'done' || !!(
    snapshotData?.priority_computed_at ||
    snapshotData?.clusters_criticos?.length > 0
  );

  const hasIntelligence = freshAnalysis ? true : !!snapshotData?.cluster_analysis;

  // Quando freshAnalysis existe mas ainda não temos o mapa completo, mostra o top10 da resposta
  const allClusters = freshAnalysis
    ? (freshAnalysis.top10 || []).sort((a, b) => b.priority_index - a.priority_index)
    : Object.values(snapshotData?.cluster_analysis || {}).sort((a, b) => b.priority_index - a.priority_index);

  const filtered = filter === 'all' ? allClusters
    : allClusters.filter(c => c.priority_level === filter);

  const critCount   = allClusters.filter(c => c.priority_level === 'CRÍTICA').length;
  const altaCount   = allClusters.filter(c => c.priority_level === 'ALTA').length;
  const abaixoCount = allClusters.filter(c => c.benchmark?.position === 'abaixo').length;
  const causasCount = allClusters.filter(c => c.root_causes?.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" /> Diagnóstico Inteligente FAL™
          </h3>
          {hasIntelligence && (
            <p className="text-xs text-slate-400 mt-0.5">
              {allClusters.length} clusters · {critCount} críticos · {causasCount} com causas mapeadas · {abaixoCount} abaixo do benchmark
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={benchmarkGroup}
            onChange={e => setBenchmarkGroup(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-white text-slate-700"
          >
            {BENCHMARK_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={handleCompute} disabled={computing} className="gap-1.5">
            {computing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
              : <><Brain className="w-3.5 h-3.5" /> {hasIntelligence ? 'Reanalisar' : 'Analisar Clusters'}</>}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {/* Pré-condição: prioridades não calculadas */}
      {!hasPriorities && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            <strong>Prioridades não calculadas.</strong> Execute a aba "Prioridades Estratégicas" antes de analisar clusters — o diagnóstico inteligente depende do mapa de prioridades.
          </span>
        </div>
      )}

      {!hasIntelligence && !computing && hasPriorities && (
        <div className="text-center py-12 text-slate-400">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Clique em "Analisar Clusters" para gerar o diagnóstico inteligente.</p>
          <p className="text-xs mt-1">Causas prováveis, benchmark e recomendações automáticas por cluster.</p>
        </div>
      )}

      {/* Após análise: indicar se catálogos estavam vazios */}
      {freshAnalysis && causasCount === 0 && (
        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
          <span>
            Análise concluída, mas <strong>nenhuma causa ou recomendação</strong> foi encontrada nos catálogos para o grupo "{benchmarkGroup}". Os dados de benchmark e catálogo de causas podem ainda não estar populados.
          </span>
        </div>
      )}

      {freshAnalysis && (
        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Análise concluída: <strong>{freshAnalysis.clusters_analyzed}</strong> clusters · <strong>{freshAnalysis.clusters_with_causes}</strong> com causas · <strong>{freshAnalysis.clusters_below_benchmark}</strong> abaixo do benchmark.
            {freshAnalysis.clusters_analyzed > 10 && <span className="ml-1 text-emerald-600">(exibindo top 10 — recarregue para ver todos)</span>}
          </span>
        </div>
      )}

      {hasIntelligence && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Clusters críticos', value: critCount,   color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
              { label: 'Alta prioridade',   value: altaCount,   color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
              { label: 'Com causas',         value: causasCount, color: 'text-slate-700',   bg: 'bg-slate-50 border-slate-200' },
              { label: 'Abaixo benchmark',  value: abaixoCount, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
            ].map(s => (
              <div key={s.label} className={`text-center p-3 rounded-lg border ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex gap-1 flex-wrap">
            {[
              { value: 'all', label: `Todos (${allClusters.length})` },
              { value: 'CRÍTICA', label: `Crítica (${critCount})` },
              { value: 'ALTA', label: `Alta (${altaCount})` },
              { value: 'MÉDIA', label: `Média (${allClusters.filter(c=>c.priority_level==='MÉDIA').length})` },
              { value: 'BAIXA', label: `Baixa (${allClusters.filter(c=>c.priority_level==='BAIXA').length})` },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === f.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Clusters */}
          <div className="space-y-2">
            {filtered.map((c, i) => (
              <ClusterCard key={`${c.subdimension}:${c.cluster}`} data={c} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Nenhum cluster nesta categoria.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}