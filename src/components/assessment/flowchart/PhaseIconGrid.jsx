import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const COLOR = {
  blue: {
    active:      'border-blue-400 text-blue-600 shadow-[0_0_0_8px_rgba(37,99,235,0.08),0_10px_28px_rgba(37,99,235,0.22)]',
    hover:       'hover:border-blue-200 hover:text-blue-500 hover:shadow-md',
    line:        '#bfdbfe',
    dot:         'bg-blue-200',
    labelIdle:   'text-slate-500 group-hover:text-blue-600',
    doneBadge:   'text-emerald-500',
    errorBadge:  'text-red-400',
    staleB:      'text-amber-400',
    runBadge:    'text-blue-400',
  },
  green: {
    active:      'border-emerald-400 text-emerald-600 shadow-[0_0_0_8px_rgba(16,185,129,0.08),0_10px_28px_rgba(16,185,129,0.22)]',
    hover:       'hover:border-emerald-200 hover:text-emerald-500 hover:shadow-md',
    line:        '#a7f3d0',
    dot:         'bg-emerald-200',
    labelIdle:   'text-slate-500 group-hover:text-emerald-600',
    doneBadge:   'text-emerald-500',
    errorBadge:  'text-red-400',
    staleB:      'text-amber-400',
    runBadge:    'text-emerald-400',
  },
};

/**
 * @param {Object} props
 * @param {any=} props.status
 * @param {any=} props.color
 */
function StatusBadge({ status, color }) {
  const c = COLOR[color] || COLOR.blue;
  if (status === 'done')    return <CheckCircle2 className={`absolute -bottom-1 -right-1 w-4 h-4 ${c.doneBadge} bg-white rounded-full`} />;
  if (status === 'error')   return <AlertTriangle className={`absolute -bottom-1 -right-1 w-4 h-4 ${c.errorBadge} bg-white rounded-full`} />;
  if (status === 'stale')   return <AlertTriangle className={`absolute -bottom-1 -right-1 w-4 h-4 ${c.staleB} bg-white rounded-full`} />;
  if (status === 'running') return <Loader2 className={`absolute -bottom-1 -right-1 w-4 h-4 ${c.runBadge} bg-white rounded-full animate-spin`} />;
  return null;
}

/**
 * @param {Object} props
 * @param {any=} props.step
 * @param {any=} props.color
 * @param {any=} props.onClick
 */
function IconButton({ step, color, onClick }) {
  const c = COLOR[color] || COLOR.blue;
  const Icon = step.icon;
  const isDone = step.status === 'done';

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group flex flex-col items-center gap-2 focus:outline-none"
    >
      <div className="relative">
        <div className={`
          flex items-center justify-center rounded-full border-2 bg-white
          transition-all duration-300
          w-14 h-14 sm:w-16 sm:h-16
          ${isDone ? `border-slate-300 shadow-sm ${c.hover}` : `border-slate-300 text-slate-400 shadow-sm ${c.hover}`}
        `}>
          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 group-hover:scale-110 ${isDone ? c.doneBadge : ''}`} />
        </div>
        <StatusBadge status={step.status} color={color} />
      </div>
      <span className={`text-xs sm:text-sm font-semibold transition-colors text-center leading-tight ${c.labelIdle}`}>
        {step.label}
      </span>
    </motion.button>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.steps
 * @param {any=} props.color
 * @param {any=} props.onNavigate
 */
export default function PhaseIconGrid({ steps, color = 'blue', onNavigate }) {
  const c = COLOR[color] || COLOR.blue;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Container principal: ocupa toda a largura disponível */}
      <div className="relative w-full" style={{ paddingTop: 32 }}>

        {/* Barra horizontal — de centro a centro do primeiro ao último ícone */}
        <div
          className="absolute"
          style={{
            top: 0,
            left: `calc(${100 / (2 * steps.length)}%)`,
            right: `calc(${100 / (2 * steps.length)}%)`,
            height: 1,
            background: c.line,
          }}
        />

        {/* Ponto de bifurcação no centro da barra */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full ${c.dot}`}
          style={{ top: -4 }}
        />

        {/* Linhas verticais de cada ícone descendo da barra até o ícone */}
        {steps.map((_, i) => {
          const pct = (100 / steps.length) * i + (100 / steps.length) / 2;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `calc(${pct}% - 0.5px)`,
                top: 0,
                height: 32,
                width: 1,
                background: c.line,
              }}
            />
          );
        })}

        {/* Row de ícones — flex distribuído uniformemente */}
        <div className="flex items-start justify-around w-full">
          {steps.map(step => (
            <IconButton
              key={step.id}
              step={step}
              color={color}
              onClick={() => onNavigate?.(step.tab)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}