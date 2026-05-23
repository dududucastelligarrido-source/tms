import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export function useMaintenance(vehicleId: string) {
  return useQuery({
    queryKey: ['maintenance', vehicleId],
    queryFn: () => api.get<any[]>(`/vehicles/${vehicleId}/maintenance`),
    enabled: !!vehicleId,
  })
}

export function useCreateMaintenance(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/vehicles/${vehicleId}/maintenance`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', vehicleId] }),
  })
}

export function useDeleteMaintenance(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${vehicleId}/maintenance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', vehicleId] }),
  })
}
