import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey, invalidateFinancialQueries } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Check, FileText } from 'lucide-react';

const NATURES = [
  { value: 'elimination', label: 'Eliminação' },
  { value: 'consolidation_adjustment', label: 'Ajuste de Consolidação' },
  { value: 'reclassification', label: 'Reclassificação' },
];
const TYPES = [
  'intercompany_balance', 'intercompany_revenue_expense', 'investment_equity',
  'intercompany_loan', 'dividend', 'interest_on_equity',
  'unrealized_profit_inventory', 'unrealized_profit_fixed_asset',
  'equity_method', 'non_controlling_interest', 'goodwill',
  'accounting_policy_adjustment', 'manual_adjustment',
];

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.scopeEntities
 */
export default function ConsolidationEntryManager({ diagnosisId, scopeEntities: scopeEntitiesProp }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entry_nature: 'elimination', entry_type: 'intercompany_balance',
    period: '', source_entity_id: '', counterparty_entity_id: '',
    debit_canonical_key: '', credit_canonical_key: '', amount: '',
    description: '', rationale: '',
  });

  // F2-JRN-01 3.1: O painel busca o próprio escopo — não depende de journey.raw.scopeEntities
  const { data: fetchedScopeEntities = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'scope-entities'),
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId, is_active: true }, 'id', 200),
    enabled: !!diagnosisId,
  });
  const scopeEntities = scopeEntitiesProp && scopeEntitiesProp.length > 0 ? scopeEntitiesProp : fetchedScopeEntities;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'consolidation-entries'),
    queryFn: () => base44.entities.FinancialConsolidationEntry.filter({ financial_diagnosis_id: diagnosisId }, 'entry_number', 500),
    enabled: !!diagnosisId,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.period || !form.source_entity_id || !form.counterparty_entity_id || !form.debit_canonical_key || !form.credit_canonical_key || !form.amount || !form.rationale.trim()) return;
    setSaving(true);
    try {
      await base44.functions.invoke('manageFinancialConsolidationEntry', { action: 'create', diagnosis_id: diagnosisId, ...form });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      setShowForm(false);
      setForm({ entry_nature: 'elimination', entry_type: 'intercompany_balance', period: '', source_entity_id: '', counterparty_entity_id: '', debit_canonical_key: '', credit_canonical_key: '', amount: '', description: '', rationale: '' });
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action, entryId, extra = {}) => {
    try {
      await base44.functions.invoke('manageFinancialConsolidationEntry', { action, entry_id: entryId, ...extra });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    }
  };

  const statusBadge = (status) => {
    const colors = { draft: 'bg-slate-100 text-slate-600', pending_review: 'bg-amber-50 text-amber-700', approved: 'bg-blue-50 text-blue-700', posted: 'bg-emerald-50 text-emerald-700', reversed: 'bg-red-50 text-red-700' };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || colors.draft}`}>{status}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Cédula de Consolidação ({entries.length} entradas)</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Entrada
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Natureza *</Label>
              <Select value={form.entry_nature} onValueChange={v => set('entry_nature', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{NATURES.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.entry_type} onValueChange={v => set('entry_type', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Período (YYYY-MM) *</Label>
              <Input className="h-8 text-sm" value={form.period} onChange={e => set('period', e.target.value)} placeholder="2025-12" />
            </div>
            <div>
              <Label className="text-xs">Entidade Origem</Label>
              <Select value={form.source_entity_id} onValueChange={v => set('source_entity_id', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{scopeEntities.map(se => <SelectItem key={se.id} value={se.entity_id}>{se.entity_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contraparte</Label>
              <Select value={form.counterparty_entity_id} onValueChange={v => set('counterparty_entity_id', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{scopeEntities.map(se => <SelectItem key={se.id} value={se.entity_id}>{se.entity_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" className="h-8 text-sm" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">Débito (canonical_key) *</Label>
              <Input className="h-8 text-sm" value={form.debit_canonical_key} onChange={e => set('debit_canonical_key', e.target.value)} placeholder="ativo_nc_investimentos" />
            </div>
            <div>
              <Label className="text-xs">Crédito (canonical_key) *</Label>
              <Input className="h-8 text-sm" value={form.credit_canonical_key} onChange={e => set('credit_canonical_key', e.target.value)} placeholder="patrimonio_capital" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição / Histórico</Label>
            <Input className="h-8 text-sm" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Eliminação de investimento societário" />
          </div>
          <div>
            <Label className="text-xs">Justificativa técnica *</Label>
            <Input className="h-8 text-sm" value={form.rationale} onChange={e => set('rationale', e.target.value)} placeholder="Explique a origem e o suporte da eliminação" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Criar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="space-y-1">
          {entries.map(e => (
            <div key={e.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">#{e.entry_number}</span>
                  <span className="text-sm font-medium text-slate-700">{e.description || e.entry_type?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-400 capitalize">{e.entry_nature}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-700">{Number(e.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  {statusBadge(e.status)}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span>{e.period}</span>
                <span>D: {e.debit_canonical_key}</span>
                <span>C: {e.credit_canonical_key}</span>
                {e.source_entity_name && <span>Orig: {e.source_entity_name}</span>}
                {e.counterparty_entity_name && <span>Counter: {e.counterparty_entity_name}</span>}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {e.status === 'draft' && <button onClick={() => handleAction('approve', e.id)} className="text-[10px] font-medium text-blue-600 hover:text-blue-700">Aprovar</button>}
                {e.status === 'approved' && <button onClick={() => handleAction('post', e.id)} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700">Postar</button>}
                {(e.status === 'approved' || e.status === 'posted') && <button onClick={() => handleAction('reverse', e.id)} className="text-[10px] font-medium text-amber-600 hover:text-amber-700">Reverter</button>}
                {e.status === 'draft' && <button onClick={() => handleAction('delete', e.id)} className="text-[10px] font-medium text-red-500 hover:text-red-600">Excluir</button>}
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma entrada na cédula. Crie eliminações e ajustes manuais.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}