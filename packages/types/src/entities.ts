// packages/types/src/entities.ts
export type TenantPlan = 'free' | 'basic' | 'pro'
export type UserRole = 'super_admin' | 'admin' | 'motorista'
export type VehicleType = 'caminhao' | 'van' | 'utilitario' | 'carreta' | 'outro'
export type CnhCategory = 'A' | 'B' | 'C' | 'D' | 'E'
export type TripStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type CostCategory = 'fuel' | 'toll' | 'meal' | 'maintenance' | 'other'
export type ChecklistType = 'departure' | 'arrival' | 'driver_change'
export type KmLogEventType = 'start' | 'end' | 'driver_change'

export interface Tenant {
  id: string
  name: string
  cnpj: string
  plan: TenantPlan
  isActive: boolean
  createdAt: string
}

export interface User {
  id: string
  tenantId: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface Vehicle {
  id: string
  tenantId: string
  plate: string
  model: string
  brand: string
  year: number
  type: VehicleType
  currentKm: number
  isActive: boolean
  createdAt: string
}

export interface Driver {
  id: string
  tenantId: string
  userId: string | null
  name: string
  cpf: string
  cnhNumber: string
  cnhCategory: CnhCategory
  cnhExpiresAt: string
  isActive: boolean
  createdAt: string
}

export interface Trip {
  id: string
  tenantId: string
  driverId: string
  vehicleId: string
  originAddress: string
  originLat: number | null
  originLng: number | null
  destinationAddress: string
  destinationLat: number | null
  destinationLng: number | null
  status: TripStatus
  kmStart: number
  kmEnd: number | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TripCost {
  id: string
  tenantId: string
  tripId: string
  category: CostCategory
  description: string
  amount: number
  receiptUrl: string | null
  paidAt: string
  createdBy: string
  createdAt: string
}

export interface KmLog {
  id: string
  tenantId: string
  tripId: string
  vehicleId: string
  driverId: string
  kmStart: number
  kmEnd: number | null
  photoOdometerUrl: string | null
  loggedAt: string
  eventType: KmLogEventType
}

export interface ChecklistTemplate {
  id: string
  tenantId: string
  name: string
  type: ChecklistType
  isActive: boolean
  items: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  templateId: string
  description: string
  isRequired: boolean
  orderIndex: number
}

export interface TripChecklist {
  id: string
  tenantId: string
  tripId: string
  templateId: string
  type: ChecklistType
  completedBy: string | null
  completedAt: string | null
  responses: ChecklistResponse[]
}

export interface ChecklistResponse {
  id: string
  tripChecklistId: string
  itemId: string
  passed: boolean
  notes: string | null
  photoUrl: string | null
}
