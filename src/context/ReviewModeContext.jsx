import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const ReviewModeContext = createContext(null);

export function ReviewModeProvider({ assessment_id, review_id, children }) {
  // APlanHeader.jsx já busca a revisão ao abri-la e leva o resultado via
  // router state — usar isso evita buscar de novo (antes, um `.get(review_id)`
  // genérico sem endpoint real caía num fallback local nunca populado e
  // sempre retornava "not found", desativando o modo revisão em silêncio).
  // Sem state (refresh/link direto), cai no `useQuery` abaixo, que agora
  // chama um endpoint de verdade.
  const location = useLocation();
  // `review_id &&` primeiro é essencial: sem review_id (rota normal, sem
  // revisão), `location.state?.review?.id === review_id` vira
  // `undefined === undefined` (true!) e cairia em `location.state.review`
  // com state null — TypeError real visto em produção agora.
  const reviewFromNav = review_id && location.state?.review?.id === review_id ? location.state.review : null;

  const { data: fetchedReview = null, isLoading: fetchLoading } = useQuery({
    queryKey: ['action-plan-review', review_id],
    queryFn: () => base44.entities.ActionPlanReview.get(review_id),
    enabled: !!review_id && !reviewFromNav,
  });

  const review = reviewFromNav || fetchedReview;
  const loading = !!review_id && !reviewFromNav && fetchLoading;

  // completeReview/cancelReview retornam a revisão já atualizada (status
  // não é mais 'draft') — guardada aqui pra refletir na hora, sem esperar
  // um refetch. exitReview só sai do modo revisão visualmente, sem alterar
  // a revisão em si (mesmo comportamento de antes).
  const [overrideReview, setOverrideReview] = useState(null);
  const [manuallyExited, setManuallyExited] = useState(false);
  useEffect(() => { setOverrideReview(null); setManuallyExited(false); }, [review_id]);
  const effectiveReview = overrideReview || review;
  const effectiveIsReviewMode = !manuallyExited && !!effectiveReview && effectiveReview.status === 'draft';

  const completeReview = async (closingSnapshot) => {
    if (!review_id) return null;
    try {
      const res = await base44.functions.invoke('completeActionPlanReview', {
        review_id,
        closing_snapshot: closingSnapshot,
      });
      const completedReview = res.data?.review || res.review || res.data || res;
      setOverrideReview(completedReview);
      return completedReview;
    } catch (err) {
      console.error('Erro ao concluir revisão:', err);
      throw err;
    }
  };

  const cancelReview = async () => {
    if (!review_id) return null;
    try {
      const res = await base44.functions.invoke('cancelActionPlanReview', {
        review_id,
      });
      const cancelledReview = res.data?.review || res.review || res.data || res;
      setOverrideReview(cancelledReview);
      return cancelledReview;
    } catch (err) {
      console.error('Erro ao cancelar revisão:', err);
      throw err;
    }
  };

  const exitReview = () => {
    // Apenas sai do modo de revisão, mas não altera o estado da revisão
    setManuallyExited(true);
  };

  return (
    <ReviewModeContext.Provider
      value={{
        isReviewMode: effectiveIsReviewMode,
        review_id: review_id || null,
        review: effectiveReview,
        loading,
        completeReview,
        cancelReview,
        exitReview,
      }}
    >
      {children}
    </ReviewModeContext.Provider>
  );
}

export function useReviewMode() {
  const ctx = useContext(ReviewModeContext);
  if (!ctx) {
    throw new Error('useReviewMode deve estar dentro de ReviewModeProvider');
  }
  return ctx;
}