/**
 * SystemicFindingsPanel.jsx
 * Exibe achados sistêmicos retornados pelo runFullDiagnostic (system_findings).
 * Cada achado mostra título, descrição, clusters envolvidos e impacto.
 */
import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Network } from 'lucide-react';

function formatKey(key = '') {
  return key.replace(/_cluster$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SEVERITY_STYLES = {
  critical: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    label: 'Fragilidade Crítica',
  },
  high: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700',
    label: 'Fragilidade Alta',
  },
};

/**
 * @param {Object} props
 * @param {any=} props.finding
 */
function FindingCard({ finding }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.high;

  return (
    <div className={`rounded-xl border ${style.border} overflow-hidden`}>
      {/* Header */}
      <button
        className={`w-full flex items-start gap-3 p-4 ${style.bg} text-left hover:brightness-95 transition-all`}
        onClick={() => setExpanded(v => !v)}
      >
        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-[10px] text-slate-500">
              {finding.weak_count}/{finding.total_evaluated ?? finding.clusters_involved?.length} processos críticos
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-1">{finding.title}</p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Body expandido */}
      {expanded && (
        <div className="p-4 space-y-3 bg-white">
          {/* Descrição */}
          <p className="text-xs text-slate-700 leading-relaxed">{finding.description}</p>

          {/* Clusters envolvidos */}
          {finding.clusters_involved?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Network className="w-3 h-3 text-slate-400" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Clusters do Ciclo</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {finding.clusters_involved.map(ck => {
                  const isWeak = finding.weak_clusters?.includes(ck);
                  return (
                    <span
                      key={ck}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        isWeak
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {formatKey(ck)}
                      {isWeak && ' ⚠'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Impacto */}
          {finding.impact && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Impacto no Negócio</p>
              <p className="text-xs text-amber-800 leading-relaxed">{finding.impact}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.findings
 */
export default function SystemicFindingsPanel({ findings = [] }) {
  if (!findings || findings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-indigo-600" />
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Achados Sistêmicos</p>
        <span className="text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-semibold">
          {findings.length}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Ciclos de negócio onde múltiplos processos interdependentes apresentam fragilidades simultâneas.
      </p>
      <div className="space-y-2">
        {findings.map(f => (
          <FindingCard key={f.finding_key || f.cycle_key} finding={f} />
        ))}
      </div>
    </div>
  );
}