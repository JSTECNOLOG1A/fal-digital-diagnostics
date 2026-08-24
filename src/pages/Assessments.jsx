import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, FileText, ArrowRight, Layers, Building2, MapPin } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

const STATUS_FILTER = [
  { key: 'all', label: 'Todos' },
  { key: 'draft', label: 'Rascunho' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'review', label: 'Revisão' },
  { key: 'published', label: 'Publicado' },
];

const TYPE_ICON = {
  group: <Layers className="w-3.5 h-3.5 text-indigo-500" />,
  company: <Building2 className="w-3.5 h-3.5 text-blue-500" />,
  unit: <MapPin className="w-3.5 h-3.5 text-emerald-500" />,
};

const LEVEL_STYLE = {
  Crítico:     'bg-red-100 text-red-700',
  Básico:      'bg-amber-100 text-amber-700',
  Estruturado: 'bg-blue-100 text-blue-700',
  Avançado:    'bg-emerald-100 text-emerald-700',
};

export default function Assessments() {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments-page', tenantId],
    queryFn: () => base44.entities.Assessment.filter({ tenant_id: tenantId }, '-created_date', 200),
    enabled: !!tenantId,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['assessments-page-snaps', tenantId],
    queryFn: async () => {
      if (!assessments.length) return [];
      const results = await Promise.all(
        assessments.map(a =>
          base44.entities.FalDiagnosticSnapshot.filter(
            { tenant_id: tenantId, assessment_id: a.id }, '-computed_at', 1
          ).then(r => r[0] || null).catch(() => null)
        )
      );
      return results;
    },
    enabled: assessments.length > 0 && !!tenantId,
    staleTime: 60_000,
  });

  const snapByAssessmentId = {};
  snapshots.forEach((s, i) => {
    if (s && assessments[i]) snapByAssessmentId[assessments[i].id] = s;
  });

  const filtered = assessments
    .filter(a => !a.is_archived)
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .filter(a => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.title?.toLowerCase().includes(q) ||
        a.display_name?.toLowerCase().includes(q) ||
        a.diagnostic_cycle?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Diagnósticos</h1>
        <p className="text-sm text-slate-500 mt-1">{assessments.filter(a => !a.is_archived).length} diagnóstico(s) registrados</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, ciclo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1 flex-wrap">
          {STATUS_FILTER.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === f.key ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum diagnóstico encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const snap = snapByAssessmentId[a.id];
            const score = snap?.overall_score;
            const level = snap?.overall_level;
            return (
              <Link
                key={a.id}
                to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                className="flex items-center gap-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm rounded-xl px-5 py-4 transition-all group"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {TYPE_ICON[a.target_type] || <FileText className="w-3.5 h-3.5 text-slate-400" />}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {a.display_name || a.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {a.diagnostic_cycle && (
                      <span className="text-xs text-slate-400 font-mono">{a.diagnostic_cycle}</span>
                    )}
                    {a.competence && (
                      <span className="text-xs text-slate-400">{a.competence}</span>
                    )}
                    {a.assessment_mode === 'multi_entity_master' && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border border-indigo-200">FAL Multi-entidade</Badge>
                    )}
                  </div>
                </div>

                {/* Score */}
                {score !== null && score !== undefined && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-base font-black text-slate-900 tabular-nums">{Number(score).toFixed(2)}</span>
                    {level && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEVEL_STYLE[level] || 'bg-slate-100 text-slate-600'}`}>
                        {level}
                      </span>
                    )}
                  </div>
                )}

                {/* Status + arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={a.status} />
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}