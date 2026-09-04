/**
 * FinancialReportPanel — aba "Relatório da análise": monta/atualiza uma
 * versão do Relatório da Análise Econômico-Financeira, permite revisar a
 * prévia (mesmo HTML usado no PDF, exibido num iframe), finalizar a versão
 * e exportar/baixar o PDF gerado pelo backend (Puppeteer).
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financialKey } from '@/lib/query-client';
import { clarity } from '@/api/clarityClient';
import {
  FileText, RefreshCw, CheckCircle2, Download, Loader2, Lock, AlertTriangle, Clock,
} from 'lucide-react';

const STATUS_LABELS = {
  draft: 'Rascunho',
  generated: 'Gerado',
  in_review: 'Em revisão',
  final: 'Finalizado',
  outdated: 'Desatualizado',
};

const STATUS_CLASSES = {
  draft: 'bg-slate-100 text-slate-600',
  generated: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  final: 'bg-emerald-100 text-emerald-700',
  outdated: 'bg-red-100 text-red-700',
};

export default function FinancialReportPanel({ diagnosisId, tenantId, diagnosis }) {
  const queryClient = useQueryClient();
  const [pdfError, setPdfError] = useState(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'report-versions'),
    queryFn: () => clarity.listFinancialReportVersions(diagnosisId),
    enabled: !!diagnosisId,
  });

  const latest = versions[0] || null;

  const { data: previewHtml, isLoading: isLoadingPreview } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'report-preview', latest?.id, latest?.updatedAt),
    queryFn: () => clarity.getFinancialReportRenderHtml(latest.id),
    enabled: !!latest?.id && !!latest?.payloadSnapshot,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'report-versions') });

  const generateMutation = useMutation({
    mutationFn: () => clarity.generateOrUpdateFinancialReportVersion(diagnosisId, false),
    onSuccess: invalidate,
  });

  const finalizeMutation = useMutation({
    mutationFn: () => clarity.finalizeFinancialReportVersion(latest.id),
    onSuccess: invalidate,
  });

  const exportMutation = useMutation({
    mutationFn: () => clarity.exportFinancialReportVersionPdf(latest.id),
    onSuccess: invalidate,
    onError: (e) => setPdfError(e.message),
  });

  const handleDownload = async () => {
    setPdfError(null);
    try {
      const { blob, filename } = await clarity.downloadFinancialReportVersionPdf(latest.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-400" />
        <p className="text-sm">Carregando relatório da análise...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-sm font-semibold text-slate-800">Relatório da Análise Econômico-Financeira</div>
            <div className="text-xs text-slate-500">
              {diagnosis?.title || ''} {latest ? `· v${latest.versionNumber}.0` : ''}
            </div>
          </div>
          {latest && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[latest.status] || 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABELS[latest.status] || latest.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {latest ? 'Atualizar relatório' : 'Gerar relatório'}
          </button>
          <button
            onClick={() => finalizeMutation.mutate()}
            disabled={!latest || latest.status === 'final' || finalizeMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {finalizeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Finalizar
          </button>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={!latest || exportMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            {exportMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
          <button
            onClick={handleDownload}
            disabled={!latest || latest.pdfStatus !== 'ready'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar PDF
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {pdfError}
        </div>
      )}

      {latest?.status === 'outdated' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Os dados financeiros foram alterados desde a finalização desta versão. O PDF já emitido permanece intacto — gere uma nova versão para refletir os dados atuais.
        </div>
      )}

      {/* Prévia */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg overflow-hidden" style={{ minHeight: 600 }}>
        {!latest ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum relatório gerado ainda.</p>
            <p className="text-xs mt-1">Clique em "Gerar relatório" para montar a primeira versão a partir dos dados atuais.</p>
          </div>
        ) : isLoadingPreview ? (
          <div className="text-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-400" />
            <p className="text-sm">Montando prévia...</p>
          </div>
        ) : (
          <iframe
            title="Prévia do Relatório da Análise"
            srcDoc={previewHtml}
            className="w-full border-0 bg-white"
            style={{ height: '85vh' }}
          />
        )}
      </div>
    </div>
  );
}
