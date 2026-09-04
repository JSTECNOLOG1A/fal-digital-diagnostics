/**
 * FinancialDefinitionForm — Formulário unificado de Definição da Análise.
 * Renderizado inline no FinancialDiagnosisDetail (etapa "estrutura").
 * Substitui o wizard de 4 passos: a seleção de entidades (individual /
 * combined / consolidated) agora acontece aqui, junto com periodicidade e plano.
 *
 * Props:
 *   diagnosis    — objeto FinancialDiagnosis (edit mode)
 *   diagnosisId  — id do diagnóstico
 *   tenantId     — tenant ativo
 *   groupId      — group_id do diagnóstico
 *   onSaved      — callback() após salvar
 *   onCancel     — callback() opcional (botão cancelar)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  ArrowRight, User, Building2, BookOpen, Calendar,
  Info, RotateCw, CheckCircle2, Loader2, Layers, GitMerge } from 'lucide-react';
import { createPageUrl } from '@/utils';
import CompanyMultiSelect from '@/components/financial/CompanyMultiSelect';

const ANALYSIS_TYPES = [
  { value: 'individual', label: 'Individual', desc: 'Análise de demonstrações de uma única empresa.' },
  { value: 'combined', label: 'Combinada', desc: 'Agregação de duas ou mais entidades com eliminações na coluna combinada.' },
  { value: 'consolidated', label: 'Consolidada', desc: 'Demonstração consolidada com eliminações societárias.' }];

const PERIODICIDADES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' }];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateInput(raw) {
  let v = raw.replace(/\D/g, '').slice(0, 8);
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
  return v;
}

function isValidDate(v) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
  const [d, m, y] = v.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  return y >= 2000 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function parseDate(v) {
  const [d, m, y] = v.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function formatDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function toYearMonth(v) {
  const [d, m, y] = v.split('/').map(Number);
  return `${y}-${String(m).padStart(2, '0')}`;
}

function toMonthYear(v) {
  const [d, m, y] = v.split('/').map(Number);
  return `${String(m).padStart(2, '0')}/${y}`;
}

function computeFinalDate(startDateStr, periodsCount, periodicidade) {
  if (!isValidDate(startDateStr)) return '';
  const date = parseDate(startDateStr);
  const intervals = Math.max(0, (periodsCount || 1) - 1);
  if (periodicidade === 'anual') {
    date.setFullYear(date.getFullYear() + intervals);
  } else if (periodicidade === 'mensal') {
    date.setMonth(date.getMonth() + intervals);
  } else if (periodicidade === 'trimestral') {
    date.setMonth(date.getMonth() + intervals * 3);
  }
  return formatDDMMYYYY(date);
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosis
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.groupId
 * @param {any=} props.onSaved
 * @param {any=} props.onCancel
 * @param {boolean=} props.readOnly
 */
export default function FinancialDefinitionForm({ diagnosis, diagnosisId, tenantId, groupId, onSaved, onCancel, readOnly = false }) {
  const queryClient = useQueryClient();
  const [analysisType, setAnalysisType] = useState('individual');
  const [companyId, setCompanyId] = useState('');
  const [entityMode, setEntityMode] = useState('company'); // company | unit (individual)
  const [unitId, setUnitId] = useState('');
  const [combinedIds, setCombinedIds] = useState([]);
  const [presentingId, setPresentingId] = useState('');
  const [parentId, setParentId] = useState('');
  const [subsidiaryIds, setSubsidiaryIds] = useState([]);
  const [accountPlanId, setAccountPlanId] = useState('');
  const [periodicidade, setPeriodicidade] = useState('anual');
  const [dataBaseInicial, setDataBaseInicial] = useState('');
  const [periodsCount, setPeriodsCount] = useState('2');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);
  const [scopeHydrated, setScopeHydrated] = useState(false);

  // ── Hydrate from diagnosis (edit mode) ──
  useEffect(() => {
    if (!diagnosis || formHydrated) return;
    setAnalysisType(diagnosis.analysis_type || 'individual');
    setCompanyId(diagnosis.company_id || '');
    setAccountPlanId(diagnosis.account_plan_id || '');
    setPeriodicidade(diagnosis.periodicidade || 'anual');
    if (diagnosis.data_base_abertura) {
      const [mm, yyyy] = diagnosis.data_base_abertura.split('/');
      if (mm && yyyy) setDataBaseInicial(`01/${mm}/${yyyy}`);
    }
    if (diagnosis.months_count) {
      const mc = diagnosis.months_count;
      const pc = diagnosis.periodicidade === 'anual' ?
      Math.round(mc / 12) :
      diagnosis.periodicidade === 'trimestral' ?
      Math.round(mc / 3) :
      mc;
      setPeriodsCount(String(pc));
    }
    if (diagnosis.unit_id) { setEntityMode('unit'); setUnitId(diagnosis.unit_id); }
    setTitle(diagnosis.title || '');
    setTitleManuallyEdited(!!diagnosis.title);
    setFormHydrated(true);
  }, [diagnosis, formHydrated]);

  // ── Data fetching ──
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['def-form-companies', tenantId, groupId],
    queryFn: () => base44.entities.Company.filter(
      groupId ?
      { group_id: groupId, tenant_id: tenantId, is_archived: false } :
      { tenant_id: tenantId, is_archived: false },
      'trade_name', 100
    ),
    enabled: !!tenantId
  });

  const { data: accountPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['def-form-plans', tenantId],
    queryFn: () => base44.entities.FinancialAccountPlan.filter(
      { tenant_id: tenantId, is_active: true }, 'name', 50
    ),
    enabled: !!tenantId
  });

  const { data: existingScope = [] } = useQuery({
    queryKey: ['def-form-scope', diagnosisId],
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter(
      { financial_diagnosis_id: diagnosisId }, 'id', 200
    ),
    enabled: !!diagnosisId
  });

  const { data: units = [] } = useQuery({
    queryKey: ['def-form-units', companyId],
    queryFn: () => base44.entities.OperationalUnit.filter({ company_id: companyId }, 'name', 200),
    enabled: !!companyId
  });

  // ── Hydrate scope entities (combined/consolidated/individual-unit) ──
  useEffect(() => {
    if (existingScope.length > 0 && !scopeHydrated) {
      const parent = existingScope.find((s) => s.role === 'parent');
      const subs = existingScope.filter((s) => s.role === 'subsidiary');
      const combined = existingScope.filter((s) => s.role === 'combined_member');
      const presenting = existingScope.find((s) => s.role === 'presenting_entity');
      const analyzed = existingScope.find((s) => s.role === 'analyzed_entity');
      if (parent) setParentId(parent.entity_id);
      setSubsidiaryIds(subs.map((s) => s.entity_id));
      setCombinedIds(combined.map((s) => s.entity_id));
      if (presenting) setPresentingId(presenting.entity_id);
      if (analyzed?.entity_type === 'unit') { setEntityMode('unit'); setUnitId(analyzed.entity_id); }
      setScopeHydrated(true);
    }
  }, [existingScope, scopeHydrated]);

  // ── Derived values ──
  const nameOf = (id) => {
    const c = companies.find((x) => x.id === id);
    return c?.trade_name || c?.name || '';
  };
  const selectedCompany = companies.find((c) => c.id === companyId);
  const companyName = selectedCompany?.trade_name || selectedCompany?.name || '';
  const selectedPlan = accountPlans.find((p) => p.id === accountPlanId);
  const periodicidadeLabel = PERIODICIDADES.find((p) => p.value === periodicidade)?.label || '';
  const finalDate = useMemo(
    () => computeFinalDate(dataBaseInicial, parseInt(periodsCount, 10) || 1, periodicidade),
    [dataBaseInicial, periodsCount, periodicidade]
  );

  const autoName = useMemo(() => {
    const parts = ['Análise Financeira'];
    if (analysisType === 'individual') {
      if (companyName) parts.push(companyName);
    } else if (analysisType === 'combined') {
      parts.push('Combinada');
      if (combinedIds.length) parts.push(`${combinedIds.length} ent.`);
    } else if (analysisType === 'consolidated') {
      parts.push('Consolidada');
      if (nameOf(parentId)) parts.push(nameOf(parentId));
    }
    if (finalDate) {
      const m = finalDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) parts.push(`${m[2]}/${m[3]}`);
    }
    return parts.join(' — ');
  }, [analysisType, companyName, combinedIds, parentId, finalDate, companies]);

  useEffect(() => {
    if (formHydrated && !titleManuallyEdited) setTitle(autoName);
  }, [autoName, titleManuallyEdited, formHydrated]);

  const handleRefreshPreview = () => {
    setTitleManuallyEdited(false);
    setTitle(autoName);
  };

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const canAdvance = (() => {
    if (!accountPlanId || !isValidDate(dataBaseInicial) || !periodsCount) return false;
    if (analysisType === 'individual') {
      return entityMode === 'unit' ? !!(companyId && unitId) : !!companyId;
    }
    if (analysisType === 'combined') return combinedIds.length >= 2;
    if (analysisType === 'consolidated') return !!parentId && subsidiaryIds.length >= 1 && !subsidiaryIds.includes(parentId);
    return false;
  })();

  // ── Build desired scope entities from form state ──
  const scopeRow = (overrides) => ({
    tenant_id: tenantId,
    financial_diagnosis_id: diagnosisId,
    is_active: true,
    entity_id: '',
    entity_type: 'company',
    entity_name: '',
    role: 'analyzed_entity',
    direct_ownership_pct: null,
    voting_rights_pct: null,
    control_type: 'none',
    consolidation_method: 'not_applicable',
    ...overrides,
  });

  const buildDesiredScope = () => {
    const desired = [];
    if (analysisType === 'individual') {
      if (entityMode === 'unit' && companyId && unitId) {
        const u = units.find((x) => x.id === unitId);
        desired.push(scopeRow({ entity_id: unitId, entity_type: 'unit', entity_name: u?.name || '' }));
      } else if (companyId) {
        desired.push(scopeRow({ entity_id: companyId, entity_name: companyName }));
      }
    } else if (analysisType === 'combined') {
      for (const cid of combinedIds) desired.push(scopeRow({ entity_id: cid, entity_name: nameOf(cid), role: 'combined_member' }));
      if (presentingId && !combinedIds.includes(presentingId)) desired.push(scopeRow({ entity_id: presentingId, entity_name: nameOf(presentingId), role: 'presenting_entity' }));
    } else if (analysisType === 'consolidated') {
      if (parentId) desired.push(scopeRow({ entity_id: parentId, entity_name: nameOf(parentId), role: 'parent', consolidation_method: 'full', control_type: 'control' }));
      for (const sid of subsidiaryIds) desired.push(scopeRow({ entity_id: sid, entity_name: nameOf(sid), role: 'subsidiary', consolidation_method: 'full', control_type: 'control' }));
    }
    return desired;
  };

  // ── Save ──
  const handleSave = async () => {
    if (readOnly || !canAdvance || !diagnosisId) return;
    setSaving(true);
    setError(null);
    try {
      const firstYM = toYearMonth(dataBaseInicial);
      const lastYM = toYearMonth(finalDate);
      const monthsCount = periodicidade === 'anual' ?
      (parseInt(periodsCount, 10) || 1) * 12 :
      periodicidade === 'trimestral' ?
      (parseInt(periodsCount, 10) || 1) * 3 :
      parseInt(periodsCount, 10) || 1;

      const scopeLevel = analysisType === 'individual' ?
      (entityMode === 'unit' ? 'unit' : 'company') :
      'group';

      const updatePayload = {
        analysis_type: analysisType,
        scope_level: scopeLevel,
        title: title.trim() || autoName,
        periodicidade,
        data_base_abertura: toMonthYear(dataBaseInicial),
        data_base_fechamento: toMonthYear(finalDate),
        first_period: firstYM,
        last_period: lastYM,
        months_count: monthsCount,
        account_plan_id: accountPlanId,
        // Entidade principal (individual)
        company_id: analysisType === 'individual' ? companyId : null,
        unit_id: analysisType === 'individual' && entityMode === 'unit' ? unitId : null,
        // Multi-entidade
        presenting_entity_id: analysisType === 'combined' ? (presentingId || null) : null,
        parent_entity_id: analysisType === 'consolidated' ? (parentId || null) : null,
      };

      // ── Salvar via mutations diretas (SDK de entidades) ──
      await base44.entities.FinancialDiagnosis.update(diagnosisId, updatePayload);

      // Sincronizar scope entities: remover as antigas e criar as novas
      const desired = buildDesiredScope();

      if (existingScope.length > 0) {
        const oldIds = existingScope.map((s) => s.id);
        await base44.entities.FinancialAnalysisScopeEntity.deleteMany({ id: { $in: oldIds } });
      }

      if (desired.length > 0) {
        await base44.entities.FinancialAnalysisScopeEntity.bulkCreate(desired);
      }

      // Invalidar queries de jornada e escopo
      queryClient.invalidateQueries({ queryKey: ['def-form-scope', diagnosisId] });
      queryClient.invalidateQueries({ queryKey: ['financial-diagnosis', diagnosisId] });

      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || 'Erro ao salvar análise. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingCompanies || loadingPlans) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>);
  }

  return (
    <div className="space-y-4">
      {/* ── Main Content Card ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Heading */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">1. Definição da Análise</h1>
          <p className="text-sm text-slate-500 mt-1">
            Informe os dados abaixo para que o sistema gere a estrutura da análise financeira.
          </p>
        </div>

        {/* 2-column form grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            {/* Tipo de análise */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Tipo de análise</Label>
              <Select value={analysisType} disabled={readOnly} onValueChange={(v) => { setAnalysisType(v); setTitleManuallyEdited(false); }}>
                <SelectTrigger className="h-10 mt-1.5">
                  <User className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANALYSIS_TYPES.map((t) =>
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                {ANALYSIS_TYPES.find((t) => t.value === analysisType)?.desc}
              </p>
            </div>

            {/* ── Entidades (varia por tipo) ── */}
            {analysisType === 'individual' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[{ k: 'company', l: 'Empresa' }, { k: 'unit', l: 'Unidade' }].map((o) => (
                    <button key={o.k} type="button" disabled={readOnly} onClick={readOnly ? undefined : () => { setEntityMode(o.k); setUnitId(''); setTitleManuallyEdited(false); }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${entityMode === o.k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{o.l}</button>
                  ))}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Empresa analisada</Label>
                  <Select value={companyId} disabled={readOnly} onValueChange={(v) => { setCompanyId(v); setUnitId(''); setTitleManuallyEdited(false); }}>
                    <SelectTrigger className="h-10 mt-1.5">
                      <Building2 className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) =>
                      <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400 mt-1.5">Selecione a empresa que será analisada.</p>
                </div>
                {entityMode === 'unit' && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Unidade *</Label>
                    <Select value={unitId} onValueChange={(v) => { setUnitId(v); setTitleManuallyEdited(false); }} disabled={readOnly || !companyId}>
                      <SelectTrigger className="h-10 mt-1.5">
                        <SelectValue placeholder={companyId ? 'Selecione a unidade...' : 'Selecione a empresa primeiro'} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {companies.length === 0 &&
                <p className="text-xs text-amber-600">Nenhuma empresa cadastrada {groupId ? 'neste grupo' : 'neste tenant'}.</p>
                }
              </div>
            )}

            {analysisType === 'combined' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Entidades integrantes * (mínimo 2)</Label>
                  <div className="mt-1.5">
                    <CompanyMultiSelect companies={companies} selected={combinedIds} disabled={readOnly} onToggle={(id) => { toggle(combinedIds, setCombinedIds, id); setTitleManuallyEdited(false); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Entidade apresentadora (opcional)</Label>
                  <Select value={presentingId} disabled={readOnly} onValueChange={(v) => { setPresentingId(v); setTitleManuallyEdited(false); }}>
                    <SelectTrigger className="h-10 mt-1.5">
                      <GitMerge className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                      <SelectValue placeholder="Nenhuma (apresentação combinada final)" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400 mt-1">Não tratar como controladora — apenas a entidade que apresenta o conjunto.</p>
                </div>
              </div>
            )}

            {analysisType === 'consolidated' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Controladora / Investidora *</Label>
                  <Select value={parentId} disabled={readOnly} onValueChange={(v) => { setParentId(v); setTitleManuallyEdited(false); }}>
                    <SelectTrigger className="h-10 mt-1.5">
                      <Layers className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                      <SelectValue placeholder="Selecione a controladora..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Perímetro de consolidação — controladas *</Label>
                  <div className="mt-1.5">
                    <CompanyMultiSelect companies={companies} selected={subsidiaryIds} disabled={readOnly} onToggle={(id) => { toggle(subsidiaryIds, setSubsidiaryIds, id); setTitleManuallyEdited(false); }} excludeIds={parentId ? [parentId] : []} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">A controladora entra no escopo automaticamente com role=parent.</p>
                </div>
              </div>
            )}

            {/* Plano de Contas — container verde */}
            <div className="rounded-xl p-4 space-y-3" style={{ border: '2px solid #86efac', background: '#ecfdf5' }}>
              <Label className="text-sm font-medium text-slate-700">Plano de Contas</Label>
              <Select value={accountPlanId} disabled={readOnly} onValueChange={setAccountPlanId}>
                <SelectTrigger className="h-10 bg-white">
                  <BookOpen className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                  <SelectValue placeholder="Selecione o plano de contas..." />
                </SelectTrigger>
                <SelectContent>
                  {accountPlans.map((p) =>
                  <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.version ? ` – ${p.version}` : ''}{p.is_active === false ? ' (Inativo)' : ''}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {selectedPlan &&
              <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Vigência: {selectedPlan.valid_from ?
                    new Date(String(selectedPlan.valid_from).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') :
                    '—'} em diante
                    </p>
                    <Link
                    to={createPageUrl('FinancialAccountPlanManager')}
                    className="text-xs text-blue-600 hover:underline font-medium">
                      
                      Ver detalhes do plano
                    </Link>
                  </div>

                  <div className="bg-white rounded-lg p-3 flex items-start gap-2.5" style={{ border: '1px solid #bbf7d0' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Plano vinculado à empresa</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Este plano de contas está vinculado à {companyName || 'empresa selecionada'}. A versão aplicável será definida automaticamente para cada período conforme a data-base.
                      </p>
                    </div>
                  </div>
                </>
              }

              {accountPlans.length === 0 &&
              <p className="text-xs text-amber-600">
                  Nenhum plano ativo.{' '}
                  <Link to={createPageUrl('FinancialAccountPlanManager')} className="text-blue-600 hover:underline">
                    Cadastrar plano →
                  </Link>
                </p>
              }
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-5">
            {/* Periodicidade */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Periodicidade da análise</Label>
              <Select value={periodicidade} disabled={readOnly} onValueChange={(v) => { setPeriodicidade(v); setTitleManuallyEdited(false); }}>
                <SelectTrigger className="h-10 mt-1.5">
                  <Calendar className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) =>
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                Define o intervalo entre as data-bases da análise.
              </p>
            </div>

            {/* Data-base inicial */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Data-base inicial</Label>
              <div className="relative mt-1.5">
                <Input
                  value={dataBaseInicial}
                  onChange={(e) => {setDataBaseInicial(formatDateInput(e.target.value));setTitleManuallyEdited(false);}}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  disabled={readOnly}
                  className="h-10 pr-10" />
                
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Data-base do primeiro período da análise.
              </p>
              {dataBaseInicial && !isValidDate(dataBaseInicial) &&
              <p className="text-xs text-red-500 mt-1">Formato inválido. Use DD/MM/AAAA.</p>
              }
            </div>

            {/* Quantidade de períodos */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Quantidade de períodos</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={periodsCount}
                onChange={(e) => {setPeriodsCount(e.target.value);setTitleManuallyEdited(false);}}
                disabled={readOnly}
                className="h-10 mt-1.5" />
              
              <p className="text-xs text-slate-400 mt-1.5">
                Quantidade total de períodos que comporão esta análise.
              </p>
              {isValidDate(dataBaseInicial) && periodsCount && periodicidade && (
                <p className="text-xs text-blue-600 mt-1.5 font-medium">
                  Preview: {toMonthYear(dataBaseInicial)} a {toMonthYear(finalDate)} ({periodicidadeLabel})
                </p>
              )}
            </div>

            {/* Info box — Como funciona */}
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ border: '1px solid #dbeafe', background: '#eff6ff' }}>
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Como funciona</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#3b5f8a' }}>
                  O sistema criará automaticamente a grade de períodos a partir da data-base inicial e da periodicidade selecionada.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer: Nome da análise ── */}
        <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid #dbeafe', background: '#f8fafc' }}>
          <Label className="text-sm font-medium text-slate-700">
            Nome da análise (gerado automaticamente)
          </Label>
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => {setTitle(e.target.value);setTitleManuallyEdited(true);}}
              readOnly={readOnly}
              placeholder="O nome será gerado após selecionar empresa, periodicidade e data-base"
              className="h-10 flex-1" />
            
            {!readOnly && <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPreview}
              className="gap-1.5 h-10">
              
              <RotateCw className="w-3.5 h-3.5" /> Atualizar preview
            </Button>}
          </div>
          <p className="text-xs text-slate-400">
            O nome é gerado combinando: Tipo + Entidade(s) + Data-base final da análise.
          </p>
        </div>

        {error &&
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        }
      </div>

      {/* ── Action bar ── */}
      {!readOnly && (
      <div className="flex justify-end gap-2">
        {onCancel &&
        <Button variant="outline" onClick={onCancel} className="h-10 px-6">
            Cancelar
          </Button>
        }
        <Button
          onClick={handleSave}
          disabled={!canAdvance || saving}
          className="text-white gap-2 h-10 px-6"
          style={{ background: '#2563eb' }}>
          
          {saving ?
          <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 

          <>Salvar <ArrowRight className="w-4 h-4" /></>
          }
        </Button>
      </div>
      )}
    </div>);
}