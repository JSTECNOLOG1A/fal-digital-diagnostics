/**
 * ReportActionPlan90 — Página 9
 * Plano de ação: 90 dias (ações imediatas)
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

function getTaskType(task) {
  const title = (task.title || task.action || '').toLowerCase();
  if (title.includes('implant') || title.includes('estrutur')) return 'Estrutural';
  if (title.includes('defin') || title.includes('formaliz')) return 'Governança';
  return 'Quick win';
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.index
 */
function TaskRow({ task, index }) {
  const p = PRIORITY_STYLE[(task.priority || '').toLowerCase()] || PRIORITY_STYLE.média;
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
      <td style={{ padding: '12px 10px', width: 28 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{index + 1}</span>
      </td>
      <td style={{ padding: '12px 10px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
          {task.title || task.action || '—'}
        </p>
        {task.cluster_name && (
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{task.cluster_name}</p>
        )}
      </td>
      <td style={{ padding: '12px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, background: p.bg, color: p.text, padding: '3px 10px', borderRadius: 9999 }}>
          {task.priority || '—'}
        </span>
      </td>
      <td style={{ padding: '12px 10px' }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          {task.dimension_name || task.responsible || '—'}
        </p>
      </td>
      <td style={{ padding: '12px 10px' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{getTaskType(task)}</p>
      </td>
    </tr>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportActionPlan90({ payload }) {
  const { action_plan = {} } = payload;
  const tasks_by_horizon = action_plan.tasks_by_horizon || {};
  // Suporta chaves '90d' (padrão ActionTask) e fallback '90_days' (legado)
  const allTasks = action_plan.all_tasks || [];
  const tasks90 = tasks_by_horizon['90d'] || tasks_by_horizon['90_days']
    || allTasks.filter(t => t.horizon === '90d' || t.horizon === '90_days');

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Plano de Ação
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Roadmap de Implementação — 90 Dias
        </h2>
        <div style={{ width: 40, height: 3, background: '#8b5cf6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        borderRadius: 10, padding: '16px 22px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{tasks90.length}</p>
          <p style={{ fontSize: 10, color: '#fecaca', textTransform: 'uppercase', letterSpacing: 1 }}>ações nos próximos 90 dias</p>
        </div>
        <div style={{ width: 1, height: 40, background: '#dc262633' }} />
        <p style={{ fontSize: 13, color: '#fee2e2', lineHeight: 1.6 }}>
          Foco em fundações críticas: estabilizar controles, melhorar previsibilidade gerencial e iniciar integração entre dimensões.
        </p>
      </div>

      {tasks90.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
          <p>Nenhuma ação de 90 dias disponível.</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #0f172a' }}>
              {['#', 'Ação', 'Prioridade', 'Responsável sugerido', 'Tipo'].map((h) => (
                <th key={h} style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks90.slice(0, 10).map((t, i) => (
              <TaskRow key={i} task={t} index={i} />
            ))}
          </tbody>
        </table>
      )}

      {tasks90.length > 10 && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
          + {tasks90.length - 10} ações adicionais no plano completo
        </p>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28, padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.7, margin: 0 }}>
          As ações de 90 dias visam estabilizar os controles críticos, melhorar a previsibilidade gerencial e reduzir as principais tensões sistêmicas identificadas.
        </p>
      </div>
    </div>
  );
}