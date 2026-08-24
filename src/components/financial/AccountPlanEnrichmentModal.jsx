/**
 * AccountPlanEnrichmentModal
 * Exibido após validação quando contas sintéticas (S) não foram encontradas no plano de contas.
 * Permite ao usuário classificar cada conta ausente e adicioná-la ao plano.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';

// Opções canônicas agrupadas para o dropdown
const CANONICAL_OPTIONS = [
  { group: 'BP — Ativo Circulante', options: [
    { value: 'ativo_circulante_caixa',         label: 'Caixa e Equivalentes de Caixa' },
    { value: 'ativo_circulante_receber',        label: 'Contas a Receber' },
    { value: 'ativo_circulante_estoques',       label: 'Estoques' },
    { value: 'ativo_circulante_impostos',       label: 'Impostos a Recuperar' },
    { value: 'ativo_circulante_biologicos',     label: 'Ativos Biológicos' },
    { value: 'ativo_circulante_outros',         label: 'Outros Créditos' },
  ]},
  { group: 'BP — Ativo Não Circulante', options: [
    { value: 'ativo_nc_aplicacoes',             label: 'Aplicações Financeiras' },
    { value: 'ativo_nc_receber_lp',             label: 'Contas a Receber LP' },
    { value: 'ativo_nc_impostos_lp',            label: 'Impostos a Recuperar LP' },
    { value: 'ativo_nc_impostos_diferidos',     label: 'Impostos Diferidos' },
    { value: 'ativo_nc_outros_creditos',        label: 'Outros Créditos LP' },
    { value: 'ativo_nc_investimentos',          label: 'Investimentos' },
    { value: 'ativo_nc_direitos_uso',           label: 'Direitos de Uso' },
    { value: 'ativo_nao_circulante',            label: 'Imobilizado' },
    { value: 'ativo_nc_intangivel',             label: 'Intangível' },
  ]},
  { group: 'BP — Passivo Circulante', options: [
    { value: 'passivo_circulante_trabalhistas', label: 'Obrigações Trabalhistas' },
    { value: 'passivo_circulante_fiscais',      label: 'Obrigações Fiscais' },
    { value: 'passivo_circulante_fornecedores', label: 'Fornecedores' },
    { value: 'passivo_circulante_emprestimos',  label: 'Empréstimos e Financiamentos CP' },
    { value: 'passivo_circulante_imoveis',      label: 'Obrig. por Aquisição de Imóveis' },
    { value: 'passivo_circulante_arrendamentos',label: 'Arrendamentos a Pagar CP' },
    { value: 'passivo_circulante_adiantamentos',label: 'Adiantamentos de Clientes' },
    { value: 'passivo_circulante_outros',       label: 'Outras Contas a Pagar' },
  ]},
  { group: 'BP — Passivo Não Circulante', options: [
    { value: 'passivo_nao_circulante',          label: 'Empréstimos e Financiamentos LP' },
    { value: 'passivo_nc_imoveis_lp',           label: 'Obrig. por Aquisição de Imóveis LP' },
    { value: 'passivo_nc_arrendamentos_lp',     label: 'Arrendamentos a Pagar LP' },
  ]},
  { group: 'BP — Patrimônio Líquido', options: [
    { value: 'patrimonio_capital',              label: 'Capital Social' },
    { value: 'patrimonio_reservas',             label: 'Reservas' },
    { value: 'patrimonio_reservas_fiscais',     label: 'Reserva de Incentivos Fiscais' },
    { value: 'patrimonio_liquido',              label: 'Lucros Acumulados' },
    { value: 'patrimonio_prejuizos',            label: 'Prejuízos Acumulados' },
  ]},
  { group: 'DRE — Receita', options: [
    { value: 'receita_bruta',                   label: 'Receita Bruta' },
    { value: 'deducoes_tributarias',            label: '(-) Deduções Tributárias' },
    { value: 'devolucoes_abatimentos',          label: '(-) Devoluções e Abatimentos' },
  ]},
  { group: 'DRE — Custo', options: [
    { value: 'custo_produtos',                  label: '(-) Custo dos Produtos/Serviços' },
  ]},
  { group: 'DRE — Despesas Operacionais', options: [
    { value: 'despesas_gerais_admin',           label: '(-) Gerais e Administrativas' },
    { value: 'despesas_comerciais',             label: '(-) Comerciais' },
    { value: 'outras_receitas_despesas',        label: '(+/-) Outras Receitas e Despesas' },
    { value: 'despesas_tributarias',            label: '(-) Despesas Tributárias' },
  ]},
  { group: 'DRE — Resultado Financeiro', options: [
    { value: 'receitas_financeiras',            label: '(+) Receitas Financeiras' },
    { value: 'despesas_financeiras',            label: '(-) Despesas Financeiras' },
  ]},
  { group: 'DRE — Impostos', options: [
    { value: 'ir_csll',                         label: '(-) IR e CSLL Correntes' },
    { value: 'ir_diferido',                     label: '(-) IR e CSLL Diferidos' },
  ]},
];

// Lookup flat: canonical_key → label
const CANONICAL_LABEL = {};
for (const grp of CANONICAL_OPTIONS) {
  for (const opt of grp.options) {
    CANONICAL_LABEL[opt.value] = opt.label;
  }
}

// Lookup: canonical_key → statement_code + statement_group
const CANONICAL_META_FRONTEND = {
  ativo_circulante_caixa:         { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_circulante_receber:       { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_circulante_estoques:      { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_circulante_impostos:      { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_circulante_biologicos:    { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_circulante_outros:        { statement_code: 'BP', statement_group: 'Ativo circulante',       sign_rule: 'normal' },
  ativo_nc_aplicacoes:            { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_receber_lp:            { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_impostos_lp:           { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_impostos_diferidos:    { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_outros_creditos:       { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_investimentos:         { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_direitos_uso:          { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nao_circulante:           { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  ativo_nc_intangivel:            { statement_code: 'BP', statement_group: 'Ativo não circulante',   sign_rule: 'normal' },
  passivo_circulante_trabalhistas:{ statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_circulante_fiscais:     { statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_circulante_fornecedores:{ statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_circulante_emprestimos: { statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_circulante_imoveis:     { statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_circulante_arrendamentos:{ statement_code: 'BP', statement_group: 'Passivo circulante',   sign_rule: 'inverted' },
  passivo_circulante_adiantamentos:{ statement_code: 'BP', statement_group: 'Passivo circulante',   sign_rule: 'inverted' },
  passivo_circulante_outros:      { statement_code: 'BP', statement_group: 'Passivo circulante',     sign_rule: 'inverted' },
  passivo_nao_circulante:         { statement_code: 'BP', statement_group: 'Passivo não circulante', sign_rule: 'inverted' },
  passivo_nc_imoveis_lp:          { statement_code: 'BP', statement_group: 'Passivo não circulante', sign_rule: 'inverted' },
  passivo_nc_arrendamentos_lp:    { statement_code: 'BP', statement_group: 'Passivo não circulante', sign_rule: 'inverted' },
  patrimonio_capital:             { statement_code: 'BP', statement_group: 'Patrimônio líquido',     sign_rule: 'inverted' },
  patrimonio_reservas:            { statement_code: 'BP', statement_group: 'Patrimônio líquido',     sign_rule: 'inverted' },
  patrimonio_reservas_fiscais:    { statement_code: 'BP', statement_group: 'Patrimônio líquido',     sign_rule: 'inverted' },
  patrimonio_liquido:             { statement_code: 'BP', statement_group: 'Patrimônio líquido',     sign_rule: 'inverted' },
  patrimonio_prejuizos:           { statement_code: 'BP', statement_group: 'Patrimônio líquido',     sign_rule: 'inverted' },
  receita_bruta:                  { statement_code: 'DRE', statement_group: 'Receita',               sign_rule: 'inverted' },
  deducoes_tributarias:           { statement_code: 'DRE', statement_group: 'Receita',               sign_rule: 'normal' },
  devolucoes_abatimentos:         { statement_code: 'DRE', statement_group: 'Receita',               sign_rule: 'normal' },
  custo_produtos:                 { statement_code: 'DRE', statement_group: 'Custo',                 sign_rule: 'normal' },
  despesas_gerais_admin:          { statement_code: 'DRE', statement_group: 'Despesas operacionais', sign_rule: 'normal' },
  despesas_comerciais:            { statement_code: 'DRE', statement_group: 'Despesas operacionais', sign_rule: 'normal' },
  outras_receitas_despesas:       { statement_code: 'DRE', statement_group: 'Despesas operacionais', sign_rule: 'inverted' },
  despesas_tributarias:           { statement_code: 'DRE', statement_group: 'Despesas operacionais', sign_rule: 'normal' },
  receitas_financeiras:           { statement_code: 'DRE', statement_group: 'Resultado financeiro',  sign_rule: 'inverted' },
  despesas_financeiras:           { statement_code: 'DRE', statement_group: 'Resultado financeiro',  sign_rule: 'normal' },
  ir_csll:                        { statement_code: 'DRE', statement_group: 'Impostos',              sign_rule: 'normal' },
  ir_diferido:                    { statement_code: 'DRE', statement_group: 'Impostos',              sign_rule: 'normal' },
};

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
  * @param {any=} props.onConfirmed
  * @param {any=} props.onDismiss
 */
function CanonicalSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-8"
      >
        <option value="">— Selecione a classificação —</option>
        {CANONICAL_OPTIONS.map(grp => (
          <optgroup key={grp.group} label={grp.group}>
            {grp.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.accountPlanId
 * @param {any=} props.accountPlanName
 * @param {any=} props.tenantId
 * @param {any=} props.missingAccounts
 * @param {any=} props.account_description
  * @param {any=} props.onConfirmed
  * @param {any=} props.onDismiss
 */
export default function AccountPlanEnrichmentModal({
  open,
  accountPlanId,
  accountPlanName,
  tenantId,
  missingAccounts, // [{ account_code, account_description }]
  onConfirmed,
  onDismiss,
}) {
  const [selections, setSelections] = useState(() =>
    Object.fromEntries((missingAccounts || []).filter(a => a.account_type === 'analitica').map(a => [a.account_code, '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  // Filtra apenas contas analíticas (A)
  const analyticAccounts = (missingAccounts || []).filter(a => a.account_type === 'analitica');
  const allSelected = analyticAccounts.length > 0 && analyticAccounts.every(a => !!selections[a.account_code]);

  const handleConfirm = async () => {
    if (!allSelected) return;
    setSaving(true);
    setError(null);
    try {
       const linesToCreate = analyticAccounts.map(a => {
         const canonicalKey = selections[a.account_code];
         const meta = CANONICAL_META_FRONTEND[canonicalKey] || {};
         const normalizedCode = String(a.account_code).replace(/\./g, '').trim();
         const label = CANONICAL_LABEL[canonicalKey] || '';
         return {
           account_plan_id:      accountPlanId,
           tenant_id:            tenantId,
           account_code:         normalizedCode,
           account_code_display: a.account_code,
           account_name:         a.account_description || a.account_code,
           account_type:         'analitica',
           classification:       label,
           statement_code:       meta.statement_code || 'NAO_CLASSIFICADO',
           statement_group:      meta.statement_group || '',
           canonical_key:        canonicalKey,
           sign_rule:            meta.sign_rule || 'normal',
           is_active:            true,
         };
       });

      await base44.entities.FinancialAccountPlanLine.bulkCreate(linesToCreate);
      setSaved(true);
      setTimeout(() => onConfirmed(), 1200);
    } catch (e) {
      setError(e.message || 'Erro ao salvar as contas no plano.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">
                Contas novas encontradas no balancete
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                As contas abaixo são analíticas (A) e não constam no plano{' '}
                <strong className="text-slate-700">"{accountPlanName}"</strong>.
                Classifique cada uma para incluí-las no plano agora.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
         <div className="flex-1 overflow-y-auto p-6 space-y-3">
           {analyticAccounts.length === 0 ? (
             <p className="text-center text-slate-400 py-8">Nenhuma conta analítica (A) faltando no plano.</p>
           ) : (
             analyticAccounts.map(account => (
            <div key={account.account_code} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {account.account_code}
                </code>
                <span className="text-sm text-slate-700 font-medium">{account.account_description}</span>
                <Badge className="ml-auto text-[10px] bg-blue-100 text-blue-700">Analítica (A)</Badge>
              </div>
              <CanonicalSelect
                value={selections[account.account_code] || ''}
                onChange={val => setSelections(prev => ({ ...prev, [account.account_code]: val }))}
              />
              {selections[account.account_code] && (
                <p className="text-[11px] text-slate-400">
                  Classificação selecionada:{' '}
                  <span className="text-slate-600 font-medium">
                    {CANONICAL_META_FRONTEND[selections[account.account_code]]?.statement_code}{' — '}
                    {CANONICAL_LABEL[selections[account.account_code]]}
                  </span>
                </p>
                )}
                </div>
                ))
                )}
                </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 space-y-3">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Contas incluídas no plano com sucesso!
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onDismiss} disabled={saving}>
              Pular por agora
            </Button>
            <Button
              size="sm"
              disabled={!allSelected || saving || saved || analyticAccounts.length === 0}
              onClick={handleConfirm}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : saved
                ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
                : <><Plus className="w-4 h-4" /> Incluir {analyticAccounts.length} conta(s) no plano</>
              }
            </Button>
          </div>
          {!allSelected && (
            <p className="text-[11px] text-center text-amber-600">
              Classifique todas as contas antes de confirmar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}