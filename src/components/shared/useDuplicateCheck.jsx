import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Similarity score between two strings (0-1) using Levenshtein-based approach.
 */
function similarity(a, b) {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = Array.from({ length: len2 + 1 }, (_, i) =>
    Array.from({ length: len1 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len2][len1] / maxLen;
}

/**
 * Hook to check for duplicate or similar names in an entity collection.
 *
 * @param {string} value - Current input value to check
 * @param {string} entityName - e.g. 'Group', 'Company', 'OperationalUnit'
 * @param {object} filterQuery - e.g. { tenant_id: '...', company_id: '...' }
 * @param {number} [debounceMs=400]
 * @returns {{ exact: object|null, similar: object[], checking: boolean }}
 */
export function useDuplicateCheck(value, entityName, filterQuery, debounceMs = 400) {
  const [result, setResult] = useState({ exact: null, similar: [], checking: false });

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setResult({ exact: null, similar: [], checking: false });
      return;
    }

    setResult(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const records = await base44.entities[entityName].filter(filterQuery, 'name', 500);
        const trimmed = value.trim();
        let exact = null;
        const similar = [];

        for (const r of records) {
          const score = similarity(trimmed, r.name || '');
          if (score === 1) {
            exact = r;
            break;
          } else if (score >= 0.75) {
            similar.push({ record: r, score });
          }
        }

        // Sort similar by descending score
        similar.sort((a, b) => b.score - a.score);
        setResult({ exact, similar: similar.slice(0, 3), checking: false });
      } catch {
        setResult({ exact: null, similar: [], checking: false });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, entityName, JSON.stringify(filterQuery)]);

  return result;
}