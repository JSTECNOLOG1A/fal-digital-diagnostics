import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all questions in batches
  const allQuestions = [];
  let skip = 0;
  const batchSize = 200;
  while (true) {
    const batch = await base44.asServiceRole.entities.FalQuestion.list(null, batchSize, skip);
    if (!batch || batch.length === 0) break;
    allQuestions.push(...batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  const headers = [
    'id',
    'code',
    'dimension_key',
    'subdimension_key',
    'cluster_key',
    'text',
    'diagnostic_depth',
    'level_applicability',
    'generation',
    'active',
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = Array.isArray(val) ? val.join(';') : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = allQuestions.map(q => {
    return headers.map(h => {
      if (h === 'text') return escape(q.question_text);
      return escape(q[h]);
    }).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fal_questions_full_export.csv"',
    },
  });
});