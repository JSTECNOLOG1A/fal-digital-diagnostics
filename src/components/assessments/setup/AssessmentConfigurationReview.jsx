import React from 'react';
import { AlertTriangle, CheckCircle2, Info, FlaskConical } from 'lucide-react';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';
import { DIMENSION_KEYS_ORDERED } from '@/lib/falDimensionScopePolicy.js';
import SamplingModeBadge from './SamplingModeBadge.jsx';

/**
 * @param {Object} props
 * @param {any=} props.form
 * @param {any=} props.dimensions
 * @param {any=} props.companies
 * @param {any=} props.units
 */
export default function AssessmentConfigurationReview({ form, dimensions, companies, units }) {
  const activeDims = DIMENSION_KEYS_ORDERED.filter(k => dimensions[k]?.active !== false && dimensions[k]?.targets?.length > 0);
  const inactiveDims = DIMENSION_KEYS_ORDERED.filter(k => dimensions[k]?.active === false);
  const attentionDims = DIMENSION_KEYS_ORDERED.filter(k => {
    const cfg = dimensions[k];
    return cfg?.active !== false && (!cfg?.targets || cfg.targets.length === 0);
  });

  const allTargets = activeDims.flatMap(k => dimensions[k]?.targets || []);
  const groupEntities  = [...new Set(allTargets.filter(t => t.level === 'group').map(t => t.entity_id))];
  const companyEntities = [...new Set(allTargets.filter(t => t.level === 'company').map(t => t.entity_id))];
  const unitEntities   = [...new Set(allTargets.filter(t => t.level === 'unit').map(t => t.entity_id))];
  const totalScopes    = allTargets.length;
  const sampleDims     = activeDims.filter(k => (dimensions[k]?.targets || []).some(t => t.sampling_mode === 'sample'));

  // Alerts
  const alerts = [];
  if (attentionDims.length > 0) {
    alerts.push({ type: 'error', msg: `${attentionDims.length} dimensão(ões) ativa(s) sem entidade configurada: ${attentionDims.map(k => getDimensionScopePolicy(k).label).join(', ')}.` });
  }
  if (sampleDims.length > 0) {
    alerts.push({ type: 'warning', msg: `${sampleDims.length} dimensão(ões) serão avaliadas por amostragem: ${sampleDims.map(k => getDimensionScopePolicy(k).label).join(', ')}.` });
  }
  const coveredUnitIds = new Set(unitEntities);
  const uncoveredUnits = units.filter(u => !coveredUnitIds.has(u.id));
  if (uncoveredUnits.length > 0) {
    alerts.push({ type: 'info', msg: `${uncoveredUnits.length} unidade(s) não incluída(s) em nenhuma dimensão: ${uncoveredUnits.slice(0, 3).map(u => u.name).join(', ')}${uncoveredUnits.length > 3 ? '...' : ''}.` });
  }

  const hasBlockers = attentionDims.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Summary card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Resumo do Diagnóstico</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-xs text-slate-400">Grupo</dt><dd className="font-semibold text-slate-800">{form.group_name || '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Tipo</dt><dd className="font-semibold text-blue-700">Diagnóstico FAL</dd></div>
          <div><dt className="text-xs text-slate-400">Nome</dt><dd className="font-semibold text-slate-800">{form.title || '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Ciclo</dt><dd className="font-semibold text-slate-800">{form.diagnostic_cycle || '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Dimensões ativas</dt><dd className="font-semibold text-emerald-700">{activeDims.length} de {DIMENSION_KEYS_ORDERED.length}</dd></div>
          <div><dt className="text-xs text-slate-400">AssessmentScopes est.</dt><dd className="font-semibold text-blue-700">{totalScopes}</dd></div>
          <div>
            <dt className="text-xs text-slate-400">Entidades avaliadas</dt>
            <dd className="font-semibold text-slate-800">
              {groupEntities.length > 0 && `${groupEntities.length} grupo`}
              {companyEntities.length > 0 && ` · ${companyEntities.length} empresa(s)`}
              {unitEntities.length > 0 && ` · ${unitEntities.length} fazenda(s)`}
            </dd>
          </div>
          {sampleDims.length > 0 && (
            <div><dt className="text-xs text-slate-400">Dimensões amostrais</dt><dd className="font-semibold text-amber-700">{sampleDims.length}</dd></div>
          )}
        </dl>
      </div>

      {/* Cobertura por dimensão */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cobertura por Dimensão</p>
        <div className="space-y-2">
          {activeDims.map(k => {
            const policy = getDimensionScopePolicy(k);
            const targets = dimensions[k]?.targets || [];
            const hasSample = targets.some(t => t.sampling_mode === 'sample');
            return (
              <div key={k} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-base w-6">{policy.icon}</span>
                <span className="flex-1 text-sm font-medium text-slate-700">{policy.label}</span>
                <span className="text-xs text-slate-500">{targets.length} entidade(s)</span>
                <SamplingModeBadge mode={hasSample ? 'sample' : 'full'} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avisos</p>
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm rounded-xl px-4 py-3 border
              ${a.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                a.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-blue-50 border-blue-200 text-blue-700'}`}>
              {a.type === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {a.type === 'warning' && <FlaskConical className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {a.type === 'info' && <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Entidades vinculadas */}
      {(companyEntities.length > 0 || unitEntities.length > 0) && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Entidades Vinculadas</p>
          <div className="space-y-1 text-sm text-slate-700">
            {groupEntities.length > 0 && <p>🏢 <strong>{groupEntities.length}</strong> grupo</p>}
            {companyEntities.length > 0 && <p>🏭 <strong>{companyEntities.length}</strong> empresa(s)</p>}
            {unitEntities.length > 0 && <p>🌾 <strong>{unitEntities.length}</strong> fazenda(s)/unidade(s)</p>}
          </div>
        </div>
      )}

      {/* Nota consolidada */}
      {totalScopes > 1 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">O sistema produzirá nota consolidada</p>
            <p className="text-xs text-blue-700 mt-0.5">
              As notas por entidade serão agregadas por dimensão. O IFME™ será calculado
              a partir das notas consolidadas das dimensões, não da média direta dos escopos.
            </p>
          </div>
        </div>
      )}

      {!hasBlockers && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Configuração válida. Pronto para criar o diagnóstico FAL.
        </div>
      )}
    </div>
  );
}