import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/reports/dashboard', { preHandler: requireRole('admin') }, async (request) => {
    const tenantId = (request as any).tenantId
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)

    const [trips, costs, kmLogs, fuelLogs] = await Promise.all([
      prisma.trip.findMany({
        where: { tenantId, createdAt: { gte: start } },
        include: { driver: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tripCost.findMany({ where: { trip: { tenantId }, paidAt: { gte: start } } }),
      prisma.kmLog.findMany({
        where: { tenantId, eventType: 'end', loggedAt: { gte: start } },
        include: { driver: true, vehicle: true },
      }),
      prisma.fuelLog.findMany({
        where: { tenantId, loggedAt: { gte: start }, fuelType: 'diesel' },
        orderBy: { loggedAt: 'asc' },
      }),
    ])

    // Trips per day (last 30 days)
    const dayMap: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      dayMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const t of trips) {
      const day = t.createdAt.toISOString().slice(0, 10)
      if (day in dayMap) dayMap[day]++
    }

    // Costs by category
    const costsByCategory: Record<string, number> = {}
    for (const c of costs) {
      costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + Number(c.amount)
    }

    // KM by driver (top 5)
    const kmByDriver: Record<string, { name: string; km: number }> = {}
    for (const log of kmLogs) {
      if (log.kmEnd == null) continue
      const km = log.kmEnd - log.kmStart
      if (!kmByDriver[log.driverId]) kmByDriver[log.driverId] = { name: (log.driver as any).name, km: 0 }
      kmByDriver[log.driverId].km += km
    }

    // Fuel KM/L trend (weekly avg)
    const weekMap: Record<string, { sum: number; count: number }> = {}
    for (const f of fuelLogs) {
      if (!f.kmPerLiter) continue
      const week = `Sem ${Math.ceil((new Date(f.loggedAt).getDate()) / 7)}`
      if (!weekMap[week]) weekMap[week] = { sum: 0, count: 0 }
      weekMap[week].sum += Number(f.kmPerLiter)
      weekMap[week].count++
    }

    return {
      tripsPerDay: Object.entries(dayMap).map(([date, count]) => ({ date: date.slice(5), count })),
      costsByCategory: Object.entries(costsByCategory)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value),
      kmByDriver: Object.values(kmByDriver)
        .sort((a, b) => b.km - a.km)
        .slice(0, 5),
      fuelTrend: Object.entries(weekMap).map(([week, { sum, count }]) => ({
        week,
        kmPerLiter: Number((sum / count).toFixed(2)),
      })),
    }
  })

  fastify.get('/reports/summary', { preHandler: requireRole('admin') }, async (request) => {
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

    const tripsByDay: Record<string, number> = {}
    for (const t of trips) {
      const day = t.createdAt.toISOString().slice(0, 10)
      tripsByDay[day] = (tripsByDay[day] ?? 0) + 1
    }

    return {
      period: { startDate, endDate },
      tripsByDay: Object.entries(tripsByDay).map(([date, count]) => ({ date, count })),
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
