/**
 * ReportActionPlan180365 — Página 10
 * Plano de ação: 180 e 365 dias (continuidade da transformação)
 */
import React from 'react';

const PRIORITY_STYLE = {
  crítica:  { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
  critical: { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
  alta:     { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  high:     { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  média:    { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  medium:   { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  baixa:    { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  low:      { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
};

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.index
 */
function TaskRow({ task, index }) {
  const p = PRIORITY_STYLE[(task.priority || '').toLowerCase()] || PRIORITY_STYLE.média;
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
      <td style={{ padding: '10px 10px', width: 28 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{index + 1}</span>
      </td>
      <td style={{ padding: '10px 10px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>
          {task.title || task.action || '—'}
        </p>
      </td>
      <td style={{ padding: '10px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, background: p.bg, color: p.text, padding: '3px 8px', borderRadius: 9999 }}>
          {task.priority || '—'}
        </span>
      </td>
      <td style={{ padding: '10px 10px' }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{task.dimension_name || task.responsible || '—'}</p>
      </td>
    </tr>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.color
 * @param {any=} props.bgColor
 * @param {any=} props.description
 * @param {any=} props.tasks
 * @param {any=} props.limit
 */
function HorizonBlock({ title, color, bgColor, description, tasks, limit = 7 }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{
        borderLeft: `4px solid ${color}`,
        background: bgColor,
        padding: '14px 18px', borderRadius: '0 8px 8px 0',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 16, fontWeight: 800, color, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          {description} · {tasks.length} ação{tasks.length !== 1 ? 'ões' : ''}
        </p>
      </div>

      {tasks.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 18 }}>Nenhuma ação neste horizonte.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Ação', 'Prioridade', 'Responsável'].map((h) => (
                  <th key={h} style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, limit).map((t, i) => <TaskRow key={i} task={t} index={i} />)}
            </tbody>
          </table>
          {tasks.length > limit && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, paddingLeft: 10 }}>
              + {tasks.length - limit} ações adicionais
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportActionPlan180365({ payload }) {
  const { action_plan = {} } = payload;
  const tasks_by_horizon = action_plan.tasks_by_horizon || {};
  const tasks_by_priority = action_plan.tasks_by_priority || {};
  const all_tasks = action_plan.all_tasks || [];

  const allTasks = action_plan.all_tasks || [];
  const tasks180 = tasks_by_horizon['180d'] || tasks_by_horizon['180_days']
    || allTasks.filter(t => t.horizon === '180d' || t.horizon === '180_days');
  const tasks365 = tasks_by_horizon['365d'] || tasks_by_horizon['365_days']
    || allTasks.filter(t => t.horizon === '365d' || t.horizon === '365_days');

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Plano de Ação
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Roadmap de Transformação — 180 / 365 Dias
        </h2>
        <div style={{ width: 40, height: 3, background: '#8b5cf6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Total de Ações', value: all_tasks.length, color: '#0f172a', bg: '#f8fafc' },
          { label: 'Críticas', value: tasks_by_priority.critical || 0, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Altas', value: tasks_by_priority.high || 0, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Médias', value: tasks_by_priority.medium || 0, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Baixas', value: tasks_by_priority.low || 0, color: '#22c55e', bg: '#f0fdf4' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ flex: 1, background: bg, border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 900, color, margin: 0 }}>{value}</p>
            <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* 180 days */}
      <HorizonBlock
        title="180 Dias"
        color="#f59e0b"
        bgColor="#fffbeb"
        description="Implementação e processos"
        tasks={tasks180}
      />

      {/* 365 days */}
      <HorizonBlock
        title="365 Dias"
        color="#3b82f6"
        bgColor="#eff6ff"
        description="Consolidação e maturação"
        tasks={tasks365}
      />
    </div>
  );
}