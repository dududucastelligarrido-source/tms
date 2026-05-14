import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { prisma } from '../plugins/prisma.js'

export const tripChecklistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.post('/trips/:tripId/checklists', async (request, reply) => {
    const { tripId } = z.object({ tripId: z.string().uuid() }).parse(request.params)
    let body: { templateId: string; type: string }
    try { body = z.object({ templateId: z.string().uuid(), type: z.enum(['departure', 'arrival', 'driver_change']) }).parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    await prisma.trip.findFirstOrThrow({ where: { id: tripId } })
    await prisma.checklistTemplate.findFirstOrThrow({ where: { id: body.templateId } })

    const checklist = await prisma.tripChecklist.create({
      data: { tripId, templateId: body.templateId, type: body.type },
      include: { template: { include: { items: { orderBy: { orderIndex: 'asc' } } } } },
    })
    return reply.status(201).send(checklist)
  })

  fastify.get('/checklists/:checklistId', async (request, reply) => {
    const { checklistId } = z.object({ checklistId: z.string().uuid() }).parse(request.params)
    const checklist = await prisma.tripChecklist.findFirstOrThrow({
      where: { id: checklistId },
      include: { template: { include: { items: { orderBy: { orderIndex: 'asc' } } } }, responses: true },
    }).catch(() => reply.status(404).send({ error: 'Checklist not found' }))
    return checklist
  })

  fastify.patch('/checklists/:checklistId/respond', async (request, reply) => {
    const { checklistId } = z.object({ checklistId: z.string().uuid() }).parse(request.params)
    let body: { responses: Array<{ itemId: string; passed: boolean; notes?: string; photoUrl?: string }> }
    try {
      body = z.object({
        responses: z.array(z.object({
          itemId: z.string().uuid(),
          passed: z.boolean(),
          notes: z.string().optional(),
          photoUrl: z.string().url().optional(),
        })),
      }).parse(request.body)
    } catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const checklist = await prisma.tripChecklist.findFirstOrThrow({
      where: { id: checklistId },
      include: { template: { include: { items: true } } },
    })

    const requiredItems = checklist.template.items.filter(i => i.isRequired).map(i => i.id)
    const respondedIds = body.responses.map(r => r.itemId)
    const missingRequired = requiredItems.filter(id => !respondedIds.includes(id))
    if (missingRequired.length > 0) {
      return reply.status(422).send({ error: 'Missing required checklist items', missing: missingRequired })
    }

    await prisma.$transaction([
      ...body.responses.map(r =>
        prisma.checklistResponse.upsert({
          where: { tripChecklistId_itemId: { tripChecklistId: checklistId, itemId: r.itemId } },
          create: { tripChecklistId: checklistId, ...r },
          update: { passed: r.passed, notes: r.notes, photoUrl: r.photoUrl },
        })
      ),
      prisma.tripChecklist.update({
        where: { id: checklistId },
        data: { completedAt: new Date(), completedBy: request.user.sub },
      }),
    ])

    return prisma.tripChecklist.findFirstOrThrow({
      where: { id: checklistId },
      include: { responses: true },
    })
  })
}
