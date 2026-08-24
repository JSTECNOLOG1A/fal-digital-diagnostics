/**
 * ReportVersionList
 * Lista de relatórios gerados para um assessment.
 * Nunca deleta — apenas arquiva.
 * Exibe tipo, versão, data, status, gerado por e ações.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentKey } from '@/lib/query-client';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { REPORT_TYPES, REPORT_STATUS } from '@/lib/reportConstants';
import {
  BarChart3, Zap, GitBranch, TrendingUp, FileText, Briefcase,
  Archive, ExternalLink, RefreshCw, Eye, BadgeCheck
} from 'lucide-react';

const TYPE_ICONS = { BarChart3, Zap, GitBranch, TrendingUp, FileText, Briefcase };

/**
 * @param {Object} props
 * @param {any=} props.iconName
 * @param {any=} props.className
 */
function TypeIcon({ iconName, className }) {
  const Icon = TYPE_ICONS[iconName];
  return Icon ? <Icon className={className} /> : <FileText className={className} />;
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onGenerate
 */
export default function ReportVersionList({ assessmentId, tenantId, onGenerate }) {
  const qc = useQueryClient();
  const { canManageReports } = usePermissions();
  const [archiving, setArchiving] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [officializing, setOfficializing] = useState(null);

  const handlePreview = async (version) => {
    // Abre diretamente — ReportPreview carrega via getReportVersionSnapshot (backend guardado)
    window.open(`/ReportPreview?report_version_id=${version.id}&from_snapshot=true`, '_blank');
  };

  const { data: versions = [], isLoading } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'report-versions'),
    queryFn: () => base44.entities.AssessmentReportVersion.filter(
      { assessment_id: assessmentId, tenant_id: tenantId },
      '-report_version_number',
      100
    ),
    enabled: !!assessmentId && !!tenantId,
  });

  const handleOfficial = async (version) => {
    setOfficializing(version.id);
    const res = await base44.functions.invoke('setOfficialAssessmentReportVersion', { report_version_id: version.id });
    if (res.data?.error) alert(`Erro ao tornar oficial: ${res.data.error}`);
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'report-versions') });
    setOfficializing(null);
  };

  const handleArchive = async (version) => {
    setArchiving(version.id);
    const res = await base44.functions.invoke('archiveReportVersion', { report_version_id: version.id });
    if (res.data?.error) { alert(`Erro ao arquivar: ${res.data.error}`); }
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'report-versions') });
    setArchiving(null);
  };

  // Agrupar por tipo
  const grouped = {};
  versions.forEach(v => {
    if (!grouped[v.report_type]) grouped[v.report_type] = [];
    grouped[v.report_type].push(v);
  });

  if (isLoading) return <div className="text-sm text-slate-400 text-center py-8">Carregando relatórios...</div>;

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 space-y-3">
        <FileText className="w-10 h-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">Nenhum relatório emitido ainda.</p>
        <p className="text-xs text-slate-300">Clique em "Gerar novo relatório" para começar.</p>
        {onGenerate && (
          <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white mt-2" onClick={onGenerate}>
            <Zap className="w-3.5 h-3.5" /> Gerar primeiro relatório
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([reportType, typeVersions]) => {
        const typeCfg = REPORT_TYPES[reportType] || REPORT_TYPES.custom;
        const activeVersions = typeVersions.filter(v => v.status !== 'archived');
        const archivedVersions = typeVersions.filter(v => v.status === 'archived');

        return (
          <div key={reportType}>
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon iconName={typeCfg.icon} className={`w-4 h-4 ${typeCfg.color}`} />
              <h4 className="text-sm font-bold text-slate-700">{typeCfg.label}</h4>
              <span className="text-xs text-slate-400">({typeVersions.length} versão{typeVersions.length !== 1 ? 'ões' : ''})</span>
            </div>

            <div className="space-y-2">
              {activeVersions.map(v => (
                <VersionRow
                  key={v.id}
                  version={v}
                  typeCfg={typeCfg}
                  onArchive={() => handleArchive(v)}
                  archiving={archiving === v.id}
                  onRegenerate={() => onGenerate?.({ prefill: v })}
                  onPreview={handlePreview}
                  onOfficial={canManageReports ? () => handleOfficial(v) : null}
                  officializing={officializing === v.id}
                />
              ))}

              {archivedVersions.length > 0 && (
                <details className="ml-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                    {archivedVersions.length} versão(ões) arquivada(s)
                  </summary>
                  <div className="space-y-1 mt-1">
                    {archivedVersions.map(v => (
                      <VersionRow key={v.id} version={v} typeCfg={typeCfg} archived />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.version
 * @param {any=} props.typeCfg
 * @param {any=} props.onArchive
 * @param {any=} props.archiving
 * @param {any=} props.onRegenerate
 * @param {any=} props.archived
 * @param {any=} props.onPreview
 * @param {any=} props.onOfficial
 * @param {any=} props.officializing
 */
function VersionRow({ version, typeCfg, onArchive, archiving, onRegenerate, archived, onPreview, onOfficial, officializing }) {
  const statusCfg = REPORT_STATUS[version.status] || REPORT_STATUS.draft;
  const generatedAt = version.generated_at
    ? new Date(version.generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
      archived
        ? 'border-slate-100 bg-slate-50/50 opacity-60'
        : `${typeCfg.border} ${typeCfg.bg}`
    }`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{version.report_title}</span>
          <Badge className="text-[10px] border-0 bg-white/80 text-slate-600 font-mono flex-shrink-0">
            {version.report_code || `v${version.report_version_number}`}
          </Badge>
          {version.mark_as_official && (
            <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-700 flex-shrink-0">Oficial</Badge>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {generatedAt}
          {version.generated_by ? ` · ${version.generated_by}` : ''}
          {version.assessment_revision_number ? ` · Revisão Nº${version.assessment_revision_number}` : ''}
        </p>
      </div>

      {/* Status */}
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statusCfg.cls}`}>
        {statusCfg.label}
      </span>

      {/* Ações */}
      {!archived && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {version.pdf_file_url ? (
            <a href={version.pdf_file_url} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" title="Abrir PDF">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-400 hover:text-blue-600"
              title="Visualizar relatório"
              onClick={() => onPreview?.(version)}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {!version.mark_as_official && onOfficial && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-emerald-600" title="Tornar oficial" onClick={onOfficial} disabled={officializing}>
              <BadgeCheck className="w-3.5 h-3.5" />
            </Button>
          )}
          {onRegenerate && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-indigo-600" title="Regenerar (cria nova versão)" onClick={onRegenerate}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
          {onArchive && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:text-slate-500"
              title="Arquivar (não deleta)"
              onClick={onArchive}
              disabled={archiving}
            >
              <Archive className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}