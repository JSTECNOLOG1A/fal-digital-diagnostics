import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';
import { isValidTaxIdLength } from '@/lib/brazilianDocuments';

const fields = {
  group: [{ key: 'name', label: 'Nome do grupo', placeholder: 'Grupo empresarial', required: true }],
  unit: [{ key: 'name', label: 'Nome da unidade', placeholder: 'Unidade operacional', required: true }],
  diagnostic: [
    { key: 'title', label: 'Nome do primeiro diagnóstico', placeholder: 'Diagnóstico inicial', required: false },
    { key: 'responsible_email', label: 'E-mail do responsável (opcional)', placeholder: 'responsavel@empresa.com', required: false },
  ],
};

export default function OnboardingStepForm({ step, onSubmit, onSkip, busy }) {
  const [values, setValues] = useState({
    is_individual: false,
    tax_id: '',
    name: '',
    trade_name: '',
    city: '',
    state: '',
  });

  if (step === 'company') {
    const canContinue =
      values.name?.trim() &&
      isValidTaxIdLength(values.tax_id, values.is_individual);

    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canContinue) return;
          onSubmit({
            ...values,
            cnpj: values.tax_id,
            tax_id: values.tax_id,
          });
        }}
      >
        <TaxIdRegistrationFields
          isIndividual={!!values.is_individual}
          taxId={values.tax_id || ''}
          onChange={(patch) =>
            setValues((prev) => ({
              ...prev,
              is_individual: patch.isIndividual ?? prev.is_individual,
              tax_id: patch.taxId ?? prev.tax_id,
            }))
          }
          onCompanyData={(data) =>
            setValues((prev) => ({
              ...prev,
              name: data.razaoSocial || prev.name,
              trade_name: data.nomeFantasia || prev.trade_name,
              city: data.city || prev.city,
              state: data.state || prev.state,
            }))
          }
          pjLabel="P. Jurídica"
          pfLabel="P. Física"
        />
        <div className="space-y-1.5">
          <Label htmlFor="company-name">
            {values.is_individual ? 'Nome completo *' : 'Razão social *'}
          </Label>
          <Input
            id="company-name"
            required
            value={values.name || ''}
            placeholder={values.is_individual ? 'Nome do produtor' : 'Empresa principal'}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </div>
        {!values.is_individual && (
          <div className="space-y-1.5">
            <Label htmlFor="trade-name">Nome fantasia</Label>
            <Input
              id="trade-name"
              value={values.trade_name || ''}
              placeholder="Opcional"
              onChange={(e) => setValues({ ...values, trade_name: e.target.value })}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !canContinue} className="flex-1">
            {busy ? 'Salvando...' : 'Continuar'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {(fields[step] || []).map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type={field.key === 'responsible_email' ? 'email' : 'text'}
            required={field.required}
            value={values[field.key] || ''}
            placeholder={field.placeholder}
            onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          {busy ? 'Salvando...' : step === 'diagnostic' ? 'Criar diagnóstico' : 'Continuar'}
        </Button>
        {step === 'unit' && (
          <Button type="button" variant="outline" disabled={busy} onClick={onSkip}>
            Pular unidade
          </Button>
        )}
      </div>
    </form>
  );
}
