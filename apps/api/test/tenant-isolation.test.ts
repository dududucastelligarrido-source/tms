import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, cleanDb } from './helpers/app.js'
import { createTestTenant, createTestUser, loginAs } from './helpers/fixtures.js'
import { prisma, TENANT_SCOPED_MODELS } from '../src/plugins/prisma.js'
import { tenantStorage } from '../src/middleware/tenant-scope.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => { await app.close() })
beforeEach(async () => { await cleanDb() })

// Runs a callback inside the tenant context of the given tenant, exactly like
// the tenantScope preHandler does for a request.
function runAsTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((res, rej) => {
    tenantStorage.run({ tenantId }, () => { fn().then(res, rej) })
  })
}

describe('TENANT_SCOPED_MODELS drift guard', () => {
  it('lists exactly the schema models that have a tenantId column', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    const modelsWithTenantId: string[] = []
    for (const match of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      if (/^\s*tenantId\s+String/m.test(match[2])) modelsWithTenantId.push(match[1])
    }
    expect(modelsWithTenantId.length).toBeGreaterThan(0)
    expect([...TENANT_SCOPED_MODELS].sort()).toEqual(modelsWithTenantId.sort())
  })
})

describe('Tenant isolation — Prisma extension (per model)', () => {
  // Seeds a full data graph for one tenant covering every tenant-scoped model.
  // Returns a map of model name -> id of the row belonging to that tenant.
  async function seedTenantGraph(tenantId: string, tag: string) {
    const user = await prisma.user.create({
      data: { tenantId, name: `User ${tag}`, email: `${tag}@test.com`, passwordHash: 'x', role: 'admin' },
    })
    const vehicle = await prisma.vehicle.create({
      data: { tenantId, plate: `${tag}1234`.toUpperCase().slice(0, 7), model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao', currentKm: 1000 },
    })
    const driver = await prisma.driver.create({
      data: { tenantId, name: `Driver ${tag}`, cpf: `${tag}-cpf`, cnhNumber: `${tag}-cnh`, cnhCategory: 'E', cnhExpiresAt: new Date('2030-01-01') },
    })
    const trip = await prisma.trip.create({
      data: { tenantId, driverId: driver.id, vehicleId: vehicle.id, originAddress: 'A', destinationAddress: 'B', kmStart: 1000, createdBy: user.id },
    })
    const tripCost = await prisma.tripCost.create({
      data: { tenantId, tripId: trip.id, category: 'toll', description: 'pedagio', amount: 10, paidAt: new Date(), createdBy: user.id },
    })
    const kmLog = await prisma.kmLog.create({
      data: { tenantId, tripId: trip.id, vehicleId: vehicle.id, driverId: driver.id, kmStart: 1000, eventType: 'trip_start' },
    })
    const checklistTemplate = await prisma.checklistTemplate.create({
      data: { tenantId, name: `Template ${tag}`, type: 'saida' },
    })
    const tripChecklist = await prisma.tripChecklist.create({
      data: { tenantId, tripId: trip.id, templateId: checklistTemplate.id, type: 'saida' },
    })
    const fuelLog = await prisma.fuelLog.create({
      data: { tenantId, vehicleId: vehicle.id, driverId: driver.id, loggedAt: new Date(), fuelType: 'diesel', liters: 100, pricePerLiter: 6, totalAmount: 600, kmAtFueling: 1000 },
    })
    const vehicleMaintenance = await prisma.vehicleMaintenance.create({
      data: { tenantId, vehicleId: vehicle.id, type: 'troca_oleo', description: 'oleo', performedAt: new Date(), kmAtService: 900, createdBy: user.id },
    })
    const maintenancePlan = await prisma.maintenancePlan.create({
      data: { tenantId, vehicleId: vehicle.id, type: 'troca_oleo', intervalKm: 10000 },
    })
    const auditLog = await prisma.auditLog.create({
      data: { tenantId, userId: user.id, action: 'create', entity: 'trip', method: 'POST', path: '/api/v1/trips', statusCode: 201 },
    })
    return {
      User: user.id,
      AuditLog: auditLog.id,
      Vehicle: vehicle.id,
      VehicleMaintenance: vehicleMaintenance.id,
      MaintenancePlan: maintenancePlan.id,
      Driver: driver.id,
      Trip: trip.id,
      TripCost: tripCost.id,
      KmLog: kmLog.id,
      ChecklistTemplate: checklistTemplate.id,
      TripChecklist: tripChecklist.id,
      FuelLog: fuelLog.id,
    } as Record<string, string>
  }

  it.each(TENANT_SCOPED_MODELS)('%s: tenant A cannot read, update or delete tenant B rows', async (model) => {
    const tenantA = await createTestTenant({ cnpj: '11111111111111' })
    const tenantB = await createTestTenant({ cnpj: '22222222222222' })
    const rowsB = await seedTenantGraph(tenantB.id, 'tb')
    const bId = rowsB[model]
    expect(bId).toBeTruthy()

    const delegate = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]

    await runAsTenant(tenantA.id, async () => {
      const list = await delegate.findMany()
      expect(list.map((r: any) => r.id)).not.toContain(bId)

      const byId = await delegate.findUnique({ where: { id: bId } })
      expect(byId).toBeNull()

      const updated = await delegate.updateMany({ where: { id: bId }, data: { tenantId: tenantA.id } })
      expect(updated.count).toBe(0)

      const deleted = await delegate.deleteMany({ where: { id: bId } })
      expect(deleted.count).toBe(0)
    })

    // Row B must be intact after all attempts above.
    const stillThere = await delegate.findUnique({ where: { id: bId } })
    expect(stillThere?.tenantId).toBe(tenantB.id)
  })

  it('create inside tenant context injects that tenantId', async () => {
    const tenantA = await createTestTenant({ cnpj: '11111111111111' })
    const created = await runAsTenant(tenantA.id, () =>
      prisma.vehicle.create({
        data: { plate: 'AAA1A11', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao' } as any,
      }),
    )
    expect(created.tenantId).toBe(tenantA.id)
  })
})

describe('Tenant isolation — API regression (previously unscoped models)', () => {
  async function twoTenantsWithFuelLogs() {
    const tenantA = await createTestTenant({ cnpj: '11111111111111' })
    const tenantB = await createTestTenant({ cnpj: '22222222222222' })
    const userA = await createTestUser(tenantA.id, { email: 'a@test.com' })
    const userB = await createTestUser(tenantB.id, { email: 'b@test.com' })

    const vehicleA = await prisma.vehicle.create({
      data: { tenantId: tenantA.id, plate: 'AAA1111', model: 'FH', brand: 'Volvo', year: 2022, type: 'caminhao' },
    })
    const driverA = await prisma.driver.create({
      data: { tenantId: tenantA.id, name: 'Driver A', cpf: 'cpf-a', cnhNumber: 'cnh-a', cnhCategory: 'E', cnhExpiresAt: new Date('2030-01-01') },
    })
    const vehicleB = await prisma.vehicle.create({
      data: { tenantId: tenantB.id, plate: 'BBB2222', model: 'Actros', brand: 'Mercedes', year: 2021, type: 'caminhao' },
    })
    const driverB = await prisma.driver.create({
      data: { tenantId: tenantB.id, name: 'Driver B', cpf: 'cpf-b', cnhNumber: 'cnh-b', cnhCategory: 'E', cnhExpiresAt: new Date('2030-01-01') },
    })
    const fuelLogB = await prisma.fuelLog.create({
      data: { tenantId: tenantB.id, vehicleId: vehicleB.id, driverId: driverB.id, loggedAt: new Date(), fuelType: 'diesel', liters: 50, pricePerLiter: 6, totalAmount: 300, kmAtFueling: 500 },
    })
    const auditLogB = await prisma.auditLog.create({
      data: { tenantId: tenantB.id, userId: userB.id, action: 'create', entity: 'trip', method: 'POST', path: '/api/v1/trips', statusCode: 201 },
    })

    const tokenA = await loginAs(app, userA.email)
    return { tenantA, tenantB, vehicleA, driverA, fuelLogB, auditLogB, tokenA }
  }

  it('GET /fuel-logs does not leak other tenants', async () => {
    const { fuelLogB, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'GET', url: '/api/v1/fuel-logs',
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(0)
    expect(body.data.map((l: any) => l.id)).not.toContain(fuelLogB.id)
  })

  it('GET /audit-logs does not leak other tenants', async () => {
    const { auditLogB, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit-logs',
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((l: any) => l.id)).not.toContain(auditLogB.id)
  })

  it('POST /fuel-logs creates scoped to the caller tenant (was 500)', async () => {
    const { tenantA, vehicleA, driverA, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'POST', url: '/api/v1/fuel-logs',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        vehicleId: vehicleA.id, driverId: driverA.id,
        loggedAt: new Date().toISOString(), fuelType: 'diesel',
        liters: 100, pricePerLiter: 6.5, kmAtFueling: 1500,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().tenantId).toBe(tenantA.id)
  })

  it('POST /vehicles/:id/maintenance creates scoped to the caller tenant (was 500)', async () => {
    const { tenantA, vehicleA, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'POST', url: `/api/v1/vehicles/${vehicleA.id}/maintenance`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        type: 'troca_oleo', description: 'Troca de óleo',
        performedAt: new Date().toISOString(), kmAtService: 1400,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().tenantId).toBe(tenantA.id)
  })

  it('PATCH /fuel-logs/:id of another tenant returns 404 (IDOR)', async () => {
    const { fuelLogB, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/fuel-logs/${fuelLogB.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { liters: 1 },
    })
    expect(res.statusCode).toBe(404)
    const intact = await prisma.fuelLog.findUnique({ where: { id: fuelLogB.id } })
    expect(Number(intact?.liters)).toBe(50)
  })

  it('DELETE /fuel-logs/:id of another tenant returns 404 and deletes nothing (IDOR)', async () => {
    const { fuelLogB, tokenA } = await twoTenantsWithFuelLogs()
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/fuel-logs/${fuelLogB.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(404)
    const intact = await prisma.fuelLog.findUnique({ where: { id: fuelLogB.id } })
    expect(intact).not.toBeNull()
  })

  it('user of tenant A cannot see vehicles of tenant B', async () => {
    const tenantA = await createTestTenant()
    const tenantB = await createTestTenant({ cnpj: '99999999999999' })
    const userA = await createTestUser(tenantA.id)
    await createTestUser(tenantB.id, { email: 'b@test.com' })

    await prisma.vehicle.create({
      data: { tenantId: tenantB.id, plate: 'XYZ9999', model: 'Truck', brand: 'Volvo', year: 2020, type: 'caminhao', currentKm: 0 },
    })

    const token = await loginAs(app, userA.email)
    const res = await app.inject({
      method: 'GET', url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(0)
  })
})
