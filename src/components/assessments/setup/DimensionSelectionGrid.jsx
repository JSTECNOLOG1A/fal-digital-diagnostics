import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DimensionCard from './DimensionCard.jsx';
import DimensionScopeDrawer from './DimensionScopeDrawer.jsx';
import SuggestByEntityPanel from './SuggestByEntityPanel.jsx';
import { DIMENSION_KEYS_ORDERED } from '@/lib/falDimensionScopePolicy.js';

/**
 * @param {Object} props
 * @param {any=} props.dimensions
 * @param {any=} props.onUpdate
 * @param {any=} props.groupId
 * @param {any=} props.groupName
 * @param {any=} props.companies
 * @param {any=} props.units
 * @param {any=} props.tenantId
 * @param {any=} props.onApplyRecommended
 * @param {any=} props.onCompanyCreated
 * @param {any=} props.onUnitCreated
 */
export default function DimensionSelectionGrid({
  dimensions, onUpdate, groupId, groupName, companies, units, tenantId, onApplyRecommended, onCompanyCreated, onUnitCreated,
}) {
  const [openDrawer, setOpenDrawer] = useState(null); // dimension_key or null

  function handleToggle(dimKey) {
    const current = dimensions[dimKey] || { active: false };
    onUpdate(dimKey, { ...current, active: !current.active });
  }

  function handleSaveScope(dimKey, scopeConfig) {
    const current = dimensions[dimKey] || {};
    onUpdate(dimKey, { ...current, active: true, ...scopeConfig });
  }

  const openDrawerConfig = openDrawer ? dimensions[openDrawer] : null;

  return (
    <div>
      {/* Apply recommended button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Configure cada dimensão ou aplique a configuração sugerida pelo Método FAL.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyRecommended}
          className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <Wand2 className="w-3.5 h-3.5" /> Aplicar configuração recomendada FAL
        </Button>
      </div>

      {/* Suggest by entity */}
      <SuggestByEntityPanel
        groupId={groupId}
        groupName={groupName}
        companies={companies}
        units={units}
        dimensions={dimensions}
        onUpdate={onUpdate}
      />

      {/* Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {DIMENSION_KEYS_ORDERED.map(dimKey => (
          <DimensionCard
            key={dimKey}
            dimensionKey={dimKey}
            config={dimensions[dimKey]}
            onToggle={handleToggle}
            onConfigure={key => setOpenDrawer(key)}
          />
        ))}
      </div>

      {/* Drawer */}
      {openDrawer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenDrawer(null)} />
          <DimensionScopeDrawer
            dimensionKey={openDrawer}
            config={openDrawerConfig}
            groupId={groupId}
            groupName={groupName}
            companies={companies}
            units={units}
            tenantId={tenantId}
            onSave={handleSaveScope}
            onClose={() => setOpenDrawer(null)}
            onCompanyCreated={onCompanyCreated}
            onUnitCreated={onUnitCreated}
          />
        </>
      )}
    </div>
  );
}