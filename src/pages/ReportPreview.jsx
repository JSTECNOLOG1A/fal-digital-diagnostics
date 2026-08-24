/**
 * ReportPreview — Preview e exportação do relatório FAL™
 * URL: /ReportPreview?assessment_id=xxx
 */
import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, AlertCircle, BookOpen, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import FalDiagnosticReport, { REPORT_SECTION_ORDER } from '@/components/report/FalDiagnosticReport';
import ReportErrorBoundary from '@/components/report/ReportErrorBoundary';
import { enrichReportPayload } from '@/services/report/narrativeEngine';
import { downloadPdfArtifact, generateFalReportPDF } from '@/services/report/pdfGenerator';
import { useTenant } from '@/components/shared/TenantContext';
import { tenantKey, assessmentKey } from '@/lib/query-client';

export default function ReportPreview() {
  const { tenantId } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search || window.location.search);
  const assessmentId = params.get('assessment_id');
  const reportVersionId = params.get('report_version_id');
  const fromSnapshot = params.get('from_snapshot') === 'true';

  // Modo snapshot: carrega a partir de AssessmentReportVersion.payload_snapshot
  const isSnapshotMode = !!reportVersionId && fromSnapshot;

  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [pdfState, setPdfState] = useState('idle');
  const [pdfError, setPdfError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const { data: reportVersion } = useQuery({
    queryKey: tenantKey(tenantId, 'report-version', reportVersionId, 'detail'),
    queryFn: async () => {
      const res = await base44.functions.invoke('getReportVersionSnapshot', { report_version_id: reportVersionId });
      if (res.data?.error) throw new Error(res.data.error);
      // Retorna objeto compatível com o código que usa reportVersion.assessment_id
      return { assessment_id: res.data?.payload_snapshot?.assessment?.id, ...res.data?.report_metadata };
    },
    enabled: isSnapshotMode,
  });

  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId || reportVersion?.assessment_id, 'for-return'),
    queryFn: () => base44.entities.Assessment.get(assessmentId || reportVersion?.assessment_id),
    enabled: !!(assessmentId || reportVersion?.assessment_id),
  });

  const handleReturnToAssessment = () => {
    if (assessment?.id) {
      navigate(createPageUrl(`AssessmentDetail?id=${assessment.id}`));
    } else {
      window.history.back();
    }
  };

  const queryClient = useQueryClient();

  // ── Modo Snapshot: carrega payload do payload_snapshot salvo ─────────────────
  const { data: rawPayload, isLoading, error } = useQuery({
    queryKey: isSnapshotMode
      ? tenantKey(tenantId, 'report-payload-snapshot', reportVersionId)
      : tenantKey(tenantId, 'report-payload', assessmentId),
    queryFn: async () => {
      if (isSnapshotMode) {
        // Carrega via backend guardado — valida tenant antes de retornar
        const res = await base44.functions.invoke('getReportVersionSnapshot', { report_version_id: reportVersionId });
        if (res.data?.error) throw new Error(res.data.error);
        const { payload_snapshot, report_metadata } = res.data;
        if (!payload_snapshot) throw new Error('Este relatório não possui payload_snapshot. Gere uma nova versão para acessar o conteúdo.');
        // Enriquece com metadados da versão
        return {
          ...payload_snapshot,
          _report_version: report_metadata,
        };
      }
      // ── Modo legado: buildReportPayload a partir do assessment atual ──────────
      const res = await base44.functions.invoke('buildReportPayload', { assessment_id: assessmentId });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data) throw new Error('Resposta vazia da função buildReportPayload');
      return res.data;
    },
    enabled: isSnapshotMode ? !!reportVersionId : !!assessmentId,
    staleTime: isSnapshotMode ? Infinity : 0, // Snapshot é imutável — pode ficar em cache
    retry: 1,
  });

  let enrichedPayload = null;
  let enrichError = null;
  if (rawPayload) {
    try {
      enrichedPayload = enrichReportPayload(rawPayload);
      console.log('[ReportPreview] enrichedPayload:', {
        ok: !!enrichedPayload,
        hasExecutiveSummary: !!enrichedPayload?.executive_summary,
        hasMetadata: !!enrichedPayload?.report_metadata,
      });
    } catch (e) {
      console.error('[ReportPreview] Erro ao enriquecer:', e);
      enrichError = e;
    }
  }

  const handleExportPDF = async () => {
    if (!reportRef.current || !enrichedPayload) return;
    setExporting(true);
    setPdfState('generating');
    setPdfError(null);
    let pdfOperationId = null;
    try {
      if (isSnapshotMode) {
        const begun = await base44.functions.invoke('beginReportPdfArtifact', { report_version_id: reportVersionId });
        if (begun.data?.error) throw new Error(begun.data.error);
        if (begun.data?.reused) {
          window.open(begun.data.report_version.pdf_file_url, '_blank', 'noopener,noreferrer');
          setPdfState('generated');
          return;
        }
        pdfOperationId = begun.data.operation_id;
      }
      const artifact = await generateFalReportPDF(reportRef.current, enrichedPayload);
      const bytes = new Uint8Array(await artifact.blob.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') throw new Error('Arquivo gerado não é um PDF válido');
      if (isSnapshotMode) {
        const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((item) => item.toString(16).padStart(2, '0')).join('');
        const upload = await base44.integrations.Core.UploadFile({ file: new File([artifact.blob], artifact.filename, { type: 'application/pdf' }) });
        const uploadIdentifier = upload.file_url;
        if (!uploadIdentifier) {
          throw new Error('UPLOAD_IDENTIFIER_NOT_RETURNED');
        }
        const committed = await base44.functions.invoke('commitReportPdfArtifact', {
          report_version_id: reportVersionId,
          pdf_file_url: upload.file_url,
          pdf_upload_identifier: uploadIdentifier,
          pdf_checksum: checksum,
          pdf_page_count: artifact.pageCount, pdf_file_size: bytes.byteLength,
          pdf_storage_provider: 'base44', pdf_storage_key: null,
          pdf_operation_id: pdfOperationId, pdf_generator_version: 'FAL-PDF-2.46', payload_checksum: rawPayload?._report_version?.payload_checksum,
        });
        if (committed.data?.error) throw new Error(committed.data.error);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'report-version', reportVersionId, 'detail') }),
          queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'report-payload-snapshot', reportVersionId) }),
          queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'report-versions') }),
        ]);
      }
      downloadPdfArtifact(artifact);
      setPdfState('generated');
    } catch (err) {
      if (isSnapshotMode && rawPayload?._report_version?.payload_checksum) {
        await base44.functions.invoke('commitReportPdfArtifact', {
          report_version_id: reportVersionId,
          pdf_status: 'failed',
          pdf_operation_id: pdfOperationId,
          pdf_error: err.message || 'Falha ao gerar PDF',
        });
      }
      setPdfState('failed');
      setPdfError(err.message || 'Falha ao gerar PDF');
    } finally {
      setExporting(false);
    }
  };

  if (!assessmentId && !reportVersionId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center text-slate-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Parâmetro assessment_id ou report_version_id não encontrado na URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
           <Button
             onClick={handleReturnToAssessment}
             variant="ghost"
             size="sm"
             className="gap-1.5 text-slate-600 hover:text-slate-900 flex-shrink-0"
           >
             <ArrowLeft className="w-4 h-4" /> Retornar ao Assessment
           </Button>

          {/* Badge: modo snapshot vs legado */}
          {isSnapshotMode ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Snapshot imutável
              {rawPayload?._report_version?.report_code && (
                <span className="font-mono text-emerald-600 ml-0.5">{rawPayload._report_version.report_code}</span>
              )}
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Dados ao vivo
            </span>
          )}

          <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{REPORT_SECTION_ORDER.length} seções</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 overflow-x-auto max-w-xl">
            <button
              onClick={() => setActiveSection(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                !activeSection ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}
            >
              Completo
            </button>
            {REPORT_SECTION_ORDER.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  activeSection === s.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                {s.page}. {s.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleExportPDF}
            disabled={exporting || !enrichedPayload}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-shrink-0"
            size="sm"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...</>
              : <><FileDown className="w-4 h-4" /> {pdfState === 'failed' ? 'Tentar PDF novamente' : 'Gerar e baixar PDF'}</>
            }
          </Button>
        </div>
      </div>

      {pdfError && (
        <div className="max-w-5xl mx-auto mt-4 px-4 text-sm text-red-700">Falha no PDF: {pdfError}</div>
      )}

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8" style={{ minHeight: '500px' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
            <p className="text-sm font-medium">Consolidando dados do diagnóstico...</p>
            <p className="text-xs text-slate-300 mt-1">Isso pode levar alguns segundos.</p>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Erro ao carregar relatório</p>
              <p className="text-xs mt-1">{error.message}</p>
            </div>
          </div>
        ) : enrichError ? (
          <div className="flex items-start gap-3 p-5 bg-orange-50 border border-orange-200 rounded-xl text-orange-700">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Erro ao processar narrativa do relatório</p>
              <p className="text-xs mt-1">{enrichError.message}</p>
            </div>
          </div>
        ) : enrichedPayload ? (
          <div ref={reportRef} className="bg-white shadow-xl rounded-2xl overflow-auto" style={{ minHeight: '800px' }}>
              <ReportErrorBoundary>
                <FalDiagnosticReport
                  payload={enrichedPayload}
                  sectionFilter={activeSection ? [activeSection] : null}
                  showPageNumbers={!activeSection}
                />
              </ReportErrorBoundary>
            </div>
          ) : isLoading === false && !error && !enrichError ? (
            <div className="flex items-center justify-center py-32 text-slate-400">
              <AlertCircle className="w-8 h-8 mb-4 text-amber-500" />
              <p className="text-sm">Payload não disponível — nenhum enriquecimento realizado.</p>
            </div>
          ) : null}
      </div>
    </div>
  );
}