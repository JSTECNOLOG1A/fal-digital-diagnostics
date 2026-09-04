/**
 * GroupAccountPlansTab
 * Gerenciamento de Planos de Contas Gerenciais (PCG) no escopo de um Grupo.
 * Cada grupo visualiza e gerencia apenas os seus próprios planos.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { resolveAccountTypeFromImport } from '@/lib/accountType';
import { withCanonicalChartOrder, normalizeAccountCode } from '@/lib/accountPlanHierarchy';
import { replaceAccountPlanLines } from '@/lib/replaceAccountPlanLines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, FileSpreadsheet, Check, AlertCircle, Loader2,
  BookOpen, ArrowLeft, ChevronRight, ChevronLeft, Pencil,
  Search, MoreVertical, ExternalLink, Copy } from
'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PlanLinesViewBase from './PlanLinesView';

// ─── ColumnGuide ──────────────────────────────────────────────────────────────
const PCG_COLUMNS = [
{ col: 'account_code', name: 'Código da Conta', example: '1.1.01.01.0001', required: true },
{ col: 'account_description', name: 'Descrição da Conta', example: 'Caixa e Equivalentes', required: true },
{ col: 'account_type', name: 'Tipo — A/S ou 1/2 (Protheus: 1=Sintética, 2=Analítica)', example: 'A ou 2', required: true, highlight: true },
{ col: 'parent_account_code', name: 'Conta pai (opcional — hierarquia)', example: '1.1.01', required: false, highlight: true },
{ col: 'classification', name: 'Rubrica contábil', example: 'Ativo Circulante', required: false, highlight: true },
{ col: 'statement_code', name: 'Demonstrativo (BP / DRE / DFC)', example: 'BP', required: false },
{ col: 'bp_group', name: 'Grupo BP (ativo_circulante / ativo_nao_circulante / passivo_circulante / passivo_nao_circulante / patrimonio_liquido)', example: 'ativo_circulante', required: false, highlight: true },
{ col: 'ebitda_component', name: 'Componente EBITDA', example: 'receita_bruta', required: false, highlight: true },
{ col: 'dfc_classification', name: 'Classificação DFC', example: 'dfc_op_var_contas_receber', required: false, highlight: true },
{ col: 'canonical_key', name: 'Chave Canônica (avançado — normalmente inferida automaticamente a partir de "classification")', example: 'receita_bruta', required: false }];


// Copia uma "tabela" (array de linhas, cada linha um array de valores) para a área de
// transferência com separador de TAB entre colunas e quebra de linha entre linhas —
// formato que o Excel/Sheets reconhece ao colar, distribuindo automaticamente cada
// valor numa célula e cada linha numa linha.
async function copyToClipboardAsTable(rows) {
  const text = rows.map((row) => row.join('\t')).join('\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('Clipboard API indisponível');
  } catch (e) {
    // Fallback para navegadores/contextos sem permissão de Clipboard API
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (fallbackErr) {
      return false;
    }
  }
}

function ColumnGuide() {
  const [copied, setCopied] = useState(false);

  const handleCopyHeaders = async () => {
    // Linha 1: cabeçalho técnico (o que o parser de importação espera).
    // Linha 2: descrição de cada campo, pra lembrar o que preencher em cada coluna.
    const headerRow = PCG_COLUMNS.map((c) => c.col);
    const descriptionRow = PCG_COLUMNS.map((c) => c.name);
    const ok = await copyToClipboardAsTable([headerRow, descriptionRow]);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="overflow-x-auto text-xs">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span style={{ color: 'var(--fal-text-muted)' }}>
          Copie os cabeçalhos (com a descrição de cada campo logo abaixo) e cole na célula A1 da sua planilha — as colunas já ficam na ordem certa.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyHeaders}
          className="h-7 gap-1.5 text-xs shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado!' : 'Copiar cabeçalhos'}
        </Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: 'var(--table-header-bg)' }}>
            <th className="px-3 py-2 text-left font-semibold border" style={{ color: 'var(--table-header-fg)', borderColor: 'var(--table-header-bg)' }}>Cabeçalho (col. Excel)</th>
            <th className="px-3 py-2 text-left font-semibold border" style={{ color: 'var(--table-header-fg)', borderColor: 'var(--table-header-bg)' }}>Campo</th>
            <th className="px-3 py-2 text-left font-semibold border" style={{ color: 'var(--table-header-fg)', borderColor: 'var(--table-header-bg)' }}>Exemplo</th>
            <th className="px-3 py-2 text-left font-semibold border" style={{ color: 'var(--table-header-fg)', borderColor: 'var(--table-header-bg)' }}>Obrig.</th>
          </tr>
        </thead>
        <tbody>
          {PCG_COLUMNS.map((c) =>
          <tr key={c.col} style={{ borderBottom: '1px solid var(--fal-border-subtle)' }}>
              <td className={`px-3 py-1.5 font-bold border text-[11px] ${c.highlight ? 'text-amber-700' : 'text-blue-600'}`} style={{ borderColor: 'var(--fal-border-subtle)' }}>{c.col}</td>
              <td className="px-3 py-1.5 border text-[11px]" style={{ color: 'var(--fal-text-secondary)', borderColor: 'var(--fal-border-subtle)' }}>{c.name}</td>
              <td className="px-3 py-1.5 font-mono border text-[11px]" style={{ color: 'var(--fal-text-muted)', borderColor: 'var(--fal-border-subtle)' }}>{c.example}</td>
              <td className="px-3 py-1.5 text-center border text-[11px]" style={{ borderColor: 'var(--fal-border-subtle)' }}>
                {c.required ? <span className="text-red-500 font-bold">Sim</span> : <span style={{ color: 'var(--fal-border-medium)' }}>—</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}

// ─── CreatePlanDialog ─────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.tenantId
 * @param {any=} props.groupId
 * @param {any=} props.onCreated
 */
function CreatePlanDialog({ open, onClose, tenantId, groupId, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', version: 'v1.0' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.FinancialAccountPlan.create({
        tenant_id: tenantId,
        group_id: groupId,
        name: form.name.trim(),
        description: form.description,
        version: form.version,
        is_active: true,
        is_default: false
      });
      onCreated(created);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {if (!v) onClose();}}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Plano de Contas</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: PCG Grupo 2025" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" />
          </div>
          <div>
            <Label>Versão</Label>
            <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="v1.0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || saving}
          className="text-white gap-2" style={{ background: 'var(--fal-green-700)' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}

// ─── EditPlanDialog ───────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.plan
 * @param {any=} props.onSaved
 */
function EditPlanDialog({ open, onClose, plan, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', version: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) setForm({ name: plan.name || '', description: plan.description || '', version: plan.version || '' });
  }, [plan]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.FinancialAccountPlan.update(plan.id, {
        name: form.name.trim(),
        description: form.description,
        version: form.version
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {if (!v) onClose();}}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Plano de Contas</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: PCG Grupo 2025" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" />
          </div>
          <div>
            <Label>Versão</Label>
            <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="v1.0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || saving}
          className="text-white gap-2" style={{ background: 'var(--fal-green-700)' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

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
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'contas') ||
      workbook.SheetNames.find((n) => n.toLowerCase() === 'balancete') ||
      workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rawRows.length === 0) throw new Error('Arquivo vazio ou sem dados.');

      const normalizeCode = (code) => String(code || '').replace(/\./g, '').trim();
      const str = (v) => String(v ?? '').trim();
      const get = (row, ...keys) => {
        const normalize = (s) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => normalize(rk) === normalize(k));
          if (found && str(row[found])) return str(row[found]);
        }
        return '';
      };
      const resolveAccountType = (raw) => resolveAccountTypeFromImport(raw);

      const skipped = [];
      const linesToCreate = [];
      for (const row of rawRows) {
        const code = get(row, 'account_code');
        const name = get(row, 'account_description', 'account_name');
        const typeRaw = get(row, 'account_type', 'tipo', 'type', 'classe', 'ct1_classe');
        if (!code || !name) {
          skipped.push('código/descrição ausentes');
          continue;
        }
        const accountType = resolveAccountType(typeRaw);
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
          account_code: codeNorm,
          account_code_display: code,
          account_name: name,
          account_type: accountType,
          parent_account_code: parentCode && parentCode !== codeNorm ? parentCode : '',
          classification: get(row, 'classification', 'classificacao', 'rubrica') || '',
          statement_code: get(row, 'statement_code') || 'NAO_CLASSIFICADO',
          bp_group: get(row, 'bp_group') || '',
          ebitda_component: get(row, 'ebitda_component') || '',
          canonical_key: get(row, 'canonical_key') || '',
          dfc_classification: get(row, 'dfc_classification') || '',
          // sign_rule não é mais lido do Excel: o sinal é sempre derivado automaticamente
          // pelo motor de cálculo (applySign), nunca manual. Mantido como 'normal' fixo
          // apenas para compatibilidade com o schema existente.
          sign_rule: 'normal',
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
      setResult({
        count: orderedLines.length,
        skipped: skipped.length,
      });
      onImported();
    } catch (e) {
      setError(e.message || 'Erro ao importar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--fal-current-bg)', border: '1px solid var(--fal-current-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--fal-current-text)' }}>Importar contas via Excel</p>
        <p className="text-xs" style={{ color: 'var(--fal-current-text)' }}>
          O arquivo deve ter uma aba <strong>Contas</strong> (ou a primeira aba) com os dados. A primeira linha deve ser o cabeçalho.
        </p>
        <ColumnGuide />
      </div>

      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer
        ${importing ? 'opacity-60 cursor-not-allowed' : 'hover:border-green-400 hover:bg-green-50'}`}
      style={{ borderColor: 'var(--fal-border-medium)', background: 'var(--fal-bg-soft)' }}>
        <FileSpreadsheet className="w-8 h-8 mb-2" style={{ color: 'var(--fal-border-medium)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--fal-text-secondary)' }}>
          {file ? file.name : 'Clique para selecionar o arquivo Excel'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--fal-text-muted)' }}>
          {importing ? 'Importando...' : '.xlsx · o import inicia automaticamente'}
        </p>
        <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
        onChange={(e) => handleImport(e.target.files?.[0] || null)} />
      </label>

      {importing &&
      <div className="flex items-center gap-2 text-sm rounded-lg p-3" style={{ background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)', border: '1px solid var(--fal-current-border)' }}>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> Processando arquivo...
        </div>
      }
      {result &&
      <div className="flex items-center gap-2 text-sm rounded-lg p-3 fal-badge-success" style={{ border: '1px solid var(--fal-success-border)' }}>
          <Check className="w-4 h-4 flex-shrink-0" />
          <strong>{result.count}</strong> conta(s) importada(s) com sucesso.
          {result.skipped > 0 ? ` (${result.skipped} linha(s) ignorada(s) sem tipo válido)` : ''}
        </div>
      }
      {error &&
      <div className="flex items-start gap-2 text-sm rounded-lg p-3" style={{ background: 'var(--fal-danger-bg)', color: 'var(--fal-danger-text)', border: '1px solid var(--fal-danger-border)' }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      }
    </div>);

}

// ─── Wrapper que combina PlanLinesView com ImportLinesPanel ───────────────────
/**
 * @param {Object} props
 * @param {any=} props.plan
 * @param {any=} props.tenantId
 * @param {any=} props.onBack
 */
function PlanLinesViewWrapper({ plan, tenantId, onBack }) {
  const [innerTab, setInnerTab] = useState('lines');
  const { data: lines = [], isLoading, refetch } = useQuery({
    queryKey: ['pcg-lines-meta', plan.id],
    queryFn: () => base44.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: plan.id, tenant_id: tenantId }, 'account_code', 1
    ),
    enabled: !!plan.id && !!tenantId,
  });

  // Determina qual sub-aba padrão mostrar
  useEffect(() => {
    if (!isLoading && lines.length === 0) setInnerTab('import');
  }, [isLoading, lines.length]);

  if (innerTab === 'import') {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--fal-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fal-text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fal-text-muted)'}>
          <ArrowLeft className="w-3.5 h-3.5" /> Planos de Contas
        </button>
        <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, var(--fal-navy-950) 0%, var(--fal-navy-800) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(47,166,106,0.15)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--fal-green-400)' }} />
            </div>
            <div>
              <p className="font-bold text-white">{plan.name}</p>
              <p className="text-xs" style={{ color: 'var(--fal-text-inverse-muted)' }}>
                {plan.version && `${plan.version} · `}{plan.description || 'Plano de Contas Gerencial'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-0" style={{ borderBottom: '1px solid var(--fal-border-soft)' }}>
          {[{ key: 'import', label: 'Importar Excel' }, { key: 'lines', label: 'Contas' }].map((t) => (
            <button key={t.key} onClick={() => setInnerTab(t.key)}
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              style={innerTab === t.key
                ? { borderBottomColor: 'var(--fal-green-700)', color: 'var(--fal-green-700)' }
                : { borderBottomColor: 'transparent', color: 'var(--fal-text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <ImportLinesPanel plan={plan} tenantId={tenantId} onImported={() => { refetch(); setInnerTab('lines'); }} />
      </div>
    );
  }

  return <PlanLinesViewBase plan={plan} tenantId={tenantId} onBack={onBack} onImportTab={() => setInnerTab('import')} />;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 */
export default function GroupAccountPlansTab({ groupId, tenantId }) {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [editPlan, setEditPlan] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['pcg-group', tenantId, groupId],
    queryFn: () => base44.entities.FinancialAccountPlan.filter(
      { tenant_id: tenantId }, 'name', 100
    ),
    enabled: !!tenantId
  });

  // Filtra apenas planos do grupo (se group_id estiver salvo) OU todos do tenant (retrocompatível)
  const groupPlans = plans.filter((p) => !p.group_id || p.group_id === groupId);

  const [planSearch, setPlanSearch] = useState('');
  const [planPage, setPlanPage] = useState(1);
  const PLAN_PAGE_SIZE = 5;
  const filteredPlans = useMemo(() => {
    if (!planSearch.trim()) return groupPlans;
    const q = planSearch.toLowerCase();
    return groupPlans.filter((p) =>
      p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [groupPlans, planSearch]);
  const planTotalPages = Math.max(1, Math.ceil(filteredPlans.length / PLAN_PAGE_SIZE));
  const currentPlanPage = Math.min(planPage, planTotalPages);
  const paginatedPlans = filteredPlans.slice((currentPlanPage - 1) * PLAN_PAGE_SIZE, currentPlanPage * PLAN_PAGE_SIZE);

  const handlePlanCreated = (plan) => {
    queryClient.invalidateQueries({ queryKey: ['pcg-group', tenantId, groupId] });
    setCreateDialog(false);
    setSelectedPlan(plan);
  };

  if (selectedPlan) {
    return (
      <PlanLinesViewWrapper
        plan={selectedPlan}
        tenantId={tenantId}
        onBack={() => setSelectedPlan(null)} />);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">Planos de Contas</h2>
        <div className="flex items-center gap-2">
          {groupPlans.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setEditPlan(groupPlans[0])} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateDialog(true)} className="text-white gap-1.5 hover:opacity-90" style={{ background: '#2563eb' }}>
            <Plus className="w-4 h-4" /> Novo Plano de Contas
          </Button>
        </div>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={planSearch}
            onChange={(e) => { setPlanSearch(e.target.value); setPlanPage(1); }}
            placeholder="Buscar plano de contas..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select className="h-9 text-sm border border-slate-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option>Todos os status</option>
        </select>
        </div>

        {/* Table / Empty / Loading */}
        {isLoading ? (
        <div className="px-5 py-4 space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
        ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 px-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 bg-slate-100">
            <BookOpen className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Nenhum plano de contas cadastrado</p>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs mx-auto">
            Crie e importe o plano de contas gerencial para ser usado nos diagnósticos financeiros.
          </p>
          <Button size="sm" onClick={() => setCreateDialog(true)} className="text-white gap-1.5 hover:opacity-90" style={{ background: '#2563eb' }}>
            <Plus className="w-4 h-4" /> Criar Primeiro Plano
          </Button>
        </div>
        ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Plano</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Sistema</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Versão ativa</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Mapeamento</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-white">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPlans.map((plan) => (
                <tr
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className="cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{plan.name}</p>
                        <p className="text-xs text-slate-400 truncate">{plan.description || 'Plano de Contas Gerencial'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">—</td>
                  <td className="px-5 py-3 text-xs text-slate-500">—</td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-medium">{plan.version || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">—</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${plan.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                      <span className="text-xs text-slate-600 font-medium">{plan.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setSelectedPlan(plan)}>
                          <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditPlan(plan)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPlans.length > PLAN_PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Mostrando 1 a {Math.min(currentPlanPage * PLAN_PAGE_SIZE, filteredPlans.length)} de {filteredPlans.length} planos de contas
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                  disabled={currentPlanPage <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {planTotalPages > 1 && (
                  <span className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium bg-blue-600 text-white">
                    {currentPlanPage}
                  </span>
                )}
                <button
                  onClick={() => setPlanPage((p) => Math.min(planTotalPages, p + 1))}
                  disabled={currentPlanPage >= planTotalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
        )}

        <CreatePlanDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        tenantId={tenantId}
        groupId={groupId}
        onCreated={handlePlanCreated} />

        <EditPlanDialog
        open={!!editPlan}
        onClose={() => setEditPlan(null)}
        plan={editPlan}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pcg-group', tenantId, groupId] })} />

        </div>);

}