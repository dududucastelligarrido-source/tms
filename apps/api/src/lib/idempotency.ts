import type { FastifyRequest } from 'fastify'
import { prisma } from '../plugins/prisma.js'

/** Reads and validates the optional Idempotency-Key header. */
export function getIdempotencyKey(request: FastifyRequest): string | null {
  const k = request.headers['idempotency-key']
  return typeof k === 'string' && k.length > 0 && k.length <= 200 ? k : null
}

/** True if a mutation with this key was already processed successfully. */
export async function alreadyProcessed(key: string): Promise<boolean> {
  return !!(await prisma.idempotencyKey.findUnique({ where: { key } }))
}
