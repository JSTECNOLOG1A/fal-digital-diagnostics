import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Tractor, Factory, Store, ChevronRight } from 'lucide-react';
import { unitKey, companyKey } from '@/lib/query-client';

const UNIT_ICON = {
  'Fazenda': Tractor,
  'Filial / Revenda': Store,
  'Unidade Operacional': Factory,
};

const LEVEL_STYLE = {
  Crítico:     'text-red-600 bg-red-50 border-red-200',
  Básico:      'text-amber-600 bg-amber-50 border-amber-200',
  Estruturado: 'text-blue-600 bg-blue-50 border-blue-200',
  Avançado:    'text-emerald-600 bg-emerald-50 border-emerald-200',
};

/**
 * @param {Object} props
 * @param {any=} props.unitId
 * @param {any=} props.tenantId
 */
function UnitScoreChip({ unitId, tenantId }) {
  const { data: snap } = useQuery({
    queryKey: unitKey(tenantId, unitId, 'snap'),
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter(
        { tenant_id: tenantId, target_type: 'unit', target_id: unitId },
        '-computed_at', 1
      );
      return snaps[0] || null;
    },
    enabled: !!unitId && !!tenantId,
    staleTime: 60_000,
  });

  if (!snap?.overall_score && snap?.overall_score !== 0) {
    return <span className="text-[10px] text-slate-300">sem diagnóstico</span>;
  }

  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${LEVEL_STYLE[snap.overall_level] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
      {snap.overall_score.toFixed(1)} · {snap.overall_level}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.companyId
 * @param {any=} props.tenantId
 */
function CompanyScoreChip({ companyId, tenantId }) {
  const { data: snap } = useQuery({
    queryKey: companyKey(tenantId, companyId, 'snap'),
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter(
        { tenant_id: tenantId, target_type: 'company', target_id: companyId },
        '-computed_at', 1
      );
      return snaps[0] || null;
    },
    enabled: !!companyId && !!tenantId,
    staleTime: 60_000,
  });

  if (!snap?.overall_score && snap?.overall_score !== 0) return null;

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${LEVEL_STYLE[snap.overall_level] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
      {snap.overall_score.toFixed(1)} · {snap.overall_level}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.company
 * @param {any=} props.tenantId
 */
export default function CompanyWithUnits({ company, tenantId }) {
  const { data: unitsRaw = [] } = useQuery({
    queryKey: companyKey(tenantId, company.id, 'units'),
    queryFn: () => base44.entities.OperationalUnit.filter({ company_id: company.id }, 'name', 50),
    enabled: !!company.id,
  });
  const units = unitsRaw.filter(u => u.is_active !== false);

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardContent className="p-0">
        {/* Empresa header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{company.name}</p>
            {company.trade_name && <p className="text-[10px] text-slate-400 truncate">{company.trade_name}</p>}
            {company.sector && <p className="text-xs text-slate-400">{company.sector}</p>}
          </div>
          <CompanyScoreChip companyId={company.id} tenantId={tenantId} />
        </div>

        {/* Links da empresa */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/60 border-b border-slate-100">
          <Link
            to={createPageUrl(`CompanyDetail?id=${company.id}`)}
            className="flex-1 text-center text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors py-0.5"
          >
            Ver Diagnóstico →
          </Link>
          <div className="w-px h-4 bg-slate-200" />
          <Link
            to={createPageUrl(`CompanyDetail?id=${company.id}`)}
            className="flex-1 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-0.5"
          >
            Abrir Empresa
          </Link>
        </div>

        {/* Unidades */}
        {units.length > 0 && (
          <div className="divide-y divide-slate-50">
            {units.map(u => {
              const Icon = UNIT_ICON[u.unit_type] || Factory;
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-slate-200 ml-1 flex-shrink-0" />
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{u.name}</p>
                    {u.unit_type && <p className="text-[10px] text-slate-400">{u.unit_type}{u.city ? ` · ${u.city}` : ''}</p>}
                  </div>
                  <UnitScoreChip unitId={u.id} tenantId={tenantId} />
                  <Link
                    to={createPageUrl(`UnitDetail?id=${u.id}`)}
                    className="text-[10px] text-blue-500 hover:text-blue-700 font-medium flex-shrink-0 flex items-center gap-0.5"
                  >
                    Ver <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}