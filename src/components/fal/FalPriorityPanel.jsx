import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, AlertTriangle, TrendingUp, Minus, ChevronDown, ChevronRight } from 'lucide-react';

const LEVEL_CONFIG = {
  'CRÍTICA':  { color: 'bg-red-100 text-red-800 border-red-300',     dot: 'bg-red-500',    label: 'Crítica',  icon: AlertTriangle },
  'ALTA':     { color: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500', label: 'Alta', icon: TrendingUp },
  'MÉDIA':    { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-500', label: 'Média', icon: Minus },
  'BAIXA':    { color: 'bg-slate-100 text-slate-600 border-slate-300',  dot: 'bg-slate-400', label: 'Baixa',  icon: Minus },
};

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

/**
 * @param {Object} props
 * @param {any=} props.level
 */
function PriorityBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG['BAIXA'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.cluster
 * @param {any=} props.rank
 */
function ClusterRow({ cluster, rank }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 hover:bg-slate-50 px-1 rounded">
      <span className="text-xs font-mono text-slate-400 w-5 text-right flex-shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate capitalize">{cluster.cluster?.replace(/_/g, ' ')}</p>
        <p className="text-xs text-slate-400">{DIM_LABELS[cluster.dimension] || cluster.dimension} → {cluster.subdimension?.replace(/_/g, ' ')}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-500">Score</p>
          <p className="text-sm font-bold text-slate-700">{(cluster.cluster_score || 0).toFixed(2)}</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-500">Índice</p>
          <p className="text-sm font-bold text-indigo-700">{(cluster.priority_index || 0).toFixed(1)}</p>
        </div>
        <PriorityBadge level={cluster.priority_level} />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.clusters
 */
function HeatmapSection({ title, clusters }) {
  const [expanded, setExpanded] = useState(true);
  if (!clusters?.length) return null;
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <Badge variant="outline" className="text-xs">{clusters.length}</Badge>
        </div>
      </button>
      {expanded && (
        <div className="p-2">
          {clusters.map((c, i) => <ClusterRow key={`${c.subdimension}:${c.cluster}`} cluster={c} rank={i + 1} />)}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.snapshotId
 */
export default function FalPriorityPanel({ assessmentId, snapshotId }) {
  const queryClient = useQueryClient();
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);
  const [computeResult, setComputeResult] = useState(null);

  // Lê snapshot canônico, com fallback seguro para "latest by assessment"
  // quando priorities_snapshot_id ainda não foi propagado pelo flow state
  const { data: snapshotData, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery({
    queryKey: ['fal-priority-snapshot', assessmentId, snapshotId],
    queryFn: async () => {
      // Tentar canonical first
      if (snapshotId) {
        return base44.entities.FalDiagnosticSnapshot.get(snapshotId);
      }
      // Fallback seguro: se snapshotId não existe ainda (flow ainda sincronizando),
      // buscar o snapshot mais recente do assessment
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter(
        { assessment_id: assessmentId },
        '-computed_at',
        1
      );
      return snaps[0] || null;
    },
    enabled: !!assessmentId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    setComputeResult(null);
    try {
      const res = await base44.functions.invoke('computeFalPriority', { assessment_id: assessmentId });
      if (res.data?.error) {
        setError(typeof res.data.error === 'string' ? res.data.error : JSON.stringify(res.data.error));
      } else {
        const d = res.data || {};
        setComputeResult({
          ok: true,
          total: d.total_clusters || 0,
          criticos: d.criticos || 0,
          alta: d.alta || 0,
          media: d.media || 0,
          baixa: d.baixa || 0,
        });
        // Invalida o flow primeiro — isso atualizará priorities_snapshot_id no componente pai,
        // que passará o novo snapshotId como prop, mudando o queryKey e buscando o novo snapshot.
        await queryClient.invalidateQueries({ queryKey: ['assessment-flow', assessmentId] });
        await queryClient.invalidateQueries({ queryKey: ['fal-priority-snapshot', assessmentId] });
        // Forçar refetch imediato do flow para propagar priorities_snapshot_id sem esperar staleTime
        await queryClient.refetchQueries({ queryKey: ['assessment-flow', assessmentId] });
      }
    } catch (err) {
      setError(err?.message || 'Erro ao calcular prioridades. Tente novamente.');
    } finally {
      setComputing(false);
    }
  };

  // snapshotLoading só é true quando snapshotId existe e a query está buscando
  if (snapshotLoading) return (
    <div className="text-center py-12 text-slate-400">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm">Carregando prioridades...</p>
    </div>
  );

  const source = snapshotData || {};
  const criticos = source.clusters_criticos || [];
  const alta     = source.clusters_alta_prioridade || [];
  const media    = source.clusters_media_prioridade || [];
  const baixa    = source.clusters_baixa_prioridade || [];
  const top10    = [...criticos, ...alta, ...media, ...baixa].slice(0, 10);
  const total    = criticos.length + alta.length + media.length + baixa.length;
  const hasPriority = total > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Prioridades do Diagnóstico</h3>
          {hasPriority && (
            <p className="text-xs text-slate-400 mt-0.5">
              {total} clusters analisados · {criticos.length} críticos · {alta.length} alta prioridade
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleCompute} disabled={computing} className="gap-1.5">
          {computing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando...</>
            : <><Zap className="w-3.5 h-3.5" /> {hasPriority ? 'Recalcular' : 'Calcular Prioridades'}</>}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {/* Feedback pós-cálculo */}
      {computeResult?.ok && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${computeResult.total === 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {computeResult.total === 0 ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          ) : (
            <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          )}
          <span>
            {computeResult.total === 0
              ? 'O cálculo foi concluído, mas este diagnóstico não gerou clusters priorizáveis. Revise o snapshot do diagnóstico ou os clusters/subdimensões avaliados.'
              : <>Prioridades calculadas com sucesso — <strong>{computeResult.total} clusters</strong>: {computeResult.criticos} críticos · {computeResult.alta} alta · {computeResult.media} média · {computeResult.baixa} baixa.</>
            }
          </span>
        </div>
      )}

      {!hasPriority && !computing && !computeResult && (
        <div className="text-center py-10 text-slate-400">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Clique em "Calcular Prioridades" para gerar o ranking automático de clusters.</p>
        </div>
      )}

      {!hasPriority && !computing && computeResult?.total === 0 && (
        <div className="text-center py-6 text-slate-400">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum cluster ranqueável encontrado neste diagnóstico.</p>
        </div>
      )}

      {hasPriority && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Crítica', count: criticos.length, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
              { label: 'Alta',    count: alta.length,     color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
              { label: 'Média',   count: media.length,    color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
              { label: 'Baixa',   count: baixa.length,    color: 'bg-slate-50 border-slate-200',   text: 'text-slate-600' },
            ].map(s => (
              <div key={s.label} className={`text-center p-3 rounded-lg border ${s.color}`}>
                <p className={`text-2xl font-bold ${s.text}`}>{s.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Top 10 */}
          {top10.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top 10 Clusters Críticos</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {top10.map((c, i) => <ClusterRow key={`top-${i}`} cluster={c} rank={i + 1} />)}
              </CardContent>
            </Card>
          )}

          {/* Heatmap por nível */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mapa de Prioridades por Dimensão</h4>
            {criticos.length > 0 && <HeatmapSection title="🔴 Prioridade Crítica — Ação Imediata" clusters={criticos} />}
            {alta.length > 0     && <HeatmapSection title="🟠 Prioridade Alta — Ciclo Atual" clusters={alta} />}
            {media.length > 0    && <HeatmapSection title="🟡 Prioridade Média — Backlog" clusters={media} />}
            {baixa.length > 0    && <HeatmapSection title="⚪ Prioridade Baixa — Monitorar" clusters={baixa} />}
          </div>
        </>
      )}
    </div>
  );
}