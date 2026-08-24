import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSuggestedDimensions } from '@/components/fal/dimensionMatrix';
import { getActiveDimensionsByNature, sanitizeDimensions } from '@/components/fal/entityNatureDimensionMap';
import { AlertCircle, ExternalLink, Lock, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { assessmentKey, invalidateAssessmentQueries } from '@/lib/query-client';

const ASSESSMENT_TYPES = [
  { key: 'diagnostico_inicial', label: 'Diagnóstico Inicial' },
  { key: 'monitoramento', label: 'Monitoramento' },
  { key: 'revisao_estrategica', label: 'Revisão Estratégica' },
  { key: 'diagnostico_especifico', label: 'Diagnóstico Específico' },
];

function getTypeLabel(key) {
  return ASSESSMENT_TYPES.find(t => t.key === key)?.label || key;
}

/**
 * Monta o nome padrão do assessment no formato:
 * FAL — {Nível} {NOME} — {Tipo} — {MM/AAAA}
 */
function buildStandardName(targetType, targetName, typeKey, competence) {
  const levelLabel = { group: 'Grupo', company: 'Empresa', unit: 'Unidade' }[targetType] || '';
  const typeLabel = getTypeLabel(typeKey);
  const name = targetName ? ` ${targetName}` : '';
  const comp = competence ? ` — ${competence}` : '';
  return `FAL — ${levelLabel}${name} — ${typeLabel}${comp}`;
}

function validateCompetence(value) {
  return /^\d{2}\/\d{4}$/.test(value);
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.targetType
 * @param {any=} props.targetId
 * @param {any=} props.groupId
 * @param {any=} props.companyId
 * @param {any=} props.unitId
 * @param {any=} props.tenantId
 * @param {any=} props.methodVersionId
 * @param {any=} props.userName
 * @param {any=} props.targetName
 * @param {any=} props.cycleId
 * @param {any=} props.onCreated
 */
export default function CreateAssessmentDialog({
  open, onClose,
  targetType, targetId, groupId, companyId, unitId,
  tenantId, methodVersionId, userName, targetName,
  cycleId,
  onCreated,
}) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    assessment_type: 'diagnostico_inicial',
    competence: '',
    diagnostic_depth: 'rapid',
    context_note: '',
    recipient_name: '',
  });
  const [competenceError, setCompetenceError] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState(null); // existing assessment in same competence
  const [resolvedName, setResolvedName] = useState(targetName || '');

  // Check existing assessments for this target
  const { data: existingAssessments = [] } = useQuery({
    queryKey: assessmentKey(tenantId, null, 'check', targetType, targetId),
    queryFn: () => base44.entities.Assessment.filter(
      { target_type: targetType, target_id: targetId },
      '-created_date', 50
    ),
    enabled: !!targetType && !!targetId && open,
  });

  const isFirstAssessment = existingAssessments.length === 0;
  const activeInitialDiagnostic = existingAssessments.find(a => a.status !== 'archived');
  const [forceCreate, setForceCreate] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        assessment_type: 'diagnostico_inicial',
        competence: '',
        diagnostic_depth: 'rapid',
        context_note: '',
        recipient_name: '',
      });
      setCompetenceError('');
      setDuplicateConflict(null);
      setResolvedName(targetName || '');
    }
  }, [open, targetName]);

  // If not first, default to monitoramento
  useEffect(() => {
    if (!isFirstAssessment && form.assessment_type === 'diagnostico_inicial') {
      setForm(f => ({ ...f, assessment_type: 'monitoramento' }));
    }
  }, [isFirstAssessment]);

  const previewName = buildStandardName(targetType, resolvedName, form.assessment_type, form.competence);

  function handleCompetenceChange(value) {
    let v = value.replace(/[^\d/]/g, '');
    if (v.length === 2 && !v.includes('/')) v = v + '/';
    if (v.length > 7) v = v.slice(0, 7);
    setForm(f => ({ ...f, competence: v }));
    if (v.length > 0 && !validateCompetence(v)) {
      setCompetenceError('Formato inválido. Use MM/AAAA (ex: 01/2026)');
    } else {
      setCompetenceError('');
    }
    setDuplicateConflict(null);
  }

  // Shared: resolve tenant, name, dimensions
  async function resolveContext() {
    let resolvedTenantId = tenantId;
    let resolvedTargetName = resolvedName || '';
    let activeDimensions = getSuggestedDimensions(targetType);

    if (!resolvedTenantId) {
      if (targetType === 'unit' && unitId) {
        const u = await base44.entities.OperationalUnit.get(unitId);
        resolvedTenantId = u?.tenant_id;
        if (!resolvedTargetName && u?.name) { resolvedTargetName = u.name; setResolvedName(u.name); }
      } else if (targetType === 'company' && companyId) {
        const c = await base44.entities.Company.get(companyId);
        resolvedTenantId = c?.tenant_id;
        if (!resolvedTargetName && c?.name) { resolvedTargetName = c.name; setResolvedName(c.name); }
      } else if (targetType === 'group' && groupId) {
        const g = await base44.entities.Group.get(groupId);
        resolvedTenantId = g?.tenant_id;
        if (!resolvedTargetName && g?.name) { resolvedTargetName = g.name; setResolvedName(g.name); }
        if (g?.entity_nature) activeDimensions = getActiveDimensionsByNature(g.entity_nature) || activeDimensions;
      }
    } else if (targetType === 'group' && groupId) {
      const g = await base44.entities.Group.get(groupId);
      if (!resolvedTargetName && g?.name) { resolvedTargetName = g.name; setResolvedName(g.name); }
      if (g?.entity_nature) activeDimensions = getActiveDimensionsByNature(g.entity_nature) || activeDimensions;
    } else if (targetType === 'company' && companyId && !resolvedTargetName) {
      const c = await base44.entities.Company.get(companyId);
      if (c?.name) { resolvedTargetName = c.name; setResolvedName(c.name); }
    } else if (targetType === 'unit' && unitId && !resolvedTargetName) {
      const u = await base44.entities.OperationalUnit.get(unitId);
      if (u?.name) { resolvedTargetName = u.name; setResolvedName(u.name); }
    }

    activeDimensions = sanitizeDimensions(activeDimensions);
    if (activeDimensions.length === 0) activeDimensions = sanitizeDimensions(getSuggestedDimensions(targetType));

    return { resolvedTenantId, resolvedTargetName, activeDimensions };
  }

  // Build assessment payload
  function buildPayload(resolvedTenantId, resolvedTargetName, activeDimensions, cycleNumber) {
    const typeKey = form.assessment_type;
    const standardName = buildStandardName(targetType, resolvedTargetName, typeKey, form.competence);
    return {
      tenant_id: resolvedTenantId,
      method_version_id: methodVersionId,
      title: standardName,
      display_name: standardName,
      assessment_type: typeKey,
      competence: form.competence,
      cycle_number: cycleNumber,
      context_note: form.context_note || null,
      penalty_profile_key: 'equilibrado',
      diagnostic_depth: form.diagnostic_depth,
      status: 'draft',
      assigned_to: userName,
      started_at: new Date().toISOString().split('T')[0],
      target_type: targetType,
      target_id: targetId,
      group_id: groupId || null,
      company_id: companyId || null,
      unit_id: unitId || null,
      client_id: null,
      active_dimensions: activeDimensions,
      scope_mode: 'suggested',
      cycle_id: cycleId || null,
      recipient_name: form.recipient_name || null,
    };
  }

  async function postCreate(assessment) {
    await invalidateAssessmentQueries(queryClient, assessment.id, tenantId);
    try {
      await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessment.id });
    } catch (e) {
      console.error('[CreateAssessment] buildFalQuestionSet failed:', e);
    }
    onClose();
    if (onCreated) onCreated(assessment);
  }

  // Main create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!validateCompetence(form.competence)) throw new Error('Formato de data-base inválido');

      // Check for active conflict in the same competence
      const activeConflict = existingAssessments.find(
        a => a.competence === form.competence && a.status !== 'archived'
      );
      if (activeConflict) {
        setDuplicateConflict(activeConflict);
        throw new Error('CONFLICT');
      }

      const { resolvedTenantId, resolvedTargetName, activeDimensions } = await resolveContext();
      const cycleNumber = existingAssessments.length + 1;
      const payload = buildPayload(resolvedTenantId, resolvedTargetName, activeDimensions, cycleNumber);
      return base44.entities.Assessment.create(payload);
    },
    onError: (err) => {
      if (err.message !== 'CONFLICT' && err.message !== 'Formato de data-base inválido') throw err;
    },
    onSuccess: postCreate,
  });

  // Revision create (creates new cycle even when conflict exists — migrated from NewAssessmentDialog.handleRevise)
  const reviseMutation = useMutation({
    mutationFn: async () => {
      const { resolvedTenantId, resolvedTargetName, activeDimensions } = await resolveContext();
      const maxCycle = existingAssessments.length > 0
        ? Math.max(...existingAssessments.map(a => a.cycle_number || 1))
        : 1;
      const payload = buildPayload(resolvedTenantId, resolvedTargetName, activeDimensions, maxCycle + 1);
      return base44.entities.Assessment.create(payload);
    },
    onSuccess: postCreate,
  });

  const handleClose = () => {
    setDuplicateConflict(null);
    setForceCreate(false);
    onClose();
  };

  const targetLabel = { group: 'Grupo', company: 'Empresa', unit: 'Unidade Operacional' }[targetType];
  const canSubmit = validateCompetence(form.competence) && !createMutation.isPending && !competenceError;
  const availableTypes = isFirstAssessment
    ? ASSESSMENT_TYPES.filter(t => t.key === 'diagnostico_inicial')
    : ASSESSMENT_TYPES.filter(t => t.key !== 'diagnostico_inicial');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Diagnóstico — {targetLabel}</DialogTitle>
          {targetName && <p className="text-sm text-slate-500 mt-1">{targetName}</p>}
        </DialogHeader>

        {/* BLOQUEIO METODOLÓGICO — já existe diagnóstico inicial ativo */}
        {!forceCreate && !isFirstAssessment && activeInitialDiagnostic && !duplicateConflict ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl">
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Metodologia FAL: Diagnóstico Inicial já existe</p>
                <p className="text-xs text-amber-700 mt-1">
                  "{activeInitialDiagnostic.display_name || activeInitialDiagnostic.title}" · ciclo {activeInitialDiagnostic.cycle_number || 1}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-700 mb-1">Por que não criar um novo diagnóstico?</p>
              <p>O Diagnóstico Inicial é o <strong>Marco Zero</strong> da jornada de maturidade. A evolução acontece via <strong>ciclos de revisão periódica</strong> no plano de ação — não por diagnósticos paralelos.</p>
            </div>
            <Link
              to={createPageUrl(`AssessmentDetail?id=${activeInitialDiagnostic.id}`)}
              onClick={handleClose}
              className="flex items-center justify-between w-full p-3.5 rounded-xl bg-white border-2 transition-all group"
              style={{borderColor:'var(--fal-current-border)'}}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--fal-navy-800)'; e.currentTarget.style.background='var(--fal-current-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--fal-current-border)'; e.currentTarget.style.background='#fff'; }}
            >
              <div>
                <p className="text-sm font-semibold" style={{color:'var(--fal-navy-850)'}}>Acessar Diagnóstico & Plano de Ação</p>
                <p className="text-xs mt-0.5" style={{color:'var(--fal-text-muted)'}}>Inicie uma revisão de ciclo a partir do plano de ação</p>
              </div>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{color:'var(--fal-navy-700)'}} />
            </Link>
            <div className="pt-1 flex items-center justify-between">
              <button
                onClick={() => setForceCreate(true)}
                className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
              >
                Cenário excepcional: criar mesmo assim (M&A, pivô, novo ciclo anual)
              </button>
              <Button variant="ghost" size="sm" onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        ) : duplicateConflict ? (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Já existe um diagnóstico ativo para esta data-base</p>
                  <p className="text-xs text-amber-700 mt-1">
                    "{duplicateConflict.display_name || duplicateConflict.title}" · {duplicateConflict.status} · ciclo {duplicateConflict.cycle_number || 1}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600">O que deseja fazer?</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDuplicateConflict(null)}>
                Voltar
              </Button>
              <Link to={createPageUrl(`AssessmentDetail?id=${duplicateConflict.id}`)}>
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Existente
                </Button>
              </Link>
              <Button
                onClick={() => reviseMutation.mutate()}
                disabled={reviseMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {reviseMutation.isPending ? 'Criando...' : `Criar Novo Ciclo`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* NORMAL FORM */
          <>
            <div className="space-y-4 py-2">
              {/* Tipo */}
              <div>
                <Label className="flex items-center gap-1.5">
                  Tipo do Diagnóstico
                  {isFirstAssessment && <Lock className="w-3 h-3 text-slate-400" />}
                </Label>
                {isFirstAssessment ? (
                  <div className="mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 flex items-center gap-2">
                    <span className="font-medium">Diagnóstico Inicial</span>
                    <span className="text-xs text-slate-400">(primeiro diagnóstico)</span>
                  </div>
                ) : (
                  <Select value={form.assessment_type} onValueChange={v => setForm(f => ({ ...f, assessment_type: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map(t => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Data-base */}
              <div>
                <Label>Data-base *</Label>
                <Input
                  value={form.competence}
                  onChange={e => handleCompetenceChange(e.target.value)}
                  placeholder="MM/AAAA — ex: 01/2026"
                  className="mt-1 font-mono"
                  maxLength={7}
                />
                {competenceError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {competenceError}
                  </p>
                )}
              </div>

              {/* Profundidade */}
              <div>
                <Label>Profundidade do Diagnóstico</Label>
                <div className="flex gap-2 mt-1">
                  {[
                    { key: 'rapid', label: 'Resumido', desc: '~20–90 perguntas' },
                    { key: 'standard', label: 'Padrão', desc: '~80–160 perguntas' },
                    { key: 'deep', label: 'Completo', desc: '~150–320 perguntas' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, diagnostic_depth: opt.key }))}
                      className={`flex-1 py-2 px-2 rounded-lg border text-center transition-all text-xs ${
                        form.diagnostic_depth === opt.key
                          ? 'border-green-700 bg-green-50 text-green-800 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observação contextual */}
              <div>
                <Label>Observação contextual <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input
                  value={form.context_note}
                  onChange={e => setForm(f => ({ ...f, context_note: e.target.value }))}
                  placeholder="Ex: mudança de ERP, expansão operacional..."
                  className="mt-1"
                />
              </div>

              {/* Destinatário do Relatório */}
              <div>
                <Label>Destinatário do Relatório <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input
                  value={form.recipient_name}
                  onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                  placeholder="Ex: Sr. João Silva, Diretor Financeiro"
                  className="mt-1"
                />
              </div>

              {/* Preview do nome */}
              {form.competence && validateCompetence(form.competence) && (
                <div className="rounded-lg px-4 py-3" style={{background:'var(--fal-current-bg)', border:'1px solid var(--fal-current-border)'}}>
                  <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{color:'var(--fal-text-muted)'}}>Nome do diagnóstico</p>
                  <p className="text-sm font-semibold" style={{color:'var(--fal-text-strong)'}}>{previewName}</p>
                  <p className="text-[10px] mt-1" style={{color:'var(--fal-text-muted)'}}>Ciclo {existingAssessments.length + 1}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit}
                style={{background:'var(--fal-green-700)'}}
                className="text-white hover:opacity-90"
              >
                {createMutation.isPending ? 'Criando...' : 'Criar Diagnóstico'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}