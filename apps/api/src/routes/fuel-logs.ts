import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateFuelLogSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  tripId: z.string().uuid().optional(),
  loggedAt: z.string().datetime(),
  fuelType: z.enum(['diesel', 'arla']),
  liters: z.number().positive(),
  pricePerLiter: z.number().positive(),
  station: z.string().optional(),
  kmAtFueling: z.number().int().min(0),
})

export const fuelLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/fuel-logs', async (request) => {
    const query = z.object({
      vehicleId: z.string().uuid().optional(),
      driverId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(request.query)

    const where: Record<string, unknown> = { tenantId: (request as any).tenantId }
    if (query.vehicleId) where.vehicleId = query.vehicleId
    if (query.driverId) where.driverId = query.driverId
    if (query.startDate || query.endDate) {
      where.loggedAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      }
    }

    const skip = (query.page - 1) * query.limit
    const [data, total] = await Promise.all([
      prisma.fuelLog.findMany({
        where,
        include: { vehicle: true, driver: true },
        orderBy: { loggedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.fuelLog.count({ where }),
    ])

    return { data, total, page: query.page, pages: Math.ceil(total / query.limit) }
  })

  fastify.post('/fuel-logs', async (request, reply) => {
    let data: z.infer<typeof CreateFuelLogSchema>
    try { data = CreateFuelLogSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const totalAmount = data.liters * data.pricePerLiter

    const prevLog = await prisma.fuelLog.findFirst({
      where: { tenantId: (request as any).tenantId, vehicleId: data.vehicleId, fuelType: 'diesel' },
      orderBy: { loggedAt: 'desc' },
    })
    const kmPerLiter = prevLog && data.fuelType === 'diesel'
      ? (data.kmAtFueling - prevLog.kmAtFueling) / data.liters
      : null

    const log = await prisma.fuelLog.create({
      data: {
        tenantId: (request as any).tenantId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        tripId: data.tripId,
        loggedAt: new Date(data.loggedAt),
        fuelType: data.fuelType,
        liters: data.liters,
        pricePerLiter: data.pricePerLiter,
        totalAmount,
        station: data.station,
        kmAtFueling: data.kmAtFueling,
        ...(kmPerLiter && kmPerLiter > 0 ? { kmPerLiter } : {}),
      } as any,
      include: { vehicle: true, driver: true },
    })
    return reply.status(201).send(log)
  })

  fastify.delete('/fuel-logs/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await prisma.fuelLog.delete({ where: { id } })
    return reply.status(204).send()
  })
}
