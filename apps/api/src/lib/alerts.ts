import { prisma } from '../plugins/prisma.js'

export interface CnhAlert {
  driverId: string
  name: string
  cnhNumber: string
  cnhExpiresAt: Date
  daysLeft: number
  expired: boolean
}

export interface MaintenanceAlert {
  vehicleId: string
  plate: string
  model: string
  currentKm: number
  nextServiceKm: number | null
  nextServiceDate: Date | null
  kmRestantes: number | null
  diasRestantes: number | null
  overdue: boolean
}

export interface TenantAlerts {
  tenantId: string
  tenantName: string
  cnhExpiring: CnhAlert[]
  maintenanceDue: MaintenanceAlert[]
}

const DAY_MS = 86400000
const CNH_WINDOW_DAYS = 30
const KM_WINDOW = 5000
const DATE_WINDOW_DAYS = 30

/**
 * Computes CNH-expiry and maintenance-due alerts for a single tenant.
 * Mirrors the alert logic in the dashboard report so both stay consistent.
 */
export async function computeTenantAlerts(tenantId: string, tenantName: string): Promise<TenantAlerts> {
  const now = Date.now()
  const in30days = new Date(now + CNH_WINDOW_DAYS * DAY_MS)

  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({ where: { tenantId, isActive: true } }),
    prisma.vehicle.findMany({
      where: { tenantId, isActive: true },
      include: { maintenances: { orderBy: { performedAt: 'desc' }, take: 1 } },
    }),
  ])

  const cnhExpiring: CnhAlert[] = drivers
    .filter(d => d.cnhExpiresAt <= in30days)
    .map(d => {
      const daysLeft = Math.ceil((d.cnhExpiresAt.getTime() - now) / DAY_MS)
      return { driverId: d.id, name: d.name, cnhNumber: d.cnhNumber, cnhExpiresAt: d.cnhExpiresAt, daysLeft, expired: daysLeft < 0 }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const maintenanceDue: MaintenanceAlert[] = vehicles
    .map(v => {
      const last = (v as any).maintenances[0]
      if (!last) return null
      const kmRestantes = last.nextServiceKm != null ? last.nextServiceKm - v.currentKm : null
      const diasRestantes = last.nextServiceDate != null
        ? Math.ceil((new Date(last.nextServiceDate).getTime() - now) / DAY_MS)
        : null
      const kmAlerta = kmRestantes != null && kmRestantes <= KM_WINDOW
      const dataAlerta = diasRestantes != null && diasRestantes <= DATE_WINDOW_DAYS
      if (!kmAlerta && !dataAlerta) return null
      const overdue = (kmRestantes != null && kmRestantes <= 0) || (diasRestantes != null && diasRestantes <= 0)
      return {
        vehicleId: v.id,
        plate: v.plate,
        model: `${v.brand} ${v.model}`.trim(),
        currentKm: v.currentKm,
        nextServiceKm: last.nextServiceKm ?? null,
        nextServiceDate: last.nextServiceDate ?? null,
        kmRestantes,
        diasRestantes,
        overdue,
      }
    })
    .filter((m): m is MaintenanceAlert => m !== null)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue))

  return { tenantId, tenantName, cnhExpiring, maintenanceDue }
}
