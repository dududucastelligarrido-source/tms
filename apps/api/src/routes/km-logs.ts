import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

export const kmLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)
  fastify.addHook('preHandler', requireRole('admin'))

  fastify.get('/km-logs', async (request) => {
    const query = z.object({
      vehicleId: z.string().uuid().optional(),
      driverId: z.string().uuid().optional(),
      tripId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(request.query)

    const { page, limit, ...filters } = query
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      prisma.kmLog.findMany({
        where: filters,
        include: { driver: true, vehicle: true, trip: true },
        orderBy: { loggedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.kmLog.count({ where: filters }),
    ])
    return { data, total, page, pages: Math.ceil(total / limit) }
  })
}
