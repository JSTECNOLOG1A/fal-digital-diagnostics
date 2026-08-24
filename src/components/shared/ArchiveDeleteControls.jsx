import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Archive, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import PermissionGuard from '@/components/shared/PermissionGuard';

/**
 * @typedef {Object} ArchiveDeleteControlsProps
 * @property {any} entityType
 * @property {any} entityId
 * @property {any} entityName
 * @property {any=} isArchived
 * @property {any=} onArchived
 * @property {any=} onDeleted
 * @property {any=} checkDependencies
 */

/** @type {React.ForwardRefExoticComponent<ArchiveDeleteControlsProps & React.RefAttributes<any>>} */
const ArchiveDeleteControls = forwardRef(function ArchiveDeleteControls({
  entityType,
  entityId,
  entityName,
  isArchived,
  onArchived,
  onDeleted,
  checkDependencies,
}, ref) {
  const [archiveModal, setArchiveModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [checking, setChecking] = useState(false);
  const [blockReasons, setBlockReasons] = useState(null);
  const [loading, setLoading] = useState(false);

  const entityLabel = {
    group: 'Grupo',
    company: 'Empresa',
    unit: 'Unidade',
    assessment: 'Diagnóstico',
    financial_diagnosis: 'Diagnóstico Financeiro',
  }[entityType] || 'Item';

  async function handleArchive() {
    setLoading(true);
    const updateData = entityType === 'unit'
      ? { is_active: !!isArchived }
      : { is_archived: !isArchived };

    const entity = {
      group: base44.entities.Group,
      company: base44.entities.Company,
      unit: base44.entities.OperationalUnit,
      assessment: base44.entities.Assessment,
      financial_diagnosis: base44.entities.FinancialDiagnosis,
    }[entityType];

    await entity.update(entityId, updateData);
    setLoading(false);
    setArchiveModal(false);
    onArchived?.();
  }

  async function triggerOpenDelete() {
    setDeleteModal(true);
    setBlockReasons(null);
    setConfirmName('');
    setChecking(true);
    const result = await checkDependencies();
    setBlockReasons(result.ok ? [] : result.reasons);
    setChecking(false);
  }

  async function handleDelete() {
    if (entityType === 'group' && confirmName !== entityName) return;
    setLoading(true);
    const entity = {
      group: base44.entities.Group,
      company: base44.entities.Company,
      unit: base44.entities.OperationalUnit,
      assessment: base44.entities.Assessment,
      financial_diagnosis: base44.entities.FinancialDiagnosis,
    }[entityType];
    await entity.delete(entityId);
    setLoading(false);
    setDeleteModal(false);
    onDeleted?.();
  }

  // Expõe métodos para o pai via ref
  useImperativeHandle(ref, () => ({
    openArchive: () => setArchiveModal(true),
    openDelete: () => triggerOpenDelete(),
  }));

  const archiveLabel = isArchived ? `Reativar ${entityLabel}` : `Arquivar ${entityLabel}`;
  const archiveDescription = isArchived
    ? `Isso reativará o registro e ele voltará a aparecer nas listas ativas.`
    : `O registro será ocultado das listas ativas, mas os diagnósticos históricos serão preservados.`;

  const canDelete = blockReasons !== null && blockReasons.length === 0;
  const nameConfirmed = entityType !== 'group' || confirmName === entityName;

  return (
    <PermissionGuard requireDelete>
    <div className="border border-red-100 rounded-xl p-4 bg-red-50/30">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-red-700">Zona de Risco</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Arquivamento e exclusão permanente. Ações irreversíveis devem ser usadas com cautela.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setArchiveModal(true)}
          className={`gap-1.5 text-xs ${isArchived ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          {archiveLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerOpenDelete}
          className="gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir Permanentemente
        </Button>
      </div>

      {/* Archive Confirmation Modal */}
      <Dialog open={archiveModal} onOpenChange={setArchiveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              {archiveLabel}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{archiveDescription}</p>
          <p className="text-xs text-slate-400 mt-1">
            <strong>{entityName}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveModal(false)}>Cancelar</Button>
            <Button
              onClick={handleArchive}
              disabled={loading}
              className={isArchived ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}
            >
              {loading ? 'Processando...' : (isArchived ? 'Reativar' : 'Arquivar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Excluir Permanentemente
            </DialogTitle>
          </DialogHeader>

          {checking && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Verificando dependências...
            </div>
          )}

          {!checking && blockReasons !== null && (
            <>
              {blockReasons.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 mb-1">
                        Este {entityLabel.toLowerCase()} não pode ser excluído
                      </p>
                      <p className="text-xs text-red-600 mb-2">
                        Ainda existem registros vinculados a este item:
                      </p>
                      <ul className="space-y-1">
                        {blockReasons.map((r, i) => (
                          <li key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Para excluir, primeiro remova ou arquive todos os registros dependentes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-emerald-700">
                      Nenhuma dependência encontrada. A exclusão é segura.
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-700 mb-1">
                      ⚠️ Esta ação é permanente e não pode ser desfeita.
                    </p>
                    <p className="text-xs text-red-600">
                      O registro <strong>{entityName}</strong> será excluído definitivamente.
                    </p>
                  </div>

                  {(entityType === 'group' || entityType === 'assessment' || entityType === 'financial_diagnosis') && (
                    <div>
                      <p className="text-xs text-slate-600 mb-1.5 font-medium">
                        Para confirmar, digite o nome do {entityType === 'group' ? 'grupo' : 'diagnóstico financeiro'}:
                      </p>
                      <Input
                        value={confirmName}
                        onChange={e => setConfirmName(e.target.value)}
                        placeholder={entityName}
                        className="text-sm"
                      />
                      {confirmName && confirmName !== entityName && (
                        <p className="text-xs text-red-500 mt-1">Nome não confere.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(false)} disabled={loading}>Cancelar</Button>
            {canDelete && (
              <Button
                onClick={handleDelete}
                disabled={loading || !nameConfirmed}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? 'Excluindo...' : 'Excluir Permanentemente'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
});

export default ArchiveDeleteControls;