import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { createPresignedUpload, isStorageConfigured } from '../lib/storage.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  fastify.post('/uploads/presign', async (request, reply) => {
    if (!isStorageConfigured()) {
      return reply.status(503).send({ error: 'File storage not configured' })
    }

    const body = z.object({
      context: z.enum(['odometer', 'receipt', 'maintenance', 'checklist']),
      contentType: z.string().refine(t => ALLOWED_TYPES.includes(t), { message: 'Tipo de arquivo não permitido' }),
      filename: z.string().min(1).max(255),
    }).parse(request.body)

    const result = await createPresignedUpload({
      tenantId: request.user.tenantId,
      context: body.context,
      contentType: body.contentType,
      filename: body.filename,
    })

    return result
  })
}
