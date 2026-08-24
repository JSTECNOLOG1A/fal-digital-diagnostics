import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle2, PlayCircle, Calendar, Repeat, Layers, Wrench } from 'lucide-react';

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200',    label: 'Crítica',  dot: 'bg-red-500' },
  high:     { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Alta',   dot: 'bg-amber-500' },
  medium:   { badge: 'bg-blue-100 text-blue-700 border-blue-200',   label: 'Média',   dot: 'bg-blue-400' },
  low:      { badge: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Baixa',  dot: 'bg-slate-400' },
};

const STATUS_NEXT = {
  todo:        { label: 'Iniciar',  next: 'in_progress', icon: PlayCircle,   cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  in_progress: { label: 'Concluir', next: 'done',        icon: CheckCircle2, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  blocked:     { label: 'Desbloquear', next: 'todo',     icon: PlayCircle,   cls: 'bg-amber-600 hover:bg-amber-700 text-white' },
};

const FREQ_LABEL = {
  once: 'Única vez', daily: 'Diário', weekly: 'Semanal',
  monthly: 'Mensal', quarterly: 'Trimestral', event: 'Por evento',
};

const HORIZON_COLOR = { '30d': 'bg-red-100 text-red-700', '60d': 'bg-amber-100 text-amber-700', '90d': 'bg-blue-100 text-blue-700', '180d': 'bg-violet-100 text-violet-700' };

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.onClose
 * @param {any=} props.onStatusChange
 */
export default function ActionPlanTaskDrawer({ task, onClose, onStatusChange }) {
  if (!task) return null;

  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const statusAction = STATUS_NEXT[task.status];
  const isOperational = task.task_layer === 'operational';

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={`text-xs border ${p.badge}`}>{p.label}</Badge>
            {task.horizon && (
              <Badge className={`text-xs border ${HORIZON_COLOR[task.horizon] || 'bg-slate-100 text-slate-600'}`}>
                {task.horizon}
              </Badge>
            )}
            {isOperational
              ? <Badge className="text-xs bg-violet-50 text-violet-700 border-violet-200 gap-1"><Wrench className="w-3 h-3" />Operacional</Badge>
              : <Badge className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 gap-1"><Layers className="w-3 h-3" />Estratégico</Badge>
            }
            {task.status === 'done' && (
              <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="w-3 h-3" />Concluído</Badge>
            )}
          </div>
          <SheetTitle className="text-base font-bold text-slate-900 leading-snug">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Motivo */}
          {task.reason && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">{task.reason}</p>
            </div>
          )}

          {/* Descrição */}
          {task.description && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Descrição</p>
              <p className="text-sm text-slate-700 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Metadados */}
          <div className="flex flex-wrap gap-3">
            {task.due_date && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Prazo: <span className="font-semibold text-slate-700">{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {task.frequency && task.frequency !== 'once' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Repeat className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">{FREQ_LABEL[task.frequency]}</span>
              </div>
            )}
            {task.typical_owner && (
              <div className="text-xs text-slate-500">
                Responsável: <span className="font-semibold text-slate-700">{task.typical_owner}</span>
              </div>
            )}
          </div>

          {/* Como executar */}
          {task.how_to_execute && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Como executar</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{task.how_to_execute}</p>
            </div>
          )}

          {/* Evidência esperada */}
          {task.expected_evidence && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Evidência esperada</p>
              <p className="text-sm text-emerald-800 leading-relaxed">{task.expected_evidence}</p>
            </div>
          )}

          {/* Action button */}
          {statusAction && (
            <div className="pt-2">
              <Button
                className={`w-full gap-2 ${statusAction.cls}`}
                onClick={() => { onStatusChange(task); onClose(); }}
              >
                <statusAction.icon className="w-4 h-4" />
                {statusAction.label} tarefa
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}