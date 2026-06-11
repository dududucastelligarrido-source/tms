import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'

export const auditLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.get('/audit-logs', { preHandler: requireRole('admin') }, async (request) => {
    const query = z.object({
      entity: z.string().optional(),
      action: z.string().optional(),
      userId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(request.query)

    const where: Record<string, unknown> = { tenantId: request.user.tenantId }
    if (query.entity) where.entity = query.entity
    if (query.action) where.action = query.action
    if (query.userId) where.userId = query.userId
    if (query.startDate || query.endDate) {
      // Symmetric, full-day UTC bounds (00:00:00 → 23:59:59.999) so both ends
      // cover the whole selected day instead of the asymmetric bare-start case.
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate + 'T00:00:00.000Z') } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate + 'T23:59:59.999Z') } : {}),
      }
    }

    const skip = (query.page - 1) * query.limit
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return { data, total, page: query.page, pages: Math.ceil(total / query.limit) }
  })

  // Distinct entities/actions present, for the filter dropdowns.
  fastify.get('/audit-logs/facets', { preHandler: requireRole('admin') }, async (request) => {
    const tenantId = request.user.tenantId
    const [entities, actions] = await Promise.all([
      prisma.auditLog.findMany({ where: { tenantId }, distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
      prisma.auditLog.findMany({ where: { tenantId }, distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    ])
    return { entities: entities.map(e => e.entity), actions: actions.map(a => a.action) }
  })
}
