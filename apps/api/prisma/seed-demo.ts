import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function daysAgo(n: number, hour = 8): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { cnpj: '00000000000100' } })
  if (!tenant) throw new Error('Tenant não encontrado. Execute "pnpm seed" antes.')

  const admin = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: 'admin' } })
  if (!admin) throw new Error('Admin não encontrado.')

  console.log(`Populando demo para: ${tenant.name}`)

  // ── Veículos ──────────────────────────────────────────────────────────────
  const v1 = await prisma.vehicle.upsert({
    where: { tenantId_plate: { tenantId: tenant.id, plate: 'ABC-1D23' } },
    update: {},
    create: { tenantId: tenant.id, plate: 'ABC-1D23', brand: 'Volvo', model: 'FH 460', year: 2021, type: 'carreta', currentKm: 319600 },
  })
  const v2 = await prisma.vehicle.upsert({
    where: { tenantId_plate: { tenantId: tenant.id, plate: 'DEF-2E45' } },
    update: {},
    create: { tenantId: tenant.id, plate: 'DEF-2E45', brand: 'Scania', model: 'R 450', year: 2020, type: 'carreta', currentKm: 277920 },
  })
  const v3 = await prisma.vehicle.upsert({
    where: { tenantId_plate: { tenantId: tenant.id, plate: 'GHI-3F67' } },
    update: {},
    create: { tenantId: tenant.id, plate: 'GHI-3F67', brand: 'Mercedes-Benz', model: 'Actros 2651', year: 2019, type: 'caminhao', currentKm: 409640 },
  })
  const v4 = await prisma.vehicle.upsert({
    where: { tenantId_plate: { tenantId: tenant.id, plate: 'JKL-4G89' } },
    update: {},
    create: { tenantId: tenant.id, plate: 'JKL-4G89', brand: 'Volkswagen', model: 'Constellation 24.280', year: 2022, type: 'caminhao', currentKm: 94990 },
  })
  console.log('Veículos ✓')

  // ── Motoristas ────────────────────────────────────────────────────────────
  const d1 = await prisma.driver.upsert({
    where: { tenantId_cpf: { tenantId: tenant.id, cpf: '123.456.789-01' } },
    update: {},
    create: { tenantId: tenant.id, name: 'João Pereira Silva', cpf: '123.456.789-01', cnhNumber: '12345678901', cnhCategory: 'E', cnhExpiresAt: new Date('2026-08-15') },
  })
  const d2 = await prisma.driver.upsert({
    where: { tenantId_cpf: { tenantId: tenant.id, cpf: '234.567.890-12' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Carlos Eduardo Santos', cpf: '234.567.890-12', cnhNumber: '23456789012', cnhCategory: 'E', cnhExpiresAt: new Date('2025-11-30') },
  })
  const d3 = await prisma.driver.upsert({
    where: { tenantId_cpf: { tenantId: tenant.id, cpf: '345.678.901-23' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Pedro Henrique Oliveira', cpf: '345.678.901-23', cnhNumber: '34567890123', cnhCategory: 'D', cnhExpiresAt: new Date('2027-03-20') },
  })
  const d4 = await prisma.driver.upsert({
    where: { tenantId_cpf: { tenantId: tenant.id, cpf: '456.789.012-34' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Marcos Antonio Costa', cpf: '456.789.012-34', cnhNumber: '45678901234', cnhCategory: 'E', cnhExpiresAt: new Date('2026-05-10') },
  })
  console.log('Motoristas ✓')

  // ── Viagens ───────────────────────────────────────────────────────────────
  type TripSpec = {
    driverId: string; vehicleId: string
    origin: string; destination: string
    kmStart: number; kmEnd?: number
    status: string
    startedAt?: Date; completedAt?: Date
    cartaFrete?: number; adiantamento?: number; pesoCarga?: number
    notes?: string
  }

  const specs: TripSpec[] = [
    // 5 Concluídas
    { driverId: d1.id, vehicleId: v1.id, origin: 'São Paulo, SP', destination: 'Rio de Janeiro, RJ', kmStart: 318000, kmEnd: 318430, status: 'completed', startedAt: daysAgo(14, 6), completedAt: daysAgo(13, 18), cartaFrete: 3200, adiantamento: 1200, pesoCarga: 18.5, notes: 'Carga de eletrônicos' },
    { driverId: d2.id, vehicleId: v2.id, origin: 'Curitiba, PR',  destination: 'São Paulo, SP',      kmStart: 277500, kmEnd: 277920, status: 'completed', startedAt: daysAgo(12, 7), completedAt: daysAgo(12, 15), cartaFrete: 2800, adiantamento: 1000, pesoCarga: 22.0, notes: 'Granel sólido — soja' },
    { driverId: d3.id, vehicleId: v3.id, origin: 'Belo Horizonte, MG', destination: 'Brasília, DF', kmStart: 409200, kmEnd: 409640, status: 'completed', startedAt: daysAgo(10, 5), completedAt: daysAgo(9,  14), cartaFrete: 2400, adiantamento: 800,  pesoCarga: 15.0 },
    { driverId: d1.id, vehicleId: v1.id, origin: 'São Paulo, SP', destination: 'Porto Alegre, RS',  kmStart: 318430, kmEnd: 319590, status: 'completed', startedAt: daysAgo(8,  6), completedAt: daysAgo(6,  20), cartaFrete: 5800, adiantamento: 2000, pesoCarga: 27.5, notes: 'Frigorificada — laticínios' },
    { driverId: d4.id, vehicleId: v4.id, origin: 'Goiânia, GO',   destination: 'São Paulo, SP',     kmStart: 94100,  kmEnd: 94990,  status: 'completed', startedAt: daysAgo(5,  6), completedAt: daysAgo(4,  16), cartaFrete: 3900, adiantamento: 1500, pesoCarga: 20.0 },
    // 1 Cancelada
    { driverId: d2.id, vehicleId: v2.id, origin: 'Recife, PE', destination: 'Fortaleza, CE', kmStart: 277920, status: 'cancelled', cartaFrete: 2200, adiantamento: 800, notes: 'Cancelada — problema mecânico' },
    // 1 Ativa
    { driverId: d3.id, vehicleId: v3.id, origin: 'São Paulo, SP', destination: 'Salvador, BA', kmStart: 409640, status: 'active', startedAt: daysAgo(1, 6), cartaFrete: 6200, adiantamento: 2500, pesoCarga: 24.0 },
    // 2 Rascunhos
    { driverId: d1.id, vehicleId: v1.id, origin: 'São Paulo, SP', destination: 'Manaus, AM', kmStart: 319590, status: 'draft', cartaFrete: 9500, adiantamento: 3000, pesoCarga: 26.0, notes: 'Aguardando liberação' },
    { driverId: d4.id, vehicleId: v4.id, origin: 'Porto Alegre, RS', destination: 'Florianópolis, SC', kmStart: 94990, status: 'draft', cartaFrete: 1800, adiantamento: 600, pesoCarga: 12.0 },
  ]

  const trips = []
  for (const s of specs) {
    const trip = await prisma.trip.create({
      data: {
        tenantId: tenant.id, createdBy: admin.id,
        driverId: s.driverId, vehicleId: s.vehicleId,
        originAddress: s.origin, destinationAddress: s.destination,
        kmStart: s.kmStart, kmEnd: s.kmEnd, status: s.status,
        startedAt: s.startedAt, completedAt: s.completedAt,
        cartaFrete: s.cartaFrete, adiantamento: s.adiantamento, pesoCarga: s.pesoCarga,
        notes: s.notes,
      } as any,
    })
    trips.push({ trip, spec: s })

    if (s.status === 'active' || s.status === 'completed') {
      await prisma.kmLog.create({ data: { tenantId: tenant.id, tripId: trip.id, vehicleId: s.vehicleId, driverId: s.driverId, kmStart: s.kmStart, eventType: 'start', loggedAt: s.startedAt! } })
    }
    if (s.status === 'completed' && s.kmEnd) {
      await prisma.kmLog.create({ data: { tenantId: tenant.id, tripId: trip.id, vehicleId: s.vehicleId, driverId: s.driverId, kmStart: s.kmStart, kmEnd: s.kmEnd, eventType: 'end', loggedAt: s.completedAt! } })
      await prisma.vehicle.update({ where: { id: s.vehicleId }, data: { currentKm: s.kmEnd } })
    }
  }
  console.log('Viagens ✓')

  // ── Custos ────────────────────────────────────────────────────────────────
  const costs = [
    { i: 0, category: 'pedagio',     description: 'Pedágios Bandeirantes/Dutra',  amount: 280 },
    { i: 0, category: 'alimentacao', description: 'Refeições do motorista',        amount: 95  },
    { i: 1, category: 'pedagio',     description: 'Pedágios BR-376',               amount: 210 },
    { i: 1, category: 'manutencao',  description: 'Troca de pneu furado',          amount: 650 },
    { i: 2, category: 'pedagio',     description: 'Pedágios BR-040',               amount: 180 },
    { i: 2, category: 'alimentacao', description: 'Refeições e pousada',           amount: 220 },
    { i: 3, category: 'pedagio',     description: 'Pedágios BR-116 Sul',           amount: 490 },
    { i: 3, category: 'manutencao',  description: 'Revisão preventiva em POA',     amount: 380 },
    { i: 4, category: 'pedagio',     description: 'Pedágios BR-050/153',           amount: 320 },
    { i: 4, category: 'alimentacao', description: 'Refeições',                     amount: 110 },
  ]
  for (const c of costs) {
    await prisma.tripCost.create({
      data: { tenantId: tenant.id, tripId: trips[c.i].trip.id, category: c.category, description: c.description, amount: c.amount, paidAt: trips[c.i].spec.completedAt ?? new Date(), createdBy: admin.id },
    })
  }
  console.log('Custos ✓')

  // ── Combustível ───────────────────────────────────────────────────────────
  const fuel = [
    { veh: v1, drv: d1, km: 318220, liters: 350, price: 6.49, days: 13, type: 'diesel' },
    { veh: v1, drv: d1, km: 319100, liters: 420, price: 6.52, days: 7,  type: 'diesel' },
    { veh: v1, drv: d1, km: 319100, liters: 130, price: 3.89, days: 7,  type: 'arla'   },
    { veh: v2, drv: d2, km: 277660, liters: 380, price: 6.47, days: 11, type: 'diesel' },
    { veh: v2, drv: d2, km: 277660, liters: 90,  price: 3.87, days: 11, type: 'arla'   },
    { veh: v3, drv: d3, km: 409350, liters: 310, price: 6.53, days: 9,  type: 'diesel' },
    { veh: v3, drv: d3, km: 409540, liters: 295, price: 6.58, days: 2,  type: 'diesel' },
    { veh: v3, drv: d3, km: 409540, liters: 88,  price: 3.91, days: 2,  type: 'arla'   },
    { veh: v4, drv: d4, km: 94400,  liters: 260, price: 6.44, days: 4,  type: 'diesel' },
  ] as const

  const prevKm: Record<string, { km: number; liters: number }> = {}
  for (const f of fuel) {
    let kmPerLiter: number | null = null
    if (f.type === 'diesel') {
      const prev = prevKm[f.veh.id]
      if (prev) kmPerLiter = (f.km - prev.km) / prev.liters
      prevKm[f.veh.id] = { km: f.km, liters: f.liters }
    }
    await prisma.fuelLog.create({
      data: {
        tenantId: tenant.id, vehicleId: f.veh.id, driverId: f.drv.id,
        loggedAt: daysAgo(f.days), fuelType: f.type,
        liters: f.liters, pricePerLiter: f.price,
        totalAmount: f.liters * f.price,
        kmAtFueling: f.km,
        ...(kmPerLiter && kmPerLiter > 0 ? { kmPerLiter } : {}),
      } as any,
    })
  }
  console.log('Combustível ✓')

  console.log('\n✅ Dados de demo criados com sucesso!')
  console.log('   4 veículos · 4 motoristas · 9 viagens · 10 custos · 9 abastecimentos')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
