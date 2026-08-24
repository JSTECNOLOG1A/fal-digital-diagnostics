import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Progress } from '@/components/ui/progress';
import { Compass, CheckCircle2, Circle, ChevronRight, Users, Info, Network } from 'lucide-react';
import { motion } from 'framer-motion';
import { getApplicableDimensionsForEntity } from '@/lib/falAssessmentScopeUtils';
import { FAL_DIMENSIONS } from '@/components/fal/falOfficialMatrix';
import ModuleSelector from './ModuleSelector';
import EntityFlowCard from './EntityFlowCard';
import { SmallArrowDown } from './FlowConnector';

/**
 * PhaseOneContent — Conteúdo da coluna 01 (Coleta & Qualidade) no fluxograma.
 * Responsável por: ModuleSelector → Seleção de entidade → Dimensões aplicáveis.
 */
export default function PhaseOneContent({
  assessment,
  linkedEntities = [],
  selectedEntity,
  onSelectEntity,
  buildQuestionnaireUrl,
  activeModule,
  onModuleChange,
  crossings = [],
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
  const qsQuestions = useMemo(() => allQuestions.filter(q => questionSetIds.has(q.id)), [allQuestions, questionSetIds]);

  const answeredByEntity = useMemo(() => {
    const map = {};
    for (const r of responses) {
      const eid = r.evaluated_entity_id || '__no_entity__';
      if (!map[eid]) map[eid] = new Set();
      map[eid].add(r.fal_question_id);
    }
    return map;
  }, [responses]);

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

  // ── MQE data ────────────────────────────────────────────────────────────────
  const { data: mqeQuestions = [] } = useQuery({
    queryKey: ['mqe-questions', assessment?.method_version_id],
    queryFn: () => base44.entities.MQEQuestion.filter({ method_version_id: assessment.method_version_id }),
    enabled: !!assessment?.method_version_id && activeModule === 'mqe',
  });

  const { data: mqeResponses = [] } = useQuery({
    queryKey: ['mqe-responses', assessmentId],
    queryFn: () => base44.entities.MQEResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId && activeModule === 'mqe',
  });

  const activeDimensionsSet = useMemo(() => new Set(assessment?.active_dimensions || []), [assessment?.active_dimensions]);
  const visibleCrossings = useMemo(() =>
    crossings.filter(c => activeDimensionsSet.has(c.dim_a) && activeDimensionsSet.has(c.dim_b)),
    [crossings, activeDimensionsSet]
  );

  // ── Árvore hierárquica ordenada ───────────────────────────────────────────
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
        cUnits.forEach(u => sorted.push(u));
      }
    }
    linkedEntities.filter(e => !sorted.includes(e)).forEach(e => sorted.push(e));
    return sorted;
  }, [linkedEntities]);

  // ── MQE panel ────────────────────────────────────────────────────────────────
  const mqePanel = (
    <motion.div
      key="mqe-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-slate-200 bg-white/85 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cruzamentos MQE™
          </span>
        </div>
        <span className="text-[10px] text-slate-400">{visibleCrossings.length} cruzamento(s)</span>
      </div>
      <div className="px-3 py-3 space-y-2">
        {visibleCrossings.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-1">Nenhum cruzamento disponível para as dimensões ativas.</p>
        ) : (
          visibleCrossings.map(cross => {
            const cQuestions = mqeQuestions.filter(q => q.crossing_key === cross.key);
            const cResponses = mqeResponses.filter(r => r.crossing_key === cross.key);
            const total = cQuestions.length;
            const answered = cResponses.length;
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            const complete = total > 0 && answered >= total;
            const inProgress = answered > 0 && !complete;
            const url = createPageUrl(`CrossingQuestionnaire?assessment_id=${assessmentId}&crossing=${cross.key}`);
            return (
              <Link key={cross.key} to={url}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm cursor-pointer
                  ${complete ? 'border-emerald-200 bg-emerald-50/40' : inProgress ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}
                `}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{cross.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {complete
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : <Circle className="w-3.5 h-3.5 text-slate-300" />
                        }
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          complete ? 'bg-emerald-100 text-emerald-700' :
                          inProgress ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {complete ? 'Concluído' : inProgress ? 'Em andamento' : 'Não iniciado'}
                        </span>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1 flex-1" />
                        <span className="text-[10px] text-slate-400 shrink-0">{answered}/{total}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </motion.div>
  );

  // ── Painel do Questionário ────────────────────────────────────────────────────
  const questionnairePanel = (
    <>
      {/* Card seleção de entidade */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
              <Users className="h-4 w-4 text-blue-600" />
              Selecionar entidade
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">Escolha onde este questionário será aplicado.</p>
          </div>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 shrink-0">
            {linkedEntities.length} entidade(s)
          </span>
        </div>

        {linkedEntities.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Nenhuma entidade vinculada.</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-1 top-4 bottom-4 border-l-2 border-dashed border-blue-200" />
            <div className="space-y-3">
              {entityTree.map((entity, index) => {
                const { answered, total } = getEntityProgress(entity);
                const dimCount = getApplicableDimensionsForEntity(assessment, entity).length;
                return (
                  <EntityFlowCard
                    key={entity.entity_id}
                    entity={entity}
                    answered={answered}
                    total={total}
                    dimCount={dimCount}
                    selected={selectedEntity?.entity_id === entity.entity_id}
                    index={index}
                    onClick={() => onSelectEntity(
                      selectedEntity?.entity_id === entity.entity_id ? null : entity
                    )}
                  />
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      <SmallArrowDown color="blue" />

      {/* Dimensões aplicáveis ou placeholder */}
      {selectedEntity ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Dimensões — {selectedEntity.entity_name}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0 ml-2">{applicableDimensions.length} de {FAL_DIMENSIONS.length}</span>
          </div>
          <div className="px-4 py-3">
            {applicableDimensions.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhuma dimensão aplicável.</p>
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
                        flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm cursor-pointer
                        ${complete ? 'border-emerald-200 bg-emerald-50/40' : inProgress ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}
                      `}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[12px] font-semibold text-slate-800 truncate">{dim.label}</p>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
                              <span className="text-[10px] text-slate-400 shrink-0">{prog.answered}/{prog.total}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-slate-600">
          <Compass className="h-5 w-5 text-blue-500 shrink-0" />
          <span>Selecione uma entidade acima para visualizar as dimensões aplicáveis.</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/75 px-4 py-3 text-[12px] text-slate-500 shadow-sm">
        <Info className="h-4 w-4 text-blue-400 shrink-0" />
        <span>Selecione uma entidade no painel acima para iniciar o questionário.</span>
      </div>
    </>
  );

  return (
    <div className="w-full flex flex-col gap-0">
      <ModuleSelector activeModule={activeModule} onChange={onModuleChange} />
      <SmallArrowDown color="blue" />
      {activeModule === 'mqe' ? mqePanel : questionnairePanel}
    </div>
  );
}