/**
 * FalNarrativePanel.jsx
 * =========================================================================
 * Exibição da Narrativa Diagnóstica FAL.
 * Usa o motor narrativeEngine.js para interpretar o snapshot.
 * É apenas camada de apresentação — não altera dados nem metodologia.
 * =========================================================================
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateDiagnosticNarrative } from './narrativeEngine';
import {
  BookOpen, AlertTriangle, TrendingUp, Link2,
  Lightbulb, Compass, ChevronDown, ChevronUp
} from 'lucide-react';

const BLOCKS = [
  {
    key: 'visaoGeral',
    label: 'Visão Geral da Maturidade',
    icon: BookOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'fragilidades',
    label: 'Principais Fragilidades Estruturais',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  {
    key: 'pontosFOrtes',
    label: 'Principais Pontos Fortes',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    key: 'intersecoes',
    label: 'Interseções entre Mapas',
    icon: Link2,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  {
    key: 'implicacoes',
    label: 'Implicações Estratégicas',
    icon: Lightbulb,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    key: 'direcao',
    label: 'Direção Prioritária de Evolução',
    icon: Compass,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
];

/**
 * @param {Object} props
 * @param {any=} props.block
 * @param {any=} props.text
 */
function NarrativeBlock({ block, text }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = block.icon;

  // Suporta texto com bullet points (\n•)
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0);

  return (
    <div className={`rounded-xl border ${block.border} overflow-hidden`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-3 ${block.bg} hover:opacity-90 transition-opacity`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${block.color} flex-shrink-0`} />
          <span className={`text-sm font-semibold ${block.color}`}>{block.label}</span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-white">
          <div className="space-y-2">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={`text-sm text-slate-700 leading-relaxed ${p.startsWith('•') ? 'pl-2' : ''}`}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.snapshot
 * @param {any=} props.activeDimensions
 */
export default function FalNarrativePanel({ snapshot, activeDimensions }) {
  const narrative = generateDiagnosticNarrative(snapshot, activeDimensions);

  if (!narrative) return null;

  const LEVEL_STYLE = {
    'Crítico':     'bg-red-100 text-red-700 border-red-200',
    'Básico':      'bg-amber-100 text-amber-700 border-amber-200',
    'Estruturado': 'bg-blue-100 text-blue-700 border-blue-200',
    'Avançado':    'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Leitura Estrutural da Empresa
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${LEVEL_STYLE[narrative.metadata.overall_level] || 'bg-slate-100 text-slate-600'}`}>
              {narrative.metadata.overall_level} · {narrative.metadata.overall_score.toFixed(2)}
            </Badge>
            <span className="text-xs text-slate-400">
              {narrative.metadata.weak_dims_count} fragilidade(s) · {narrative.metadata.strong_dims_count} ponto(s) forte(s)
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Narrativa diagnóstica gerada automaticamente com base nos resultados do diagnóstico FAL. Interpretação consultiva para apoio à leitura com o cliente.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {BLOCKS.map(block => (
          <NarrativeBlock
            key={block.key}
            block={block}
            text={narrative[block.key] || ''}
          />
        ))}
      </CardContent>
    </Card>
  );
}