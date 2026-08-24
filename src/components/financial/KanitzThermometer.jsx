import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, TrendingDown } from "lucide-react";

const MIN_VALUE = -7;
const MAX_VALUE = 7;

function clamp(value, min = MIN_VALUE, max = MAX_VALUE) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  return Math.min(Math.max(Number(value), min), max);
}

export function getKanitzZone(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return {
      key: "empty",
      label: "Sem cálculo",
      shortLabel: "Indisponível",
      color: "#64748b",
      bgColor: "#f1f5f9",
      borderColor: "#cbd5e1",
      icon: AlertTriangle,
      description: "O fator de Kanitz ainda não foi calculado para este período.",
      recommendation: "Verifique se os indicadores necessários estão disponíveis."
    };
  }
  if (value >= 0) {
    return {
      key: "solvente",
      label: "Solvente",
      shortLabel: "Situação saudável",
      color: "#047857",
      bgColor: "#ecfdf5",
      borderColor: "#10b981",
      icon: ShieldCheck,
      description: "A empresa apresenta boa capacidade de pagamento e menor risco financeiro.",
      recommendation: "Manter acompanhamento periódico dos indicadores financeiros."
    };
  }
  if (value >= -3) {
    return {
      key: "penumbra",
      label: "Penumbra",
      shortLabel: "Zona de atenção",
      color: "#d97706",
      bgColor: "#fffbeb",
      borderColor: "#f59e0b",
      icon: AlertTriangle,
      description: "Existem sinais de fragilidade financeira que exigem acompanhamento.",
      recommendation: "Avaliar liquidez, endividamento, margem e geração de caixa."
    };
  }
  return {
    key: "insolvente",
    label: "Insolvente",
    shortLabel: "Risco de insolvência",
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#ef4444",
    icon: TrendingDown,
    description: "A empresa apresenta maior risco financeiro e dificuldade potencial de honrar compromissos.",
    recommendation: "Priorizar plano de ação financeiro, renegociação e recomposição de caixa."
  };
}

function valueToY(value) {
  const topY = 42;
  const bottomY = 338;
  const height = bottomY - topY;
  const normalized = (MAX_VALUE - value) / (MAX_VALUE - MIN_VALUE);
  return topY + normalized * height;
}

export function formatKanitzValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const number = Number(value);
  return number > 0 ? `+${number.toFixed(2)}` : number.toFixed(2);
}

/**
 * @param {Object} props
 * @param {any=} props.color
 * @param {any=} props.bgColor
 * @param {any=} props.title
 * @param {any=} props.range
 * @param {any=} props.description
 * @param {any=} props.icon
 */
function KanitzLegendItem({ color, bgColor, title, range, description, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: bgColor, color }}>
        
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold" style={{ color }}>{title}</span>
          <span className="text-xs text-slate-500">{range}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.title
 * @param {any=} props.subtitle
 * @param {any=} props.className
 * @param {any=} props.showInterpretation
 * @param {any=} props.compact
 * @param {any=} props.periodLabel
 */
export default function KanitzThermometer({
  value,
  title = "Termômetro de Kanitz",
  subtitle = "Indicador de solvência",
  className = "",
  showInterpretation = true,
  compact = false,
  periodLabel = null
}) {
  const safeValue = clamp(value);
  const zone = getKanitzZone(safeValue);
  const markerY = safeValue === null ? valueToY(0) : valueToY(safeValue);
  const ZoneIcon = zone.icon;

  const yPlus7 = valueToY(7);
  const yZero = valueToY(0);
  const yMinus3 = valueToY(-3);
  const yMinus7 = valueToY(-7);

  return (
    <div className={["w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className].join(" ")}>
      <div className="mb-4 flex flex-col items-center gap-1 text-center">
        <h3 className="text-lg font-bold text-slate-800">{compact ? periodLabel || title : title}</h3>
        
        {periodLabel && !compact &&
        <span className="mt-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden">
            {periodLabel}
          </span>
        }
        <div className="w-full border-t border-slate-100 mt-3" />
      </div>

      <div className={compact ? "flex justify-center" : "grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]"}>
        {/* Termômetro SVG */}
        <div className="relative flex justify-center">
          <svg
            viewBox="0 0 360 420"
            className="h-[400px] w-full max-w-[300px]"
            role="img"
            aria-label={`Termômetro de Kanitz com valor ${formatKanitzValue(safeValue)}`}>
            
            <defs>
              <linearGradient id="kanitzGreen" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#047857" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="kanitzYellow" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="kanitzRed" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#b91c1c" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* Ticks principais */}
            <line x1="76" y1={yPlus7} x2="112" y2={yPlus7} stroke="#0f172a" strokeWidth="2" />
            <line x1="76" y1={yZero} x2="112" y2={yZero} stroke="#0f172a" strokeWidth="2" />
            <line x1="76" y1={yMinus3} x2="112" y2={yMinus3} stroke="#0f172a" strokeWidth="2" />
            <line x1="76" y1={yMinus7} x2="112" y2={yMinus7} stroke="#0f172a" strokeWidth="2" />

            {/* Ticks menores */}
            {Array.from({ length: 15 }).map((_, index) => {
              const tickValue = 7 - index;
              const y = valueToY(tickValue);
              if ([7, 0, -3, -7].includes(tickValue)) return null;
              return (
                <line
                  key={tickValue}
                  x1="96"
                  y1={y}
                  x2={tickValue % 2 === 0 ? "112" : "106"}
                  y2={y}
                  stroke="#94a3b8"
                  strokeWidth="1.5" />);


            })}

            {/* Labels escala */}
            <text x="42" y={yPlus7 + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#047857">+7</text>
            <text x="42" y={yZero + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">0</text>
            <text x="42" y={yMinus3 + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#d97706">-3</text>
            <text x="42" y={yMinus7 + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#dc2626">-7</text>

            {/* Corpo externo */}
            <path
              d="M 162 42 Q 162 20 184 20 L 214 20 Q 236 20 236 42 L 236 322 Q 260 342 260 372 Q 260 404 199 404 Q 138 404 138 372 Q 138 342 162 322 Z"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="5"
              filter="url(#softShadow)" />
            

            <clipPath id="tubeClip">
              <path d="M 176 46 Q 176 34 188 34 L 210 34 Q 222 34 222 46 L 222 330 Q 246 348 246 374 Q 246 392 199 392 Q 152 392 152 374 Q 152 348 176 330 Z" />
            </clipPath>

            <g clipPath="url(#tubeClip)">
              {/* Zonas de diagnóstico — cores evidentes como fundo do termômetro */}
              <rect x="152" y={yPlus7} width="94" height={yZero - yPlus7} fill="url(#kanitzGreen)" opacity="0.6" />
              <rect x="152" y={yZero} width="94" height={yMinus3 - yZero} fill="url(#kanitzYellow)" opacity="0.6" />
              <rect x="152" y={yMinus3} width="94" height={yMinus7 - yMinus3 + 70} fill="url(#kanitzRed)" opacity="0.6" />

              {/* Líquido de vidro — translúcido, clareia a zona sem esconder a cor de diagnóstico */}
              {safeValue !== null &&
              <motion.rect
                x="152"
                width="94"
                initial={{ y: 392, height: 0 }}
                animate={{ y: markerY, height: 392 - markerY }}
                transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
                fill="rgba(255,255,255,0.42)" />

              }

              {/* Superfície do líquido — onda com reflexo branco brilhante */}
              {safeValue !== null &&
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, -2, 0] }}
                transition={{
                  opacity: { duration: 1.3, ease: "easeOut" },
                  y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                }}>
                
                  <motion.path
                  initial={{ d: `M 152 392 Q 175 388.5 199 392 T 246 392 L 246 398 Q 223 394.5 199 398 T 152 398 Z` }}
                  animate={{ d: `M 152 ${markerY} Q 175 ${markerY - 3.5} 199 ${markerY} T 246 ${markerY} L 246 ${markerY + 6} Q 223 ${markerY + 2.5} 199 ${markerY + 6} T 152 ${markerY + 6} Z` }}
                  transition={{ d: { duration: 1.3, ease: [0.22, 1, 0.36, 1] } }}
                  fill="rgba(255,255,255,0.85)"
                  stroke="#ffffff"
                  strokeWidth="1.5" />
                
                </motion.g>
              }
            </g>

            {/* Separadores brancos */}
            <line x1="154" y1={yZero} x2="244" y2={yZero} stroke="#ffffff" strokeWidth="4" />
            <line x1="154" y1={yMinus3} x2="244" y2={yMinus3} stroke="#ffffff" strokeWidth="4" />

            {/* Brilho */}
            <path d="M 184 48 Q 184 38 194 38" stroke="rgba(255,255,255,0.55)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <ellipse cx="181" cy="374" rx="10" ry="18" transform="rotate(35 181 374)" fill="rgba(255,255,255,0.4)" />

            {/* Marcador móvel */}
            {safeValue !== null &&
            <g
              style={{
                transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                transform: `translateY(${markerY - yZero}px)`
              }}>
              
                <line x1="256" y1={yZero} x2="315" y2={yZero} stroke={zone.color} strokeWidth="3" strokeLinecap="round" />
                <circle cx="323" cy={yZero} r="22" fill={zone.bgColor} stroke={zone.color} strokeWidth="3" />
                <text x="323" y={yZero + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill={zone.color}>
                  {formatKanitzValue(safeValue)}
                </text>
              </g>
            }
          </svg>
        </div>

        {/* Interpretação */}
        {!compact &&
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: zone.bgColor, borderColor: zone.borderColor }}>
            
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#ffffff", color: zone.color }}>
                
                <ZoneIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold" style={{ color: zone.color }}>
                    {zone.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                    Fator {formatKanitzValue(safeValue)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{zone.shortLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{zone.description}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <strong>Direcionamento:</strong> {zone.recommendation}
                </p>
              </div>
            </div>
          </div>

          {showInterpretation &&
          <div className="flex flex-col gap-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Interpretação das Zonas
              </div>
              <KanitzLegendItem
              color="#047857"
              bgColor="#ecfdf5"
              title="Solvente"
              range="de 0 a +7"
              description="Situação financeira saudável, com maior capacidade de pagamento."
              icon={ShieldCheck} />
            
              <KanitzLegendItem
              color="#d97706"
              bgColor="#fffbeb"
              title="Penumbra"
              range="de 0 a -3"
              description="Zona intermediária, exigindo atenção aos indicadores financeiros."
              icon={AlertTriangle} />
            
              <KanitzLegendItem
              color="#dc2626"
              bgColor="#fef2f2"
              title="Insolvente"
              range="abaixo de -3"
              description="Maior risco financeiro e necessidade de medidas corretivas."
              icon={TrendingDown} />
            
            </div>
          }

          {/* Footer disclaimer */}
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <span className="text-emerald-600 text-sm font-bold">i</span>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              O Termômetro de Kanitz varia de -7 a +7, onde valores maiores indicam maior solvência e menores valores indicam maior risco financeiro.
            </p>
          </div>
        </div>
        }
      </div>
    </div>);

}