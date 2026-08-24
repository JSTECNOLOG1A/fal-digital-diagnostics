/**
 * AddManualTaskModal
 * Modal para criar tarefa manual do consultor.
 * origin_type: "manual" — não sobrescrita por regeneração do engine.
 * Dimensão e Cluster são obrigatórios.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

const DIM_OPTIONS = [
  { value: 'governanca',         label: 'Governança' },
  { value: 'juridico',           label: 'Jurídico / Societário' },
  { value: 'controles_internos', label: 'Controles Internos' },
  { value: 'financeiro',         label: 'Financeiro' },
  { value: 'contabil',           label: 'Contábil' },
  { value: 'tributario',         label: 'Fiscal / Tributário' },
  { value: 'operacional',        label: 'Operacional' },
  { value: 'sistemas',           label: 'Tecnologia / Sistemas' },
];

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.required
 * @param {any=} props.children
 */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.planId
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onClose
 * @param {any=} props.onCreated
 */
export default function AddManualTaskModal({ planId, assessmentId, tenantId, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    horizon: '90d',
    assigned_to: '',
    due_date: '',
    dimension_key: '',
    cluster_key: '',
    consultant_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const fetchedRef = useRef(false);

  // Busca todas as perguntas uma vez para derivar clusters únicos
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingClusters(true);
    base44.entities.FalQuestion.list('dimension_key', 2000)
      .then(data => setAllQuestions(data || []))
      .finally(() => setLoadingClusters(false));
  }, []);

  // Reset cluster ao trocar dimensão
  useEffect(() => {
    setForm(f => ({ ...f, cluster_key: '' }));
  }, [form.dimension_key]);

  // Clusters únicos filtrados pela dimensão selecionada
  const clusters = useMemo(() => {
    if (!form.dimension_key) return [];
    const seen = new Set();
    return allQuestions
      .filter(q => q.dimension_key === form.dimension_key && q.cluster_key)
      .filter(q => { if (seen.has(q.cluster_key)) return false; seen.add(q.cluster_key); return true; })
      .map(q => ({ key: q.cluster_key, name: q.cluster_key }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allQuestions, form.dimension_key]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.title.trim())      { setError('O título é obrigatório.'); return; }
    if (!form.dimension_key)     { setError('Selecione uma dimensão.'); return; }
    if (!form.cluster_key)       { setError('Selecione um cluster.'); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('createManualActionTask', {
        plan_id: planId,
        task: {
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          horizon: form.horizon,
          assigned_to: form.assigned_to.trim() || null,
          due_date: form.due_date || null,
          dimension_key: form.dimension_key,
          cluster_key: form.cluster_key,
          consultant_notes: form.consultant_notes.trim() || null,
          action_type: 'structural',
        },
      });
      onCreated && onCreated(response.data.task);
      onClose();
    } catch (e) {
      setError(e?.message || 'Erro ao criar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nova Tarefa Manual</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tarefa criada pelo consultor — não será sobrescrita pelo motor</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
        )}

        <Field label="Título" required>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Ex: Implementar controle de acesso ao sistema ERP"
            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            autoFocus
          />
        </Field>

        <Field label="Descrição">
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Contexto e detalhes da tarefa..."
            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade">
            <select
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            >
              <option value="critical">Crítico</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </Field>
          <Field label="Horizonte">
            <select
              value={form.horizon}
              onChange={e => set('horizon', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            >
              <option value="30d">30 Dias</option>
              <option value="60d">60 Dias</option>
              <option value="90d">90 Dias</option>
              <option value="180d">180 Dias</option>
            </select>
          </Field>
        </div>

        {/* Dimensão — obrigatória */}
        <Field label="Dimensão relacionada" required>
          <select
            value={form.dimension_key}
            onChange={e => set('dimension_key', e.target.value)}
            className={`w-full text-sm border rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none ${!form.dimension_key ? 'border-slate-200 text-slate-400' : 'border-slate-200 text-slate-800'}`}
          >
            <option value="">Selecione uma dimensão...</option>
            {DIM_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>

        {/* Cluster — obrigatório, filtrado pela dimensão */}
        <Field label="Cluster" required>
          <select
            value={form.cluster_key}
            onChange={e => set('cluster_key', e.target.value)}
            disabled={!form.dimension_key || loadingClusters}
            className={`w-full text-sm border rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${!form.cluster_key ? 'border-slate-200' : 'border-slate-200 text-slate-800'}`}
          >
            {!form.dimension_key
              ? <option value="">Selecione uma dimensão primeiro</option>
              : loadingClusters
              ? <option value="">Carregando clusters...</option>
              : clusters.length === 0
              ? <option value="">Nenhum cluster encontrado</option>
              : <>
                  <option value="">Selecione um cluster...</option>
                  {clusters.map(c => (
                    <option key={c.key} value={c.key}>{c.name}</option>
                  ))}
                </>
            }
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsável">
            <input
              type="text"
              value={form.assigned_to}
              onChange={e => set('assigned_to', e.target.value)}
              placeholder="Ex: Gestor Financeiro"
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            />
          </Field>
          <Field label="Prazo">
            <input
              type="date"
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Notas do consultor">
          <textarea
            value={form.consultant_notes}
            onChange={e => set('consultant_notes', e.target.value)}
            placeholder="Justificativa, contexto, referências..."
            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
            rows={2}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            {saving ? 'Criando...' : 'Criar Tarefa'}
          </Button>
        </div>
      </div>
    </div>
  );
}