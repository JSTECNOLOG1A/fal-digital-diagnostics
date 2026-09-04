import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

function maturityColor(val) {
  if (val == null) return 'text-slate-400';
  if (val >= 70) return 'text-emerald-600';
  if (val >= 40) return 'text-orange-500';
  return 'text-red-500';
}
function evolutionColor(val) {
  if (val == null) return 'text-slate-400';
  return val >= 0 ? 'text-emerald-600' : 'text-red-500';
}
function criticalColor(count) {
  if (count == null) return 'text-slate-400';
  if (count > 10) return 'text-red-600 font-bold';
  if (count > 5) return 'text-orange-500';
  return 'text-emerald-600';
}
function executionColor(rate) {
  if (rate == null) return 'text-slate-400';
  if (rate >= 70) return 'text-emerald-600';
  if (rate >= 40) return 'text-orange-500';
  return 'text-red-500';
}
function impactColor(val) {
  if (val == null) return 'text-slate-400';
  if (val >= 0.5) return 'text-blue-600';
  return 'text-slate-500';
}

const COLUMNS = [
  { key: 'client_name',          label: 'Cliente',            sortable: false },
  { key: 'maturity_index',       label: 'Maturidade',         sortable: true  },
  { key: 'overall_score',        label: 'Score',              sortable: true  },
  { key: 'total_evolution',      label: 'Evolução',           sortable: true  },
  { key: 'critical_clusters',    label: 'Clusters Críticos',  sortable: true  },
  { key: 'action_execution_rate',label: 'Execução do Plano',  sortable: true  },
  { key: 'impact_potential',     label: 'Impacto Potencial',  sortable: true  },
  { key: 'top_value_lever',     label: 'Alavanca Principal', sortable: false },
];

/**
 * @param {Object} props
 * @param {any=} props.rankings
 */
export default function PortfolioKpiTable({ rankings = [] }) {
  const [sortKey, setSortKey] = useState('critical_clusters');
  const [sortDir, setSortDir] = useState('desc');

  if (!rankings.length) return null;

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...rankings].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  /**
   * @param {Object} props
   * @param {any=} props.col
   */
  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ArrowUpDown className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 inline ml-1 text-blue-500" />
      : <ArrowDown className="w-3 h-3 inline ml-1 text-blue-500" />;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Painel de Clientes — KPIs Executivos</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Clique nos cabeçalhos para ordenar</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`py-3 px-4 text-xs font-semibold text-white uppercase tracking-wider ${col.key === 'client_name' ? 'text-left' : 'text-center'} ${col.sortable ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                  >
                    {col.label}<SortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.client_id || i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800 max-w-[180px] truncate">{r.client_name || r.client_id || '—'}</td>
                  <td className={`py-3 px-4 text-center font-semibold ${maturityColor(r.maturity_index)}`}>
                    {r.maturity_index != null ? `${Math.round(r.maturity_index)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">
                    {r.overall_score != null ? r.overall_score.toFixed(2) : '—'}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${evolutionColor(r.total_evolution)}`}>
                    {r.total_evolution != null
                      ? `${r.total_evolution >= 0 ? '+' : ''}${r.total_evolution.toFixed(2)}`
                      : '—'}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${criticalColor(r.critical_clusters)}`}>
                    {r.critical_clusters != null ? r.critical_clusters : '—'}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${executionColor(r.action_execution_rate)}`}>
                    {r.action_execution_rate != null ? `${Math.round(r.action_execution_rate)}%` : '—'}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${impactColor(r.impact_potential)}`}>
                    {r.impact_potential != null
                      ? `+${r.impact_potential.toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.top_value_lever ? (
                      <div>
                        <p className="text-xs font-medium text-slate-700">{r.top_value_lever}</p>
                        {r.top_value_lever_cluster && (
                          <p className="text-[10px] text-slate-400 capitalize">{r.top_value_lever_cluster}</p>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}