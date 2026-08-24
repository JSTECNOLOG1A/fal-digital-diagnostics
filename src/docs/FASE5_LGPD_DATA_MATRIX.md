# FASE 5 — Matriz LGPD

| Entidade/campo | Titular | Finalidade operacional | Acesso | Retenção | Exportável | Tratamento |
|---|---|---|---|---|---|---|
| User: nome, email, telefone | usuário | acesso, convite e suporte | HQ, admin do tenant | enquanto acesso ativo + obrigação de auditoria | sim, pelo titular | desativação; não excluir logs obrigatórios |
| Company: contatos | contato corporativo | diagnóstico e relacionamento | tenant autorizado | contrato + política jurídica | sim, mediante solicitação | pseudonimizar quando necessário |
| AuditLog: ator, alvo, ação | usuário/admin | segurança e rastreabilidade | HQ/admin do tenant | 5 anos, sujeito à validação jurídica | restrito | preservar integridade; mascarar em suporte |
| Diagnósticos, planos e relatórios | cliente/consultoria | prestação do serviço | tenant autorizado | contrato + retenção contábil/auditável | exportação operacional por tenant | não registrar dados sensíveis em erro |

A base legal, prazos definitivos e hipóteses de eliminação devem ser validados pelo jurídico antes do Go Live. Senhas, tokens, documentos sensíveis e conteúdo de erro bruto são proibidos em `AuditLog` e support bundles.