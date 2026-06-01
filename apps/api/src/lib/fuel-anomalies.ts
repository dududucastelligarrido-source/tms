import { prisma } from '../plugins/prisma.js'

export type AnomalyType = 'low_efficiency' | 'odometer_regression' | 'volume_outlier'
export type Severity = 'high' | 'medium'

export interface FuelAnomaly {
  logId: string
  vehicleId: string
  plate: string
  model: string
  driverName: string
  loggedAt: Date
  type: AnomalyType
  severity: Severity
  detail: string
  value: number
  baseline: number | null
}

// Tunables for the heuristics.
const MIN_SAMPLES = 4            // need this many km/L readings before trusting a baseline
const LOW_EFF_RATIO = 0.7        // km/L below 70% of the vehicle median is suspicious
const CRITICAL_EFF_RATIO = 0.5   // below 50% is high severity
const VOLUME_RATIO = 1.5         // liters above 1.5× the vehicle median is an outlier

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Flags suspicious fuel logs per vehicle (possible theft, leak, or misfueling):
 *  - low_efficiency: km/L well below the vehicle's own historical median
 *  - odometer_regression: kmAtFueling not greater than the previous fueling
 *  - volume_outlier: liters far above the vehicle's typical fill
 *
 * Baselines are computed from the full history so a short reporting window still
 * gets a meaningful reference; only logs within `sinceDays` are returned.
 */
export async function detectFuelAnomalies(tenantId: string, sinceDays = 90): Promise<FuelAnomaly[]> {
  const logs = await prisma.fuelLog.findMany({
    where: { tenantId },
    include: { vehicle: true, driver: true },
    orderBy: { loggedAt: 'asc' },
  })

  // Group by vehicle to build per-vehicle baselines.
  const byVehicle = new Map<string, typeof logs>()
  for (const log of logs) {
    const arr = byVehicle.get(log.vehicleId) ?? []
    arr.push(log)
    byVehicle.set(log.vehicleId, arr)
  }

  const cutoff = Date.now() - sinceDays * 86400000
  const anomalies: FuelAnomaly[] = []

  for (const vehicleLogs of byVehicle.values()) {
    const kmPerLiterValues = vehicleLogs
      .filter(l => l.fuelType === 'diesel' && l.kmPerLiter != null)
      .map(l => Number(l.kmPerLiter))
    const litersValues = vehicleLogs.map(l => Number(l.liters))
    const effBaseline = kmPerLiterValues.length >= MIN_SAMPLES ? median(kmPerLiterValues) : null
    const volBaseline = litersValues.length >= MIN_SAMPLES ? median(litersValues) : null

    let prevKm: number | null = null
    for (const log of vehicleLogs) {
      const recent = log.loggedAt.getTime() >= cutoff
      const base = {
        logId: log.id,
        vehicleId: log.vehicleId,
        plate: log.vehicle?.plate ?? '—',
        model: `${log.vehicle?.brand ?? ''} ${log.vehicle?.model ?? ''}`.trim(),
        driverName: log.driver?.name ?? '—',
        loggedAt: log.loggedAt,
      }

      // Odometer went backwards or stayed flat between fuelings.
      if (recent && prevKm != null && log.kmAtFueling <= prevKm) {
        anomalies.push({
          ...base,
          type: 'odometer_regression',
          severity: 'high',
          detail: `Hodômetro não avançou: ${log.kmAtFueling.toLocaleString('pt-BR')} km ≤ anterior ${prevKm.toLocaleString('pt-BR')} km`,
          value: log.kmAtFueling,
          baseline: prevKm,
        })
      }

      // Efficiency far below the vehicle's own median.
      if (recent && effBaseline && log.kmPerLiter != null) {
        const kmL = Number(log.kmPerLiter)
        if (kmL > 0 && kmL < effBaseline * LOW_EFF_RATIO) {
          const pct = Math.round((1 - kmL / effBaseline) * 100)
          anomalies.push({
            ...base,
            type: 'low_efficiency',
            severity: kmL < effBaseline * CRITICAL_EFF_RATIO ? 'high' : 'medium',
            detail: `Consumo ${pct}% abaixo da média do veículo (${kmL.toFixed(2)} vs ${effBaseline.toFixed(2)} km/L)`,
            value: Number(kmL.toFixed(2)),
            baseline: Number(effBaseline.toFixed(2)),
          })
        }
      }

      // Fill volume well above the vehicle's typical refuel.
      if (recent && volBaseline) {
        const liters = Number(log.liters)
        if (liters > volBaseline * VOLUME_RATIO) {
          anomalies.push({
            ...base,
            type: 'volume_outlier',
            severity: 'medium',
            detail: `Volume atípico: ${liters.toFixed(0)} L vs média ${volBaseline.toFixed(0)} L do veículo`,
            value: Number(liters.toFixed(1)),
            baseline: Number(volBaseline.toFixed(1)),
          })
        }
      }

      prevKm = log.kmAtFueling
    }
  }

  // Most recent first, high severity prioritized.
  return anomalies.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    return b.loggedAt.getTime() - a.loggedAt.getTime()
  })
}
