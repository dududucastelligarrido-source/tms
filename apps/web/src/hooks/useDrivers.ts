import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

interface DriverPage { data: any[]; total: number; page: number; pages: number }

export function useDrivers(filters: Record<string, string | number | undefined> = {}) {
  const merged = { limit: 50, ...filters }
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(merged).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  ).toString()
  return useQuery({
    queryKey: ['drivers', filters],
    queryFn: () => api.get<DriverPage>(`/drivers${params ? `?${params}` : ''}`),
  })
}

export function useCreateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/drivers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })
}

export function useUpdateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.patch(`/drivers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })
}

export function useDeleteDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/drivers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })
}
