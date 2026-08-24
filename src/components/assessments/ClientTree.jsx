import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { ChevronRight, ChevronDown, Layers, Building2, MapPin, Plus, Pencil, Archive } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import CreateFirstClientDialog from './CreateFirstClientDialog';
import CreateCompanyDialog from './CreateCompanyDialog';
import CreateUnitDialog from './CreateUnitDialog';
import EditEntityDialog from './EditEntityDialog';
import ArchiveEntityDialog from './ArchiveEntityDialog';

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.icon
 * @param {any=} props.iconColor
 * @param {any=} props.selected
 * @param {any=} props.onClick
 * @param {any=} props.children
 * @param {any=} props.depth
 */
function TreeNode({ label, icon: Icon, iconColor, selected, onClick, children, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const hasChildren = React.Children.count(children) > 0;

  const depthPadding = {
    0: '4px',
    1: '18px',
    2: '34px',
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-2 rounded-lg cursor-pointer text-sm transition-colors select-none tree-item
          ${selected ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-100'}
        `}
        style={{ paddingLeft: depthPadding[depth] || `${4 + depth * 16}px`, paddingRight: '12px' }}
        onClick={onClick}
      >
        {hasChildren ? (
          <button
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0"
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
        <span className="truncate flex-1 min-w-0">{label}</span>
      </div>
      {open && hasChildren && <div>{children}</div>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.tenantId
 * @param {any=} props.selected
 * @param {any=} props.onSelect
 */
export default function ClientTree({ tenantId, selected, onSelect }) {
  const { isHQ } = useTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addCompanyTarget, setAddCompanyTarget] = useState(null);
  const [addUnitTarget, setAddUnitTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);     // { entityType, entity }
  const [archiveTarget, setArchiveTarget] = useState(null); // { entityType, entity }

  // tenantId must be set — HQ without a selected tenant shows a picker prompt, not all data.
  const enabled = !!tenantId;
  const filter = tenantId ? { tenant_id: tenantId } : {};

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups-tree', tenantId],
    queryFn: () => base44.entities.Group.filter(filter, 'group_order_number', 100),
    enabled,
  });

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies-tree', tenantId],
    queryFn: () => base44.entities.Company.filter(filter, 'name', 200),
    enabled,
  });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units-tree', tenantId],
    queryFn: () => base44.entities.OperationalUnit.filter(filter, 'name', 300),
    enabled,
  });

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Layers className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-xs text-slate-400">Nenhum tenant selecionado.<br />Use o seletor no topo para escolher um tenant.</p>
      </div>
    );
  }

  if (loadingGroups || loadingCompanies || loadingUnits) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 rounded-lg" />)}
      </div>
    );
  }

  // Group companies/units that don't belong to any group
  const standaloneCompanies = companies.filter(c => !c.group_id);

  return (
    <div className="space-y-0.5 py-1 px-2">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Estrutura</span>
        <button
          onClick={() => setAddGroupOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
        >
          <Plus className="w-3 h-3" /> Grupo
        </button>
      </div>

      <CreateFirstClientDialog
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        tenantId={tenantId}
        onCreated={onSelect}
      />

      {[...groups].sort((a, b) => (a.group_order_number ?? 99999) - (b.group_order_number ?? 99999)).map(group => {
        const groupCompanies = companies.filter(c => c.group_id === group.id);
        const groupLabel = group.group_order_number != null
          ? `[${String(group.group_order_number).padStart(3, '0')}] ${group.name}`
          : group.name;
        return (
          <div key={group.id} className="group/group">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <TreeNode
                  label={groupLabel}
                  icon={Layers}
                  iconColor="text-indigo-500"
                  selected={selected?.type === 'group' && selected?.id === group.id}
                  onClick={() => onSelect({ type: 'group', id: group.id, name: group.name })}
                  depth={0}
                >
                  {groupCompanies.map(company => {
                    const companyUnits = units.filter(u => u.company_id === company.id);
                    return (
                      <div key={company.id} className="group/company">
                        <div className="flex items-center">
                          <div className="flex-1 min-w-0">
                            <TreeNode
                              label={company.name}
                              icon={Building2}
                              iconColor="text-blue-500"
                              selected={selected?.type === 'company' && selected?.id === company.id}
                              onClick={() => onSelect({ type: 'company', id: company.id, name: company.name, group_id: group.id })}
                              depth={1}
                            >
                              {companyUnits.map(unit => (
                                <div key={unit.id} className="group/unit flex items-center">
                                  <div className="flex-1 min-w-0">
                                    <TreeNode
                                      label={unit.name}
                                      icon={MapPin}
                                      iconColor="text-emerald-500"
                                      selected={selected?.type === 'unit' && selected?.id === unit.id}
                                      onClick={() => onSelect({ type: 'unit', id: unit.id, name: unit.name, company_id: company.id, group_id: group.id })}
                                      depth={2}
                                    />
                                  </div>
                                  <div className="opacity-0 group-hover/unit:opacity-100 flex items-center gap-0.5 mr-1 flex-shrink-0">
                                    <button onClick={e => { e.stopPropagation(); setEditTarget({ entityType: 'unit', entity: unit }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={e => { e.stopPropagation(); setArchiveTarget({ entityType: 'unit', entity: unit }); }} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Arquivar"><Archive className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              ))}
                            </TreeNode>
                          </div>
                          <div className="opacity-0 group-hover/company:opacity-100 flex items-center gap-0.5 mr-1 flex-shrink-0">
                            <button className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5" onClick={e => { e.stopPropagation(); setAddUnitTarget({ companyId: company.id, companyName: company.name }); }} title="Nova Unidade"><Plus className="w-3 h-3" />Unidade</button>
                            <button onClick={e => { e.stopPropagation(); setEditTarget({ entityType: 'company', entity: company }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); setArchiveTarget({ entityType: 'company', entity: company }); }} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Arquivar"><Archive className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </TreeNode>
              </div>
              <div className="opacity-0 group-hover/group:opacity-100 flex items-center gap-0.5 mr-1 flex-shrink-0">
                <button className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5" onClick={e => { e.stopPropagation(); setAddCompanyTarget({ groupId: group.id, groupName: group.name }); }} title="Nova Empresa"><Plus className="w-3 h-3" />Empresa</button>
                <button onClick={e => { e.stopPropagation(); setEditTarget({ entityType: 'group', entity: group }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
                <button onClick={e => { e.stopPropagation(); setArchiveTarget({ entityType: 'group', entity: group }); }} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Arquivar"><Archive className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        );
      })}

      {standaloneCompanies.map(company => {
        const companyUnits = units.filter(u => u.company_id === company.id);
        return (
          <div key={company.id} className="group/company">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <TreeNode
                  label={company.name}
                  icon={Building2}
                  iconColor="text-blue-500"
                  selected={selected?.type === 'company' && selected?.id === company.id}
                  onClick={() => onSelect({ type: 'company', id: company.id, name: company.name })}
                  depth={0}
                >
                  {companyUnits.map(unit => (
                    <div key={unit.id} className="group/unit flex items-center">
                      <div className="flex-1 min-w-0">
                        <TreeNode
                          label={unit.name}
                          icon={MapPin}
                          iconColor="text-emerald-500"
                          selected={selected?.type === 'unit' && selected?.id === unit.id}
                          onClick={() => onSelect({ type: 'unit', id: unit.id, name: unit.name, company_id: company.id })}
                          depth={1}
                        />
                      </div>
                      <div className="opacity-0 group-hover/unit:opacity-100 flex items-center gap-0.5 mr-1 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); setEditTarget({ entityType: 'unit', entity: unit }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
                        <button onClick={e => { e.stopPropagation(); setArchiveTarget({ entityType: 'unit', entity: unit }); }} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Arquivar"><Archive className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </TreeNode>
              </div>
              <div className="opacity-0 group-hover/company:opacity-100 flex items-center gap-0.5 mr-1 flex-shrink-0">
                <button className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5" onClick={e => { e.stopPropagation(); setAddUnitTarget({ companyId: company.id, companyName: company.name }); }} title="Nova Unidade"><Plus className="w-3 h-3" />Unidade</button>
                <button onClick={e => { e.stopPropagation(); setEditTarget({ entityType: 'company', entity: company }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
                <button onClick={e => { e.stopPropagation(); setArchiveTarget({ entityType: 'company', entity: company }); }} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Arquivar"><Archive className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        );
      })}

      <CreateCompanyDialog
        open={!!addCompanyTarget}
        onOpenChange={v => !v && setAddCompanyTarget(null)}
        tenantId={tenantId}
        groupId={addCompanyTarget?.groupId}
        groupName={addCompanyTarget?.groupName}
        onCreated={() => setAddCompanyTarget(null)}
      />

      <CreateUnitDialog
        open={!!addUnitTarget}
        onOpenChange={v => !v && setAddUnitTarget(null)}
        tenantId={tenantId}
        companyId={addUnitTarget?.companyId}
        companyName={addUnitTarget?.companyName}
        onCreated={() => setAddUnitTarget(null)}
      />

      <EditEntityDialog
        open={!!editTarget}
        onOpenChange={v => !v && setEditTarget(null)}
        entityType={editTarget?.entityType}
        entity={editTarget?.entity}
        onSaved={() => setEditTarget(null)}
      />

      <ArchiveEntityDialog
        open={!!archiveTarget}
        onOpenChange={v => !v && setArchiveTarget(null)}
        entityType={archiveTarget?.entityType}
        entity={archiveTarget?.entity}
        onArchived={() => setArchiveTarget(null)}
      />

      {groups.length === 0 && standaloneCompanies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
          <Layers className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400 mb-3">Nenhum cliente cadastrado</p>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar primeiro Cliente (Grupo)
          </Button>
          <CreateFirstClientDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            tenantId={tenantId}
            onCreated={onSelect}
          />
        </div>
      )}
    </div>
  );
}