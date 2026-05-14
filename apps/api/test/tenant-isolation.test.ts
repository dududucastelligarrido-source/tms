import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => { await cleanDb() })

describe('Tenant isolation', () => {
  it('user of tenant A cannot see vehicles of tenant B', async () => {
    const tenantA = await createTestTenant()
    const tenantB = await createTestTenant()
    const userA = await createTestUser(tenantA.id)
    await createTestUser(tenantB.id, { email: 'b@test.com' })

    const { prisma } = await import('../src/plugins/prisma.js')
    await prisma.vehicle.create({
      data: { tenantId: tenantB.id, plate: 'XYZ9999', model: 'Truck', brand: 'Volvo', year: 2020, type: 'caminhao', currentKm: 0 },
    })

    const token = await loginAs(app, userA.email)
    const res = await app.inject({
      method: 'GET', url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(0)
  })
})
