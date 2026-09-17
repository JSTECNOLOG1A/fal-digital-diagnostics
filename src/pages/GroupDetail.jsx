import React, { useState, useRef, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Layers, Building2,
  Hash, BarChart3, Network, TrendingUp,
  MoreVertical, PencilIcon, MapPin,
  LayoutDashboard, CheckSquare, FileText, Settings,
  Archive, Trash2, Scale } from
'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CreateCompanyDialog from '@/components/assessments/CreateCompanyDialog';
import CreateUnitDialog from '@/components/assessments/CreateUnitDialog';
import GroupStructureOrgChart from '@/components/group/GroupStructureOrgChart';
import EditEntityDialog from '@/components/assessments/EditEntityDialog';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { invalidateStructureQueries, groupKey } from '@/lib/query-client';
import GroupCockpit from '@/components/group/GroupCockpit';
import GroupDiagnostic8DTab from '@/components/group/GroupDiagnostic8DTab';
import GroupTaxReformTab from '@/components/group/GroupTaxReformTab';
import GroupFinancialAnalysesTab from '@/components/group/GroupFinancialAnalysesTab';
import GroupActionPlanCentral from '@/components/group/GroupActionPlanCentral';
import GroupReportsCentral from '@/components/group/GroupReportsCentral';
import GroupExecutiveBanner from '@/components/group/GroupExecutiveBanner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import { formatIFME } from '@/lib/hooks/useGroupAssessment';

const LEVEL_STYLE = {
  Crítico: { background: 'var(--fal-danger-bg)', color: 'var(--fal-danger-text)', border: '1px solid var(--fal-danger-border)' },
  Básico: { background: 'var(--fal-warning-bg)', color: 'var(--fal-warning-text)', border: '1px solid var(--fal-warning-border)' },
  Estruturado: { background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)', border: '1px solid var(--fal-current-border)' },
  Avançado: { background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)', border: '1px solid var(--fal-success-border)' }
};

const TABS = [
{ key: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
{ key: 'estrutura', label: 'Estrutura', icon: Network },
{ key: 'diagnostico-8d', label: 'Diagnóstico 8D', icon: BarChart3 },
{ key: 'reforma-tributaria', label: 'Reforma Tributária 8D', icon: Scale },
{ key: 'analise-financeira', label: 'Análise Financeira', icon: TrendingUp },
{ key: 'plano-acao', label: 'Plano de Ação', icon: CheckSquare },
{ key: 'relatorios', label: 'Relatórios', icon: FileText },
{ key: 'configuracoes', label: 'Configurações', icon: Settings }];


export default function GroupDetail() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('id');

  // Compatibilidade com URLs antigas → nova estrutura
  let initialTab = params.get('tab') || 'visao-geral';
  if (initialTab === 'diagnosticos') initialTab = 'visao-geral';
  if (initialTab === 'visao') initialTab = 'visao-geral';
  if (initialTab === 'financeiro') initialTab = 'analise-financeira';
  if (initialTab === 'ciclos' || initialTab === 'notas') initialTab = 'diagnostico-8d';
  const validTabs = TABS.map((t) => t.key);
  if (!validTabs.includes(initialTab)) initialTab = 'visao-geral';

  const { user, tenantId, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const [companyDialog, setCompanyDialog] = useState(false);
  const [unitDialog, setUnitDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  // Dispara queries do grupo imediatamente — o token de auth já está disponível
  // (AuthProvider resolve antes de GroupDetail montar). Não esperar tenantLoading
  // elimina a cascata auth.me() → Tenant.get() → Group.get() → render.
  const canQuery = !!groupId;

  const tabContentRef = useRef(null);
  const archiveDeleteRef = useRef(null);
  const goToTab = useCallback((key) => {
    setTab(key);
    setTimeout(() => {
      if (!tabContentRef.current) return;
      let el = tabContentRef.current;
      let scrollParent = null;
      while (el.parentElement) {
        el = el.parentElement;
        const { overflow, overflowY } = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(overflow + overflowY)) {scrollParent = el;break;}
      }
      if (scrollParent) {
        const targetTop = tabContentRef.current.getBoundingClientRect().top -
        scrollParent.getBoundingClientRect().top +
        scrollParent.scrollTop - 16;
        scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        tabContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const STALE = 5 * 60 * 1000;

  const { data: group } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'detail'),
    queryFn: () => base44.entities.Group.get(groupId),
    enabled: canQuery,
    staleTime: STALE,
  });

  const { data: companiesRaw = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'companies'),
    queryFn: () => base44.entities.Company.filter({ group_id: groupId }, 'name', 100),
    enabled: canQuery,
    placeholderData: keepPreviousData,
    staleTime: STALE,
  });

  const companies = companiesRaw.filter((c) => !c.is_archived);

  // aggSnapshots e financialDiagnoses aguardam group para não disparar antes do necessário
  const { data: aggSnapshots = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'agg-snapshot'),
    queryFn: () => base44.entities.FalAggregateSnapshot.filter(
      { level_type: 'group', level_id: groupId }, '-computed_at', 1
    ),
    enabled: canQuery && !!group,
    staleTime: STALE,
  });

  const aggSnap = aggSnapshots[0] || null;

  const { data: financialDiagnoses = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'financial-analyses'),
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ group_id: groupId }, '-created_date', 50),
    enabled: canQuery && !!group,
    placeholderData: keepPreviousData,
    staleTime: STALE,
  });
  const activeFinancial = financialDiagnoses.filter((d) => d.status !== 'archived' && !d.is_archived);

  async function checkGroupDependencies() {
    const [allCompanies, assessments, snapshots] = await Promise.all([
    base44.entities.Company.filter({ group_id: groupId }, 'created_date', 100),
    base44.entities.Assessment.filter({ group_id: groupId }, 'created_date', 1),
    base44.entities.FalAggregateSnapshot.filter({ level_type: 'group', level_id: groupId }, 'created_date', 1)]
    );
    const activeCompanies = allCompanies.filter((c) => !c.is_archived);
    const reasons = [];
    if (activeCompanies.length > 0) reasons.push(`${activeCompanies.length} empresa(s) ativa(s) vinculada(s)`);
    if (assessments.length > 0) reasons.push(`${assessments.length} diagnóstico(s) vinculado(s)`);
    if (snapshots.length > 0) reasons.push(`${snapshots.length} resultado(s) consolidado(s)`);
    return { ok: reasons.length === 0, reasons };
  }

  if (!group) {
    return (
      <PageContainer variant="wide" className="py-6 space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'linear-gradient(135deg, rgba(6,21,41,0.5) 0%, rgba(16,43,73,0.5) 100%)' }}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </div>
        <div className="flex gap-4 border-b pb-2">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-8 w-24" />)}
        </div>
      </PageContainer>);

  }

  return (
    <PageContainer variant="wide" className="py-6">
      {/* Breadcrumb */}
      <Link
        to={createPageUrl('Groups')}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--fal-text-muted)' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fal-text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fal-text-muted)'}>
        
        <ArrowLeft className="w-4 h-4" /> Hub de Grupos
      </Link>

      {/* Hero header */}
      <div className="rounded-2xl p-5 mb-6 text-white" style={{ background: 'linear-gradient(135deg, var(--fal-navy-950) 0%, var(--fal-navy-800) 100%)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.15)' }}>
              <Layers className="w-5 h-5" style={{ color: '#60a5fa' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {group.group_order_number != null &&
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                style={{ color: '#60a5fa', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
                    <Hash className="w-2.5 h-2.5" />{String(group.group_order_number).padStart(3, '0')}
                  </span>
                }
                <h1 className="text-lg font-bold text-white truncate">{group.name}</h1>
                {aggSnap?.overall_level &&
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 border"
                style={LEVEL_STYLE[aggSnap.overall_level] || {}}>
                    {aggSnap.overall_level}
                  </span>
                }
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fal-text-inverse-muted)' }}>
                Mesa FAL do Cliente · {companies.length} empresa(s)
                {group.sector ? ` · ${group.sector}` : ''}
              </p>
            </div>
          </div>

          {/* Indicadores + Menu de ações — linha única */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-4 pr-3" style={{ borderRight: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: '#60a5fa' }}>IFME™</p>
                <p className="text-lg font-black text-white leading-tight">{formatIFME(aggSnap?.overall_score)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fal-text-inverse-muted)' }}>Maturidade</p>
                <p className="text-sm font-bold text-white leading-tight">{aggSnap?.overall_level || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fal-text-inverse-muted)' }}>Empresas</p>
                <p className="text-lg font-black text-white leading-tight">{companies.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fal-text-inverse-muted)' }}>Análises</p>
                <p className="text-lg font-black text-white leading-tight">{activeFinancial.length}</p>
              </div>
            </div>

            <PermissionGuard area="group" fallback={null}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-white/10" style={{ color: 'var(--fal-text-inverse-muted)' }}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setEditDialog(true)}>
                    <PencilIcon className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--fal-text-muted)' }} /> Editar grupo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCompanyDialog(true)}>
                    <Building2 className="w-3.5 h-3.5 mr-2" style={{ color: '#3b82f6' }} /> Nova empresa
                  </DropdownMenuItem>
                  {companies.length > 0 &&
                  <DropdownMenuItem onClick={() => setUnitDialog(true)}>
                      <MapPin className="w-3.5 h-3.5 mr-2" style={{ color: '#3b82f6' }} /> Nova unidade
                    </DropdownMenuItem>
                  }
                  <DropdownMenuSeparator />
                  <PermissionGuard area="exclusions" fallback={null}>
                    <DropdownMenuItem onClick={() => archiveDeleteRef.current?.openArchive()} className="text-amber-600 focus:text-amber-700">
                      <Archive className="w-3.5 h-3.5 mr-2" /> Arquivar grupo
                    </DropdownMenuItem>
                  </PermissionGuard>
                  <PermissionGuard area="exclusions" fallback={null}>
                    <DropdownMenuItem onClick={() => archiveDeleteRef.current?.openDelete()} className="text-red-600 focus:text-red-700">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
                    </DropdownMenuItem>
                  </PermissionGuard>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>
          </div>
        </div>


      </div>

      {/* Navegação — 7 abas */}
      <div className="flex gap-0 mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--fal-border-soft)' }}>
        {TABS.map((t) =>
        <button
          key={t.key}
          onClick={() => goToTab(t.key)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px"
          style={tab === t.key ?
          { borderBottomColor: '#2563eb', color: '#2563eb' } :
          { borderBottomColor: 'transparent', color: 'var(--fal-text-muted)' }
          }>
          
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        )}
      </div>

      {/* Âncora de scroll */}
      <div ref={tabContentRef} style={{ scrollMarginTop: '8px' }} />

      {/* Banner executivo persistente em todas as abas */}
      <GroupExecutiveBanner
        aggSnap={aggSnap}
        group={group}
      />

      {/* ── Visão Geral ── */}
      {tab === 'visao-geral' &&
      <GroupCockpit
        groupId={groupId}
        tenantId={tenantId}
        group={group}
        aggSnap={aggSnap}
        financialCount={activeFinancial.length}
        onGoTo={goToTab} />

      }

      {/* ── Estrutura ── */}
      {tab === 'estrutura' &&
      <GroupStructureOrgChart
        group={group}
        tenantId={tenantId}
        onAddCompany={() => setCompanyDialog(true)}
        view="operational" />

      }

      {/* ── Diagnóstico 8D ── */}
      {tab === 'diagnostico-8d' &&
      <GroupDiagnostic8DTab
        groupId={groupId}
        tenantId={tenantId}
        onGoToActionPlan={() => goToTab('plano-acao')} />

      }

      {/* ── Reforma Tributária 8D ── */}
      {tab === 'reforma-tributaria' &&
      <GroupTaxReformTab
        groupId={groupId}
        tenantId={tenantId}
        onGoToActionPlan={() => goToTab('plano-acao')} />

      }

      {/* ── Análise Financeira ── */}
      {tab === 'analise-financeira' &&
      <GroupFinancialAnalysesTab
        groupId={groupId}
        tenantId={tenantId} />

      }

      {/* ── Plano de Ação ── */}
      {tab === 'plano-acao' &&
      <GroupActionPlanCentral
        groupId={groupId}
        tenantId={tenantId}
        onGo8D={() => goToTab('diagnostico-8d')} />

      }

      {/* ── Relatórios ── */}
      {tab === 'relatorios' &&
      <GroupReportsCentral
        groupId={groupId}
        tenantId={tenantId} />

      }

      {/* ── Configurações ── */}
      {tab === 'configuracoes' &&
      <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold fal-title mb-1 hidden">Configurações do Grupo</h2>
            <p className="text-xs fal-muted hidden">Parametrizações e dados cadastrais do grupo.</p>
          </div>

          {/* Dados do grupo */}
          <div className="fal-card p-5 space-y-3 hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold fal-title hidden">Dados do Grupo</h3>
              <Button size="sm" variant="outline" onClick={() => setEditDialog(true)} className="gap-1.5">
                <PencilIcon className="w-3.5 h-3.5" /> Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs fal-muted hidden">Nome</p>
                <p className="font-medium fal-title hidden">{group.name}</p>
              </div>
              {group.sector &&
            <div>
                  <p className="text-xs fal-muted">Setor</p>
                  <p className="font-medium fal-title">{group.sector}</p>
                </div>
            }
              {group.description &&
            <div className="col-span-2">
                  <p className="text-xs fal-muted">Descrição</p>
                  <p className="fal-subtitle">{group.description}</p>
                </div>
            }
            </div>
          </div>

          {/* Zona de risco */}
          











        
        </div>
      }

      {/* Dialogs */}
      <CreateCompanyDialog
        open={companyDialog}
        onOpenChange={setCompanyDialog}
        tenantId={tenantId}
        groupId={groupId}
        groupName={group?.name}
        companies={companies}
        onCreated={() => invalidateStructureQueries(queryClient, tenantId, 'company')} />
      

      <CreateUnitDialog
        open={unitDialog}
        onOpenChange={setUnitDialog}
        tenantId={tenantId}
        companies={companies}
        onCreated={() => invalidateStructureQueries(queryClient, tenantId, 'company')} />
      

      <EditEntityDialog
        open={editDialog}
        onOpenChange={setEditDialog}
        entityType="group"
        entity={group}
        onSaved={() => invalidateStructureQueries(queryClient, tenantId, 'group')} />
      
    </PageContainer>);

}