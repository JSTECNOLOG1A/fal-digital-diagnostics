/**
 * ManagePeriodsPanel
 * Lista os uploads existentes por data-base com:
 * - Edição de data-base/tipo por período
 * - Limpeza por período selecionado (mantém o upload, apaga dados derivados)
 * - Exclusão definitiva por período
 * - Limpeza total (via botão na aba Overview — não aqui)
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, CalendarX, AlertCircle, Edit2, RefreshCw, Eraser } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateFinancialQueries } from '@/lib/query-client';

function fmtPeriod(p) {
  if (!p) return '—';
  const m = p.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : p;
}

const PERIOD_NAMES = [
  { value: 'Janeiro',   label: 'Janeiro' },
  { value: 'Fevereiro', label: 'Fevereiro' },
  { value: 'Março',     label: 'Março' },
  { value: 'Abril',     label: 'Abril' },
  { value: 'Maio',      label: 'Maio' },
  { value: 'Junho',     label: 'Junho' },
  { value: 'Julho',     label: 'Julho' },
  { value: 'Agosto',    label: 'Agosto' },
  { value: 'Setembro',  label: 'Setembro' },
  { value: 'Outubro',   label: 'Outubro' },
  { value: 'Novembro',  label: 'Novembro' },
  { value: 'Dezembro',  label: 'Dezembro' },
  { value: '1º trim',   label: '1º Trimestre' },
  { value: '2º trim',   label: '2º Trimestre' },
  { value: '3º trim',   label: '3º Trimestre' },
  { value: '4º trim',   label: '4º Trimestre' },
  { value: 'Anual',     label: 'Anual' },
];

/**
 * @param {Object} props
 * @param {any=} props.upload
 */
function UploadLabel({ upload }) {
  let notes = {};
  try { notes = JSON.parse(upload.notes || '{}'); } catch {}
  return notes.column_label || fmtPeriod(notes.period_override) || upload.file_name || '—';
}

/**
 * @param {Object} props
 * @param {Array<any>=} props.uploads
 * @param {string=} props.diagnosisId
 * @param {string=} props.tenantId
 * @param {() => void=} props.onDeleted
 */
export default function ManagePeriodsPanel({ uploads = [], diagnosisId, tenantId, onDeleted }) {
  const queryClient = useQueryClient();

  // Seleção para exclusão em lote
  const [selected, setSelected] = useState(new Set());

  // Estados de loading por operação
  const [busyId, setBusyId]         = useState(null); // upload_id em operação individual
  const [deletingAll, setDeletingAll] = useState(false);

  // Edição de data-base
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate]   = useState('');
  const [editName, setEditName]   = useState('');

  // Modal de confirmação para ação destrutiva
  const [confirmModal, setConfirmModal] = useState(null);
  // { mode: 'purge_one'|'delete_one'|'delete_selected', uploadId?, label?, labels? }

  const [error, setError] = useState(null);

  if (uploads.length === 0) return null;

  const invalidateAll = () => invalidateFinancialQueries(queryClient, diagnosisId, tenantId);

  const toggleAll = () => {
    setSelected(selected.size === uploads.length ? new Set() : new Set(uploads.map(u => u.id)));
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Limpeza de dados derivados de um upload (mantém o upload em si) ───────
  const doPurgeOne = async (uploadId) => {
    setBusyId(uploadId);
    setError(null);
    setConfirmModal(null);
    try {
      await base44.functions.invoke('purgeFinancialDerivedData', {
        upload_id: uploadId,
        diagnosis_id: diagnosisId,
      });
      await invalidateAll();
      onDeleted?.();
    } catch (e) {
      setError(e.message || 'Erro ao limpar dados do período.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Exclusão definitiva de um upload (F2-DEL-01: via function segura) ────
  const doDeleteOne = async (uploadId) => {
    setBusyId(uploadId);
    setError(null);
    setConfirmModal(null);
    try {
      const result = await base44.functions.invoke('deleteFinancialUploadSafe', {
        financial_diagnosis_id: diagnosisId,
        financial_upload_id: uploadId,
      });
      const data = result?.data || result;
      if (data && data.success === false) {
        setError(data.message || 'Falha na exclusão segura.');
        return;
      }
      await invalidateAll();
      onDeleted?.();
    } catch (e) {
      setError(e.message || 'Erro ao excluir período.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Exclusão em lote (F2-DEL-01: via function segura) ─────────────────────
  const doDeleteSelected = async () => {
    setDeletingAll(true);
    setError(null);
    setConfirmModal(null);
    const toDelete = uploads.filter(u => selected.has(u.id));
    try {
      for (const upload of toDelete) {
        const result = await base44.functions.invoke('deleteFinancialUploadSafe', {
          financial_diagnosis_id: diagnosisId,
          financial_upload_id: upload.id,
        });
        const data = result?.data || result;
        if (data && data.success === false) {
          throw new Error(data.message || `Falha ao excluir ${upload.file_name}`);
        }
      }
      setSelected(new Set());
      await invalidateAll();
      onDeleted?.();
    } catch (e) {
      setError(e.message || 'Erro ao excluir períodos selecionados.');
    } finally {
      setDeletingAll(false);
    }
  };

  // ── Salvar edição de data-base ───────────────────────────────────────────
  const handleEditSave = async () => {
    if (!editingId || !editDate || !editName) return;
    setBusyId(editingId);
    setError(null);
    try {
      const upload = uploads.find(u => u.id === editingId);
      if (!upload) return;
      const m = editDate.match(/^(\d{2})\/(\d{4})$/);
      if (!m) { setError('Data inválida. Use MM/AAAA.'); return; }
      const [, month, year] = m;
      let periodOverride = year;
      if (editName.toLowerCase().includes('trim')) {
        const trimMatch = editName.match(/\d+/);
        const trimNum = trimMatch ? parseInt(trimMatch[0], 10) : Math.ceil(parseInt(month, 10) / 3);
        const startMonth = (trimNum - 1) * 3 + 1;
        periodOverride = `${year}-${String(startMonth).padStart(2, '0')}`;
      } else if (!editName.toLowerCase().includes('anual')) {
        periodOverride = `${year}-${month}`;
      }
      const columnLabel = `${editName}/${year}`;
      const currentNotes = JSON.parse(upload.notes || '{}');
      await base44.entities.FinancialUpload.update(editingId, {
        notes: JSON.stringify({ ...currentNotes, period_override: periodOverride, column_label: columnLabel }),
      });
      await base44.functions.invoke('purgeFinancialDerivedData', { upload_id: editingId, diagnosis_id: diagnosisId });
      await base44.functions.invoke('buildFinancialStatements', {
        upload_id: editingId, diagnosis_id: diagnosisId, period_override: periodOverride,
      });
      setEditingId(null);
      await invalidateAll();
    } catch (e) {
      setError(e.message || 'Erro ao alterar período.');
    } finally {
      setBusyId(null);
    }
  };

  const isBusy = !!busyId || deletingAll;

  return (
    <>
      {/* Modal de confirmação */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${confirmModal.mode === 'purge_one' ? 'bg-amber-100' : 'bg-red-100'}`}>
                {confirmModal.mode === 'purge_one'
                  ? <Eraser className="w-5 h-5 text-amber-600" />
                  : <Trash2 className="w-5 h-5 text-red-600" />
                }
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  {confirmModal.mode === 'purge_one'   && 'Limpar dados derivados?'}
                  {confirmModal.mode === 'delete_one'  && 'Excluir período definitivamente?'}
                  {confirmModal.mode === 'delete_selected' && `Excluir ${selected.size} período(s)?`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {confirmModal.mode === 'purge_one' && `Período: ${confirmModal.label}`}
                  {confirmModal.mode === 'delete_one' && `Período: ${confirmModal.label}`}
                  {confirmModal.mode === 'delete_selected' && confirmModal.labels}
                </p>
              </div>
            </div>

            <div className={`rounded-lg p-3 text-xs space-y-1 ${confirmModal.mode === 'purge_one' ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              {confirmModal.mode === 'purge_one' && (
                <>
                  <p><strong>Serão removidos (o arquivo permanece):</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Linhas de BP e DRE deste período</li>
                    <li>Indicadores financeiros deste período</li>
                    <li>Alertas e validações associados</li>
                  </ul>
                  <p className="mt-1 text-amber-700">Você poderá reimportar sem fazer novo upload.</p>
                </>
              )}
              {(confirmModal.mode === 'delete_one' || confirmModal.mode === 'delete_selected') && (
                <>
                  <p><strong>Serão removidos permanentemente:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>O arquivo Excel importado</li>
                    <li>Linhas de BP e DRE</li>
                    <li>Indicadores financeiros</li>
                    <li>Alertas e validações</li>
                  </ul>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmModal.mode === 'purge_one')       doPurgeOne(confirmModal.uploadId);
                  if (confirmModal.mode === 'delete_one')      doDeleteOne(confirmModal.uploadId);
                  if (confirmModal.mode === 'delete_selected') doDeleteSelected();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors
                  ${confirmModal.mode === 'purge_one' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirmModal.mode === 'purge_one'       && <><Eraser className="w-3.5 h-3.5" /> Sim, limpar dados</>}
                {confirmModal.mode === 'delete_one'      && <><Trash2 className="w-3.5 h-3.5" /> Sim, excluir</>}
                {confirmModal.mode === 'delete_selected' && <><Trash2 className="w-3.5 h-3.5" /> Sim, excluir {selected.size}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size === uploads.length && uploads.length > 0}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-xs font-semibold text-slate-600">
              <CalendarX className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
              {uploads.length} período(s) importado(s)
            </span>
          </div>
          {selected.size > 0 && (
            <button
              disabled={isBusy}
              onClick={() => {
                const labels = uploads
                  .filter(u => selected.has(u.id))
                  .map(u => { try { return JSON.parse(u.notes || '{}').column_label || '?'; } catch { return '?'; } })
                  .join(', ');
                setConfirmModal({ mode: 'delete_selected', labels });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              {deletingAll
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Excluindo...</>
                : <><Trash2 className="w-3 h-3" /> Excluir {selected.size} selecionado(s)</>
              }
            </button>
          )}
        </div>

        {/* Lista de uploads */}
        <div className="divide-y divide-slate-100">
          {uploads.map(upload => {
            let notes = {};
            try { notes = JSON.parse(upload.notes || '{}'); } catch {}
            const columnLabel = notes.column_label || fmtPeriod(notes.period_override) || upload.file_name;
            const isChecked = selected.has(upload.id);
            const isThisBusy = busyId === upload.id;

            return (
              <div key={upload.id}>
                <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isChecked ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(upload.id)}
                    className="rounded flex-shrink-0"
                    disabled={isBusy}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{columnLabel}</p>
                    <p className="text-xs text-slate-400 truncate">{upload.file_name}</p>
                  </div>

                  {/* Status */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                    upload.upload_status === 'processed' ? 'bg-emerald-100 text-emerald-700' :
                    upload.upload_status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {upload.upload_status}
                  </span>

                  {/* Ações por período */}
                  {isThisBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Editar data-base */}
                      <button
                        title="Editar data-base e reprocessar"
                        disabled={isBusy}
                        onClick={() => {
                          const m = notes.period_override?.match(/^(\d{4})-?(\d{2})?$/);
                          if (m) {
                            const [, year, month] = m;
                            setEditDate(`${month || '01'}/${year}`);
                          } else {
                            setEditDate(`01/${new Date().getFullYear()}`);
                          }
                          setEditName(notes.column_label?.replace(/\/.*/, '') || 'Anual');
                          setEditingId(editingId === upload.id ? null : upload.id);
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Limpar dados derivados (mantém o arquivo) */}
                      <button
                        title="Limpar dados derivados deste período (mantém o arquivo para reimportar)"
                        disabled={isBusy}
                        onClick={() => setConfirmModal({ mode: 'purge_one', uploadId: upload.id, label: columnLabel })}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-40 transition-colors"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                      </button>

                      {/* Excluir definitivamente */}
                      <button
                        title="Excluir arquivo e dados deste período"
                        disabled={isBusy}
                        onClick={() => setConfirmModal({ mode: 'delete_one', uploadId: upload.id, label: columnLabel })}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Painel de edição de data-base */}
                {editingId === upload.id && (
                  <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 space-y-3">
                    <p className="text-xs font-semibold text-blue-700">Alterar data-base e reprocessar</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Data-base (MM/AAAA)</label>
                        <input
                          type="text"
                          placeholder="MM/AAAA"
                          value={editDate}
                          onChange={e => {
                            let v = e.target.value.replace(/\D/g, '').slice(0, 6);
                            if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                            setEditDate(v);
                          }}
                          maxLength={7}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo do período</label>
                        <select
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                        >
                          {PERIOD_NAMES.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isThisBusy} className="text-xs h-7">
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEditSave}
                        disabled={isThisBusy || !editDate || !editName}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 gap-1"
                      >
                        {isThisBusy
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Reprocessando...</>
                          : <><RefreshCw className="w-3 h-3" /> Salvar e reprocessar</>
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda dos ícones */}
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-t border-slate-100 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Edit2 className="w-3 h-3" /> Editar data-base
          </span>
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <Eraser className="w-3 h-3" /> Limpar dados (mantém arquivo)
          </span>
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <Trash2 className="w-3 h-3" /> Excluir período completo
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border-t border-red-200 px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>
    </>
  );
}