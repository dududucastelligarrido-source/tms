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

    if (Object.keys(updateData).length === 0) return reply.status(400).send({ error: 'Nenhum campo para atualizar' })

    try {
      return await prisma.user.update({
        where: { id: request.user.sub },
        data: updateData,
        select: { id: true, name: true, email: true, role: true },
      })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ error: 'Este e-mail já está em uso' })
      throw err
    }
  })

  fastify.get('/users', { preHandler: requireRole('admin') }, async (request) => {
    const query = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(request.query)

    const where: Record<string, unknown> = { tenantId: request.user.tenantId, isActive: true }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const skip = (query.page - 1) * query.limit
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { name: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ])
    return { data, total, page: query.page, pages: Math.ceil(total / query.limit) }
  })

  fastify.post('/users', { preHandler: requireRole('admin') }, async (request, reply) => {
    let data: z.infer<typeof CreateUserSchema>
    try { data = CreateUserSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    const passwordHash = await hash(data.password)
    const user = await prisma.user.create({
      data: { tenantId: request.user.tenantId, name: data.name, email: data.email, passwordHash, role: data.role } as any,
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
