import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Map } from 'lucide-react';

const DIMENSION_LABELS = {
  governanca: 'Governança',
  juridico: 'Jurídico',
  financeiro: 'Financeiro',
  controles_internos: 'Controles',
  tributario: 'Tributário',
  tecnologia: 'Tecnologia',
  rh: 'RH',
  operacional: 'Operacional',
};

function riskLevel(score) {
  if (score === null || score === undefined) return { label: '—', bg: 'bg-slate-50', text: 'text-slate-300' };
  if (score < 1.0) return { label: 'Crítico', bg: 'bg-red-100', text: 'text-red-700' };
  if (score < 1.5) return { label: 'Alto', bg: 'bg-orange-100', text: 'text-orange-700' };
  if (score < 2.0) return { label: 'Médio', bg: 'bg-amber-100', text: 'text-amber-700' };
  if (score < 2.5) return { label: 'Baixo', bg: 'bg-blue-100', text: 'text-blue-700' };
  return { label: 'OK', bg: 'bg-emerald-100', text: 'text-emerald-700' };
}

/**
 * @param {Object} props
 * @param {any=} props.rankings
 */
export default function PortfolioRiskMap({ rankings = [] }) {
  if (rankings.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Map className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Mapa de Risco da Carteira</h2>
        </div>
        <CardContent className="p-4">
          <div className="text-center py-6 text-slate-400 text-sm">Nenhum dado disponível</div>
        </CardContent>
      </Card>
    );
  }

  // Get all dimensions present
  const dims = new Set();
  rankings.forEach(c => Object.keys(c.dimension_scores || {}).forEach(d => dims.add(d)));
  const dimList = Array.from(dims).slice(0, 8);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <Map className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700">Mapa de Risco da Carteira</h2>
        <span className="text-xs text-slate-400 ml-auto">Dimensão × Cliente</span>
      </div>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800">
              <th className="text-left p-3 text-white font-medium bg-slate-800 sticky left-0 z-10 min-w-[140px]">Cliente</th>
              {dimList.map(d => (
                <th key={d} className="p-2 text-white font-medium text-center whitespace-nowrap">
                  {DIMENSION_LABELS[d] || d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankings.slice(0, 12).map((client) => (
              <tr key={client.client_id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-800 sticky left-0 bg-white truncate max-w-[140px]">
                  {client.client_name}
                </td>
                {dimList.map(d => {
                  const score = client.dimension_scores?.[d];
                  const risk = riskLevel(score);
                  return (
                    <td key={d} className="p-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${risk.bg} ${risk.text}`}>
                        {risk.label}
                        {score !== null && score !== undefined && (
                          <span className="ml-1 opacity-70">({score.toFixed(1)})</span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}