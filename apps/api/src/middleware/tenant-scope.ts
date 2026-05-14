import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyRequest, FastifyReply } from 'fastify'

interface TenantContext { tenantId: string }

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

export async function tenantScope(request: FastifyRequest, _reply: FastifyReply) {
  tenantStorage.enterWith({ tenantId: request.user.tenantId })
}
