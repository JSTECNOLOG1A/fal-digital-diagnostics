import React from 'react';
import { ArrowRight, ArrowDown } from 'lucide-react';

/** Seta horizontal entre fases */
export function HorizontalArrow({ active = true }) {
  return (
    <div className="relative flex w-10 shrink-0 items-center justify-center hidden xl:flex">
      <div className={`h-px w-full ${active ? 'bg-blue-300/70' : 'bg-slate-200'}`} />
      <ArrowRight className={`absolute h-5 w-5 ${active ? 'text-blue-400' : 'text-slate-300'}`} />
      {active && (
        <span className="absolute h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-flow-dot" />
      )}
    </div>
  );
}

/** Conector vertical entre fase e conteúdo abaixo */
export function VerticalConnector({ color = 'navy' }) {
  const lineColor = {
    navy: 'bg-slate-400/50',
    blue: 'bg-blue-400/50',
    green: 'bg-emerald-400/50',
  }[color] || 'bg-slate-300';

  const dotColor = {
    navy: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.7)]',
    blue: 'bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.7)]',
    green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
  }[color] || 'bg-slate-500';

  const arrowColor = {
    navy: 'text-slate-400',
    blue: 'text-blue-400',
    green: 'text-emerald-400',
  }[color] || 'text-slate-400';

  return (
    <div className="relative flex flex-col items-center">
      {/* Linha vertical */}
      <div className={`w-px h-8 ${lineColor}`} />
      {/* Ponto animado deslizando de cima para baixo */}
      <div
        className={`absolute top-0 h-2 w-2 rounded-full ${dotColor} animate-flow-dot-vertical`}
      />
      {/* Ponta de seta */}
      <svg width="10" height="7" viewBox="0 0 10 7" className={`mt-0 ${arrowColor}`} fill="none">
        <path d="M5 7L0 0h10L5 7z" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Seta curta vertical discreta */
export function SmallArrowDown({ color = 'blue' }) {
  const cls = {
    blue: 'text-blue-300',
    slate: 'text-slate-300',
    emerald: 'text-emerald-300',
  }[color] || 'text-slate-300';
  return (
    <div className="flex justify-center my-1">
      <ArrowDown className={`w-4 h-4 ${cls} animate-vertical-pulse`} />
    </div>
  );
}