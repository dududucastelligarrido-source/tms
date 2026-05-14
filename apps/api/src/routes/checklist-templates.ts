import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['departure', 'arrival', 'driver_change']),
  items: z.array(z.object({
    description: z.string().min(1),
    isRequired: z.boolean().default(true),
    orderIndex: z.number().int().min(0),
  })).min(1),
})

export const checklistTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/checklist-templates', async () => {
    return prisma.checklistTemplate.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    })
  })

  fastify.post('/checklist-templates', { preHandler: requireRole('admin') }, async (request, reply) => {
    let parsed: z.infer<typeof CreateTemplateSchema>
    try { parsed = CreateTemplateSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const { items, ...templateData } = parsed
    const template = await prisma.checklistTemplate.create({
      data: { ...templateData, items: { create: items } },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    })
    return reply.status(201).send(template)
  })

  fastify.delete('/checklist-templates/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await prisma.checklistTemplate.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
