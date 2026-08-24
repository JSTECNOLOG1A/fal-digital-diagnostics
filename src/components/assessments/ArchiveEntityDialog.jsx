import React from 'react';
import { tenantKey } from '@/lib/query-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Layers, Building2, MapPin, Archive, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ENTITY_META = {
  group:   { icon: Layers,    color: 'text-indigo-500', label: 'Grupo',   entityName: 'Group' },
  company: { icon: Building2, color: 'text-blue-500',   label: 'Empresa', entityName: 'Company' },
  unit:    { icon: MapPin,    color: 'text-emerald-500', label: 'Unidade', entityName: 'OperationalUnit' },
};

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.count
 * @param {any=} props.color
 */
function ImpactRow({ label, count, color = 'text-slate-700' }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${count > 0 ? color : 'text-slate-400'}`}>{count}</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.entityType
 * @param {any=} props.entity
 * @param {any=} props.onArchived
 */
export default function ArchiveEntityDialog({ open, onOpenChange, entityType, entity, onArchived }) {
  const { user, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const meta = ENTITY_META[entityType];

  // Count dependents
  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: tenantKey(tenantId, 'archive-check-assessments', entityType, entity?.id),
    queryFn: () => base44.entities.Assessment.filter({ target_type: entityType, target_id: entity.id }),
    enabled: !!entity?.id && open,
  });

  const { data: childCompanies = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'archive-check-companies', entity?.id),
    queryFn: () => base44.entities.Company.filter({ group_id: entity.id }),
    enabled: entityType === 'group' && !!entity?.id && open,
  });

  const { data: childUnits = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'archive-check-units', entity?.id, entityType),
    queryFn: () => {
      if (entityType === 'company') return base44.entities.OperationalUnit.filter({ company_id: entity.id });
      return [];
    },
    enabled: (entityType === 'company') && !!entity?.id && open,
  });

  const { data: actionPlans = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'archive-check-plans', entityType, entity?.id),
    queryFn: () => base44.entities.ActionPlan.filter({ target_type: entityType, target_id: entity.id }),
    enabled: !!entity?.id && open,
  });

  const hasHistory = assessments.length > 0 || actionPlans.length > 0;
  const hasChildren = childCompanies.length > 0 || childUnits.length > 0;
  const isLoading = loadingAssessments;

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const archivedData = { status: 'inactive', archived_at: now, archived_by: user?.email || 'sistema' };
      await base44.entities[meta.entityName].update(entity.id, archivedData);

      // Log audit
      await base44.entities.AuditLog.create({
        tenant_id: tenantId,
        action: `${entityType}_archived`,
        entity_type: entityType,
        entity_id: entity.id,
        entity_name: entity.name,
        performed_by: user?.email || 'sistema',
        performed_at: now,
        details: JSON.stringify({
          assessments_count: assessments.length,
          action_plans_count: actionPlans.length,
          child_companies: childCompanies.length,
          child_units: childUnits.length,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'groups-tree') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'companies-tree') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'units-tree') });
      onArchived?.();
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await base44.entities[meta.entityName].delete(entity.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'groups-tree') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'companies-tree') });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'units-tree') });
      onArchived?.();
      onOpenChange(false);
    },
  });

  if (!meta || !entity) return null;
  const Icon = meta.icon;
  const canDelete = !hasHistory && !hasChildren;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Remover {meta.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Icon className={`w-4 h-4 ${meta.color}`} />
            <span className="text-sm font-semibold text-slate-900">{entity.name}</span>
          </div>

          {/* Impact summary */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Impacto desta operação</p>
            {isLoading ? (
              <div className="space-y-1"><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
            ) : (
              <div className="border border-slate-200 rounded-lg px-3 py-1">
                <ImpactRow label="Diagnósticos vinculados" count={assessments.length} color="text-amber-700" />
                <ImpactRow label="Planos de ação vinculados" count={actionPlans.length} color="text-amber-700" />
                {entityType === 'group' && <ImpactRow label="Empresas filhas" count={childCompanies.length} color="text-red-600" />}
                {entityType === 'company' && <ImpactRow label="Unidades filhas" count={childUnits.length} color="text-red-600" />}
              </div>
            )}
          </div>

          {/* Explanation */}
          {hasHistory ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Existem registros históricos</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  O sistema irá <strong>arquivar</strong> (não excluir) este registro para preservar o histórico de diagnósticos e planos de ação.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Archive className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">
                Nenhum histórico encontrado. É possível excluir definitivamente ou apenas arquivar.
              </p>
            </div>
          )}

          {hasChildren && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                <strong>Atenção:</strong> existem registros filhos vinculados. O arquivamento não irá removê-los automaticamente — é necessário tratar cada um separadamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || archiveMutation.isPending}
              className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending || deleteMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
          >
            <Archive className="w-3.5 h-3.5" />
            {archiveMutation.isPending ? 'Arquivando...' : 'Arquivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}