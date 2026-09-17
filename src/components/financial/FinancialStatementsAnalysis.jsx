/**
 * FinancialStatementsAnalysis
 * Bloco de leitura textual logo abaixo das tabelas de BP/DRE/DFC (sub-aba
 * Demonstrações): combina achados automáticos (source_type ∈ statement/
 * validation/dfc) com o comentário manual do consultor, agrupados por
 * finding_scope (leitura do período / evolução / validações estruturais).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';
import { FileText } from 'lucide-react';
import AddToActionPlanButton from './AddToActionPlanButton';
import FinancialAnalysisNoteEditor from './FinancialAnalysisNoteEditor';
import { getFindingKeyFromRecommendation } from './FinancialRecommendationsTab';
import {
  SCOPE_LABEL,
  filterFindingsBySection,
  getFindingSeverity,
  isFindingInActionPlan,
} from './financialFindingAdapter';

const SCOPE_ORDER = ['period_snapshot', 'period_comparison', 'structural_validation'];

/**
 * @param {Object} props
 * @param {any} props.finding
 * @param {any} props.recommendation
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 */
function FindingParagraph({ finding, recommendation, diagnosisId, tenantId }) {
  const severity = getFindingSeverity(finding);
  return (
    <div className="border-l-[3px] pl-3 py-1" style={{ borderColor: severity.accent }}>
      <p className="text-sm text-slate-800">
        <span className="font-semibold">{finding.title}</span>
        {finding.description ? <span className="text-slate-600"> — {finding.description}</span> : null}
      </p>
      {recommendation?.suggested_action && (
        <p className="text-xs text-slate-500 mt-0.5">
          <strong>Ação sugerida:</strong> {recommendation.suggested_action}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {finding.period && <span className="text-[10px] text-slate-400">período {finding.period}</span>}
        {finding.comparison_period && <span className="text-[10px] text-slate-400">vs {finding.comparison_period}</span>}
        <AddToActionPlanButton
          diagnosisId={diagnosisId}
          tenantId={tenantId}
          recommendationId={recommendation?.id}
          defaultTitle={finding.title}
          defaultDescription={recommendation?.suggested_action || finding.description || ''}
          sourceLabel={finding.financial_indicator || 'Demonstrações Financeiras'}
          alreadyInPlan={isFindingInActionPlan(finding)}
        />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 */
export default function FinancialStatementsAnalysis({ diagnosisId, tenantId }) {
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

  const statementFindings = filterFindingsBySection(findings, 'statements');

  const recByFindingKey = {};
  for (const rec of recommendations) {
    const fk = getFindingKeyFromRecommendation(rec);
    if (fk) recByFindingKey[fk] = rec;
  }

  const groups = SCOPE_ORDER.map((scope) => ({
    scope,
    items: statementFindings.filter((f) => f.finding_scope === scope),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Análise das Demonstrações Financeiras</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          {isLoading && <p className="text-sm text-slate-400">Carregando leitura automática...</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum achado automático gerado para as demonstrações neste diagnóstico.</p>
          )}
          {groups.map(({ scope, items }) => (
            <div key={scope}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{SCOPE_LABEL[scope]}</span>
                <span className="text-xs text-slate-400">({items.length})</span>
              </div>
              <div className="space-y-3">
                {items.map((finding) => (
                  <FindingParagraph
                    key={finding.id}
                    finding={finding}
                    recommendation={recByFindingKey[finding.finding_key]}
                    diagnosisId={diagnosisId}
                    tenantId={tenantId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <FinancialAnalysisNoteEditor
          diagnosisId={diagnosisId}
          tenantId={tenantId}
          section="statements"
        />
      </div>
    </div>
  );
}
