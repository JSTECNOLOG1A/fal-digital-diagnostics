import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RotateCcw, AlertTriangle, Info, CheckCircle2, XCircle, Zap } from 'lucide-react';

// Dimensões padrão do sistema
const ALL_DIMENSIONS = [
  { key: 'governanca',         label: 'Governança',          desc: 'Estrutura de decisão, órgãos e processos de gestão' },
  { key: 'juridico',           label: 'Jurídico',            desc: 'Contratos, conformidade legal e gestão de riscos jurídicos' },
  { key: 'controles_internos', label: 'Controles Internos',  desc: 'Políticas, procedimentos e auditoria interna' },
  { key: 'financeiro',         label: 'Financeiro',          desc: 'Gestão financeira, fluxo de caixa e planejamento' },
  { key: 'contabil',           label: 'Contábil',            desc: 'Escrituração, demonstrativos e obrigações contábeis' },
  { key: 'tributario',         label: 'Tributário',          desc: 'Gestão fiscal, planejamento e compliance tributário' },
  { key: 'operacional',        label: 'Operacional',         desc: 'Processos produtivos, logística e eficiência operacional' },
  { key: 'sistemas',           label: 'Sistemas',            desc: 'TI, ERP, sistemas de gestão e infraestrutura digital' },
];

// Mapa de dimensões sugeridas automaticamente por tipo de entidade
const AUTO_SUGGESTED = {
  group:   ['governanca', 'juridico'],
  company: ['governanca', 'juridico', 'controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'],
  unit:    ['controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'],
  holding: ['governanca', 'juridico', 'controles_internos', 'financeiro'],
};

const FILTER_OPTIONS = [
  { key: 'all',      label: 'Todas' },
  { key: 'active',   label: 'Ativas' },
  { key: 'inactive', label: 'Inativas' },
  { key: 'auto',     label: 'Automáticas' },
  { key: 'manual',   label: 'Manuais' },
];

/**
 * @param {Object} props
 * @param {any=} props.origin
 * @param {any=} props.active
 */
function OriginBadge({ origin, active }) {
  if (origin === 'manually_enabled') return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
      <Zap className="w-2.5 h-2.5" /> Manual (ativada)
    </span>
  );
  if (origin === 'manually_disabled') return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">
      <XCircle className="w-2.5 h-2.5" /> Manual (desativada)
    </span>
  );
  if (active) return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
      <CheckCircle2 className="w-2.5 h-2.5" /> Automática
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-full font-medium">
      Inativa
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.entityId
 * @param {any=} props.entityType
 * @param {any=} props.tenantId
 * @param {any=} props.assessmentActiveDimensions
 * @param {any=} props.onScopeChanged
 */
export default function DimensionScopePanel({ entityId, entityType, tenantId, assessmentActiveDimensions, onScopeChanged }) {
  const { user } = useTenant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState(null); // { dimKey, action: 'disable'|'enable'|'reset', hasResponses }
  const [reason, setReason] = useState('');

  // Suggested dims for this entity type
  const suggestedDims = AUTO_SUGGESTED[entityType] || ALL_DIMENSIONS.map(d => d.key);

  // Load existing overrides for this entity
  const { data: overrides = [] } = useQuery({
    queryKey: ['dim-overrides', entityId, entityType],
    queryFn: () => base44.entities.FalEntityDimensionOverride.filter({ entity_id: entityId, entity_type: entityType }),
    enabled: !!entityId && !!entityType,
  });

  const overrideMap = {};
  overrides.forEach(o => { overrideMap[o.dimension_key] = o; });

  // Compute effective state for each dimension
  function getEffectiveState(dimKey) {
    const override = overrideMap[dimKey];
    if (override?.manually_enabled)  return { active: true,  origin: 'manually_enabled',  override };
    if (override?.manually_disabled) return { active: false, origin: 'manually_disabled', override };
    const isAuto = suggestedDims.includes(dimKey);
    return { active: isAuto, origin: isAuto ? 'auto' : 'inactive', override: null };
  }

  // Check if dimension has responses (to warn before disabling)
  const { data: responseCheck } = useQuery({
    queryKey: ['dim-responses-check', entityId, assessmentActiveDimensions],
    queryFn: async () => {
      if (!assessmentActiveDimensions?.length) return {};
      const result = {};
      for (const dimKey of assessmentActiveDimensions) {
        const resps = await base44.entities.FalResponse.filter({ dimension_key: dimKey });
        result[dimKey] = resps.length;
      }
      return result;
    },
    enabled: !!assessmentActiveDimensions?.length,
    staleTime: 30_000,
  });

  const upsertOverrideMutation = useMutation({
    mutationFn: async (/** @type {any} */ { dimKey, manually_enabled, manually_disabled, reason: r, previous_state }) => {
      const existing = overrideMap[dimKey];
      const data = {
        tenant_id: tenantId,
        entity_id: entityId,
        entity_type: entityType,
        dimension_key: dimKey,
        manually_enabled: !!manually_enabled,
        manually_disabled: !!manually_disabled,
        reason: r || '',
        changed_by: user?.email || 'sistema',
        changed_at: new Date().toISOString(),
        previous_state,
      };
      if (existing) return base44.entities.FalEntityDimensionOverride.update(existing.id, data);
      return base44.entities.FalEntityDimensionOverride.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dim-overrides', entityId, entityType] });
      onScopeChanged?.();
      setConfirmDialog(null);
      setReason('');
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (/** @type {any} */ dimKey) => {
      const existing = overrideMap[dimKey];
      if (existing) await base44.entities.FalEntityDimensionOverride.delete(existing.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dim-overrides', entityId, entityType] });
      onScopeChanged?.();
      setConfirmDialog(null);
      setReason('');
    },
  });

  function handleToggle(dimKey, currentlyActive, origin) {
    if (currentlyActive) {
      // Tentando desativar
      const responseCount = responseCheck?.[dimKey] || 0;
      setConfirmDialog({ dimKey, action: 'disable', hasResponses: responseCount > 0, responseCount });
    } else {
      // Ativando (direto, sem confirmação necessária)
      const prev = suggestedDims.includes(dimKey) ? 'auto_active' : 'auto_inactive';
      upsertOverrideMutation.mutate({ dimKey, manually_enabled: true, manually_disabled: false, reason: '', previous_state: prev });
    }
  }

  function handleRestore(dimKey) {
    setConfirmDialog({ dimKey, action: 'reset' });
  }

  function confirmAction() {
    const { dimKey, action } = confirmDialog;
    if (action === 'disable') {
      const prev = suggestedDims.includes(dimKey) ? 'auto_active' : 'auto_inactive';
      upsertOverrideMutation.mutate({ dimKey, manually_enabled: false, manually_disabled: true, reason, previous_state: prev });
    } else if (action === 'reset') {
      deleteOverrideMutation.mutate(dimKey);
    }
  }

  // Filter logic
  const filteredDims = ALL_DIMENSIONS.filter(dim => {
    const { active, origin } = getEffectiveState(dim.key);
    if (filter === 'active')   return active;
    if (filter === 'inactive') return !active;
    if (filter === 'auto')     return origin === 'auto' || origin === 'inactive';
    if (filter === 'manual')   return origin === 'manually_enabled' || origin === 'manually_disabled';
    return true;
  });

  const activeCount = ALL_DIMENSIONS.filter(d => getEffectiveState(d.key).active).length;
  const overrideCount = overrides.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Escopo do Diagnóstico</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCount} dimensão(ões) ativa(s) · {overrideCount > 0 ? `${overrideCount} override(s) manual(is)` : 'apenas automático'}
          </p>
        </div>
        {overrideCount > 0 && (
          <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50 text-xs">
            {overrideCount} ajuste{overrideCount > 1 ? 's' : ''} manual
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Dimension list */}
      <div className="space-y-2">
        {filteredDims.map(dim => {
          const { active, origin, override } = getEffectiveState(dim.key);
          const hasOverride = !!override;
          const isWarning = !active && suggestedDims.includes(dim.key); // critical dim disabled

          return (
            <div
              key={dim.key}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                active
                  ? hasOverride && origin === 'manually_enabled'
                    ? 'border-purple-200 bg-purple-50/40'
                    : 'border-emerald-100 bg-emerald-50/30'
                  : hasOverride
                    ? 'border-red-100 bg-red-50/30'
                    : 'border-slate-100 bg-slate-50/50 opacity-70'
              }`}
            >
              <Switch
                checked={active}
                onCheckedChange={() => handleToggle(dim.key, active, origin)}
                disabled={upsertOverrideMutation.isPending || deleteOverrideMutation.isPending}
                className="mt-0.5 flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                    {dim.label}
                  </span>
                  <OriginBadge origin={origin} active={active} />
                  {isWarning && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-2.5 h-2.5" /> Dimensão crítica desligada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{dim.desc}</p>
                {override?.reason && (
                  <p className="text-[10px] text-slate-400 mt-1 italic">Motivo: {override.reason}</p>
                )}
                {override?.changed_by && (
                  <p className="text-[10px] text-slate-400">
                    Alterado por {override.changed_by} em {override.changed_at ? new Date(override.changed_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                )}
              </div>

              {/* Restore button */}
              {hasOverride && (
                <button
                  onClick={() => handleRestore(dim.key)}
                  title="Restaurar padrão automático"
                  className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => { setConfirmDialog(null); setReason(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.action === 'reset' ? (
                <><RotateCcw className="w-4 h-4 text-slate-500" /> Restaurar padrão</>
              ) : (
                <><AlertTriangle className="w-4 h-4 text-amber-500" /> Desativar dimensão</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {confirmDialog?.action === 'disable' && (
              <>
                {confirmDialog.hasResponses && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Esta dimensão tem {confirmDialog.responseCount} resposta(s)</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        As respostas existentes serão preservadas no histórico. A dimensão será excluída apenas do diagnóstico ativo em diante.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    A dimensão <strong>{ALL_DIMENSIONS.find(d => d.key === confirmDialog?.dimKey)?.label}</strong> será removida do questionário, do cálculo e do plano de ação vigentes. Diagnósticos anteriores não serão afetados.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Motivo (opcional)</label>
                  <Input
                    placeholder="Ex: não aplicável à estrutura atual"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>
              </>
            )}

            {confirmDialog?.action === 'reset' && (
              <p className="text-sm text-slate-600">
                O override manual será removido e a dimensão <strong>{ALL_DIMENSIONS.find(d => d.key === confirmDialog?.dimKey)?.label}</strong> voltará ao comportamento automático definido pelo motor.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setConfirmDialog(null); setReason(''); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmAction}
              disabled={upsertOverrideMutation.isPending || deleteOverrideMutation.isPending}
              className={confirmDialog?.action === 'reset' ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
            >
              {upsertOverrideMutation.isPending || deleteOverrideMutation.isPending
                ? 'Salvando...'
                : confirmDialog?.action === 'reset' ? 'Restaurar padrão' : 'Confirmar desativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}