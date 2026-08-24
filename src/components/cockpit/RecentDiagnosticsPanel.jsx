import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';

const levelColors = {
  'Crítico':     'bg-red-100 text-red-700',
  'Básico':      'bg-amber-100 text-amber-700',
  'Estruturado': 'bg-blue-100 text-blue-700',
  'Avançado':    'bg-emerald-100 text-emerald-700',
};

/**
 * @param {Object} props
 * @param {any=} props.assessments
 */
export default function RecentDiagnosticsPanel({ assessments = [] }) {
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Diagnósticos Recentes</h2>
        </div>
        <Link to={createPageUrl('Assessments')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <CardContent className="p-0">
        {assessments.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum diagnóstico recente</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {assessments.map((a) => (
              <Link
                key={a.id}
                to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-400">
                      {a.competence && <span className="font-mono">{a.competence}</span>}
                      {a.competence && a.created_date && ' · '}
                      {a.created_date ? format(new Date(a.created_date), 'dd/MM/yyyy') : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.overall_level && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelColors[a.overall_level] || 'bg-slate-100 text-slate-600'}`}>
                      {a.overall_score?.toFixed(1)} · {a.overall_level}
                    </span>
                  )}
                  <StatusBadge status={a.status} />
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}