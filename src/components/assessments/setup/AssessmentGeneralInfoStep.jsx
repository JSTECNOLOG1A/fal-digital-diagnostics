import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Search, Layers, Sparkles, Info, ExternalLink, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/**
 * @param {Object} props
 * @param {any=} props.form
 * @param {any=} props.onChange
 * @param {any=} props.onForceCreate
 */
export default function AssessmentGeneralInfoStep({ form, onChange, onForceCreate }) {
  const { tenantId } = useTenant();
  const [groupSearch, setGroupSearch] = useState('');
  const [forceCreate, setForceCreate] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['setup-groups-list', tenantId],
    queryFn: () => base44.entities.Group.filter({ tenant_id: tenantId }, 'name', 200),
    enabled: !!tenantId,
  });

  // Fetch existing assessments for the selected group to compute cycle_number
  const { data: existingAssessments = [], isLoading: checkingAssessments } = useQuery({
    queryKey: ['setup-existing-assessments', form.group_id],
    queryFn: () => base44.entities.Assessment.filter(
      { group_id: form.group_id, assessment_mode: 'multi_entity_master' },
      '-created_date',
      100
    ),
    enabled: !!form.group_id,
  });

  // Active (non-archived) initial diagnostic
  const activeInitialDiagnostic = existingAssessments.find(
    a => a.status !== 'archived'
  );

  // Auto-suggest title when group is selected and title is still empty / was auto-generated
  useEffect(() => {
    if (!form.group_id || !form.group_name) return;
    const year = form.diagnostic_cycle || String(new Date().getFullYear());
    const cycleNumber = existingAssessments.length + 1;
    const suggested = `Diagnóstico FAL — ${form.group_name} — ${year} — Ciclo ${cycleNumber}`;
    // Only auto-fill if title is empty or matches a previous auto-suggestion pattern
    if (!form.title || form._auto_title) {
      onChange({ title: suggested, _auto_title: true });
    }
  }, [form.group_id, form.group_name, existingAssessments.length, form.diagnostic_cycle]);

  const filteredGroups = groups
    .filter(g => !g.is_archived)
    .filter(g =>
      !groupSearch ||
      g.name?.toLowerCase().includes(groupSearch.toLowerCase()) ||
      String(g.group_order_number || '').includes(groupSearch)
    );

  function handleGroupSelect(group) {
    onChange({ group_id: group.id, group_name: group.name, title: '', _auto_title: false });
  }

  // Notify parent about block state so footer buttons can be hidden
  // Only fires after the loading check is complete (avoids footer flash)
  useEffect(() => {
    if (!form.group_id || checkingAssessments) return; // still loading — don't decide yet
    if (onForceCreate) onForceCreate(!activeInitialDiagnostic || forceCreate);
  }, [form.group_id, checkingAssessments, activeInitialDiagnostic, forceCreate, onForceCreate]);

  // ─── Loading state após seleção de grupo ──────────────────────────────────
  if (form.group_id && checkingAssessments) {
    return (
      <div className="max-w-2xl mx-auto flex items-center gap-3 py-10 text-slate-400">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-sm">Verificando diagnósticos existentes para este grupo…</span>
      </div>
    );
  }

  // ─── Bloqueio educativo ────────────────────────────────────────────────────
  if (form.group_id && !checkingAssessments && activeInitialDiagnostic && !forceCreate) {
    // Try to find an action plan linked to this assessment
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Metodologia FAL: Diagnóstico Inicial já existe</p>
              <p className="text-xs text-amber-700 mt-1">
                Este grupo já possui um diagnóstico ativo:{' '}
                <strong className="text-amber-900">"{activeInitialDiagnostic.title}"</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-4 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">Por que não criar um novo diagnóstico?</p>
            <p>
              O <strong>Diagnóstico Inicial é o Marco Zero</strong> da jornada de maturidade. Criar um segundo diagnóstico independente
              quebra o "corredor de evolução" e impede a comparação histórica do IFME™.
              A metodologia FAL prevê que a evolução acontece via <strong>ciclos de revisão periódica</strong> vinculados ao plano de ação.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">O que fazer agora:</p>
            <Link
              to={createPageUrl(`AssessmentDetail?id=${activeInitialDiagnostic.id}`)}
              className="flex items-center justify-between w-full p-3.5 rounded-xl bg-white border-2 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
            >
              <div>
                <p className="text-sm font-semibold text-indigo-800">Acessar Diagnóstico & Plano de Ação</p>
                <p className="text-xs text-indigo-500 mt-0.5">Inicie uma revisão de ciclo a partir do plano de ação existente</p>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="pt-2 border-t border-amber-200">
            <button
              onClick={() => setForceCreate(true)}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              Preciso criar um diagnóstico novo para um cenário excepcional (M&A, pivô, novo ciclo anual)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Aviso de criação excepcional */}
      {forceCreate && activeInitialDiagnostic && (
        <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-orange-700">
            <span className="font-semibold">Criação excepcional ativada.</span>{' '}
            Este novo diagnóstico será registrado como um novo ciclo independente. Use apenas em casos de mudança estrutural significativa.
          </div>
        </div>
      )}
      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Nome do Diagnóstico <span className="text-red-500">*</span>
          </label>
          {form._auto_title && (
            <span className="flex items-center gap-1 text-[10px] text-blue-500 font-medium">
              <Sparkles className="w-3 h-3" /> Sugerido automaticamente
            </span>
          )}
        </div>
        <input
          type="text"
          value={form.title}
          onChange={e => onChange({ title: e.target.value, _auto_title: false })}
          placeholder="Ex: Diagnóstico FAL — Grupo Alfa — 2026 — Ciclo 1"
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Cycle */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Ciclo / Exercício
        </label>
        <input
          type="text"
          value={form.diagnostic_cycle}
          onChange={e => onChange({ diagnostic_cycle: e.target.value })}
          placeholder="Ex: 2026 ou Q1/2026"
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Diagnostic Depth */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Profundidade do Diagnóstico
        </label>
        <p className="text-xs text-slate-400 mb-3">Define quais perguntas serão incluídas no questionário.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'rapid', label: 'Rápido', desc: 'Visão geral e pontos críticos', color: 'amber' },
            { value: 'standard', label: 'Padrão', desc: 'Cobertura ampla e equilibrada', color: 'blue' },
            { value: 'deep', label: 'Profundo', desc: 'Análise exaustiva e detalhada', color: 'indigo' },
          ].map(opt => {
            const selected = (form.diagnostic_depth || 'standard') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ diagnostic_depth: opt.value })}
                className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? opt.value === 'rapid'
                      ? 'border-amber-400 bg-amber-50'
                      : opt.value === 'standard'
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className={`text-sm font-bold mb-0.5 ${
                  selected
                    ? opt.value === 'rapid' ? 'text-amber-700' : opt.value === 'standard' ? 'text-blue-700' : 'text-indigo-700'
                    : 'text-slate-700'
                }`}>{opt.label}</span>
                <span className="text-[11px] text-slate-500 leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Grupo <span className="text-red-500">*</span>
        </label>

        {form.group_id && form.group_name ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-400 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">{form.group_name}</p>
              <p className="text-[11px] text-blue-500">Grupo selecionado</p>
            </div>
            <button
              onClick={() => onChange({ group_id: '', group_name: '' })}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                placeholder="Buscar grupo por nome ou número..."
                className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {isLoading ? (
              <p className="text-sm text-slate-400 py-4 text-center">Carregando grupos...</p>
            ) : groups.filter(g => !g.is_archived).length === 0 ? (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <span>
                  Nenhum grupo cadastrado ainda. Para criar grupos, empresas e unidades, acesse o{' '}
                  <Link to={createPageUrl('Groups')} className="font-semibold underline hover:text-amber-900 inline-flex items-center gap-0.5">
                    DataHub <ExternalLink className="w-3 h-3" />
                  </Link>
                  {' '}antes de configurar o diagnóstico.
                </span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum grupo encontrado para "{groupSearch}".</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleGroupSelect(group)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{group.name}</p>
                      {group.group_order_number != null && (
                        <p className="text-[11px] text-slate-400">#{String(group.group_order_number).padStart(3, '0')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}