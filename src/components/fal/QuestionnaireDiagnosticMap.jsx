/**
 * QuestionnaireDiagnosticMap
 *
 * Continuação visual do botão "Questionário" no Programa de Consultoria.
 * NÃO repete o card "01 Coleta & Qualidade" nem o card "Questionário".
 * Começa direto na seleção de entidade e aprofunda o fluxo abaixo.
 *
 *   ↓  (seta saindo do botão Questionário, renderizada pelo pai)
 *   Selecionar entidade  →  árvore do cliente
 *   ↓  (só após seleção)
 *   Entidade diagnosticada
 *   ↓
 *   Dimensões aplicáveis para [entidade]
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Layers, MapPin,
  ArrowDown, CheckCircle2, Circle, ChevronRight
} from 'lucide-react';
import { getApplicableDimensionsForEntity } from '@/lib/falAssessmentScopeUtils';
import { FAL_DIMENSIONS } from '@/components/fal/falOfficialMatrix';

// ── Configuração visual por tipo de entidade ──────────────────────────────────
const ENTITY_CONFIG = {
  group:   { label: 'Grupo',   Icon: Layers,    color: 'indigo', indent: 0 },
  company: { label: 'Empresa', Icon: Building2, color: 'blue',   indent: 1 },
  unit:    { label: 'Unidade', Icon: MapPin,    color: 'emerald',indent: 2 },
};

const COLOR_CLASSES = {
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  activeBg: 'bg-indigo-600' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    activeBg: 'bg-blue-600'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-600'},
};

// ── Seta discreta entre blocos ────────────────────────────────────────────────
function FlowArrow() {
  return (
    <div className="flex justify-center my-2">
      <ArrowDown className="w-4 h-4 text-slate-300" />
    </div>
  );
}

// ── Nó da árvore ──────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.entity
 * @param {any=} props.isSelected
 * @param {any=} props.onSelect
 * @param {any=} props.answered
 * @param {any=} props.total
 * @param {any=} props.dimCount
 */
function EntityTreeNode({ entity, isSelected, onSelect, answered, total, dimCount }) {
  const cfg = ENTITY_CONFIG[entity.entity_type] || ENTITY_CONFIG.company;
  const colors = COLOR_CLASSES[cfg.color];
  const { Icon } = cfg;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const remaining = total - answered;
  const statusLabel = total === 0 ? '' : answered >= total ? '· Concluída' : answered > 0 ? '· Em andamento' : '· Não iniciada';

  return (
    <button
      type="button"
      onClick={() => onSelect(entity)}
      style={{ marginLeft: `${cfg.indent * 20}px`, maxWidth: `calc(100% - ${cfg.indent * 20}px)` }}
      className={`
        text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150 mb-1.5
        ${isSelected
          ? `${colors.activeBg} border-transparent text-white shadow-sm`
          : `${colors.bg} ${colors.border} ${colors.text} hover:brightness-95`
        }
      `}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
            {entity.entity_name}
          </p>
          {total > 0 && (
            <span className={`text-[10px] font-bold flex-shrink-0 ${isSelected ? 'text-white/90' : pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
              {pct}%
            </span>
          )}
        </div>
        <p className={`text-[10px] ${isSelected ? 'text-white/75' : 'opacity-60'}`}>
          {cfg.label}{statusLabel}
        </p>
        {(dimCount > 0 || total > 0) && (
          <div className={`flex items-center gap-2 mt-1 text-[10px] ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
            {dimCount > 0 && <span>{dimCount} dim.</span>}
            {total > 0 && <span>{answered}/{total} perguntas</span>}
            {total > 0 && answered < total && <span className={`font-semibold ${isSelected ? 'text-white/90' : 'text-amber-500'}`}>{remaining} restantes</span>}
          </div>
        )}
        {total > 0 && (
          <div className={`h-1 mt-1 rounded-full overflow-hidden ${isSelected ? 'bg-white/30' : 'bg-slate-200'}`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isSelected
                  ? pct === 100 ? 'bg-emerald-300' : 'bg-white/80'
                  : pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />}
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.linkedEntities
 * @param {any=} props.selectedEntity
 * @param {any=} props.onSelectEntity
 * @param {any=} props.buildQuestionnaireUrl
 */
export default function QuestionnaireDiagnosticMap({
  assessment,
  linkedEntities = [],
  selectedEntity,
  onSelectEntity,
  buildQuestionnaireUrl,
}) {
  const assessmentId = assessment?.id;

  const { data: responses = [] } = useQuery({
    queryKey: ['fal-responses', assessmentId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getFalResponses', { assessment_id: assessmentId });
      return res.data?.responses || [];
    },
    enabled: !!assessmentId,
  });

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['fal-questions-all', assessmentId],
    queryFn: () => base44.entities.FalQuestion.list('sequence_order', 2000),
    enabled: !!assessmentId && (assessment?.question_set?.length || 0) > 0,
  });

  const questionSet = assessment?.question_set || [];
  const questionSetIds = useMemo(() => new Set(questionSet), [questionSet]);

  const qsQuestions = useMemo(
    () => allQuestions.filter(q => questionSetIds.has(q.id)),
    [allQuestions, questionSetIds]
  );

  const answeredByEntity = useMemo(() => {
    const map = {};
    for (const r of responses) {
      const eid = r.evaluated_entity_id || '__no_entity__';
      if (!map[eid]) map[eid] = new Set();
      map[eid].add(r.fal_question_id);
    }
    return map;
  }, [responses]);

  const applicableDimensions = useMemo(() => {
    if (!selectedEntity) return [];
    return getApplicableDimensionsForEntity(assessment, selectedEntity);
  }, [assessment, selectedEntity]);

  const entityQuestions = useMemo(() => {
    if (!selectedEntity) return [];
    const et = selectedEntity.entity_type;
    return qsQuestions.filter(q => {
      const la = Array.isArray(q.level_applicability)
        ? q.level_applicability
        : (q.level_applicability || '').split(',').map(s => s.trim());
      return la.includes(et);
    });
  }, [qsQuestions, selectedEntity]);

  const getEntityProgress = (entity) => {
    const et = entity.entity_type;
    const applicableDims = getApplicableDimensionsForEntity(assessment, entity);
    const applicableDimKeys = new Set(applicableDims.map(d => d.key));
    const entityQs = qsQuestions.filter(q => {
      const la = Array.isArray(q.level_applicability)
        ? q.level_applicability
        : (q.level_applicability || '').split(',').map(s => s.trim());
      return la.includes(et) && applicableDimKeys.has(q.dimension_key);
    });
    const answered = entityQs.filter(q => answeredByEntity[entity.entity_id]?.has(q.id)).length;
    return { answered, total: entityQs.length };
  };

  const parentEntity = useMemo(() => {
    if (!selectedEntity) return null;
    const pid = selectedEntity.parent_entity_id;
    if (!pid) return null;
    return linkedEntities.find(e => e.entity_id === pid) || null;
  }, [selectedEntity, linkedEntities]);

  const dimProgress = useMemo(() => {
    if (!selectedEntity || applicableDimensions.length === 0) return {};
    const eid = selectedEntity.entity_id;
    const answered = answeredByEntity[eid] || new Set();
    const result = {};
    for (const dim of applicableDimensions) {
      const dimQs = entityQuestions.filter(q => q.dimension_key === dim.key);
      const answeredCount = dimQs.filter(q => answered.has(q.id)).length;
      result[dim.key] = { answered: answeredCount, total: dimQs.length };
    }
    return result;
  }, [selectedEntity, applicableDimensions, entityQuestions, answeredByEntity]);

  const entityProgDetails = selectedEntity ? getEntityProgress(selectedEntity) : null;
  const entityPct = entityProgDetails?.total > 0
    ? Math.round((entityProgDetails.answered / entityProgDetails.total) * 100)
    : 0;

  // Árvore hierárquica: grupos → empresas → unidades
  const entityTree = useMemo(() => {
    const groups = linkedEntities.filter(e => e.entity_type === 'group');
    const companies = linkedEntities.filter(e => e.entity_type === 'company');
    const units = linkedEntities.filter(e => e.entity_type === 'unit');
    if (groups.length === 0) return linkedEntities;
    const sorted = [];
    for (const g of groups) {
      sorted.push(g);
      const gCompanies = companies.filter(c => c.parent_entity_id === g.entity_id || c.group_id === g.entity_id);
      for (const c of gCompanies) {
        sorted.push(c);
        const cUnits = units.filter(u => u.parent_entity_id === c.entity_id || u.company_id === c.entity_id);
        for (const u of cUnits) sorted.push(u);
      }
    }
    for (const e of linkedEntities) {
      if (!sorted.includes(e)) sorted.push(e);
    }
    return sorted;
  }, [linkedEntities]);

  return (
    <div className="w-full space-y-0">

      {/* BLOCO 1 — Selecionar entidade */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Selecionar entidade
          </span>
          <span className="text-[10px] text-slate-400">{linkedEntities.length} entidade(s)</span>
        </div>
        <div className="px-4 py-3">
          {linkedEntities.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhuma entidade vinculada a este diagnóstico.</p>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-2">Escolha onde este questionário será aplicado.</p>
              {entityTree.map(entity => {
                const { answered, total } = getEntityProgress(entity);
                const dimCount = getApplicableDimensionsForEntity(assessment, entity).length;
                return (
                  <EntityTreeNode
                    key={entity.entity_id}
                    entity={entity}
                    isSelected={selectedEntity?.entity_id === entity.entity_id}
                    onSelect={(e) => onSelectEntity(prev => prev?.entity_id === e.entity_id ? null : e)}
                    answered={answered}
                    total={total}
                    dimCount={dimCount}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>



      {/* BLOCO 3 — Dimensões aplicáveis (só após seleção) */}
      {selectedEntity && (
        <>
          <FlowArrow />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Dimensões aplicáveis para {selectedEntity.entity_name}
              </span>
              <span className="text-[10px] text-slate-400">{applicableDimensions.length} de {FAL_DIMENSIONS.length}</span>
            </div>
            <div className="px-4 py-3">
              {applicableDimensions.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhuma dimensão aplicável encontrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {applicableDimensions.map(dim => {
                    const prog = dimProgress[dim.key] || { answered: 0, total: 0 };
                    const pct = prog.total > 0 ? Math.round((prog.answered / prog.total) * 100) : 0;
                    const complete = prog.total > 0 && prog.answered >= prog.total;
                    const inProgress = prog.answered > 0 && !complete;
                    const url = buildQuestionnaireUrl
                      ? buildQuestionnaireUrl(dim.key)
                      : createPageUrl(`DimensionQuestionnaire?assessment_id=${assessmentId}&dimension_key=${dim.key}&entity_id=${selectedEntity.entity_id}&entity_type=${selectedEntity.entity_type}`);

                    return (
                      <Link key={dim.key} to={url}>
                        <div className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm cursor-pointer
                          ${complete ? 'border-emerald-200 bg-emerald-50/40' : inProgress ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}
                        `}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-semibold text-slate-800 truncate">{dim.label}</p>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                {complete
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  : <Circle className="w-3.5 h-3.5 text-slate-300" />
                                }
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  complete ? 'bg-emerald-100 text-emerald-700' :
                                  inProgress ? 'bg-blue-100 text-blue-700' :
                                  'bg-slate-100 text-slate-400'
                                }`}>
                                  {complete ? 'Concluída' : inProgress ? 'Em andamento' : 'Não iniciada'}
                                </span>
                              </div>
                            </div>
                            {prog.total > 0 && (
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-1 flex-1" />
                                <span className="text-[10px] text-slate-400 flex-shrink-0">{prog.answered}/{prog.total}</span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Placeholder quando nenhuma entidade selecionada */}
      {!selectedEntity && linkedEntities.length > 0 && (
        <>
          <FlowArrow />
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
            <p className="text-sm text-slate-400">Selecione uma entidade acima para visualizar as dimensões aplicáveis.</p>
          </div>
        </>
      )}
    </div>
  );
}