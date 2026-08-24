export function calculateJournalPresentationEffect({ rubric, side, amount }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('ELIMINATION_AMOUNT_INVALID');
  if (!['debit', 'credit'].includes(side)) throw new Error('ELIMINATION_SIDE_INVALID');
  const factor = side === 'debit' ? rubric?.debit_presentation_effect : rubric?.credit_presentation_effect;
  if (!Number.isFinite(factor)) throw new Error('ELIMINATION_JOURNAL_EFFECT_UNDEFINED');
  return numericAmount * factor;
}

export function applyJournalEntries(gross, entries, rubrics) {
  const result = { ...gross };
  for (const entry of entries) {
    const debit = entry.debit_canonical_key;
    const credit = entry.credit_canonical_key;
    result[debit] = (result[debit] || 0) + calculateJournalPresentationEffect({ rubric: rubrics[debit], side: 'debit', amount: entry.amount });
    result[credit] = (result[credit] || 0) + calculateJournalPresentationEffect({ rubric: rubrics[credit], side: 'credit', amount: entry.amount });
  }
  return result;
}