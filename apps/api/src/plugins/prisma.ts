import { PrismaClient } from '@prisma/client'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { tenantStorage } from '../middleware/tenant-scope.js'

const TENANT_SCOPED_MODELS = [
  'User', 'Vehicle', 'Driver', 'Trip', 'TripCost',
  'KmLog', 'ChecklistTemplate', 'TripChecklist',
]

function createPrismaClient() {
  const client = new PrismaClient()

  // @ts-ignore Prisma middleware legacy API
  client.$use(async (params: any, next: any) => {
    const ctx = tenantStorage.getStore()
    if (!ctx?.tenantId) return next(params)

    if (params.model && TENANT_SCOPED_MODELS.includes(params.model)) {
      const readOps = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate']
      const updateOps = ['update', 'updateMany', 'upsert']
      const deleteOps = ['delete', 'deleteMany']

      if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        params.action = params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow'
        params.args = params.args ?? {}
        params.args.where = { ...params.args.where, tenantId: ctx.tenantId }
      } else if (readOps.includes(params.action)) {
        params.args = params.args ?? {}
        params.args.where = { ...params.args.where, tenantId: ctx.tenantId }
      } else if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenantId: ctx.tenantId }
      } else if (params.action === 'createMany') {
        const rows = Array.isArray(params.args.data) ? params.args.data : [params.args.data]
        params.args.data = rows.map((row: object) => ({ ...row, tenantId: ctx.tenantId }))
      } else if (updateOps.includes(params.action)) {
        params.args.where = { ...params.args.where, tenantId: ctx.tenantId }
      } else if (deleteOps.includes(params.action)) {
        params.args.where = { ...params.args.where, tenantId: ctx.tenantId }
      }
    }

    return next(params)
  })

  return client
}

export const prisma = createPrismaClient()

const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async () => { await prisma.$disconnect() })
})

export default prismaPlugin

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient }
}
