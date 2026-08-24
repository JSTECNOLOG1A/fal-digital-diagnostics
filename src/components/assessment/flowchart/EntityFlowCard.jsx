import React from 'react';
import { Layers, Building2, MapPin, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ENTITY_ICONS = {
  group:   Layers,
  company: Building2,
  unit:    MapPin,
};

const ENTITY_LABELS = {
  group:   'Grupo',
  company: 'Empresa',
  unit:    'Unidade',
};

/**
 * @param {Object} props
 * @param {any=} props.value
 */
function ProgressRing({ value }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
        <circle
          cx="24" cy="24" r={radius}
          stroke="currentColor" strokeWidth="4" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={value > 0 ? 'text-blue-500 transition-all duration-700' : 'text-slate-200'}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
        {value}%
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.entity
 * @param {any=} props.answered
 * @param {any=} props.total
 * @param {any=} props.dimCount
 * @param {any=} props.selected
 * @param {any=} props.index
 * @param {any=} props.onClick
 */
export default function EntityFlowCard({ entity, answered, total, dimCount, selected, index, onClick }) {
  const Icon = ENTITY_ICONS[entity.entity_type] || Building2;
  const typeLabel = ENTITY_LABELS[entity.entity_type] || 'Entidade';
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const remaining = total - answered;
  const statusLabel = total === 0 ? 'Não iniciada' : answered >= total ? 'Concluída' : answered > 0 ? 'Em andamento' : 'Não iniciada';

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`
        group relative w-full rounded-2xl border bg-white p-4 text-left shadow-sm
        transition-all duration-250
        hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]
        ${selected
          ? 'border-blue-300 ring-4 ring-blue-50 shadow-[0_12px_30px_rgba(37,99,235,0.13)]'
          : 'border-slate-200 hover:border-slate-300'
        }
      `}
    >
      {/* Nó lateral do fluxograma */}
      <span className={`
        absolute left-[-20px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 bg-white
        transition-all duration-200
        ${selected ? 'border-blue-500 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]' : 'border-blue-300'}
      `} />

      <div className="flex items-center gap-3">
        {/* Ícone tipo */}
        <div className={`
          flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
          transition-transform duration-300 group-hover:scale-105
          ${selected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}
        `}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-bold truncate ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
              {entity.entity_name}
            </h4>
            {selected && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 shrink-0">
                Selecionada
              </span>
            )}
          </div>

          <p className="mt-0.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">{typeLabel}</span>
            {' · '}
            {statusLabel}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {dimCount > 0 && <span>{dimCount} dim.</span>}
            {total > 0 && <span>{answered}/{total} perguntas</span>}
            {total > 0 && remaining > 0 && (
              <span className="font-semibold text-amber-600">{remaining} restantes</span>
            )}
            {total > 0 && remaining === 0 && (
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Concluída
              </span>
            )}
          </div>

          {total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <ProgressRing value={pct} />
      </div>
    </motion.button>
  );
}