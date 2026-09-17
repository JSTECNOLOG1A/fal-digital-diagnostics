/**
 * FinancialAccountPlanManager — v3
 * Gerenciamento de Planos de Contas Gerenciais (PCG).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { clarity, CLARITY_FEATURES } from '@/api/clarityClient';
import { useTenant } from '@/components/shared/TenantContext';
import {
  buildAccountLevelMap,
  sortPlanLinesLikeChartOfAccounts,
  withCanonicalChartOrder,
  normalizeAccountCode,
  buildAccountChildrenMap,
  allExpandableAccountCodes,
  filterCollapsedTreeLines,
} from '@/lib/accountPlanHierarchy';
import { resolveAccountTypeFromImport } from '@/lib/accountType';
import { refreshAccountPlanFromProtheus } from '@/lib/refreshAccountPlanFromProtheus';
import { replaceAccountPlanLines } from '@/lib/replaceAccountPlanLines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, ChevronRight, ChevronDown, ArrowLeft, FileSpreadsheet,
  Check, AlertCircle, Loader2, Trash2, BookOpen, Copy, Download, RefreshCw,
  ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';

// ─── Colunas aceitas na importação (v3) ───────────────────────────────────────
const PCG_COLUMNS = [
  { col: 'account_code',        name: 'Código da Conta',                    example: '1.1.01.01.0001',                  required: true },
  { col: 'account_description', name: 'Descrição da Conta',                 example: 'Caixa e Equivalentes',            required: true },
  { col: 'account_type',        name: 'Tipo — A/S ou 1/2 (Protheus: 1=Sintética, 2=Analítica)', example: 'A ou 2',    required: true, highlight: true },
  { col: 'parent_account_code', name: 'Conta pai (opcional — hierarquia)',  example: '1.1.01',                          required: false, highlight: true },
  { col: 'classification',      name: 'Classificação Gerencial',            example: 'Ativo Circulante',                required: false, highlight: true },
  { col: 'statement_code',      name: 'Demonstrativo (BP / DRE / DFC)',     example: 'BP',                              required: false },
  { col: 'ebitda_component',    name: 'Componente EBITDA',                  example: 'receita_bruta',                   required: false, highlight: true },
  { col: 'dfc_classification',  name: 'Classificação DFC',                  example: 'dfc_op_var_contas_receber',       required: false, highlight: true },
];

// ─── ColumnGuide ──────────────────────────────────────────────────────────────
function ColumnGuide() {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const header = PCG_COLUMNS.map(c => c.col).join('\t');
    navigator.clipboard.writeText(header).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadTemplate = async () => {
    // @ts-ignore - URL import cannot be resolved by tsc
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const headers = PCG_COLUMNS.map(c => c.col);
    const example = PCG_COLUMNS.map(c => c.example);
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas');
    XLSX.writeFile(wb, 'modelo_plano_de_contas.xlsx');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">A primeira linha deve ser o cabeçalho. Use apenas as colunas listadas abaixo.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={{ background: '#fff', color: 'var(--fal-text-secondary)', borderColor: 'var(--fal-border-medium)' }}
          >
            <Download className="w-3.5 h-3.5" /> Baixar modelo Excel
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={copied
              ? { background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)', borderColor: 'var(--fal-success-border)' }
              : { background: '#fff', color: 'var(--fal-text-secondary)', borderColor: 'var(--fal-border-medium)' }}
          >
            {copied
              ? <><Check className="w-3.5 h-3.5" /> Copiado!</>
              : <><Copy className="w-3.5 h-3.5" /> Copiar cabeçalhos</>}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-800">
              <th className="px-3 py-2 text-left font-semibold text-white border border-slate-800">Cabeçalho (col. Excel)</th>
              <th className="px-3 py-2 text-left font-semibold text-white border border-slate-800">Campo</th>
              <th className="px-3 py-2 text-left font-semibold text-white border border-slate-800">Exemplo</th>
              <th className="px-3 py-2 text-left font-semibold text-white border border-slate-800">Obrig.</th>
            </tr>
          </thead>
          <tbody>
            {PCG_COLUMNS.map(c => (
              <tr key={c.col} className="border-b border-slate-100">
                <td className={`px-3 py-1.5 font-bold border border-slate-200 ${c.highlight ? 'text-amber-700' : 'text-blue-600'}`}>{c.col}</td>
                <td className="px-3 py-1.5 text-slate-700 border border-slate-200">{c.name}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500 border border-slate-200">{c.example}</td>
                <td className="px-3 py-1.5 text-center border border-slate-200">
                  {c.required
                    ? <span className="text-red-500 font-bold">Sim</span>
                    : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CreatePlanDialog ─────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.tenantId
 * @param {any=} props.onCreated
 */
function CreatePlanDialog({ open, onClose, tenantId, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', version: 'v1.0', is_default: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.FinancialAccountPlan.create({
        tenant_id: tenantId,
        name: form.name.trim(),
        description: form.description,
        version: form.version,
        is_active: true,
        is_default: form.is_default,
      });
      onCreated(created);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Plano de Contas</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Padrão Agro 2024" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" />
          </div>
          <div>
            <Label>Versão</Label>
            <Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="v1.0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ImportLinesPanel ─────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.plan
 * @param {any=} props.tenantId
 * @param {any=} props.onImported
 */
function ImportLinesPanel({ plan, tenantId, onImported }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async (selectedFile) => {
    const f = selectedFile || file;
    if (!f) return;
    setFile(f);
    setImporting(true);
    setResult(null);
    setError(null);

    try {
      // @ts-ignore - URL import cannot be resolved by tsc
      const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const arrayBuffer = await f.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'contas')
        || workbook.SheetNames.find(n => n.toLowerCase() === 'balancete')
        || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) throw new Error('Arquivo vazio ou sem dados.');

      const normalizeCode = (code) => String(code || '').replace(/\./g, '').trim();
      const str = (v) => String(v ?? '').trim();

      const get = (row, ...keys) => {
        for (const k of keys) {
          const normalize = (s) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          const normalized_k = normalize(k);
          const found = Object.keys(row).find(rk => normalize(rk) === normalized_k);
          if (found && str(row[found])) return str(row[found]);
        }
        return '';
      };

      const linesToCreate = [];
      const skipped = [];
      for (const row of rawRows) {
        const code = get(row, 'account_code');
        const name = get(row, 'account_description', 'account_name');
        const typeRaw = get(row, 'account_type', 'tipo', 'type', 'classe', 'ct1_classe');
        if (!code || !name) {
          skipped.push('código/descrição ausentes');
          continue;
        }
        const accountType = resolveAccountTypeFromImport(typeRaw);
        if (!accountType) {
          skipped.push(`${code}: tipo obrigatório (A/S ou 1/2)`);
          continue;
        }
        const parentRaw = get(
          row,
          'parent_account_code',
          'conta_pai',
          'superior',
          'account_parent',
          'parent',
        );
        const parentCode = normalizeAccountCode(parentRaw);
        const codeNorm = normalizeCode(code);
        linesToCreate.push({
          account_plan_id: plan.id,
          tenant_id: tenantId,
          account_code:         codeNorm,
          account_code_display: code,
          account_name:         name,
          account_type:         accountType,
          parent_account_code:  parentCode && parentCode !== codeNorm ? parentCode : '',
          classification:       get(row, 'classification', 'classificacao', 'rubrica') || '',
          statement_code:       get(row, 'statement_code') || 'NAO_CLASSIFICADO',
          ebitda_component:     get(row, 'ebitda_component') || '',
          dfc_classification:   get(row, 'dfc_classification') || '',
          is_active: true,
          notes: parentCode && parentCode !== codeNorm ? `pai:${parentCode}` : '',
        });
      }

      if (linesToCreate.length === 0) {
        const sample = rawRows[0] ? JSON.stringify(Object.keys(rawRows[0])) : 'vazio';
        throw new Error(
          `Nenhuma conta válida. Exija account_code, account_description e account_type (A/S ou 1/2 Protheus). Colunas: ${sample}` +
          (skipped.length ? ` · ${skipped.slice(0, 3).join('; ')}` : ''),
        );
      }

      const orderedLines = withCanonicalChartOrder(linesToCreate);
      await replaceAccountPlanLines({
        planId: plan.id,
        tenantId,
        lines: orderedLines,
      });
      setResult({ count: orderedLines.length, skipped: skipped.length });
      onImported();
    } catch (e) {
      setError(e.message || 'Erro ao importar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-800">Importar contas via Excel</p>
        <p className="text-xs text-blue-700">
          O arquivo deve ter uma aba <strong>Contas</strong> (ou a primeira aba) com os dados. A primeira linha deve ser o cabeçalho.
        </p>
        <ColumnGuide />
      </div>

      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer
        ${importing ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50'}`}>
        <FileSpreadsheet className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-600">
          {file ? file.name : 'Clique para selecionar o arquivo Excel'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {importing ? 'Importando...' : '.xlsx · o import inicia automaticamente'}
        </p>
        <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
          onChange={e => handleImport(e.target.files?.[0] || null)} />
      </label>

      {importing && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          Processando arquivo...
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <Check className="w-4 h-4 flex-shrink-0" />
          <strong>{result.count}</strong> conta(s) importada(s) com sucesso.
          {result.skipped > 0 ? ` (${result.skipped} linha(s) ignorada(s) sem tipo válido)` : ''}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ─── PlanLinesView ─────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.plan
 * @param {any=} props.tenantId
 */
function PlanLinesView({ plan, tenantId }) {
  const queryClient = useQueryClient();
  const { data: lines = [], isLoading, refetch } = useQuery({
    queryKey: ['pcg-lines', plan.id, tenantId],
    queryFn: () => base44.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: plan.id, tenant_id: tenantId }, 'account_code', 5000
    ),
    enabled: !!plan.id && !!tenantId,
    staleTime: 0,
  });

  const protheusEnabled = CLARITY_FEATURES.useClarityProtheus;
  const { data: protheusConn } = useQuery({
    queryKey: ['protheus-connection', tenantId],
    queryFn: () => clarity.getProtheusConnection(tenantId),
    enabled: !!tenantId && protheusEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const canRefreshProtheus = protheusEnabled && !!protheusConn?.isActive;

  const [tab, setTab] = useState('import');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState(() => new Set());

  const levelMap = useMemo(() => buildAccountLevelMap(lines), [lines]);
  const childrenMap = useMemo(() => buildAccountChildrenMap(lines), [lines]);

  useEffect(() => {
    setExpandedCodes(allExpandableAccountCodes(buildAccountChildrenMap(lines)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, lines.length]);

  const filtered = sortPlanLinesLikeChartOfAccounts(
    lines.filter(l =>
      !search ||
      l.account_code?.includes(search) ||
      l.account_name?.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  const hasSearch = !!search.trim();
  const visibleRows = useMemo(() => {
    if (hasSearch) return filtered;
    return filterCollapsedTreeLines(filtered, childrenMap, expandedCodes);
  }, [filtered, childrenMap, expandedCodes, hasSearch]);

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
      await queryClient.invalidateQueries({ queryKey: ['pcg-lines', plan.id, tenantId] });
      await refetch();
      if (deleted > 0) {
        const msg = `✓ ${deleted} conta(s) removida(s) com sucesso`;
        alert(failed > 0 ? `${msg}\n⚠ ${failed} exclusão(ões) falharam.` : msg);
      } else if (failed > 0) {
        alert(`⚠ Nenhuma conta foi removida. ${failed} exclusão(ões) falharam.`);
      } else {
        alert('Nenhuma conta foi removida.');
      }
    } catch (e) {
      alert(`Erro ao remover contas: ${e.message || e.response?.data?.error}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshProtheus = async () => {
    if (!canRefreshProtheus) {
      alert('Configure a conexão Protheus em Integrações antes de atualizar.');
      return;
    }
    if (!window.confirm(
      `Atualizar “${plan.name}” com o plano de contas atual do Protheus?\n\n` +
      'Código, nome e tipo (S/A) serão sincronizados. Mapeamentos BP/DRE/DFC/EBITDA já feitos serão preservados.',
    )) return;

    setRefreshing(true);
    try {
      const result = await refreshAccountPlanFromProtheus({
        planId: plan.id,
        tenantId,
        existingLines: lines,
      });
      await queryClient.invalidateQueries({ queryKey: ['pcg-lines', plan.id, tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['financial-account-plans', tenantId] });
      await refetch();
      setTab('lines');
      alert(
        `Plano atualizado (sem duplicar): ${result.count} conta(s).\n` +
        `+${result.added} novas · ${result.updated} atualizadas · −${result.removed} removidas no Protheus`,
      );
    } catch (err) {
      alert(`Falha ao atualizar do Protheus: ${err?.message || err}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'import', label: 'Importar Excel' },
          { key: 'lines', label: 'Plano de Contas' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'import' && (
        <ImportLinesPanel plan={plan} tenantId={tenantId} onImported={refetch} />
      )}

      {tab === 'lines' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Buscar por código ou nome da conta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={expandAll}
              disabled={hasSearch || childrenMap.size === 0}
              className="gap-1.5 shrink-0"
              title="Expandir toda a hierarquia"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              Expandir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={collapseAll}
              disabled={hasSearch || childrenMap.size === 0}
              className="gap-1.5 shrink-0"
              title="Recolher até as contas raiz"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
              Recolher
            </Button>
            {protheusEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshProtheus}
                disabled={refreshing || !canRefreshProtheus}
                className="gap-1.5 shrink-0"
                title={canRefreshProtheus ? 'Buscar contas atuais no Protheus' : 'Configure a conexão em Integrações'}
              >
                {refreshing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {refreshing ? 'Atualizando…' : 'Atualizar do Protheus'}
              </Button>
            )}
            {lines.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll} disabled={deleting || refreshing}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Removendo...' : `Limpar tudo (${lines.length})`}
              </Button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando contas...</p>
          ) : lines.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conta cadastrada neste plano.</p>
              <p className="text-xs mt-1">Use a aba "Importar Excel" para adicionar contas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">account_code</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-white">account_type</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">account_description</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">classification</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">statement_code</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">ebitda_component</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-white">dfc_classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map(l => {
                      const isSintetica = l.account_type === 'sintetica';
                      const codeKey = l.account_code_display || l.account_code || '';
                      const codeNorm = normalizeAccountCode(l.account_code || codeKey);
                      const level = levelMap.get(codeKey) || levelMap.get(l.account_code) || 1;
                      const indent = Math.max(0, level - 1) * 12;
                      const hasChildren = (childrenMap.get(codeNorm) || []).length > 0;
                      const isExpanded = expandedCodes.has(codeNorm);
                      return (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-blue-700 text-[10px]" style={{ paddingLeft: 8 + indent }}>
                            <span className="inline-flex items-center gap-0.5">
                              {hasChildren && !hasSearch ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(codeNorm)}
                                  className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-slate-200 text-slate-500"
                                  title={isExpanded ? 'Recolher' : 'Expandir'}
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
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold
                              ${isSintetica ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                              {isSintetica ? 'S' : 'A'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 text-[10px] max-w-xs truncate" style={{ paddingLeft: 12 + indent, fontWeight: level <= 2 ? 600 : 400 }} title={l.account_name}>{l.account_name}</td>
                          <td className="px-3 py-2 text-slate-600 text-[10px]">{l.classification || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block
                              ${l.statement_code === 'BP' ? 'bg-blue-100 text-blue-700' :
                                l.statement_code === 'DRE' ? 'bg-emerald-100 text-emerald-700' :
                                l.statement_code === 'DFC' ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-500'}`}>
                              {l.statement_code || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px]">
                            {l.ebitda_component
                              ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-bold">{l.ebitda_component}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[10px]">{l.dfc_classification || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 px-3 py-2 border-t border-slate-100">
                Exibindo {visibleRows.length} de {lines.length} conta(s)
                {!hasSearch && visibleRows.length < filtered.length
                  ? ` · ${filtered.length - visibleRows.length} recolhida(s)`
                  : ''}
                {' '}· Clique na seta para expandir/recolher
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FinancialAccountPlanManager() {
  const { user, tenantId: ctxTenantId } = useTenant();
  const tenantId = ctxTenantId || user?.tenant_id;
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['account-plans', tenantId],
    queryFn: () => base44.entities.FinancialAccountPlan.filter(
      { tenant_id: tenantId }, 'name', 100
    ),
    enabled: !!tenantId,
    staleTime: 0,
  });

  const handlePlanCreated = (plan) => {
    queryClient.invalidateQueries({ queryKey: ['account-plans', tenantId] });
    setCreateDialog(false);
    setSelectedPlan(plan);
  };

  const handleDeletePlan = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir o plano "${selectedPlan.name}" PERMANENTEMENTE?`)) return;
    setDeletingPlan(true);
    setDeleteError(null);
    try {
      await base44.functions.invoke('deleteAccountPlan', {
        account_plan_id: selectedPlan.id,
        tenant_id: tenantId,
      });
      queryClient.invalidateQueries({ queryKey: ['account-plans', tenantId] });
      setSelectedPlan(null);
    } catch (e) {
      setDeleteError(e.response?.data?.error || e.message || 'Erro ao excluir plano');
    } finally {
      setDeletingPlan(false);
    }
  };

  if (!selectedPlan) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Planos de Contas Gerenciais</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie os planos de contas utilizados nos Diagnósticos Financeiros.
            </p>
          </div>
          <Button onClick={() => setCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Novo Plano
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum plano de contas cadastrado</p>
            <p className="text-xs mt-1 mb-4">Crie o primeiro plano para vincular aos diagnósticos financeiros.</p>
            <Button onClick={() => setCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Criar Primeiro Plano
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <Card key={plan.id} className="border-0 shadow-sm rounded-xl hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedPlan(plan)}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                        {plan.is_default && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Padrão</Badge>}
                        {!plan.is_active && <Badge className="bg-slate-100 text-slate-500 text-[10px]">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {plan.version && <span className="mr-2">v{plan.version}</span>}
                        {plan.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <CreatePlanDialog
          open={createDialog}
          onClose={() => setCreateDialog(false)}
          tenantId={tenantId}
          onCreated={handlePlanCreated}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Planos de Contas
        </button>
        <Button size="sm" variant="destructive" onClick={handleDeletePlan} disabled={deletingPlan} className="gap-1.5">
          {deletingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Excluir plano
        </Button>
      </div>

      {deleteError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {deleteError}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-900 to-slate-800 rounded-2xl p-6 mb-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-700/50 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {selectedPlan.is_default && <Badge className="bg-blue-600 text-white text-[10px]">Padrão</Badge>}
              {selectedPlan.version && (
                <span className="text-[10px] bg-blue-800/60 border border-blue-600 text-blue-300 px-2 py-0.5 rounded font-bold">
                  {selectedPlan.version}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{selectedPlan.name}</h1>
            {selectedPlan.description && (
              <p className="text-sm text-blue-300 mt-0.5">{selectedPlan.description}</p>
            )}
          </div>
        </div>
      </div>

      {tenantId
        ? <PlanLinesView plan={selectedPlan} tenantId={tenantId} />
        : <p className="text-center text-slate-400 py-6">Carregando contexto...</p>}
    </div>
  );
}