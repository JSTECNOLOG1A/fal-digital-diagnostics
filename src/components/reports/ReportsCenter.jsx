/**
 * ReportsCenter
 * Central de Relatórios — aba dentro do AssessmentDetail.
 * Centraliza geração, listagem, versionamento e acesso a relatórios históricos.
 * Substitui botões soltos de PDF.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Zap, FileText } from 'lucide-react';
import ReportVersionList from './ReportVersionList';
import ReportGenerationModal from './ReportGenerationModal';
import { assessmentKey } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.snapshot
 */
export default function ReportsCenter({ assessmentId, tenantId, snapshot }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillPreset, setPrefillPreset] = useState(null);

  const { data: versions = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'report-versions'),
    queryFn: () => base44.entities.AssessmentReportVersion.filter(
      { assessment_id: assessmentId, tenant_id: tenantId },
      '-report_version_number',
      100
    ),
    enabled: !!assessmentId && !!tenantId,
  });

  const hasSnapshot = !!snapshot;
  const activeVersions = versions.filter(v => v.status !== 'archived');

  const handleGenerate = (opts = {}) => {
    setPrefillPreset(opts?.prefill ? {
      ...opts.prefill,
      label: opts.prefill.report_title,
      report_type: opts.prefill.report_type,
      parameters: opts.prefill.report_parameters,
    } : null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">Central de Relatórios</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeVersions.length} relatório(s) emitido(s)
            {!hasSnapshot && ' · Gere o diagnóstico para liberar relatórios de diagnóstico'}
          </p>
        </div>
        <Button
          onClick={() => handleGenerate()}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <Zap className="w-3.5 h-3.5" /> Gerar novo relatório
        </Button>
      </div>

      {/* Guard: sem diagnóstico, avisa mas não bloqueia (permite relatórios de plano/revisão) */}
      {!hasSnapshot && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Nenhum diagnóstico computado ainda. Relatórios de diagnóstico exigem snapshot válido.
            Relatórios de plano de ação e revisões podem ser gerados independentemente.
          </span>
        </div>
      )}

      {/* Lista de relatórios */}
      <ReportVersionList
        assessmentId={assessmentId}
        tenantId={tenantId}
        onGenerate={handleGenerate}
      />

      {/* Modal de geração */}
      <ReportGenerationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPrefillPreset(null); }}
        assessmentId={assessmentId}
        tenantId={tenantId}
        prefillPreset={prefillPreset}
        onGenerated={() => {}}
      />
    </div>
  );
}