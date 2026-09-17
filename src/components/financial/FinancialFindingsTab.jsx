import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';
import { financialKey } from '@/lib/query-client';

const SEVERITY_CLS = {
  low:      'bg-slate-50 border-slate-200 text-slate-700',
  medium:   'bg-amber-50 border-amber-200 text-amber-700',
  high:     'bg-orange-50 border-orange-200 text-orange-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

/**
 * @param {Object} props
 * @param {any=} props.f
 */
function FindingCard({ f }) {
  return (
    <div className={`border rounded-lg p-3 ${SEVERITY_CLS[f.severity] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{f.title}</p>
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60 shrink-0">{f.severity}</span>
      </div>
      {f.description && <p className="text-xs mt-1 opacity-80">{f.description}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-medium opacity-70">
        {f.finding_type && <span>{f.finding_type}</span>}
        {f.period && <span>· período {f.period}</span>}
        {f.comparison_period && <span>· vs {f.comparison_period}</span>}
        {f.confidence_level && <span>· confiança {f.confidence_level}</span>}
        {f.status && <span>· {f.status}</span>}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.items
 */
function Section({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{title}</span>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map(f => <FindingCard key={f.id} f={f} />)}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 */
export default function FinancialFindingsTab({ diagnosisId, tenantId }) {
  const { data: findings = [], isLoading } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter(
      { financial_diagnosis_id: diagnosisId, tenant_id: tenantId }, '-created_date', 500
    ),
    enabled: !!diagnosisId && !!tenantId,
  });

  if (isLoading) return <p className="text-sm text-slate-400 py-8 text-center">Carregando achados...</p>;

  if (findings.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum achado gerado ainda.</p>
      </div>
    );
  }

  const snapshot   = findings.filter(f => f.finding_scope === 'period_snapshot');
  const comparison = findings.filter(f => f.finding_scope === 'period_comparison');
  const structural = findings.filter(f => f.finding_scope === 'structural_validation');
  const other       = findings.filter(f => !['period_snapshot', 'period_comparison', 'structural_validation'].includes(f.finding_scope));

  return (
    <div className="space-y-6">
      <Section title="Data-base"             items={snapshot} />
      <Section title="Evolução"              items={comparison} />
      <Section title="Validações estruturais" items={structural} />
      <Section title="Outros"                 items={other} />
    </div>
  );
}