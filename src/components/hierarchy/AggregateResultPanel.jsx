import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FalRadarChart from '@/components/fal/FalRadarChart';
import FalDimensionTable from '@/components/fal/FalDimensionTable';
import { RefreshCw, TrendingUp, BarChart3, Building2 } from 'lucide-react';
import { useTenant } from '@/components/shared/TenantContext';
import { groupKey, companyKey } from '@/lib/query-client';

const LEVEL_STYLE = {
  Crítico:     'bg-red-100 text-red-700 border border-red-200',
  Básico:      'bg-amber-100 text-amber-700 border border-amber-200',
  Estruturado: 'bg-blue-100 text-blue-700 border border-blue-200',
  Avançado:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const LEVEL_SCORE_COLOR = {
  Crítico:     'text-red-700',
  Básico:      'text-amber-600',
  Estruturado: 'text-blue-700',
  Avançado:    'text-emerald-700',
};

/**
 * @param {Object} props
 * @param {any=} props.levelType
 * @param {any=} props.levelId
 * @param {any=} props.label
 * @param {any=} props.cycleId
 */
export default function AggregateResultPanel({ levelType, levelId, label, cycleId }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const structureKey = levelType === 'company'
    ? companyKey(tenantId, levelId, 'agg-snapshot', cycleId)
    : groupKey(tenantId, levelId, 'agg-snapshot', cycleId);

  const { data: snapshots = [] } = useQuery({
    queryKey: structureKey,
    queryFn: () => base44.entities.FalAggregateSnapshot.filter(
      { level_type: levelType, level_id: levelId, ...(cycleId ? { cycle_id: cycleId } : {}) }, '-computed_at', 1
    ),
    enabled: !!levelId,
  });

  const snap = snapshots[0] || null;

  const computeFn = levelType === 'company' ? 'computeCompanyAggregate' : 'computeGroupAggregate';
  const computePayload = levelType === 'company'
    ? { company_id: levelId, ...(cycleId && { cycle_id: cycleId }) }
    : { group_id: levelId, ...(cycleId && { cycle_id: cycleId }) };

  const computeMutation = useMutation({
    mutationFn: () => base44.functions.invoke(computeFn, computePayload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: structureKey }),
  });

  const entityLabel = levelType === 'company' ? 'da Empresa' : 'do Grupo';

  return (
    <div className="space-y-6">

      {/* Hero score card */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Diagnóstico Consolidado {entityLabel}
              </p>
              <h2 className="text-sm font-bold text-white mb-3">
                Índice FAL de Maturidade Empresarial (IFME™) Consolidado
              </h2>
              {snap ? (
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-black ${LEVEL_SCORE_COLOR[snap.overall_level] || 'text-white'}`}>
                    {snap.overall_score?.toFixed(2)}
                  </span>
                  <span className="text-slate-400 text-lg font-light">/ 3.00</span>
                  <Badge className={`${LEVEL_STYLE[snap.overall_level] || 'bg-slate-600 text-white'} ml-1`}>
                    {snap.overall_level}
                  </Badge>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Nenhum resultado consolidado calculado</p>
              )}
              {snap?.computed_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Calculado em {new Date(snap.computed_at).toLocaleDateString('pt-BR')}
                  {snap.source_assessments?.length > 0 && ` · ${snap.source_assessments.length} fonte(s)`}
                </p>
              )}
            </div>

            <Button
              onClick={() => computeMutation.mutate()}
              disabled={computeMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
              {snap ? 'Recalcular Consolidado' : 'Calcular Consolidado'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {computeMutation.isError && (
        <p className="text-xs text-red-500 px-1">{computeMutation.error?.message}</p>
      )}

      {snap && (
        <>
          {/* Radar */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Radar FAL 8D™ — Estrutura de Maturidade Consolidada
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <FalRadarChart radarPoints={snap.radar_points} />
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Scores por Dimensão — Consolidado</CardTitle>
            </CardHeader>
            <CardContent>
              <FalDimensionTable dimensionScores={snap.dimension_scores} />
            </CardContent>
          </Card>

          {/* Fontes */}
          {snap.source_assessments?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  Fontes Utilizadas no Consolidado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {snap.source_assessments.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-slate-500 py-1.5 border-b border-slate-50 last:border-0">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-3 h-3 text-slate-300" />
                        <span className="font-medium text-slate-700">{s.company_name || s.title || s.assessment_id?.slice(0, 8)}</span>
                        <span className="text-slate-300 capitalize">({s.level || s.source || s.target_type})</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-700">{s.overall_score?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}