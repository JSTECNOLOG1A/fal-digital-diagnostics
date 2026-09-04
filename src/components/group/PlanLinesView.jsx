/**
 * PlanLinesView
 * Visualização e edição inline das contas de um Plano de Contas Gerencial.
 * Cada coluna de mapeamento é editável via click-to-edit (select ou texto).
 * Filtros por coluna + busca global.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { clarity, CLARITY_FEATURES } from '@/api/clarityClient';
import { buildAccountLevelMap, sortPlanLinesLikeChartOfAccounts, normalizeAccountCode, buildAccountChildrenMap, allExpandableAccountCodes, filterCollapsedTreeLines } from '@/lib/accountPlanHierarchy';
import { refreshAccountPlanFromProtheus } from '@/lib/refreshAccountPlanFromProtheus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, Loader2, Trash2, BookOpen, ArrowLeft, X, ChevronDown, ChevronRight, RefreshCw, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';

// ─── Configuração das colunas editáveis ──────────────────────────────────────
const EDITABLE_COLS = [
  {
    key: 'classification',
    label: 'Classificação',
    type: 'select',
    options: [], // populado dinamicamente via valores únicos no ColFilter
    badgeClass: 'bg-slate-100 text-slate-600',
  },
  {
    key: 'statement_code',
    label: 'Demonstrativo',
    type: 'select',
    options: [
      { value: '', label: '— limpar —' },
      { value: 'BP', label: 'BP' },
      { value: 'DRE', label: 'DRE' },
      { value: 'DFC', label: 'DFC' },
      { value: 'NAO_CLASSIFICADO', label: 'NAO_CLASSIFICADO' },
    ],
    badge: (v) => {
      const map = { BP: 'bg-blue-100 text-blue-700', DRE: 'bg-emerald-100 text-emerald-700', DFC: 'bg-purple-100 text-purple-700' };
      return map[v] || 'bg-slate-100 text-slate-500';
    },
  },
  {
    key: 'bp_group',
    label: 'Grupo BP',
    type: 'select',
    options: [
      { value: '', label: '— limpar —' },
      { value: 'ativo_circulante', label: 'ativo_circulante' },
      { value: 'ativo_nao_circulante', label: 'ativo_nao_circulante' },
      { value: 'passivo_circulante', label: 'passivo_circulante' },
      { value: 'passivo_nao_circulante', label: 'passivo_nao_circulante' },
      { value: 'patrimonio_liquido', label: 'patrimonio_liquido' },
    ],
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'ebitda_component',
    label: 'EBITDA',
    type: 'select',
    options: [
      { value: '', label: '— limpar —' },
      { value: 'receita_bruta', label: 'receita_bruta' },
      { value: 'deducoes_receita', label: 'deducoes_receita' },
      { value: 'custos', label: 'custos' },
      { value: 'despesas_operacionais', label: 'despesas_operacionais' },
      { value: 'outras_receitas_despesas', label: 'outras_receitas_despesas' },
      { value: 'excluir', label: 'excluir' },
    ],
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  { key: 'canonical_key', label: 'Chave Canônica', type: 'text' },
  { key: 'dfc_classification', label: 'DFC', type: 'text' },
  // Coluna "Sinal" (sign_rule) removida propositalmente: o sinal apresentado nas
  // demonstrações é 100% automático (ver applySign() em buildFinancialStatements),
  // derivado do sinal original do balancete + do demonstrativo (Ativo mantém,
  // Passivo/PL e DRE invertem). Não existe controle manual por conta — expor esse
  // campo aqui sugeria (incorretamente) que ele era editável e usado no cálculo.
];

// ─── Célula editável ──────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.line
 * @param {any=} props.col
 * @param {any=} props.onSaved
 * @param {any=} props.allLines
 */
function EditableCell({ line, col, onSaved, allLines = [] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(line[col.key] || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setValue(line[col.key] || ''); }, [line, col.key]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // posiciona cursor no final do texto
      const len = inputRef.current.value?.length || 0;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const save = async (newVal) => {
    const finalVal = newVal !== undefined ? newVal : value;
    if (finalVal === (line[col.key] || '')) { setEditing(false); return; }
    setSaving(true);
    try {
      await base44.entities.FinancialAccountPlanLine.update(line.id, { [col.key]: finalVal || null });
      onSaved(line.id, col.key, finalVal);
    } catch (err) {
      window.alert(`Não foi possível salvar: ${err?.message || err}`);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const currentVal = line[col.key];

  if (col.type === 'select') {
    // Para colunas com options dinâmicas (ex: classification), deriva dos dados existentes
    const resolvedOptions = col.options.length > 0
      ? col.options
      : [
          { value: '', label: '— limpar —' },
          ...Array.from(new Set(allLines.map((l) => l[col.key]).filter(Boolean))).sort()
            .map((v) => ({ value: v, label: v })),
        ];

    if (editing) {
      return (
        <td className="px-2 py-1" style={{ minWidth: 160 }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <select
              className="text-[11px] border rounded px-1.5 py-0.5 outline-none flex-1"
              style={{ borderColor: 'var(--fal-green-400)', background: '#fff', minWidth: 130 }}
              value={value}
              autoFocus
              onChange={(e) => {
                const next = e.target.value;
                setValue(next);
                save(next);
              }}
              onBlur={() => {
                // delay: evita fechar antes do onChange no clique da opção
                window.setTimeout(() => setEditing(false), 120);
              }}
            >
              {resolvedOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {saving && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: 'var(--fal-green-500)' }} />}
          </div>
        </td>
      );
    }
    const badgeClass = col.badge ? col.badge(currentVal) : (col.badgeClass || 'bg-slate-100 text-slate-500');
    return (
      <td className="px-2 py-1 cursor-pointer group" title="Clique para editar" onClick={() => setEditing(true)}>
        <div className="flex items-center gap-1">
          {currentVal
            ? <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${badgeClass}`}>{currentVal}</span>
            : <span className="text-[10px]" style={{ color: 'var(--fal-border-medium)' }}>—</span>}
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" style={{ color: 'var(--fal-text-muted)' }} />
        </div>
      </td>
    );
  }

  // type === 'text'
  if (editing) {
    return (
      <td className="px-2 py-1" style={{ minWidth: 180 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            className="text-[11px] border rounded px-1.5 py-0.5 outline-none w-full"
            style={{ borderColor: 'var(--fal-green-400)', minWidth: 150 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={() => save()}
          />
          {saving && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: 'var(--fal-green-500)' }} />}
        </div>
      </td>
    );
  }

  return (
    <td className="px-2 py-1 cursor-pointer group" title="Clique para editar" onClick={() => setEditing(true)}>
      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: currentVal ? 'var(--fal-text-muted)' : 'var(--fal-border-medium)' }}>
          {currentVal || '—'}
        </span>
        <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" style={{ color: 'var(--fal-text-muted)' }} />
      </div>
    </td>
  );
}

// ─── Filtro por coluna ────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.col
 * @param {any=} props.lines
 * @param {any=} props.value
 * @param {any=} props.onChange
 */
function ColFilter({ col, lines, value, onChange }) {
  const unique = Array.from(new Set(lines.map((l) => l[col.key] || ''))).sort();

  if (col.type === 'text') {
    return (
      <input
        className="text-[10px] border rounded px-1.5 py-0.5 w-full outline-none"
        style={{ borderColor: 'var(--fal-border-medium)' }}
        placeholder="Filtrar..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <select
      className="text-[10px] border rounded px-1 py-0.5 w-full outline-none"
      style={{ borderColor: 'var(--fal-border-medium)', background: '#fff' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todos</option>
      {unique.map((v) => (
        <option key={v} value={v}>{v || '(vazio)'}</option>
      ))}
    </select>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.plan
 * @param {any=} props.tenantId
 * @param {any=} props.onBack
 * @param {any=} props.onImportTab
 */
export default function PlanLinesView({ plan, tenantId, onBack, onImportTab }) {
  const queryClient = useQueryClient();

  const { data: lines = [], isLoading, refetch } = useQuery({
    queryKey: ['pcg-lines', plan.id, tenantId],
    queryFn: () => base44.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: plan.id, tenant_id: tenantId }, 'account_code', 5000
    ),
    enabled: !!plan.id && !!tenantId,
  });

  const protheusEnabled = CLARITY_FEATURES.useClarityProtheus;
  const { data: protheusConn } = useQuery({
    queryKey: ['protheus-connection', tenantId],
    queryFn: () => clarity.getProtheusConnection(tenantId),
    enabled: !!tenantId && protheusEnabled,
    staleTime: 60_000,
    retry: false,
  });

  const [localLines, setLocalLines] = useState([]);
  useEffect(() => {
    setLocalLines(
      (lines || []).map((l) => {
        if (l.parent_account_code) return l;
        const m = String(l.notes || '').match(/pai:([^\s·]+)/i);
        return m ? { ...l, parent_account_code: m[1].replace(/\./g, '') } : l;
      }),
    );
  }, [lines]);

  const [planMeta, setPlanMeta] = useState({ description: plan.description, version: plan.version });
  useEffect(() => {
    setPlanMeta({ description: plan.description, version: plan.version });
  }, [plan.id, plan.description, plan.version]);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [colFilters, setColFilters] = useState(/** @type {Record<string, any>} */ ({}));
  const [deleting, setDeleting] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Códigos com filhos expandidos (árvore). */
  const [expandedCodes, setExpandedCodes] = useState(() => new Set());

  const setColFilter = (key, val) => setColFilters((f) => ({ ...f, [key]: val }));
  const hasActiveFilters = !!search || !!levelFilter || Object.values(colFilters).some(Boolean);
  const canRefreshProtheus = protheusEnabled && !!protheusConn?.isActive;

  const levelMap = useMemo(
    () => buildAccountLevelMap(localLines),
    [localLines],
  );

  const childrenMap = useMemo(
    () => buildAccountChildrenMap(localLines),
    [localLines],
  );

  // Ao trocar plano ou quantidade de linhas (import/limpar): começa expandido
  useEffect(() => {
    setExpandedCodes(allExpandableAccountCodes(buildAccountChildrenMap(localLines)));
    // localLines intencional só por length/plan — evita reset ao editar célula
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, localLines.length]);

  const levelOptions = useMemo(() => {
    const levels = new Set();
    for (const l of localLines) {
      const key = l.account_code_display || l.account_code || '';
      levels.add(levelMap.get(key) || levelMap.get(l.account_code) || 1);
    }
    return [...levels].sort((a, b) => a - b);
  }, [localLines, levelMap]);

  const filtered = sortPlanLinesLikeChartOfAccounts(
    localLines.filter((l) => {
      if (search) {
        const s = search.toLowerCase();
        if (!l.account_code?.includes(search) && !l.account_name?.toLowerCase().includes(s) && !l.canonical_key?.includes(s)) return false;
      }
      if (levelFilter) {
        const key = l.account_code_display || l.account_code || '';
        const lvl = levelMap.get(key) || levelMap.get(l.account_code) || 1;
        if (String(lvl) !== String(levelFilter)) return false;
      }
      for (const col of EDITABLE_COLS) {
        const fv = colFilters[col.key];
        if (!fv) continue;
        const cellVal = l[col.key] || '';
        if (col.type === 'text') { if (!cellVal.toLowerCase().includes(fv.toLowerCase())) return false; }
        else { if (cellVal !== fv) return false; }
      }
      return true;
    }),
  );

  // Com busca/filtros: mostra tudo que bate. Sem filtro: respeita expandir/recolher.
  const visibleRows = useMemo(() => {
    if (hasActiveFilters) return filtered;
    return filterCollapsedTreeLines(filtered, childrenMap, expandedCodes);
  }, [filtered, childrenMap, expandedCodes, hasActiveFilters]);

  const expandAll = () => setExpandedCodes(allExpandableAccountCodes(childrenMap));
  const collapseAll = () => setExpandedCodes(new Set());
  const toggleExpand = (code) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSaved = (id, key, val) =>
    setLocalLines((prev) => prev.map((l) => l.id === id ? { ...l, [key]: val } : l));

  const handleClearAll = async () => {
    if (!window.confirm(`Remover todas as ${lines.length} contas do plano "${plan.name}"?`)) return;
    setDeleting(true);
    try {
      const result = await base44.functions.invoke('deleteAccountPlanLines', {
        account_plan_id: plan.id,
        tenant_id: tenantId,
      });
      const deleted = result?.data?.deleted ?? result?.deleted ?? 0;
      const failed = result?.data?.failed ?? result?.failed ?? 0;
      setLocalLines([]);
      await queryClient.invalidateQueries({ queryKey: ['pcg-lines', plan.id, tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['pcg-lines-meta', plan.id] });
      await refetch();
      if (deleted > 0) {
        window.alert(`${deleted} conta(s) removida(s).`);
      } else if (failed > 0) {
        window.alert(`Falha ao remover contas (${failed}).`);
      } else {
        window.alert('Nenhuma conta foi removida. Tente recarregar a página.');
      }
    } catch (err) {
      window.alert(`Erro ao limpar contas: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshProtheus = async () => {
    if (!canRefreshProtheus) {
      window.alert('Configure a conexão Protheus em Integrações antes de atualizar.');
      return;
    }
    if (!window.confirm(
      `Atualizar “${plan.name}” com o plano de contas atual do Protheus?\n\n` +
      'As linhas atuais serão substituídas (sem duplicar o plano). ' +
      'Código, nome e tipo (S/A) serão sincronizados. Mapeamentos BP/DRE/DFC/EBITDA já feitos serão preservados.',
    )) return;

    setRefreshing(true);
    try {
      const result = await refreshAccountPlanFromProtheus({
        planId: plan.id,
        tenantId,
        existingLines: localLines,
      });
      setPlanMeta((m) => ({
        ...m,
        description: `Atualizado do Protheus em ${new Date().toLocaleString('pt-BR')} (job ${result.jobId})`,
      }));
      await queryClient.invalidateQueries({ queryKey: ['pcg-lines', plan.id, tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['pcg-group', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['financial-account-plans', tenantId] });
      await refetch();
      window.alert(
        `Plano atualizado (sem duplicar): ${result.count} conta(s).\n` +
        `+${result.added} novas · ${result.updated} atualizadas · −${result.removed} removidas no Protheus`,
      );
    } catch (err) {
      window.alert(`Falha ao atualizar do Protheus: ${err?.message || err}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!window.confirm(`Excluir permanentemente o plano "${plan.name}" e todas as suas contas?`)) return;
    setDeletingPlan(true);
    try {
      await base44.functions.invoke('deleteAccountPlan', { account_plan_id: plan.id, tenant_id: tenantId });
      await queryClient.invalidateQueries({ queryKey: ['pcg-group', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['financial-account-plans', tenantId] });
      onBack();
    } catch (err) {
      window.alert(`Erro ao excluir plano: ${err?.message || err}`);
    } finally {
      setDeletingPlan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--fal-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fal-text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fal-text-muted)'}>
          <ArrowLeft className="w-3.5 h-3.5" /> Planos de Contas
        </button>
        <div className="flex items-center gap-2">
          {onImportTab && (
            <Button size="sm" variant="outline" onClick={onImportTab} className="gap-1.5">
              + Importar Excel
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDeletePlan} disabled={deletingPlan}
            className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5">
            {deletingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Excluir plano
          </Button>
        </div>
      </div>

      {/* Banner */}
      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, var(--fal-navy-950) 0%, var(--fal-navy-800) 100%)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(47,166,106,0.15)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--fal-green-400)' }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{plan.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--fal-text-inverse-muted)' }}>
                {planMeta.version && `${planMeta.version} · `}{planMeta.description || 'Plano de Contas Gerencial'}
              </p>
            </div>
          </div>
          {protheusEnabled && (
            <Button
              size="sm"
              disabled={refreshing || !canRefreshProtheus}
              onClick={handleRefreshProtheus}
              className="gap-1.5 shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20"
              title={canRefreshProtheus ? 'Buscar contas atuais no Protheus' : 'Configure a conexão em Integrações'}
            >
              {refreshing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {refreshing ? 'Atualizando…' : 'Atualizar do Protheus'}
            </Button>
          )}
        </div>
      </div>

      {/* Barra de busca + ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar por código, nome ou chave canônica..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <select
          className="text-xs border rounded-md px-2 py-2 outline-none shrink-0"
          style={{ borderColor: 'var(--fal-border-medium)', background: '#fff', minWidth: 120 }}
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          title="Filtrar por nível hierárquico"
        >
          <option value="">Todos os níveis</option>
          {levelOptions.map((lvl) => (
            <option key={lvl} value={String(lvl)}>Nível {lvl}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={expandAll}
          className="gap-1.5 shrink-0"
          title="Expandir toda a hierarquia"
          disabled={hasActiveFilters || childrenMap.size === 0}
        >
          <ChevronsUpDown className="w-3.5 h-3.5" />
          Expandir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={collapseAll}
          className="gap-1.5 shrink-0"
          title="Recolher até as contas raiz"
          disabled={hasActiveFilters || childrenMap.size === 0}
        >
          <ChevronsDownUp className="w-3.5 h-3.5" />
          Recolher
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setLevelFilter(''); setColFilters({}); }} className="gap-1.5 shrink-0">
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </Button>
        )}
        {localLines.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearAll} disabled={deleting || refreshing}
            className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Removendo...' : `Limpar (${localLines.length})`}
          </Button>
        )}
      </div>

      {/* Aviso filtros ativos */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)', border: '1px solid var(--fal-current-border)' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Exibindo <strong className="mx-1">{filtered.length}</strong> de <strong className="mx-1">{localLines.length}</strong> contas com filtros ativos.
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--fal-text-muted)' }}>Carregando contas...</p>
      ) : localLines.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ border: '2px dashed var(--fal-border-medium)', background: 'var(--fal-bg-soft)' }}>
          <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-30" style={{ color: 'var(--fal-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--fal-text-muted)' }}>Nenhuma conta cadastrada. Use "Importar Excel" para adicionar contas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--fal-border-soft)' }}>
          <table className="w-full text-xs whitespace-nowrap">
            <thead style={{ background: 'var(--table-header-bg)' }}>
              {/* Títulos */}
              <tr>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--table-header-fg)' }}>Código</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--table-header-fg)' }}>Tipo</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--table-header-fg)', minWidth: 180 }}>Descrição</th>
                {EDITABLE_COLS.map((col) => (
                  <th key={col.key} className="text-left px-2 py-2 font-semibold"
                    style={{ color: 'var(--table-header-fg)', minWidth: col.type === 'text' ? 140 : 130 }}>
                    {col.label}
                  </th>
                ))}
              </tr>
              {/* Filtros por coluna */}
              <tr style={{ borderTop: '1px solid var(--fal-border-subtle)', background: 'var(--fal-bg-soft)' }}>
                <td className="px-3 pb-2 pt-1" colSpan={3}>
                  <span className="text-[10px]" style={{ color: 'var(--fal-text-light)' }}>Filtros →</span>
                </td>
                {EDITABLE_COLS.map((col) => (
                  <td key={col.key} className="px-2 pb-2 pt-1">
                    <ColFilter
                      col={col}
                      lines={localLines}
                      value={colFilters[col.key] || ''}
                      onChange={(v) => setColFilter(col.key, v)}
                    />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((l) => {
                const codeKey = l.account_code_display || l.account_code || '';
                const codeNorm = normalizeAccountCode(l.account_code || codeKey);
                const level = levelMap.get(codeKey) || levelMap.get(l.account_code) || 1;
                const indent = Math.max(0, level - 1) * 14;
                const childCodes = childrenMap.get(codeNorm) || [];
                const hasChildren = childCodes.length > 0;
                const isExpanded = expandedCodes.has(codeNorm);
                return (
                <tr key={l.id} className="border-t hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--fal-border-subtle)' }}>
                  <td className="px-3 py-1.5 font-mono text-blue-700 text-[10px]" style={{ paddingLeft: 8 + indent }}>
                    <span className="inline-flex items-center gap-0.5">
                      {hasChildren && !hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(codeNorm)}
                          className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-slate-200 text-slate-500"
                          title={isExpanded ? 'Recolher' : 'Expandir'}
                          aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="inline-block w-4 h-4" />
                      )}
                      {l.account_code}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-flex items-center justify-center w-5 h-4 rounded text-[10px] font-bold
                      ${l.account_type === 'sintetica' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {l.account_type === 'sintetica' ? 'S' : 'A'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[10px] max-w-[220px] truncate"
                    style={{
                      color: 'var(--fal-text-secondary)',
                      paddingLeft: 12 + indent,
                      fontWeight: level === 1 ? 700 : level === 2 ? 600 : 400,
                    }}
                    title={l.account_name}>
                    {l.account_name}
                  </td>
                  {EDITABLE_COLS.map((col) => (
                    <EditableCell key={col.key} line={l} col={col} onSaved={handleSaved} allLines={localLines} />
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] px-3 py-2 border-t" style={{ color: 'var(--fal-text-light)', borderColor: 'var(--fal-border-subtle)' }}>
            Exibindo {visibleRows.length} de {localLines.length} conta(s)
            {!hasActiveFilters && visibleRows.length < filtered.length
              ? ` · ${filtered.length - visibleRows.length} recolhida(s)`
              : ''}
            {' '}· Clique na seta para expandir/recolher · Clique em qualquer célula de mapeamento para editar
          </p>
        </div>
      )}
    </div>
  );
}