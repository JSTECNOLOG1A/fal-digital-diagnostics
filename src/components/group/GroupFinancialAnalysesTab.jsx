/**
 * GroupFinancialAnalysesTab — Central de Análises Financeiras do Grupo
 * Layout: cabeçalho + tabela 5 colunas (Análise, Período, Status, Progresso, Ações)
 * com dots de status, barras de progresso e paginação.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, TrendingUp, MoreVertical, ExternalLink, Trash2, Archive,
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, Info, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GroupAccountPlansTab from './GroupAccountPlansTab';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { groupKey } from '@/lib/query-client';

// ─── Status → dot / label / progress mapping ──────────────────────────────────
const STATUS_MAP = {
  draft:             { label: 'Pendente',     dot: '#94a3b8', progress: 0 },
  uploaded:          { label: 'Em andamento', dot: '#f59e0b', progress: 1 },
  validating:        { label: 'Em andamento', dot: '#f59e0b', progress: 1 },
  validation_failed: { label: 'Com erro',     dot: '#ef4444', progress: 1 },
  validated:         { label: 'Em andamento', dot: '#f59e0b', progress: 2 },
  preparing:         { label: 'Em andamento', dot: '#f59e0b', progress: 2 },
  prepared:          { label: 'Em andamento', dot: '#f59e0b', progress: 2 },
  processing:        { label: 'Em andamento', dot: '#f59e0b', progress: 3 },
  processed:         { label: 'Concluída',     dot: '#22c55e', progress: 4 },
  reviewed:          { label: 'Concluída',     dot: '#22c55e', progress: 4 },
  approved:          { label: 'Concluída',     dot: '#22c55e', progress: 4 },
  archived:          { label: 'Arquivada',     dot: '#94a3b8', progress: 4 },
};

// "Concluída" (5/5) agora exige, além dos 4 passos do diagnóstico
// (processed/reviewed/approved), que o Relatório da Análise também tenha
// sido finalizado (FinancialReportVersion.status === 'final' — ver
// has_finalized_report em financial-diagnosis.service.ts::list()). Sem
// isso, um diagnóstico processado mas sem relatório finalizado fica em
// 4/5, rotulado "Relatório pendente" em vez de "Concluída".
const TOTAL_STEPS = 5;

/**
 * @param {any} diagnosis
 * @returns {{ label: string, dot: string, progress: number }}
 */
function getStatusConfig(diagnosis) {
  const base = STATUS_MAP[diagnosis.status] || STATUS_MAP.draft;
  if (diagnosis.status === 'archived') return { ...base, progress: TOTAL_STEPS };
  const journeyDone = base.progress >= 4;
  if (!journeyDone) return base;
  if (diagnosis.has_finalized_report) return { label: 'Concluída', dot: '#22c55e', progress: TOTAL_STEPS };
  return { label: 'Relatório pendente', dot: '#f59e0b', progress: 4 };
}

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPeriod(p) {
  if (!p) return '—';
  const m = p.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : p;
}

function fmtPeriodRange(d) {
  const first = fmtPeriod(d.first_period);
  const last = fmtPeriod(d.last_period);
  if (first === '—' && last === '—') return '—';
  if (first === last) return first;
  if (first === '—') return last;
  if (last === '—') return first;
  return `${first} a ${last}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusDot({ diagnosis }) {
  const cfg = getStatusConfig(diagnosis);
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      <span className="text-xs text-slate-600 font-medium whitespace-nowrap">{cfg.label}</span>
    </div>
  );
}

function ProgressCell({ diagnosis }) {
  const cfg = getStatusConfig(diagnosis);
  const pct = (cfg.progress / TOTAL_STEPS) * 100;
  const isDone = cfg.progress === TOTAL_STEPS;
  const barColor = isDone ? '#22c55e' : cfg.progress > 0 ? '#2563eb' : '#e2e8f0';

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{cfg.progress}/{TOTAL_STEPS}</span>
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, onPageChange, label }) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-500">
        Mostrando {start} a {end} de {total} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 hover:bg-slate-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 hover:bg-slate-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupFinancialAnalysesTab({ groupId, tenantId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialParams = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(initialParams.get('financial_search') || '');
  const [filterStatus, setFilterStatus] = useState(initialParams.get('financial_status') || '');
  const [showArchived, setShowArchived] = useState(initialParams.get('financial_archived') === '1');
  const [page, setPage] = useState(Number(initialParams.get('financial_page')) || 1);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    search ? params.set('financial_search', search) : params.delete('financial_search');
    filterStatus ? params.set('financial_status', filterStatus) : params.delete('financial_status');
    showArchived ? params.set('financial_archived', '1') : params.delete('financial_archived');
    page > 1 ? params.set('financial_page', String(page)) : params.delete('financial_page');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [search, filterStatus, showArchived, page]);

  // Unificação FASE 2: "Nova Análise" cria um draft mínimo e navega direto
  // para a tela de definição (FinancialDiagnosisDetail · etapa "estrutura").
  // A seleção de entidades e configuração de períodos acontece lá, inline.
  const handleNewAnalysis = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await base44.entities.FinancialDiagnosis.create({
        tenant_id: tenantId,
        group_id: groupId,
        scope_level: 'group',
        analysis_type: 'individual',
        title: 'Nova análise financeira',
        status: 'draft',
      });
      queryClient.invalidateQueries({ queryKey: groupKey(tenantId, groupId, 'financial-analyses') });
      navigate(createPageUrl(`FinancialDiagnosisDetail?id=${created.id}`));
    } catch (e) {
      alert('Erro ao criar análise: ' + (e.message || JSON.stringify(e)));
    } finally {
      setCreating(false);
    }
  };

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'financial-analyses'),
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ group_id: groupId }, '-created_date', 100),
    enabled: !!groupId,
  });

  const { data: companiesRaw = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'companies'),
    queryFn: () => base44.entities.Company.filter({ group_id: groupId }, 'name', 200),
    enabled: !!groupId,
  });
  const companies = companiesRaw.filter((c) => !c.is_archived);
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));

  const { data: allUnitsRaw = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'units', companies.map((c) => c.id).join('|')),
    queryFn: async () => {
      if (!companies.length) return [];
      const batches = await Promise.all(
        companies.map((c) => base44.entities.OperationalUnit.filter({ company_id: c.id }, 'name', 200).catch(() => []))
      );
      return batches.flat();
    },
    enabled: !!groupId && companies.length > 0,
  });

  const filtered = useMemo(() => {
    let list = analyses.filter((d) => showArchived ? true : d.status !== 'archived' && !d.is_archived);
    if (filterStatus) list = list.filter((d) => d.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => {
        const company = d.company_id ? companyMap[d.company_id] : null;
        const companyName = company?.trade_name || company?.name || '';
        return d.title?.toLowerCase().includes(q) || companyName.toLowerCase().includes(q);
      });
    }
    return list;
  }, [analyses, filterStatus, search, showArchived, companyMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const uniqueStatuses = [...new Set(analyses.map((d) => d.status).filter(Boolean))];

  const handleDelete = async (d) => {
    if (!confirm(`Excluir a análise "${d.title}"? Esta ação não pode ser desfeita.`)) return;
    await base44.entities.FinancialDiagnosis.delete(d.id);
    queryClient.invalidateQueries({ queryKey: groupKey(tenantId, groupId, 'financial-analyses') });
  };

  const handleArchive = async (d) => {
    await base44.entities.FinancialDiagnosis.update(d.id, { is_archived: true, status: 'archived' });
    queryClient.invalidateQueries({ queryKey: groupKey(tenantId, groupId, 'financial-analyses') });
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Análise Financeira</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie os planos de contas reutilizáveis e as análises financeiras criadas no sistema.
        </p>
      </div>

      {/* ── Section 1: Análises Financeiras ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Análises Financeiras</h2>
          <PermissionGuard area="diagnosis">
          <Button
            onClick={handleNewAnalysis}
            disabled={creating}
            className="text-white gap-1.5 hover:opacity-90"
            style={{ background: '#2563eb' }}
            size="sm"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nova Análise Financeira
          </Button>
          </PermissionGuard>
        </div>

        <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar análise..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="h-9 text-sm border border-slate-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{STATUS_MAP[s]?.label || s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`h-9 text-sm px-3 rounded-lg border flex items-center gap-1.5 transition-colors ${
              showArchived ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-500 bg-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
          </button>
        </div>

        {isLoading ? (
          <div className="px-5 py-4 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16 px-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-slate-100">
              <TrendingUp className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nenhuma análise financeira encontrada</p>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs mx-auto">
              Crie uma nova análise financeira para importar balancetes e gerar demonstrações.
            </p>
            <PermissionGuard area="diagnosis">
            <Button size="sm" className="text-white gap-1.5 hover:opacity-90" style={{ background: '#2563eb' }} onClick={handleNewAnalysis} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nova Análise Financeira
            </Button>
            </PermissionGuard>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-white">Análise</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-white whitespace-nowrap">Período</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-white">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-white">Progresso</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-white">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((d) => {
                  const company = d.company_id ? companyMap[d.company_id] : null;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => navigate(createPageUrl(`FinancialDiagnosisDetail?id=${d.id}`))}
                      className="cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 whitespace-normal break-words">{d.title}</p>
                            {company && (
                              <p className="text-xs text-slate-400 truncate">{company.trade_name || company.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {fmtPeriodRange(d)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusDot diagnosis={d} />
                      </td>
                      <td className="px-5 py-3">
                        <ProgressCell diagnosis={d} />
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => navigate(createPageUrl(`FinancialDiagnosisDetail?id=${d.id}`))}>
                              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <PermissionGuard area="diagnosis">
                            <DropdownMenuItem onClick={() => handleArchive(d)} className="text-amber-600">
                              <Archive className="w-3.5 h-3.5 mr-2" /> Arquivar
                            </DropdownMenuItem>
                            </PermissionGuard>
                            <PermissionGuard area="diagnosis" requireDelete>
                            <DropdownMenuItem onClick={() => handleDelete(d)} className="text-red-600">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                            </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              label="análises"
            />
          </>
        )}
      </div>

      {/* ── Section 2: Planos de Contas ── */}
      <GroupAccountPlansTab groupId={groupId} tenantId={tenantId} />

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600">
          Dica: mantenha planos de contas bem estruturados e acompanhe o progresso das análises para uma gestão eficiente.
        </p>
      </div>

    </div>
  );
}