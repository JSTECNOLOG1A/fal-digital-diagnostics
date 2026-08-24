import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.dimensions
 * @param {any=} props.methodVersionId
 * @param {any=} props.tenantId
 */
export default function DimensionProgress({ assessmentId, dimensions, methodVersionId, tenantId }) {
  const { data: questions = [] } = useQuery({
    queryKey: ['questions', methodVersionId],
    queryFn: () => base44.entities.Question.filter({ method_version_id: methodVersionId }),
    enabled: !!methodVersionId,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['responses', assessmentId],
    queryFn: () => base44.entities.Response.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Dimensões IFME™ — Progresso do Questionário</h3>
      {dimensions.map(dim => {
        const dimQ = questions.filter(q => q.dimension_key === dim.key);
        const dimR = responses.filter(r => r.dimension_key === dim.key);
        const pct = dimQ.length > 0 ? Math.round((dimR.length / dimQ.length) * 100) : 0;
        const complete = dimQ.length > 0 && dimR.length >= dimQ.length;

        return (
          <Link key={dim.key} to={createPageUrl(`DimensionQuestionnaire?assessment_id=${assessmentId}&dimension=${dim.key}`)}>
            <Card className={`border-0 shadow-sm fal-card-hover cursor-pointer ${complete ? 'ring-1 ring-emerald-200' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-900">{dim.name}</p>
                    <span className="text-xs text-slate-400">{dimR.length}/{dimQ.length}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[10px] text-slate-400 mt-1">Peso global: {(dim.global_weight * 100).toFixed(0)}%</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}