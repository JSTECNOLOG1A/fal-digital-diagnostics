import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Building2, MapPin, Info, Search, Loader2, CheckCircle2, AlertCircle, GitBranch } from 'lucide-react';
import { useDuplicateCheck } from '@/components/shared/useDuplicateCheck';
import { invalidateStructureQueries } from '@/lib/query-client';

const COMPANY_ROLES_PJ = [
  { value: 'holding',      label: 'Holding' },
  { value: 'matriz',       label: 'Matriz' },
  { value: 'sub_holding',  label: 'Sub-Holding' },
  { value: 'filial',       label: 'Filial' },
  { value: 'investida',    label: 'Investida' },
  { value: 'joint_venture',label: 'Joint Venture' },
  { value: 'coligada',     label: 'Coligada' },
  { value: 'condominio',   label: 'Condomínio Rural (PJ/Grupo)' },
];

const COMPANY_ROLES_PF = [
  { value: 'pf_lider',     label: 'PF Líder de Condomínio' },
  { value: 'pf_membro',    label: 'Membro de Condomínio / Produtor' },
  { value: 'pf_direto',    label: 'Produtor Individual (Direto)' },
];

const UNIT_TYPES = ['Fazenda', 'Filial / Revenda', 'Unidade Operacional'];
const SECTORS = ['Agricultura', 'Pecuária', 'Agropecuária', 'Revenda de insumos', 'Indústria', 'Comércio', 'Serviços', 'Outro'];
const LEGAL_TYPES = ['LTDA', 'S/A', 'Holding', 'Cooperativa', 'MEI', 'EIRELI', 'Outro'];
const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

async function fetchCNPJData(cnpj) {
  const digits = cnpj.replace(/\D/g, '');
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) throw new Error('CNPJ não encontrado');
  return res.json();
}

function formatCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function formatCPF(value) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
    .slice(0, 14);
}

const ENTITY_META = {
  group:   { icon: Layers,    color: 'text-indigo-500', label: 'Grupo',   entityName: 'Group' },
  company: { icon: Building2, color: 'text-blue-500',   label: 'Empresa', entityName: 'Company' },
  unit:    { icon: MapPin,    color: 'text-emerald-500', label: 'Unidade', entityName: 'OperationalUnit' },
};

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.entityType
 * @param {any=} props.entity
 * @param {any=} props.onSaved
 */
export default function EditEntityDialog({ open, onOpenChange, entityType, entity, onSaved }) {
  const queryClient = useQueryClient();
  const meta = ENTITY_META[entityType];

  const [form, setForm] = useState({
    name: '', trade_name: '', tax_id: '', state_registration: '',
    legal_type: '', sector: '', city: '', state: '', is_individual: false,
    unit_type: 'Fazenda', unit_cnpj: '', structure_type: '', entity_nature: '', main_sector: '',
    company_role: '', parent_company_id: '', equity_stake_percentage: '', share_capital: '',
  });
  const [cnpjLookupState, setCnpjLookupState] = useState('idle');

  // Busca empresas irmãs do mesmo grupo para o select de controladora
  const { data: siblingCompanies = [] } = useQuery({
    queryKey: ['companies-sibling-edit', entity?.group_id],
    queryFn: () => base44.entities.Company.filter({ group_id: entity.group_id }),
    enabled: open && entityType === 'company' && !!entity?.group_id,
    select: (data) => data.filter(c => c.id !== entity?.id),
  });

  useEffect(() => {
    if (entity && open) {
      const isInd = (entity.tax_id || '').replace(/\D/g, '').length === 11;
      setForm({
        name: entity.name || '',
        trade_name: entity.trade_name || '',
        tax_id: entity.tax_id || '',
        state_registration: entity.state_registration || '',
        legal_type: entity.legal_type || '',
        sector: entity.sector || '',
        city: entity.city || '',
        state: entity.state || '',
        is_individual: isInd,
        unit_type: entity.unit_type || 'Fazenda',
        unit_cnpj: entity.unit_cnpj || '',
        structure_type: entity.structure_type || '',
        entity_nature: entity.entity_nature || '',
        main_sector: entity.main_sector || '',
        company_role: entity.company_role || '',
        parent_company_id: entity.parent_company_id || '',
        equity_stake_percentage: entity.equity_stake_percentage != null ? String(entity.equity_stake_percentage) : '',
        share_capital: entity.share_capital != null ? String(entity.share_capital) : '',
      });
      setCnpjLookupState('idle');
    }
  }, [entity, open]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  async function handleCnpjLookup() {
    setCnpjLookupState('loading');
    try {
      const data = await fetchCNPJData(form.tax_id);
      setForm(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        trade_name: data.nome_fantasia || prev.trade_name,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      setCnpjLookupState('found');
    } catch {
      setCnpjLookupState('error');
    }
  }

  const dupCompany = useDuplicateCheck(
    entityType === 'company' ? form.name : '',
    'Company',
    { tenant_id: entity?.tenant_id || '__none__' }
  );

  const taxIdDigits = (form.tax_id || '').replace(/\D/g, '').length;
  const taxIdValid = entityType !== 'company' || (form.is_individual ? taxIdDigits === 11 : taxIdDigits === 14);
  const isNameChanged = form.name.trim() !== (entity?.name || '').trim();
  const hasDupConflict = entityType === 'company' && isNameChanged && dupCompany.exact;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim() };
      if (entityType === 'unit') {
        payload.unit_type = form.unit_type;
        if (form.unit_type === 'Filial / Revenda') {
          payload.unit_cnpj = form.unit_cnpj || null;
          payload.is_individual = form.is_individual;
        }
        payload.city = form.city.trim() || null;
        payload.location_state = form.state || null;
      }
      if (entityType === 'company') {
        payload.trade_name = form.trade_name.trim() || null;
        payload.tax_id = form.tax_id;
        payload.is_individual = form.is_individual;
        payload.state_registration = form.state_registration.trim() || null;
        payload.legal_type = form.legal_type || null;
        payload.sector = form.sector || null;
        payload.city = form.city.trim() || null;
        payload.state = form.state || null;
        payload.company_role = form.company_role || null;
        payload.parent_company_id = form.parent_company_id || null;
        payload.equity_stake_percentage = form.equity_stake_percentage
          ? parseFloat(String(form.equity_stake_percentage).replace(',', '.'))
          : null;
        payload.share_capital = form.share_capital
          ? parseFloat(String(form.share_capital).replace(/\./g, '').replace(',', '.'))
          : null;
      }
      if (entityType === 'group') {
        if (form.structure_type) payload.structure_type = form.structure_type;
        if (form.entity_nature)  payload.entity_nature  = form.entity_nature;
        if (form.main_sector)    payload.main_sector    = form.main_sector;
      }
      return base44.entities[meta.entityName].update(entity.id, payload);
    },
    onSuccess: (updated) => {
      invalidateStructureQueries(queryClient, entity?.tenant_id);
      onSaved?.(updated);
      onOpenChange(false);
    },
  });

  if (!meta || !entity) return null;
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={entityType === 'company' ? 'max-w-md' : 'max-w-sm'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${meta.color}`} />
            Editar {meta.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[68vh] overflow-y-auto pr-1">

          {/* ── EMPRESA ───────────────────────────────────────────── */}
          {entityType === 'company' && (
            <>
              <TaxIdRegistrationFields
                isIndividual={form.is_individual}
                taxId={form.tax_id}
                onChange={(patch) => {
                  setForm((prev) => ({
                    ...prev,
                    is_individual: patch.isIndividual ?? prev.is_individual,
                    tax_id: patch.taxId ?? prev.tax_id,
                  }));
                }}
                onCompanyData={(data) => {
                  setForm((prev) => ({
                    ...prev,
                    name: data.razaoSocial || prev.name,
                    trade_name: data.nomeFantasia || prev.trade_name,
                    city: data.city || prev.city,
                    state: data.state || prev.state,
                  }));
                }}
                pjLabel="P. Jurídica"
                pfLabel="P. Física"
              />

              {/* Inscrição Estadual */}
              <div>
                <Label>Inscrição Estadual</Label>
                <Input placeholder="Opcional" value={form.state_registration}
                  onChange={e => set('state_registration', e.target.value)} />
              </div>

              {/* Razão Social */}
              <div>
                <Label>Razão Social *</Label>
                <Input
                  placeholder="Ex: Agro Cangaia Ltda."
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className={hasDupConflict ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {hasDupConflict && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Já existe outra empresa com este nome.
                  </p>
                )}
              </div>

              {/* Nome Fantasia */}
              <div>
                <Label>Nome Fantasia</Label>
                <Input placeholder="Ex: Cangaia Agro" value={form.trade_name}
                  onChange={e => set('trade_name', e.target.value)} />
              </div>

              {/* Tipo Societário */}
              <div>
                <Label>Tipo Societário</Label>
                <Select value={form.legal_type} onValueChange={v => set('legal_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {LEGAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Setor */}
              <div>
                <Label>Setor</Label>
                <Select value={form.sector} onValueChange={v => set('sector', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Hierarquia Societária */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-slate-700">Hierarquia Societária</span>
                  <span className="text-xs text-slate-400">(opcional)</span>
                </div>

                <div>
                   <Label className="text-xs">Papel no Grupo</Label>
                   <Select value={form.company_role || '__none_role__'} onValueChange={v => set('company_role', v === '__none_role__' ? '' : v)}>
                     <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Selecione o papel..." /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="__none_role__">Não definido</SelectItem>
                       {(form.is_individual ? COMPANY_ROLES_PF : COMPANY_ROLES_PJ).map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>

                {siblingCompanies.length > 0 && (
                  <div>
                    <Label className="text-xs">
                      {form.is_individual 
                        ? "Condomínio Vinculado (deixe vazio se for Direto no Grupo)" 
                        : "Empresa Controladora / Matriz"}
                    </Label>
                    <Select value={form.parent_company_id || '__none__'} onValueChange={v => set('parent_company_id', v === '__none__' ? '' : v)}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder={form.is_individual ? "Nenhum (Direto no Grupo)" : "Nenhuma (raiz do grupo)"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{form.is_individual ? "Nenhum (Direto no Grupo)" : "Nenhuma (raiz do grupo)"}</SelectItem>
                        {siblingCompanies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">% de Participação</Label>
                    <div className="relative mt-1">
                      <Input
                        placeholder="Ex: 75,5"
                        value={form.equity_stake_percentage}
                        onChange={e => set('equity_stake_percentage', e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="h-8 text-xs pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Capital Social</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
                      <Input
                        placeholder="Ex: 1.000.000"
                        value={form.share_capital}
                        onChange={e => set('share_capital', e.target.value)}
                        className="h-8 text-xs pl-7"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Município e Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Município</Label>
                  <Input placeholder="Ex: Rio Verde" value={form.city}
                    onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Select value={form.state} onValueChange={v => set('state', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ── GRUPO ou UNIDADE — só Nome ─────────────────────── */}
          {entityType !== 'company' && (
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={`Nome do ${meta.label.toLowerCase()}`}
                className="mt-1"
              />
            </div>
          )}

          {/* ── UNIDADE — tipo ────────────────────────────────── */}
          {entityType === 'unit' && (
            <>
              <div>
                <Label>Tipo de Unidade</Label>
                <Select value={form.unit_type} onValueChange={v => set('unit_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.unit_type === 'Filial / Revenda' && (
                <TaxIdRegistrationFields
                  isIndividual={form.is_individual}
                  taxId={form.unit_cnpj}
                  onChange={(patch) => {
                    setForm((prev) => ({
                      ...prev,
                      is_individual: patch.isIndividual ?? prev.is_individual,
                      unit_cnpj: patch.taxId ?? prev.unit_cnpj,
                    }));
                  }}
                  onCompanyData={(data) => {
                    setForm((prev) => ({
                      ...prev,
                      name: data.nomeFantasia || data.razaoSocial || prev.name,
                      city: data.city || prev.city,
                      state: data.state || prev.state,
                    }));
                  }}
                  pjLabel="P. Jurídica"
                  pfLabel="P. Física"
                />
              )}
            </>
          )}

          {/* ── GRUPO — campos adicionais ─────────────────────── */}
          {entityType === 'group' && (
            <>
              <div>
                <Label>Tipo de estrutura</Label>
                <Select value={form.structure_type} onValueChange={v => set('structure_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['Grupo empresarial','Holding','Condomínio rural','Grupo familiar','Cooperativa','Joint venture','Outro'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Natureza da entidade</Label>
                <Select value={form.entity_nature} onValueChange={v => set('entity_nature', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operacional">Operacional</SelectItem>
                    <SelectItem value="Não operacional">Não operacional</SelectItem>
                    <SelectItem value="Mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor principal</Label>
                <Select value={form.main_sector} onValueChange={v => set('main_sector', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['Agricultura','Pecuária','Agropecuária','Revenda de insumos','Indústria agro','Distribuição','Holding patrimonial','Diversificado'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Após editar, os assessments existentes não são afetados. Novos diagnósticos usarão os dados atualizados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name.trim() || !taxIdValid || hasDupConflict || mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}