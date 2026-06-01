# Alertas por Email (CNH + Manutenção)

O sistema envia um **digest diário** por email aos administradores de cada tenant,
listando CNHs vencendo (≤30 dias ou vencidas) e manutenções pendentes
(≤5.000 km ou ≤30 dias do próximo serviço, ou já vencidas).

## Componentes

- `src/lib/alerts.ts` — `computeTenantAlerts(tenantId, name)` calcula os alertas de um tenant.
- `src/lib/email.ts` — `sendAlertDigest(alerts, recipients)` monta o HTML e envia via Resend.
- `src/routes/alerts.ts` — expõe as rotas abaixo.

## Rotas

| Método | Rota | Auth | Uso |
|--------|------|------|-----|
| `POST` | `/api/v1/alerts/run` | header `x-cron-secret` | Cron diário — roda para **todos** os tenants |
| `GET`  | `/api/v1/alerts` | JWT (admin) | Pré-visualiza os alertas do tenant atual |
| `POST` | `/api/v1/alerts/send-now` | JWT (admin) | Dispara o digest do tenant atual manualmente |

> O digest **não é enviado** quando não há nenhum alerta (evita email vazio).

## Variáveis de ambiente

```
RESEND_API_KEY="re_..."                              # https://resend.com/api-keys
EMAIL_FROM="TMS Alertas <alertas@seu-dominio.com>"   # remetente verificado no Resend
CRON_SECRET="<secret-forte-aleatorio>"               # protege /alerts/run
```

Para gerar um secret: `openssl rand -hex 32`.

## Configurar o cron no Railway

1. No projeto da API no Railway, crie um **novo serviço do tipo Cron** (ou use o
   *Cron Schedule* do serviço existente apontando para um comando).
2. Schedule sugerido (todo dia às 08:00 UTC ≈ 05:00 BRT):
   ```
   0 8 * * *
   ```
3. Comando do cron (usa `curl` para bater no endpoint público da API):
   ```bash
   curl -fsS -X POST "$API_URL/api/v1/alerts/run" \
     -H "x-cron-secret: $CRON_SECRET"
   ```
   Defina `API_URL` (ex.: `https://tms-api.up.railway.app`) e `CRON_SECRET`
   nas variáveis do serviço de cron — o `CRON_SECRET` deve ser **idêntico** ao
   configurado na API.

### Alternativa: cron externo (cron-job.org)

Se preferir não usar o cron do Railway, agende em https://cron-job.org:
- URL: `POST https://<sua-api>/api/v1/alerts/run`
- Header: `x-cron-secret: <CRON_SECRET>`
- Frequência: diária

## Teste local

```bash
# com RESEND_API_KEY, EMAIL_FROM e CRON_SECRET no .env
curl -X POST http://localhost:3001/api/v1/alerts/run \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

Resposta de exemplo:
```json
{
  "ranAt": "2026-06-01T08:00:00.000Z",
  "tenants": [
    { "tenant": "Transportes ACME", "sent": true, "recipients": 2, "alerts": 5 }
  ]
}
```
