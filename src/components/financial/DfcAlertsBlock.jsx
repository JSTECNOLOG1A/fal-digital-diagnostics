/**
 * DfcAlertsBlock — Bloco de ressalvas técnicas da DFC
 * Exibe FinancialValidationResult de category=dfc_composicao ou code iniciando com DFC_
 * quando a DFC foi gerada, evidenciando comparabilidade cross-upload e diferenças materiais.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

const DFC_CODES = new Set([
  'DFC_CASH_VARIATION_MISMATCH',
  'DFC_CROSS_UPLOAD_MAPPING_MISMATCH',
  'DFC_EQUITY_MOVEMENT_NOT_EXPLAINED',
  'DFC_PERIOD_RUBRIC_MISMATCH',
  'DFC_UNCLASSIFIED_RUBRICS',
  'DFC_MISSING_CASH_BASE',
  'DFC_INCOMPLETE_BALANCE_BASE',
  'DFC_REQUIRES_TWO_PERIODS',
]);

const SEVERITY_CONFIG = {
  blocking:  { icon: XCircle,      cls: 'fal-badge-danger',  iconCls: 'fal-icon-danger',  label: 'Bloqueante' },
  warning:   { icon: AlertTriangle, cls: 'fal-badge-warning', iconCls: 'fal-icon-warning', label: 'Ressalva' },
  info:      { icon: Info,         cls: 'fal-badge-current',  iconCls: 'fal-icon-info',    label: 'Info' },
};

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.period
 */
export default function DfcAlertsBlock({ diagnosisId, period }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const { data: allValidations = [], isLoading } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'dfc-alerts', period), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialValidationResult.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id:currentScope.processing_run_id, publication_status:'active', category: 'dfc_composicao', ...(period?{period}:{}) }, 'severity', 50
    ),
    enabled: !!currentScope?.processing_run_id,
  });

  const dfcAlerts = (allValidations || []).filter(v => DFC_CODES.has(v.code));

  if (isLoading) return null;
  if (dfcAlerts.length === 0) return null;

  return (
    <div className="mt-3 fal-card" style={{ borderColor: 'var(--fal-warning-border)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--fal-warning-bg)', borderBottom: '1px solid var(--fal-warning-border)', borderRadius: 'var(--fal-radius-lg) var(--fal-radius-lg) 0 0' }}>
        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--fal-warning-text)' }} />
        <span className="text-[12px] font-bold" style={{ color: 'var(--fal-warning-text)' }}>
          Ressalvas técnicas da DFC
        </span>
        <span className="text-[11px] fal-badge fal-badge-warning ml-auto">{dfcAlerts.length} alerta(s)</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--fal-border-subtle)' }}>
        {dfcAlerts.map((v, idx) => {
          const cfg = SEVERITY_CONFIG[v.severity] || SEVERITY_CONFIG.warning;
          const Icon = cfg.icon;
          return (
            <div key={v.id || idx} className="flex items-start gap-3 px-4 py-2.5">
              <div className={`fal-icon-warning w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconCls}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-bold" style={{ color: 'var(--fal-text-strong)' }}>{v.title}</span>
                  <span className={`fal-badge ${cfg.cls}`}>{cfg.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--fal-bg-muted)', color: 'var(--fal-text-muted)' }}>{v.code}</span>
                </div>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--fal-text-secondary)' }}>{v.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}