import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useReviewMode } from '@/context/ReviewModeContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * @param {Object} props
 * @param {any=} props.assessment_id
 * @param {any=} props.plan_id
 */
export default function ReviewModeBanner({ assessment_id, plan_id }) {
  const navigate = useNavigate();
  const { review, completeReview, cancelReview, exitReview } = useReviewMode();
  const [completing, setCompleting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  if (!review) return null;

  const handleExit = () => {
    exitReview();
    navigate(`/assessment/${assessment_id}/action-plan`);
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      // A função completeActionPlanReview vai gerar o closing_snapshot
      await completeReview();
      navigate(`/assessment/${assessment_id}/action-plan`);
    } catch (err) {
      console.error('Erro ao concluir revisão:', err);
      alert('Erro ao concluir a revisão. Tente novamente.');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar esta revisão? O histórico será preservado.')) {
      return;
    }
    setCancelling(true);
    try {
      await cancelReview();
      navigate(`/assessment/${assessment_id}/action-plan`);
    } catch (err) {
      console.error('Erro ao cancelar revisão:', err);
      alert('Erro ao cancelar a revisão. Tente novamente.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-indigo-600 text-white px-6 py-4 border-b border-indigo-700 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 flex-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Modo Revisão Ativo</p>
            <p className="text-xs text-indigo-100 mt-1">
              Revisão: <strong>R{review.review_number}</strong> • Data: <strong>{new Date(review.review_date).toLocaleDateString('pt-BR')}</strong> • 
              Consultor: <strong>{review.consultant_name || 'Não atribuído'}</strong>
            </p>
            <p className="text-xs text-indigo-100 mt-0.5">
              Todas as alterações serão registradas nesta revisão.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExit}
            disabled={completing || cancelling}
            className="bg-indigo-500 hover:bg-indigo-700 text-white border-indigo-400"
          >
            Sair da Revisão
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={completing || cancelling}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {completing ? 'Concluindo...' : 'Concluir Revisão'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={completing || cancelling}
            className="bg-red-600 hover:bg-red-700 text-white border-red-400"
          >
            {cancelling ? 'Cancelando...' : 'Cancelar Revisão'}
          </Button>
        </div>
      </div>
    </div>
  );
}