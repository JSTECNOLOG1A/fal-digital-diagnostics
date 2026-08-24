/**
 * FalAssessmentSetupPage
 * Wizard full-page de configuração do Diagnóstico FAL Multi-Entidade.
 * Rota isolada: /FalAssessmentSetup
 * NÃO substitui o fluxo atual de criação de diagnósticos.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import {
  CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle, Loader2, X
} from 'lucide-react';

import AssessmentGeneralInfoStep from '@/components/assessments/setup/AssessmentGeneralInfoStep.jsx';
import CoverageMapInteractive from '@/components/assessments/setup/CoverageMapInteractive.jsx';
import {
  buildRecommendedMapping,
  buildScopeHash,
  computeCoverageMode,
  validateDimensionTargetMapping,
} from '@/lib/falAssessmentScopeUtils.js';
import { DIMENSION_KEYS_ORDERED } from '@/lib/falDimensionScopePolicy.js';

// ─── Wizard steps ─────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'general',  label: 'Geral',    desc: 'Grupo e identificação' },
  { key: 'coverage', label: 'Cobertura', desc: 'Vincular dimensões e entidades' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mappingToDimensionState(mapping) {
  const dims = {};
  for (const [key, targets] of Object.entries(mapping || {})) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    dims[key] = {
      active: true,
      level: targets[0].level,
      targets,
    };
  }
  return dims;
}

function dimensionStateToMapping(dimensions) {
  const mapping = {};
  for (const key of DIMENSION_KEYS_ORDERED) {
    const cfg = dimensions[key];
    if (!cfg || cfg.active === false || !cfg.targets || cfg.targets.length === 0) continue;
    mapping[key] = cfg.targets;
  }
  return mapping;
}

// ─── StepIndicator ───────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.steps
 * @param {any=} props.currentStep
 */
function StepIndicator({ steps, currentStep }) {
  const currentIdx = steps.findIndex(s => s.key === currentStep);
  return (
    <div className="flex flex-col gap-1">
      {steps.map((step, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
            ${isCurrent ? 'bg-blue-600/15 text-blue-700' : isDone ? 'text-slate-500' : 'text-slate-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
              ${isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <div>
              <p className={`text-sm font-semibold leading-none ${isCurrent ? 'text-blue-700' : ''}`}>{step.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70">{step.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────
function FalAssessmentSetupPageInner() {
  const navigate = useNavigate();
  const { tenantId, user, methodVersion } = useTenant();
  const queryClient = useQueryClient();

  const [step, setStep] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [canProceed, setCanProceed] = useState(null); // null=loading, true=ok, false=blocked

  // assessment_mode fixo — tipo já foi escolhido na tela anterior
  const assessmentMode = 'multi_entity_master';
  // Pre-fill group from URL param if available
  const urlParams = new URLSearchParams(window.location.search);
  const urlGroupId = urlParams.get('group_id') || '';

  const [form, setForm] = useState({
    title: '',
    group_id: urlGroupId,
    group_name: '',
    diagnostic_cycle: String(new Date().getFullYear()),
    method_version_id: methodVersion?.id || '',
    config_type: 'recommended',
    diagnostic_depth: 'standard',
  });

  // Load group name if pre-filled from URL
  useQuery({
    queryKey: ['setup-group-prefill', urlGroupId],
    queryFn: async () => {
      const g = await base44.entities.Group.get(urlGroupId);
      setForm(prev => ({ ...prev, group_name: g.name }));
      return g;
    },
    enabled: !!urlGroupId && !form.group_name,
  });
  const [dimensions, setDimensions] = useState(() => {
    // Default: todas inativas — o usuário usa "Aplicar recomendado" ou configura manualmente
    const d = {};
    for (const k of DIMENSION_KEYS_ORDERED) d[k] = { active: false, targets: [] };
    return d;
  });

  // Existing assessments for cycle_number computation
  const { data: existingAssessments = [] } = useQuery({
    queryKey: ['setup-existing-assessments', form.group_id],
    queryFn: () => base44.entities.Assessment.filter(
      { group_id: form.group_id, assessment_mode: 'multi_entity_master' },
      '-created_date', 100
    ),
    enabled: !!form.group_id,
  });

  // Load group entities when group is selected
  const { data: companies = [] } = useQuery({
    queryKey: ['setup-companies', form.group_id],
    queryFn: () => base44.entities.Company.filter({ group_id: form.group_id }, 'name', 200),
    enabled: !!form.group_id,
  });
  const { data: units = [] } = useQuery({
    queryKey: ['setup-units', companies.map(c => c.id).join(',')],
    queryFn: async () => {
      if (companies.length === 0) return [];
      // Busca unidades de todas as empresas do grupo em paralelo
      const batches = await Promise.all(
        companies.map(c =>
          base44.entities.OperationalUnit.filter({ company_id: c.id }, 'name', 200).catch(() => [])
        )
      );
      return batches.flat().filter(u => u.is_active !== false);
    },
    enabled: companies.length > 0,
  });

  const stepIdx = STEPS.findIndex(s => s.key === step);

  // When moving AWAY from 'general', the footer must show regardless of canProceed
  // (canProceed is only meaningful for step=general to guard the block state)
  const footerVisible = !saveResult && (step !== 'general' || canProceed === true);

  // ─── Guards per step ────────────────────────────────────────────────────────
  const canAdvance = (() => {
    if (step === 'general') return !!form.group_id && !!form.title?.trim();
    if (step === 'coverage') {
      // At least one dimension with at least one target
      return DIMENSION_KEYS_ORDERED.some(k => (dimensions[k]?.targets || []).length > 0);
    }
    return true;
  })();

  // ─── Apply recommended ──────────────────────────────────────────────────────
  function applyRecommended() {
    const mapping = buildRecommendedMapping({
      groupId: form.group_id,
      groupName: form.group_name,
      companies,
      units,
    });
    const newDims = { ...dimensions };
    // First mark all as inactive
    for (const k of DIMENSION_KEYS_ORDERED) newDims[k] = { ...newDims[k], active: false, targets: [] };
    // Apply recommended
    for (const [k, targets] of Object.entries(mapping)) {
      newDims[k] = { active: true, level: targets[0]?.level, targets };
    }
    setDimensions(newDims);
  }

  // ─── Update dimension ───────────────────────────────────────────────────────
  function updateDimension(key, config) {
    setDimensions(prev => ({ ...prev, [key]: config }));
  }

  // ─── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setGlobalError(null);
    setSaveResult(null);

    const mapping = dimensionStateToMapping(dimensions);
    const validation = validateDimensionTargetMapping(mapping);
    if (!validation.valid) {
      setGlobalError(`Configuração inválida: ${validation.errors.map(e => e.message).join(' · ')}`);
      setSaving(false);
      return;
    }

    const coverageMode = computeCoverageMode(mapping);
    const scopeHash = buildScopeHash(mapping);

    const activeDims = DIMENSION_KEYS_ORDERED.filter(k => mapping[k]);

    // Construir linked_entities: universo de entidades vinculadas ao diagnóstico
    const linkedEntitiesMap = new Map();
    // Sempre incluir o grupo
    if (form.group_id) {
      linkedEntitiesMap.set(`group::${form.group_id}`, { entity_type: 'group', entity_id: form.group_id, entity_name: form.group_name || '' });
    }
    // Adicionar todas as entidades dos targets
    for (const targets of Object.values(mapping)) {
      for (const t of targets) {
        const key = `${t.level}::${t.entity_id}`;
        if (!linkedEntitiesMap.has(key)) {
          linkedEntitiesMap.set(key, { entity_type: t.level, entity_id: t.entity_id, entity_name: t.entity_name || '' });
        }
      }
    }
    const linked_entities = Array.from(linkedEntitiesMap.values());

    const payload = {
      tenant_id: tenantId,
      title: form.title,
      assessment_mode: 'multi_entity_master',
      target_type: 'group',
      target_id: form.group_id,
      group_id: form.group_id,
      method_version_id: form.method_version_id || methodVersion?.id || '',
      diagnostic_cycle: form.diagnostic_cycle,
      dimension_target_mapping: mapping,
      linked_entities,
      scope_hash: scopeHash,
      configuration_status: 'configured',
      coverage_mode: coverageMode,
      report_status: 'not_generated',
      active_dimensions: activeDims,
      diagnostic_depth: form.diagnostic_depth || 'standard',
      status: 'draft',
      assigned_to: user?.email || '',
      cycle_number: existingAssessments.length + 1,
    };

    let created;
    try {
      created = await base44.entities.Assessment.create(payload);
    } catch (e) {
      setGlobalError(`Erro ao criar diagnóstico: ${e.message}`);
      setSaving(false);
      return;
    }

    // Try to generate scopes
    let scopeResult = null;
    try {
      const res = await base44.functions.invoke('generateAssessmentScopes', { assessment_id: created.id });
      scopeResult = res?.data;
    } catch (e) {
      // Non-blocking: scopes can be generated later
      console.warn('[setup] scope generation failed (non-blocking):', e.message);
    }

    setSaveResult({ assessment: created, scopeResult });
    setSaving(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">FAL® Digital</p>
          <h1 className="text-sm font-bold">Novo Diagnóstico FAL</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm transition-colors"
        >
          <X className="w-4 h-4" /> Sair
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200 p-4 flex-shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-3">Configuração</p>
          <StepIndicator steps={STEPS} currentStep={step} />
        </aside>

        {/* Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">

            {/* Success state */}
            {saveResult && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Diagnóstico criado com sucesso!</h2>
                <p className="text-slate-500 mt-2 text-sm">{saveResult.assessment.title}</p>
                {saveResult.scopeResult && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 inline-block text-left">
                    <p className="font-semibold text-slate-700 mb-1">AssessmentScopes gerados</p>
                    <p>✅ Criados: <strong>{saveResult.scopeResult.created_count}</strong></p>
                    {saveResult.scopeResult.updated_count > 0 && <p>🔄 Atualizados: <strong>{saveResult.scopeResult.updated_count}</strong></p>}
                    {saveResult.scopeResult.skipped_count > 0 && <p>⏭ Ignorados (sem mudança): <strong>{saveResult.scopeResult.skipped_count}</strong></p>}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-4">
                  O questionário multi-entidade será ativado em fase posterior. Você será redirecionado para o diagnóstico.
                </p>
                <div className="flex gap-3 justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => navigate(createPageUrl('Groups'))}
                  >
                    Ir para Grupos
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => navigate(createPageUrl(`AssessmentDetail?id=${saveResult.assessment.id}`))}
                  >
                    Ver diagnóstico
                  </Button>
                </div>
              </div>
            )}

            {/* Wizard steps */}
            {!saveResult && (
              <>
                {/* Step header */}
                <div className="mb-6">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                    Etapa {stepIdx + 1} de {STEPS.length}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">{STEPS[stepIdx]?.desc}</h2>
                </div>

                {/* Mobile step indicator */}
                <div className="lg:hidden flex gap-2 mb-6">
                  {STEPS.map((s, i) => (
                    <div key={s.key} className={`flex-1 h-1.5 rounded-full transition-all ${i <= stepIdx ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  ))}
                </div>

                {/* Step content */}
                {step === 'general' && (
                  <AssessmentGeneralInfoStep
                    form={form}
                    onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                    onForceCreate={allowed => setCanProceed(allowed)}
                  />
                )}

                {step === 'coverage' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-slate-500">
                        Clique nas células para vincular dimensões às entidades do grupo.
                      </p>
                      <button
                        onClick={applyRecommended}
                        className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        ✨ Aplicar configuração FAL recomendada
                      </button>
                    </div>
                    <CoverageMapInteractive
                      dimensions={dimensions}
                      onUpdate={updateDimension}
                      groupId={form.group_id}
                      groupName={form.group_name}
                      companies={companies}
                      units={units}
                      tenantId={tenantId}
                    />
                  </div>
                )}

                {/* Guard message */}
                {!canAdvance && step === 'coverage' && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Vincule ao menos uma entidade a uma dimensão para continuar.
                  </div>
                )}

                {globalError && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {globalError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer: always visible on coverage step; on general step only after block state resolved */}
          {footerVisible && (
            <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  if (stepIdx === 0) navigate(-1);
                  else setStep(STEPS[stepIdx - 1].key);
                }}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                {stepIdx === 0 ? 'Cancelar' : 'Anterior'}
              </Button>

              {stepIdx < STEPS.length - 1 ? (
                <Button
                  onClick={() => setStep(STEPS[stepIdx + 1].key)}
                  disabled={!canAdvance}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  Próximo <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={saving || !canAdvance}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 min-w-40"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Criar Diagnóstico FAL</>
                  }
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function FalAssessmentSetupPage() {
  return <FalAssessmentSetupPageInner />;
}