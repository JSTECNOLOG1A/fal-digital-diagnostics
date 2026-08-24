import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, FileText, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';

const statCards = [
  { key: 'total_clients', label: 'Clientes Ativos', icon: Users, color: 'blue' },
  { key: 'total_assessments', label: 'Total Assessments', icon: FileText, color: 'slate' },
  { key: 'assessments_in_progress', label: 'Em Andamento', icon: Clock, color: 'amber' },
  { key: 'assessments_completed', label: 'Concluídos', icon: CheckCircle2, color: 'emerald' },
  { key: 'clusters_criticos', label: 'Clusters Críticos', icon: AlertTriangle, color: 'red' },
  { key: 'actions_pending', label: 'Ações Pendentes', icon: Zap, color: 'purple' },
];

const colorMap = {
  blue:    { bg: 'bg-blue-50', text: 'text-blue-600' },
  slate:   { bg: 'bg-slate-100', text: 'text-slate-600' },
  amber:   { bg: 'bg-amber-50', text: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  red:     { bg: 'bg-red-50', text: 'text-red-600' },
  purple:  { bg: 'bg-purple-50', text: 'text-purple-600' },
};

/**
 * @param {Object} props
 * @param {any=} props.data
 */
export default function PortfolioStats({ data }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map(({ key, label, icon: Icon, color }) => {
        const { bg, text } = colorMap[color];
        return (
          <Card key={key} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${text}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{data?.[key] ?? '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}