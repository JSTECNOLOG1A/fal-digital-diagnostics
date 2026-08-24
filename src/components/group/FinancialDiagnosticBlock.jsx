/**
 * FinancialDiagnosticBlock — Bloco complementar do Diagnóstico Financeiro
 * Exibe status, achados e controles de envio ao plano de ação.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Plus, AlertCircle } from 'lucide-react';
import { groupKey, financialKey } from '@/lib/query-client';
import PermissionGuard from '@/components/shared/PermissionGuard';

const FINDING_STATUS_CFG = {
  not_sent:             { label: 'Não enviado',         cls: 'bg-slate-100 text-slate-500' },
  suggested:            { label: 'Sugerido ao plano',   cls: 'bg-blue-100 text-blue-600' },
  needs_classification: { label: 'Pendente de org.',    cls: 'bg-amber-100 text-amber-700' },
  converted_to_task:    { label: 'Incluído no plano',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:             { label: 'Rejeitado',           cls: 'bg-slate-100 text-slate-400' },
};

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.onNewFinancial
 */
export default function FinancialDiagnosticBlock({ groupId, tenantId, onNewFinancial }) {
  const { data: finDiagnoses = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'financial-diagnoses'),
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ group_id: groupId }, '-created_date', 5),
    enabled: !!groupId,
  });
  const latestFin = finDiagnoses[0] || null;

  const { data: findings = [] } = useQuery({
    queryKey: financialKey(tenantId, latestFin?.id, 'findings'),
    queryFn: () => base44.entities.FinancialFinding.filter({ financial_diagnosis_id: latestFin.id }),
    enabled: !!latestFin?.id,
  });

  const notSent = findings.filter(f => f.action_plan_status === 'not_sent').length;
  const suggested = findings.filter(f => ['suggested', 'needs_classification'].includes(f.action_plan_status)).length;
  const converted = findings.filter(f => f.action_plan_status === 'converted_to_task').length;

  const finStatus = latestFin
    ? (latestFin.status === 'completed' ? 'Concluído' :
       latestFin.status === 'processing' ? 'Processando' : 'Rascunho')
    : null;

  const finStatusStyle = latestFin?.status === 'completed'
    ? {background:'var(--fal-success-bg)', color:'var(--fal-success-text)'}
    : latestFin?.status === 'processing'
    ? {background:'var(--fal-current-bg)', color:'var(--fal-current-text)'}
    : {background:'var(--fal-neutral-bg)', color:'var(--fal-neutral-text)'};

  return (
    <div className="fal-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{borderBottom:'1px solid var(--fal-border-subtle)'}}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--fal-green-700)'}}>
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold fal-title">Análise Financeira</p>
          <p className="text-xs fal-muted">Análise financeira e achados que alimentam o plano de ação</p>
        </div>
        {finStatus && (
          <span className="fal-badge flex-shrink-0" style={finStatusStyle}>{finStatus}</span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {!latestFin ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="w-10 h-10 rounded-xl fal-icon-neutral flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold fal-title">Nenhuma análise financeira criada</p>
              <p className="text-xs fal-muted mt-1 max-w-[220px] mx-auto">Crie uma análise financeira para importar balancetes e gerar indicadores.</p>
            </div>
            <PermissionGuard area="financial">
              <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} onClick={onNewFinancial}>
                <Plus className="w-3.5 h-3.5" /> Nova Análise Financeira
              </Button>
            </PermissionGuard>
          </div>
        ) : (
          <>
            {/* Info básica */}
            <div className="flex items-center justify-between">
              {latestFin.last_period && (
                <div>
                  <p className="text-sm font-semibold fal-title">{latestFin.last_period}</p>
                  <p className="text-xs fal-muted">Última competência</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-semibold fal-title">{findings.length}</p>
                <p className="text-xs fal-muted">Achados</p>
              </div>
            </div>

            {/* Achados por status */}
            {findings.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-2 text-center" style={{background:'var(--fal-neutral-bg)'}}>
                  <p className="text-base font-bold fal-title">{notSent}</p>
                  <p className="text-[10px] fal-muted">Não enviados</p>
                </div>
                <div className="rounded-lg p-2 text-center" style={{background:'var(--fal-warning-bg)'}}>
                  <p className="text-base font-bold" style={{color:'var(--fal-warning-text)'}}>{suggested}</p>
                  <p className="text-[10px]" style={{color:'var(--fal-warning-text)'}}>Pendentes</p>
                </div>
                <div className="rounded-lg p-2 text-center" style={{background:'var(--fal-success-bg)'}}>
                  <p className="text-base font-bold" style={{color:'var(--fal-success-text)'}}>{converted}</p>
                  <p className="text-[10px]" style={{color:'var(--fal-success-text)'}}>No plano</p>
                </div>
              </div>
            )}

            {notSent > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{background:'var(--fal-warning-bg)', border:'1px solid var(--fal-warning-border)'}}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{color:'var(--fal-warning-text)'}} />
                <p className="text-xs" style={{color:'var(--fal-warning-text)'}}>{notSent} achado(s) ainda não enviados ao plano de ação.</p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} asChild>
                <Link to={createPageUrl(`FinancialDiagnosisDetail?id=${latestFin.id}`)}>
                  <TrendingUp className="w-3 h-3" /> Ver análise financeira
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 fal-muted" onClick={onNewFinancial}>
                <Plus className="w-3 h-3" /> Novo
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}