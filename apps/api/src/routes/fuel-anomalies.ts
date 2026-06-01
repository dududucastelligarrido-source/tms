import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { detectFuelAnomalies } from '../lib/fuel-anomalies.js'

export const fuelAnomalyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/fuel-anomalies', { preHandler: requireRole('admin') }, async (request) => {
    const { days } = z.object({
      days: z.coerce.number().int().min(1).max(365).default(90),
    }).parse(request.query)

    const anomalies = await detectFuelAnomalies((request as any).tenantId, days)
    return { data: anomalies, total: anomalies.length, days }
  })
}
