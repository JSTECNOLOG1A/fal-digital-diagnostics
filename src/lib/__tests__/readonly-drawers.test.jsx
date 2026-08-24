import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  render,
  screen,
  cleanup,
} from '@testing-library/react';
import React from 'react';

afterEach(() => {
  cleanup();
});

// ── Hoisted mocks ──
const mocks = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
  entities: {
    ActionRecommendation: { update: vi.fn(), filter: vi.fn().mockResolvedValue([]) },
    FalCluster: { filter: vi.fn().mockResolvedValue([]) },
    ActionTaskReview: { filter: vi.fn().mockResolvedValue([]) },
    ActionPlanReview: { filter: vi.fn().mockResolvedValue([]) },
  },
  integrations: { Core: { InvokeLLM: vi.fn() } },
  qc: { invalidateQueries: vi.fn() },
  reviewMode: { isReviewMode: false, review_id: null },
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: mocks.functions,
    entities: mocks.entities,
    integrations: mocks.integrations,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useQueryClient: () => mocks.qc,
}));

vi.mock('@/context/ReviewModeContext', () => ({
  useReviewMode: () => mocks.reviewMode,
}));

vi.mock('@/lib/query-client', () => ({
  invalidateActionPlanQueries: vi.fn(),
  assessmentKey: (...args) => JSON.stringify(args),
  actionPlanKey: (...args) => JSON.stringify(args),
  tenantKey: (...args) => JSON.stringify(args),
}));

import RecommendationDrawer from '@/components/actionplan/RecommendationDrawer';
import TaskDrawer from '@/components/fal/TaskDrawer';
import TaskFullDrawer from '@/components/actionplan/central/TaskFullDrawer';

const mockRec = {
  id: 'rec-1',
  title: 'Implementar governance framework',
  recommendation_text: 'Estabelecer um framework de governanca formal',
  rationale: 'A ausencia de governanca formal e a causa raiz',
  practical_steps: '1. Definir comite 2. Estabelecer reunioes mensais',
  evidence_required: 'Ata de constituicao do comite',
  expected_result: 'Comite ativo com atas mensais',
  status: 'suggested',
  source_type: 'fal_diagnostic',
  priority: 'high',
  dimension_key: 'governanca',
  cluster_key: null,
  suggested_owner_area: 'Diretoria',
  suggested_deadline_days: 90,
  impact_score: 4,
  effort_score: 3,
  created_by: 'consultant@test.com',
  created_date: '2024-01-15T10:00:00Z',
};

const mockTask = {
  id: 'task-1',
  title: 'Implementar politica de compras',
  status: 'todo',
  priority: 'high',
  horizon: '90d',
  origin_type: 'cluster',
  progress_percentage: 0,
  owner_name: '',
  assigned_to: '',
  start_date: '',
  due_date: '',
  consultant_notes: '',
  description: 'Contexto da tarefa',
  dependency_task_keys: [],
};

const mockTaskFull = {
  ...mockTask,
  is_manual: false,
  expected_evidence: '',
  completion_evidence: '',
  blocked_reason: '',
  execution_guidance: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// RecommendationDrawer — client_viewer read-only
// ═════════════════════════════════════════════════════════════════════════════
describe('RecommendationDrawer — client_viewer (readOnly=true)', () => {
  it('zero mutation buttons visible', () => {
    render(
      <RecommendationDrawer
        rec={mockRec}
        planId="plan-1"
        assessmentId="assess-1"
        tenantId="tenant-a"
        tasks={[]}
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText(/Aprovar e converter em tarefa/i)).toBeNull();
    expect(screen.queryByText(/^Editar$/)).toBeNull();
    expect(screen.queryByText(/Melhorar com IA/i)).toBeNull();
    expect(screen.queryByText(/Rejeitar recomendação/i)).toBeNull();
    expect(screen.queryByText(/Vincular/i)).toBeNull();
    expect(screen.queryByText(/Sugerir/i)).toBeNull();
    expect(screen.queryByText(/Criar tarefa/i)).toBeNull();
    expect(screen.queryByText(/Salvar alterações/i)).toBeNull();
  });

  it('content visible: title, recommendation, rationale, steps, evidence', () => {
    render(
      <RecommendationDrawer
        rec={mockRec}
        planId="plan-1"
        assessmentId="assess-1"
        tenantId="tenant-a"
        tasks={[]}
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(mockRec.title)).toBeTruthy();
    expect(screen.getByText(mockRec.recommendation_text)).toBeTruthy();
    expect(screen.getByText(mockRec.rationale)).toBeTruthy();
    expect(screen.getByText(mockRec.practical_steps)).toBeTruthy();
    expect(screen.getByText(mockRec.evidence_required)).toBeTruthy();
    expect(screen.getByText(mockRec.expected_result)).toBeTruthy();
  });

  it('base44.functions.invoke = 0 calls', () => {
    render(
      <RecommendationDrawer
        rec={mockRec}
        planId="plan-1"
        assessmentId="assess-1"
        tenantId="tenant-a"
        tasks={[]}
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(mocks.functions.invoke).not.toHaveBeenCalled();
  });

  it('ActionRecommendation.update = 0 calls', () => {
    render(
      <RecommendationDrawer
        rec={mockRec}
        planId="plan-1"
        assessmentId="assess-1"
        tenantId="tenant-a"
        tasks={[]}
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(mocks.entities.ActionRecommendation.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TaskDrawer — client_viewer read-only
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskDrawer — client_viewer (readOnly=true)', () => {
  it('Salvar absent', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    expect(screen.queryByText(/Salvar/i)).toBeNull();
  });

  it('status buttons disabled', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    const statusButtons = screen.getAllByRole('button', { name: /A Fazer|Em Andamento|Bloqueada|Concluído|Cancelado/i });
    expect(statusButtons.length).toBeGreaterThan(0);
    statusButtons.forEach(btn => expect(btn.disabled).toBe(true));
  });

  it('selects disabled', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
    selects.forEach(sel => expect(sel.disabled).toBe(true));
  });

  it('date inputs disabled', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    dateInputs.forEach(inp => expect(inp.disabled).toBe(true));
  });

  it('text inputs disabled', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    const textInputs = document.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThan(0);
    textInputs.forEach(inp => expect(inp.disabled).toBe(true));
  });

  it('range input disabled', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    const rangeInput = document.querySelector('input[type="range"]');
    expect(rangeInput).toBeTruthy();
    expect(rangeInput.disabled).toBe(true);
  });

  it('base44.functions.invoke = 0 calls', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={true} onClose={() => {}} />
    );

    expect(mocks.functions.invoke).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TaskFullDrawer — client_viewer read-only
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskFullDrawer — client_viewer (readOnly=true)', () => {
  it('Salvar and check-in absent', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText(/Salvar alterações/i)).toBeNull();
    expect(screen.queryByText(/Registrar check-in/i)).toBeNull();
  });

  it('status buttons disabled', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    const statusButtons = screen.getAllByRole('button', { name: /A Fazer|Em Andamento|Bloqueada|Concluído|Cancelado/i });
    expect(statusButtons.length).toBeGreaterThan(0);
    statusButtons.forEach(btn => expect(btn.disabled).toBe(true));
  });

  it('selects disabled', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
    selects.forEach(sel => expect(sel.disabled).toBe(true));
  });

  it('date inputs disabled', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    dateInputs.forEach(inp => expect(inp.disabled).toBe(true));
  });

  it('text inputs disabled', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    const textInputs = document.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThan(0);
    textInputs.forEach(inp => expect(inp.disabled).toBe(true));
  });

  it('range input disabled', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    const rangeInput = document.querySelector('input[type="range"]');
    expect(rangeInput).toBeTruthy();
    expect(rangeInput.disabled).toBe(true);
  });

  it('base44.functions.invoke = 0 calls', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={true}
        onClose={() => {}}
      />
    );

    expect(mocks.functions.invoke).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Consultant — actions available (readOnly=false)
// ═════════════════════════════════════════════════════════════════════════════
describe('Consultant — actions available (readOnly=false)', () => {
  it('RecommendationDrawer shows mutation buttons', () => {
    render(
      <RecommendationDrawer
        rec={mockRec}
        planId="plan-1"
        assessmentId="assess-1"
        tenantId="tenant-a"
        tasks={[]}
        readOnly={false}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/Aprovar e converter em tarefa/i)).toBeTruthy();
    expect(screen.getByText(/^Editar$/)).toBeTruthy();
    expect(screen.getByText(/Melhorar com IA/i)).toBeTruthy();
    expect(screen.getByText(/Rejeitar recomendação/i)).toBeTruthy();
  });

  it('TaskDrawer shows Salvar and editable status buttons', () => {
    render(
      <TaskDrawer task={mockTask} allTasks={[]} readOnly={false} onClose={() => {}} />
    );

    expect(screen.getByText(/Salvar/i)).toBeTruthy();

    const statusButtons = screen.getAllByRole('button', { name: /A Fazer|Em Andamento|Bloqueada|Concluído|Cancelado/i });
    expect(statusButtons.length).toBeGreaterThan(0);
    statusButtons.forEach(btn => expect(btn.disabled).not.toBe(true));
  });

  it('TaskFullDrawer shows Salvar and check-in', () => {
    render(
      <TaskFullDrawer
        task={mockTaskFull}
        allTasks={[]}
        planId="plan-1"
        tenantId="tenant-a"
        readOnly={false}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/Salvar alterações/i)).toBeTruthy();
    expect(screen.getByText(/Registrar check-in/i)).toBeTruthy();
  });
});