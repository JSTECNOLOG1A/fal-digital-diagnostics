/**
 * DiagnosticLinkPanelWrapper
 * Migrado para useGroupAssessment — fonte única de assessment do grupo.
 * Renderiza DiagnosticLinkPanel condicionalmente ao assessment principal.
 */
import React from 'react';
import { useGroupAssessment } from '@/lib/hooks/useGroupAssessment';
import DiagnosticLinkPanel from './DiagnosticLinkPanel';

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.user
 */
export default function DiagnosticLinkPanelWrapper({ groupId, tenantId, user }) {
  const { assessment } = useGroupAssessment(groupId, tenantId);

  if (!assessment) return null;

  return (
    <DiagnosticLinkPanel
      groupId={groupId}
      tenantId={tenantId}
      falAssessmentId={assessment.id}
      user={user}
    />
  );
}