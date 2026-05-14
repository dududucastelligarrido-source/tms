import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser } from './helpers/fixtures.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => { await cleanDb() })

describe('POST /api/v1/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const tenant = await createTestTenant()
    const user = await createTestUser(tenant.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'senha123' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      token: expect.any(String),
      refreshToken: expect.any(String),
      user: { role: 'admin', tenantId: tenant.id },
    })
  })

  it('returns 401 for wrong password', async () => {
    const tenant = await createTestTenant()
    const user = await createTestUser(tenant.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'errada' },
    })

    expect(res.statusCode).toBe(401)
  })
})
