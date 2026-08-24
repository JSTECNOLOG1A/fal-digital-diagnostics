# Mapa de bloqueadores RC-1

| ID | Estado | Impacto |
|---|---|---|
| RC1-ARCH-ATOMIC | open — Go Live blocker | Sem garantia de um único processing run/output em concorrência real |
| RC1-ARCH-PERIOD-LOCK | open — Go Live blocker | Sem exclusão mútua comprovada na substituição de entidade × período |

A FASE 2 opera somente com idempotência `best_effort`. A FASE 3 não foi iniciada.