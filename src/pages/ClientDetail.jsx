import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, FileText, Plus, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import CompanyProfileForm from '@/components/client/CompanyProfileForm';

export default function ClientDetail() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('id');

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['client-assessments', clientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: clientId }, '-created_date', 50),
    enabled: !!clientId,
  });

  const [tab, setTab] = useState('assessments');

  if (!client) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <Link to={createPageUrl('Clients')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
            {client.trade_name && <span className="text-slate-400">{client.trade_name}</span>}
            {client.sector && <span>{client.sector}</span>}
            {client.cnpj && <span className="font-mono">{client.cnpj}</span>}
            {client.company_size && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{client.company_size}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setTab('assessments')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'assessments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />Assessments ({assessments.length})
        </button>
        <button
          onClick={() => setTab('profile')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4 inline mr-1.5" />Perfil da Empresa
        </button>
      </div>

      {tab === 'assessments' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assessments</CardTitle>
            <Link to={createPageUrl(`Assessments?action=new&client_id=${clientId}`)}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
                <Plus className="w-3.5 h-3.5" /> Novo
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum assessment para este cliente</p>
            ) : (
              <div className="space-y-2">
                {assessments.map(a => (
                  <Link key={a.id} to={createPageUrl(`AssessmentDetail?id=${a.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-slate-400">{a.created_date ? format(new Date(a.created_date), 'dd/MM/yyyy') : ''}</p>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'profile' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <CompanyProfileForm client={client} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}