import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const MAINTENANCE_TYPES = ['troca_oleo', 'pneu', 'freio', 'filtro', 'correia', 'revisao_geral', 'eletrica', 'outro'] as const

const CreateSchema = z.object({
  type: z.enum(MAINTENANCE_TYPES),
  description: z.string().min(1),
  performedAt: z.string().datetime(),
  kmAtService: z.number().int().min(0),
  cost: z.number().positive().optional(),
  nextServiceKm: z.number().int().min(0).optional(),
  nextServiceDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional(),
})

export const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/maintenance', async (request) => {
    const tenantId = request.user.tenantId
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, isActive: true },
      orderBy: { plate: 'asc' },
    })

    const results = await Promise.all(vehicles.map(async (vehicle) => {
      const latest = await prisma.vehicleMaintenance.findFirst({
        where: { vehicleId: vehicle.id },
        orderBy: { performedAt: 'desc' },
      })
      const kmRestantes = latest?.nextServiceKm ? latest.nextServiceKm - vehicle.currentKm : null
      const diasRestantes = latest?.nextServiceDate
        ? Math.ceil((new Date(latest.nextServiceDate).getTime() - Date.now()) / 86400000)
        : null

      let status: 'ok' | 'warning' | 'overdue' = 'ok'
      if (kmRestantes !== null && kmRestantes <= 0) status = 'overdue'
      else if (diasRestantes !== null && diasRestantes <= 0) status = 'overdue'
      else if (kmRestantes !== null && kmRestantes <= 5000) status = 'warning'
      else if (diasRestantes !== null && diasRestantes <= 30) status = 'warning'

      return { vehicle, latest, kmRestantes, diasRestantes, status }
    }))

    return results
  })

  fastify.get('/vehicles/:vehicleId/maintenance', async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(request.query)

    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: request.user.tenantId } })
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })

    const skip = (query.page - 1) * query.limit
    const [data, total] = await Promise.all([
      prisma.vehicleMaintenance.findMany({
        where: { vehicleId },
        orderBy: { performedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.vehicleMaintenance.count({ where: { vehicleId } }),
    ])
    return { data, total, page: query.page, pages: Math.ceil(total / query.limit) }
  })

  fastify.post('/vehicles/:vehicleId/maintenance', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: request.user.tenantId } })
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })

    let data: z.infer<typeof CreateSchema>
    try { data = CreateSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const record = await prisma.vehicleMaintenance.create({
      data: {
        tenantId: request.user.tenantId,
        vehicleId,
        type: data.type,
        description: data.description,
        performedAt: new Date(data.performedAt),
        kmAtService: data.kmAtService,
        cost: data.cost,
        nextServiceKm: data.nextServiceKm,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
        notes: data.notes,
        photoUrl: data.photoUrl,
        createdBy: request.user.sub,
      } as any,
    })
    return reply.status(201).send(record)
  })

  fastify.patch('/vehicles/:vehicleId/maintenance/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId, id } = z.object({ vehicleId: z.string().uuid(), id: z.string().uuid() }).parse(request.params)
    const record = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId, tenantId: request.user.tenantId } })
    if (!record) return reply.status(404).send({ error: 'Registro não encontrado' })

    let data: Partial<z.infer<typeof CreateSchema>>
    try { data = CreateSchema.partial().parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const updated = await prisma.vehicleMaintenance.update({
      where: { id },
      data: {
        ...data,
        ...(data.performedAt ? { performedAt: new Date(data.performedAt) } : {}),
        ...(data.nextServiceDate ? { nextServiceDate: new Date(data.nextServiceDate) } : {}),
      } as any,
    })
    return updated
  })

  fastify.delete('/vehicles/:vehicleId/maintenance/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId, id } = z.object({ vehicleId: z.string().uuid(), id: z.string().uuid() }).parse(request.params)
    const record = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId, tenantId: request.user.tenantId } })
    if (!record) return reply.status(404).send({ error: 'Registro não encontrado' })
    await prisma.vehicleMaintenance.delete({ where: { id } })
    return reply.status(204).send()
  })
}
