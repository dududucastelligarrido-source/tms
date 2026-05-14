import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import { prisma } from '../src/plugins/prisma.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let adminToken: string
let tenantId: string
let vehicleId: string
let driverId: string
let adminId: string

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => {
  await cleanDb()
  const tenant = await createTestTenant()
  tenantId = tenant.id
  const admin = await createTestUser(tenantId, { role: 'admin' })
  adminId = admin.id
  adminToken = await loginAs(app, admin.email)

  const vehicle = await prisma.vehicle.create({
    data: { tenantId, plate: 'ABC1234', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao', currentKm: 50000 },
  })
  vehicleId = vehicle.id

  const driver = await prisma.driver.create({
    data: { tenantId, name: 'João Silva', cpf: '12345678901', cnhNumber: '12345', cnhCategory: 'D', cnhExpiresAt: new Date('2028-01-01') },
  })
  driverId = driver.id
})

const tripPayload = () => ({
  driverId,
  vehicleId,
  originAddress: 'Rua A, 100 - São Paulo',
  originLat: -23.5505,
  originLng: -46.6333,
  destinationAddress: 'Av. B, 200 - Campinas',
  destinationLat: -22.9068,
  destinationLng: -47.0626,
  kmStart: 50000,
})

describe('POST /api/v1/trips', () => {
  it('admin creates trip with status draft', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/trips',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: tripPayload(),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ status: 'draft', kmStart: 50000 })
  })
})

describe('PATCH /api/v1/trips/:id/start', () => {
  it('fails without departure checklist', async () => {
    const trip = await prisma.trip.create({
      data: { tenantId, driverId, vehicleId, originAddress: 'A', destinationAddress: 'B', kmStart: 50000, createdBy: adminId },
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/trips/${trip.id}/start`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toMatch(/checklist/)
  })
})

describe('PATCH /api/v1/trips/:id/complete', () => {
  it('fails if km_end less than km_start', async () => {
    const template = await prisma.checklistTemplate.create({ data: { tenantId, name: 'Saída', type: 'departure' } })
    const trip = await prisma.trip.create({
      data: { tenantId, driverId, vehicleId, originAddress: 'A', destinationAddress: 'B', kmStart: 50000, createdBy: adminId, status: 'active', startedAt: new Date() },
    })
    // Add arrival checklist
    const arrTemplate = await prisma.checklistTemplate.create({ data: { tenantId, name: 'Chegada', type: 'arrival' } })
    await prisma.tripChecklist.create({
      data: { tenantId, tripId: trip.id, templateId: arrTemplate.id, type: 'arrival', completedBy: adminId, completedAt: new Date() },
    })

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/trips/${trip.id}/complete`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { kmEnd: 49000 },
    })
    expect(res.statusCode).toBe(422)
  })
})
