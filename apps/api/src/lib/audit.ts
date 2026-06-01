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

  // Action: a trailing sub-action segment (e.g. /trips/:id/start) wins over the verb.
  const last = segments[segments.length - 1]
  const action = SUB_ACTIONS.has(last) ? last : (METHOD_ACTION[method] ?? method.toLowerCase())

  // Entity = the LAST noun segment (non-UUID, non-sub-action), so nested resources
  // like /trips/:id/costs/:costId resolve to 'costs' rather than 'trips'.
  const nouns = segments.filter(s => !isUuid(s) && !SUB_ACTIONS.has(s))
  const resolvedEntity = nouns[nouns.length - 1] ?? entity

  // entityId = the LAST UUID segment — the id of the resource actually acted on
  // (the cost in /trips/:id/costs/:costId, not the parent trip).
  let entityId: string | null = null
  for (const s of segments) if (isUuid(s)) entityId = s

  return { entity: resolvedEntity, entityId, action }
}

// Recursively redacts sensitive keys at any depth before persisting the snapshot.
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.includes(k) ? '***' : redact(v)
    }
    return out
  }
  return value
}

function sanitize(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  try {
    const json = JSON.stringify(redact(body))
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
