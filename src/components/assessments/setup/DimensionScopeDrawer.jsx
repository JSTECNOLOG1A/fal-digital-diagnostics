import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Plus, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';
import { buildRecommendedMapping } from '@/lib/falAssessmentScopeUtils.js';
import DimensionLevelBadge from './DimensionLevelBadge.jsx';
import { base44 } from '@/api/base44Client';

const LEVEL_LABELS = { group: 'Grupo', company: 'Empresa', unit: 'Unidade/Fazenda' };
const SAMPLING_OPTS = [
  { key: 'full', label: 'Completa' },
  { key: 'sample', label: 'Amostral' },
];

// Inline quick-create form for company or unit
/**
 * @param {Object} props
 * @param {any=} props.type
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.companies
 * @param {any=} props.onCreated
 * @param {any=} props.onCancel
 */
function QuickCreateForm({ type, groupId, tenantId, companies, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(companies?.[0]?.id || '');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    let created;
    if (type === 'company') {
      created = await base44.entities.Company.create({
        tenant_id: tenantId,
        group_id: groupId,
        name: name.trim(),
      });
    } else {
      created = await base44.entities.OperationalUnit.create({
        tenant_id: tenantId,
        company_id: companyId,
        name: name.trim(),
        is_active: true,
      });
    }
    setSaving(false);
    onCreated(created);
  }

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
      <p className="text-xs font-semibold text-blue-700">
        {type === 'company' ? 'Nova Empresa' : 'Nova Unidade/Fazenda'}
      </p>
      {type === 'unit' && companies.length > 0 && (
        <select
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleCreate()}
        placeholder={type === 'company' ? 'Razão social ou nome fantasia' : 'Nome da unidade/fazenda'}
        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancelar</button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving || (type === 'unit' && !companyId)}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {saving ? 'Criando...' : 'Criar'}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.dimensionKey
 * @param {any=} props.config
 * @param {any=} props.groupId
 * @param {any=} props.groupName
 * @param {any=} props.companies
 * @param {any=} props.units
 * @param {any=} props.tenantId
 * @param {any=} props.onSave
 * @param {any=} props.onClose
 * @param {any=} props.onCompanyCreated
 * @param {any=} props.onUnitCreated
 */
export default function DimensionScopeDrawer({ dimensionKey, config, groupId, groupName, companies, units, tenantId, onSave, onClose, onCompanyCreated, onUnitCreated }) {
  const policy = getDimensionScopePolicy(dimensionKey);
  const [level, setLevel] = useState(config?.level || policy.default_level);
  const [targets, setTargets] = useState(config?.targets || []);
  const [note, setNote] = useState(config?.note || '');
  const [showQuickCreate, setShowQuickCreate] = useState(null); // 'company' | 'unit' | null

  // Reinitialize when dimensionKey changes
  useEffect(() => {
    setLevel(config?.level || policy.default_level);
    setTargets(config?.targets || []);
    setNote(config?.note || '');
  }, [dimensionKey]);

  // Available entities for selected level
  const availableEntities = (() => {
    if (level === 'group') return [{ id: groupId, name: groupName }];
    if (level === 'company') return companies;
    if (level === 'unit') return units;
    return [];
  })();

  const isLevelAllowed = policy.allowed_levels.includes(level);
  const canSave = isLevelAllowed && targets.length > 0;

  function toggleEntity(entity) {
    const exists = targets.find(t => t.entity_id === entity.id);
    if (exists) {
      setTargets(targets.filter(t => t.entity_id !== entity.id));
    } else {
      setTargets([...targets, {
        level,
        entity_id: entity.id,
        entity_name: entity.name,
        weight: 1,
        sampling_mode: 'full',
        include_in_consolidated_score: true,
      }]);
    }
  }

  function updateTarget(entityId, field, value) {
    setTargets(targets.map(t => t.entity_id === entityId ? { ...t, [field]: value } : t));
  }

  function handleLevelChange(newLevel) {
    setLevel(newLevel);
    setTargets([]); // reset targets when level changes
  }

  function handleSuggest() {
    const recommended = buildRecommendedMapping({ groupId, groupName, companies, units });
    const suggested = recommended[dimensionKey];
    if (!suggested || suggested.length === 0) return;
    const suggestedLevel = suggested[0].level;
    setLevel(suggestedLevel);
    setTargets(suggested);
  }

  function handleSave() {
    if (!canSave) return;
    onSave(dimensionKey, { level, targets, note });
    onClose();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-white shadow-2xl flex flex-col border-l border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Configurar Dimensão</p>
          <h2 className="text-base font-bold text-slate-900">{policy.label}</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Description + Suggest button */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-600 leading-relaxed flex-1">{policy.description}</p>
          {buildRecommendedMapping({ groupId, groupName, companies, units })[dimensionKey] && (
            <button
              onClick={handleSuggest}
              className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" /> Sugerir FAL
            </button>
          )}
        </div>

        {/* Level Selector */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nível de avaliação</p>
          <div className="flex gap-2 flex-wrap">
            {['group', 'company', 'unit'].map(lvl => {
              const allowed = policy.allowed_levels.includes(lvl);
              const isDefault = policy.default_level === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => allowed && handleLevelChange(lvl)}
                  disabled={!allowed}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-2
                    ${level === lvl ? 'border-blue-600 bg-blue-50 text-blue-700' : ''}
                    ${allowed && level !== lvl ? 'border-slate-200 hover:border-slate-300 text-slate-600' : ''}
                    ${!allowed ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50' : ''}
                  `}
                >
                  {LEVEL_LABELS[lvl]}
                  {isDefault && <span className="ml-1 text-[10px] opacity-60">(sugerido)</span>}
                </button>
              );
            })}
          </div>
          {!isLevelAllowed && (
            <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              A dimensão {policy.label} não pode ser avaliada neste nível. Níveis permitidos: {policy.allowed_levels.map(l => LEVEL_LABELS[l]).join(', ')}.
            </div>
          )}
        </div>

        {/* Entity Selection */}
        {isLevelAllowed && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Entidades — {LEVEL_LABELS[level]}
                <span className="ml-2 text-slate-400 font-normal normal-case">(seleção múltipla)</span>
              </p>
              {(level === 'company' || level === 'unit') && !showQuickCreate && (
                <button
                  onClick={() => setShowQuickCreate(level === 'company' ? 'company' : 'unit')}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> {level === 'company' ? 'Nova Empresa' : 'Nova Unidade'}
                </button>
              )}
            </div>

            {showQuickCreate && (
              <QuickCreateForm
                type={showQuickCreate}
                groupId={groupId}
                tenantId={tenantId}
                companies={companies}
                onCreated={(entity) => {
                  setShowQuickCreate(null);
                  if (showQuickCreate === 'company') onCompanyCreated?.(entity);
                  else onUnitCreated?.(entity);
                  // Auto-select the newly created entity
                  setTargets(prev => [...prev, {
                    level,
                    entity_id: entity.id,
                    entity_name: entity.name,
                    weight: 1,
                    sampling_mode: 'full',
                    include_in_consolidated_score: true,
                  }]);
                }}
                onCancel={() => setShowQuickCreate(null)}
              />
            )}

            {availableEntities.length === 0 && !showQuickCreate ? (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm italic mb-2">Nenhuma entidade disponível neste nível.</p>
              </div>
            ) : availableEntities.length > 0 ? (
              <div className="space-y-2">
                {availableEntities.map(entity => {
                  const isSelected = !!targets.find(t => t.entity_id === entity.id);
                  const target = targets.find(t => t.entity_id === entity.id);
                  return (
                    <div key={entity.id} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => toggleEntity(entity)}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                          ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium text-slate-800 flex-1">{entity.name}</span>
                        <DimensionLevelBadge level={level} />
                      </div>

                      {/* Per-entity config when selected */}
                      {isSelected && target && (
                        <div className="px-4 pb-3 pt-0 flex gap-3 flex-wrap border-t border-blue-200">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Cobertura</p>
                            <div className="flex gap-1">
                              {SAMPLING_OPTS.map(o => (
                                <button
                                  key={o.key}
                                  onClick={() => updateTarget(entity.id, 'sampling_mode', o.key)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors
                                    ${target.sampling_mode === o.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Incluir no IFME™</p>
                            <button
                              onClick={() => updateTarget(entity.id, 'include_in_consolidated_score', !target.include_in_consolidated_score)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors
                                ${target.include_in_consolidated_score ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {target.include_in_consolidated_score ? 'Sim' : 'Não'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {targets.length === 0 && availableEntities.length > 0 && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Selecione ao menos uma entidade.
              </p>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Observação metodológica <span className="font-normal normal-case">(opcional)</span></p>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex: Amostra representativa de 3 das 7 fazendas do grupo."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end bg-slate-50">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Salvar configuração
        </Button>
      </div>


    </div>
  );
}