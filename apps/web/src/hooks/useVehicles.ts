import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

interface VehiclePage { data: any[]; total: number; page: number; pages: number }

export function useVehicles(filters: Record<string, string | number | undefined> = {}) {
  const merged = { limit: 50, ...filters }
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(merged).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  ).toString()
  return useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => api.get<VehiclePage>(`/vehicles${params ? `?${params}` : ''}`),
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/vehicles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.patch(`/vehicles/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}
