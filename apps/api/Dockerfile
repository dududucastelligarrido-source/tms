FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api
RUN pnpm db:generate && pnpm build

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/server.js"]
