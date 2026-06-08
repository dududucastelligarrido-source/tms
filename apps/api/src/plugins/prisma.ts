import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { tenantStorage } from '../middleware/tenant-scope.js'

const TENANT_SCOPED_MODELS = [
  'User', 'Vehicle', 'Driver', 'Trip', 'TripCost',
  'KmLog', 'ChecklistTemplate', 'TripChecklist',
]

const READ_OPS = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate']
// findUnique(OrThrow) accept the extra tenantId filter via `extendedWhereUnique`
// (GA since Prisma 5): a wrong-tenant row simply won't match, mirroring the old
// middleware that rewrote these to findFirst.
const WHERE_OPS = [
  ...READ_OPS,
  'findUnique', 'findUniqueOrThrow',
  'update', 'updateMany', 'upsert',
  'delete', 'deleteMany',
]

function createPrismaClient() {
  // Prisma 7 is "Rust-free": the client connects through a driver adapter.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

  // Tenant scoping moved from the removed `$use` middleware to a client
  // extension. Same semantics: inject the active tenantId into every query on
  // tenant-scoped models so a tenant can never read or mutate another's rows.
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = tenantStorage.getStore()
          if (!ctx?.tenantId || !TENANT_SCOPED_MODELS.includes(model)) {
            return query(args)
          }
          const tenantId = ctx.tenantId
          const a = (args ?? {}) as Record<string, any>

          if (WHERE_OPS.includes(operation)) {
            return query({ ...a, where: { ...a.where, tenantId } })
          }
          if (operation === 'create') {
            return query({ ...a, data: { ...a.data, tenantId } })
          }
          if (operation === 'createMany') {
            const rows = Array.isArray(a.data) ? a.data : [a.data]
            return query({ ...a, data: rows.map((row: object) => ({ ...row, tenantId })) })
          }
          return query(args)
        },
      },
    },
  })
}

export const prisma = createPrismaClient()
export type ExtendedPrismaClient = typeof prisma

const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async () => { await prisma.$disconnect() })
})

export default prismaPlugin

declare module 'fastify' {
  interface FastifyInstance { prisma: ExtendedPrismaClient }
}
