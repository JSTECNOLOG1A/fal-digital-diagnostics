# SEG-02 — Matriz Dinâmica de Autorização das Functions Invocáveis

## Resumo Numérico

| Métrica | Valor |
|---------|-------|
| Total de functions invocáveis | 115 |
| Com Deno.serve | 114 |
| Sem Deno.serve (internal module) | 1 (narrativeEngine) |
| Com auth.me | 106 |
| Com asServiceRole | 84 |
| Com tenant guard | 63 |
| Com role guard | 56 |
| Automation trust | 2 |
| Unclassified | **0** |

## Distribuição por Classificação

| Classificação | Contagem | Descrição |
|---------------|----------|-----------|
| TENANT_GUARDED | 69 | auth.me + tenant guard ou operação autenticada sem acesso a dados persistidos |
| HQ_GLOBAL | 32 | auth.me + role guard hq_admin (cross-tenant por design) |
| AUTOMATION_TRUST | 2 | Platform automation triggers (auth.me opcional em try/catch) |
| TENANT_ADMIN_SCOPED | 6 | auth.me + admin role set + tenant validation para destrutivas |
| PUBLIC_GLOBAL_READ | 2 | auth.me + catálogo global read-only |
| DEPRECATED_410 | 3 | Bloqueada — retorna 410 Gone |
| INTERNAL_MODULE | 1 | Pure module, não invocável como endpoint |

**NEEDS-TENANT-GUARD: 0** ✓
**UNCLASSIFIED: 0** ✓

## Matriz Individual (reconciliada dinamicamente por `audit-seg02-functions.mjs`)

| # | function_name | Deno.serve | auth.me | asServiceRole | ID externo | tenant guard | role guard | roles permitidas | trust model | classificação final | justificativa |
|---|---------------|------------|---------|---------------|------------|--------------|------------|------------------|-------------|---------------------|---------------|
| 1 | archiveReportVersion | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe report_version_id, valida tenant via entity lookup |
| 2 | assignGroupOrderNumber | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe group_id, valida tenant via entity lookup |
| 3 | auditFinancialCanonicalRegistry | Y | Y | N | N | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Read-only audit, sem IDs externos, usa user-scoped SDK |
| 4 | auditTenantGuardProof | Y | Y | Y | Y | N | N | — | — | DEPRECATED_410 | Depreciado: verificava logicamente, não provava runtime cross-tenant |
| 5 | autoRunDiagnosticPipeline | Y | Y | Y | Y | Y | N | automation + user | automation trigger | AUTOMATION_TRUST | Trigger de entity automation; auth.me opcional; tenant guard para invocação direta |
| 6 | buildFalQuestionSet | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 7 | buildFinancialStatements | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe diagnosis_id, valida tenant via entity lookup |
| 8 | buildReportPayload | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 9 | cancelActionPlanReview | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe review_id, valida tenant |
| 10 | checkFinancialDiagnosisIntegrity | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe financial_diagnosis_id, valida tenant |
| 11 | completeActionPlanReview | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe review_id, valida tenant |
| 12 | computeClusterIntelligence | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 13 | computeCompanyAggregate | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe company_id, valida tenant |
| 14 | computeConsultantPortfolio | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe tenant_id do user, filtra por tenant |
| 15 | computeFalDiagnostic | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 16 | computeFalPriority | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 17 | computeGroupAggregate | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe group_id, valida tenant |
| 18 | computeGroupAggregateFunction | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Recebe group_id, usa user-scoped SDK (sem service role) |
| 19 | computeInsights | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant deny-by-default |
| 20 | computeMfisAnalysis | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Recebe assessment_id, usa user-scoped SDK |
| 21 | computePortfolioBenchmark | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe tenant_id do user, filtra por tenant |
| 22 | computeScores | Y | Y | N | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 23 | convertFinancialRecommendation | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe recommendation_id, valida tenant |
| 24 | createActionPlanReview | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe plan_id, valida tenant |
| 25 | createActionPlanReviewWithSnapshot | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe plan_id, valida tenant |
| 26 | debugCaixaComposition | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only, service role com IDs |
| 27 | debugCaixaContas | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 28 | debugCaixaDetalhado | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 29 | debugCaixaVazao | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 30 | debugDfcCompositionDetailed | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 31 | debugExcelHeaders | Y | Y | N | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 32 | debugPlMapping | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 33 | debugPlVsResultado | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 34 | debugResultadoLiquido | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 35 | debugTodasContas | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Debug tool, hq_admin-only |
| 36 | deduplicateActionPlanReviews | Y | Y | Y | Y | Y | Y | hq_admin | admin role + tenant | TENANT_GUARDED | Admin-only; valida tenant do plan para não-HQ |
| 37 | deduplicateActionRecommendations | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe diagnosis_id, valida tenant |
| 38 | deleteAccountPlan | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Destrutiva: ALLOWED_DELETE_ROLES + tenant validation |
| 39 | deleteAccountPlanLines | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Destrutiva: ALLOWED_DELETE_ROLES + tenant validation |
| 40 | exportFalQuestions | Y | Y | Y | N | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Exporta questões do tenant do user |
| 41 | exportFalQuestionsCSV | Y | Y | N | N | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Exporta questões do tenant do user |
| 42 | falHardeningReport | Y | Y | Y | N | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Relatório de hardening, valida tenant |
| 43 | falIntegrityCheck | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 44 | falTestSuite | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Test suite, valida tenant |
| 45 | finalizeFinancialInsights | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe financial_diagnosis_id, valida tenant (HQ bypass) |
| 46 | fixFalGroupApplicability | Y | Y | Y | Y | N | Y | hq_admin | user-scoped SDK | TENANT_GUARDED | Recebe group_id, usa user-scoped SDK |
| 47 | generateActionPlan | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessmentId, valida tenant deny-by-default |
| 48 | generateActionRecommendations | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 49 | generateAssessmentReportVersion | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 50 | generateAssessmentScopes | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Recebe assessment_id, usa user-scoped SDK |
| 51 | generateConsultantAlerts | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe tenant_id do user, filtra por tenant |
| 52 | generateFinancialInterpretations | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe financial_diagnosis_id, valida tenant (HQ bypass) |
| 53 | generateFinancialRecommendations | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe financial_diagnosis_id, valida tenant (HQ bypass) |
| 54 | generateInsights | Y | Y | N | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 55 | generatePdfFromReportVersion | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe version_id, valida tenant |
| 56 | generateReport | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Recebe assessment_id, usa user-scoped SDK |
| 57 | generateSyntheticDiagnostic | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 58 | getAssessmentFlow | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant após entity lookup |
| 59 | getBankTemplate | Y | Y | N | N | N | Y | hq_admin | — | PUBLIC_GLOBAL_READ | Catálogo global read-only, role guard para admin |
| 60 | getFalResponses | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 61 | getFinancialCanonicalRegistry | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | PUBLIC_GLOBAL_READ | Catálogo canônico global read-only |
| 62 | getReportVersionSnapshot | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe version_id, valida tenant |
| 63 | importFalQuestionBankV3 | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa question bank global, hq_admin-only |
| 64 | importFalQuestions | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa questões metodológicas, hq_admin-only |
| 65 | importFalRecommendationLibrary | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa catálogo global, hq_admin-only |
| 66 | importMethodBank | Y | Y | N | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa bank metodológico, hq_admin-only |
| 67 | importMethodQuestions | Y | Y | N | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa questões metodológicas, hq_admin-only |
| 68 | importQuestionsCSV | Y | Y | N | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Importa CSV de questões, hq_admin-only |
| 69 | manageActionRecommendation | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe recommendation_id, valida tenant |
| 70 | manageDiagnosticLink | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe link data, valida tenant |
| 71 | manageFinancialConsolidationEntry | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe entry data, valida tenant |
| 72 | migrateFalDimKeys | Y | Y | Y | Y | N | Y | hq_admin | user-scoped SDK | TENANT_GUARDED | Migração de dim keys, user-scoped |
| 73 | migrateFalQuestionBank | Y | Y | N | N | N | N | — | — | DEPRECATED_410 | Bloqueada — retorna 410 Gone |
| 74 | migrateLegacySocietaryCompositionToOwnershipLinks | Y | Y | N | Y | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Migração legada, user-scoped |
| 75 | migrateQuestionsToClusters | Y | Y | Y | N | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Migração, user-scoped |
| 76 | narrativeEngine | N | N | N | N | N | N | — | — | INTERNAL_MODULE | Pure export module, não tem Deno.serve, não invocável |
| 77 | onFalResponseChange | Y | Y | Y | Y | Y | N | automation + user | automation trigger | AUTOMATION_TRUST | Trigger de entity automation; auth.me opcional; tenant guard |
| 78 | prepareFinancialAnalysisDataset | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe diagnosis_id, valida tenant |
| 79 | publishFalAssessment | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant |
| 80 | purgeFinancialDerivedData | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Destrutiva: ALLOWED_DELETE_ROLES + tenant validation |
| 81 | purgeFinancialUploadData | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Destrutiva: ALLOWED_DELETE_ROLES + tenant validation |
| 82 | rebuildFalQuestionBank | Y | Y | N | N | N | N | — | — | DEPRECATED_410 | Bloqueada — retorna 410 Gone |
| 83 | reconcileIntercompany | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe diagnosis_id, valida tenant |
| 84 | reindexFalQuestionBank | Y | Y | Y | N | N | N | all authenticated | user-scoped SDK | TENANT_GUARDED | Reindexa questões, user-scoped |
| 85 | restructureFalMatrix | Y | Y | Y | Y | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Restutura matriz metodológica global, admin-only |
| 86 | runtimeSecurityProof | Y | Y | Y | Y | N | N | hq_admin | HQ-only admin tool | HQ_GLOBAL | Ferramenta administrativa HQ-only para testes de segurança. NÃO é prova SEG-01 para non-HQ — o guard HQ-only rejeita non-HQ antes dos cenários |
| 87 | saveDfcClassificationOverride | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe override data, valida tenant |
| 88 | seedActionLibraries | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds action libraries global, admin-only |
| 89 | seedFalClusterMeta | Y | Y | Y | Y | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds cluster meta global, admin-only |
| 90 | seedFalClusters | Y | Y | N | N | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds clusters global, admin-only |
| 91 | seedFalIntelligence | Y | Y | Y | Y | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds intelligence global, admin-only |
| 92 | seedFalLibrariesAgronegocio | Y | Y | Y | Y | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds libraries agronegócio, admin-only |
| 93 | seedFalQuestionApplicability | Y | Y | N | N | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds applicability global, admin-only |
| 94 | seedFalValueLevers | Y | Y | Y | N | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds value levers global, admin-only |
| 95 | seedIntelligenceCatalog | Y | Y | Y | N | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds intelligence catalog, admin-only |
| 96 | seedMethodData | Y | Y | N | N | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds method data global, admin-only |
| 97 | seedMethodStructure | Y | Y | Y | N | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds method structure global, admin-only |
| 98 | seedMqeQuestions | Y | Y | Y | N | N | N | hq_admin | HQ-only role guard | HQ_GLOBAL | Seeds MQE questions global, admin-only |
| 99 | sendFindingToActionPlan | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe finding_id, valida tenant |
| 100 | simulateFalImpact | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe assessment_id, valida tenant deny-by-default |
| 101 | swapFalQuestion | Y | Y | Y | Y | Y | Y | hq_admin | HQ-only role guard + tenant | HQ_GLOBAL | HQ-only role guard + tenant validation |
| 102 | updateActionTaskWithHistory | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + tenant | TENANT_GUARDED | Recebe task data, valida tenant |
| 103 | validateFinancialUpload | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + tenant | TENANT_GUARDED | Recebe upload_id, valida tenant |
| 104 | assignUserAccessProfile | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | HQ/tenant_admin role guard | TENANT_ADMIN_SCOPED | HQ atribui qualquer role; tenant_admin limitado a consultant/client_viewer do próprio tenant |
| 105 | migrateUserAccessProfiles | Y | Y | Y | Y | N | Y | hq_admin | HQ-only role guard | HQ_GLOBAL | Migração idempotente de perfis de acesso, HQ-only, dry-run default, preflight blockers |
| 106 | inviteUserWithAccessProfile | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role + tenant scope | TENANT_ADMIN_SCOPED | Admin convida usuário; tenant_admin limita consultant/client_viewer ao próprio tenant e HQ gerencia globalmente |
| 107 | applyPendingUserAccessProfile | Y | Y | Y | Y | N | N | all authenticated | self-service (own email only) | TENANT_GUARDED | Usuário aplica próprio perfil pendente após login, valida built-in role, re-read |
| 108 | getFinancialJourneyState | Y | Y | Y | Y | Y | N | hq_admin+tenant_admin+consultant+client_viewer | user-scoped + tenant (read) | TENANT_GUARDED | Leitura canônica do estado da jornada; client_viewer tem acesso read-only |
| 109 | deleteFinancialUploadSafe | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Destrutiva: ALLOWED_DELETE_ROLES + tenant validation + manifesto + post-condição |
| 110 | replaceFinancialSourcePeriod | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | write role set + tenant | TENANT_GUARDED | Substituição two-phase: WRITE_ROLES + tenant + build obrigatório antes da ativação |
| 111 | updateFinancialJourneyPosition | Y | Y | Y | Y | Y | N | hq_admin+tenant_admin+consultant+client_viewer | user-scoped + tenant (write step) | TENANT_GUARDED | Persiste last_active_step; valida step acessível via getFinancialJourneyState |
| 112 | createFinancialProcessingSnapshot | Y | Y | Y | Y | Y | N | hq_admin+tenant_admin+consultant | user-scoped + tenant (write snapshot) | TENANT_GUARDED | Cria snapshot imutável após run sucedido; nunca .update no snapshot criado |
| 113 | saveFinancialAnalysisDefinition | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | auth.me + app_role + write guard + tenant derivado do diagnóstico | TENANT_GUARDED | Salva definição e escopo com preflight, pós-condição e rollback comprovado |
| 114 | manageDfcManualAdjustment | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | auth.me + write guard + tenant derivado do diagnóstico | TENANT_GUARDED | CRUD auditável de ajuste DFC com compensação, recálculo e snapshot obrigatório |
| 115 | executeFinancialEngine | Y | Y | N | N | N | N | all authenticated | cálculo stateless autenticado | TENANT_GUARDED | Executa registry canônico sem ler ou gravar dados persistidos; consumers validam tenant antes da invocação |
| 116 | resolveCurrentFinancialOutputScope | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + diagnóstico/snapshot/run | TENANT_GUARDED | Resolve exclusivamente o snapshot ativo e run sucedido apontados pelo diagnóstico |
| 117 | migrateFinancialOutputLifecycle | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin role set + tenant | TENANT_ADMIN_SCOPED | Migração idempotente de lifecycle com dry-run, manifesto de ambiguidade e isolamento de tenant |
| 118 | resolveCurrentFinancialSourceOutput | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + source head/snapshot/run | TENANT_GUARDED | Resolve a fonte individual pelo source head ativo e valida run, snapshot e outputs do mesmo run |
| 119 | resolveCurrentFinancialSourcesForPerimeter | Y | Y | Y | Y | Y | N | all authenticated | user-scoped + source heads do perímetro | TENANT_GUARDED | Resolve fontes atuais determinísticas do perímetro multi-entidade |
| 120 | retryFinancialOutputCleanup | Y | Y | Y | Y | Y | N | hq_admin+tenant_admin+consultant | user-scoped + tenant derivado do processing run | TENANT_GUARDED | Cleanup idempotente pós-commit; somente runs succeeded podem superseder outputs anteriores |
| 121 | financialLifecycleDeterminismEngine | Y | N | N | N | N | N | — | pure stateless contract engine | PUBLIC_GLOBAL_READ | Engine determinística sem leitura ou mutação; os consumidores autenticados validam contrato e aplicam mutations |
| 122 | recalculateActionPlanState | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + plan tenant | TENANT_GUARDED | Recalcula indicadores derivados do plano após mutações autorizadas |
| 123 | createManualActionTask | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + plan tenant | TENANT_GUARDED | Cria tarefa manual com histórico append-only e recalcula plano |
| 124 | setOfficialAssessmentReportVersion | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + report tenant | TENANT_GUARDED | Define a única versão oficial por assessment e tipo de relatório |
| 125 | commitReportPdfArtifact | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + report tenant | TENANT_GUARDED | Confirma artefato PDF persistido a partir de operação pendente, checksum e identificador do upload Base44 |
| 126 | beginReportPdfArtifact | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | user-scoped + report tenant | TENANT_GUARDED | Reserva operação de PDF, bloqueia concorrência e confirma estado pendente |
| 127 | createSupportBundle | Y | Y | Y | N | Y | Y | hq_admin+tenant_admin | healthcheck autenticado, saída redigida | TENANT_ADMIN_SCOPED | Gera bundle de suporte sem segredo, token, documento ou identificador pessoal |
| 128 | exportDataSubjectData | Y | Y | Y | N | Y | N | titular autenticado | self-service por email da sessão | TENANT_GUARDED | Exporta apenas dados próprios e registra solicitação em AuditLog |
| 129 | exportTenantOperationalBackup | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | admin + tenant escopado | TENANT_ADMIN_SCOPED | Exportação operacional do tenant com manifesto e checksum |
| 130 | getOperationalHealthcheck | Y | Y | Y | N | Y | Y | hq_admin+tenant_admin | estado operacional sem PII | TENANT_ADMIN_SCOPED | Retorna versão, build SHA e estado de serviços autenticado |
| 131 | manageTenantOnboarding | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin+consultant | tenant do progresso e entidades | TENANT_GUARDED | Onboarding persistente e idempotente limitado ao tenant |
| 132 | resendUserInvitation | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | pending profile do tenant | TENANT_ADMIN_SCOPED | Reenvia convite sem criar novo PendingUserAccessProfile |
| 133 | revokeUserAccess | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | alvo no tenant e sem auto-revogação | TENANT_ADMIN_SCOPED | Revoga perfil, tenant e pendências com AuditLog |
| 134 | validateTenantOperationalBackup | Y | Y | N | N | Y | Y | hq_admin+tenant_admin | valida pacote do tenant autorizado | TENANT_ADMIN_SCOPED | Verifica contagens e checksums do backup sem mutação |
| 135 | getTenantUserAdministration | Y | Y | Y | Y | Y | Y | hq_admin+tenant_admin | administração escopada por tenant | TENANT_ADMIN_SCOPED | Lista usuários, convites e auditoria apenas do tenant autorizado |

## Notas sobre runtimeSecurityProof e auditTenantGuardProof

### runtimeSecurityProof
- **Classificação**: HQ_GLOBAL (ferramenta administrativa)
- **Guard**: HQ-only — non-HQ recebe 403 antes de qualquer cenário
- **NÃO é prova SEG-01 para non-HQ**: O guard HQ-only rejeita client_viewer/consultant/tenant_admin na entrada (403), portanto branches como `if (user.role === 'client_viewer')` nunca executam em runtime
- **Utilidade real**: Ferramenta administrativa para HQ testar guards de functions protegidas usando a própria sessão HQ
- **Decisão**: Mantida como ferramenta administrativa HQ-only, documentada claramente

### auditTenantGuardProof
- **Classificação**: DEPRECATED_410
- **Motivo**: Usava sessão HQ + asServiceRole para carregar recurso cross-tenant, depois calculava `guardResult` logicamente — isso é verificação estática, não tentativa real de acesso por usuário sem permissão
- **Decisão**: Depreciada com 410 Gone. Sem consumers produtivos no frontend.