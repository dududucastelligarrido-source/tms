# TMS — Sistema de Gestão de Transporte

SaaS **multi-tenant** para transportadoras (viagens, frota, abastecimento, manutenção, checklists). Monorepo pnpm:

- `apps/api` — Fastify 4 + Prisma 7 (driver adapter pg) + Zod. Auth JWT (jose), senha argon2.
- `apps/web` — React + Vite, PWA com fila offline. TanStack Query.
- `packages/types` — tipos compartilhados (hoje pouco usados pela api/web).

## Comandos

```bash
corepack pnpm install              # pnpm não está no PATH; use corepack pnpm
corepack pnpm --filter api dev     # API local (precisa de .env)
corepack pnpm --filter web dev     # front local
cd apps/api && npx vitest run      # suite da API (precisa do banco de teste, ver abaixo)
cd apps/api && npx tsc -p tsconfig.build.json --noEmit   # typecheck da API
cd apps/web && npx tsc --noEmit    # typecheck do web
```

`npx tsc --noEmit` na raiz de `apps/api` SEM `-p tsconfig.build.json` acusa erros TS6059 pré-existentes (tsconfig inclui `test/` fora do rootDir) — ignore, o build usa `tsconfig.build.json`.

## Banco de teste

A suite usa `DATABASE_URL_TEST` do `apps/api/.env` (Postgres local `localhost:5433/tms_test`, container Docker `tms-test-db`). Se o container não existir/estiver parado:

```bash
docker start tms-test-db 2>/dev/null || docker run -d --name tms-test-db \
  -e POSTGRES_PASSWORD=<senha do .env> -e POSTGRES_DB=tms_test -p 5433:5432 postgres:16-alpine
cd apps/api && DATABASE_URL="$DATABASE_URL_TEST" DIRECT_URL="$DATABASE_URL_TEST" npx prisma db push
```

`test/setup.ts` recusa rodar se a URL não contiver `test`/`localhost` — o `cleanDb()` apaga TODAS as tabelas a cada teste. Nunca enfraqueça essa guarda.

## ⚠️ Isolamento multi-tenant — regra crítica

O isolamento é garantido pelo client extension em `apps/api/src/plugins/prisma.ts`, que injeta `tenantId` (do AsyncLocalStorage preenchido pelo middleware `tenant-scope`) em toda query dos models listados em `TENANT_SCOPED_MODELS`.

- **Todo model novo com coluna `tenantId` DEVE entrar em `TENANT_SCOPED_MODELS`.** O teste de drift em `test/tenant-isolation.test.ts` compara a lista com o schema e quebra o CI se divergir.
- Nas rotas, o tenant explícito é `request.user.tenantId` (vem do JWT). **Nunca** `(request as any).tenantId` — esse campo não existe e `undefined` no `where` é descartado silenciosamente pelo Prisma (foi a causa de um vazamento real em produção, jun/2026).
- `include`s NÃO são escopados pelo extension — valide a posse de FKs (`driverId`, `vehicleId`...) antes de associar entidades.

## Deploy (produção)

- **API**: Render, serviço **`tms`** (`srv-d86fsigjs32c73ekleug`, https://tms-vha3.onrender.com) — é ESTE que atende produção; **nunca suspender**. Existe um duplicado ocioso `tms-1` (`srv-d86g0qugvqtc73dljm2g`) — não confundir. Ambos auto-deployam do `master` (webhook pode atrasar/falhar).
- **Front**: Vercel `tms-web` → https://tms-web-beta.vercel.app (aponta para a API via `VITE_API_URL`).
- **Banco**: Supabase (pooler transaction 6543 = `DATABASE_URL`, session 5432 = `DIRECT_URL` para migrations).
- Use a skill **`/deploy-status`** para conferir se produção == master.
- `railway.toml` é resíduo de migração antiga — não se aplica a nada.

## CI

`.github/workflows/ci.yml`: typecheck api+web, `prisma migrate deploy` em Postgres de serviço, suite da API e build do web, em todo PR e push no master. Não mergeie com CI vermelho.

## Rede (máquina local)

`api.github.com` às vezes não responde desta rede (o IP Azure 4.228.x.x dá timeout) enquanto `github.com` e o push SSH funcionam. Contorno para REST:
`curl --resolve api.github.com:443:140.82.112.6 https://api.github.com/...` (o `gh` CLI e MCP do GitHub falham juntos nesses períodos).
