import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let adminToken: string

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => {
  await cleanDb()
  const tenant = await createTestTenant()
  const admin = await createTestUser(tenant.id, { role: 'admin' })
  adminToken = await loginAs(app, admin.email)
})

const vehiclePayload = { plate: 'ABC1234', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao', currentKm: 50000 }

describe('POST /api/v1/vehicles', () => {
  it('admin creates vehicle', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: vehiclePayload,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ plate: 'ABC1234', currentKm: 50000 })
  })
})

describe('GET /api/v1/vehicles', () => {
  it('lists only active vehicles of the tenant', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/vehicles', headers: { authorization: `Bearer ${adminToken}` }, payload: vehiclePayload })
    const res = await app.inject({ method: 'GET', url: '/api/v1/vehicles', headers: { authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })

  it('motorista role cannot create vehicle', async () => {
    const tenant2 = await createTestTenant()
    const motorista = await createTestUser(tenant2.id, { role: 'motorista' })
    const motToken = await loginAs(app, motorista.email)
    const res = await app.inject({
      method: 'POST', url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${motToken}` },
      payload: vehiclePayload,
    })
    expect(res.statusCode).toBe(403)
  })
})
