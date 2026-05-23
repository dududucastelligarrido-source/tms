import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/reports/summary', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { startDate, endDate } = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }).parse(request.query)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const tenantId = (request as any).tenantId

    const [trips, costs, kmLogs] = await Promise.all([
      prisma.trip.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        include: { driver: true, vehicle: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tripCost.findMany({
        where: { trip: { tenantId }, paidAt: { gte: start, lte: end } },
      }),
      prisma.kmLog.findMany({
        where: { tenantId, loggedAt: { gte: start, lte: end }, eventType: { in: ['start', 'end'] } },
        include: { driver: true, vehicle: true },
      }),
    ])

    const costsByCategory = costs.reduce((acc: Record<string, number>, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + Number(c.amount)
      return acc
    }, {})

    const kmByDriver: Record<string, { name: string; km: number }> = {}
    const kmByVehicle: Record<string, { plate: string; model: string; km: number }> = {}

    for (const log of kmLogs) {
      if (log.eventType === 'end' && log.kmEnd != null) {
        const km = log.kmEnd - log.kmStart
        if (log.driver) {
          if (!kmByDriver[log.driverId]) kmByDriver[log.driverId] = { name: log.driver.name, km: 0 }
          kmByDriver[log.driverId].km += km
        }
        if (!kmByVehicle[log.vehicleId]) kmByVehicle[log.vehicleId] = { plate: (log.vehicle as any).plate, model: (log.vehicle as any).model, km: 0 }
        kmByVehicle[log.vehicleId].km += km
      }
    }

    return {
      period: { startDate, endDate },
      trips: trips.map(t => ({
        id: t.id,
        createdAt: t.createdAt,
        status: t.status,
        driver: t.driver?.name ?? '-',
        vehicle: `${(t.vehicle as any)?.plate ?? ''} ${(t.vehicle as any)?.model ?? ''}`.trim(),
        origin: t.originAddress,
        destination: t.destinationAddress,
        kmStart: t.kmStart,
        kmEnd: t.kmEnd,
        kmTotal: t.kmEnd != null ? t.kmEnd - t.kmStart : null,
        completedAt: t.completedAt,
      })),
      costs: {
        byCategory: costsByCategory,
        total: Object.values(costsByCategory).reduce((a, b) => a + b, 0),
      },
      kmByDriver: Object.values(kmByDriver).sort((a, b) => b.km - a.km),
      kmByVehicle: Object.values(kmByVehicle).sort((a, b) => b.km - a.km),
    }
  })
}
