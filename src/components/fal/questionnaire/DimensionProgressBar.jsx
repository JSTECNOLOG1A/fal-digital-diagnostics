import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { FAL_DIMENSION_LABELS } from '@/components/fal/falOfficialMatrix';

/**
 * @param {Object} props
 * @param {any=} props.dimGroups
 * @param {any=} props.answers
 * @param {any=} props.assessmentId
 * @param {any=} props.currentDim
 */
export default function DimensionProgressBar({ dimGroups, answers, assessmentId, currentDim }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5">
      {Object.entries(dimGroups).map(([dim, qs]) => {
        const answered = qs.filter(q => answers[q.id]?.score !== undefined).length;
        const flagged  = qs.filter(q => answers[q.id]?.flag).length;
        const complete = answered === qs.length;
        const active   = dim === currentDim;
        const pct      = qs.length > 0 ? Math.round((answered / qs.length) * 100) : 0;

        return (
          <Link key={dim} to={createPageUrl(`FalQuestionnaire?assessment_id=${assessmentId}&dimension=${dim}`)}>
            <div className={`relative px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer
              ${active
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : complete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400'
                  : answered > 0
                    ? 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-center gap-1.5">
                {complete && !active && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                {flagged > 0 && !active && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                <span>{FAL_DIMENSION_LABELS[dim] || dim}</span>
                <span className={`text-[10px] ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                  {answered}/{qs.length}
                </span>
              </div>
              {/* mini progress bar */}
              {!complete && answered > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 rounded-b-lg overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}