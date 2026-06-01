import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

interface MaintenancePage { data: any[]; total: number; page: number; pages: number }

export function useMaintenance(vehicleId: string, page = 1) {
  return useQuery({
    queryKey: ['maintenance', vehicleId, page],
    queryFn: () => api.get<MaintenancePage>(`/vehicles/${vehicleId}/maintenance?page=${page}&limit=50`),
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

export function useUpdateMaintenance(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/vehicles/${vehicleId}/maintenance/${id}`, data),
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
