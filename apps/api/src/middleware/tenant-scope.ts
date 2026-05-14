import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyRequest, FastifyReply } from 'fastify'

interface TenantContext { tenantId: string }

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

// Callback-based (not async) so done() fires inside run() — propagating the async context
// into the route handler and all downstream hooks.
export function tenantScope(request: FastifyRequest, _reply: FastifyReply, done: () => void) {
  tenantStorage.run({ tenantId: request.user.tenantId }, done)
}
