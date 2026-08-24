import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Square, Save } from 'lucide-react';

const BR_STATES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

/**
 * @param {Object} props
 * @param {any=} props.children
 */
function SectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2 mb-4">{children}</h3>;
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.onChange
 */
function ToggleField({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors"
    >
      {value ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
      {label}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.children
 */
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.client
 */
export default function CompanyProfileForm({ client }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    trade_name: client.trade_name || '',
    foundation_year: client.foundation_year || '',
    website: client.website || '',
    sector: client.sector || '',
    subsector: client.subsector || '',
    primary_activity_description: client.primary_activity_description || '',
    annual_revenue: client.annual_revenue || '',
    employees: client.employees || '',
    company_size: client.company_size || '',
    legal_type: client.legal_type || '',
    number_of_partners: client.number_of_partners || '',
    number_of_entities: client.number_of_entities || '',
    holding_structure: client.holding_structure || false,
    family_business: client.family_business || false,
    locations: client.locations || '',
    operational_units: client.operational_units || '',
    states_of_operation: client.states_of_operation || [],
    international_operations: client.international_operations || false,
    erp_system: client.erp_system || '',
    uses_bi: client.uses_bi || false,
    uses_crm: client.uses_crm || false,
    uses_wms: client.uses_wms || false,
    uses_industry_systems: client.uses_industry_systems || false,
    has_board_of_directors: client.has_board_of_directors || false,
    has_advisory_board: client.has_advisory_board || false,
    has_formal_strategy: client.has_formal_strategy || false,
    has_kpi_dashboard: client.has_kpi_dashboard || false,
    uses_budget: client.uses_budget || false,
    uses_cash_flow_projection: client.uses_cash_flow_projection || false,
    has_bank_debt: client.has_bank_debt || false,
    number_of_banking_relationships: client.number_of_banking_relationships || '',
    diagnostic_objective: client.diagnostic_objective || '',
    consulting_notes: client.consulting_notes || '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleState = (state) => {
    const current = form.states_of_operation;
    set('states_of_operation', current.includes(state) ? current.filter(s => s !== state) : [...current, state]);
  };

  const updateMutation = useMutation({
    mutationFn: (/** @type {any} */ data) => base44.entities.Client.update(client.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', client.id] }),
  });

  const handleSave = () => {
    const payload = { ...form };
    // Convert numeric strings to numbers
    ['foundation_year', 'annual_revenue', 'employees', 'locations', 'operational_units',
     'number_of_partners', 'number_of_entities', 'number_of_banking_relationships'].forEach(k => {
      if (payload[k] !== '' && payload[k] !== null) payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    updateMutation.mutate(payload);
  };

  return (
    <div className="space-y-8">

      {/* 1. Identificação */}
      <section>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nome Fantasia">
            <Input value={form.trade_name} onChange={e => set('trade_name', e.target.value)} placeholder="Nome fantasia" />
          </Field>
          <Field label="Ano de Fundação">
            <Input type="number" value={form.foundation_year} onChange={e => set('foundation_year', e.target.value)} placeholder="Ex: 2005" />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
          </Field>
        </div>
      </section>

      {/* 2. Setor */}
      <section>
        <SectionTitle>Setor de Atuação</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Setor Principal">
            <Select value={form.sector} onValueChange={v => set('sector', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {['Agricultura','Pecuária','Agropecuária','Revenda de insumos','Indústria','Comércio','Serviços','Outro'].map(s =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subsetor">
            <Input value={form.subsector} onChange={e => set('subsector', e.target.value)} placeholder="Ex: Soja, Bovinos, Fertilizantes..." />
          </Field>
          <Field label="Descrição da Atividade Principal">
            <Input value={form.primary_activity_description} onChange={e => set('primary_activity_description', e.target.value)} placeholder="Descreva brevemente..." />
          </Field>
        </div>
      </section>

      {/* 3. Porte */}
      <section>
        <SectionTitle>Porte da Empresa</SectionTitle>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Faturamento Anual (R$)">
            <Input type="number" value={form.annual_revenue} onChange={e => set('annual_revenue', e.target.value)} placeholder="Ex: 5000000" />
          </Field>
          <Field label="Número de Funcionários">
            <Input type="number" value={form.employees} onChange={e => set('employees', e.target.value)} placeholder="Ex: 80" />
          </Field>
          <Field label="Porte">
            <Select value={form.company_size} onValueChange={v => set('company_size', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {['Micro','Pequena','Média','Grande'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {/* 4. Estrutura Societária */}
      <section>
        <SectionTitle>Estrutura Societária</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Field label="Natureza Jurídica">
            <Select value={form.legal_type} onValueChange={v => set('legal_type', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {['LTDA','S/A','Holding','Cooperativa','MEI','EIRELI','Outro'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nº de Sócios">
            <Input type="number" value={form.number_of_partners} onChange={e => set('number_of_partners', e.target.value)} />
          </Field>
          <Field label="Nº de Empresas no Grupo">
            <Input type="number" value={form.number_of_entities} onChange={e => set('number_of_entities', e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <ToggleField label="Estrutura de holding" value={form.holding_structure} onChange={v => set('holding_structure', v)} />
          <ToggleField label="Empresa familiar" value={form.family_business} onChange={v => set('family_business', v)} />
        </div>
      </section>

      {/* 5. Operação */}
      <section>
        <SectionTitle>Estrutura Operacional</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Field label="Unidades Físicas">
            <Input type="number" value={form.locations} onChange={e => set('locations', e.target.value)} />
          </Field>
          <Field label="Unidades Operacionais">
            <Input type="number" value={form.operational_units} onChange={e => set('operational_units', e.target.value)} />
          </Field>
        </div>
        <Field label="Estados de Operação">
          <div className="flex flex-wrap gap-2 mt-1">
            {BR_STATES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleState(s)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                  form.states_of_operation.includes(s)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="mt-4">
          <ToggleField label="Operações internacionais" value={form.international_operations} onChange={v => set('international_operations', v)} />
        </div>
      </section>

      {/* 6. Tecnologia */}
      <section>
        <SectionTitle>Sistemas e Tecnologia</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Sistema ERP">
            <Select value={form.erp_system} onValueChange={v => set('erp_system', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {['SAP','TOTVS','Senior','Sankhya','Omie','Nenhum','Outro'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <ToggleField label="Utiliza BI" value={form.uses_bi} onChange={v => set('uses_bi', v)} />
          <ToggleField label="Utiliza CRM" value={form.uses_crm} onChange={v => set('uses_crm', v)} />
          <ToggleField label="Utiliza WMS" value={form.uses_wms} onChange={v => set('uses_wms', v)} />
          <ToggleField label="Sistemas setoriais" value={form.uses_industry_systems} onChange={v => set('uses_industry_systems', v)} />
        </div>
      </section>

      {/* 7. Governança */}
      <section>
        <SectionTitle>Governança</SectionTitle>
        <div className="flex flex-wrap gap-6">
          <ToggleField label="Possui Conselho de Administração" value={form.has_board_of_directors} onChange={v => set('has_board_of_directors', v)} />
          <ToggleField label="Possui Conselho Consultivo" value={form.has_advisory_board} onChange={v => set('has_advisory_board', v)} />
          <ToggleField label="Possui Planejamento Estratégico formal" value={form.has_formal_strategy} onChange={v => set('has_formal_strategy', v)} />
          <ToggleField label="Possui painel de indicadores (KPIs)" value={form.has_kpi_dashboard} onChange={v => set('has_kpi_dashboard', v)} />
        </div>
      </section>

      {/* 8. Contexto Financeiro */}
      <section>
        <SectionTitle>Contexto Financeiro</SectionTitle>
        <div className="flex flex-wrap gap-6 mb-4">
          <ToggleField label="Utiliza orçamento (Budget)" value={form.uses_budget} onChange={v => set('uses_budget', v)} />
          <ToggleField label="Utiliza projeção de fluxo de caixa" value={form.uses_cash_flow_projection} onChange={v => set('uses_cash_flow_projection', v)} />
          <ToggleField label="Possui dívida bancária" value={form.has_bank_debt} onChange={v => set('has_bank_debt', v)} />
        </div>
        <div className="max-w-xs">
          <Field label="Nº de relacionamentos bancários">
            <Input type="number" value={form.number_of_banking_relationships} onChange={e => set('number_of_banking_relationships', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* 9. Observações */}
      <section>
        <SectionTitle>Contexto do Diagnóstico</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Objetivo do diagnóstico">
            <Textarea value={form.diagnostic_objective} onChange={e => set('diagnostic_objective', e.target.value)}
              placeholder="Ex: Reestruturação financeira, Preparação para crescimento..." rows={3} />
          </Field>
          <Field label="Notas do consultor">
            <Textarea value={form.consulting_notes} onChange={e => set('consulting_notes', e.target.value)}
              placeholder="Observações internas..." rows={3} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </div>

      {updateMutation.isSuccess && (
        <p className="text-center text-sm text-green-600 font-medium">Perfil salvo com sucesso!</p>
      )}
    </div>
  );
}