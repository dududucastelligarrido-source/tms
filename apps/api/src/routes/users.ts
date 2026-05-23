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

  fastify.get('/users/me', async (request) => {
    return prisma.user.findFirstOrThrow({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true, role: true },
    })
  })

  fastify.patch('/users/me', async (request, reply) => {
    const UpdateMeSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6).optional(),
    })
    let data: z.infer<typeof UpdateMeSchema>
    try { data = UpdateMeSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const user = await prisma.user.findFirstOrThrow({ where: { id: request.user.sub } })

    if (data.newPassword) {
      if (!data.currentPassword) return reply.status(400).send({ error: 'Senha atual é obrigatória para trocar a senha' })
      const { verify } = await import('@node-rs/argon2')
      const valid = await verify(user.passwordHash, data.currentPassword)
      if (!valid) return reply.status(401).send({ error: 'Senha atual incorreta' })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.newPassword) updateData.passwordHash = await hash(data.newPassword)

    return prisma.user.update({
      where: { id: request.user.sub },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    })
  })

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

  fastify.patch('/users/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const UpdateSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      role: z.enum(['admin', 'motorista']).optional(),
      password: z.string().min(6).optional(),
    })
    let data: z.infer<typeof UpdateSchema>
    try { data = UpdateSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const { password, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (password) updateData.passwordHash = await hash(password)

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return user
  })

  fastify.delete('/users/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    if (id === request.user.sub) return reply.status(422).send({ error: 'Cannot deactivate your own account' })
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
