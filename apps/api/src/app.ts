import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/prisma.js'
import swaggerPlugin from './plugins/swagger.js'
import { authRoutes } from './routes/auth.js'
import { vehicleRoutes } from './routes/vehicles.js'

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true })

  await app.register(cors, { origin: true })
  await app.register(prismaPlugin)
  await app.register(swaggerPlugin)

  app.get('/health', async () => ({ status: 'ok' }))
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(vehicleRoutes, { prefix: '/api/v1' })

  return app
}
