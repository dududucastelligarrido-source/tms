import { jwtVerify } from 'jose'
import type { FastifyRequest, FastifyReply } from 'fastify'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface JWTPayload {
  sub: string
  tenantId: string
  role: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing token' })
  }
  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    request.user = payload as unknown as JWTPayload
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}
