/**
 * replaceFinancialSourcePeriod — v3 (RESIDUAL 2)
 *
 * F2-PER-01: Replacement sem destruir o estado anterior.
 *   - 3: Corrigir ordem run×snapshot: processamento concluído → marcar run succeeded
 *     com snapshot_pending=true → criar/reutilizar snapshot → validar snapshot_id →
 *     atualizar result_summary.snapshot_id → snapshot_pending=false.
 *   - 7: Soft supersession — não realizar delete físico dos outputs antigos durante
 *     a transação. Marcar conjunto antigo como superseded (is_current=false no upload,
 *     outputs antigos permanecem para reversibilidade).
 *   - Se snapshot falhar: run.status=partial_failed, success=false.
 *   - snapshot_id não pode ser nulo em operação concluída.
 *
 * Payload: { financial_diagnosis_id, current_upload_id, new_upload_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
const normalizePeriod = (p) => p ? String(p).replace(/[^0-9-]/g, '').slice(0, 7) : null;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const { financial_diagnosis_id, current_upload_id, new_upload_id, failure_point = null } = await req.json();
    if (!financial_diagnosis_id || !current_upload_id || !new_upload_id) {
      return Response.json({ error: 'financial_diagnosis_id, current_upload_id e new_upload_id são obrigatórios' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── Phase 1: Preflight ──
    const currentUpload = await base44.asServiceRole.entities.FinancialUpload.get(current_upload_id);
    if (!currentUpload) return Response.json({ error: 'Upload atual não encontrado' }, { status: 404 });
    if (currentUpload.financial_diagnosis_id !== financial_diagnosis_id) {
      return Response.json({ error: 'Upload atual não pertence a este diagnóstico' }, { status: 400 });
    }
    if (currentUpload.is_current === false) {
      return Response.json({ error: 'Upload atual não está ativo (is_current=false)' }, { status: 400 });
    }

    const newUpload = await base44.asServiceRole.entities.FinancialUpload.get(new_upload_id);
    if (!newUpload) return Response.json({ error: 'Novo upload não encontrado' }, { status: 404 });
    if (newUpload.financial_diagnosis_id !== financial_diagnosis_id) {
      return Response.json({ error: 'Novo upload não pertence a este diagnóstico' }, { status: 400 });
    }
    if (newUpload.is_current === true) {
      return Response.json({ error: 'Novo upload já está ativo (is_current=true)' }, { status: 400 });
    }

    if (currentUpload.source_entity_id !== newUpload.source_entity_id) {
      return Response.json({ error: 'Entidade-fonte diferente entre uploads' }, { status: 400 });
    }
    if (normalizePeriod(currentUpload.source_period) !== normalizePeriod(newUpload.source_period)) {
      return Response.json({ error: 'Período-fonte diferente entre uploads' }, { status: 400 });
    }

    // ── Estado inicial para compensação ──
    const originalState = {
      diagnosis: {
        current_upload_id: diagnosis.current_upload_id || null,
        current_processing_snapshot_id: diagnosis.current_processing_snapshot_id || null,
        integrity_status: diagnosis.integrity_status || 'unknown',
        integrity_blocking_count: diagnosis.integrity_blocking_count || 0,
        integrity_warning_count: diagnosis.integrity_warning_count || 0,
        integrity_checked_at: diagnosis.integrity_checked_at || null,
      },
      current: {
        is_current: currentUpload.is_current !== false,
        superseded_by_upload_id: currentUpload.superseded_by_upload_id || null,
        superseded_at: currentUpload.superseded_at || null,
      },
      next: {
        is_current: newUpload.is_current === true,
        replacement_status: newUpload.replacement_status || 'none',
        upload_status: newUpload.upload_status,
        supersedes_upload_id: newUpload.supersedes_upload_id || null,
      },
    };

    // ── Phase 2: Create processing run (idempotência) ──
    const operationKey = `${diagnosis.tenant_id}|${financial_diagnosis_id}|${new_upload_id}|replace_source|${newUpload.source_entity_id || ''}|${normalizePeriod(newUpload.source_period) || ''}|${newUpload.input_checksum || ''}`;
    const now = new Date().toISOString();

    let existingRuns;
    try {
      existingRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
        { operation_key: operationKey, status: { $in: ['running', 'committing', 'succeeded'] } }, 'id', 10
      );
    } catch (error) {
      return Response.json({
        success: false, error: 'PROCESSING_RUN_LOOKUP_UNAVAILABLE', detail: error.message,
        concurrency_guarantee: 'best_effort', atomicity_verified: false, mutation_executed: false,
      }, { status: 503 });
    }
    if (existingRuns.length > 0) {
      const existingRun = existingRuns[0];
      if (['running', 'committing'].includes(existingRun.status)) {
        return Response.json({ success: false, in_progress: true, reused: true, run_id: existingRun.id, status: existingRun.status, concurrency_guarantee: 'best_effort', atomicity_verified: false });
      }
      const summary = existingRun.result_summary || {};
      const [snapshot, persistedDiagnosis, persistedOld, persistedNew] = await Promise.all([
        summary.snapshot_id ? base44.asServiceRole.entities.FinancialProcessingSnapshot.get(summary.snapshot_id) : Promise.resolve(null),
        base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id),
        summary.old_upload_id ? base44.asServiceRole.entities.FinancialUpload.get(summary.old_upload_id) : Promise.resolve(null),
        summary.new_upload_id ? base44.asServiceRole.entities.FinancialUpload.get(summary.new_upload_id) : Promise.resolve(null),
      ]);
      const completed = summary.snapshot_pending === false && Boolean(summary.snapshot_id) && snapshot?.status === 'active' && snapshot.financial_processing_run_id === existingRun.id && persistedDiagnosis?.current_processing_snapshot_id === summary.snapshot_id && persistedDiagnosis?.current_upload_id === summary.new_upload_id && persistedOld?.is_current === false && persistedNew?.is_current === true;
      if (!completed) return Response.json({ success: false, reused: true, status: 'inconsistent', error: 'REUSED_RUN_POSTCONDITION_FAILED', run_id: existingRun.id, concurrency_guarantee: 'best_effort', atomicity_verified: false }, { status: 409 });
      return Response.json({ success: true, reused: true, completed: true, run_id: existingRun.id, status: 'succeeded', snapshot_id: summary.snapshot_id, output_checksum: summary.output_checksum || snapshot.output_checksum, concurrency_guarantee: 'best_effort', atomicity_verified: false });
    }

    let run;
    try {
      run = await base44.asServiceRole.entities.FinancialProcessingRun.create({
        tenant_id: diagnosis.tenant_id,
        financial_diagnosis_id,
        financial_upload_id: new_upload_id,
        operation_type: 'replace_source',
        operation_key: operationKey,
        status: 'running',
        started_at: now,
        triggered_by: user.email,
        source_entity_id: newUpload.source_entity_id || null,
        source_period: newUpload.source_period || null,
        input_checksum: newUpload.input_checksum || null,
        concurrency_guarantee: 'best_effort',
      });
    } catch (e) {
      return Response.json({ error: 'Falha ao criar processing run: ' + e.message }, { status: 500 });
    }

    const failBeforeSwap = async (errorMsg, statusCode = 422) => {
      await base44.asServiceRole.entities.FinancialUpload.update(new_upload_id, { replacement_status: 'failed' });
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'failed', completed_at: new Date().toISOString(), error_details: { error: errorMsg },
        result_summary: { success: false, compensation_executed: false, snapshot_id: null, concurrency_guarantee: 'best_effort', atomicity_verified: false },
      });
      return Response.json({ success: false, status: 'failed', run_id: run.id, error: errorMsg, current_upload_preserved: current_upload_id }, { status: statusCode });
    };

    const compensate = async (errorMsg) => {
      let compensationVerified = false;
      let compensationError = null;
      try {
        const runSnapshots = await base44.asServiceRole.entities.FinancialProcessingSnapshot.filter({ financial_processing_run_id: run.id }, '-version_number', 100);
        for (const snapshot of runSnapshots.filter((item) => item.status === 'active')) {
          await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(snapshot.id, {
            status: 'invalid', invalid_reason: 'OPERATION_ROLLED_BACK',
            invalidated_at: new Date().toISOString(), invalidated_by_run_id: run.id,
          });
        }
        await base44.asServiceRole.entities.FinancialUpload.update(current_upload_id, originalState.current);
        await base44.asServiceRole.entities.FinancialUpload.update(new_upload_id, originalState.next);
        await base44.asServiceRole.entities.FinancialDiagnosis.update(financial_diagnosis_id, originalState.diagnosis);
        const [restoredDiagnosis, restoredCurrent, restoredNew, snapshotsAfter] = await Promise.all([
          base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id),
          base44.asServiceRole.entities.FinancialUpload.get(current_upload_id),
          base44.asServiceRole.entities.FinancialUpload.get(new_upload_id),
          base44.asServiceRole.entities.FinancialProcessingSnapshot.filter({ financial_processing_run_id: run.id }, '-version_number', 100),
        ]);
        compensationVerified = restoredDiagnosis.current_upload_id === originalState.diagnosis.current_upload_id && restoredDiagnosis.current_processing_snapshot_id === originalState.diagnosis.current_processing_snapshot_id && restoredCurrent.is_current === originalState.current.is_current && restoredNew.is_current === originalState.next.is_current && snapshotsAfter.every((item) => item.status !== 'active');
        if (!compensationVerified) throw new Error('COMPENSATION_POSTCONDITION_FAILED');
      } catch (error) {
        compensationError = error.message;
        await base44.asServiceRole.entities.FinancialDiagnosis.update(financial_diagnosis_id, { integrity_status: 'blocked', integrity_blocking_count: Math.max(1, Number(diagnosis.integrity_blocking_count || 0)), integrity_checked_at: new Date().toISOString() });
      }
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'partial_failed', completed_at: new Date().toISOString(),
        error_details: { error: errorMsg, compensation_error: compensationError },
        result_summary: { success: false, compensation_executed: true, compensation_verified: compensationVerified, snapshot_pending: false, old_upload_id: current_upload_id, new_upload_id, concurrency_guarantee: 'best_effort', atomicity_verified: false },
      });
      return compensationVerified;
    };

    let swapStarted = false;
    let buildOutputCount = 0;
    let activationTime = null;
    let snapshotId = null;
    let outputChecksum = null;

    try {
      // ── Phase 3: Mark new upload as pending replacement ──
      await base44.asServiceRole.entities.FinancialUpload.update(new_upload_id, {
        is_current: false,
        replacement_status: 'pending',
        supersedes_upload_id: current_upload_id,
      });

      // ── Phase 4: Validate the new upload ──
      let validationOk = true;
      let validationError = null;
      try {
        const valResult = await base44.functions.invoke('validateFinancialUpload', {
          financial_upload_id: new_upload_id,
          financial_diagnosis_id,
          upload_id: new_upload_id,
          diagnosis_id: financial_diagnosis_id,
        });
        const valData = valResult?.data || valResult;
        if (valData && valData.blocking_issues && valData.blocking_issues.length > 0) {
          validationOk = false;
          validationError = `${valData.blocking_issues.length} issue(s) bloqueante(s) na validação do novo upload`;
        }
      } catch (e) {
        validationOk = false;
        validationError = 'Falha ao validar novo upload: ' + e.message;
      }

      if (!validationOk) {
        await failBeforeSwap(validationError);
        return Response.json({
          success: false, status: 'failed', run_id: run.id, message: validationError,
          current_upload_preserved: current_upload_id,
        }, { status: 422 });
      }

      // ── Phase 5: BUILD outputs do novo upload ──
      let buildOk = false;
      let buildError = null;
      try {
        const buildResult = await base44.functions.invoke('buildFinancialStatements', {
          upload_id: new_upload_id,
          financial_diagnosis_id,
          diagnosis_id: financial_diagnosis_id,
        });
        const newStmtLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
          { financial_upload_id: new_upload_id }, 'id', 5000
        );
        buildOutputCount = newStmtLines.length;
        if (buildOutputCount === 0) {
          buildOk = false;
          buildError = 'Build executado mas nenhum StatementLine criado para o novo upload';
        } else {
          buildOk = true;
        }
      } catch (e) {
        buildOk = false;
        buildError = 'Falha ao construir outputs do novo upload: ' + e.message;
      }

      if (!buildOk) {
        await failBeforeSwap(buildError);
        return Response.json({
          success: false, status: 'failed', run_id: run.id, message: buildError,
          current_upload_preserved: current_upload_id,
        }, { status: 422 });
      }

      // ── Phase 6: Validar candidato (integridade mode replacement_candidate) ──
      // 6.1: Validar explicitamente a resposta do candidato — resposta vazia,
      //      incompleta ou inesperada deve bloquear.
      let candidateOk = false;
      let candidateError = null;
      try {
        const integrityResult = await base44.functions.invoke('checkFinancialDiagnosisIntegrity', {
          financial_diagnosis_id,
          upload_id: new_upload_id,
          mode: 'replacement_candidate',
        });
        const integrity = integrityResult?.data || integrityResult;
        // 6.1: Exigir resposta válida do candidato
        if (!integrity) {
          candidateOk = false;
          candidateError = 'Resposta de integridade do candidato é nula';
        } else if (integrity.mode !== 'replacement_candidate') {
          candidateOk = false;
          candidateError = `Modo de integridade incorreto: ${integrity.mode} (esperado replacement_candidate)`;
        } else if (integrity.candidate_is_healthy !== true) {
          candidateOk = false;
          candidateError = 'Candidato não está saudável (candidate_is_healthy !== true)';
        } else if (!integrity.output_counts || (integrity.output_counts.statement_lines || 0) <= 0) {
          candidateOk = false;
          candidateError = 'Candidato não produziu statement lines (output_counts.statement_lines <= 0)';
        } else if (integrity.blocking_issues && integrity.blocking_issues.length > 0) {
          candidateOk = false;
          candidateError = `${integrity.blocking_issues.length} issue(s) bloqueante(s) no candidato`;
        } else {
          candidateOk = true;
        }
      } catch (e) {
        candidateOk = false;
        candidateError = 'Falha ao executar integridade do candidato: ' + e.message;
      }

      if (!candidateOk) {
        await failBeforeSwap(candidateError);
        return Response.json({
          success: false, status: 'failed', run_id: run.id, message: candidateError,
          current_upload_preserved: current_upload_id,
        }, { status: 422 });
      }

      if (failure_point === 'before_swap') throw new Error(failure_point);

      // ── Phase 7: Ativação — swap is_current (soft supersession) ──
      // 7: NÃO realizar delete físico dos outputs antigos.
      // Marcar conjunto antigo como superseded (reversível).
      activationTime = new Date().toISOString();
      swapStarted = true;

      await base44.asServiceRole.entities.FinancialUpload.update(current_upload_id, {
        is_current: false,
        superseded_by_upload_id: new_upload_id,
        superseded_at: activationTime,
      });

      await base44.asServiceRole.entities.FinancialUpload.update(new_upload_id, {
        is_current: true,
        replacement_status: 'activated',
        upload_status: 'processed',
      });

      await base44.asServiceRole.entities.FinancialDiagnosis.update(financial_diagnosis_id, {
        current_upload_id: new_upload_id,
      });
      if (failure_point === 'after_swap') throw new Error(failure_point);

      // ── Phase 8: Full integrity é estritamente fail-closed ──
      const integrityResponse = await base44.functions.invoke('checkFinancialDiagnosisIntegrity', { financial_diagnosis_id });
      const integrityData = integrityResponse?.data || integrityResponse;
      if (!integrityData || typeof integrityData !== 'object' || Array.isArray(integrityData)) throw new Error('FULL_INTEGRITY_EMPTY_RESPONSE');
      if (integrityData.is_healthy !== true) throw new Error('FULL_INTEGRITY_NOT_HEALTHY');
      if (!Array.isArray(integrityData.blocking_issues)) throw new Error('FULL_INTEGRITY_UNEXPECTED_FORMAT');
      if (integrityData.blocking_issues.length > 0) throw new Error('FULL_INTEGRITY_BLOCKED');
      if (failure_point === 'after_full_integrity') throw new Error(failure_point);

      // ── Phase 9: running → committing → snapshot comprovado → succeeded ──
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'committing',
        result_summary: {
          success: false, commit_pending: true, snapshot_pending: true, snapshot_id: null,
          old_upload_id: current_upload_id, new_upload_id, upload_ids: [new_upload_id],
          activated_at: activationTime, build_output_count: buildOutputCount,
          concurrency_guarantee: 'best_effort', atomicity_verified: false,
        },
      });
      const snapshotResult = await base44.functions.invoke('createFinancialProcessingSnapshot', { financial_diagnosis_id, processing_run_id: run.id });
      const snapshotData = snapshotResult?.data || snapshotResult;
      snapshotId = snapshotData?.snapshot_id || null;
      outputChecksum = snapshotData?.output_checksum || null;
      if (!snapshotId) throw new Error(snapshotData?.error || 'SNAPSHOT_REQUIRED');
      if (failure_point === 'after_snapshot') throw new Error(failure_point);

      const [persistedRun, persistedSnapshot, persistedDiagnosis, persistedCurrent, persistedNew] = await Promise.all([
        base44.asServiceRole.entities.FinancialProcessingRun.get(run.id),
        base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshotId),
        base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id),
        base44.asServiceRole.entities.FinancialUpload.get(current_upload_id),
        base44.asServiceRole.entities.FinancialUpload.get(new_upload_id),
      ]);
      const commitVerified = persistedRun.status === 'committing' && persistedSnapshot?.status === 'active' && persistedSnapshot.financial_processing_run_id === run.id && persistedDiagnosis.current_processing_snapshot_id === snapshotId && persistedDiagnosis.current_upload_id === new_upload_id && persistedCurrent.is_current === false && persistedNew.is_current === true;
      if (!commitVerified) throw new Error('REPLACEMENT_COMMIT_POSTCONDITION_FAILED');

      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'succeeded', completed_at: new Date().toISOString(), output_checksum: outputChecksum,
        result_summary: {
          success: true, commit_pending: false, snapshot_pending: false, snapshot_id: snapshotId,
          output_checksum: outputChecksum, old_upload_id: current_upload_id, new_upload_id,
          activated_at: activationTime, build_output_count: buildOutputCount,
          concurrency_guarantee: 'best_effort', atomicity_verified: false,
        },
      });
      const completedRun = await base44.asServiceRole.entities.FinancialProcessingRun.get(run.id);
      if (completedRun.status !== 'succeeded' || completedRun.result_summary?.snapshot_id !== snapshotId || completedRun.result_summary?.snapshot_pending !== false) throw new Error('REPLACEMENT_RUN_CLOSE_POSTCONDITION_FAILED');
      return Response.json({ success: true, status: 'succeeded', run_id: run.id, snapshot_id: snapshotId, output_checksum: outputChecksum, old_upload_id: current_upload_id, new_upload_id, new_current_upload_id: new_upload_id, integrity: integrityData, concurrency_guarantee: 'best_effort', atomicity_verified: false });
    } catch (error) {
      if (!swapStarted) return await failBeforeSwap(error.message, 500);
      const compensationVerified = await compensate(error.message);
      return Response.json({ success: false, status: 'partial_failed', run_id: run.id, error: error.message, compensation_executed: true, compensation_verified: compensationVerified, current_upload_preserved: current_upload_id, concurrency_guarantee: 'best_effort', atomicity_verified: false }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});