/**
 * ReportActionPlan — Plano de Ação Estratégico
 * Consome: payload.action_plan
 */
import React from 'react';

const PRIORITY_STYLE = {
  crítica:   { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
  critical:  { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
  alta:      { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  high:      { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  média:     { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  medium:    { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  baixa:     { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  low:       { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
};

const HORIZON_CONFIG = {
  '90_days':  { label: '90 Dias', color: '#ef4444', bg: '#fef2f2', desc: 'Fundações & Quick wins' },
  '180_days': { label: '180 Dias', color: '#f59e0b', bg: '#fffbeb', desc: 'Implementação & Processos' },
  '365_days': { label: '365 Dias', color: '#3b82f6', bg: '#eff6ff', desc: 'Consolidação & Maturação' },
};

/**
 * @param {Object} props
 * @param {any=} props.task
 */
function TaskRow({ task }) {
  const p = PRIORITY_STYLE[task.priority?.toLowerCase()] || PRIORITY_STYLE.média;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 8,
      background: '#fafafa', marginBottom: 5,
      border: '1px solid #f1f5f9',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: p.dot, flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{task.title || task.action || '—'}</span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        background: p.bg, color: p.text,
        padding: '2px 8px', borderRadius: 9999, flexShrink: 0,
      }}>
        {task.priority || '—'}
      </span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.horizonKey
 * @param {any=} props.tasks
 */
function HorizonSection({ horizonKey, tasks }) {
  const cfg = HORIZON_CONFIG[horizonKey] || { label: horizonKey, color: '#94a3b8', bg: '#f8fafc', desc: '' };
  if (!tasks || tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: cfg.bg,
        borderRadius: 10, marginBottom: 10,
        borderLeft: `4px solid ${cfg.color}`,
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</p>
          <p style={{ fontSize: 11, color: '#64748b' }}>{cfg.desc} · {tasks.length} ação{tasks.length !== 1 ? 'ões' : ''}</p>
        </div>
      </div>
      {tasks.slice(0, 8).map((t, i) => <TaskRow key={i} task={t} />)}
      {tasks.length > 8 && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
          + {tasks.length - 8} ações adicionais
        </p>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportActionPlan({ payload }) {
  const { action_plan } = payload;
  const { tasks_by_priority, tasks_by_horizon, all_tasks, narrative } = action_plan;

  return (
    <div style={{ padding: '48px 56px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          06 · Plano de Ação
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Roadmap de Transformação
        </h2>
        <div style={{ width: 40, height: 3, background: '#8b5cf6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <div style={{
          flex: 1, background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
          borderRadius: 12, padding: '16px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{all_tasks.length}</p>
          <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Total de Ações</p>
        </div>
        {[
          { label: 'Críticas', count: tasks_by_priority.critical, color: '#ef4444' },
          { label: 'Altas',    count: tasks_by_priority.high,     color: '#f59e0b' },
          { label: 'Médias',   count: tasks_by_priority.medium,   color: '#3b82f6' },
          { label: 'Baixas',   count: tasks_by_priority.low,      color: '#22c55e' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            flex: 1, border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '16px 20px', textAlign: 'center',
            background: '#fff',
          }}>
            <p style={{ fontSize: 28, fontWeight: 800, color }}>{count || 0}</p>
            <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Narrative */}
      {narrative && (
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '16px 20px', marginBottom: 28,
        }}>
          {narrative.split('\n\n').map((para, i) => (
            <p key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.75, marginBottom: 10 }}>{para}</p>
          ))}
        </div>
      )}

      {/* Horizon sections */}
      {Object.entries(tasks_by_horizon).map(([key, tasks]) => (
        <HorizonSection key={key} horizonKey={key} tasks={tasks} />
      ))}
    </div>
  );
}