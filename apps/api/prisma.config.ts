import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer reads `url`/`directUrl` from schema.prisma. Migrate and
// introspection use the datasource URL configured here. We point it at the
// direct connection (DIRECT_URL, port 5432) since migrations require a direct
// session, not the transaction pooler. The runtime client connects separately
// via the pg driver adapter using DATABASE_URL (see src/plugins/prisma.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
})
