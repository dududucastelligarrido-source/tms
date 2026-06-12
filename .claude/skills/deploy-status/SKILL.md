---
name: deploy-status
description: Verifica se a produção do TMS está rodando o código mais recente do master. Compara o SHA de origin/master, o deploy live no Render e o /health da API pública, e diz em uma linha se está tudo sincronizado. Use após um merge/deploy, quando perguntarem "o que está no ar?" ou para diagnosticar por que uma mudança não apareceu em produção.
---

# Verificar status do deploy do TMS

## Topologia (não confundir!)

| Serviço | ID Render | URL | Papel |
|---|---|---|---|
| **tms** | `srv-d86fsigjs32c73ekleug` | https://tms-vha3.onrender.com | **PRODUÇÃO** — o front (tms-web-beta.vercel.app) aponta para cá. NUNCA suspender. |
| tms-1 | `srv-d86g0qugvqtc73dljm2g` | https://tms-1-dv0x.onrender.com | Duplicado ocioso (candidato a remoção) |

Ambos auto-deployam do `master` via webhook do GitHub — que pode falhar silenciosamente; é exatamente isso que esta skill detecta.

## Passos

1. **SHA esperado**: `git fetch origin master --quiet && git rev-parse origin/master`

2. **Deploy live no Render**: chame `mcp__render__list_deploys` com `serviceId: srv-d86fsigjs32c73ekleug, limit: 1` (carregue via ToolSearch se necessário; se pedir workspace, use `mcp__render__list_workspaces` — só existe um). Anote `commit.id`, `status` e `trigger`.

3. **O que o processo está servindo**: `curl -s https://tms-vha3.onrender.com/health` → campo `commit`. Se vier `"unknown"`, o build é anterior ao endpoint com SHA. Se o serviço estiver hibernado (plano starter), a primeira chamada pode demorar ~30s.

4. **Veredito** (responda em uma linha + tabela se houver divergência):
   - 3 SHAs iguais e `status: live` → ✅ produção atualizada.
   - Render atrás do master e nenhum deploy em andamento → webhook falhou: orientar Manual Deploy no dashboard (https://dashboard.render.com/web/srv-d86fsigjs32c73ekleug) conferindo o SHA no diálogo, ou aguardar e re-checar.
   - Deploy com status de build/update em andamento → informar e aguardar (~2 min) antes de re-checar.
   - `/health` difere do deploy live do Render → instância antiga ainda no ar; re-checar em 1 min.

## Avisos

- Incidente conhecido (jun/2026): deploy manual feito no serviço errado (tms-1) e webhook que não disparou deixaram produção com código velho enquanto todos achavam que estava atualizada. Sempre confira o **SHA**, não o horário do deploy.
- Se a API do GitHub estiver inacessível localmente (timeout em `api.github.com`), isso NÃO afeta esta skill — mas explica webhook atrasado. Contorno para chamadas REST locais: `curl --resolve api.github.com:443:140.82.112.6 ...`.
