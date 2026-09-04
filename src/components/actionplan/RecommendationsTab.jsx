import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { REC_STATUS_STYLE, SOURCE_CFG, DIM_LABELS, PRIORITY_STYLE, HORIZON_LABEL } from './APlanConstants';
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

  // falClusters ainda é buscado pra ordenação de cluster ser usada em outro
  // lugar futuro, mas a tabela abaixo não depende dele.
  useQuery({
    queryKey: tenantKey(tenantId, 'fal-clusters'),
    queryFn: () => base44.entities.FalCluster.filter({ tenant_id: tenantId }, 'order', 500),
    enabled: !!tenantId,
    staleTime: 300_000,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterDim, setFilterDim] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
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
        await invalidateActionPlanQueries(qc, assessmentId, (planId || null), tenantId);
      }
    } catch (err) {
      console.error('Erro na geração:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Mesmo padrão de filtros/tabela da Lista Executiva — o consultor já está
  // acostumado com esse layout, então a tela de Recomendações usa a mesma
  // linguagem visual (colunas, badges, filtros) em vez de cards agrupados.
  const dims = useMemo(() => [...new Set(recommendations.map(r => r.dimension_key).filter(Boolean))], [recommendations]);
  const entities = useMemo(() => {
    const map = new Map();
    for (const r of recommendations) if (r.evaluated_entity_id) map.set(r.evaluated_entity_id, r.evaluated_entity_name || r.evaluated_entity_id);
    return [...map.entries()];
  }, [recommendations]);

  const visible = useMemo(() => recommendations.filter(r => {
    if (filterStatus === 'active') { if (['rejected', 'cancelled'].includes(r.status)) return false; }
    else if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterDim && r.dimension_key !== filterDim) return false;
    if (filterEntity && r.evaluated_entity_id !== filterEntity) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterSource && r.source_type !== filterSource) return false;
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [recommendations, filterStatus, filterDim, filterEntity, filterPriority, filterSource, search]);

  const totalGeral = recommendations.length;
  const totalFiltrado = visible.length;
  const pendingGeral = recommendations.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Recomendações Técnicas</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalFiltrado} de {totalGeral} listadas · {pendingGeral > 0 ? (
              <span className="text-amber-600 font-medium">{pendingGeral} pendente{pendingGeral > 1 ? 's' : ''} de aprovação</span>
            ) : (
              <span className="text-slate-400">nenhuma pendente</span>
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

      {/* Filters — mesmo padrão da Lista Executiva */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar recomendação..."
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none w-48"
        />
        <FilterPill value={filterStatus} onChange={setFilterStatus} options={[
          ['active', 'Ativas'], ['suggested', 'Sugeridas'], ['approved', 'Aprovadas'],
          ['converted_to_tasks', 'Convertidas'], ['rejected', 'Rejeitadas'], ['all', 'Todas'],
        ]} />
        {dims.length > 0 && (
          <select value={filterDim} onChange={e => setFilterDim(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
            <option value="">Todas dimensões</option>
            {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
          </select>
        )}
        {entities.length > 0 && (
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
            <option value="">Todas entidades</option>
            {entities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
          <option value="">Todas prioridades</option>
          <option value="critical">Crítico</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
          <option value="">Todas origens</option>
          {Object.entries(SOURCE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{totalFiltrado} recomendaç{totalFiltrado !== 1 ? 'ões' : 'ão'}</span>
      </div>

      {/* Table — mesma estrutura visual da Lista Executiva */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 1050 }}>
              <colgroup>
                <col style={{ width: 28 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 28 }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-800">
                  <th className="px-3 py-2.5 w-7" />
                  <th className="text-left px-3 py-2.5 font-semibold text-white sticky left-0 bg-slate-800 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Dimensão</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Cluster</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Entidade</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Recomendação</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Origem</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Responsável sugerido</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Prazo</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-white">Status</th>
                  <th className="w-7" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-slate-400">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma recomendação nesta visualização.
                    </td>
                  </tr>
                ) : visible.map(rec => (
                  <RecTableRow key={rec.id} rec={rec} onOpen={() => setSelectedRec(rec)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

/* ── Linha da tabela — mesmo esqueleto visual de TaskTableRow (ListaExecutivaTab) ── */
/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.onOpen
 */
function RecTableRow({ rec, onOpen }) {
  const p = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.medium;
  const s = REC_STATUS_STYLE[rec.status] || REC_STATUS_STYLE.suggested;
  const srcCfg = SOURCE_CFG[rec.source_type] || SOURCE_CFG.manual;
  const isDecided = ['converted_to_tasks', 'rejected', 'cancelled'].includes(rec.status);
  const prazoLabel = rec.horizon
    ? (HORIZON_LABEL[rec.horizon] || rec.horizon)
    : rec.suggested_deadline_days
      ? `${rec.suggested_deadline_days}d`
      : null;

  return (
    <tr onClick={onOpen} className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${isDecided ? 'opacity-60' : ''}`}>
      <td className="px-3 py-3">
        <span className={`w-2 h-2 rounded-full block ${p.dot} ${isDecided ? 'opacity-30' : ''}`} />
      </td>

      <td className="px-3 py-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors">
        {rec.dimension_key ? (
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[100px]">
            {DIM_LABELS[rec.dimension_key] || rec.dimension_key}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-3">
        {rec.cluster_key ? (
          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 truncate max-w-[130px]" title={rec.cluster_key}>
            {rec.cluster_key}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-3">
        {rec.evaluated_entity_name ? (
          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 truncate max-w-[110px]" title={rec.evaluated_entity_name}>
            {rec.evaluated_entity_name}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-3">
        <p className={`font-medium leading-snug ${isDecided ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {rec.title}
        </p>
      </td>

      <td className="px-3 py-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${srcCfg.cls}`}>{srcCfg.label}</span>
      </td>

      <td className="px-3 py-3 text-slate-600 truncate">
        {rec.suggested_owner_area || <span className="text-amber-400 text-[10px]">—</span>}
      </td>

      <td className="px-3 py-3 text-slate-500">
        {prazoLabel || <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${s.cls}`}>{s.label}</span>
      </td>

      <td className="px-2 py-3">
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </td>
    </tr>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
 * @param {any=} props.options
 */
function FilterPill({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-wrap">
      {options.map(([val, lbl]) => (
        <button key={val} onClick={() => onChange(val)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${value === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >{lbl}</button>
      ))}
    </div>
  );
}
