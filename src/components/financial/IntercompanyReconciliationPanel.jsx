import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey, invalidateFinancialQueries } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Check, GitCompareArrows } from 'lucide-react';

const RECON_TYPES = [
  { value: 'intercompany_balance', label: 'Saldo Intercompany' },
  { value: 'intercompany_revenue_expense', label: 'Receita/Despesa Intercompany' },
  { value: 'intercompany_loan', label: 'Empréstio Intercompany' },
  { value: 'other', label: 'Outro' },
];

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.scopeEntities
 */
export default function IntercompanyReconciliationPanel({ diagnosisId, scopeEntities: scopeEntitiesProp }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    period: '', entity_a_id: '', entity_b_id: '',
    reconciliation_type: 'intercompany_balance',
    account_a_canonical_key: '', account_b_canonical_key: '',
    amount_a: '', amount_b: '',
  });

  // F2-JRN-01 3.1: O painel busca o próprio escopo — não depende de journey.raw.scopeEntities
  const { data: fetchedScopeEntities = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'scope-entities'),
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId, is_active: true }, 'id', 200),
    enabled: !!diagnosisId,
  });
  const scopeEntities = scopeEntitiesProp && scopeEntitiesProp.length > 0 ? scopeEntitiesProp : fetchedScopeEntities;

  const { data: recons = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'intercompany-recons'),
    queryFn: () => base44.entities.FinancialIntercompanyReconciliation.filter({ financial_diagnosis_id: diagnosisId }, '-created_date', 500),
    enabled: !!diagnosisId,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.period || !form.entity_a_id || !form.entity_b_id || !form.amount_a || !form.amount_b) return;
    setSaving(true);
    try {
      const a = scopeEntities.find(s => s.entity_id === form.entity_a_id);
      const b = scopeEntities.find(s => s.entity_id === form.entity_b_id);
      await base44.functions.invoke('reconcileIntercompany', {
        action: 'create',
        diagnosis_id: diagnosisId,
        ...form,
        entity_a_name: a?.entity_name, entity_b_name: b?.entity_name,
      });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
      setShowForm(false);
      setForm({ period: '', entity_a_id: '', entity_b_id: '', reconciliation_type: 'intercompany_balance', account_a_canonical_key: '', account_b_canonical_key: '', amount_a: '', amount_b: '' });
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (reconId) => {
    try {
      await base44.functions.invoke('reconcileIntercompany', { action: 'resolve', reconciliation_id: reconId });
      await invalidateFinancialQueries(queryClient, diagnosisId, tenantId);
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    }
  };

  const statusBadge = (status) => {
    const colors = {
      unmatched: 'bg-red-50 text-red-700',
      matched: 'bg-emerald-50 text-emerald-700',
      matched_with_difference: 'bg-amber-50 text-amber-700',
      under_review: 'bg-blue-50 text-blue-700',
      resolved: 'bg-slate-100 text-slate-500',
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || colors.unmatched}`}>{status.replace(/_/g, ' ')}</span>;
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Conciliação Intragrupo ({recons.length} comparações)</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Conciliação
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Período (YYYY-MM) *</Label>
              <Input className="h-8 text-sm" value={form.period} onChange={e => set('period', e.target.value)} placeholder="2025-12" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.reconciliation_type} onValueChange={v => set('reconciliation_type', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{RECON_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div />
            <div>
              <Label className="text-xs">Entidade A *</Label>
              <Select value={form.entity_a_id} onValueChange={v => set('entity_a_id', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{scopeEntities.map(se => <SelectItem key={se.id} value={se.entity_id}>{se.entity_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conta A (canonical_key)</Label>
              <Input className="h-8 text-sm" value={form.account_a_canonical_key} onChange={e => set('account_a_canonical_key', e.target.value)} placeholder="ativo_circulante_receber" />
            </div>
            <div>
              <Label className="text-xs">Saldo A (R$) *</Label>
              <Input type="number" className="h-8 text-sm" value={form.amount_a} onChange={e => set('amount_a', e.target.value)} placeholder="1500000" />
            </div>
            <div>
              <Label className="text-xs">Entidade B *</Label>
              <Select value={form.entity_b_id} onValueChange={v => set('entity_b_id', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{scopeEntities.map(se => <SelectItem key={se.id} value={se.entity_id}>{se.entity_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conta B (canonical_key)</Label>
              <Input className="h-8 text-sm" value={form.account_b_canonical_key} onChange={e => set('account_b_canonical_key', e.target.value)} placeholder="passivo_circulante_fornecedores" />
            </div>
            <div>
              <Label className="text-xs">Saldo B (R$) *</Label>
              <Input type="number" className="h-8 text-sm" value={form.amount_b} onChange={e => set('amount_b', e.target.value)} placeholder="1480000" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Comparar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="space-y-1">
          {recons.map(r => (
            <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <GitCompareArrows className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-700">{r.entity_a_name || r.entity_a_id}</span>
                  <span className="text-slate-300">×</span>
                  <span className="font-medium text-slate-700">{r.entity_b_name || r.entity_b_id}</span>
                  <span className="text-xs text-slate-400">{r.period}</span>
                </div>
                {statusBadge(r.status)}
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs">
                <div className="text-slate-500">A: <span className="font-semibold tabular-nums">{fmt(r.amount_a)}</span></div>
                <div className="text-slate-500">B: <span className="font-semibold tabular-nums">{fmt(r.amount_b)}</span></div>
                <div className="text-emerald-600">Match: <span className="font-semibold tabular-nums">{fmt(r.matched_amount)}</span></div>
                {r.difference_amount > 0 && <div className="text-amber-600">Diferença: <span className="font-semibold tabular-nums">{fmt(r.difference_amount)}</span></div>}
              </div>
              {r.status !== 'resolved' && r.difference_amount > 0 && (
                <button onClick={() => handleResolve(r.id)} className="mt-1 text-[10px] font-medium text-blue-600 hover:text-blue-700">Marcar como resolvido</button>
              )}
            </div>
          ))}
          {recons.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <GitCompareArrows className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma conciliação. Compare saldos intercompany A × B.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}