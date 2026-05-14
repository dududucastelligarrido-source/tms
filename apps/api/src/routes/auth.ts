import { SignJWT, jwtVerify } from 'jose'
import { hash, verify } from '@node-rs/argon2'
import { z, ZodError } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../plugins/prisma.js'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')
if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET env var is required')

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET)

async function signToken(payload: object, secret: Uint8Array, expiresIn: string) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret)
}

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) })

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    let body: z.infer<typeof LoginSchema>
    try {
      body = LoginSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: err.issues })
      throw err
    }

    const user = await prisma.user.findFirst({
      where: { email: body.email, isActive: true },
    })

    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await verify(user.passwordHash, body.password)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const payload = { sub: user.id, tenantId: user.tenantId, role: user.role }
    const token = await signToken(payload, JWT_SECRET, '8h')
    const refreshToken = await signToken({ sub: user.id }, JWT_REFRESH_SECRET, '30d')

    return { token, refreshToken, user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId } }
  })

  fastify.post('/auth/refresh', async (request, reply) => {
    let body: { refreshToken: string }
    try {
      body = z.object({ refreshToken: z.string() }).parse(request.body)
    } catch {
      return reply.status(400).send({ error: 'refreshToken is required' })
    }

    try {
      const { payload } = await jwtVerify(body.refreshToken, JWT_REFRESH_SECRET)
      const user = await prisma.user.findFirst({ where: { id: payload.sub as string, isActive: true } })
      if (!user) return reply.status(401).send({ error: 'Invalid refresh token' })
      const tokenPayload = { sub: user.id, tenantId: user.tenantId, role: user.role }
      const token = await signToken(tokenPayload, JWT_SECRET, '8h')
      return { token }
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }
  })
}
