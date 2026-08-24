import React from 'react';

const labels = { tenant: 'Confirmar ambiente', group: 'Criar grupo', company: 'Criar primeira empresa', unit: 'Criar unidade', diagnostic: 'Iniciar diagnóstico' };

export default function OnboardingChecklist({ completedSteps = [], currentStep }) {
  return <ol className="space-y-3">{Object.entries(labels).map(([key, label]) => <li key={key} className="flex items-center gap-3 text-sm"><span className="w-6 h-6 rounded-full flex items-center justify-center font-semibold" style={{ background: completedSteps.includes(key) ? 'var(--fal-success-bg)' : 'var(--fal-neutral-bg)', color: completedSteps.includes(key) ? 'var(--fal-success-text)' : 'var(--fal-text-muted)' }}>{completedSteps.includes(key) ? '✓' : '•'}</span><span className={currentStep === key ? 'font-semibold' : ''}>{label}</span></li>)}</ol>;
}