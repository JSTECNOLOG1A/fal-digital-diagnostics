import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const PHASE_STYLES = {
  navy: {
    wrapper: 'from-slate-950 via-slate-900 to-slate-800',
    ring: 'border-slate-500/40 bg-slate-800/60',
    glow: 'shadow-[0_18px_35px_rgba(15,23,42,0.28)]',
    hoverGlow: 'hover:shadow-[0_24px_45px_rgba(15,23,42,0.38)]',
    numText: 'text-slate-400',
  },
  blue: {
    wrapper: 'from-blue-700 via-blue-600 to-blue-500',
    ring: 'border-blue-300/40 bg-blue-500/30',
    glow: 'shadow-[0_18px_35px_rgba(37,99,235,0.28)]',
    hoverGlow: 'hover:shadow-[0_24px_45px_rgba(37,99,235,0.38)]',
    numText: 'text-blue-200',
  },
  green: {
    wrapper: 'from-emerald-700 via-emerald-600 to-emerald-500',
    ring: 'border-emerald-300/40 bg-emerald-500/30',
    glow: 'shadow-[0_18px_35px_rgba(5,150,105,0.25)]',
    hoverGlow: 'hover:shadow-[0_24px_45px_rgba(5,150,105,0.35)]',
    numText: 'text-emerald-200',
  },
};

/**
 * @param {Object} props
 * @param {any=} props.number
 * @param {any=} props.title
 * @param {any=} props.subtitle
 * @param {any=} props.color
 * @param {any=} props.icon
 * @param {any=} props.done
 * @param {any=} props.active
 * @param {any=} props.expanded
 */
export default function PhaseCard({ number, title, subtitle, color = 'navy', icon: Icon, done = false, active = false, expanded = false }) {
  const s = PHASE_STYLES[color] || PHASE_STYLES.navy;

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`
        relative h-[104px] rounded-2xl bg-gradient-to-br ${s.wrapper} ${s.glow} ${s.hoverGlow}
        overflow-hidden transition-all duration-300 select-none
        ${expanded ? 'ring-2 ring-white/30 scale-[1.01]' : 'ring-0'}
      `}
    >
      {/* Highlight interno */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.35),transparent_35%)]" />

      {/* Ícone decorativo de fundo */}
      {Icon && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-[0.12]">
          <Icon className="h-16 w-16 text-white" />
        </div>
      )}

      {/* Linha de brilho no topo */}
      <div className="absolute top-0 left-6 right-6 h-px bg-white/20" />

      {/* Conteúdo */}
      <div className="relative z-10 flex h-full items-center gap-4 px-6">
        <div className={`
          flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${s.ring}
          text-sm font-black text-white
        `}>
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-extrabold tracking-wide text-white uppercase truncate">{title}</p>
            {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
          </div>
          <p className={`text-[11px] mt-0.5 ${s.numText}`}>{subtitle}</p>
        </div>
      </div>

      {/* Linha de brilho no fundo */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10" />
    </motion.div>
  );
}