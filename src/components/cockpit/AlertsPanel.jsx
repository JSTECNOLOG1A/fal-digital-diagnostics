import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const severityConfig = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', label: 'Crítico' },
  high:     { icon: AlertCircle, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', label: 'Alto' },
  medium:   { icon: Info, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'Médio' },
  low:      { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', label: 'Baixo' },
};

/**
 * @param {Object} props
 * @param {any=} props.alerts
 * @param {any=} props.loading
 */
export default function AlertsPanel({ alerts = [], loading }) {
  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Alertas da Carteira</h2>
        </div>
        <CardContent className="p-4">
          <div className="text-center text-slate-400 py-6 text-sm">Carregando alertas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Alertas da Carteira</h2>
        </div>
        {alerts.length > 0 && (
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{alerts.length}</span>
        )}
      </div>
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum alerta ativo</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {alerts.slice(0, 15).map((alert, idx) => {
              const cfg = severityConfig[alert.severity] || severityConfig.medium;
              const Icon = cfg.icon;
              return (
                <div key={idx} className={`p-3 ${cfg.bg} border-l-4 ${cfg.border} mx-3 my-2 rounded-r-lg`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cfg.text}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                        <p className="text-xs font-semibold text-slate-800 truncate">{alert.title}</p>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                      {alert.assessment_id && (
                        <Link
                          to={createPageUrl(`AssessmentDetail?id=${alert.assessment_id}`)}
                          className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-block"
                        >
                          {alert.assessment_title || alert.assessment_id} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}