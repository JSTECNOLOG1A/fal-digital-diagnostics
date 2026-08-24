import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

function formatDateInput(raw) {
  let v = raw.replace(/\D/g, '').slice(0, 6);
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  return v;
}

function isValidDate(v) {
  if (!/^\d{2}\/\d{4}$/.test(v)) return false;
  const m = parseInt(v.slice(0, 2), 10);
  return m >= 1 && m <= 12;
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.tenantId
 * @param {any=} props.scopeLevel
 * @param {any=} props.groupId
 * @param {any=} props.companyId
 * @param {any=} props.unitId
 * @param {any=} props.defaultTitle
 */
export default function CreateFinancialDiagnosisDialog({
  open,
  onClose,
  tenantId,
  scopeLevel = 'group',
  groupId,
  companyId,
  unitId,
  defaultTitle = '',
}) {
  const [form, setForm] = useState({
    title: defaultTitle,
    account_plan_id: '',
    periodicidade: '',
    data_base_abertura: '',
    data_base_fechamento: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: accountPlans = [] } = useQuery({
    queryKey: ['account-plans', tenantId],
    queryFn: () => base44.entities.FinancialAccountPlan.filter(
      { tenant_id: tenantId, is_active: true }, 'name', 50
    ),
    enabled: !!tenantId && open,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if (!tenantId) {
      alert('Erro: tenant_id não encontrado. Recarregue a página e tente novamente.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        scope_level: scopeLevel,
        title: form.title.trim(),
        status: 'draft',
        ...(form.account_plan_id && { account_plan_id: form.account_plan_id }),
        ...(form.periodicidade && { periodicidade: form.periodicidade }),
        ...(form.data_base_abertura && { data_base_abertura: form.data_base_abertura }),
        ...(form.data_base_fechamento && { data_base_fechamento: form.data_base_fechamento }),
        ...(form.notes && { notes: form.notes }),
        ...(groupId && { group_id: groupId }),
        ...(companyId && { company_id: companyId }),
        ...(unitId && { unit_id: unitId }),
      };
      const created = await base44.entities.FinancialDiagnosis.create(payload);
      onClose(created);
    } catch (e) {
      console.error('[FinancialDiagnosis] erro ao criar:', e);
      alert('Erro ao criar diagnóstico: ' + (e.message || JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Diagnóstico Financeiro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div>
            <Label>Título <span className="text-red-500">*</span></Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ex: Diagnóstico Financeiro 2024"
            />
          </div>

          {/* Plano de Contas */}
          {accountPlans.length > 0 && (
            <div>
              <Label>Plano de Contas Gerencial</Label>
              <Select value={form.account_plan_id} onValueChange={v => set('account_plan_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar plano (opcional)..." />
                </SelectTrigger>
                <SelectContent>
                  {accountPlans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Periodicidade */}
          <div>
            <Label>Periodicidade dos demonstrativos</Label>
            <Select value={form.periodicidade} onValueChange={v => set('periodicidade', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar periodicidade..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400 mt-1">Define como os demonstrativos serão organizados e exibidos.</p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de abertura</Label>
              <Input
                placeholder="MM/AAAA"
                value={form.data_base_abertura}
                onChange={e => set('data_base_abertura', formatDateInput(e.target.value))}
                maxLength={7}
              />
              {form.data_base_abertura && !isValidDate(form.data_base_abertura) && (
                <p className="text-[11px] text-red-500 mt-1">Formato inválido</p>
              )}
            </div>
            <div>
              <Label>Data-base (fechamento)</Label>
              <Input
                placeholder="MM/AAAA"
                value={form.data_base_fechamento}
                onChange={e => set('data_base_fechamento', formatDateInput(e.target.value))}
                maxLength={7}
              />
              {form.data_base_fechamento && !isValidDate(form.data_base_fechamento) && (
                <p className="text-[11px] text-red-500 mt-1">Formato inválido</p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label>Notas internas</Label>
            <Input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observações opcionais"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || saving}
            style={{ background: 'var(--fal-green-700)' }}
            className="text-white gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Diagnóstico'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}