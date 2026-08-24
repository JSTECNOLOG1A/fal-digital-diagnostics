/**
 * ImportConfigModal
 * Modal de configuração de importação do balancete.
 *
 * Captura:
 *  - Data-base (MM/AAAA): período de referência
 *  - Nome do período: rótulo visual (Janeiro, 2º trim, Anual, etc.)
 *  - Conta do PL para vazão da DRE (resultado líquido sem encerramento)
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Calendar, ChevronDown, Info, Loader2, Building2 } from 'lucide-react';

function fmtSourcePeriod(p) {
  const m = String(p).match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : p;
}

const PERIOD_NAMES = [
  { value: 'Janeiro',    label: 'Janeiro' },
  { value: 'Fevereiro',  label: 'Fevereiro' },
  { value: 'Março',      label: 'Março' },
  { value: 'Abril',      label: 'Abril' },
  { value: 'Maio',       label: 'Maio' },
  { value: 'Junho',      label: 'Junho' },
  { value: 'Julho',      label: 'Julho' },
  { value: 'Agosto',     label: 'Agosto' },
  { value: 'Setembro',   label: 'Setembro' },
  { value: 'Outubro',    label: 'Outubro' },
  { value: 'Novembro',   label: 'Novembro' },
  { value: 'Dezembro',   label: 'Dezembro' },
  { value: '1º trim',    label: '1º Trimestre' },
  { value: '2º trim',    label: '2º Trimestre' },
  { value: '3º trim',    label: '3º Trimestre' },
  { value: '4º trim',    label: '4º Trimestre' },
  { value: 'Anual',      label: 'Anual' },
];

// Extrai o ano de "MM/AAAA"
function extractYear(raw) {
  const m = raw.trim().match(/^(\d{2})\/(\d{4})$/);
  return m ? m[2] : null;
}

// Converte data + tipo de período para formato backend
function toBackendPeriod(raw, periodName) {
  const m = raw.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!m) return raw.trim();
  const [, month, year] = m;
  
  // Anual → apenas o ano
  if (periodName?.toLowerCase().includes('anual')) {
    return year;
  }
  
  // Trimestral → extrair trimestre (1º = 01-03, 2º = 04-06, etc.)
  if (periodName?.toLowerCase().includes('trim')) {
    const trimNum = periodName.match(/\d+/)?
      [0] : Math.ceil(parseInt(month, 10) / 3);
    const startMonth = (Number(trimNum) - 1) * 3 + 1;
    return `${year}-${String(startMonth).padStart(2, '0')}`;
  }
  
  // Mensal (padrão) → YYYY-MM
  return `${year}-${month}`;
}

// Monta o nome da coluna de exibição: "Janeiro/2024", "2º trim/2024", "Anual/2024"
function buildColumnLabel(periodName, dateBase) {
  const year = extractYear(dateBase);
  if (!year) return periodName;
  return `${periodName}/${year}`;
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.file
 * @param {any=} props.accountPlanId
 * @param {any=} props.tenantId
 * @param {any=} props.onConfirm
 * @param {any=} props.columnLabel
 * @param {any=} props.plAccountCode
 * @param {any=} props.plAccountName
 * @param {any=} props.plCanonicalKey
 * @param {any=} props.sourceEntityId
 * @param {any=} props.sourceEntityName
 * @param {any=} props.sourcePeriod
  * @param {any=} props.onCancel
 */
export default function ImportConfigModal({
  open,
  file,
  accountPlanId,
  tenantId,
  onConfirm,  // ({ periodOverride, columnLabel, plAccountCode, plAccountName, plCanonicalKey, sourceEntityId, sourceEntityName, sourcePeriod })
  onCancel,
  sourceEntityId,    // multi-entidade: entidade-fonte pré-selecionada
  sourceEntityName,
  sourcePeriod,      // YYYY-MM pré-selecionado (opcional)
}) {
  const [dateBase, setDateBase]       = useState('');
  const [periodName, setPeriodName]   = useState('');
  const [plAccountCode, setPlAccount] = useState('');
  const [dateError, setDateError]     = useState('');

  const handlePeriodNameChange = (val) => {
    setPeriodName(val);
    // Se selecionar Anual, autocomplete a data com 01/AAAA
    if (val.toLowerCase() === 'anual' && dateBase) {
      const year = extractYear(dateBase);
      if (year) setDateBase(`01/${year}`);
    }
  };

  // Reseta o formulário ao abrir (novo arquivo selecionado)
  // Multi-entidade: pré-preenche data-base a partir do sourcePeriod (YYYY-MM → MM/AAAA)
  useEffect(() => {
    if (open) {
      let initialDate = '';
      if (sourcePeriod) {
        const m = String(sourcePeriod).match(/^(\d{4})-(\d{2})$/);
        if (m) initialDate = `${m[2]}/${m[1]}`;
        else initialDate = sourcePeriod;
      }
      setDateBase(initialDate);
      setPeriodName(sourcePeriod ? 'Anual' : '');
      setPlAccount('');
      setDateError('');
    }
  }, [open, file?.name, sourcePeriod]);

  // Busca contas do PL no plano de contas vinculado
  const { data: plLines = [], isLoading: loadingPl } = useQuery({
    queryKey: ['pl-accounts', accountPlanId],
    queryFn: () => base44.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: accountPlanId }, 'account_code', 500
    ),
    enabled: !!accountPlanId && open,
    select: (rows) => rows.filter(r => {
      const grp = (r.statement_group || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ck  = (r.canonical_key  || '').toLowerCase();
      const cls = (r.classification || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nm  = (r.account_name   || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return (
        grp.includes('patrimonio') ||
        grp.includes('pl') ||
        ck.startsWith('patrimonio') ||
        ck.includes('resultado_do_exercicio') ||
        ck.includes('lucro_do_exercicio') ||
        ck.includes('prejuizo') ||
        cls.includes('patrimonio') ||
        cls.includes('lucros acumulados') ||
        cls.includes('resultado') ||
        nm.includes('lucros acumulados') ||
        nm.includes('resultado do exercicio') ||
        nm.includes('lucro do exercicio') ||
        nm.includes('prejuizo')
      );
    }),
  });

  // plLines já está filtrado corretamente pelo select acima
  const plOptions = plLines;

  if (!open) return null;

  const handleDateChange = (raw) => {
    // Auto-formata: 2 dígitos + /
    let v = raw.replace(/\D/g, '').slice(0, 6);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    setDateBase(v);
    setDateError('');
  };

  const isDateValid = /^\d{2}\/\d{4}$/.test(dateBase.trim());
  const canConfirm  = isDateValid && !!periodName;

  const handleConfirm = () => {
    if (!isDateValid) {
      setDateError('Informe a data no formato MM/AAAA');
      return;
    }
    const month = parseInt(dateBase.slice(0, 2), 10);
    if (month < 1 || month > 12) {
      setDateError('Mês inválido (01-12)');
      return;
    }
    const selectedPl = plOptions.find(r => r.account_code === plAccountCode) || null;
    // Se tem canonical_key no plano, usar. Senão, não enviar vazão (null)
    const plCanonicalKey = selectedPl?.canonical_key || null;
    onConfirm({
      periodOverride: toBackendPeriod(dateBase, periodName),
      columnLabel:    buildColumnLabel(periodName, dateBase),
      plAccountCode:  selectedPl?.account_code || null,
      plAccountName:  selectedPl?.account_name || null,
      plCanonicalKey: plCanonicalKey,
      sourceEntityId: sourceEntityId || null,
      sourceEntityName: sourceEntityName || null,
      sourcePeriod: toBackendPeriod(dateBase, periodName),
    });
  };

  const year = extractYear(dateBase) || 'AAAA';
  const preview = periodName ? `${periodName}/${year}` : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-auto">

        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">Configurar importação</p>
              <p className="text-sm text-slate-500 mt-0.5 truncate max-w-sm">{file?.name}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Multi-entidade: entidade-fonte pré-selecionada */}
          {sourceEntityId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Entidade-fonte: </span>
                <span className="font-bold text-slate-800">{sourceEntityName || sourceEntityId}</span>
                {sourcePeriod && <span className="text-slate-500"> · Período: <span className="font-bold text-slate-800">{fmtSourcePeriod(sourcePeriod)}</span></span>}
              </div>
            </div>
          )}

          {/* Instruções — Como o sistema funciona */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Como o sistema funciona</p>
                <p>Importe o Excel com contas <strong>devedoras positivas</strong> e <strong>credoras negativas</strong>. O motor FAL normaliza automaticamente os sinais para o padrão auditoria (BP positivo, DRE com receitas positivas e custos negativos), garantindo integridade total e fechamento automático do balanço.</p>
              </div>
            </div>
          </div>

          {/* Data-base + Nome do período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Data-base <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="MM/AAAA"
                value={dateBase}
                onChange={e => handleDateChange(e.target.value)}
                maxLength={7}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${dateError ? 'border-red-400' : 'border-slate-300'}`}
              />
              {dateError && (
                <p className="text-[11px] text-red-500 mt-1">{dateError}</p>
              )}
              {isDateValid && (
                <p className="text-[11px] text-emerald-600 mt-1">✓ Data válida</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Nome do período <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                    value={periodName}
                    onChange={e => handlePeriodNameChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-8"
                  >
                  <option value="">— Selecione —</option>
                  {PERIOD_NAMES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Preview do nome da coluna */}
          {(isDateValid || periodName) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-xs text-slate-500">Nome da coluna nos demonstrativos: </span>
                <span className="text-sm font-bold text-slate-800">{preview}</span>
              </div>
            </div>
          )}

          {/* DRE sem encerramento — conta do PL */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-start gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Considerar o DRE como</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Se o balancete não tiver encerramento contábil, selecione a conta do Patrimônio Líquido
                  que acumula o resultado. O sistema somará automaticamente o <strong>Resultado Líquido da DRE</strong>{' '}
                  ao saldo dessa conta.
                </p>
              </div>
            </div>

            {!accountPlanId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Vincule um plano de contas ao diagnóstico para habilitar esta opção. Sem plano, essa reconciliação não é aplicada.
              </div>
            ) : loadingPl ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas do PL...
              </div>
            ) : plOptions.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                Nenhuma conta de Patrimônio Líquido encontrada no plano. Importe as contas do PL para habilitar esta opção.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={plAccountCode}
                  onChange={e => setPlAccount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-8"
                >
                  <option value="">— Sem vazão (DRE já encerrada) —</option>
                  {plOptions.map(r => (
                    <option key={r.account_code} value={r.account_code}>
                      {r.account_code_display || r.account_code} — {r.account_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {plAccountCode && (
              <p className="text-[11px] text-blue-600 mt-1.5">
                ✓ O resultado líquido da DRE será acumulado na conta selecionada do PL.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar balancete
          </Button>
        </div>
      </div>
    </div>
  );
}