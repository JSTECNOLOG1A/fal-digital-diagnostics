# ADR — Atomicidade de runs e locks de período

**Status:** open — Go Live blocker  
**Decision owner:** arquitetura Método FAL  
**IDs:** RC1-ARCH-ATOMIC, RC1-ARCH-PERIOD-LOCK

## Problema

A documentação Base44 consultada não expõe para Entities garantia de unique constraint, transaction, compare-and-set, create-if-absent ou exclusive lock. `filter → create`, atraso, eleição posterior e cancelamento não constituem atomicidade.

O processamento permanece explicitamente `best_effort`. A entidade `FinancialPeriodLock` é apenas placeholder `not_production_ready` e não é controle ativo.

## Opção A — coordenador externo transacional

Usar PostgreSQL/Supabase com unique constraint e transação, serviço próprio com endpoint idempotente ou datastore com CAS documentado. Backend functions podem chamar o coordenador por API autenticada com secrets.

## Opção B — suporte oficial Base44

Obter confirmação formal de primitivo nativo aplicável, incluindo semântica de conflito, isolamento e recuperação.

## Opção C — aceitar best-effort

Somente mediante decisão formal de risco. Não atende ao requisito atual de Go Live.

## Evidência de plataforma — 27/07/2026

A documentação disponível da Base44 não comprova transação de entidades, unique constraint, compare-and-set, create-if-absent ou lock exclusivo distribuído. A consulta oficial de documentação também não retornou um primitivo aplicável. Portanto, não é permitido implementar este requisito com `filter → create`, atualização posterior ou teste simulado.

O componente externo obrigatório para liberar estes controles é um coordenador transacional com endpoint autenticado e contrato de aquisição atômica: chave única `(tenant_id, financial_diagnosis_id, reference_period, operation)`, `owner_token`, `fencing_token` monotônico, `acquired_at`, `expires_at`, renovação e liberação condicionadas ao proprietário, retorno HTTP 409 em conflito e trilha de `AuditLog` para aquisição, conflito, expiração e liberação.

## Critério RC-1

Em concorrência real: `processing_runs=1`, `outputs ativos=1` e lock exclusivo comprovado pelo coordenador transacional. Até a integração desse componente e sua homologação, atomicidade, period lock, concorrência estrita e Go Live permanecem não aprovados.