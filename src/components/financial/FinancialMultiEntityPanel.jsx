import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PreparationPanel from './PreparationPanel';
import ConsolidationEntryManager from './ConsolidationEntryManager';
import IntercompanyReconciliationPanel from './IntercompanyReconciliationPanel';
import { Layers, GitBranch, GitCompareArrows } from 'lucide-react';
import { useTenant } from '@/components/shared/TenantContext';

/**
 * FinancialMultiEntityPanel — painel multi-entidade ciente do analysis_type.
 *
 * Consolidada: Conciliação Intragrupo → Cédula de Eliminações e Ajustes → Preparação do Dataset.
 *   (inicia em Conciliação — nunca em Preparação, que exige conciliação antes)
 * Combinada: Conciliação Intragrupo → Cédula de Eliminações → Preparação da Combinação.
 */
export default function FinancialMultiEntityPanel({ diagnosisId, diagnosis }) {
  const { tenantId } = useTenant();
  const analysisType = diagnosis?.analysis_type || 'individual';
  const isConsolidated = analysisType === 'consolidated';
  const [activeSubTab, setActiveSubTab] = useState('reconciliation');

  const { data: scopeEntities = [] } = useQuery({
    queryKey: ['scope-entities-multi', diagnosisId],
    queryFn: () => base44.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId }, 'id', 100),
    enabled: !!diagnosisId,
  });

  const TABS = [
    { key: 'reconciliation', label: 'Reconciliação Intragrupo', icon: GitCompareArrows },
    { key: 'consolidation', label: 'Cédula de Eliminações', icon: GitBranch },
    { key: 'preparation', label: isConsolidated ? 'Preparação do Dataset' : 'Preparação da Combinação', icon: Layers },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              activeSubTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>
      {activeSubTab === 'preparation' && <PreparationPanel diagnosisId={diagnosisId} diagnosis={diagnosis} />}
      {activeSubTab === 'consolidation' && <ConsolidationEntryManager diagnosisId={diagnosisId} scopeEntities={scopeEntities} />}
      {activeSubTab === 'reconciliation' && <IntercompanyReconciliationPanel diagnosisId={diagnosisId} scopeEntities={scopeEntities} />}
    </div>
  );
}