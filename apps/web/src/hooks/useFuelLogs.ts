import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

interface FuelLogPage { data: any[]; total: number; page: number; pages: number }

export function useFuelLogs(filters: Record<string, string | number | undefined> = {}) {
  const merged = { limit: 50, ...filters }
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(merged).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  ).toString()
  return useQuery({
    queryKey: ['fuel-logs', filters],
    queryFn: () => api.get<FuelLogPage>(`/fuel-logs${params ? `?${params}` : ''}`),
  })
}

export function useCreateFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/fuel-logs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
  })
}

export function useDeleteFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/fuel-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
  })
}
