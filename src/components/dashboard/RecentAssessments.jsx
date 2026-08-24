import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowRight, Building2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * @param {Object} props
 * @param {any=} props.assessments
 * @param {any=} props.clients
 */
export default function RecentAssessments({ assessments, clients }) {
  const recent = assessments.slice(0, 5);
  const clientMap = {};
  clients.forEach(c => { clientMap[c.id] = c; });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Assessments Recentes</CardTitle>
          <Link to={createPageUrl('Assessments')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Nenhum assessment ainda</p>
        ) : (
          <div className="space-y-3">
            {recent.map(a => (
              <Link
                key={a.id}
                to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-400 truncate">{clientMap[a.client_id]?.name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-slate-400">{a.created_date ? format(new Date(a.created_date), 'dd/MM') : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}