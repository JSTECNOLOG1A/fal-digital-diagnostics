import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ClipboardList } from 'lucide-react';
import { getFindingKeyFromRecommendation } from './FinancialRecommendationsTab';
import { financialKey } from '@/lib/query-client';

const PRIORITY_CLS = {
  critica: 'bg-red-50 border-red-200 text-red-700',
  alta:    'bg-orange-50 border-orange-200 text-orange-700',
  media:   'bg-amber-50 border-amber-200 text-amber-700',
  baixa:   'bg-slate-50 border-slate-200 text-slate-700',
};

const STATUS_LABEL = {
  proposed: 'Proposta',
  approved: 'Aprovada',
  exported: 'Exportada',
  rejected: 'Rejeitada',
};

const SCOPE_LABEL = {
  period_snapshot: 'Data-base',
  period_comparison: 'Evolução',
  structural_validation: 'Validações Estruturais',
};

/**
 * @param {Object} props
 * @param {any=} props.proposal
 * @param {any=} props.recommendation
 * @param {any=} props.finding
 */
function ProposalCard({ proposal, recommendation, finding }) {
  return (
    <div className={`border rounded-lg p-3 ${PRIORITY_CLS[proposal.priority] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{proposal.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60">{proposal.priority}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60">{STATUS_LABEL[proposal.status] || proposal.status}</span>
        </div>
      </div>
      {proposal.description && <p className="text-xs mt-1.5 opacity-80">{proposal.description}</p>}
      {recommendation && <p className="text-xs mt-1 opacity-70"><strong>Recomendação: </strong>{recommendation.title}</p>}
      {finding && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-medium opacity-70">
          {finding.period && <span>período {finding.period}</span>}
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
 * @param {any=} props.recById
 * @param {any=} props.findingByKey
 */
function Section({ title, items, recById, findingByKey }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{title}</span>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map(p => {
          const rec = recById[p.financial_recommendation_id];
          const key = rec ? getFindingKeyFromRecommendation(rec) : null;
          return (
            <ProposalCard key={p.id} proposal={p} recommendation={rec} finding={key ? findingByKey[key] : null} />
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
export default function FinancialActionProposalsTab({ diagnosisId, tenantId }) {
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'action-proposals'),
    queryFn: () => base44.entities.FinancialActionProposal.filter(
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

  const { data: findings = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  if (isLoading) return <p className="text-sm text-slate-400 py-8 text-center">Carregando ações propostas...</p>;

  if (proposals.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhuma ação proposta gerada ainda.</p>
      </div>
    );
  }

  const recById = {};
  for (const r of recommendations) recById[r.id] = r;

  const findingByKey = {};
  for (const f of findings) {
    if (f.finding_key) findingByKey[f.finding_key] = f;
  }

  const groups = { period_snapshot: [], period_comparison: [], structural_validation: [], other: [] };
  for (const p of proposals) {
    const rec = recById[p.financial_recommendation_id];
    const key = rec ? getFindingKeyFromRecommendation(rec) : null;
    const scope = key ? findingByKey[key]?.finding_scope : null;
    if (scope && groups[scope]) groups[scope].push(p);
    else groups.other.push(p);
  }

  return (
    <div className="space-y-6">
      <Section title={SCOPE_LABEL.period_snapshot}      items={groups.period_snapshot}      recById={recById} findingByKey={findingByKey} />
      <Section title={SCOPE_LABEL.period_comparison}     items={groups.period_comparison}    recById={recById} findingByKey={findingByKey} />
      <Section title={SCOPE_LABEL.structural_validation} items={groups.structural_validation} recById={recById} findingByKey={findingByKey} />
      <Section title="Sem vínculo rastreável"            items={groups.other}                recById={recById} findingByKey={findingByKey} />
    </div>
  );
}