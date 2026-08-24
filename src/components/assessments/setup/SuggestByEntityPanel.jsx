import React, { useState } from 'react';
import { Wand2, Building2, Warehouse, Layers, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';

/**
 * Política de dimensões recomendadas por tipo de entidade:
 * - group:   dimensões avaliadas no nível grupo
 * - company: dimensões avaliadas no nível empresa
 * - unit:    dimensões avaliadas no nível unidade
 */
const DIMS_BY_LEVEL = {
  group:   ['governanca', 'juridico', 'sistemas'],
  company: ['financeiro', 'contabil', 'tributario', 'controles_internos', 'operacional'],
  unit:    ['controles_internos', 'operacional', 'sistemas'],
};

function buildTargetsForEntity(entity, level) {
  return {
    level,
    entity_id: entity.id,
    entity_name: entity.name,
    weight: 1,
    sampling_mode: 'full',
    include_in_consolidated_score: true,
  };
}

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.groupName
 * @param {any=} props.companies
 * @param {any=} props.units
 * @param {any=} props.dimensions
 * @param {any=} props.onUpdate
 */
export default function SuggestByEntityPanel({ groupId, groupName, companies, units, dimensions, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('company'); // 'group' | 'company' | 'unit'
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [applied, setApplied] = useState(false);

  const entityOptions = {
    group:   groupId ? [{ id: groupId, name: groupName || 'Grupo' }] : [],
    company: companies,
    unit:    units,
  };

  const currentOptions = entityOptions[selectedType] || [];
  const selectedEntity = currentOptions.find(e => e.id === selectedEntityId);

  function handleApply() {
    if (!selectedEntity) return;
    const dimsToActivate = DIMS_BY_LEVEL[selectedType] || [];

    for (const dimKey of dimsToActivate) {
      const policy = getDimensionScopePolicy(dimKey);
      if (!policy.allowed_levels.includes(selectedType)) continue;

      const current = dimensions[dimKey] || { active: false, targets: [] };
      const alreadyHas = (current.targets || []).find(t => t.entity_id === selectedEntityId);
      if (alreadyHas) continue;

      const newTarget = buildTargetsForEntity(selectedEntity, selectedType);
      onUpdate(dimKey, {
        ...current,
        active: true,
        level: selectedType,
        targets: [...(current.targets || []), newTarget],
      });
    }

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

  const ENTITY_TYPES = [
    { key: 'group',   label: 'Grupo',   Icon: Layers },
    { key: 'company', label: 'Empresa', Icon: Building2 },
    { key: 'unit',    label: 'Unidade', Icon: Warehouse },
  ];

  const dimsPreview = (DIMS_BY_LEVEL[selectedType] || []).filter(k =>
    getDimensionScopePolicy(k).allowed_levels.includes(selectedType)
  );

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Wand2 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">Sugerir dimensões por entidade</span>
          <span className="text-[11px] text-slate-400 font-normal">— selecione uma empresa, unidade ou grupo e ative automaticamente as dimensões recomendadas</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* Tipo de entidade */}
          <div className="flex gap-2">
            {ENTITY_TYPES.map(({ key, label, Icon: EntityIcon }) => (
              <button
                key={key}
                onClick={() => { setSelectedType(key); setSelectedEntityId(''); setApplied(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                  ${selectedType === key
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <EntityIcon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            {/* Seleção de entidade */}
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {selectedType === 'group' ? 'Grupo' : selectedType === 'company' ? 'Empresa' : 'Unidade / Fazenda'}
              </label>
              {currentOptions.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Nenhuma entidade cadastrada neste nível.</p>
              ) : (
                <select
                  value={selectedEntityId}
                  onChange={e => { setSelectedEntityId(e.target.value); setApplied(false); }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Selecione...</option>
                  {currentOptions.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Botão aplicar */}
            <button
              onClick={handleApply}
              disabled={!selectedEntityId || applied}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${applied
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white'}`}
            >
              {applied ? <><Check className="w-3.5 h-3.5" /> Aplicado!</> : <><Wand2 className="w-3.5 h-3.5" /> Aplicar sugestão</>}
            </button>
          </div>

          {/* Preview das dimensões que serão ativadas */}
          {dimsPreview.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">
                Dimensões que serão ativadas para este nível:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dimsPreview.map(k => {
                  const policy = getDimensionScopePolicy(k);
                  return (
                    <span key={k} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                      {policy.icon} {policy.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}