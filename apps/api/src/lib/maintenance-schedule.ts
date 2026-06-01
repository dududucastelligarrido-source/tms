import { prisma } from '../plugins/prisma.js'

export type ScheduleStatus = 'overdue' | 'warning' | 'ok' | 'pending'

export interface PlanSchedule {
  planId: string
  type: string
  intervalKm: number | null
  intervalDays: number | null
  lastPerformedAt: Date | null
  lastKmAtService: number | null
  nextDueKm: number | null
  nextDueDate: Date | null
  kmRemaining: number | null
  daysRemaining: number | null
  status: ScheduleStatus
}

const DAY_MS = 86400000
const KM_WARN = 5000
const DAYS_WARN = 30

/**
 * Computes the next-due schedule for each active maintenance plan of a vehicle,
 * deriving the due point from the latest service of the same type.
 * status 'pending' = plan exists but the service was never recorded yet.
 */
export async function computeVehicleSchedule(vehicleId: string, currentKm: number): Promise<PlanSchedule[]> {
  const plans = await prisma.maintenancePlan.findMany({
    where: { vehicleId, isActive: true },
    orderBy: { type: 'asc' },
  })
  if (plans.length === 0) return []

  const now = Date.now()
  const schedules = await Promise.all(plans.map(async (plan) => {
    const last = await prisma.vehicleMaintenance.findFirst({
      where: { vehicleId, type: plan.type },
      orderBy: { performedAt: 'desc' },
    })

    const nextDueKm = last && plan.intervalKm != null ? last.kmAtService + plan.intervalKm : null
    const nextDueDate = last && plan.intervalDays != null
      ? new Date(new Date(last.performedAt).getTime() + plan.intervalDays * DAY_MS)
      : null
    const kmRemaining = nextDueKm != null ? nextDueKm - currentKm : null
    const daysRemaining = nextDueDate != null ? Math.ceil((nextDueDate.getTime() - now) / DAY_MS) : null

    let status: ScheduleStatus
    if (!last) {
      status = 'pending' // never serviced — needs a baseline service
    } else if ((kmRemaining != null && kmRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) {
      status = 'overdue'
    } else if ((kmRemaining != null && kmRemaining <= KM_WARN) || (daysRemaining != null && daysRemaining <= DAYS_WARN)) {
      status = 'warning'
    } else {
      status = 'ok'
    }

    return {
      planId: plan.id,
      type: plan.type,
      intervalKm: plan.intervalKm,
      intervalDays: plan.intervalDays,
      lastPerformedAt: last?.performedAt ?? null,
      lastKmAtService: last?.kmAtService ?? null,
      nextDueKm,
      nextDueDate,
      kmRemaining,
      daysRemaining,
      status,
    }
  }))

  // Surface the most urgent first.
  const rank: Record<ScheduleStatus, number> = { overdue: 0, pending: 1, warning: 2, ok: 3 }
  return schedules.sort((a, b) => rank[a.status] - rank[b.status])
}
