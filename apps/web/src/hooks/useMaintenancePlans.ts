import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export function useMaintenancePlans(vehicleId: string) {
  return useQuery({
    queryKey: ['maintenance-plans', vehicleId],
    queryFn: () => api.get<any[]>(`/vehicles/${vehicleId}/maintenance-plans`),
    enabled: !!vehicleId,
  })
}

export function useCreateMaintenancePlan(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/vehicles/${vehicleId}/maintenance-plans`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-plans', vehicleId] }),
  })
}

export function useDeleteMaintenancePlan(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance-plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-plans', vehicleId] }),
  })
}
