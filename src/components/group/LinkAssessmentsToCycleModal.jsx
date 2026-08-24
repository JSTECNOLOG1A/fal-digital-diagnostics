/**
 * LinkAssessmentsToCycleModal — Vincula assessments sem ciclo ao ciclo atual
 * Exibe assessments do grupo sem cycle_id e permite vinculá-los em lote
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square, FileText, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { useTenant } from '@/components/shared/TenantContext';
import { invalidateAssessmentQueries } from '@/lib/query-client';

const STATUS_LABEL = {
  draft: 'Rascunho', in_progress: 'Em andamento', scoring: 'Scoring',
  review: 'Revisão', published: 'Publicado', archived: 'Arquivado',
};
const TARGET_LABEL = { group: 'Grupo', company: 'Empresa', unit: 'Unidade' };

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.cycle
 * @param {any=} props.groupId
 * @param {any=} props.companies
 */
export default function LinkAssessmentsToCycleModal({ open, onOpenChange, cycle, groupId, companies = [] }) {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  const [selected, setSelected] = useState([]);

  const companyIds = companies.map(c => c.id);

  // Buscar todos os assessments do grupo sem cycle_id
  const { data: allAssessments = [], isLoading } = useQuery({
    queryKey: ['unlinked-assessments', groupId],
    queryFn: async () => {
      // Buscar assessments do grupo + de cada empresa
      const results = await Promise.all([
        base44.entities.Assessment.filter({ group_id: groupId }, '-created_date', 100),
        ...companyIds.map(cid =>
          base44.entities.Assessment.filter({ company_id: cid }, '-created_date', 50)
        ),
      ]);
      const flat = results.flat();
      // Deduplicate e filtrar sem cycle_id
      const seen = new Set();
      return flat.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return !a.cycle_id && a.status !== 'archived';
      });
    },
    enabled: open && !!groupId,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selected.map(id =>
          base44.entities.Assessment.update(id, { cycle_id: cycle.id })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unlinked-assessments', groupId] });
      invalidateAssessmentQueries(qc, null, tenantId);
      setSelected([]);
      onOpenChange(false);
    },
  });

  function toggleAll() {
    if (selected.length === allAssessments.length) {
      setSelected([]);
    } else {
      setSelected(allAssessments.map(a => a.id));
    }
  }

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-blue-500" />
            Vincular ao Ciclo: {cycle?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Selecione os diagnósticos existentes que pertencem a este ciclo de análise. Apenas diagnósticos <strong>sem ciclo</strong> são listados.</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Carregando diagnósticos...</div>
          ) : allAssessments.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Todos os diagnósticos já estão vinculados a um ciclo.</p>
            </div>
          ) : (
            <>
              {/* Selecionar todos */}
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 w-full"
              >
                {selected.length === allAssessments.length
                  ? <CheckSquare className="w-4 h-4 text-blue-600" />
                  : <Square className="w-4 h-4" />
                }
                Selecionar todos ({allAssessments.length})
              </button>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allAssessments.map(a => {
                  const isSelected = selected.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {a.display_name || a.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">
                            {TARGET_LABEL[a.target_type] || a.target_type}
                          </span>
                          {a.competence && (
                            <span className="text-[10px] text-slate-400">· {a.competence}</span>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {STATUS_LABEL[a.status] || a.status}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={selected.length === 0 || linkMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            {linkMutation.isPending
              ? 'Vinculando...'
              : `Vincular ${selected.length > 0 ? `(${selected.length})` : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}