import { z } from 'zod'
import { hash } from '@node-rs/argon2'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'motorista']),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/users', { preHandler: requireRole('admin') }, async (request) => {
    return prisma.user.findMany({
      where: { tenantId: (request as any).tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  })

  fastify.post('/users', { preHandler: requireRole('admin') }, async (request, reply) => {
    let data: z.infer<typeof CreateUserSchema>
    try { data = CreateUserSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const passwordHash = await hash(data.password)
    const user = await prisma.user.create({
      data: { tenantId: (request as any).tenantId, name: data.name, email: data.email, passwordHash, role: data.role } as any,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return reply.status(201).send(user)
  })

  fastify.delete('/users/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    if (id === request.user.sub) return reply.status(422).send({ error: 'Cannot deactivate your own account' })
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
