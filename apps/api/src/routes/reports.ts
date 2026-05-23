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
    const { period: periodStr } = z.object({ period: z.enum(['7', '30', '90']).default('30') }).parse(request.query)
    const period = Number(periodStr)

    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - (period - 1))
    start.setHours(0, 0, 0, 0)

    const [trips, costs, kmLogs, fuelLogs, allDrivers, activeTrips, allVehicles] = await Promise.all([
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
        where: { tenantId, loggedAt: { gte: start } },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.driver.findMany({ where: { tenantId, isActive: true } }),
      prisma.trip.findMany({ where: { tenantId, status: 'active' } }),
      prisma.vehicle.findMany({ where: { tenantId, isActive: true }, include: { maintenances: { orderBy: { performedAt: 'desc' }, take: 1 } } }),
    ])

    // ── KPIs financeiros ──────────────────────────────────────────────────
    const completedTrips = trips.filter(t => t.status === 'completed')
    const faturamento = completedTrips.reduce((s, t) => s + Number((t as any).cartaFrete ?? 0), 0)
    const custosDiretos = costs.reduce((s, c) => s + Number(c.amount), 0)
    const custosCombustivel = fuelLogs.reduce((s, f) => s + Number(f.totalAmount), 0)
    const custosTotal = custosDiretos + custosCombustivel
    const margem = faturamento - custosTotal
    const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0
    const kmRodados = completedTrips.reduce((s, t) => s + (t.kmEnd != null ? t.kmEnd - t.kmStart : 0), 0)

    // ── Viagens por dia ───────────────────────────────────────────────────
    const dayMap: Record<string, number> = {}
    for (let i = 0; i < period; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      dayMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const t of trips) {
      const day = t.createdAt.toISOString().slice(0, 10)
      if (day in dayMap) dayMap[day]++
    }

    // ── Faturamento vs Custos por semana/dia ─────────────────────────────
    function bucketLabel(date: Date): string {
      if (period === 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' })
      if (period === 30) return `Sem ${Math.ceil((date.getDate()) / 7)}`
      return date.toLocaleDateString('pt-BR', { month: 'short' })
    }

    const revenueMap: Record<string, { faturamento: number; custos: number }> = {}
    for (const t of completedTrips) {
      const label = bucketLabel(new Date(t.completedAt ?? t.createdAt))
      if (!revenueMap[label]) revenueMap[label] = { faturamento: 0, custos: 0 }
      revenueMap[label].faturamento += Number((t as any).cartaFrete ?? 0)
    }
    for (const c of costs) {
      const label = bucketLabel(new Date(c.paidAt))
      if (!revenueMap[label]) revenueMap[label] = { faturamento: 0, custos: 0 }
      revenueMap[label].custos += Number(c.amount)
    }
    for (const f of fuelLogs) {
      const label = bucketLabel(new Date(f.loggedAt))
      if (!revenueMap[label]) revenueMap[label] = { faturamento: 0, custos: 0 }
      revenueMap[label].custos += Number(f.totalAmount)
    }

    // ── Custos por categoria ──────────────────────────────────────────────
    const costsByCategory: Record<string, number> = {}
    for (const c of costs) {
      costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + Number(c.amount)
    }

    // ── KM por motorista (top 5) ──────────────────────────────────────────
    const kmByDriver: Record<string, { name: string; km: number }> = {}
    for (const log of kmLogs) {
      if (log.kmEnd == null) continue
      const km = log.kmEnd - log.kmStart
      if (!kmByDriver[log.driverId]) kmByDriver[log.driverId] = { name: (log.driver as any).name, km: 0 }
      kmByDriver[log.driverId].km += km
    }

    // ── Média KM/L da frota ───────────────────────────────────────────────
    const dieselLogs = fuelLogs.filter(f => f.fuelType === 'diesel' && f.kmPerLiter)
    const mediaKmL = dieselLogs.length > 0
      ? dieselLogs.reduce((s, f) => s + Number(f.kmPerLiter), 0) / dieselLogs.length
      : null

    // ── Alertas ───────────────────────────────────────────────────────────
    const in30days = new Date(); in30days.setDate(in30days.getDate() + 30)
    const cnhExpirando = allDrivers
      .filter(d => d.cnhExpiresAt <= in30days)
      .map(d => ({
        name: d.name,
        cnhExpiresAt: d.cnhExpiresAt,
        daysLeft: Math.ceil((d.cnhExpiresAt.getTime() - Date.now()) / 86400000),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)

    const now = Date.now()
    const viagensLongas = activeTrips
      .filter(t => t.startedAt && (now - t.startedAt.getTime()) > 48 * 3600 * 1000)
      .map(t => ({
        id: t.id,
        origin: t.originAddress,
        destination: t.destinationAddress,
        hoursActive: Math.floor((now - t.startedAt!.getTime()) / 3600000),
      }))

    // Veículos com manutenção vencida ou próxima (5000 km ou 30 dias)
    const manutencaoPendente = allVehicles
      .filter(v => {
        const last = (v as any).maintenances[0]
        if (!last) return false
        const kmAlerta = last.nextServiceKm && v.currentKm >= last.nextServiceKm - 5000
        const dataAlerta = last.nextServiceDate && new Date(last.nextServiceDate) <= in30days
        return kmAlerta || dataAlerta
      })
      .map(v => {
        const last = (v as any).maintenances[0]
        return {
          vehicleId: v.id,
          plate: v.plate,
          model: `${v.brand} ${v.model}`,
          currentKm: v.currentKm,
          nextServiceKm: last.nextServiceKm,
          nextServiceDate: last.nextServiceDate,
          kmRestantes: last.nextServiceKm ? last.nextServiceKm - v.currentKm : null,
        }
      })

    return {
      period,
      kpis: {
        faturamento: Number(faturamento.toFixed(2)),
        custosDiretos: Number(custosDiretos.toFixed(2)),
        custosCombustivel: Number(custosCombustivel.toFixed(2)),
        custosTotal: Number(custosTotal.toFixed(2)),
        margem: Number(margem.toFixed(2)),
        margemPct: Number(margemPct.toFixed(1)),
        kmRodados,
        mediaKmL: mediaKmL ? Number(mediaKmL.toFixed(2)) : null,
        viagens: {
          total: trips.length,
          completed: completedTrips.length,
          active: trips.filter(t => t.status === 'active').length,
          draft: trips.filter(t => t.status === 'draft').length,
          cancelled: trips.filter(t => t.status === 'cancelled').length,
        },
      },
      tripsPerDay: Object.entries(dayMap).map(([date, count]) => ({ date: date.slice(5), count })),
      revenueVsCosts: Object.entries(revenueMap).map(([label, v]) => ({
        label,
        faturamento: Number(v.faturamento.toFixed(2)),
        custos: Number(v.custos.toFixed(2)),
      })),
      costsByCategory: Object.entries(costsByCategory)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value),
      kmByDriver: Object.values(kmByDriver).sort((a, b) => b.km - a.km).slice(0, 5),
      alerts: { cnhExpirando, viagensLongas, manutencaoPendente },
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
