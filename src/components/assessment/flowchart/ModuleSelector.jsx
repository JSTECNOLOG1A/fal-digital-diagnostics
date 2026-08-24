import React from 'react';
import { ClipboardList, Network } from 'lucide-react';
import { motion } from 'framer-motion';

const MODULES = [
  { key: 'questionario', label: 'Questionário', icon: ClipboardList },
  { key: 'mqe',          label: 'MQE™',         icon: Network },
];

/**
 * @param {Object} props
 * @param {any=} props.mod
 * @param {any=} props.active
 * @param {any=} props.onClick
 */
function ModuleButton({ mod, active, onClick }) {
  const Icon = mod.icon;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group flex flex-col items-center gap-2 focus:outline-none"
    >
      <div className={`
        flex items-center justify-center rounded-full border-2 bg-white
        transition-all duration-300
        w-14 h-14 sm:w-16 sm:h-16
        ${active
          ? 'border-blue-400 text-blue-600 shadow-[0_0_0_8px_rgba(37,99,235,0.08),0_10px_28px_rgba(37,99,235,0.22)]'
          : 'border-slate-300 text-slate-400 shadow-sm hover:border-blue-200 hover:text-blue-500 hover:shadow-md'
        }
      `}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 group-hover:scale-110" />
      </div>
      <span className={`text-xs sm:text-sm font-semibold transition-colors text-center leading-tight ${active ? 'text-blue-600' : 'text-slate-500 group-hover:text-blue-600'}`}>
        {mod.label}
      </span>
    </motion.button>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.activeModule
 * @param {any=} props.onChange
 */
export default function ModuleSelector({ activeModule, onChange }) {
  const count = MODULES.length;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full" style={{ paddingTop: 32 }}>

        {/* Barra horizontal — de centro a centro do primeiro ao último ícone */}
        <div
          className="absolute"
          style={{
            top: 0,
            left: `calc(${100 / (2 * count)}%)`,
            right: `calc(${100 / (2 * count)}%)`,
            height: 1,
            background: '#bfdbfe',
          }}
        />

        {/* Ponto de bifurcação no centro */}
        <div
          className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-200"
          style={{ top: -4 }}
        />

        {/* Linhas verticais de cada ícone */}
        {MODULES.map((_, i) => {
          const pct = (100 / count) * i + (100 / count) / 2;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `calc(${pct}% - 0.5px)`,
                top: 0,
                height: 32,
                width: 1,
                background: '#bfdbfe',
              }}
            />
          );
        })}

        {/* Botões distribuídos uniformemente */}
        <div className="flex items-start justify-around w-full">
          {MODULES.map(mod => (
            <ModuleButton
              key={mod.key}
              mod={mod}
              active={activeModule === mod.key}
              onClick={() => onChange(mod.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}