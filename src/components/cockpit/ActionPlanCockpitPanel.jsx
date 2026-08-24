/**
 * ActionPlanCockpitPanel.jsx
 * Painel do plano de ação para o Cockpit — consome action_plan do motor FAL.
 * Mostra cards de ações com status, prioridade e metadados.
 * Props: actions[] — array do action_plan retornado pelo runFullDiagnostic
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, CheckCircle2, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const PRIORITY_STYLES = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-500',    label: 'Crítica' },
  high:     { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', label: 'Alta' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', label: 'Média' },
  low:      { badge: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500',  label: 'Baixa' },
};

const HORIZON_LABELS = { '30d': '30 dias', '60d': '60 dias', '90d': '90 dias', '180d': '180 dias' };

const STATUS_CONFIG = {
  pendente:    { icon: Circle,       label: 'Pendente',     class: 'text-slate-400' },
  andamento:   { icon: Loader2,      label: 'Em Andamento', class: 'text-blue-500' },
  concluido:   { icon: CheckCircle2, label: 'Concluído',    class: 'text-emerald-500' },
};

function formatKey(key = '') {
  return key.replace(/_cluster$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * @param {Object} props
 * @param {any=} props.action
 * @param {any=} props.status
 * @param {any=} props.onStatusChange
 */
function ActionCard({ action, status, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const pStyle  = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.medium;
  const sConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  const StatusIcon = sConfig.icon;

  const nextStatus = { pendente: 'andamento', andamento: 'concluido', concluido: 'pendente' };

  return (
    <Card className="border border-slate-200 shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Status toggle */}
          <button
            onClick={() => onStatusChange(nextStatus[status] || 'pendente')}
            className={`mt-0.5 flex-shrink-0 ${sConfig.class} hover:opacity-70 transition-opacity`}
            title={`Status: ${sConfig.label} — clique para avançar`}
          >
            <StatusIcon className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold text-slate-800 leading-tight ${status === 'concluido' ? 'line-through text-slate-400' : ''}`}>
                {action.action_title}
              </p>
              <button onClick={() => setExpanded(v => !v)} className="flex-shrink-0 text-slate-300 hover:text-slate-500">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pStyle.badge}`}>
                {pStyle.label}
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {HORIZON_LABELS[action.suggested_deadline] || action.suggested_deadline}
              </span>
              {action.cluster_label && (
                <span className="text-[10px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 font-medium">
                  {action.cluster_label}
                </span>
              )}
              {action.dimension_label && (
                <span className="text-[10px] text-slate-400">{action.dimension_label}</span>
              )}
            </div>

            {/* Expandido */}
            {expanded && (
              <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
                {action.action_description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{action.action_description}</p>
                )}
                {action.expected_impact && (
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">Impacto Esperado</p>
                    <p className="text-xs text-emerald-800">{action.expected_impact}</p>
                  </div>
                )}
                {action.implementation_complexity && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-slate-500">Complexidade:</p>
                    <span className="text-[10px] font-medium text-slate-700 capitalize">{action.implementation_complexity}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.actions
 */
export default function ActionPlanCockpitPanel({ actions = [] }) {
  const [statuses, setStatuses]     = useState(/** @type {Record<string, any>} */ ({}));
  const [sortBy, setSortBy]         = useState('priority_score');
  const [filterStatus, setFilter]   = useState('all');

  const handleStatusChange = (key, newStatus) => {
    setStatuses(prev => ({ ...prev, [key]: newStatus }));
  };

  const sorted = [...actions].sort((a, b) => {
    if (sortBy === 'priority_score') return (b.priority_score || 0) - (a.priority_score || 0);
    if (sortBy === 'deadline') {
      const order = { '30d': 0, '60d': 1, '90d': 2, '180d': 3 };
      return (order[a.suggested_deadline] ?? 9) - (order[b.suggested_deadline] ?? 9);
    }
    return 0;
  });

  const filtered = sorted.filter(a => {
    if (filterStatus === 'all') return true;
    const key = a.cluster_key;
    return (statuses[key] || 'pendente') === filterStatus;
  });

  const totalConcluido = actions.filter(a => (statuses[a.cluster_key] || 'pendente') === 'concluido').length;
  const totalAndamento = actions.filter(a => (statuses[a.cluster_key] || 'pendente') === 'andamento').length;

  if (actions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma ação de diagnóstico disponível.</p>
        <p className="text-xs mt-1">Execute um diagnóstico FAL para gerar o plano de ação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-slate-900">{actions.length}</p>
          <p className="text-[10px] text-slate-500">Ações Totais</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{totalAndamento}</p>
          <p className="text-[10px] text-blue-500">Em Andamento</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-emerald-700">{totalConcluido}</p>
          <p className="text-[10px] text-emerald-500">Concluídas</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setSortBy('priority_score')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${sortBy === 'priority_score' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
          >
            Por Prioridade
          </button>
          <button
            onClick={() => setSortBy('deadline')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${sortBy === 'deadline' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
          >
            Por Prazo
          </button>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
          {['all', 'pendente', 'andamento', 'concluido'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${filterStatus === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map(action => (
          <ActionCard
            key={action.cluster_key}
            action={action}
            status={statuses[action.cluster_key] || 'pendente'}
            onStatusChange={(ns) => handleStatusChange(action.cluster_key, ns)}
          />
        ))}
      </div>
    </div>
  );
}