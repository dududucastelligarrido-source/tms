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
import { maintenanceRoutes } from './routes/maintenance.js'
import { maintenancePlanRoutes } from './routes/maintenance-plans.js'
import { uploadRoutes } from './routes/uploads.js'
import { alertRoutes } from './routes/alerts.js'
import { auditLogRoutes } from './routes/audit-logs.js'
import { fuelAnomalyRoutes } from './routes/fuel-anomalies.js'
import { auditHook } from './lib/audit.js'

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true })

  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(o => o.trim())
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const allowed = allowedOrigins.includes(origin) || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
      cb(null, allowed)
    },
    credentials: true,
    preflight: true,
    strictPreflight: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
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
  await app.register(maintenanceRoutes, { prefix: '/api/v1' })
  await app.register(maintenancePlanRoutes, { prefix: '/api/v1' })
  await app.register(uploadRoutes, { prefix: '/api/v1' })
  await app.register(alertRoutes, { prefix: '/api/v1' })
  await app.register(auditLogRoutes, { prefix: '/api/v1' })
  await app.register(fuelAnomalyRoutes, { prefix: '/api/v1' })

  app.addHook('onResponse', auditHook)

  return app
}
