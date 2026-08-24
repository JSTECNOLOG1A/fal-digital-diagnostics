import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist';
import OnboardingStepForm from '@/components/onboarding/OnboardingStepForm';
import { onboardingDestination, onboardingOperations } from '@/lib/phase5/onboardingWorkflow';

export default function OnboardingPage() {
  const { tenantId, isClient } = useTenant(); const navigate = useNavigate();
  const [progress, setProgress] = useState(null); const [assessmentId, setAssessmentId] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = async () => { setError(''); try { const response = await base44.functions.invoke('manageTenantOnboarding', { tenant_id: tenantId, operation: 'get' }); setProgress(response.data.onboarding); setAssessmentId(response.data.assessment_id); } catch (err) { setError(err?.response?.data?.error || 'Não foi possível carregar o onboarding.'); } };
  useEffect(() => { if (tenantId && !isClient) load(); }, [tenantId, isClient]);
  const submit = async (values) => { setBusy(true); setError(''); try { const response = await base44.functions.invoke('manageTenantOnboarding', { tenant_id: tenantId, operation: onboardingOperations[progress.current_step], payload: values }); setProgress(response.data.onboarding); setAssessmentId(response.data.assessment_id || assessmentId); } catch (err) { setError(err?.response?.data?.error || 'Não foi possível salvar esta etapa. Tente novamente.'); } finally { setBusy(false); } };
  const skipUnit = async () => { setBusy(true); try { const response = await base44.functions.invoke('manageTenantOnboarding', { tenant_id: tenantId, operation: 'skip_unit' }); setProgress(response.data.onboarding); } catch (err) { setError(err?.response?.data?.error || 'Não foi possível avançar.'); } finally { setBusy(false); } };
  if (isClient) return <main className="p-8"><h1 className="fal-title text-xl">Acesso negado</h1><p className="fal-muted">Seu perfil não pode configurar a estrutura.</p></main>;
  if (error && !progress) return <main className="p-8"><p className="text-sm" style={{ color: 'var(--fal-danger-text)' }}>{error}</p><button className="fal-btn-secondary mt-4" onClick={load}>Tentar novamente</button></main>;
  if (!progress) return <main className="p-8">Carregando onboarding...</main>;
  const destination = onboardingDestination(progress, assessmentId);
  if (destination) { navigate(destination, { replace: true }); return null; }
  const formStep = progress.current_step === 'tenant' ? 'group' : progress.current_step;
  return <main className="max-w-3xl mx-auto p-6 grid gap-8 md:grid-cols-[1fr_1.4fr]"><aside className="fal-card p-5"><h1 className="fal-title text-xl mb-2">Primeiros passos</h1><p className="fal-muted text-sm mb-6">Configure a primeira estrutura e crie o diagnóstico inicial.</p><OnboardingChecklist completedSteps={progress.completed_steps} currentStep={progress.current_step} /></aside><section className="fal-card p-5"><h2 className="fal-title text-lg mb-1">{formStep === 'group' ? 'Crie o primeiro grupo' : formStep === 'company' ? 'Cadastre a primeira empresa' : formStep === 'unit' ? 'Cadastre uma unidade' : 'Crie o diagnóstico inicial'}</h2><p className="fal-muted text-sm mb-5">Você pode continuar depois; os registros existentes são selecionados automaticamente.</p><OnboardingStepForm step={formStep} onSubmit={submit} onSkip={skipUnit} busy={busy} />{error && <div className="mt-3"><p className="text-sm" style={{ color: 'var(--fal-danger-text)' }}>{error}</p><button className="text-sm underline mt-1" onClick={load}>Tentar novamente</button></div>}</section></main>;
}