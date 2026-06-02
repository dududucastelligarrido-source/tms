FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api

# Dummy DB URLs satisfy prisma generate's schema validation at build time only.
# They are NOT persisted as runtime ENV, so a missing DATABASE_URL/DIRECT_URL
# in production fails loudly instead of silently connecting to localhost.
RUN DATABASE_URL="postgresql://p:p@localhost/p" DIRECT_URL="postgresql://p:p@localhost/p" pnpm db:generate \
  && pnpm build

EXPOSE 3001

# Apply pending migrations, then start (migrate deploy is a no-op when up to date).
CMD ["pnpm", "start:prod"]
