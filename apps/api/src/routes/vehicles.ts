import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

function isValidPlate(raw: string): boolean {
  const p = raw.replace('-', '').toUpperCase()
  return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p)
}

const CreateVehicleSchema = z.object({
  plate: z.string().min(7).max(8).transform(s => s.toUpperCase()).refine(isValidPlate, { message: 'Placa inválida. Use ABC-1234 ou Mercosul ABC1D234' }),
  model: z.string().min(1),
  brand: z.string().min(1),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  type: z.enum(['caminhao', 'van', 'utilitario', 'carreta', 'outro']),
  currentKm: z.number().int().min(0).default(0),
})

export const vehicleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/vehicles', async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(request.query)
    return prisma.vehicle.findMany({ where: { tenantId: (request as any).tenantId, isActive: true }, orderBy: { plate: 'asc' }, take: limit })
  })

  fastify.get('/vehicles/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { id } }).catch(() => {
      return reply.status(404).send({ error: 'Vehicle not found' })
    })
    return vehicle
  })

  fastify.post('/vehicles', { preHandler: requireRole('admin') }, async (request, reply) => {
    let data: z.infer<typeof CreateVehicleSchema>
    try { data = CreateVehicleSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const vehicle = await prisma.vehicle.create({ data: data as any })
    return reply.status(201).send(vehicle)
  })

  fastify.patch('/vehicles/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    let data: Partial<z.infer<typeof CreateVehicleSchema>>
    try { data = CreateVehicleSchema.partial().parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const vehicle = await prisma.vehicle.update({ where: { id }, data }).catch(() =>
      reply.status(404).send({ error: 'Vehicle not found' })
    )
    return vehicle
  })

  fastify.delete('/vehicles/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await prisma.vehicle.update({ where: { id }, data: { isActive: false } }).catch(() =>
      reply.status(404).send({ error: 'Vehicle not found' })
    )
    return reply.status(204).send()
  })
}
