import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateDriverSchema = z.object({
  name: z.string().min(1),
  cpf: z.string().length(11),
  cnhNumber: z.string().min(1),
  cnhCategory: z.enum(['A', 'B', 'C', 'D', 'E']),
  cnhExpiresAt: z.string().datetime(),
  userId: z.string().uuid().optional(),
})

export const driverRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/drivers', async () => {
    return prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  })

  fastify.get('/drivers/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const driver = await prisma.driver.findFirstOrThrow({ where: { id } }).catch(() => {
      return reply.status(404).send({ error: 'Driver not found' })
    })
    return driver
  })

  fastify.post('/drivers', { preHandler: requireRole('admin') }, async (request, reply) => {
    let data: z.infer<typeof CreateDriverSchema>
    try { data = CreateDriverSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const driver = await prisma.driver.create({ data: { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt) } })
    return reply.status(201).send(driver)
  })

  fastify.patch('/drivers/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    let data: Partial<z.infer<typeof CreateDriverSchema>>
    try { data = CreateDriverSchema.partial().parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }
    const driver = await prisma.driver.update({
      where: { id },
      data: { ...data, ...(data.cnhExpiresAt ? { cnhExpiresAt: new Date(data.cnhExpiresAt) } : {}) },
    }).catch(() => reply.status(404).send({ error: 'Driver not found' }))
    return driver
  })
}
