import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle, Loader2, CheckCircle2, GitBranch, Plus, Trash2 } from 'lucide-react';
import { invalidateStructureQueries } from '@/lib/query-client';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';

const SECTORS = ['Agricultura', 'Pecuária', 'Agropecuária', 'Revenda de insumos', 'Indústria', 'Comércio', 'Serviços', 'Outro'];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const COMPANY_ROLES_PJ = [
  { value: 'matriz',        label: 'Matriz' },
  { value: 'holding',       label: 'Holding' },
  { value: 'sub_holding',   label: 'Sub-Holding' },
  { value: 'filial',        label: 'Filial' },
  { value: 'investida',     label: 'Investida' },
  { value: 'joint_venture', label: 'Joint Venture' },
  { value: 'coligada',      label: 'Coligada' },
];

const COMPANY_ROLES_PF = [
  { value: 'pf_lider',      label: 'PF Líder de Condomínio' },
  { value: 'pf_membro',     label: 'Membro de Condomínio / Produtor' },
  { value: 'pf_direto',     label: 'Produtor Individual (Direto)' },
];

const EMPTY = {
  tax_id: '', state_registration: '', name: '', trade_name: '',
  sector: '', city: '', state: '', is_individual: false,
  company_role: 'matriz', share_capital: '',
  societary_composition: [
    { partner_type: 'third_party', partner_name: 'Terceiros (Sócios Externos)', equity_percentage: '100' }
  ],
};

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.tenantId
 * @param {any=} props.groupId
 * @param {any=} props.groupName
 * @param {any=} props.companies
 * @param {any=} props.onCreated
 */
export default function CreateCompanyDialog({ open, onOpenChange, tenantId, groupId, groupName, companies = [], onCreated }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateComposition = (index, field, value) => {
    setForm((prev) => {
      const comp = [...prev.societary_composition];
      comp[index] = { ...comp[index], [field]: value };
      return { ...prev, societary_composition: comp };
    });
  };

  const removeComposition = (index) => {
    setForm((prev) => ({
      ...prev,
      societary_composition: prev.societary_composition.filter((_, i) => i !== index),
    }));
  };

  const addComposition = () => {
    setForm((prev) => ({
      ...prev,
      societary_composition: [
        ...prev.societary_composition,
        { partner_type: 'third_party', partner_name: 'Terceiros (Sócios Externos)', equity_percentage: '' },
      ],
    }));
  };

  const taxIdDigitsCount = form.tax_id.replace(/\D/g, '').length;
  const taxIdValid = form.is_individual ? taxIdDigitsCount === 11 : taxIdDigitsCount === 14;

  const totalEquity = form.societary_composition.reduce((sum, partner) => {
    const pct = parseFloat(String(partner.equity_percentage || '0').replace(',', '.'));
    return sum + (isNaN(pct) ? 0 : pct);
  }, 0);
  const isEquityValid = Math.abs(totalEquity - 100) < 0.01;
  const equityError = !isEquityValid && form.societary_composition.some((c) => c.equity_percentage);
  const hasPartnerData = form.societary_composition.some((p) => p.equity_percentage);

  const cnpjDuplicate = (() => {
    if (!form.tax_id) return false;
    const normalizedTaxId = form.tax_id.replace(/\D/g, '');
    return companies.some(
      (c) => c.tax_id && c.tax_id.replace(/\D/g, '') === normalizedTaxId,
    );
  })();

  const canSubmit =
    taxIdValid &&
    form.name.trim() &&
    form.share_capital &&
    (!hasPartnerData || isEquityValid) &&
    !cnpjDuplicate;

  const mutation = useMutation({
    mutationFn: async () => {
      let newCompany;
      try {
        newCompany = await base44.entities.Company.create({
          tenant_id: tenantId,
          group_id: groupId || undefined,
          name: form.name.trim(),
          trade_name: form.trade_name.trim() || undefined,
          tax_id: form.tax_id,
          cnpj: form.is_individual ? undefined : form.tax_id,
          is_individual: form.is_individual,
          state_registration: form.state_registration.trim() || undefined,
          sector: form.sector || undefined,
          city: form.city.trim() || undefined,
          state: form.state || undefined,
          company_role: form.company_role || undefined,
          share_capital: form.share_capital
            ? parseFloat(String(form.share_capital).replace(/\./g, '').replace(',', '.'))
            : undefined,
          societary_composition: [],
        });
      } catch (err) {
        const errMsg = err?.message || 'Falha desconhecida ao criar empresa';
        throw new Error(`fatal_company_creation:${errMsg}`);
      }

      if (form.societary_composition?.length > 0) {
        const linksPayload = form.societary_composition
          .filter((partner) => partner.equity_percentage)
          .map((partner) => {
            const isGroupCompany = partner.partner_type === 'group_company';
            const pct = parseFloat(String(partner.equity_percentage || '0').replace(',', '.'));
            return {
              tenant_id: tenantId,
              group_id: groupId,
              investor_company_id: isGroupCompany ? partner.company_id : null,
              investor_person_name: !isGroupCompany ? partner.partner_name.trim() : null,
              invested_company_id: newCompany.id,
              percentage: pct,
              relationship_type: isGroupCompany ? 'quotista' : 'investidor_pessoa_fisica',
              is_controller: pct > 50,
            };
          });

        if (linksPayload.length > 0) {
          try {
            await base44.entities.CompanyOwnershipLink.bulkCreate(linksPayload);
          } catch (linkErr) {
            return {
              company: newCompany,
              status: 'partial_failed',
              error: linkErr?.message || 'Falha desconhecida ao criar vínculos societários',
            };
          }
        }
      }

      return { company: newCompany, status: 'success' };
    },
  });

  const resetForm = () => setForm(EMPTY);

  const handleAddAndClose = async () => {
    try {
      const result = await mutation.mutateAsync();
      invalidateStructureQueries(queryClient, tenantId, 'group');
      resetForm();
      onCreated?.();
      onOpenChange(false);

      if (result.status === 'partial_failed') {
        toast({
          variant: 'warning',
          title: 'Atenção: Sucesso Parcial',
          description:
            'A empresa foi criada, mas os vínculos societários falharam ao salvar. Preencha-os manualmente na aba Societária.',
          duration: 8000,
        });
      } else {
        toast({
          title: 'Empresa salva',
          description: 'Empresa e composição societária salvas com sucesso.',
        });
      }
    } catch (err) {
      const message = err?.message?.startsWith('fatal_company_creation:')
        ? err.message.replace('fatal_company_creation:', '')
        : err?.message || 'Verifique os dados informados.';
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar empresa',
        description: message,
      });
    }
  };

  const handleAddAndContinue = async () => {
    try {
      const result = await mutation.mutateAsync();
      invalidateStructureQueries(queryClient, tenantId, 'group');
      resetForm();
      onCreated?.();

      if (result.status === 'partial_failed') {
        toast({
          variant: 'warning',
          title: 'Atenção: Sucesso Parcial',
          description:
            'A empresa foi criada, mas os vínculos societários falharam. Revise na aba Societária.',
          duration: 8000,
        });
      } else {
        toast({
          title: 'Empresa adicionada',
          description: 'Cadastre outra empresa ou finalize.',
        });
      }
    } catch (err) {
      const message = err?.message?.startsWith('fatal_company_creation:')
        ? err.message.replace('fatal_company_creation:', '')
        : err?.message || 'Verifique os dados informados.';
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar empresa',
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 overflow-hidden bg-[var(--fal-bg-page,#f8fafc)]">
        <header className="shrink-0 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Cadastro · Estrutura
              </p>
              <DialogTitle className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-slate-900">
                <Building2 className="h-5 w-5 text-blue-600" />
                Estrutura do Grupo
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                Grupo <strong className="text-slate-800">{groupName || '—'}</strong>.
                Inclua empresas e filiais da estrutura.
              </p>
            </div>
            {companies.length > 0 ? (
              <div className="hidden rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 sm:block">
                {companies.length} empresa{companies.length > 1 ? 's' : ''} já no grupo
              </div>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 px-6 py-6 lg:px-8 lg:py-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
              {/* Identificação + localização */}
              <div className="space-y-6">
                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Identificação</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Documento e dados cadastrais</p>
                  </div>

                  <TaxIdRegistrationFields
                    isIndividual={form.is_individual}
                    taxId={form.tax_id}
                    onChange={(patch) => {
                      setForm((prev) => ({
                        ...prev,
                        is_individual: patch.isIndividual ?? prev.is_individual,
                        tax_id: patch.taxId ?? prev.tax_id,
                        company_role:
                          patch.isIndividual === undefined
                            ? prev.company_role
                            : patch.isIndividual
                              ? 'pf_direto'
                              : 'matriz',
                      }));
                    }}
                    onCompanyData={(data) => {
                      setForm((prev) => ({
                        ...prev,
                        name: data.razaoSocial || prev.name,
                        trade_name: data.nomeFantasia || prev.trade_name,
                        city: data.city || prev.city,
                        state: data.state || prev.state,
                        share_capital: data.shareCapital || prev.share_capital,
                      }));
                    }}
                    errorExtra={cnpjDuplicate ? 'Esta empresa já foi cadastrada' : ''}
                    pjLabel="P. Jurídica"
                    pfLabel="P. Física"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-slate-600">Razão Social *</Label>
                      <Input
                        className="mt-1.5 h-10"
                        placeholder="Ex: Agro Cangaia Ltda."
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-slate-600">Nome Fantasia</Label>
                      <Input
                        className="mt-1.5 h-10"
                        placeholder="Opcional"
                        value={form.trade_name}
                        onChange={(e) => set('trade_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Tipo Societário / Papel</Label>
                      <Select value={form.company_role} onValueChange={(v) => set('company_role', v)}>
                        <SelectTrigger className="mt-1.5 h-10">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(form.is_individual ? COMPANY_ROLES_PF : COMPANY_ROLES_PJ).map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Setor</Label>
                      <Select value={form.sector} onValueChange={(v) => set('sector', v)}>
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

                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Localização</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Município e UF</p>
                  </div>
                  <div className="grid grid-cols-[1fr_120px] gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Município</Label>
                      <Input
                        className="mt-1.5 h-10"
                        placeholder="Ex: Rio Verde"
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">UF</Label>
                      <Select value={form.state} onValueChange={(v) => set('state', v)}>
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

              {/* Hierarquia */}
              <section className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <GitBranch className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Hierarquia Societária</h3>
                    <p className="text-xs text-slate-400">Capital e composição de sócios</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Capital Social *</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      R$
                    </span>
                    <Input
                      className="h-10 pl-10"
                      placeholder="Ex: 1.000.000"
                      value={form.share_capital}
                      onChange={(e) => set('share_capital', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Composição Societária</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
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
                    <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>A soma das participações deve ser exatamente 100%</span>
                    </div>
                  )}

                  {isEquityValid && form.societary_composition.some((c) => c.equity_percentage) && (
                    <div className="flex items-start gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>Composição societária validada (100%)</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {form.societary_composition.map((partner, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                      >
                        <div className="min-w-[160px] flex-1 space-y-1">
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
                          <div className="min-w-[160px] flex-1 space-y-1">
                            <Label className="text-xs text-slate-500">Empresa</Label>
                            <Select
                              value={partner.company_id || ''}
                              onValueChange={(v) => {
                                const comp = companies.find((c) => c.id === v);
                                updateComposition(idx, 'company_id', v);
                                if (comp) updateComposition(idx, 'partner_name', comp.name);
                              }}
                            >
                              <SelectTrigger className="h-9 bg-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map((c) => (
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
                              className="h-9 bg-white pr-7"
                              placeholder="0,00"
                              value={partner.equity_percentage}
                              onChange={(e) =>
                                updateComposition(
                                  idx,
                                  'equity_percentage',
                                  e.target.value.replace(/[^0-9.,]/g, ''),
                                )
                              }
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                              %
                            </span>
                          </div>
                        </div>

                        {form.societary_composition.length > 1 && (
                          <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                            onClick={() => removeComposition(idx)}
                            aria-label="Remover sócio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addComposition}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> Adicionar Sócio
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t bg-white">
          <div className="mx-auto flex max-w-6xl flex-col-reverse gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <Button variant="ghost" className="text-slate-500" onClick={() => onOpenChange(false)}>
              Pular por agora
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={!canSubmit || mutation.isPending}
                onClick={handleAddAndContinue}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Salvar e incluir outra
              </Button>
              <Button
                className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                disabled={!canSubmit || mutation.isPending}
                onClick={handleAddAndClose}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Salvar e finalizar
              </Button>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
