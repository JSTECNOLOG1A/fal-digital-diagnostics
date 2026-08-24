import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.question
 */
export default function QuestionCriticalityBadge({ question }) {
  if (question.is_killer_question) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
        <Zap className="w-3 h-3" /> KILLER
      </span>
    );
  }
  if (question.is_critical) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
        <AlertTriangle className="w-3 h-3" /> CRÍTICA
      </span>
    );
  }
  return null;
}