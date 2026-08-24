import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ReviewModeContext = createContext(null);

export function ReviewModeProvider({ assessment_id, review_id, children }) {
  const [isReviewMode, setIsReviewMode] = useState(!!review_id);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(!!review_id);

  useEffect(() => {
    if (!review_id) {
      setLoading(false);
      setReview(null);
      setIsReviewMode(false);
      return;
    }

    const loadReview = async () => {
      try {
        const reviewData = await base44.entities.ActionPlanReview.get(review_id);
        setReview(reviewData);
        // Só ativa modo revisão se a revisão estiver em draft
        if (reviewData.status === 'draft') {
          setIsReviewMode(true);
        } else {
          setIsReviewMode(false);
        }
      } catch (err) {
        console.error('Erro ao carregar revisão:', err);
        setIsReviewMode(false);
        setReview(null);
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [review_id]);

  const completeReview = async (closingSnapshot) => {
    if (!review_id) return null;
    try {
      const res = await base44.functions.invoke('completeActionPlanReview', {
        review_id,
        closing_snapshot: closingSnapshot,
      });
      const completedReview = res.data?.review || res.review || res.data || res;
      setReview(completedReview);
      setIsReviewMode(false);
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
      setReview(cancelledReview);
      setIsReviewMode(false);
      return cancelledReview;
    } catch (err) {
      console.error('Erro ao cancelar revisão:', err);
      throw err;
    }
  };

  const exitReview = () => {
    // Apenas sai do modo de revisão, mas não altera o estado da revisão
    setIsReviewMode(false);
  };

  return (
    <ReviewModeContext.Provider
      value={{
        isReviewMode,
        review_id: review_id || null,
        review,
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