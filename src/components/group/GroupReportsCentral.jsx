/**
 * GroupReportsCentral — Central de Relatórios do Grupo.
 * Usa useGroupAssessment para busca consistente.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollText, Zap, FileText } from 'lucide-react';
import ReportVersionList from '@/components/reports/ReportVersionList';
import ReportGenerationModal from '@/components/reports/ReportGenerationModal';
import { useGroupAssessment } from '@/lib/hooks/useGroupAssessment';

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 */
export default function GroupReportsCentral({ groupId, tenantId }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillPreset, setPrefillPreset] = useState(null);

  const { assessment, loading } = useGroupAssessment(groupId, tenantId);

  const { data: snaps = [] } = useQuery({
    queryKey: ['reports-snap', assessment?.id, tenantId],
    queryFn: () => base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-computed_at', 1
    ),
    enabled: !!assessment?.id && !!tenantId,
  });
  const snapshot = snaps[0] || null;

  const { data: reportVersions = [] } = useQuery({
    queryKey: ['group-report-versions', assessment?.id, tenantId],
    queryFn: () => base44.entities.AssessmentReportVersion.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-report_version_number', 100
    ),
    enabled: !!assessment?.id && !!tenantId,
  });

  const handleGenerate = (opts = {}) => {
    setPrefillPreset(opts?.prefill ? {
      ...opts.prefill,
      label: opts.prefill.report_title,
      report_type: opts.prefill.report_type,
      parameters: opts.prefill.report_parameters,
    } : null);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">Relatórios do Grupo</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {reportVersions.filter(v => v.status !== 'archived').length} relatório(s) emitido(s)
          </p>
        </div>
        {assessment && (
          <Button onClick={() => handleGenerate()} className="gap-2 text-white" size="sm"
            style={{ background: '#2563eb' }}>
            <Zap className="w-3.5 h-3.5" /> Gerar Relatório
          </Button>
        )}
      </div>

      <div className="p-5 space-y-4">
      {!assessment ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
          style={{ border: '2px dashed #cbd5e1', background: '#f8fafc' }}>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <ScrollText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Nenhum Diagnóstico 8D encontrado</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Inicie o Diagnóstico 8D para habilitar a geração de relatórios.
          </p>
        </div>
      ) : (
        <>
          {!snapshot && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309' }}>
              <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Nenhum diagnóstico computado ainda. Relatórios de diagnóstico exigem snapshot válido.
                Relatórios de plano de ação e revisões podem ser gerados independentemente.
              </span>
            </div>
          )}
          <ReportVersionList
            assessmentId={assessment.id}
            tenantId={tenantId}
            onGenerate={handleGenerate}
          />
          <ReportGenerationModal
            open={modalOpen}
            onClose={() => { setModalOpen(false); setPrefillPreset(null); }}
            assessmentId={assessment.id}
            tenantId={tenantId}
            prefillPreset={prefillPreset}
            onGenerated={() => {}}
          />
        </>
      )}
      </div>
    </div>
  );
}