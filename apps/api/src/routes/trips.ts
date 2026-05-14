import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateTripSchema = z.object({
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  originAddress: z.string().min(1),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  destinationAddress: z.string().min(1),
  destinationLat: z.number().optional(),
  destinationLng: z.number().optional(),
  kmStart: z.number().int().min(0),
  notes: z.string().optional(),
})

export const tripRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/trips', async (request) => {
    const query = z.object({
      status: z.string().optional(),
      driverId: z.string().uuid().optional(),
      vehicleId: z.string().uuid().optional(),
    }).parse(request.query)

    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.driverId) where.driverId = query.driverId
    if (query.vehicleId) where.vehicleId = query.vehicleId

    if (request.user.role === 'motorista') {
      const driver = await prisma.driver.findFirst({ where: { userId: request.user.sub } })
      if (driver) where.driverId = driver.id
    }

    return prisma.trip.findMany({
      where,
      include: { driver: true, vehicle: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  fastify.get('/trips/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const trip = await prisma.trip.findFirstOrThrow({
      where: { id },
      include: { driver: true, vehicle: true, costs: true, checklists: { include: { responses: true } } },
    }).catch(() => reply.status(404).send({ error: 'Trip not found' }))
    return trip
  })

  fastify.post('/trips', { preHandler: requireRole('admin') }, async (request, reply) => {
    let data: z.infer<typeof CreateTripSchema>
    try { data = CreateTripSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const trip = await prisma.trip.create({
      data: { ...data, createdBy: request.user.sub },
    })
    return reply.status(201).send(trip)
  })

  fastify.patch('/trips/:id/start', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const trip = await prisma.trip.findFirstOrThrow({ where: { id } })

    if (trip.status !== 'draft') {
      return reply.status(422).send({ error: 'Trip must be in draft status to start' })
    }

    const departureChecklist = await prisma.tripChecklist.findFirst({
      where: { tripId: id, type: 'departure', completedAt: { not: null } },
    })
    if (!departureChecklist) {
      return reply.status(422).send({ error: 'Departure checklist must be completed before starting' })
    }

    await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: { status: 'active', startedAt: new Date() },
      }),
      prisma.kmLog.create({
        data: { tenantId: trip.tenantId, tripId: id, vehicleId: trip.vehicleId, driverId: trip.driverId, kmStart: trip.kmStart, eventType: 'start', loggedAt: new Date() },
      }),
    ])

    return prisma.trip.findFirstOrThrow({ where: { id } })
  })

  fastify.patch('/trips/:id/complete', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    let body: { kmEnd: number }
    try { body = z.object({ kmEnd: z.number().int().min(0) }).parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const trip = await prisma.trip.findFirstOrThrow({ where: { id } })

    if (trip.status !== 'active') {
      return reply.status(422).send({ error: 'Trip must be active to complete' })
    }
    if (body.kmEnd <= trip.kmStart) {
      return reply.status(422).send({ error: 'km_end must be greater than km_start' })
    }

    const arrivalChecklist = await prisma.tripChecklist.findFirst({
      where: { tripId: id, type: 'arrival', completedAt: { not: null } },
    })
    if (!arrivalChecklist) {
      return reply.status(422).send({ error: 'Arrival checklist must be completed before finishing' })
    }

    await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date(), kmEnd: body.kmEnd },
      }),
      prisma.kmLog.create({
        data: { tenantId: trip.tenantId, tripId: id, vehicleId: trip.vehicleId, driverId: trip.driverId, kmStart: trip.kmStart, kmEnd: body.kmEnd, eventType: 'end', loggedAt: new Date() },
      }),
      prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { currentKm: body.kmEnd },
      }),
    ])

    return prisma.trip.findFirstOrThrow({ where: { id } })
  })

  fastify.patch('/trips/:id/cancel', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const trip = await prisma.trip.findFirstOrThrow({ where: { id } })

    if (trip.status === 'completed') {
      return reply.status(422).send({ error: 'Cannot cancel a completed trip' })
    }

    return prisma.trip.update({ where: { id }, data: { status: 'cancelled' } })
  })

  fastify.patch('/trips/:id/change-driver', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    let body: { newDriverId: string; kmCurrent: number }
    try { body = z.object({ newDriverId: z.string().uuid(), kmCurrent: z.number().int().min(0) }).parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const trip = await prisma.trip.findFirstOrThrow({ where: { id } })

    if (trip.status !== 'active') {
      return reply.status(422).send({ error: 'Trip must be active to change driver' })
    }

    const template = await prisma.checklistTemplate.findFirst({
      where: { type: 'driver_change', isActive: true },
    })

    await prisma.$transaction([
      prisma.trip.update({ where: { id }, data: { driverId: body.newDriverId } }),
      prisma.kmLog.create({
        data: { tenantId: trip.tenantId, tripId: id, vehicleId: trip.vehicleId, driverId: trip.driverId, kmStart: trip.kmStart, kmEnd: body.kmCurrent, eventType: 'driver_change', loggedAt: new Date() },
      }),
      ...(template ? [prisma.tripChecklist.create({
        data: { tenantId: trip.tenantId, tripId: id, templateId: template.id, type: 'driver_change' },
      })] : []),
    ])

    return prisma.trip.findFirstOrThrow({ where: { id } })
  })
}
