import React, { useState, useRef, useEffect } from 'react';
import { Flag, Clock, RefreshCw, AlertOctagon, X } from 'lucide-react';

const FLAGS = [
  { value: 'pendente',  label: 'Pendente',  icon: Clock,         color: 'text-orange-600 bg-orange-50' },
  { value: 'revisar',   label: 'Revisar',   icon: RefreshCw,     color: 'text-blue-600 bg-blue-50'   },
  { value: 'conflito',  label: 'Conflito',  icon: AlertOctagon,  color: 'text-red-600 bg-red-50'     },
];

/**
 * @param {Object} props
 * @param {any=} props.currentFlag
 * @param {any=} props.onChange
 */
export default function QuestionFlagMenu({ currentFlag, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const active = FLAGS.find(f => f.value === currentFlag);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors
          ${active ? active.color + ' font-semibold border border-current/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
        title="Marcar pergunta"
      >
        <Flag className="w-3 h-3" />
        {active ? active.label : 'Marcar'}
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-30 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[130px]">
          {FLAGS.map(f => (
            <button
              key={f.value}
              onClick={() => { onChange(currentFlag === f.value ? null : f.value); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors
                ${currentFlag === f.value ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              <f.icon className="w-3 h-3" />
              {f.label}
              {currentFlag === f.value && <X className="w-2.5 h-2.5 ml-auto text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}