import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export function useFuelLogs(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString()
  return useQuery({
    queryKey: ['fuel-logs', filters],
    queryFn: () => api.get<any[]>(`/fuel-logs${params ? `?${params}` : ''}`),
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
