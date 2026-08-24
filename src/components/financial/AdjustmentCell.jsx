/**
 * AdjustmentCell — célula editável de ajuste/reclassificação.
 * Ao clicar, abre um mini-form inline para digitar valor e descrição.
 * Persiste em FinancialAdjustment.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Pencil, Check, X, Plus } from 'lucide-react';

const fmt = (v) => {
  if (v == null || v === 0) return '—';
  const abs = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(v));
  return v < 0 ? `(${abs})` : abs;
};

/**
 * @param {Object} props
 * @param {any=} props.uploadId
 * @param {any=} props.diagnosisId
 * @param {any=} props.tenantId
 * @param {any=} props.canonicalKey
 * @param {any=} props.rubricLabel
 * @param {any=} props.statementCode
 * @param {any=} props.period
 * @param {any=} props.existingAdjustment
 * @param {any=} props.value
 * @param {any=} props.description
 */
export default function AdjustmentCell({
  uploadId,
  diagnosisId,
  tenantId,
  canonicalKey,
  rubricLabel,
  statementCode,
  period,
  existingAdjustment, // { id, value, description } | null
  onSaved,
}) {
  const [editing, setEditing] = useState(false);
  const [valueInput, setValueInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [saving, setSaving] = useState(false);

  const existing = existingAdjustment;
  const hasValue = existing && existing.value !== 0;

  const startEdit = () => {
    setValueInput(existing ? String(existing.value) : '');
    setDescInput(existing ? (existing.description || '') : '');
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    const num = parseFloat(valueInput.replace(',', '.'));
    if (isNaN(num)) { cancel(); return; }
    setSaving(true);
    try {
      const payload = {
        financial_upload_id: uploadId,
        financial_diagnosis_id: diagnosisId,
        tenant_id: tenantId,
        canonical_key: canonicalKey,
        rubric_label: rubricLabel,
        statement_code: statementCode,
        period,
        value: num,
        description: descInput.trim() || null,
      };
      if (existing?.id) {
        await base44.entities.FinancialAdjustment.update(existing.id, payload);
      } else {
        await base44.entities.FinancialAdjustment.create(payload);
      }
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing?.id) return;
    setSaving(true);
    try {
      await base44.entities.FinancialAdjustment.delete(existing.id);
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 w-40 shrink-0">
        <input
          autoFocus
          type="text"
          value={valueInput}
          onChange={e => setValueInput(e.target.value)}
          placeholder="0"
          className="w-full border border-amber-400 rounded px-1.5 py-0.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <input
          type="text"
          value={descInput}
          onChange={e => setDescInput(e.target.value)}
          placeholder="Descrição (opcional)"
          className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
        />
        <div className="flex gap-1 justify-end">
          {existing?.id && (
            <button onClick={remove} disabled={saving} title="Remover ajuste"
              className="p-0.5 text-red-400 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={cancel} disabled={saving}
            className="p-0.5 text-slate-400 hover:text-slate-600">
            <X className="w-3 h-3" />
          </button>
          <button onClick={save} disabled={saving}
            className="p-0.5 text-emerald-500 hover:text-emerald-700">
            <Check className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={startEdit}
      title={existing?.description || 'Clique para adicionar ajuste'}
      className="w-40 shrink-0 text-right text-xs tabular-nums cursor-pointer group flex items-center justify-end gap-1"
    >
      {hasValue ? (
        <>
          <span className="text-amber-700 font-medium">{fmt(existing.value)}</span>
          <Pencil className="w-2.5 h-2.5 text-amber-400 opacity-0 group-hover:opacity-100" />
        </>
      ) : (
        <span className="text-slate-200 group-hover:text-amber-300 transition-colors">
          <Plus className="w-3 h-3 inline" />
        </span>
      )}
    </div>
  );
}