import React from 'react';
import { useReviewMode } from '@/context/ReviewModeContext';

/**
 * Marca d'água "EM REVISÃO" sobreposta ao conteúdo.
 * Usar dentro dos containers de abas (Kanban, Lista Executiva).
 */
export default function ReviewModeOverlay() {
  const { isReviewMode } = useReviewMode();

  if (!isReviewMode) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-10">
      <div className="text-center">
        <p className="text-9xl font-black text-slate-900 whitespace-nowrap">EM REVISÃO</p>
      </div>
    </div>
  );
}