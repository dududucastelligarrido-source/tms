import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import { prisma } from '../src/plugins/prisma.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let adminToken: string
let tenantId: string
let templateId: string
let tripId: string

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => {
  await cleanDb()
  const tenant = await createTestTenant()
  tenantId = tenant.id
  const admin = await createTestUser(tenantId, { role: 'admin' })
  adminToken = await loginAs(app, admin.email)

  const template = await prisma.checklistTemplate.create({
    data: { tenantId, name: 'Checklist Saída', type: 'departure', items: { create: [
      { description: 'Pneus calibrados', isRequired: true, orderIndex: 0 },
      { description: 'Nível de óleo', isRequired: true, orderIndex: 1 },
    ]}},
    include: { items: true },
  })
  templateId = template.id

  const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: 'TEST001', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao', currentKm: 0 } })
  const driver = await prisma.driver.create({ data: { tenantId, name: 'Motorista', cpf: '11111111111', cnhNumber: '1', cnhCategory: 'D', cnhExpiresAt: new Date('2028-01-01') } })
  const trip = await prisma.trip.create({ data: { tenantId, driverId: driver.id, vehicleId: vehicle.id, originAddress: 'A', destinationAddress: 'B', kmStart: 0, createdBy: admin.id } })
  tripId = trip.id
})

describe('POST /api/v1/trips/:tripId/checklists', () => {
  it('creates checklist instance for trip', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/trips/${tripId}/checklists`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { templateId, type: 'departure' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ type: 'departure', completedAt: null })
  })
})

describe('PATCH /api/v1/checklists/:id/respond', () => {
  it('completes checklist with all required items', async () => {
    const checklistRes = await app.inject({
      method: 'POST', url: `/api/v1/trips/${tripId}/checklists`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { templateId, type: 'departure' },
    })
    const checklist = checklistRes.json()
    const items = checklist.template.items

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/checklists/${checklist.id}/respond`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { responses: items.map((i: { id: string }) => ({ itemId: i.id, passed: true })) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().completedAt).not.toBeNull()
  })
})
