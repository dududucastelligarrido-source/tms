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
    }).parse(request.query)

    return prisma.kmLog.findMany({
      where: query,
      include: { driver: true, vehicle: true, trip: true },
      orderBy: { loggedAt: 'desc' },
    })
  })
}
