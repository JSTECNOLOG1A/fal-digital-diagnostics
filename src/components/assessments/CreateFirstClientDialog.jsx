import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';
import { useTenant } from '@/components/shared/TenantContext';
import { useToast } from '@/components/ui/use-toast';
import { invalidateStructureQueries } from '@/lib/query-client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Building2, Plus, Loader2, AlertTriangle, AlertCircle, CheckCircle2, ArrowRight, GitBranch, Trash2, Pencil, Lock, Unlock, Ban } from 'lucide-react';
import { useDuplicateCheck } from '@/components/shared/useDuplicateCheck';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SECTORS = ['Agricultura', 'Pecuária', 'Agropecuária', 'Revenda de insumos', 'Indústria', 'Comércio', 'Serviços', 'Outro'];
const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const EMPTY_COMPANY = {
  tax_id: '', name: '', trade_name: '', sector: '', city: '', state: '', legal_type: '', is_individual: false,
  company_role: 'matriz', share_capital: '',
  societary_composition: [
    { partner_type: 'third_party', partner_name: 'Terceiros (Sócios Externos)', equity_percentage: '100' }
  ]
};

const COMPANY_ROLES = [
  { value: 'matriz',        label: 'Matriz' },
  { value: 'holding',       label: 'Holding' },
  { value: 'sub_holding',   label: 'Sub-Holding' },
  { value: 'filial',        label: 'Filial' },
  { value: 'investida',     label: 'Investida' },
  { value: 'joint_venture', label: 'Joint Venture' },
  { value: 'coligada',      label: 'Coligada' },
];

function roleLabel(value) {
  return COMPANY_ROLES.find((r) => r.value === value)?.label || value || '—';
}

/**
 * Lista de empresas já incluídas no grupo (selecionar / editar / bloquear).
 * @param {Object} props
 * @param {any[]} props.companies
 * @param {string|null} props.selectedId
 * @param {string|null} props.editingId
 * @param {string|null} props.busyId
 * @param {(id: string) => void} props.onSelect
 * @param {(company: any) => void} props.onEdit
 * @param {(company: any) => void} props.onToggleBlock
 */
function GroupCompaniesList({
  companies,
  selectedId,
  editingId,
  busyId,
  onSelect,
  onEdit,
  onToggleBlock,
}) {
  if (!companies.length) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma empresa neste grupo ainda</p>
        <p className="mt-1 text-xs text-slate-400">
          Preencha o formulário acima e clique em Adicionar empresa.
        </p>
      </section>
    );
  }

  const activeCount = companies.filter((c) => !c.is_archived).length;
  const blockedCount = companies.length - activeCount;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Empresas do grupo</h3>
          <p className="text-xs text-slate-400">
            {companies.length} cadastrada{companies.length > 1 ? 's' : ''}
            {blockedCount > 0 ? ` · ${blockedCount} bloqueada${blockedCount > 1 ? 's' : ''}` : ''}
            {activeCount > 0 ? ` · ${activeCount} ativa${activeCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {companies.length}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-10 px-4 py-2.5 font-medium" />
              <th className="px-3 py-2.5 font-medium">Empresa</th>
              <th className="px-3 py-2.5 font-medium">Documento</th>
              <th className="px-3 py-2.5 font-medium">Papel</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const selected = selectedId === company.id;
              const editing = editingId === company.id;
              const busy = busyId === company.id;
              const blocked = !!company.is_archived;

              return (
                <tr
                  key={company.id}
                  onClick={() => onSelect(company.id)}
                  className={cn(
                    'cursor-pointer border-b border-slate-50 transition-colors last:border-0',
                    selected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80',
                    blocked && 'opacity-75',
                  )}
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full border',
                        selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white',
                      )}
                    >
                      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <p className={cn('font-medium text-slate-800 truncate', blocked && 'line-through decoration-slate-400')}>
                        {company.name}
                      </p>
                      {company.trade_name ? (
                        <p className="truncate text-xs text-slate-400">{company.trade_name}</p>
                      ) : null}
                      {company.city ? (
                        <p className="text-[11px] text-slate-400">
                          {company.city}/{company.state}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">
                    {company.tax_id || '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {roleLabel(company.company_role)}
                  </td>
                  <td className="px-3 py-3">
                    {blocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        <Ban className="h-3 w-3" /> Bloqueada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Ativa
                      </span>
                    )}
                    {editing ? (
                      <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Editando
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-xs"
                        disabled={busy || blocked}
                        onClick={() => onEdit(company)}
                        title={blocked ? 'Desbloqueie para editar' : 'Editar'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-8 gap-1.5 px-2 text-xs',
                          blocked ? 'text-green-700 hover:text-green-800' : 'text-red-600 hover:text-red-700',
                        )}
                        disabled={busy}
                        onClick={() => onToggleBlock(company)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : blocked ? (
                          <Unlock className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        {blocked ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
 * @param {any=} props.onAdd
 * @param {any=} props.onAddAndNext
 * @param {any=} props.onSaveEdit
 * @param {any=} props.onCancelEdit
 * @param {any=} props.isPending
 * @param {any=} props.addedCompanies
 * @param {boolean=} props.isEditing
 */
function CompanyForm({
  value,
  onChange,
  onAdd,
  onAddAndNext,
  onSaveEdit,
  onCancelEdit,
  isPending,
  addedCompanies = [],
  isEditing = false,
}) {
  const taxDigits = (value.tax_id || '').replace(/\D/g, '').length;

  const updateComposition = (index, field, val) => {
    const comp = [...value.societary_composition];
    comp[index] = { ...comp[index], [field]: val };
    onChange({ ...value, societary_composition: comp });
  };
  const removeComposition = (index) => {
    onChange({
      ...value,
      societary_composition: value.societary_composition.filter((_, i) => i !== index),
    });
  };
  const addComposition = () => {
    onChange({
      ...value,
      societary_composition: [
        ...value.societary_composition,
        { partner_type: 'third_party', partner_name: 'Terceiros (Sócios Externos)', equity_percentage: '' },
      ],
    });
  };

  const totalEquity = (value.societary_composition || []).reduce((sum, partner) => {
    const pct = parseFloat(String(partner.equity_percentage || '0').replace(',', '.'));
    return sum + (isNaN(pct) ? 0 : pct);
  }, 0);
  const isEquityValid = Math.abs(totalEquity - 100) < 0.01;
  const equityError = !isEquityValid && value.societary_composition.some((c) => c.equity_percentage);

  const canAdd =
    value.name.trim() &&
    (value.is_individual ? taxDigits === 11 : taxDigits === 14) &&
    value.share_capital &&
    isEquityValid &&
    value.societary_composition.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Coluna esquerda */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Identificação</h3>
              <p className="text-xs text-slate-400 mt-0.5">Documento e dados cadastrais da empresa</p>
            </div>
            <TaxIdRegistrationFields
              isIndividual={!!value.is_individual}
              taxId={value.tax_id || ''}
              onChange={(patch) =>
                onChange({
                  ...value,
                  is_individual: patch.isIndividual ?? value.is_individual,
                  tax_id: patch.taxId ?? value.tax_id,
                })
              }
              onCompanyData={(data) =>
                onChange({
                  ...value,
                  name: data.razaoSocial || value.name,
                  trade_name: data.nomeFantasia || value.trade_name,
                  city: data.city || value.city,
                  state: data.state || value.state,
                  share_capital: data.shareCapital || value.share_capital,
                })
              }
              pjLabel="P. Jurídica"
              pfLabel="P. Física"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-600">Razão Social *</Label>
                <Input
                  className="mt-1.5 h-10"
                  placeholder="Ex: Agro Cangaia Ltda."
                  value={value.name}
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-600">Nome Fantasia</Label>
                <Input
                  className="mt-1.5 h-10"
                  placeholder="Opcional"
                  value={value.trade_name}
                  onChange={(e) => onChange({ ...value, trade_name: e.target.value })}
                />
              </div>
              {!value.is_individual && (
                <div>
                  <Label className="text-xs text-slate-600">Tipo Societário</Label>
                  <Select value={value.legal_type} onValueChange={(v) => onChange({ ...value, legal_type: v })}>
                    <SelectTrigger className="mt-1.5 h-10">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {['LTDA', 'S/A', 'Holding', 'Cooperativa', 'MEI', 'EIRELI', 'Outro'].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={value.is_individual ? 'sm:col-span-2' : ''}>
                <Label className="text-xs text-slate-600">Setor</Label>
                <Select value={value.sector} onValueChange={(v) => onChange({ ...value, sector: v })}>
                  <SelectTrigger className="mt-1.5 h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Localização</h3>
              <p className="text-xs text-slate-400 mt-0.5">Município e UF da empresa</p>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <div>
                <Label className="text-xs text-slate-600">Município</Label>
                <Input
                  className="mt-1.5 h-10"
                  placeholder="Ex: Rio Verde"
                  value={value.city}
                  onChange={(e) => onChange({ ...value, city: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">UF</Label>
                <Select value={value.state} onValueChange={(v) => onChange({ ...value, state: v })}>
                  <SelectTrigger className="mt-1.5 h-10">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        {/* Coluna direita */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Hierarquia Societária</h3>
              <p className="text-xs text-slate-400">Papel, capital e composição de sócios</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-600">Papel no Grupo</Label>
              <Select value={value.company_role} onValueChange={(v) => onChange({ ...value, company_role: v })}>
                <SelectTrigger className="mt-1.5 h-10">
                  <SelectValue placeholder="Selecione o papel..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Capital Social *</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                <Input
                  className="pl-10 h-10"
                  placeholder="Ex: 1.000.000"
                  value={value.share_capital}
                  onChange={(e) => onChange({ ...value, share_capital: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Composição Societária</span>
              <span
                className={`text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full ${
                  isEquityValid
                    ? 'bg-green-100 text-green-700'
                    : equityError
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {totalEquity.toFixed(2)}%
              </span>
            </div>

            {equityError && (
              <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>A soma das participações deve ser exatamente 100%</span>
              </div>
            )}

            {isEquityValid && value.societary_composition.some((c) => c.equity_percentage) && (
              <div className="flex items-start gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Composição societária validada (100%)</span>
              </div>
            )}

            <div className="space-y-2">
              {(value.societary_composition || []).map((partner, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap gap-3 items-end rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                >
                  <div className="flex-1 min-w-[160px] space-y-1">
                    <Label className="text-xs text-slate-500">Tipo de Sócio</Label>
                    <Select
                      value={partner.partner_type}
                      onValueChange={(v) => {
                        updateComposition(idx, 'partner_type', v);
                        if (v === 'third_party') {
                          updateComposition(idx, 'partner_name', 'Terceiros (Sócios Externos)');
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="group_company">Empresa do Grupo</SelectItem>
                        <SelectItem value="third_party">Terceiros (Sócios Externos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {partner.partner_type === 'group_company' && (
                    <div className="flex-1 min-w-[160px] space-y-1">
                      <Label className="text-xs text-slate-500">Empresa</Label>
                      <Select
                        value={partner.company_id || ''}
                        onValueChange={(v) => {
                          const comp = addedCompanies.find((c) => c.id === v);
                          updateComposition(idx, 'company_id', v);
                          if (comp) updateComposition(idx, 'partner_name', comp.name);
                        }}
                      >
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {addedCompanies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.trade_name || c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="w-[100px] space-y-1">
                    <Label className="text-xs text-slate-500">Participação</Label>
                    <div className="relative">
                      <Input
                        className="h-9 pr-7 bg-white"
                        placeholder="0,00"
                        value={partner.equity_percentage}
                        onChange={(e) =>
                          updateComposition(idx, 'equity_percentage', e.target.value.replace(/[^0-9.,]/g, ''))
                        }
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  </div>

                  {(value.societary_composition || []).length > 1 && (
                    <button
                      type="button"
                      className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-md flex items-center justify-center shrink-0"
                      onClick={() => removeComposition(idx)}
                      aria-label="Remover sócio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addComposition}
              className="w-full py-2.5 text-sm font-medium border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-1.5 text-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar Sócio
            </button>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
        {isEditing ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 sm:flex-1"
              disabled={isPending}
              onClick={onCancelEdit}
            >
              Cancelar edição
            </Button>
            <Button
              type="button"
              className="h-11 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:flex-1"
              disabled={!canAdd || isPending}
              onClick={onSaveEdit}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 sm:flex-1"
              disabled={!canAdd || isPending}
              onClick={onAdd}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar empresa
            </Button>
            <Button
              type="button"
              className="h-11 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:flex-1"
              disabled={!canAdd || isPending}
              onClick={onAddAndNext}
            >
              <Plus className="h-4 w-4" />
              Adicionar e incluir outra
            </Button>
          </>
        )}
      </div>
    </div>
  );
}


/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.tenantId
 * @param {any=} props.onCreated
 */
export default function CreateFirstClientDialog({ open, onOpenChange, tenantId: tenantIdProp, onCreated }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { loading: tenantLoading, error: tenantError, tenantId: ctxTenantId } = useTenant();
  const [step, setStep]             = useState(1);
  const [groupName, setGroupName]   = useState('');
  const [structureType, setStructureType] = useState('');
  const [entityNature, setEntityNature] = useState('');
  const [mainSector, setMainSector] = useState('');
  const [createdGroup, setCreatedGroup] = useState(null);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);
  const [addedCompanies, setAddedCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [busyCompanyId, setBusyCompanyId] = useState(null);

  // Sempre exige tenant concreto para criar (HQ também precisa selecionar)
  const tenantId =
    ctxTenantId ||
    tenantIdProp ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('fal_active_tenant_id')
      : null);
  const tenantReady = !tenantLoading && !tenantError && !!tenantId;

  const dupGroup = useDuplicateCheck(
    groupName,
    'Group',
    { tenant_id: tenantId || '__none__' }
  );

  const groupMutation = useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      if (!tenantId) {
        throw new Error('Selecione um tenant antes de criar o grupo.');
      }
      const group = await base44.entities.Group.create({
        name: data.name,
        tenant_id: tenantId,
        tenantId,
        structure_type: data.structure_type,
        entity_nature: data.entity_nature,
        main_sector: data.main_sector,
      });
      try {
        await base44.functions.invoke('assignGroupOrderNumber', {
          group_id: group.id,
          tenant_id: tenantId,
        });
      } catch {
        // Ordenação é best-effort — não bloqueia a criação
      }
      return group;
    },
    onSuccess: (group) => {
      setCreatedGroup(group);
      invalidateStructureQueries(queryClient, tenantId);
      setStep(2);
      toast({
        title: 'Grupo criado',
        description: `“${group.name}” foi criado com sucesso.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível criar o grupo',
        description: err?.message || 'Erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const companyMutation = useMutation({
    mutationFn: (/** @type {any} */ cf) =>
      base44.entities.Company.create({
        name: cf.name.trim(),
        trade_name: cf.trade_name.trim() || undefined,
        tax_id: cf.tax_id || undefined,
        cnpj: cf.is_individual ? undefined : cf.tax_id || undefined,
        legal_type: cf.legal_type || undefined,
        sector: cf.sector || undefined,
        city: cf.city.trim() || undefined,
        state: cf.state || undefined,
        tenant_id: tenantId,
        group_id: createdGroup?.id,
        company_role: cf.company_role || undefined,
        share_capital: cf.share_capital
          ? parseFloat(String(cf.share_capital).replace(/\./g, '').replace(',', '.'))
          : undefined,
        societary_composition: cf.societary_composition,
      }),
    onSuccess: (company, cf) => {
      invalidateStructureQueries(queryClient, tenantId, 'company');
      const row = {
        ...cf,
        id: company.id,
        is_archived: false,
        cnpj: company.cnpj || cf.tax_id || null,
      };
      setAddedCompanies((prev) => [...prev, row]);
      setSelectedCompanyId(company.id);
      setEditingCompanyId(null);
      setCompanyForm(EMPTY_COMPANY);
      toast({
        title: 'Empresa adicionada',
        description: `“${cf.name.trim()}” entrou na lista do grupo.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível adicionar a empresa',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, data: any }} */ { id, data }) => {
      const updated = await base44.entities.Company.update(id, {
        name: data.name?.trim(),
        cnpj: data.is_individual ? undefined : data.tax_id || undefined,
        sector: data.sector || undefined,
      });
      return { id, data, updated };
    },
    onSuccess: ({ id, data }) => {
      invalidateStructureQueries(queryClient, tenantId, 'company');
      setAddedCompanies((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ...data,
                name: data.name.trim(),
                trade_name: data.trade_name?.trim() || '',
                is_archived: c.is_archived,
              }
            : c,
        ),
      );
      setEditingCompanyId(null);
      setCompanyForm(EMPTY_COMPANY);
      toast({
        title: 'Empresa atualizada',
        description: `“${data.name.trim()}” foi salva.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível salvar',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    },
  });

  async function handleAddCompany() {
    await companyMutation.mutateAsync(companyForm);
  }

  async function handleSaveEdit() {
    if (!editingCompanyId) return;
    await updateCompanyMutation.mutateAsync({ id: editingCompanyId, data: companyForm });
  }

  function handleCancelEdit() {
    setEditingCompanyId(null);
    setCompanyForm(EMPTY_COMPANY);
  }

  function handleEditCompany(company) {
    if (company.is_archived) {
      toast({
        title: 'Empresa bloqueada',
        description: 'Desbloqueie a empresa antes de editar.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedCompanyId(company.id);
    setEditingCompanyId(company.id);
    setCompanyForm({
      ...EMPTY_COMPANY,
      tax_id: company.tax_id || company.cnpj || '',
      name: company.name || '',
      trade_name: company.trade_name || '',
      sector: company.sector || '',
      city: company.city || '',
      state: company.state || '',
      legal_type: company.legal_type || '',
      is_individual: !!company.is_individual,
      company_role: company.company_role || 'matriz',
      share_capital:
        company.share_capital != null && company.share_capital !== ''
          ? String(company.share_capital)
          : '',
      societary_composition: company.societary_composition?.length
        ? company.societary_composition
        : EMPTY_COMPANY.societary_composition,
    });
    // sobe o scroll para o formulário
    if (typeof document !== 'undefined') {
      document.getElementById('company-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleToggleBlock(company) {
    const nextBlocked = !company.is_archived;
    setBusyCompanyId(company.id);
    try {
      await base44.entities.Company.update(company.id, { is_archived: nextBlocked });
      invalidateStructureQueries(queryClient, tenantId, 'company');
      setAddedCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, is_archived: nextBlocked } : c)),
      );
      if (nextBlocked && editingCompanyId === company.id) {
        handleCancelEdit();
      }
      toast({
        title: nextBlocked ? 'Empresa bloqueada' : 'Empresa desbloqueada',
        description: nextBlocked
          ? `“${company.name}” ficou inacessível para novos vínculos.`
          : `“${company.name}” voltou a ficar ativa.`,
      });
    } catch (err) {
      toast({
        title: 'Falha ao alterar status',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setBusyCompanyId(null);
    }
  }

  function handleDone() {
    onOpenChange(false);
    onCreated?.({ type: 'group', id: createdGroup?.id, name: createdGroup?.name });
    setStep(1);
    setGroupName('');
    setCompanyForm(EMPTY_COMPANY);
    setAddedCompanies([]);
    setSelectedCompanyId(null);
    setEditingCompanyId(null);
    setBusyCompanyId(null);
    setCreatedGroup(null);
  }

  function handleSubmitGroup() {
    if (!tenantId) {
      toast({
        title: 'Tenant necessário',
        description: 'Selecione um tenant no topo antes de criar o grupo.',
        variant: 'destructive',
      });
      return;
    }
    if (!groupName.trim() || !structureType || !entityNature || !mainSector) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome, estrutura, natureza e setor.',
        variant: 'destructive',
      });
      return;
    }
    if (dupGroup.exact) {
      toast({
        title: 'Nome duplicado',
        description: 'Já existe um grupo com este nome. Escolha outro.',
        variant: 'destructive',
      });
      return;
    }
    groupMutation.mutate({
      name: groupName.trim(),
      structure_type: structureType,
      entity_nature: entityNature,
      main_sector: mainSector,
    });
  }

  function handleReset() {
    setStep(1);
    setGroupName('');
    setStructureType('');
    setEntityNature('');
    setMainSector('');
    setCreatedGroup(null);
    setCompanyForm(EMPTY_COMPANY);
    setAddedCompanies([]);
    setSelectedCompanyId(null);
    setEditingCompanyId(null);
    setBusyCompanyId(null);
  }

  function renderBlockedState() {
    if (tenantLoading) {
      return (
        <div className="flex items-center gap-2 py-6 justify-center text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando sessão…
        </div>
      );
    }
    if (tenantError) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-600">{tenantError}</p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      );
    }
    // No tenantId (HQ or unlinked user) — prompt to pick a tenant
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <p className="text-sm text-slate-600">Selecione um tenant para continuar.</p>
        <Button size="sm" onClick={() => onOpenChange(false)}>
          Fechar e Selecionar Tenant
        </Button>
      </div>
    );
  }

  const stepLabel = !tenantReady
    ? 'Aguardando tenant'
    : step === 1
      ? 'Dados do grupo'
      : 'Empresas do grupo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 overflow-hidden bg-[var(--fal-bg-page,#f8fafc)]"
      >
        {/* Header de sistema */}
        <header className="shrink-0 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Cadastro · DataHub
              </p>
              <DialogTitle className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-slate-900">
                {step === 2 ? (
                  <Building2 className="h-5 w-5 text-blue-600" />
                ) : (
                  <Layers className="h-5 w-5 text-indigo-500" />
                )}
                {step === 2 ? 'Estrutura do Grupo' : 'Criar Grupo / Cliente'}
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                {step === 2
                  ? `Inclua empresas e filiais em “${createdGroup?.name || 'grupo'}”.`
                  : 'Preencha os dados do grupo para iniciar a estrutura societária.'}
              </p>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {[
                { n: 1, label: 'Grupo' },
                { n: 2, label: 'Empresas' },
              ].map((s, idx) => (
                <React.Fragment key={s.n}>
                  {idx > 0 && <div className="h-px w-6 bg-slate-200" />}
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                      step === s.n
                        ? 'bg-blue-600 text-white'
                        : step > s.n
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                      {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    {s.label}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </header>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8 lg:py-8">
            {!tenantReady ? (
              <div className="rounded-xl border bg-white p-8">{renderBlockedState()}</div>
            ) : step === 1 ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 sm:p-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Identificação</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Nome oficial do grupo no DataHub</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Nome do Grupo *</Label>
                      <Input
                        placeholder="Ex: Grupo Cangaia"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className={`mt-1.5 h-11 ${
                          dupGroup.exact
                            ? 'border-red-400 focus-visible:ring-red-300'
                            : dupGroup.similar.length > 0
                              ? 'border-amber-400 focus-visible:ring-amber-300'
                              : ''
                        }`}
                      />
                      {dupGroup.exact && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>Já existe um grupo com este nome. Escolha outro.</span>
                        </div>
                      )}
                      {!dupGroup.exact && dupGroup.similar.length > 0 && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Nome semelhante a:</span>
                            <ul className="mt-0.5 space-y-0.5">
                              {dupGroup.similar.map(({ record }) => (
                                <li key={record.id}>• {record.name}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 sm:p-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Estrutura e segmento</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Classificação operacional do grupo</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <Label className="text-xs text-slate-600">Tipo de estrutura *</Label>
                        <Select value={structureType} onValueChange={setStructureType}>
                          <SelectTrigger className="mt-1.5 h-11">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Grupo empresarial">Grupo empresarial</SelectItem>
                            <SelectItem value="Holding">Holding</SelectItem>
                            <SelectItem value="Condomínio rural">Condomínio rural</SelectItem>
                            <SelectItem value="Grupo familiar">Grupo familiar</SelectItem>
                            <SelectItem value="Cooperativa">Cooperativa</SelectItem>
                            <SelectItem value="Joint venture">Joint venture</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Natureza da entidade *</Label>
                        <Select value={entityNature} onValueChange={setEntityNature}>
                          <SelectTrigger className="mt-1.5 h-11">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Operacional">Operacional</SelectItem>
                            <SelectItem value="Não operacional">Não operacional</SelectItem>
                            <SelectItem value="Mista">Mista</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs text-slate-600">Setor principal *</Label>
                        <Select value={mainSector} onValueChange={setMainSector}>
                          <SelectTrigger className="mt-1.5 h-11">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agricultura">Agricultura</SelectItem>
                            <SelectItem value="Pecuária">Pecuária</SelectItem>
                            <SelectItem value="Agropecuária">Agropecuária</SelectItem>
                            <SelectItem value="Revenda de insumos">Revenda de insumos</SelectItem>
                            <SelectItem value="Indústria agro">Indústria agro</SelectItem>
                            <SelectItem value="Distribuição">Distribuição</SelectItem>
                            <SelectItem value="Holding patrimonial">Holding patrimonial</SelectItem>
                            <SelectItem value="Diversificado">Diversificado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo</p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Nome</dt>
                      <dd className="font-medium text-slate-800">{groupName.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Estrutura</dt>
                      <dd className="font-medium text-slate-800">{structureType || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Natureza</dt>
                      <dd className="font-medium text-slate-800">{entityNature || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Setor</dt>
                      <dd className="font-medium text-slate-800">{mainSector || '—'}</dd>
                    </div>
                  </dl>
                  <p className="mt-5 text-xs leading-relaxed text-slate-400">
                    Depois de criar o grupo, você poderá incluir empresas, filiais e a composição societária.
                  </p>
                </aside>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-600">
                    Grupo <strong className="text-slate-900">{createdGroup?.name}</strong> criado.
                    Cadastre empresas abaixo — a lista do grupo é atualizada a cada inclusão.
                  </p>
                </div>

                <div id="company-form-anchor" className="scroll-mt-4">
                  {editingCompanyId ? (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                      Editando empresa selecionada. Salve ou cancele para voltar ao modo de inclusão.
                    </div>
                  ) : null}
                  <CompanyForm
                    value={companyForm}
                    onChange={setCompanyForm}
                    addedCompanies={addedCompanies.filter((c) => !c.is_archived)}
                    isPending={companyMutation.isPending || updateCompanyMutation.isPending}
                    isEditing={!!editingCompanyId}
                    onAdd={() => handleAddCompany()}
                    onAddAndNext={() => handleAddCompany()}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                  />
                </div>

                <GroupCompaniesList
                  companies={addedCompanies}
                  selectedId={selectedCompanyId}
                  editingId={editingCompanyId}
                  busyId={busyCompanyId}
                  onSelect={setSelectedCompanyId}
                  onEdit={handleEditCompany}
                  onToggleBlock={handleToggleBlock}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer de sistema */}
        <footer className="shrink-0 border-t bg-white">
          <div className="mx-auto flex max-w-6xl flex-col-reverse gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p className="text-xs text-slate-400 sm:order-first">
              Etapa atual: <span className="font-medium text-slate-600">{stepLabel}</span>
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {!tenantReady ? (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              ) : step === 1 ? (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitGroup}
                    disabled={
                      !groupName.trim() ||
                      !structureType ||
                      !entityNature ||
                      !mainSector ||
                      groupMutation.isPending ||
                      !!dupGroup.exact
                    }
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {groupMutation.isPending ? 'Criando...' : 'Criar Grupo e continuar'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={handleDone} className="text-slate-500">
                    {addedCompanies.length > 0 ? 'Concluir depois' : 'Pular por agora'}
                  </Button>
                  {addedCompanies.length > 0 && (
                    <Button
                      onClick={handleDone}
                      className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Concluir ({addedCompanies.length})
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}