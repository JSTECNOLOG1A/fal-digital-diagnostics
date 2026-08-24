/**
 * CoverageMapInteractive
 * Matriz interativa: linha = entidade (grupo/empresa/unidade), coluna = dimensão FAL.
 * Clicar numa célula vincula/desvincula.
 * Criação de entidades é feita exclusivamente no DataHub.
 */
import React, { useState } from 'react';
import { Check, Info, ExternalLink, Layers, Building2, MapPin } from 'lucide-react';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';
import { DIMENSION_KEYS_ORDERED } from '@/lib/falDimensionScopePolicy.js';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const LEVEL_COLORS = {
  group:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  company: 'bg-blue-50 text-blue-700 border-blue-200',
  unit:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const LEVEL_ICON = {
  group:   <Layers className="w-3 h-3" />,
  company: <Building2 className="w-3 h-3" />,
  unit:    <MapPin className="w-3 h-3" />,
};

const LEVEL_LABEL = { group: 'Grupo', company: 'Empresa', unit: 'Unidade' };

/** Tooltip simples */
function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl pointer-events-none text-center leading-snug">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

/** Célula da matriz */
function MatrixCell({ dimKey, entity, isLinked, onToggle }) {
  const policy = getDimensionScopePolicy(dimKey);
  const allowed = policy.allowed_levels.includes(entity.level);

  if (!allowed) {
    return (
      <td className="px-2 py-3 text-center border-l border-slate-100">
        <Tooltip text={`A dimensão "${policy.label}" não é aplicável no nível ${LEVEL_LABEL[entity.level]} pela metodologia FAL.`}>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 border border-dashed border-slate-200 cursor-help">
            <span className="text-slate-300 text-xs font-bold">—</span>
          </span>
        </Tooltip>
      </td>
    );
  }

  return (
    <td className="px-2 py-3 text-center border-l border-slate-100">
      <Tooltip text={isLinked ? `Remover vínculo com "${policy.label}"` : `Vincular "${policy.label}" nesta entidade`}>
        <button
          onClick={() => onToggle(dimKey, entity)}
          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center mx-auto transition-all
            ${isLinked
              ? 'bg-blue-600 border-blue-600 shadow-sm scale-105'
              : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
        >
          {isLinked && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
      </Tooltip>
    </td>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.dimensions
 * @param {any=} props.onUpdate
 * @param {any=} props.groupId
 * @param {any=} props.groupName
 * @param {any=} props.companies
 * @param {any=} props.units
 * @param {any=} props.tenantId
 */
export default function CoverageMapInteractive({
  dimensions,
  onUpdate,
  groupId,
  groupName,
  companies,
  units,
  tenantId,
}) {
  // Todas as entidades como LINHAS: grupo, empresas, unidades
  const groupEntity = { id: groupId, name: groupName, level: 'group' };
  const companyEntities = companies.map(c => ({ id: c.id, name: c.name, level: 'company' }));
  const unitEntities = units.map(u => {
    const parent = companies.find(c => c.id === u.company_id);
    return { id: u.id, name: u.name, level: 'unit', company_id: u.company_id, company_name: parent?.name || '' };
  });
  const allEntities = [groupEntity, ...companyEntities, ...unitEntities];

  function isLinked(dimKey, entityId) {
    const cfg = dimensions[dimKey];
    if (!cfg || cfg.active === false) return false;
    return (cfg.targets || []).some(t => t.entity_id === entityId);
  }

  function handleToggle(dimKey, entity) {
    const policy = getDimensionScopePolicy(dimKey);
    if (!policy.allowed_levels.includes(entity.level)) return;

    const current = dimensions[dimKey] || { active: false, targets: [] };
    const targets = current.targets || [];
    const exists = targets.find(t => t.entity_id === entity.id);

    let newTargets;
    if (exists) {
      newTargets = targets.filter(t => t.entity_id !== entity.id);
    } else {
      newTargets = [...targets, {
        level: entity.level,
        entity_id: entity.id,
        entity_name: entity.name,
        weight: 1,
        sampling_mode: 'full',
        include_in_consolidated_score: true,
      }];
    }

    const active = newTargets.length > 0;
    onUpdate(dimKey, { ...current, active, targets: newTargets, level: entity.level });
  }

  // Contagem de dimensões vinculadas por entidade
  function dimLinkedCount(entityId) {
    return DIMENSION_KEYS_ORDERED.filter(k => isLinked(k, entityId)).length;
  }

  return (
    <div className="space-y-4">
      {/* Aviso DataHub */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <span>
          Para cadastrar ou alterar empresas e unidades, acesse o{' '}
          <Link to={createPageUrl('Groups')} className="font-semibold underline hover:text-amber-900 inline-flex items-center gap-0.5">
            DataHub <ExternalLink className="w-3 h-3" />
          </Link>.
          {' '}Aqui você define apenas quais entidades já cadastradas participam de cada dimensão.
        </span>
      </div>

      {/* Legenda */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Legenda</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md border-2 border-blue-600 bg-blue-600 inline-flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-white" />
            </span>
            <span><strong>Selecionado</strong> — será avaliado nesta dimensão</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md border-2 border-slate-200 inline-block flex-shrink-0" />
            <span><strong>Disponível</strong> — aplicável, mas não selecionado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-lg bg-slate-50 border border-dashed border-slate-200 inline-flex items-center justify-center flex-shrink-0">
              <span className="text-slate-300 text-[10px] font-bold">—</span>
            </span>
            <span><strong>Bloqueado</strong> — não aplicável pela metodologia FAL neste nível</span>
          </span>
        </div>
      </div>

      {/* Matriz: entidades em LINHAS, dimensões em COLUNAS */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              {/* Col: entidade */}
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider sticky left-0 bg-slate-800 z-10 min-w-[180px]">
                Entidade
              </th>
              {/* Colunas = dimensões */}
              {DIMENSION_KEYS_ORDERED.map(dimKey => {
                const policy = getDimensionScopePolicy(dimKey);
                return (
                  <th key={dimKey} className="px-2 py-3 text-center min-w-[80px] border-l border-slate-700">
                    <Tooltip text={policy.description || policy.label}>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <span className="text-base leading-none">{policy.icon}</span>
                        <span className="text-[10px] font-semibold text-slate-200 leading-tight max-w-[72px] text-center">
                          {policy.label}
                        </span>
                      </div>
                    </Tooltip>
                  </th>
                );
              })}
              {/* Col: resumo */}
              <th className="px-3 py-3 text-center min-w-[60px] border-l border-slate-700">
                <span className="text-[10px] font-semibold text-slate-400">Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {allEntities.map((entity, idx) => {
              const isEven = idx % 2 === 0;
              const count = dimLinkedCount(entity.id);
              // Separador visual antes das unidades
              const prevEntity = allEntities[idx - 1];
              const showGroupDivider = entity.level === 'company' && prevEntity?.level === 'group';
              const showUnitDivider  = entity.level === 'unit' && prevEntity?.level !== 'unit';

              return (
                <React.Fragment key={entity.id}>
                  {(showGroupDivider || showUnitDivider) && (
                    <tr>
                      <td colSpan={DIMENSION_KEYS_ORDERED.length + 2} className="py-0">
                        <div className="h-px bg-slate-200" />
                      </td>
                    </tr>
                  )}
                  <tr className={`border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${isEven ? 'bg-white' : 'bg-slate-50/40'}`}>
                    {/* Nome da entidade (sticky) */}
                    <td className={`px-4 py-3 sticky left-0 z-10 ${isEven ? 'bg-white' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${LEVEL_COLORS[entity.level]}`}>
                          {LEVEL_ICON[entity.level]}
                          {LEVEL_LABEL[entity.level]}
                        </span>
                        <div className="min-w-0">
                         <p className="text-xs font-semibold text-slate-800 truncate max-w-[160px]" title={entity.name}>
                            {entity.name}
                          </p>
                          {entity.company_name && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[160px]" title={entity.company_name}>{entity.company_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Células por dimensão */}
                    {DIMENSION_KEYS_ORDERED.map(dimKey => (
                      <MatrixCell
                        key={dimKey}
                        dimKey={dimKey}
                        entity={entity}
                        isLinked={isLinked(dimKey, entity.id)}
                        onToggle={handleToggle}
                      />
                    ))}
                    {/* Total de dimensões vinculadas */}
                    <td className="px-3 py-3 text-center border-l border-slate-100">
                      {count > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          {count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo por dimensão */}
      <div className="flex flex-wrap gap-2 pt-1">
        {DIMENSION_KEYS_ORDERED.map(dimKey => {
          const policy = getDimensionScopePolicy(dimKey);
          const count = (dimensions[dimKey]?.targets || []).length;
          return (
            <span key={dimKey} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium
              ${count > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              <span>{policy.icon}</span>
              {policy.label}
              {count > 0 && (
                <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{count}</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Política de aplicabilidade */}
      <details className="group">
        <summary className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer select-none list-none flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Ver política de aplicabilidade por dimensão
        </summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DIMENSION_KEYS_ORDERED.map(dimKey => {
            const policy = getDimensionScopePolicy(dimKey);
            return (
              <div key={dimKey} className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                <span className="text-sm">{policy.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{policy.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Aplica-se em: {policy.allowed_levels.map(l => LEVEL_LABEL[l]).join(', ')}
                  </p>
                  {policy.description && (
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{policy.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}