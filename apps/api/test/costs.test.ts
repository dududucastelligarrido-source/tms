import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import { prisma } from '../src/plugins/prisma.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let adminToken: string
let tripId: string
let tenantId: string

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => {
  await cleanDb()
  const tenant = await createTestTenant()
  tenantId = tenant.id
  const admin = await createTestUser(tenantId, { role: 'admin' })
  adminToken = await loginAs(app, admin.email)
  const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: 'ABC1D23', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao', currentKm: 0 } })
  const driver = await prisma.driver.create({ data: { tenantId, name: 'João', cpf: '12345678901', cnhNumber: '1', cnhCategory: 'D', cnhExpiresAt: new Date('2028-01-01') } })
  const trip = await prisma.trip.create({ data: { tenantId, driverId: driver.id, vehicleId: vehicle.id, originAddress: 'A', destinationAddress: 'B', kmStart: 0, createdBy: admin.id, status: 'active', startedAt: new Date() } })
  tripId = trip.id
})

describe('POST /api/v1/trips/:tripId/costs', () => {
  it('adds cost to active trip', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/trips/${tripId}/costs`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { category: 'fuel', description: 'Abastecimento', amount: 350.00, paidAt: new Date().toISOString() },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ category: 'fuel', amount: '350' })
  })
})
