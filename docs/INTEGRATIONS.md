# Integrações FAL ↔ sistemas externos

Base genérica no backend NestJS para conectar ERPs, CRMs, BI e outros sistemas.

## Conceitos

| Peça | Função |
|---|---|
| **IntegrationConnection** | Credenciais outbound (URL + secrets criptografados) por tenant/provider |
| **IntegrationApiKey** | Chave para parceiros chamarem o FAL (`X-Api-Key`) |
| **WebhookEndpoint** | URL que o FAL notifica (HMAC `X-FAL-Signature`) |
| **InboundEvent** | Eventos recebidos de sistemas externos |
| **IntegrationJob** | Jobs de sync (estrutura pronta para filas) |

Protheus continua em `/integrations/protheus` (módulo específico). Esta base serve para novos providers.

## Endpoints (admin — JWT)

Prefixo: `/api/v1/integrations`

- `GET/POST /connections` — listar / upsert conexão
- `GET/POST /api-keys` — listar / criar chave (segredo exibido **uma vez**)
- `DELETE /api-keys/:id` — revogar
- `GET/POST /webhooks/endpoints` — listar / criar webhook outbound
- `POST /webhooks/dispatch` — disparar evento de teste
- `GET /inbound-events` — ver eventos recebidos
- `GET /jobs` — jobs de integração

## Endpoints (parceiro — API Key)

Header: `X-Api-Key: fal_live_...`

- `GET /api/v1/integrations/partner/ping` — health + scopes  
  Scope: `partner:ping`
- `POST /api/v1/integrations/partner/webhooks/:provider` — receber evento  
  Scope: `webhooks:receive`

Exemplo:

```bash
# 1) Login HQ
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@fal.local","password":"FalTest123!"}' | jq -r .accessToken)

TENANT=<uuid-do-tenant>

# 2) Criar API Key
curl -s -X POST http://localhost:3001/api/v1/integrations/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Parceiro Demo\",\"tenantId\":\"$TENANT\",\"scopes\":[\"partner:ping\",\"webhooks:receive\"]}"

# 3) Ping com a chave retornada em apiKey
curl -s http://localhost:3001/api/v1/integrations/partner/ping \
  -H "X-Api-Key: fal_live_..."

# 4) Enviar webhook inbound
curl -s -X POST http://localhost:3001/api/v1/integrations/partner/webhooks/custom-erp \
  -H "X-Api-Key: fal_live_..." \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"company.upserted","externalId":"ERP-123","data":{"name":"Empresa X"}}'
```

## Segurança

- Secrets de conexão: AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`)
- API keys: apenas hash SHA-256 no banco
- RLS por tenant nas tabelas de integração
- Auditoria em create/revoke/dispatch/inbound

## Próximos passos sugeridos

1. Adapter concreto por provider (`integrations/sap`, `integrations/totvs`, …)
2. Worker BullMQ para retries de webhook delivery
3. ~~Tela admin no frontend (conexões + keys + logs)~~ → `/Integrations`
4. Mapeamento inbound → create/update Company/Group

## Protheus — plano de contas

Endpoint síncrono (não depende de Redis):

`POST /api/v1/integrations/protheus/fetch`

```json
{
  "tenantId": "<uuid>",
  "resource": "chart_of_accounts",
  "pathOverride": "/api/seu-servico/v1/planocontas"
}
```

1. Salve a conexão em `POST /integrations/protheus/connection` (baseUrl, user, senha, empresa, filial)
2. Abra `/Integrations` → card **Protheus · Plano de contas** → **Buscar plano de contas**
3. Se der 404, abra `https://…/rest/` no browser, ache o serviço do CT1 e cole o caminho em **Caminho REST**

A resposta lista contas (`code`, `name`, `classType`) e grava staging no FAL.
