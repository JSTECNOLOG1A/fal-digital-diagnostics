import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Loader2, BookOpen, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { REC_STATUS_STYLE, SOURCE_CFG, DIM_LABELS, PRIORITY_STYLE } from './APlanConstants';
import RecommendationDrawer from './RecommendationDrawer';
import AddRecommendationModal from './AddRecommendationModal';
import { invalidateActionPlanQueries, tenantKey, actionPlanKey } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.tasks
 * @param {boolean=} props.readOnly
 */
export default function RecommendationsTab({ planId, assessmentId, tenantId, tasks, readOnly = false }) {
  const qc = useQueryClient();
  const [selectedRec, setSelectedRec] = useState(null);

  // Buscar clusters para ordenação correta
  const { data: falClusters = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'fal-clusters'),
    queryFn: () => base44.entities.FalCluster.filter({ tenant_id: tenantId }, 'order', 500),
    enabled: !!tenantId,
    staleTime: 300_000,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterDim, setFilterDim] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [genMode, setGenMode] = useState('library_plus_ai');

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: actionPlanKey(tenantId, assessmentId, planId, 'recommendations'),
    queryFn: async () => {
      const [byPlan, byAssessment] = await Promise.all([
        planId ? base44.entities.ActionRecommendation.filter({ action_plan_id: planId, tenant_id: tenantId }, '-created_date', 200) : Promise.resolve([]),
        assessmentId ? base44.entities.ActionRecommendation.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-created_date', 200) : Promise.resolve([]),
      ]);
      const map = new Map();
      [...byPlan, ...byAssessment].forEach(r => map.set(r.id, r));
      return [...map.values()].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    },
    enabled: !!(planId || assessmentId),
  });

  const handleGenerate = async () => {
    if (!planId || !assessmentId) return;
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateActionRecommendations', {
        assessment_id: assessmentId,
        action_plan_id: planId,
        mode: genMode,
      });
      if (res.data?.error) {
        console.error('Erro ao gerar recomendações:', res.data.error);
      } else {
        await await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
      }
    } catch (err) {
      console.error('Erro na geração:', err);
    } finally {
      setGenerating(false);
    }
  };

  const visible = recommendations.filter(r => {
    if (filterSource !== 'all') {
      if (filterSource === 'fal_diagnostic') {
        const falSources = ['fal', 'fal_diagnostic', 'library', 'fal_library', 'cluster_library', 'fal_cluster_library'];
        if (!falSources.includes(r.source_type)) return false;
      } else {
        if (r.source_type !== filterSource) return false;
      }
    }
    if (filterStatus === 'active' && ['rejected', 'cancelled'].includes(r.status)) return false;
    if (filterStatus !== 'all' && filterStatus !== 'active' && r.status !== filterStatus) return false;
    if (filterDim !== 'all' && r.dimension_key !== filterDim) return false;
    return true;
  });

  const totalGeral = recommendations.length;
  const totalFiltrado = visible.length;
  const pendingGeral = recommendations.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;
  const pendingFiltrado = visible.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Recomendações Técnicas</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalFiltrado} de {totalGeral} listadas · {pendingFiltrado > 0 ? (
              <span className="text-amber-600 font-medium">{pendingFiltrado} pendentes filtradas ({pendingGeral} no total)</span>
            ) : (
              <span className="text-slate-400">{pendingGeral} pendentes no total</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-white">
            <Select value={genMode} onValueChange={setGenMode}>
              <SelectTrigger className="h-7 text-xs border-0 shadow-none w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="library_only">Biblioteca FAL</SelectItem>
                <SelectItem value="library_plus_ai">Biblioteca + IA</SelectItem>
                <SelectItem value="ai_only">Apenas IA</SelectItem>
              </SelectContent>
            </Select>
            {!readOnly && (
            <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating || !planId} className="h-7 px-2 text-xs gap-1 text-indigo-700">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Gerar
            </Button>
            )}
          </div>
          {!readOnly && (
          <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-8" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" /> Recomendação do consultor
          </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterBar label="Fonte:" value={filterSource} onChange={setFilterSource} options={[
          ['all', 'Todas'],
          ['fal_diagnostic', 'FAL'],
          ['financial_diagnostic', 'Financeiro'],
          ['library', 'Biblioteca'],
          ['ai', 'IA'],
          ['manual', 'Consultor'],
        ]} />
        <FilterBar label="Status:" value={filterStatus} onChange={setFilterStatus} options={[
          ['active', 'Ativas'],
          ['suggested', 'Sugeridas'],
          ['approved', 'Aprovadas'],
          ['converted_to_tasks', 'Convertidas'],
          ['rejected', 'Rejeitadas'],
          ['all', 'Todas'],
        ]} />
        <FilterBar label="Dimensão:" value={filterDim} onChange={setFilterDim} options={[
          ['all', 'Todas'],
          ...Object.entries(DIM_LABELS).map(([k, v]) => [k, v]),
        ]} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <BookOpen className="w-9 h-9 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma recomendação encontrada.</p>
          <p className="text-xs mt-1 text-slate-300">Gere recomendações da biblioteca ou adicione manualmente.</p>
        </div>
      ) : (
        <GroupedRecList recs={visible} onSelect={setSelectedRec} falClusters={falClusters} />
      )}

      {/* Drawer */}
      {selectedRec && (
        <RecommendationDrawer
          rec={selectedRec}
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          tasks={tasks}
          readOnly={readOnly}
          onClose={() => setSelectedRec(null)}
          onUpdated={() => {
            invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
            setSelectedRec(null);
          }}
        />
      )}

      {showAddModal && (
        <AddRecommendationModal
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          onClose={() => setShowAddModal(false)}
          onCreated={() => invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId)}
        />
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.onClick
 * @param {any=} props.inGroup
 */
function RecCard({ rec, onClick, inGroup }) {
  const statusCfg = REC_STATUS_STYLE[rec.status] || REC_STATUS_STYLE.suggested;
  const srcCfg = SOURCE_CFG[rec.source_type] || SOURCE_CFG.manual;
  const priCfg = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.medium;
  const isPending = ['suggested', 'needs_classification'].includes(rec.status);

  return (
    <div
      onClick={onClick}
      className={`bg-white p-4 cursor-pointer hover:bg-slate-50 transition-colors ${inGroup ? '' : `border rounded-xl ${isPending ? 'border-amber-200' : 'border-slate-200'}`} ${isPending && inGroup ? 'border-l-2 border-l-amber-400' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${srcCfg.cls}`}>{srcCfg.label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${priCfg.badge}`}>{priCfg.label}</span>
          {rec.dimension_key && (
            <span className="text-[10px] text-slate-400">{DIM_LABELS[rec.dimension_key] || rec.dimension_key}</span>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
      {rec.recommendation_text && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rec.recommendation_text}</p>
      )}
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
        <span>{rec.created_by ? `Por: ${rec.created_by}` : ''}</span>
        <span className="text-blue-600 font-medium">Ver detalhes →</span>
      </div>
    </div>
  );
}

// ── Formata cluster_key em label legível ──────────────────────────────────────
function formatClusterLabel(key) {
  if (!key) return 'Sem cluster';
  // Remove sufixos redundantes como "_cluster" no final e formata
  const cleaned = key
    .replace(/_cluster$/i, '')   // remove "_cluster" do final
    .replace(/_/g, ' ')
    .trim();
  return cleaned.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Grupo de cluster colapsável ───────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.clusterKey
 * @param {any=} props.recs
 * @param {any=} props.onSelect
 * @param {any=} props.defaultOpen
 */
function ClusterGroup({ clusterKey, recs, onSelect, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const pending = recs.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">{formatClusterLabel(clusterKey)}</span>
          <span className="text-[10px] text-slate-400">{recs.length} rec.</span>
          {pending > 0 && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              {pending} pendente{pending > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {recs.map(rec => (
            <RecCard key={rec.id} rec={rec} onClick={() => onSelect(rec)} inGroup />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Grupo de dimensão colapsável ──────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.dimKey
 * @param {any=} props.recs
 * @param {any=} props.onSelect
 * @param {any=} props.falClusters
 */
function DimensionGroup({ dimKey, recs, onSelect, falClusters }) {
  const [open, setOpen] = useState(true);
  const pending = recs.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;

  // Normalizar cluster_key: remover prefixo "dim:cluster_key" se existir
  const normalizeClusterKey = (ck) => {
    if (!ck) return '__no_cluster__';
    return ck.includes(':') ? ck.split(':').pop() : ck;
  };

  // Agrupar por cluster dentro da dimensão (usando cluster_key normalizado)
  const byCluster = {};
  recs.forEach(r => {
    const ck = normalizeClusterKey(r.cluster_key);
    if (!byCluster[ck]) byCluster[ck] = [];
    byCluster[ck].push(r);
  });

  // Ordenar clusters pelo campo `order` da entidade FalCluster
  const clusterOrderMap = {};
  falClusters.forEach(fc => {
    const normKey = normalizeClusterKey(fc.key);
    clusterOrderMap[normKey] = fc.order ?? 999;
  });

  const sortedClusterKeys = Object.keys(byCluster).sort((a, b) => {
    if (a === '__no_cluster__') return 1;
    if (b === '__no_cluster__') return -1;
    const oa = clusterOrderMap[a] ?? 999;
    const ob = clusterOrderMap[b] ?? 999;
    return oa - ob;
  });

  return (
    <div className="border border-slate-300 rounded-2xl overflow-hidden">
      {/* Header da dimensão */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-800 hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{DIM_LABELS[dimKey] || dimKey}</span>
          <span className="text-[10px] text-slate-300">{recs.length} recomendações</span>
          {pending > 0 && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-900/40 border border-amber-600/40 px-2 py-0.5 rounded-full">
              {pending} pendente{pending > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
      </button>

      {open && (
        <div className="p-3 space-y-2 bg-slate-50">
          {sortedClusterKeys.map(ck => (
            <ClusterGroup
              key={ck}
              clusterKey={ck === '__no_cluster__' ? null : ck}
              recs={byCluster[ck]}
              onSelect={onSelect}
              defaultOpen={sortedClusterKeys.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lista agrupada principal ──────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.recs
 * @param {any=} props.onSelect
 * @param {any=} props.falClusters
 */
function GroupedRecList({ recs, onSelect, falClusters = [] }) {
  // Agrupar por dimensão
  const byDim = {};
  recs.forEach(r => {
    const dk = r.dimension_key || '__no_dim__';
    if (!byDim[dk]) byDim[dk] = [];
    byDim[dk].push(r);
  });

  // Ordenar dimensões pela ordem do DIM_LABELS
  const dimOrder = Object.keys(DIM_LABELS);
  const sortedDims = Object.keys(byDim).sort((a, b) => {
    const ia = dimOrder.indexOf(a);
    const ib = dimOrder.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div className="space-y-3">
      {sortedDims.map(dk => (
        <DimensionGroup
          key={dk}
          dimKey={dk === '__no_dim__' ? null : dk}
          recs={byDim[dk]}
          onSelect={onSelect}
          falClusters={falClusters}
        />
      ))}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.onChange
 * @param {any=} props.options
 */
function FilterBar({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
      <span className="text-[10px] text-slate-400 px-1">{label}</span>
      {options.map(([val, lbl]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${value === val ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
        >{lbl}</button>
      ))}
    </div>
  );
}