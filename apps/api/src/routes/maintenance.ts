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
})

export const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/vehicles/:vehicleId/maintenance', async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: (request as any).tenantId } })
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })

    return prisma.vehicleMaintenance.findMany({
      where: { vehicleId },
      orderBy: { performedAt: 'desc' },
    })
  })

  fastify.post('/vehicles/:vehicleId/maintenance', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: (request as any).tenantId } })
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })

    let data: z.infer<typeof CreateSchema>
    try { data = CreateSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const record = await prisma.vehicleMaintenance.create({
      data: {
        tenantId: (request as any).tenantId,
        vehicleId,
        type: data.type,
        description: data.description,
        performedAt: new Date(data.performedAt),
        kmAtService: data.kmAtService,
        cost: data.cost,
        nextServiceKm: data.nextServiceKm,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
        notes: data.notes,
        createdBy: request.user.sub,
      } as any,
    })
    return reply.status(201).send(record)
  })

  fastify.patch('/vehicles/:vehicleId/maintenance/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId, id } = z.object({ vehicleId: z.string().uuid(), id: z.string().uuid() }).parse(request.params)
    const record = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId, tenantId: (request as any).tenantId } })
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
    const record = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId, tenantId: (request as any).tenantId } })
    if (!record) return reply.status(404).send({ error: 'Registro não encontrado' })
    await prisma.vehicleMaintenance.delete({ where: { id } })
    return reply.status(204).send()
  })
}
