/**
 * CreateFinancialAnalysisDialog — WIZARD de criação de Análise Financeira.
 * Separa rigorosamente scope_level (hierárquico) de analysis_type (contábil):
 *   analysis_type: individual | combined | consolidated
 *
 * Passos:
 *  1. Tipo (individual / combinada / consolidada)
 *  2. Entidade(s) — conteúdo varia por tipo
 *  3. Configuração (períodos, plano, título)
 *  4. Resumo + criar
 *
 * Persiste FinancialDiagnosis + FinancialAnalysisScopeEntity.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, ArrowRight, Check, Building2, GitMerge, Layers } from 'lucide-react';

const TYPE_OPTIONS = [
  {
    value: 'individual',
    icon: Building2,
    title: 'Individual',
    desc: 'Uma empresa ou unidade analisada isoladamente.',
    badge: 'INDIVIDUAL',
    color: 'border-blue-300 hover:border-blue-500 bg-blue-50/40',
    iconCls: 'bg-blue-100 text-blue-600',
  },
  {
    value: 'combined',
    icon: GitMerge,
    title: 'Combinada',
    desc: 'Agregação gerencial de duas ou mais entidades selecionadas, apresentada como uma série conjunta, sem aplicação automática de eliminações societárias.',
    badge: 'COMBINADA',
    color: 'border-teal-300 hover:border-teal-500 bg-teal-50/40',
    iconCls: 'bg-teal-100 text-teal-600',
  },
  {
    value: 'consolidated',
    icon: Layers,
    title: 'Consolidada',
    desc: 'Demonstração da controladora e do grupo consolidado, com perímetro definido, conciliação intragrupo, eliminações, ajustes, reclassificações e memória de consolidação.',
    badge: 'CONSOLIDADA',
    color: 'border-purple-300 hover:border-purple-500 bg-purple-50/40',
    iconCls: 'bg-purple-100 text-purple-600',
  },
];

/**
 * @param {Object} props
 * @param {any=} props.current
 * @param {any=} props.labels
 */
function Steps({ current, labels }) {
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {labels.map((lbl, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={lbl}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : idx}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>{lbl}</span>
            </div>
            {i < labels.length - 1 && <div className={`w-5 h-px ${done ? 'bg-emerald-400' : 'bg-slate-200'} shrink-0`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.companies
 * @param {any=} props.selected
 * @param {any=} props.onToggle
 */
function CompanyMultiSelect({ companies, selected, onToggle }) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
      {companies.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button key={c.id} type="button" onClick={() => onToggle(c.id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${on ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
              {on && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-slate-700 truncate">{c.trade_name || c.name}</span>
          </button>
        );
      })}
      {companies.length === 0 && <p className="px-3 py-4 text-xs text-slate-400">Nenhuma empresa cadastrada neste grupo.</p>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.tenantId
 * @param {any=} props.groupId
 * @param {any=} props.companies
 * @param {any=} props.units
 */
export default function CreateFinancialAnalysisDialog({ open, onClose, tenantId, groupId, companies = [], units = [] }) {
  const [step, setStep] = useState(1);
  const [analysisType, setAnalysisType] = useState('individual');
  // individual
  const [entityMode, setEntityMode] = useState('company'); // company | unit
  const [companyId, setCompanyId] = useState('');
  const [unitId, setUnitId] = useState('');
  // combined
  const [combinedIds, setCombinedIds] = useState([]);
  const [presentingId, setPresentingId] = useState('');
  // consolidated
  const [parentId, setParentId] = useState('');
  const [subsidiaryIds, setSubsidiaryIds] = useState([]);
  // config
  const [form, setForm] = useState({ title: '', periodicidade: 'anual', first_period: '', last_period: '', account_plan_id: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1); setAnalysisType('individual'); setEntityMode('company');
      setCompanyId(''); setUnitId(''); setCombinedIds([]); setPresentingId('');
      setParentId(''); setSubsidiaryIds([]);
      setForm({ title: '', periodicidade: 'anual', first_period: '', last_period: '', account_plan_id: '', notes: '' });
    }
  }, [open]);

  const { data: accountPlans = [] } = useQuery({
    queryKey: ['account-plans', tenantId],
    queryFn: () => base44.entities.FinancialAccountPlan.filter({ tenant_id: tenantId, is_active: true }, 'name', 50),
    enabled: !!tenantId && open,
  });

  const filteredUnits = companyId ? units.filter((u) => u.company_id === companyId) : [];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const nameOf = (id) => {
    const c = companies.find((x) => x.id === id);
    return c?.trade_name || c?.name || '';
  };

  const stepLabels = useMemo(() => {
    if (analysisType === 'individual') return ['Tipo', 'Entidade', 'Configuração', 'Resumo'];
    if (analysisType === 'combined') return ['Tipo', 'Entidades', 'Configuração', 'Resumo'];
    return ['Tipo', 'Controladora', 'Configuração', 'Resumo'];
  }, [analysisType]);

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // ── Validação por passo ──
  const stepValid = (() => {
    if (step === 1) return !!analysisType;
    if (step === 2) {
      if (analysisType === 'individual') return entityMode === 'unit' ? !!(companyId && unitId) : !!companyId;
      if (analysisType === 'combined') return combinedIds.length >= 2;
      if (analysisType === 'consolidated') return !!parentId && subsidiaryIds.length >= 1 && !subsidiaryIds.includes(parentId) && !combinedIds.length;
      return false;
    }
    if (step === 3) return !!form.title.trim();
    return true;
  })();

  const autoTitle = () => {
    const parts = ['Análise Financeira'];
    if (analysisType === 'individual') {
      if (entityMode === 'unit') { if (nameOf(companyId)) parts.push(nameOf(companyId)); const u = units.find((x) => x.id === unitId); if (u) parts.push(u.name); }
      else if (nameOf(companyId)) parts.push(nameOf(companyId));
    } else if (analysisType === 'combined') {
      parts.push('Combinada'); if (combinedIds.length) parts.push(`${combinedIds.length} ent.`);
    } else {
      parts.push('Consolidada'); if (nameOf(parentId)) parts.push(nameOf(parentId));
    }
    if (form.last_period) parts.push(form.last_period.replace(/^(\d{4})-(\d{2})$/, '$2/$1'));
    return parts.join(' — ');
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const scopeLevel = analysisType === 'individual' ? (entityMode === 'unit' ? 'unit' : 'company') : 'group';
      const payload = {
        tenant_id: tenantId,
        group_id: groupId,
        scope_level: scopeLevel,
        analysis_type: analysisType,
        title: form.title.trim(),
        status: 'draft',
        ...(form.first_period && { first_period: form.first_period }),
        ...(form.last_period && { last_period: form.last_period }),
        ...(form.periodicidade && { periodicidade: form.periodicidade }),
        ...(form.account_plan_id && { account_plan_id: form.account_plan_id }),
        ...(form.notes && { notes: form.notes }),
        ...(analysisType === 'individual' && entityMode === 'company' && companyId && { company_id: companyId }),
        ...(analysisType === 'individual' && entityMode === 'unit' && companyId && { company_id: companyId, unit_id: unitId }),
        ...(analysisType === 'combined' && presentingId && { presenting_entity_id: presentingId }),
        ...(analysisType === 'consolidated' && parentId && { parent_entity_id: parentId }),
      };
      const created = await base44.entities.FinancialDiagnosis.create(payload);

      // Scope entities
      const se = [];
      const base = { tenant_id: tenantId, financial_diagnosis_id: created.id, is_active: true };
      if (analysisType === 'individual') {
        if (entityMode === 'unit') {
          const u = units.find((x) => x.id === unitId);
          se.push({ ...base, entity_id: unitId, entity_type: 'unit', entity_name: u?.name || '', role: 'analyzed_entity' });
        } else {
          se.push({ ...base, entity_id: companyId, entity_type: 'company', entity_name: nameOf(companyId), role: 'analyzed_entity' });
        }
      } else if (analysisType === 'combined') {
        for (const cid of combinedIds) se.push({ ...base, entity_id: cid, entity_type: 'company', entity_name: nameOf(cid), role: 'combined_member' });
        // Entidade apresentadora NÃO duplica no escopo — o papel vem de FinancialDiagnosis.presenting_entity_id.
        // Se presentingId já está entre as integrantes, não criar segunda entrada (Seção 9).
        if (presentingId && !combinedIds.includes(presentingId)) se.push({ ...base, entity_id: presentingId, entity_type: 'company', entity_name: nameOf(presentingId), role: 'presenting_entity' });
      } else if (analysisType === 'consolidated') {
        se.push({ ...base, entity_id: parentId, entity_type: 'company', entity_name: nameOf(parentId), role: 'parent', consolidation_method: 'full', control_type: 'control' });
        for (const sid of subsidiaryIds) se.push({ ...base, entity_id: sid, entity_type: 'company', entity_name: nameOf(sid), role: 'subsidiary', consolidation_method: 'full', control_type: 'control' });
      }
      if (se.length) await base44.entities.FinancialAnalysisScopeEntity.bulkCreate(se);
      onClose(created);
    } catch (e) {
      alert('Erro ao criar análise: ' + (e.message || JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Nova Análise Financeira</DialogTitle>
        </DialogHeader>

        <Steps current={step} labels={stepLabels} />

        {/* Passo 1 — Tipo */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
            {TYPE_OPTIONS.map((t) => {
              const Icon = t.icon;
              const sel = analysisType === t.value;
              return (
                <button key={t.value} type="button" onClick={() => setAnalysisType(t.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${t.color} ${sel ? 'ring-2 ring-blue-400' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${t.iconCls}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{t.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Passo 2 — Entidade(s) */}
        {step === 2 && analysisType === 'individual' && (
          <div className="space-y-3 py-1">
            <div className="flex gap-2">
              {[{ k: 'company', l: 'Empresa' }, { k: 'unit', l: 'Unidade' }].map((o) => (
                <button key={o.k} type="button" onClick={() => { setEntityMode(o.k); setUnitId(''); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${entityMode === o.k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{o.l}</button>
              ))}
            </div>
            <div>
              <Label>Empresa *</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setUnitId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {entityMode === 'unit' && (
              <div>
                <Label>Unidade *</Label>
                <Select value={unitId} onValueChange={setUnitId} disabled={!companyId}>
                  <SelectTrigger><SelectValue placeholder={companyId ? 'Selecione a unidade...' : 'Selecione a empresa primeiro'} /></SelectTrigger>
                  <SelectContent>{filteredUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 2 && analysisType === 'combined' && (
          <div className="space-y-3 py-1">
            <div>
              <Label>Entidades integrantes * (mínimo 2)</Label>
              <CompanyMultiSelect companies={companies} selected={combinedIds} onToggle={(id) => toggle(combinedIds, setCombinedIds, id)} />
            </div>
            <div>
              <Label>Entidade apresentadora (opcional)</Label>
              <Select value={presentingId} onValueChange={setPresentingId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma (apresentação combinada final)" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">Não tratar como controladora — apenas a entidade que apresenta o conjunto.</p>
            </div>
          </div>
        )}

        {step === 2 && analysisType === 'consolidated' && (
          <div className="space-y-3 py-1">
            <div>
              <Label>Controladora / Investidora *</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="Selecione a controladora..." /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Perímetro de consolidação — controladas *</Label>
              <CompanyMultiSelect companies={companies.filter((c) => c.id !== parentId)} selected={subsidiaryIds} onToggle={(id) => toggle(subsidiaryIds, setSubsidiaryIds, id)} />
              <p className="text-[11px] text-slate-400 mt-1">A controladora entra no escopo automaticamente com role=parent.</p>
            </div>
          </div>
        )}

        {/* Passo 3 — Configuração */}
        {step === 3 && (
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de abertura</Label>
                <Input type="month" value={form.first_period} onChange={(e) => set('first_period', e.target.value)} placeholder="AAAA-MM" />
              </div>
              <div>
                <Label>Data-base (fechamento)</Label>
                <Input type="month" value={form.last_period} onChange={(e) => set('last_period', e.target.value)} placeholder="AAAA-MM" />
              </div>
            </div>
            <div>
              <Label>Periodicidade</Label>
              <Select value={form.periodicidade} onValueChange={(v) => set('periodicidade', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {accountPlans.length > 0 && (
              <div>
                <Label>Plano de Contas Gerencial</Label>
                <Select value={form.account_plan_id} onValueChange={(v) => set('account_plan_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plano (opcional)..." /></SelectTrigger>
                  <SelectContent>{accountPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Título *</Label>
                <button type="button" onClick={() => set('title', autoTitle())} className="text-[11px] text-blue-500 hover:text-blue-600 underline">Sugerir título</button>
              </div>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex: Análise Financeira — Empresa X — 2025" />
            </div>
            <div>
              <Label>Notas internas</Label>
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Observações opcionais" />
            </div>
          </div>
        )}

        {/* Passo 4 — Resumo */}
        {step === 4 && (
          <div className="space-y-2 py-1 text-sm">
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Tipo</span><span className="font-semibold text-slate-800">{TYPE_OPTIONS.find((t) => t.value === analysisType)?.title}</span></div>
            {analysisType === 'individual' && (
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Entidade</span><span className="font-semibold text-slate-800">{nameOf(companyId)}{entityMode === 'unit' ? ` · ${units.find((u) => u.id === unitId)?.name || ''}` : ''}</span></div>
            )}
            {analysisType === 'combined' && (
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Entidades</span><span className="font-semibold text-slate-800">{combinedIds.length} selecionada(s)</span></div>
            )}
            {analysisType === 'consolidated' && (
              <>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Controladora</span><span className="font-semibold text-slate-800">{nameOf(parentId)}</span></div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Perímetro</span><span className="font-semibold text-slate-800">{subsidiaryIds.length + 1} entidades</span></div>
              </>
            )}
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Período</span><span className="font-semibold text-slate-800">{form.first_period || '—'} a {form.last_period || '—'}</span></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Periodicidade</span><span className="font-semibold text-slate-800 capitalize">{form.periodicidade || '—'}</span></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Plano de contas</span><span className="font-semibold text-slate-800">{accountPlans.find((p) => p.id === form.account_plan_id)?.name || '—'}</span></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Título</span><span className="font-semibold text-slate-800 text-right max-w-[60%] truncate">{form.title}</span></div>
            {analysisType !== 'individual' && (
              <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2"><span className="text-blue-600">Apresentação</span><span className="font-semibold text-blue-800">{analysisType === 'consolidated' ? 'Controladora | Consolidado' : 'Combinado final por período'}</span></div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={() => (step > 1 ? setStep(step - 1) : onClose(null))} disabled={saving} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> {step > 1 ? 'Voltar' : 'Cancelar'}
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!stepValid} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              Avançar <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><Check className="w-4 h-4" /> Criar análise {TYPE_OPTIONS.find((t) => t.value === analysisType)?.title.toLowerCase()}</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}