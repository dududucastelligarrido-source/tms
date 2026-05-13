// packages/types/src/api.ts
import type { CostCategory, CnhCategory, VehicleType, UserRole } from './entities.js'

export interface LoginRequest { email: string; password: string }
export interface LoginResponse { token: string; refreshToken: string; user: { id: string; name: string; role: UserRole; tenantId: string } }

export interface CreateTripRequest {
  driverId: string
  vehicleId: string
  originAddress: string
  originLat?: number
  originLng?: number
  destinationAddress: string
  destinationLat?: number
  destinationLng?: number
  kmStart: number
  notes?: string
}

export interface CompleteTripRequest { kmEnd: number }
export interface ChangeDriverRequest { newDriverId: string; kmCurrent: number }

export interface CreateCostRequest {
  category: CostCategory
  description: string
  amount: number
  paidAt: string
  receiptUrl?: string
}

export interface RespondChecklistRequest {
  responses: { itemId: string; passed: boolean; notes?: string; photoUrl?: string }[]
}

export interface CreateVehicleRequest {
  plate: string; model: string; brand: string; year: number; type: VehicleType; currentKm: number
}

export interface CreateDriverRequest {
  name: string; cpf: string; cnhNumber: string; cnhCategory: CnhCategory
  cnhExpiresAt: string; userId?: string
}
