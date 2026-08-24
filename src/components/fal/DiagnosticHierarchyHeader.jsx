import React from 'react';
import { Briefcase, ClipboardList, ChevronRight } from 'lucide-react';
import EntityFlowSelector from '@/components/fal/EntityFlowSelector';

/**
 * Exibe a hierarquia em 3 níveis dentro de um único box visual:
 *   Nível 1 — Programa de Consultoria
 *   Nível 2 — Questionário
 *   Nível 3 — Entidades (clicável, filtra o questionário)
 */
export default function DiagnosticHierarchyHeader({
  assessmentTitle,
  linkedEntities = [],
  selectedEntity,
  onSelectEntity,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-5 overflow-hidden">
      {/* Nível 1 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Programa de Consultoria</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1" />
        <span className="text-sm font-semibold text-slate-700 truncate">{assessmentTitle}</span>
      </div>

      {/* Nível 2 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <ClipboardList className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Questionário</span>
      </div>

      {/* Nível 3 — só aparece em diagnósticos multi-entidade */}
      {linkedEntities.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Selecionar Entidade
          </p>
          <EntityFlowSelector
            linkedEntities={linkedEntities}
            selectedEntityId={selectedEntity?.entity_id}
            onSelect={(entity) => {
              // Toggle: clicar na mesma entidade desmarca
              onSelectEntity(prev =>
                prev?.entity_id === entity.entity_id ? null : entity
              );
            }}
          />
          {selectedEntity && (
            <p className="mt-2 text-[11px] text-slate-400">
              Exibindo progresso de:{' '}
              <strong className="text-slate-600">{selectedEntity.entity_name}</strong>
              <button
                className="ml-2 text-blue-500 hover:underline"
                onClick={() => onSelectEntity(null)}
              >
                Limpar
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}