import { timingSafeEqual } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'
import { computeTenantAlerts } from '../lib/alerts.js'
import { sendAlertDigest, isEmailConfigured } from '../lib/email.js'

// Constant-time comparison to avoid leaking the cron secret via response timing.
function secretMatches(provided: unknown, expected: string | undefined): boolean {
  if (!expected || typeof provided !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function adminEmails(tenantId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'admin', isActive: true },
    select: { email: true },
  })
  return admins.map(a => a.email)
}

export const alertRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Cron endpoint (no JWT — protected by a shared secret) ──────────────────
  // Sends the daily digest for every active tenant. Intended for Railway cron.
  fastify.post('/alerts/run', async (request, reply) => {
    if (!secretMatches(request.headers['x-cron-secret'], process.env.CRON_SECRET)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    if (!isEmailConfigured()) {
      return reply.status(503).send({ error: 'Email not configured' })
    }

    const tenants = await prisma.tenant.findMany({ where: { isActive: true } })
    const results: { tenant: string; sent: boolean; recipients: number; alerts: number }[] = []

    for (const tenant of tenants) {
      const alerts = await computeTenantAlerts(tenant.id, tenant.name)
      const recipients = await adminEmails(tenant.id)
      const alertCount = alerts.cnhExpiring.length + alerts.maintenanceDue.length
      let sent = false
      try {
        sent = await sendAlertDigest(alerts, recipients)
      } catch (err) {
        request.log.error({ err, tenantId: tenant.id }, 'Failed to send alert digest')
      }
      results.push({ tenant: tenant.name, sent, recipients: recipients.length, alerts: alertCount })
    }

    return { ranAt: new Date().toISOString(), tenants: results }
  })

  // ── Authenticated endpoints (admin only) ───────────────────────────────────
  fastify.register(async (instance) => {
    instance.addHook('preHandler', authenticate)
    instance.addHook('preHandler', tenantScope)

    // Preview the current tenant's alerts (used by the in-app banner / settings).
    instance.get('/alerts', { preHandler: requireRole('admin') }, async (request) => {
      const tenantId = (request as any).tenantId
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
      return computeTenantAlerts(tenantId, tenant.name)
    })

    // Manually send the digest for the current tenant right now.
    instance.post('/alerts/send-now', { preHandler: requireRole('admin') }, async (request, reply) => {
      if (!isEmailConfigured()) return reply.status(503).send({ error: 'Email não configurado no servidor' })
      const tenantId = (request as any).tenantId
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
      const alerts = await computeTenantAlerts(tenantId, tenant.name)
      const recipients = await adminEmails(tenantId)
      const alertCount = alerts.cnhExpiring.length + alerts.maintenanceDue.length
      const sent = await sendAlertDigest(alerts, recipients)
      return { sent, recipients: recipients.length, alerts: alertCount }
    })
  })
}
