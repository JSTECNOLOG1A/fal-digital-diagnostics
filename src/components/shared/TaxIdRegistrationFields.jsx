import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  fetchCnpjFromReceita,
  formatTaxId,
  isValidTaxIdLength,
  onlyDigits,
} from '@/lib/brazilianDocuments';

/**
 * Tipo de inscrição (PF/PJ) + documento, com consulta automática de CNPJ no blur.
 *
 * @param {Object} props
 * @param {boolean} props.isIndividual — true = Pessoa Física (CPF)
 * @param {string} props.taxId
 * @param {(patch: { isIndividual?: boolean, taxId?: string }) => void} props.onChange
 * @param {(data: Awaited<ReturnType<typeof fetchCnpjFromReceita>>) => void} [props.onCompanyData]
 * @param {boolean} [props.required]
 * @param {string} [props.pjLabel='Pessoa Jurídica']
 * @param {string} [props.pfLabel='Pessoa Física']
 * @param {string} [props.errorExtra] — mensagem extra (ex.: duplicidade)
 * @param {boolean} [props.disabled]
 * @param {string} [props.id]
 */
export default function TaxIdRegistrationFields({
  isIndividual = false,
  taxId = '',
  onChange,
  onCompanyData,
  required = true,
  pjLabel = 'Pessoa Jurídica',
  pfLabel = 'Pessoa Física',
  errorExtra = '',
  disabled = false,
  id = 'tax-id',
}) {
  const [lookupState, setLookupState] = useState('idle'); // idle | loading | found | error
  const [lookupError, setLookupError] = useState('');
  const lastLookedUp = useRef('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const digits = onlyDigits(taxId);
  const complete = isValidTaxIdLength(taxId, isIndividual);

  async function runLookup() {
    if (isIndividual || disabled) return;
    if (digits.length !== 14) return;
    if (lastLookedUp.current === digits && lookupState === 'found') return;

    setLookupState('loading');
    setLookupError('');
    try {
      const data = await fetchCnpjFromReceita(digits);
      if (!mounted.current) return;
      lastLookedUp.current = digits;
      setLookupState('found');
      onCompanyData?.(data);
    } catch (e) {
      if (!mounted.current) return;
      lastLookedUp.current = '';
      setLookupState('error');
      setLookupError(e?.message || 'CNPJ não encontrado');
    }
  }

  function handleTypeChange(nextIndividual) {
    lastLookedUp.current = '';
    setLookupState('idle');
    setLookupError('');
    onChange({ isIndividual: nextIndividual, taxId: '' });
  }

  function handleTaxIdChange(raw) {
    setLookupState('idle');
    setLookupError('');
    onChange({ taxId: formatTaxId(raw, isIndividual) });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Tipo de inscrição{required ? ' *' : ''}</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {[
            { key: false, label: pjLabel },
            { key: true, label: pfLabel },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange(opt.key)}
              className={`py-2.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                isIndividual === opt.key
                  ? 'border-[var(--fal-green-400,#2fa66a)] bg-[var(--fal-green-50,#ecf8f1)] text-[var(--fal-green-700,#1f7a4d)] shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id} className="text-xs text-slate-600">
            {isIndividual ? 'CPF' : 'CNPJ'}
            {required ? ' *' : ''}
          </Label>
          {!isIndividual ? (
            <span className="text-[10px] text-slate-400">Consulta automática ao sair do campo</span>
          ) : null}
        </div>
        <div className="relative mt-1">
          <Input
            id={id}
            disabled={disabled}
            placeholder={isIndividual ? '000.000.000-00' : '00.000.000/0001-00'}
            value={taxId}
            onChange={(e) => handleTaxIdChange(e.target.value)}
            onBlur={() => {
              if (!isIndividual && digits.length === 14) runLookup();
            }}
            className={`pr-9 ${
              lookupState === 'found'
                ? 'border-green-300 focus-visible:ring-green-200'
                : lookupState === 'error'
                  ? 'border-red-300 focus-visible:ring-red-200'
                  : ''
            }`}
            inputMode="numeric"
            autoComplete="off"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {lookupState === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : lookupState === 'found' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : lookupState === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : null}
          </div>
        </div>

        {lookupState === 'loading' && (
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            Consultando Receita Federal…
          </p>
        )}
        {lookupState === 'found' && (
          <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Dados importados da Receita Federal
          </p>
        )}
        {lookupState === 'error' && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {lookupError || 'CNPJ não encontrado — preencha manualmente'}
          </p>
        )}
        {errorExtra ? (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" /> {errorExtra}
          </p>
        ) : null}
        {!complete && taxId && lookupState === 'idle' ? (
          <p className="text-[11px] text-slate-400 mt-1.5">
            {isIndividual ? 'CPF incompleto (11 dígitos).' : 'CNPJ incompleto (14 dígitos).'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
