import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/prisma.js'
import swaggerPlugin from './plugins/swagger.js'
import { authRoutes } from './routes/auth.js'
import { vehicleRoutes } from './routes/vehicles.js'
import { driverRoutes } from './routes/drivers.js'
import { tripRoutes } from './routes/trips.js'
import { costRoutes } from './routes/costs.js'
import { kmLogRoutes } from './routes/km-logs.js'
import { checklistTemplateRoutes } from './routes/checklist-templates.js'
import { tripChecklistRoutes } from './routes/trip-checklists.js'
import { userRoutes } from './routes/users.js'
import { reportRoutes } from './routes/reports.js'
import { fuelLogRoutes } from './routes/fuel-logs.js'

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true })

  await app.register(cors, { origin: true })
  await app.register(prismaPlugin)
  await app.register(swaggerPlugin)

  app.get('/health', async () => ({ status: 'ok' }))
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(vehicleRoutes, { prefix: '/api/v1' })
  await app.register(driverRoutes, { prefix: '/api/v1' })
  await app.register(tripRoutes, { prefix: '/api/v1' })
  await app.register(costRoutes, { prefix: '/api/v1' })
  await app.register(kmLogRoutes, { prefix: '/api/v1' })
  await app.register(checklistTemplateRoutes, { prefix: '/api/v1' })
  await app.register(tripChecklistRoutes, { prefix: '/api/v1' })
  await app.register(userRoutes, { prefix: '/api/v1' })
  await app.register(reportRoutes, { prefix: '/api/v1' })
  await app.register(fuelLogRoutes, { prefix: '/api/v1' })

  return app
}
