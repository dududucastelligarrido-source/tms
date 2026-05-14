import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateCostSchema = z.object({
  category: z.enum(['fuel', 'toll', 'meal', 'maintenance', 'other']),
  description: z.string().min(1),
  amount: z.number().positive(),
  paidAt: z.string().datetime(),
  receiptUrl: z.string().url().optional(),
})

export const costRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/trips/:tripId/costs', async (request) => {
    const { tripId } = z.object({ tripId: z.string().uuid() }).parse(request.params)
    return prisma.tripCost.findMany({ where: { tripId }, orderBy: { paidAt: 'desc' } })
  })

  fastify.post('/trips/:tripId/costs', async (request, reply) => {
    const { tripId } = z.object({ tripId: z.string().uuid() }).parse(request.params)
    let data: z.infer<typeof CreateCostSchema>
    try { data = CreateCostSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const trip = await prisma.trip.findFirstOrThrow({ where: { id: tripId } })
    if (trip.status === 'cancelled') {
      return reply.status(422).send({ error: 'Cannot add cost to cancelled trip' })
    }

    const cost = await prisma.tripCost.create({
      data: { ...data, tripId, createdBy: request.user.sub, paidAt: new Date(data.paidAt) },
    })
    return reply.status(201).send(cost)
  })

  fastify.delete('/trips/:tripId/costs/:costId', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { tripId, costId } = z.object({ tripId: z.string().uuid(), costId: z.string().uuid() }).parse(request.params)
    await prisma.tripCost.delete({ where: { id: costId, tripId } })
    return reply.status(204).send()
  })
}
