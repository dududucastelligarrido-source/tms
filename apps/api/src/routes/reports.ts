import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CATEGORY_LABELS: Record<string, string> = {
  pedagio: 'Pedágio',
  manutencao: 'Manutenção',
  alimentacao: 'Alimentação',
  hospedagem: 'Hospedagem',
  multa: 'Multa',
  lavagem: 'Lavagem',
  pneu: 'Pneu',
  outros: 'Outros',
}

function categoryLabel(raw: string): string {
  const normalized = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return CATEGORY_LABELS[normalized] ?? raw
}

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/reports/dashboard', { preHandler: requireRole('admin') }, async (request) => {
    const tenantId = request.user.tenantId
    const { period: periodStr } = z.object({ period: z.enum(['7', '30', '90']).default('30') }).parse(request.query)
    const period = Number(periodStr)

    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - (period - 1))
    start.setHours(0, 0, 0, 0)

    // Período anterior para comparativo
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1); prevEnd.setHours(23, 59, 59, 999)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (period - 1)); prevStart.setHours(0, 0, 0, 0)

    const [trips, costs, kmLogs, fuelLogs, allDrivers, activeTripsRaw, allVehicles, prevTrips, prevCosts, prevFuel] = await Promise.all([
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
      prisma.fuelLog.findMany({ where: { tenantId, loggedAt: { gte: start } }, orderBy: { loggedAt: 'asc' } }),
      prisma.driver.findMany({ where: { tenantId, isActive: true } }),
      prisma.trip.findMany({ where: { tenantId, status: 'active' }, include: { driver: true, vehicle: true } }),
      prisma.vehicle.findMany({ where: { tenantId, isActive: true }, include: { maintenances: { orderBy: { performedAt: 'desc' }, take: 1 } } }),
      // período anterior
      prisma.trip.findMany({ where: { tenantId, createdAt: { gte: prevStart, lte: prevEnd }, status: 'completed' } }),
      prisma.tripCost.findMany({ where: { trip: { tenantId }, paidAt: { gte: prevStart, lte: prevEnd } } }),
      prisma.fuelLog.findMany({ where: { tenantId, loggedAt: { gte: prevStart, lte: prevEnd } } }),
    ])

    const activeTrips = activeTripsRaw

    // ── Comparativo período anterior ──────────────────────────────────────
    const prevFaturamento = prevTrips.reduce((s, t) => s + Number((t as any).cartaFrete ?? 0), 0)
    const prevCustosTotal = prevCosts.reduce((s, c) => s + Number(c.amount), 0) + prevFuel.reduce((s, f) => s + Number(f.totalAmount), 0)
    const prevKm = prevTrips.reduce((s, t) => s + (t.kmEnd != null ? t.kmEnd - t.kmStart : 0), 0)
    const prevMargem = prevFaturamento - prevCustosTotal
    function pct(cur: number, prev: number) { return prev === 0 ? null : Number(((cur - prev) / prev * 100).toFixed(1)) }

    // ── KPIs financeiros ──────────────────────────────────────────────────
    const completedTrips = trips.filter(t => t.status === 'completed')
    const faturamento = completedTrips.reduce((s, t) => s + Number((t as any).cartaFrete ?? 0), 0)
    const custosDiretos = costs.reduce((s, c) => s + Number(c.amount), 0)
    const custosCombustivel = fuelLogs.reduce((s, f) => s + Number(f.totalAmount), 0)
    const custosTotal = custosDiretos + custosCombustivel
    const margem = faturamento - custosTotal
    const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0
    const kmRodados = completedTrips.reduce((s, t) => s + (t.kmEnd != null ? t.kmEnd - t.kmStart : 0), 0)
    const custoPorKm = kmRodados > 0 ? custosTotal / kmRodados : 0
    const ticketMedio = completedTrips.length > 0 ? faturamento / completedTrips.length : 0

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
      if (period === 30) {
        const dayOfPeriod = Math.floor((date.getTime() - start.getTime()) / 86400000)
        return `Sem ${Math.floor(dayOfPeriod / 7) + 1}`
      }
      return date.toLocaleDateString('pt-BR', { month: 'short' })
    }

    function generateAllBuckets(): string[] {
      if (period === 7) {
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start); d.setDate(d.getDate() + i)
          return d.toLocaleDateString('pt-BR', { weekday: 'short' })
        })
      }
      if (period === 30) {
        const labels: string[] = []
        for (let w = 0; w < 5; w++) {
          const d = new Date(start); d.setDate(d.getDate() + w * 7)
          if (d <= end) labels.push(`Sem ${w + 1}`)
        }
        return labels
      }
      const seen = new Set<string>(); const labels: string[] = []
      for (let i = 0; i < 90; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i)
        const m = d.toLocaleDateString('pt-BR', { month: 'short' })
        if (!seen.has(m)) { seen.add(m); labels.push(m) }
      }
      return labels
    }

    const todayLabel = bucketLabel(new Date())
    const revenueMap: Record<string, { faturamento: number; custos: number; isCurrent: boolean }> = {}
    for (const label of generateAllBuckets()) {
      revenueMap[label] = { faturamento: 0, custos: 0, isCurrent: label === todayLabel }
    }
    for (const t of completedTrips) {
      const label = bucketLabel(new Date(t.completedAt ?? t.createdAt))
      if (revenueMap[label]) revenueMap[label].faturamento += Number((t as any).cartaFrete ?? 0)
    }
    for (const c of costs) {
      const label = bucketLabel(new Date(c.paidAt))
      if (revenueMap[label]) revenueMap[label].custos += Number(c.amount)
    }
    for (const f of fuelLogs) {
      const label = bucketLabel(new Date(f.loggedAt))
      if (revenueMap[label]) revenueMap[label].custos += Number(f.totalAmount)
    }

    // ── Custos por categoria ──────────────────────────────────────────────
    const costsByCategory: Record<string, number> = {}
    for (const c of costs) {
      const label = categoryLabel(c.category)
      costsByCategory[label] = (costsByCategory[label] ?? 0) + Number(c.amount)
    }

    // ── KM por motorista (top 5) ──────────────────────────────────────────
    const kmByDriver: Record<string, { name: string; km: number }> = {}
    for (const log of kmLogs) {
      if (log.kmEnd == null) continue
      const km = log.kmEnd - log.kmStart
      if (!kmByDriver[log.driverId]) kmByDriver[log.driverId] = { name: (log.driver as any).name, km: 0 }
      kmByDriver[log.driverId].km += km
    }

    const in30days = new Date(); in30days.setDate(in30days.getDate() + 30)

    // ── Ranking de motoristas ─────────────────────────────────────────────
    const driverRankMap: Record<string, { name: string; km: number; viagens: number; faturamento: number }> = {}
    for (const t of completedTrips) {
      const d = t.driver as any
      if (!d) continue
      if (!driverRankMap[t.driverId!]) driverRankMap[t.driverId!] = { name: d.name, km: 0, viagens: 0, faturamento: 0 }
      driverRankMap[t.driverId!].viagens++
      driverRankMap[t.driverId!].faturamento += Number((t as any).cartaFrete ?? 0)
      if (t.kmEnd != null) driverRankMap[t.driverId!].km += t.kmEnd - t.kmStart
    }
    const driverRanking = Object.values(driverRankMap)
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 5)
      .map(d => ({ ...d, faturamento: Number(d.faturamento.toFixed(2)) }))

    // ── Resumo de frota ───────────────────────────────────────────────────
    const vehicleIdsAtiva = new Set(activeTrips.map(t => t.vehicleId).filter(Boolean))
    const vehicleIdsAlerta = new Set(
      allVehicles.filter(v => {
        const last = (v as any).maintenances[0]
        if (!last) return false
        return (last.nextServiceKm && v.currentKm >= last.nextServiceKm - 5000) ||
               (last.nextServiceDate && new Date(last.nextServiceDate) <= in30days)
      }).map(v => v.id)
    )
    const fleetSummary = {
      total: allVehicles.length,
      emViagem: vehicleIdsAtiva.size,
      ociosos: allVehicles.length - vehicleIdsAtiva.size,
      manutencaoPendente: vehicleIdsAlerta.size,
    }

    // ── Viagens ativas em destaque ────────────────────────────────────────
    const activeTripsDetail = activeTrips.map(t => ({
      id: t.id,
      origin: t.originAddress,
      destination: t.destinationAddress,
      driver: (t.driver as any)?.name ?? null,
      vehicle: (t.vehicle as any)?.plate ?? null,
      startedAt: t.startedAt,
      hoursActive: t.startedAt ? Math.floor((Date.now() - t.startedAt.getTime()) / 3600000) : null,
      cartaFrete: t.cartaFrete ? Number(t.cartaFrete) : null,
    }))

    // ── Daily trend (últimos 7 dias, para sparklines) ────────────────────
    const spark7start = new Date(); spark7start.setDate(spark7start.getDate() - 6); spark7start.setHours(0, 0, 0, 0)
    const sparkMap: Record<string, { faturamento: number; custos: number }> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(spark7start); d.setDate(d.getDate() + i)
      sparkMap[d.toISOString().slice(0, 10)] = { faturamento: 0, custos: 0 }
    }
    for (const t of completedTrips) {
      const day = (t.completedAt ?? t.createdAt).toISOString().slice(0, 10)
      if (day in sparkMap) sparkMap[day].faturamento += Number((t as any).cartaFrete ?? 0)
    }
    for (const c of costs) {
      const day = new Date(c.paidAt).toISOString().slice(0, 10)
      if (day in sparkMap) sparkMap[day].custos += Number(c.amount)
    }
    for (const f of fuelLogs) {
      const day = new Date(f.loggedAt).toISOString().slice(0, 10)
      if (day in sparkMap) sparkMap[day].custos += Number(f.totalAmount)
    }
    const dailyTrend = Object.values(sparkMap).map(v => ({
      faturamento: Number(v.faturamento.toFixed(2)),
      custos: Number(v.custos.toFixed(2)),
    }))

    // ── Média KM/L da frota ───────────────────────────────────────────────
    const dieselLogs = fuelLogs.filter(f => f.fuelType === 'diesel' && f.kmPerLiter)
    const mediaKmL = dieselLogs.length > 0
      ? dieselLogs.reduce((s, f) => s + Number(f.kmPerLiter), 0) / dieselLogs.length
      : null

    // ── Alertas ───────────────────────────────────────────────────────────
    const cnhExpirando = allDrivers
      .filter(d => d.cnhExpiresAt <= in30days)
      .map(d => {
        const daysLeft = Math.ceil((d.cnhExpiresAt.getTime() - Date.now()) / 86400000)
        return { name: d.name, cnhExpiresAt: d.cnhExpiresAt, daysLeft, expired: daysLeft < 0 }
      })
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

    // Veículos sem viagem nos últimos 7 dias
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentVehicleIds = new Set<string>([
      ...activeTrips.map(t => t.vehicleId).filter((id): id is string => !!id),
      ...completedTrips
        .filter(t => t.completedAt && t.completedAt >= sevenDaysAgo)
        .map(t => t.vehicleId).filter((id): id is string => !!id),
    ])
    const veiculosParados = allVehicles
      .filter(v => !recentVehicleIds.has(v.id))
      .map(v => ({ vehicleId: v.id, plate: v.plate, model: `${v.brand} ${v.model}`.trim() }))

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
        custoPorKm: Number(custoPorKm.toFixed(2)),
        ticketMedio: Number(ticketMedio.toFixed(2)),
        mediaKmL: mediaKmL ? Number(mediaKmL.toFixed(2)) : null,
        viagens: {
          total: trips.length,
          completed: completedTrips.length,
          active: trips.filter(t => t.status === 'active').length,
          draft: trips.filter(t => t.status === 'draft').length,
          cancelled: trips.filter(t => t.status === 'cancelled').length,
        },
      },
      trends: {
        faturamento: pct(faturamento, prevFaturamento),
        custosTotal: pct(custosTotal, prevCustosTotal),
        margem: pct(margem, prevMargem),
        kmRodados: pct(kmRodados, prevKm),
      },
      tripsPerDay: Object.entries(dayMap).map(([date, count]) => ({ date: date.slice(5), count })),
      revenueVsCosts: Object.entries(revenueMap).map(([label, v]) => ({
        label,
        faturamento: Number(v.faturamento.toFixed(2)),
        custos: Number(v.custos.toFixed(2)),
        isCurrent: v.isCurrent,
      })),
      costsByCategory: Object.entries(costsByCategory)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value),
      kmByDriver: Object.values(kmByDriver).sort((a, b) => b.km - a.km).slice(0, 5),
      driverRanking,
      fleetSummary,
      activeTripsDetail,
      dailyTrend,
      alerts: { cnhExpirando, viagensLongas, manutencaoPendente, veiculosParados },
    }
  })

  fastify.get('/reports/summary', { preHandler: requireRole('admin') }, async (request) => {
    const { startDate, endDate } = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }).parse(request.query)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const tenantId = request.user.tenantId

    const [trips, costs, kmLogs, fuelLogs] = await Promise.all([
      prisma.trip.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        include: { driver: true, vehicle: true, costs: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tripCost.findMany({
        where: { trip: { tenantId }, paidAt: { gte: start, lte: end } },
      }),
      prisma.kmLog.findMany({
        where: { tenantId, loggedAt: { gte: start, lte: end }, eventType: { in: ['start', 'end'] } },
        include: { driver: true, vehicle: true },
      }),
      prisma.fuelLog.findMany({
        where: { tenantId, loggedAt: { gte: start, lte: end } },
        include: { vehicle: true },
        orderBy: { loggedAt: 'asc' },
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

    // ── Combustível ────────────────────────────────────────────────────────
    const fuelTotalLiters = fuelLogs.reduce((s, f) => s + Number(f.liters), 0)
    const fuelTotalSpend = fuelLogs.reduce((s, f) => s + Number(f.totalAmount), 0)
    const dieselWithKmL = fuelLogs.filter(f => f.fuelType === 'diesel' && f.kmPerLiter)
    const avgKmL = dieselWithKmL.length > 0
      ? dieselWithKmL.reduce((s, f) => s + Number(f.kmPerLiter), 0) / dieselWithKmL.length
      : null

    const fuelByVehicle: Record<string, { plate: string; model: string; liters: number; spend: number }> = {}
    for (const f of fuelLogs) {
      const v = f.vehicle as any
      if (!fuelByVehicle[f.vehicleId]) fuelByVehicle[f.vehicleId] = { plate: v?.plate ?? '-', model: v?.model ?? '-', liters: 0, spend: 0 }
      fuelByVehicle[f.vehicleId].liters += Number(f.liters)
      fuelByVehicle[f.vehicleId].spend += Number(f.totalAmount)
    }

    // ── Custo por veículo (viagem + combustível) ───────────────────────────
    const costByVehicle: Record<string, { plate: string; model: string; tripCosts: number; fuelCosts: number }> = {}
    for (const t of trips) {
      const v = t.vehicle as any
      if (!v) continue
      if (!costByVehicle[t.vehicleId!]) costByVehicle[t.vehicleId!] = { plate: v.plate, model: v.model, tripCosts: 0, fuelCosts: 0 }
      for (const c of (t as any).costs ?? []) {
        costByVehicle[t.vehicleId!].tripCosts += Number(c.amount)
      }
    }
    for (const f of fuelLogs) {
      const v = f.vehicle as any
      if (!costByVehicle[f.vehicleId]) costByVehicle[f.vehicleId] = { plate: v?.plate ?? '-', model: v?.model ?? '-', tripCosts: 0, fuelCosts: 0 }
      costByVehicle[f.vehicleId].fuelCosts += Number(f.totalAmount)
    }

    const totalCosts = costs.reduce((s, c) => s + Number(c.amount), 0) + fuelTotalSpend

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
        totalCosts: ((t as any).costs ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0),
      })),
      costs: {
        byCategory: costsByCategory,
        total: totalCosts,
        fuel: {
          totalLiters: Number(fuelTotalLiters.toFixed(3)),
          totalSpend: Number(fuelTotalSpend.toFixed(2)),
          avgKmL: avgKmL ? Number(avgKmL.toFixed(2)) : null,
          byVehicle: Object.values(fuelByVehicle).sort((a, b) => b.spend - a.spend),
        },
      },
      costByVehicle: Object.values(costByVehicle)
        .map(v => ({ ...v, total: Number((v.tripCosts + v.fuelCosts).toFixed(2)), tripCosts: Number(v.tripCosts.toFixed(2)), fuelCosts: Number(v.fuelCosts.toFixed(2)) }))
        .sort((a, b) => b.total - a.total),
      kmByDriver: Object.values(kmByDriver).sort((a, b) => b.km - a.km),
      kmByVehicle: Object.values(kmByVehicle).sort((a, b) => b.km - a.km),
    }
  })
}
