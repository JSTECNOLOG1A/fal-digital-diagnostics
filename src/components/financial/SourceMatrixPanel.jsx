/**
 * SourceMatrixPanel — Matriz Entidade × Período de fontes contábeis.
 * Mostra quais entidades do escopo têm fontes importadas por período.
 * As colunas de período são derivadas da definição do diagnóstico
 * (data-base inicial + quantidade de períodos + periodicidade).
 * Cada célula pendente permite Importar; células preenchidas permitem
 * Substituir / Ver validação / Excluir.
 */
import React from 'react';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';

function fmtPeriod(p) {
  if (!p) return '—';
  const m = String(p).match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  return p;
}

// Gera a grade de períodos esperados a partir da definição do diagnóstico.
// anual → chave "2024"; trimestral → "2024-01"; mensal → "2024-01".
// O formato da chave espelha toBackendPeriod() do ImportConfigModal, garantindo
// o match com uploads.source_period.
function generateExpectedPeriods(diagnosis) {
  if (!diagnosis) return [];
  const first = diagnosis.first_period;
  const monthsCount = diagnosis.months_count;
  const per = diagnosis.periodicidade || 'anual';
  if (!first || !monthsCount) return [];
  const m = String(first).match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  let y = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  const step = per === 'anual' ? 12 : per === 'trimestral' ? 3 : 1;
  const count = Math.max(1, Math.round(monthsCount / step));
  const out = [];
  for (let i = 0; i < count; i++) {
    if (per === 'anual') {
      out.push({ key: String(y), label: String(y) });
      y++;
    } else {
      const key = `${y}-${String(mo).padStart(2, '0')}`;
      const label = per === 'trimestral'
        ? `${Math.ceil(mo / 3)}º trim/${y}`
        : `${String(mo).padStart(2, '0')}/${y}`;
      out.push({ key, label });
      mo += step;
      if (mo > 12) { mo -= 12; y++; }
    }
  }
  return out;
}

/**
 * @param {Object} props
 * @param {any=} props.diagnosis
 * @param {any=} props.scopeEntities
 * @param {any=} props.uploads
 * @param {any=} props.onImportCell
 * @param {any=} props.onViewSource
 * @param {any=} props.onDeleteSource
 */
export default function SourceMatrixPanel({ diagnosis, scopeEntities = [], uploads = [], onImportCell, onViewSource, onDeleteSource }) {
  // Derivar períodos das fontes (source_period || notes.period_override)
  const resolvePeriod = (u) => {
    if (u.source_period) return u.source_period;
    try { return JSON.parse(u.notes || '{}').period_override || null; } catch { return null; }
  };

  // Grade de períodos esperados (definição) + períodos órfãos de uploads
  const periodMap = new Map();
  for (const p of generateExpectedPeriods(diagnosis)) periodMap.set(p.key, p.label);
  for (const u of uploads) {
    const p = resolvePeriod(u);
    if (p && !periodMap.has(p)) periodMap.set(p, fmtPeriod(p));
  }
  const periods = [...periodMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // Matriz: entityId → period → upload
  const matrix = {};
  for (const u of uploads) {
    if (!u.source_entity_id) continue;
    const p = resolvePeriod(u);
    if (!p) continue;
    if (!matrix[u.source_entity_id]) matrix[u.source_entity_id] = {};
    matrix[u.source_entity_id][p] = u;
  }

  const entityName = (id) => scopeEntities.find((s) => s.entity_id === id)?.entity_name || id;

  if (scopeEntities.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 rounded-xl border border-dashed border-slate-200">
        <AlertCircle className="w-7 h-7 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma entidade no escopo. Configure o perímetro na aba Consolidação.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Upload className="w-4 h-4 text-blue-500" />
        <p className="text-sm font-bold text-slate-700">Matriz de Fontes Contábeis</p>
        <span className="text-xs text-slate-400">({uploads.length} fonte(s) · {periods.length} período(s))</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Entidade</th>
              {periods.map((p) => (
                <th key={p.key} className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">{p.label}</th>
              ))}
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {scopeEntities.map((s, idx) => {
              const entPeriods = matrix[s.entity_id] || {};
              const hasAny = Object.keys(entPeriods).length > 0;
              return (
                <tr key={s.entity_id} className="border-b border-slate-100 last:border-0" style={idx % 2 ? { background: '#fafbfc' } : {}}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{s.entity_name || s.entity_id}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{s.role?.replace('_', ' ')}</span>
                    </div>
                  </td>
                  {periods.map((p) => {
                    const up = entPeriods[p.key];
                    return (
                      <td key={p.key} className="text-center px-3 py-3">
                        {up ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full
                              ${up.upload_status === 'processed' ? 'bg-emerald-50 text-emerald-700' :
                                up.upload_status === 'error' || up.upload_status === 'validation_failed' ? 'bg-red-50 text-red-700' :
                                'bg-amber-50 text-amber-700'}`}>
                              {up.upload_status === 'processed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {up.upload_status === 'processed' ? 'Importado' : up.upload_status === 'validated' ? 'Validado' : up.upload_status}
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => onViewSource?.(up)} className="text-[10px] text-slate-500 hover:text-slate-700 underline">ver</button>
                              <button onClick={() => onImportCell?.(s, p.key)} className="text-[10px] text-blue-500 hover:text-blue-700 underline">substituir</button>
                              <button onClick={() => onDeleteSource?.(up)} className="text-[10px] text-red-500 hover:text-red-700 underline">excluir</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => onImportCell?.(s, p.key)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors">
                            <Upload className="w-3 h-3" /> Importar
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-3 py-3">
                    {hasAny ? (
                      <span className="fal-badge fal-badge-success">Completa</span>
                    ) : (
                      <span className="fal-badge fal-badge-warning">Incompleta</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {periods.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-slate-400">
          Defina a data-base inicial e a quantidade de períodos na etapa <strong>Estrutura</strong> para gerar a grade de importação.
        </div>
      )}
    </div>
  );
}