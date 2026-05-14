import { hash } from '@node-rs/argon2'
import { prisma } from '../../src/plugins/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function createTestTenant(overrides: { name?: string; cnpj?: string } = {}) {
  return prisma.tenant.create({
    data: {
      name: overrides.name ?? 'Transportadora Teste',
      cnpj: overrides.cnpj ?? `${Date.now()}`.slice(0, 14).padEnd(14, '0'),
    },
  })
}

export async function createTestUser(tenantId: string, overrides: { role?: string; email?: string } = {}) {
  const passwordHash = await hash('senha123')
  return prisma.user.create({
    data: {
      tenantId,
      name: 'Admin Teste',
      email: overrides.email ?? `admin-${Date.now()}@test.com`,
      passwordHash,
      role: overrides.role ?? 'admin',
    },
  })
}

export async function loginAs(app: FastifyInstance, email: string, password = 'senha123') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  })
  return res.json<{ token: string }>().token
}
