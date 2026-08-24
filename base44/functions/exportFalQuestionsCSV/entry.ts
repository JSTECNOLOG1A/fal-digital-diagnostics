import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questions = await base44.entities.FalQuestion.list();
    
    // Sort by dimension, subdimension, sequence
    questions.sort((a, b) => {
      if (a.dimension_key !== b.dimension_key) return a.dimension_key.localeCompare(b.dimension_key);
      if (a.subdimension_key !== b.subdimension_key) return a.subdimension_key.localeCompare(b.subdimension_key);
      return a.sequence_order - b.sequence_order;
    });

    // Build CSV
    const headers = [
      'question_id',
      'dimension_key',
      'subdimension_key',
      'cluster_key',
      'question_text',
      'process_stage',
      'sequence_order',
      'diagnostic_depth',
      'level_applicability',
      'question_weight',
      'is_critical',
      'is_killer_question'
    ];

    const rows = questions.map(q => [
      q.question_id || '',
      q.dimension_key || '',
      q.subdimension_key || '',
      q.cluster_key || '',
      `"${(q.question_text || '').replace(/"/g, '""')}"`,
      q.process_stage || '',
      q.sequence_order || '',
      (q.diagnostic_depth || []).join(';'),
      (q.level_applicability || []).join(';'),
      q.question_weight || '1.0',
      q.is_critical ? 'true' : 'false',
      q.is_killer_question ? 'true' : 'false'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=fal_questions.csv'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});