import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, AlertCircle } from 'lucide-react';
import { useDuplicateCheck } from '@/components/shared/useDuplicateCheck';
import { invalidateStructureQueries } from '@/lib/query-client';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';
import { isValidTaxIdLength } from '@/lib/brazilianDocuments';

const UNIT_TYPES = ['Fazenda', 'Filial / Revenda', 'Unidade Operacional'];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const LABELS = {
  'Fazenda': { name: 'Nome da Fazenda', namePlaceholder: 'Ex: Fazenda Santa Helena' },
  'Filial / Revenda': { name: 'Nome da Unidade / Loja', namePlaceholder: 'Ex: Revenda AgroCentro' },
  'Unidade Operacional': { name: 'Nome da Unidade', namePlaceholder: 'Ex: Armazém Central' },
};

const EMPTY = {
  unit_type: 'Fazenda',
  name: '',
  unit_cnpj: '',
  is_individual: false,
  city: '',
  location_state: '',
  company_id: '',
};

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.tenantId
 * @param {any=} props.companyId
 * @param {any=} props.companyName
 * @param {any=} props.companies
 * @param {any=} props.onCreated
 */
export default function CreateUnitDialog({ open, onOpenChange, tenantId, companyId, companyName, companies, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY, company_id: companyId || '' });

  useEffect(() => {
    if (companyId) setForm(prev => ({ ...prev, company_id: companyId }));
  }, [companyId]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isFiliacao = form.unit_type === 'Filial / Revenda';
  const labels = LABELS[form.unit_type] || LABELS['Unidade Operacional'];
  const resolvedCompanyId = companies ? form.company_id : companyId;

  const dupUnit = useDuplicateCheck(
    form.name,
    'OperationalUnit',
    { company_id: resolvedCompanyId || '__none__' }
  );

  const taxOk = !isFiliacao || isValidTaxIdLength(form.unit_cnpj, form.is_individual);

  const canSubmit = form.name.trim() &&
    !!resolvedCompanyId &&
    taxOk;

  const mutation = useMutation({
    mutationFn: () => base44.entities.OperationalUnit.create({
      tenant_id: tenantId,
      company_id: resolvedCompanyId,
      name: form.name.trim(),
      unit_type: form.unit_type,
      unit_cnpj: isFiliacao ? form.unit_cnpj : undefined,
      is_individual: isFiliacao ? form.is_individual : undefined,
      city: form.city.trim() || undefined,
      location_state: form.location_state || undefined,
    }),
    onSuccess: (unit) => {
      invalidateStructureQueries(queryClient, tenantId, 'unit');
      onCreated?.(unit);
      onOpenChange(false);
      setForm({ ...EMPTY, company_id: companyId || '' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            Nova Unidade{companyName ? ` em ${companyName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {companies && companies.length > 0 && (
            <div>
              <Label>Empresa *</Label>
              <Select value={form.company_id} onValueChange={v => set('company_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Tipo de Unidade *</Label>
            <Select value={form.unit_type} onValueChange={v => set('unit_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isFiliacao && (
            <TaxIdRegistrationFields
              isIndividual={form.is_individual}
              taxId={form.unit_cnpj}
              onChange={(patch) => setForm((prev) => ({
                ...prev,
                is_individual: patch.isIndividual ?? prev.is_individual,
                unit_cnpj: patch.taxId ?? prev.unit_cnpj,
              }))}
              onCompanyData={(data) => setForm((prev) => ({
                ...prev,
                name: data.nomeFantasia || data.razaoSocial || prev.name,
                city: data.city || prev.city,
                location_state: data.state || prev.location_state,
              }))}
              pjLabel="P. Jurídica"
              pfLabel="P. Física"
            />
          )}

          <div>
            <Label>{labels.name} *</Label>
            <Input
              placeholder={labels.namePlaceholder}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={dupUnit.exact ? 'border-red-400 focus-visible:ring-red-300' : dupUnit.similar.length > 0 ? 'border-amber-400 focus-visible:ring-amber-300' : ''}
            />
            {dupUnit.exact && (
              <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Já existe uma unidade com este nome nesta empresa. Escolha um nome diferente.</span>
              </div>
            )}
            {!dupUnit.exact && dupUnit.similar.length > 0 && (
              <div className="flex items-start gap-1.5 mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Nome muito semelhante a unidades existentes:</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {dupUnit.similar.map(({ record }) => (
                      <li key={record.id} className="text-amber-600">• {record.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Município</Label>
              <Input
                placeholder="Ex: Rio Verde"
                value={form.city}
                onChange={e => set('city', e.target.value)}
              />
            </div>
            <div>
              <Label>Estado (UF)</Label>
              <Select value={form.location_state} onValueChange={v => set('location_state', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.name && (
            <div className="bg-slate-50 border rounded-lg px-3 py-2 text-sm text-slate-600">
              <span className="text-xs text-slate-400 block mb-0.5">Exibição no sistema:</span>
              <span className="font-medium text-slate-800">{form.name}</span>
              {(form.city || form.location_state) && (
                <span className="text-slate-500"> — {[form.city, form.location_state].filter(Boolean).join('/')}</span>
              )}
              {isFiliacao && form.unit_cnpj && (
                <span className="block text-xs text-slate-500 mt-0.5">
                  {form.is_individual ? 'CPF' : 'CNPJ'}: {form.unit_cnpj}
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending || !!dupUnit.exact}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mutation.isPending ? 'Criando...' : 'Criar Unidade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
