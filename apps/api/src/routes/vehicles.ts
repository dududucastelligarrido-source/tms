import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateVehicleSchema = z.object({
  plate: z.string().min(1),
  model: z.string().min(1),
  brand: z.string().min(1),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  type: z.enum(['caminhao', 'van', 'utilitario', 'carreta', 'outro']),
  currentKm: z.number().int().min(0).default(0),
})

export const vehicleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/vehicles', async () => {
    return prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { plate: 'asc' } })
  })

  fastify.post('/vehicles', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const data = CreateVehicleSchema.parse(request.body)
    const vehicle = await prisma.vehicle.create({ data })
    return reply.status(201).send(vehicle)
  })
}
