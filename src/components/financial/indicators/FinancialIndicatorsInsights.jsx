/**
 * FinancialIndicatorsInsights
 * Lista de pontos de atenção/melhoria a partir dos indicadores financeiros
 * (source_type = financial_indicator), atuais e históricos (finding_scope),
 * combinada com apontamentos manuais do consultor. Renderizada logo abaixo
 * do toggle Hoje/Histórico em FinancialIndicatorsPanel.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';
import { ListChecks } from 'lucide-react';
import AddToActionPlanButton from '../AddToActionPlanButton';
import FinancialAnalysisNoteEditor from '../FinancialAnalysisNoteEditor';
import { getFindingKeyFromRecommendation } from '../FinancialRecommendationsTab';
import {
  SCOPE_LABEL,
  filterFindingsBySection,
  getFindingSeverity,
  isFindingInActionPlan,
} from '../financialFindingAdapter';

const SCOPE_ORDER = ['period_snapshot', 'period_comparison'];

/**
 * @param {Object} props
 * @param {any} props.finding
 * @param {any} props.recommendation
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 */
function InsightRow({ finding, recommendation, diagnosisId, tenantId }) {
  const severity = getFindingSeverity(finding);
  return (
    <li className="border-l-[3px] pl-3 py-1.5" style={{ borderColor: severity.accent }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-800">
          <span className="font-semibold">{finding.title}</span>
          {finding.description ? <span className="text-slate-600"> — {finding.description}</span> : null}
        </p>
        <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">{severity.label}</span>
      </div>
      {recommendation?.suggested_action && (
        <p className="text-xs text-slate-500 mt-0.5">
          <strong>Recomendação:</strong> {recommendation.suggested_action}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {finding.financial_indicator && <span className="text-[10px] text-slate-400">{finding.financial_indicator}</span>}
        {finding.period && <span className="text-[10px] text-slate-400">período {finding.period}</span>}
        <AddToActionPlanButton
          diagnosisId={diagnosisId}
          tenantId={tenantId}
          recommendationId={recommendation?.id}
          defaultTitle={finding.title}
          defaultDescription={recommendation?.suggested_action || finding.description || ''}
          sourceLabel={finding.financial_indicator || 'Indicadores Financeiros'}
          indicatorCode={finding.financial_indicator || ''}
          alreadyInPlan={isFindingInActionPlan(finding)}
        />
      </div>
    </li>
  );
}

/**
 * @param {Object} props
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 */
export default function FinancialIndicatorsInsights({ diagnosisId, tenantId }) {
  const { data: findings = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'recommendations'),
    queryFn: () => base44.entities.FinancialRecommendation.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  const indicatorFindings = filterFindingsBySection(findings, 'indicators');

  const recByFindingKey = {};
  for (const rec of recommendations) {
    const fk = getFindingKeyFromRecommendation(rec);
    if (fk) recByFindingKey[fk] = rec;
  }

  const groups = SCOPE_ORDER.map((scope) => ({
    scope,
    items: indicatorFindings.filter((f) => f.finding_scope === scope),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Insights e Recomendações dos Indicadores</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          {isLoading && <p className="text-sm text-slate-400">Carregando leitura automática...</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum ponto de atenção automático gerado para os indicadores neste diagnóstico.</p>
          )}
          {groups.map(({ scope, items }) => (
            <div key={scope}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{SCOPE_LABEL[scope]}</span>
                <span className="text-xs text-slate-400">({items.length})</span>
              </div>
              <ul className="space-y-3">
                {items.map((finding) => (
                  <InsightRow
                    key={finding.id}
                    finding={finding}
                    recommendation={recByFindingKey[finding.finding_key]}
                    diagnosisId={diagnosisId}
                    tenantId={tenantId}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <FinancialAnalysisNoteEditor
          diagnosisId={diagnosisId}
          tenantId={tenantId}
          section="indicators"
        />
      </div>
    </div>
  );
}
