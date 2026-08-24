import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Upload, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { clientPortalKey } from '@/lib/query-client';

export default function ClientPortal() {
  const { user, tenantId } = useTenant();

  const { data: assessments = [] } = useQuery({
    queryKey: clientPortalKey(tenantId, user?.client_id, 'assessments'),
    queryFn: async () => {
      if (user?.client_id) {
        return base44.entities.Assessment.filter({ client_id: user.client_id, status: 'published' });
      }
      return [];
    },
    enabled: !!user,
  });

  const { data: reports = [] } = useQuery({
    queryKey: clientPortalKey(tenantId, user?.client_id, 'reports'),
    queryFn: async () => {
      const allReports = [];
      for (const a of assessments) {
        const reps = await base44.entities.Report.filter({ assessment_id: a.id, status: 'published' }, '-created_date', 1);
        if (reps.length > 0) allReports.push({ ...reps[0], assessment: a });
      }
      return allReports;
    },
    enabled: assessments.length > 0,
  });

  const handleUpload = async (e, assessmentId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Evidence.create({
      tenant_id: user?.tenant_id || 'global',
      assessment_id: assessmentId,
      file_url,
      file_name: file.name,
      file_type: file.type,
      uploaded_by: user?.email,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Meu Portal</h1>
        <p className="text-sm text-slate-500 mt-1">Acompanhe seus diagnósticos e relatórios</p>
      </div>

      {/* Published Reports */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Relatórios Publicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum relatório publicado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((/** @type {any} */ r) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.assessment?.title}</p>
                      <p className="text-xs text-slate-400">Publicado em {r.published_at ? format(new Date(r.published_at), 'dd/MM/yyyy') : '—'}</p>
                    </div>
                  </div>
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Documents */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Enviar Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">Envie documentos solicitados pela consultoria.</p>
          {assessments.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-2">
              <p className="text-sm font-medium">{a.title}</p>
              <div className="relative">
                <input type="file" onChange={e => handleUpload(e, a.id)} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Enviar
                </Button>
              </div>
            </div>
          ))}
          {assessments.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Nenhum assessment ativo</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}