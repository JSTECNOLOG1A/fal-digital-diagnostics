import React from 'react';
import { Card } from '@/components/ui/card';
import { Building2, FileText, Users, AlertTriangle } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.clients
 * @param {any=} props.assessments
 */
export default function StatsGrid({ clients, assessments }) {
  const totalClients = clients.length;
  const activeAssessments = assessments.filter(a => a.status === 'in_progress' || a.status === 'scoring').length;
  const publishedCount = assessments.filter(a => a.status === 'published').length;
  const draftCount = assessments.filter(a => a.status === 'draft').length;

  const stats = [
    { label: 'Clientes', value: totalClients, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Assessments Ativos', value: activeAssessments, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Publicados', value: publishedCount, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rascunhos', value: draftCount, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(stat => (
        <Card key={stat.label} className="p-5 fal-card-hover border-0 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
            <div className={`p-2.5 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}