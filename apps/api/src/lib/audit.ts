import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../plugins/prisma.js'

// Routes we never want to audit (auth flows, reads, presign, the audit log itself, cron).
const SKIP_ENTITIES = new Set(['auth', 'uploads', 'audit-logs', 'alerts', 'reports', 'health'])
const SENSITIVE_KEYS = ['password', 'newPassword', 'currentPassword', 'passwordHash', 'token', 'refreshToken']

// Known sub-actions that are more meaningful than the HTTP verb.
const SUB_ACTIONS = new Set(['start', 'complete', 'cancel', 'respond', 'change-driver', 'send-now'])

const METHOD_ACTION: Record<string, string> = { POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' }

interface AuditTarget {
  entity: string
  entityId: string | null
  action: string
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

/** Derives { entity, entityId, action } from the request method and URL. */
export function parseAuditTarget(method: string, url: string): AuditTarget | null {
  const path = url.split('?')[0].replace(/^\/api\/v1\//, '').replace(/\/$/, '')
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const entity = segments[0]
  if (SKIP_ENTITIES.has(entity)) return null

  // Find a trailing sub-action segment (e.g. /trips/:id/start)
  const last = segments[segments.length - 1]
  let action = METHOD_ACTION[method] ?? method.toLowerCase()
  if (SUB_ACTIONS.has(last)) action = last

  // entityId = the first UUID segment, if any.
  const entityId = segments.find(isUuid) ?? null

  // For nested resources (e.g. /trips/:id/costs), prefer the nested noun as entity.
  let resolvedEntity = entity
  if (segments.length >= 3 && !SUB_ACTIONS.has(last) && !isUuid(last)) {
    resolvedEntity = last // e.g. 'maintenance', 'costs', 'checklists'
  }

  return { entity: resolvedEntity, entityId, action }
}

function sanitize(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  try {
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) }
    for (const key of SENSITIVE_KEYS) {
      if (key in clone) clone[key] = '***'
    }
    const json = JSON.stringify(clone)
    return json.length > 2000 ? json.slice(0, 2000) + '…' : json
  } catch {
    return null
  }
}

/**
 * onResponse hook: records a successful mutation (POST/PATCH/PUT/DELETE, 2xx)
 * performed by an authenticated user. Fire-and-forget; never blocks the response.
 */
export function auditHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  done() // never delay the response

  const method = request.method
  if (!(method in METHOD_ACTION)) return
  if (reply.statusCode < 200 || reply.statusCode >= 300) return

  const user = (request as any).user
  if (!user?.sub || !user?.tenantId) return // unauthenticated routes (login, cron) — skip

  const target = parseAuditTarget(method, request.url)
  if (!target) return

  prisma.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId: user.sub,
      action: target.action,
      entity: target.entity,
      entityId: target.entityId,
      method,
      path: request.url.split('?')[0],
      statusCode: reply.statusCode,
      summary: sanitize(request.body),
    },
  }).catch((err) => {
    request.log.error({ err }, 'Failed to write audit log')
  })
}
