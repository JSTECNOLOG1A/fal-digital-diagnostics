import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, Layers, Hash, SortAsc, RefreshCw,
  Building2, BarChart3, ChevronRight } from
'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CreateFirstClientDialog from '@/components/assessments/CreateFirstClientDialog';
import PageContainer from '@/components/layout/PageContainer';
import { invalidateStructureQueries } from '@/lib/query-client';
import PermissionGuard from '@/components/shared/PermissionGuard';

const LEVEL_BADGE_CLASS = {
  Crítico: 'fal-badge fal-badge-danger',
  Básico: 'fal-badge fal-badge-warning',
  Estruturado: 'fal-badge fal-badge-current',
  Avançado: 'fal-badge fal-badge-success'
};

const LEVEL_SCORE_COLOR = {
  Crítico: 'var(--fal-danger-text)',
  Básico: 'var(--fal-warning-text)',
  Estruturado: 'var(--fal-current-text)',
  Avançado: 'var(--fal-success-text)'
};

/**
 * @param {Object} props
 * @param {any=} props.group
 * @param {any=} props.companyCount
 * @param {any=} props.aggSnap
 */
function GroupCard({ group, companyCount, aggSnap }) {
  const navigate = useNavigate();
  const num = group.group_order_number != null ?
  String(group.group_order_number).padStart(3, '0') :
  null;

  const hasSnap = !!aggSnap;
  const score = aggSnap?.overall_score;
  const level = aggSnap?.overall_level;
  const computedAt = aggSnap?.computed_at ?
  new Date(aggSnap.computed_at).toLocaleDateString('pt-BR') :
  null;

  return (
    <Card className="fal-card fal-card-hover overflow-hidden flex flex-col h-full">
      {/* Header band */}
      <div className="fal-gradient-header px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {num &&
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0" style={{ color: 'var(--fal-green-400)', background: 'rgba(47,166,106,0.15)', border: '1px solid rgba(47,166,106,0.3)' }}>
                <Hash className="w-2.5 h-2.5" />{num}
              </span>
            }
            <h3 className="font-bold text-white truncate text-sm">{group.name}</h3>
          </div>
          <Layers className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fal-green-400)' }} />
        </div>
        {group.description &&
        <p className="text-xs mt-1 line-clamp-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{group.description}</p>
        }
      </div>

      <CardContent className="p-5 flex flex-col gap-4 flex-1">
        {/* Meta row */}
        <div className="flex items-center justify-between gap-3 text-xs fal-muted">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 transition-colors hover:bg-slate-50 hover:text-slate-700"
            onClick={(e) => {
              e.preventDefault();
              navigate(createPageUrl(`GroupDetail?id=${group.id}&tab=estrutura`));
            }}
            title="Abrir empresas do grupo"
          >
            <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--fal-text-light)' }} />
            <strong style={{ color: 'var(--fal-text-primary)' }}>{companyCount}</strong> empresa(s)
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>
          {group.structure_type ? (
            <span className="fal-muted truncate">{group.structure_type}</span>
          ) : null}
        </div>

        {/* IFME™ Consolidado */}
        <div className="fal-inner-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider fal-muted mb-1.5">
            IFME™ Consolidado
          </p>
          {hasSnap ?
          <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black" style={{ color: LEVEL_SCORE_COLOR[level] || 'var(--fal-text-strong)' }}>
                  {score?.toFixed(2)}
                </span>
                <span className="text-xs fal-muted">/ 3.00</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={LEVEL_BADGE_CLASS[level] || 'fal-badge fal-badge-neutral'}>
                  {level}
                </span>
                {computedAt &&
              <span className="text-[9px] fal-muted">{computedAt}</span>
              }
              </div>
            </div> :

          <div className="flex items-center gap-2">
              <span className="text-xs fal-muted italic">Consolidado não calculado</span>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--fal-warning-border)' }} />
            </div>
          }
        </div>

        {/* Ações rápidas */}
        <div className="mt-auto">
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5 text-xs"
            style={{ borderColor: 'var(--fal-green-700)', color: 'var(--fal-green-700)' }}
            onClick={(e) => {
              e.preventDefault();
              navigate(createPageUrl(`GroupDetail?id=${group.id}&tab=diagnostico-8d`));
            }}>
            <BarChart3 className="w-3.5 h-3.5" />
            Ver Consolidado
          </Button>
        </div>

      </CardContent>
    </Card>);

}

export default function Groups() {
  const { user, tenantId: ctxTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [backfilling, setBackfilling] = useState(false);

  const tenantId = ctxTenantId || user?.tenant_id;

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups', tenantId],
    queryFn: () => base44.entities.Group.filter({ tenant_id: tenantId }, 'created_date', 200),
    enabled: !!tenantId,
    staleTime: 0
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-all', tenantId],
    queryFn: () => base44.entities.Company.filter({ tenant_id: tenantId }, 'name', 500),
    enabled: !!tenantId,
    staleTime: 0
  });

  // Buscar snapshots agregados para todos os grupos
  const { data: aggSnapshots = [] } = useQuery({
    queryKey: ['agg-snapshots-all', tenantId],
    queryFn: () => base44.entities.FalAggregateSnapshot.filter({ tenant_id: tenantId, level_type: 'group' }, '-computed_at', 500),
    enabled: !!tenantId && groups.length > 0,
    staleTime: 0
  });

  // Indexar: group_id → snapshot mais recente
  const snapByGroup = {};
  for (const s of aggSnapshots) {
    if (!snapByGroup[s.level_id] || s.computed_at > snapByGroup[s.level_id].computed_at) {
      snapByGroup[s.level_id] = s;
    }
  }

  const companiesPerGroup = {};
  for (const c of companies) {
    if (c.group_id) {
      companiesPerGroup[c.group_id] = (companiesPerGroup[c.group_id] || 0) + 1;
    }
  }



  const filtered = groups.
  filter((g) => !g.is_archived).
  filter((g) =>
  g.name?.toLowerCase().includes(search.toLowerCase()) ||
  String(g.group_order_number || '').includes(search)
  ).
  sort((a, b) => {
    if (sortBy === 'number') {
      const na = a.group_order_number ?? 99999;
      const nb = b.group_order_number ?? 99999;
      return na - nb;
    }
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'score') {
      const sa = snapByGroup[a.id]?.overall_score ?? -1;
      const sb = snapByGroup[b.id]?.overall_score ?? -1;
      return sb - sa;
    }
    if (sortBy === 'created') return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    return 0;
  });

  const unnumberedCount = groups.filter((g) => g.group_order_number == null).length;
  const withConsolidado = groups.filter((g) => snapByGroup[g.id]).length;

  async function handleBackfill() {
    setBackfilling(true);
    await base44.functions.invoke('assignGroupOrderNumber', { backfill: true, tenant_id: tenantId });
    invalidateStructureQueries(queryClient, tenantId);
    setBackfilling(false);
  }

  return (
    <PageContainer variant="wide" className="py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold fal-title">Hub de Grupos</h1>
          




          
        </div>
        <div className="flex items-center gap-2">
          {unnumberedCount > 0 &&
          <PermissionGuard requireDelete>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfill}
            disabled={backfilling}
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
            title={`${unnumberedCount} grupo(s) sem número`}>
            
              <RefreshCw className={`w-3.5 h-3.5 ${backfilling ? 'animate-spin' : ''}`} />
              {backfilling ? 'Numerando...' : `Numerar (${unnumberedCount})`}
            </Button>
          </PermissionGuard>
          }
          <Button onClick={() => setDialogOpen(true)} className="text-white gap-2" style={{ background: 'var(--fal-green-700)' }}>
            <Plus className="w-4 h-4" /> Novo Grupo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white" />
          
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm text-slate-600 shrink-0">
          <SortAsc className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 hidden sm:inline">Ordenar:</span>
          {[
          { key: 'number', label: 'Número' },
          { key: 'name', label: 'Nome' },
          { key: 'score', label: 'IFME™' }].
          map((opt) =>
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            sortBy === opt.key ? 'font-semibold' : 'fal-muted hover:text-slate-700'}`
            }>
            
              {opt.label}
            </button>
          )}
        </div>
      </div>

      {/* Grid de cards */}
      {isLoading ?
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />)}
        </div> :
      filtered.length === 0 ?
      <div className="text-center py-16 text-slate-400">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum grupo encontrado</p>
        </div> :

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) =>
        <GroupCard
          key={group.id}
          group={group}
          companyCount={companiesPerGroup[group.id] || 0}
          aggSnap={snapByGroup[group.id] || null} />

        )}
        </div>
      }

      {/* Dialog novo grupo — mesmo formulário rico usado em Assessments */}
      <CreateFirstClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        onCreated={(node) => {
          invalidateStructureQueries(queryClient, tenantId);
        }} />
      
    </PageContainer>);

}