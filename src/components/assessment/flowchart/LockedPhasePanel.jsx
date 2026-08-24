import React from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { VerticalConnector } from './FlowConnector';

const STYLES = {
  blue: {
    border: 'border-blue-100',
    bg: 'from-blue-50/40 via-white to-white',
    glow: 'shadow-[0_12px_35px_rgba(37,99,235,0.06)]',
    iconBg: 'bg-blue-50 border-blue-200 text-blue-500',
    text: 'text-blue-800',
    stroke: '#2563EB',
    msgBorder: 'border-blue-200',
  },
  green: {
    border: 'border-emerald-100',
    bg: 'from-emerald-50/40 via-white to-white',
    glow: 'shadow-[0_12px_35px_rgba(5,150,105,0.06)]',
    iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    text: 'text-emerald-800',
    stroke: '#10B981',
    msgBorder: 'border-emerald-200',
  },
};

/**
 * @param {Object} props
 * @param {any=} props.stroke
 */
function FlowWaves({ stroke }) {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 h-56 w-full opacity-[0.09]"
      viewBox="0 0 600 230"
      fill="none"
      preserveAspectRatio="none"
    >
      <path d="M-20 170 C 110 80,240 220,400 110 C 490 55,550 65,620 100" stroke={stroke} strokeWidth="1.5" />
      <path d="M-20 200 C 120 110,250 250,410 140 C 500 85,560 95,620 130" stroke={stroke} strokeWidth="1" />
      <path d="M-20 230 C 130 140,260 280,420 170 C 510 115,570 125,620 160" stroke={stroke} strokeWidth="1" />
    </svg>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.color
 * @param {any=} props.message
 */
export default function LockedPhasePanel({ color = 'blue', message }) {
  const s = STYLES[color] || STYLES.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className={`
        relative overflow-hidden rounded-2xl border ${s.border}
        bg-gradient-to-br ${s.bg} ${s.glow}
        min-h-[380px] flex flex-col
      `}
    >
      <FlowWaves stroke={s.stroke} />

      {/* Conector vertical chegando de cima */}
      <div className="relative z-10 flex justify-center pt-4">
        <VerticalConnector color={color === 'blue' ? 'blue' : 'green'} />
      </div>

      {/* Mensagem central */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
        <div className="flex flex-col items-center text-center gap-4 max-w-[260px]">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${s.iconBg} shadow-sm`}>
            <Lock className="h-5 w-5" />
          </div>
          <div className={`
            rounded-2xl border ${s.msgBorder} bg-white/70 backdrop-blur
            px-6 py-5 text-sm font-semibold leading-relaxed ${s.text} shadow-sm
          `}>
            {message || 'Conclua a etapa anterior para habilitar estes recursos'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}