/**
 * ReportActionPlanExecutive — Página 9 (abertura do plano)
 * Visão executiva: KPIs + Gantt completo por dimensão
 */
import React from 'react';

const PRIORITY_STYLE = {
  crítica:  { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444', bar: '#ef4444' },
  critical: { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444', bar: '#ef4444' },
  alta:     { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', bar: '#f59e0b' },
  high:     { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', bar: '#f59e0b' },
  média:    { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6', bar: '#3b82f6' },
  medium:   { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6', bar: '#3b82f6' },
  baixa:    { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e', bar: '#22c55e' },
  low:      { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e', bar: '#22c55e' },
};

const HORIZON_COLS = [
  { key: '90_days',  label: '90d',  color: '#ef4444', bg: '#fef2f2' },
  { key: '180_days', label: '180d', color: '#f59e0b', bg: '#fffbeb' },
  { key: '365_days', label: '365d', color: '#3b82f6', bg: '#eff6ff' },
];

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operacional',
  sistemas:           'Tecnologia / Sistemas',
};

const DIM_COLORS = {
  governanca:         '#6366f1',
  juridico:           '#8b5cf6',
  controles_internos: '#ef4444',
  financeiro:         '#10b981',
  contabil:           '#0ea5e9',
  tributario:         '#f59e0b',
  operacional:        '#f97316',
  sistemas:           '#14b8a6',
};

function getHorizonKey(task) {
  if (task.horizon) return task.horizon;
  const h = task.time_horizon || '';
  if (h === '90'  || h === '90_days')  return '90_days';
  if (h === '180' || h === '180_days') return '180_days';
  if (h === '365' || h === '365_days') return '365_days';
  return '90_days';
}

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.dimColor
 */
function DimensionGantt({ tasks, dimColor }) {
  return (
    <div>
      {/* Header cols */}
      <div style={{ display: 'flex', marginBottom: 4 }}>
        <div style={{ flex: 3 }} />
        <div style={{ flex: 2, display: 'flex', gap: 2 }}>
          {HORIZON_COLS.map(h => (
            <div key={h.key} style={{
              flex: 1, textAlign: 'center',
              fontSize: 8, fontWeight: 700, color: h.color,
              textTransform: 'uppercase', letterSpacing: 0.8,
              background: h.bg, padding: '2px 0', borderRadius: 3,
            }}>
              {h.label}
            </div>
          ))}
        </div>
      </div>
      {/* Rows */}
      {tasks.map((task, i) => {
        const p = PRIORITY_STYLE[(task.priority || '').toLowerCase()] || PRIORITY_STYLE.média;
        const hIdx = HORIZON_COLS.findIndex(h => h.key === getHorizonKey(task));
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0', borderBottom: '1px solid #f8fafc',
          }}>
            <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 10.5, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title || task.action || '—'}
              </span>
            </div>
            <div style={{ flex: 2, display: 'flex', gap: 2 }}>
              {HORIZON_COLS.map((h, ci) => (
                <div key={h.key} style={{
                  flex: 1, height: 7,
                  background: ci === hIdx ? p.bar : '#f1f5f9',
                  borderRadius: 3,
                  opacity: ci === hIdx ? 0.9 : 1,
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportActionPlanExecutive({ payload }) {
  const { action_plan = {} } = payload;
  const allTasks = action_plan.all_tasks || [];
  const tasksByPriority = action_plan.tasks_by_priority || {};
  const tasksByHorizon = action_plan.tasks_by_horizon || {};

  const tasks90  = (tasksByHorizon['90_days']  || []).length;
  const tasks180 = (tasksByHorizon['180_days'] || []).length;
  const tasks365 = (tasksByHorizon['365_days'] || []).length;

  // Agrupar por dimensão
  const groups = {};
  allTasks.forEach(task => {
    const dimKey = task.dimension_key || task.dimension || 'outros';
    if (!groups[dimKey]) groups[dimKey] = [];
    groups[dimKey].push(task);
  });

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 9, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Plano de Ação Estratégico
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Visão Executiva — Roadmap Completo
        </h2>
        <div style={{ width: 40, height: 3, background: '#8b5cf6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total de Ações', value: allTasks.length,                  color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'Críticas',       value: tasksByPriority.critical || 0,    color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
          { label: '90 dias',        value: tasks90,                          color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
          { label: '180 dias',       value: tasks180,                         color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
          { label: '365 dias',       value: tasks365,                         color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0 }}>{value}</p>
            <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, padding: '8px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Horizonte:</span>
        {HORIZON_COLS.map(h => (
          <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 7, background: h.color, borderRadius: 3, opacity: 0.85 }} />
            <span style={{ fontSize: 9, color: '#64748b' }}>{h.label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Prioridade:</span>
        {[['Crítica','#ef4444'],['Alta','#f59e0b'],['Média','#3b82f6'],['Baixa','#22c55e']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />
            <span style={{ fontSize: 9, color: '#64748b' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Gantt por dimensão */}
      {Object.entries(groups).map(([dimKey, tasks]) => {
        const dimLabel = DIM_LABELS[dimKey] || dimKey.replace(/_/g, ' ');
        const dimColor = DIM_COLORS[dimKey] || '#64748b';
        return (
          <div key={dimKey} style={{ marginBottom: 20 }}>
            <div style={{
              background: dimColor, borderRadius: '6px 6px 0 0',
              padding: '7px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {dimLabel}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                {tasks.length} ação{tasks.length !== 1 ? 'ões' : ''}
              </span>
            </div>
            <div style={{ border: `1px solid ${dimColor}33`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '10px 14px' }}>
              <DimensionGantt tasks={tasks} dimColor={dimColor} />
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
          Roadmap gerado automaticamente pelo FAL Digital™. As ações detalhadas por horizonte estão nas páginas seguintes.
        </p>
      </div>
    </div>
  );
}