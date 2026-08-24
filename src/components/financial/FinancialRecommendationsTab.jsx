import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Lightbulb } from 'lucide-react';
import { financialKey } from '@/lib/query-client';

const PRIORITY_CLS = {
  critica: 'bg-red-50 border-red-200 text-red-700',
  alta:    'bg-orange-50 border-orange-200 text-orange-700',
  media:   'bg-amber-50 border-amber-200 text-amber-700',
  baixa:   'bg-slate-50 border-slate-200 text-slate-700',
};

const SCOPE_LABEL = {
  period_snapshot: 'Data-base',
  period_comparison: 'Evolução',
  structural_validation: 'Validações Estruturais',
};

export function getFindingKeyFromRecommendation(rec) {
  const tag = (rec.related_indicator_codes || []).find(c =>
    typeof c === 'string' && c.startsWith('__fk__:')
  );
  return tag ? tag.replace('__fk__:', '') : null;
}

/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.finding
 */
function RecommendationCard({ rec, finding }) {
  return (
    <div className={`border rounded-lg p-3 ${PRIORITY_CLS[rec.priority] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{rec.title}</p>
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60 shrink-0">{rec.priority}</span>
      </div>
      {rec.diagnostic_thesis && <p className="text-xs mt-1.5 opacity-80"><strong>Tese: </strong>{rec.diagnostic_thesis}</p>}
      {rec.probable_cause && <p className="text-xs mt-1 opacity-80"><strong>Causa provável: </strong>{rec.probable_cause}</p>}
      {rec.suggested_action && <p className="text-xs mt-1 opacity-80"><strong>Ação sugerida: </strong>{rec.suggested_action}</p>}
      {rec.expected_impact && <p className="text-xs mt-1 opacity-80"><strong>Impacto esperado: </strong>{rec.expected_impact}</p>}
      {finding && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-medium opacity-70">
          {finding.financial_indicator && <span>{finding.financial_indicator}</span>}
          {finding.period && <span>· período {finding.period}</span>}
          {finding.comparison_period && <span>· vs {finding.comparison_period}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.items
 * @param {any=} props.findingByKey
 */
function Section({ title, items, findingByKey }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{title}</span>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} finding={findingByKey[getFindingKeyFromRecommendation(rec)]} />
        ))}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
export default function FinancialRecommendationsTab({ diagnosisId, tenantId }) {
  const { data: recommendations = [], isLoading: loadingRecs } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'recommendations'),
    queryFn: () => base44.entities.FinancialRecommendation.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  const { data: findings = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  if (loadingRecs) return <p className="text-sm text-slate-400 py-8 text-center">Carregando recomendações...</p>;

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Lightbulb className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhuma recomendação gerada ainda.</p>
      </div>
    );
  }

  const findingByKey = {};
  for (const f of findings) {
    if (f.finding_key) findingByKey[f.finding_key] = f;
  }

  const groups = { period_snapshot: [], period_comparison: [], structural_validation: [], other: [] };
  for (const rec of recommendations) {
    const key = getFindingKeyFromRecommendation(rec);
    const finding = key ? findingByKey[key] : null;
    const scope = finding?.finding_scope;
    if (scope && groups[scope]) groups[scope].push(rec);
    else groups.other.push(rec);
  }

  return (
    <div className="space-y-6">
      <Section title={SCOPE_LABEL.period_snapshot}      items={groups.period_snapshot}      findingByKey={findingByKey} />
      <Section title={SCOPE_LABEL.period_comparison}     items={groups.period_comparison}    findingByKey={findingByKey} />
      <Section title={SCOPE_LABEL.structural_validation} items={groups.structural_validation} findingByKey={findingByKey} />
      <Section title="Sem vínculo rastreável"            items={groups.other}                findingByKey={findingByKey} />
    </div>
  );
}