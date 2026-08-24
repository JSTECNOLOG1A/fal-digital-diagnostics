/**
 * ReportsCenterPage
 * Central de Relatórios — página dedicada na sidebar.
 * Permite filtrar e emitir relatórios por grupo, empresa, diagnóstico, tipo, etc.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REPORT_TYPES, REPORT_STATUS } from '@/lib/reportConstants';
import {
  FileText, Search, Zap, Filter, BarChart3, TrendingUp,
  GitBranch, Briefcase, Archive, ExternalLink,
  Eye, Loader2, Layers, X } from
'lucide-react';
import ReportGenerationModal from '@/components/reports/ReportGenerationModal';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { tenantKey } from '@/lib/query-client';

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
 * @param {any=} props.version
 * @param {any=} props.typeCfg
 * @param {any=} props.onArchive
 * @param {any=} props.archiving
 * @param {any=} props.onPreview
 * @param {any=} props.assessmentTitle
 * @param {any=} props.groupName
 */
function VersionRow({ version, typeCfg, onArchive, archiving, onPreview, assessmentTitle, groupName }) {
  const statusCfg = REPORT_STATUS[version.status] || REPORT_STATUS.draft;
  const generatedAt = version.generated_at ?
  new Date(version.generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) :
  '—';

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${typeCfg.border} ${typeCfg.bg}`}>
      <div className={`w-8 h-8 rounded-lg ${typeCfg.bg} border ${typeCfg.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <TypeIcon iconName={typeCfg.icon} className={`w-4 h-4 ${typeCfg.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{version.report_title}</span>
          <Badge className="text-[10px] border-0 bg-white/80 text-slate-600 font-mono flex-shrink-0">
            {version.report_code || `v${version.report_version_number}`}
          </Badge>
          {version.mark_as_official &&
          <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-700 flex-shrink-0">Oficial</Badge>
          }
        </div>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {groupName && <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{groupName}</span>}
          {assessmentTitle && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{assessmentTitle}</span>}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {generatedAt}
          {version.generated_by ? ` · ${version.generated_by}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`}>
          {statusCfg.label}
        </span>
        {version.pdf_file_url ?
        <a href={version.pdf_file_url} target="_blank" rel="noopener noreferrer">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" title="Abrir PDF">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a> :

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-400 hover:text-blue-600"
          title="Visualizar relatório"
          onClick={() => onPreview?.(version)}>
          
            <Eye className="w-3.5 h-3.5" />
          </Button>
        }
        {onArchive &&
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-300 hover:text-slate-500"
          title="Arquivar"
          onClick={() => onArchive(version)}
          disabled={archiving === version.id}>
          
            {archiving === version.id ?
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          <Archive className="w-3.5 h-3.5" />}
          </Button>
        }
      </div>
    </div>);

}

export default function ReportsCenterPage() {
  const { user, tenantId: ctxTenantId } = useTenant();
  const qc = useQueryClient();
  const tenantId = ctxTenantId || user?.tenant_id;

  // Filtros
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterAssessment, setFilterAssessment] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [archiving, setArchiving] = useState(null);

  // Modal de geração
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

  // ── Data ─────────────────────────────────────────────────────
  const { data: groups = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'groups'),
    queryFn: () => base44.entities.Group.filter({ tenant_id: tenantId }, 'name', 200),
    enabled: !!tenantId
  });

  const { data: assessments = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'assessments-reports'),
    queryFn: () => base44.entities.Assessment.filter({ tenant_id: tenantId }, '-created_date', 200),
    enabled: !!tenantId
  });

  const { data: allVersions = [], isLoading } = useQuery({
    queryKey: tenantKey(tenantId, 'report-versions-all'),
    queryFn: () => base44.entities.AssessmentReportVersion.filter(
      { tenant_id: tenantId },
      '-generated_at',
      500
    ),
    enabled: !!tenantId
  });

  // Índices
  const assessmentById = useMemo(() => {
    const m = {};
    assessments.forEach((a) => {m[a.id] = a;});
    return m;
  }, [assessments]);

  const groupById = useMemo(() => {
    const m = {};
    groups.forEach((g) => {m[g.id] = g;});
    return m;
  }, [groups]);

  // Assessments filtrados por grupo
  const filteredAssessments = useMemo(() => {
    if (!filterGroup) return assessments;
    return assessments.filter((a) => a.group_id === filterGroup);
  }, [assessments, filterGroup]);

  // Versões filtradas
  const filteredVersions = useMemo(() => {
    return allVersions.filter((v) => {
      const assessment = assessmentById[v.assessment_id];
      const group = assessment ? groupById[assessment.group_id] : null;

      if (filterGroup && assessment?.group_id !== filterGroup) return false;
      if (filterAssessment && v.assessment_id !== filterAssessment) return false;
      if (filterType && v.report_type !== filterType) return false;
      if (filterStatus && v.status !== filterStatus) return false;
      if (filterStatus === '' && v.status === 'archived') return false; // oculta arquivados por padrão

      if (search) {
        const q = search.toLowerCase();
        const title = (v.report_title || '').toLowerCase();
        const code = (v.report_code || '').toLowerCase();
        const aTitle = (assessment?.title || '').toLowerCase();
        const gName = (group?.name || '').toLowerCase();
        if (!title.includes(q) && !code.includes(q) && !aTitle.includes(q) && !gName.includes(q)) return false;
      }

      return true;
    });
  }, [allVersions, filterGroup, filterAssessment, filterType, filterStatus, search, assessmentById, groupById]);

  const hasActiveFilters = filterGroup || filterAssessment || filterType || filterStatus || search;

  const clearFilters = () => {
    setSearch('');
    setFilterGroup('');
    setFilterAssessment('');
    setFilterType('');
    setFilterStatus('');
  };

  const handleArchive = async (version) => {
    setArchiving(version.id);
    const response = await base44.functions.invoke('archiveReportVersion', { report_version_id: version.id });
    if (response.data?.error) throw new Error(response.data.error);
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'report-versions-all') });
    setArchiving(null);
  };

  const handlePreview = async (version) => {
    const res = await base44.functions.invoke('generatePdfFromReportVersion', { report_version_id: version.id });
    if (res.data?.error) {alert(`Erro ao carregar relatório: ${res.data.error}`);return;}
    window.open(`/ReportPreview?report_version_id=${version.id}&from_snapshot=true`, '_blank');
  };

  const handleOpenModal = (assessmentId) => {
    setSelectedAssessmentId(assessmentId || null);
    setModalOpen(true);
  };

  // Stats
  const activeVersions = allVersions.filter((v) => v.status !== 'archived');
  const officialVersions = allVersions.filter((v) => v.mark_as_official);

  return (
    <PageContainer variant="wide" className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Relatórios</h1>
          


          
        </div>
        <PermissionGuard area="reports" fallback={null}>
          <Button
            onClick={() => handleOpenModal(filterAssessment || null)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Zap className="w-4 h-4" /> Gerar novo relatório
          </Button>
        </PermissionGuard>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">Filtros</span>
          {hasActiveFilters &&
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
            
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          }
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por título, código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm" />
            
          </div>

          {/* Grupo */}
          <Select value={filterGroup} onValueChange={(v) => {setFilterGroup(v === '__all' ? '' : v);setFilterAssessment('');}}>
            <SelectTrigger className="text-sm">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
              <SelectValue placeholder="Todos os grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os grupos</SelectItem>
              {groups.filter((g) => !g.is_archived).map((g) =>
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Diagnóstico / Assessment */}
          <Select value={filterAssessment} onValueChange={(v) => setFilterAssessment(v === '__all' ? '' : v)}>
            <SelectTrigger className="text-sm">
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
              <SelectValue placeholder="Todos os diagnósticos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os diagnósticos</SelectItem>
              {filteredAssessments.filter((a) => !a.is_archived).map((a) =>
              <SelectItem key={a.id} value={a.id}>
                  {a.title || a.display_name || a.id.slice(0, 8)}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Tipo */}
          <Select value={filterType} onValueChange={(v) => setFilterType(v === '__all' ? '' : v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os tipos</SelectItem>
              {Object.entries(REPORT_TYPES).map(([key, cfg]) =>
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Segunda linha de filtros */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-slate-400 flex items-center">Status:</span>
          {[
          { val: '', label: 'Ativos' },
          { val: 'generated', label: 'Gerados' },
          { val: 'draft', label: 'Rascunho' },
          { val: 'archived', label: 'Arquivados' }].
          map((opt) =>
          <button
            key={opt.val}
            onClick={() => setFilterStatus(opt.val)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
            filterStatus === opt.val ?
            'bg-blue-600 text-white border-blue-600' :
            'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`
            }>
            
              {opt.label}
            </button>
          )}
        </div>
      </div>

      {/* Resultados */}
      {isLoading ?
      <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm">Carregando relatórios...</p>
        </div> :
      filteredVersions.length === 0 ?
      <div className="text-center py-16 text-slate-400 space-y-3">
          <FileText className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-sm font-medium">
            {hasActiveFilters ? 'Nenhum relatório encontrado com os filtros aplicados.' : 'Nenhum relatório emitido ainda.'}
          </p>
          {hasActiveFilters &&
        <button onClick={clearFilters} className="text-xs text-blue-500 hover:underline">
              Limpar filtros
            </button>
        }
          {!hasActiveFilters &&
        <Button size="sm" onClick={() => handleOpenModal(null)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Zap className="w-3.5 h-3.5" /> Gerar primeiro relatório
            </Button>
        }
        </div> :

      <div className="space-y-2">
          <p className="text-xs text-slate-400 px-1">
            {filteredVersions.length} resultado(s)
          </p>
          {filteredVersions.map((v) => {
          const assessment = assessmentById[v.assessment_id];
          const group = assessment ? groupById[assessment.group_id] : null;
          const typeCfg = REPORT_TYPES[v.report_type] || REPORT_TYPES.custom;
          return (
            <VersionRow
              key={v.id}
              version={v}
              typeCfg={typeCfg}
              assessmentTitle={assessment?.title || assessment?.display_name}
              groupName={group?.name}
              onArchive={v.status !== 'archived' ? handleArchive : null}
              archiving={archiving}
              onPreview={handlePreview} />);


        })}
        </div>
      }

      {/* Modal de geração */}
      {modalOpen &&
      <ReportGenerationModal
        open={modalOpen}
        onClose={() => {setModalOpen(false);setSelectedAssessmentId(null);}}
        assessmentId={selectedAssessmentId}
        tenantId={tenantId}
        prefillPreset={null}
        onGenerated={() => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'report-versions-all') })} />

      }
    </PageContainer>);

}