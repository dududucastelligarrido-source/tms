FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

# Placeholders so prisma generate can validate schema at build time;
# real values come from Render environment variables at runtime.
ENV DATABASE_URL="postgresql://p:p@localhost/p"
ENV DIRECT_URL="postgresql://p:p@localhost/p"

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api

RUN pnpm db:generate && pnpm build

EXPOSE 3001

# Apply pending migrations, then start (migrate deploy is a no-op when up to date).
CMD ["pnpm", "start:prod"]
