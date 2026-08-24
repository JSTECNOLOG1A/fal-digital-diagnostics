/**
 * ReportGenerationPanel — Painel de geração de relatórios por escopo
 * Exibe botões corretos conforme o contexto (grupo, empresa, unidade)
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { tenantKey } from '@/lib/query-client';

/**
 * ReportGenerationPanel — Renderiza botões e controles de relatório conforme escopo
 */
export default function ReportGenerationPanel({
  reportScope, // 'group', 'company', 'unit'
  groupId,
  companyId,
  unitId,
  cycleId,
  tenantId,
}) {
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [previewMode, setPreviewMode] = useState(null);

  const { data: cycle } = useQuery({
    queryKey: tenantKey(tenantId, 'cycle', cycleId),
    queryFn: () => base44.entities.FalAssessmentCycle.get(cycleId),
    enabled: !!cycleId,
  });

  // Configuração por escopo
  const config = {
    group: {
      reports: [
        { mode: 'executive', title: 'Relatório Executivo do Grupo', subtitle: 'Síntese estratégica para decisão' },
        { mode: 'full_scope', title: 'Relatório Consolidado', subtitle: 'Análise detalhada com todas as empresas e unidades' },
      ],
    },
    company: {
      reports: [
        { mode: 'tactical', title: 'Relatório da Empresa', subtitle: 'Visão tática e comparativo com o grupo' },
      ],
    },
    unit: {
      reports: [
        { mode: 'operational', title: 'Relatório da Unidade', subtitle: 'Ações operacionais e execução prática' },
      ],
    },
  };

  const reports = config[reportScope]?.reports || [];

  async function handleGenerateReport(mode) {
    setGenerating(true);
    try {
      const response = await base44.functions.invoke('generateReport', {
        reportScope,
        reportMode: mode,
        cycleId,
        groupId: reportScope === 'group' ? groupId : undefined,
        companyId: reportScope === 'company' ? companyId : undefined,
        unitId: reportScope === 'unit' ? unitId : undefined,
        tenantId,
      });

      if (response.data?.payload) {
        setPreviewPayload(response.data.payload);
        setPreviewMode(mode);
        setShowPreview(true);
      }
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setGenerating(false);
    }
  }

  if (!cycle) {
    return (
      <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
        <AlertCircle className="w-4 h-4" />
        Carregando contexto de ciclo...
      </div>
    );
  }

  // Status do ciclo
  const canGenerate = cycle.status === 'closed' || cycle.status === 'open';
  const hint = !canGenerate ? 'Ciclo arquivado — não é possível gerar novos relatórios' : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Relatórios do Ciclo</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {cycle.name} — {cycle.reference_date && `Data-base: ${cycle.reference_date}`}
          </p>
        </div>
      </div>

      {hint && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {hint}
        </div>
      )}

      <div className="grid gap-2">
        {reports.map(report => (
          <button
            key={report.mode}
            disabled={generating || !canGenerate}
            onClick={() => handleGenerateReport(report.mode)}
            className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{report.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{report.subtitle}</p>
              </div>
              {generating && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Preview Dialog */}
      {showPreview && previewPayload && (
        <ReportPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          payload={previewPayload}
          reportScope={reportScope}
          reportMode={previewMode}
        />
      )}
    </div>
  );
}

/**
 * Dialog simplificado de preview
 */
function ReportPreviewDialog({ open, onOpenChange, payload, reportScope, reportMode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview do Relatório</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 font-mono">
              <strong>Escopo:</strong> {reportScope} | <strong>Modo:</strong> {reportMode}
            </p>
            <p className="text-xs text-slate-500 mt-2 font-mono">
              Score: {payload.headline?.overallScore?.toFixed(1) || '—'} | Nível: {payload.headline?.overallLevel || '—'}
            </p>
          </div>
          <div className="text-xs text-slate-600 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            Funcionalidade de preview em desenvolvimento. Para gerar PDF, use o serviço de geração completa.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}