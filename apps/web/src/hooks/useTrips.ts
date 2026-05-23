import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

interface TripPage {
  data: any[]
  total: number
  page: number
  pages: number
}

export function useTrips(filters?: { status?: string; driverId?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ ...filters, limit: filters?.limit ?? 50 }).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString()
  return useQuery({
    queryKey: ['trips', filters],
    queryFn: () => api.get<TripPage>(`/trips${params ? `?${params}` : ''}`),
  })
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => api.get<any>(`/trips/${id}`),
    enabled: !!id,
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post<any>('/trips', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })
}

export function useStartTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch<any>(`/trips/${id}/start`),
    onSuccess: (_: any, id: string) => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      qc.invalidateQueries({ queryKey: ['trips', id] })
    },
  })
}

export function useCompleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; kmEnd: number }) =>
      api.patch<any>(`/trips/${id}/complete`, data),
    onSuccess: (_: any, { id }: { id: string; kmEnd: number }) => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      qc.invalidateQueries({ queryKey: ['trips', id] })
    },
  })
}

export function useAddCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, ...data }: { tripId: string; category: string; description: string; amount: number; paidAt: string }) =>
      api.post<any>(`/trips/${tripId}/costs`, data),
    onSuccess: (_: any, { tripId }: { tripId: string; category: string; description: string; amount: number; paidAt: string }) =>
      qc.invalidateQueries({ queryKey: ['trips', tripId] }),
  })
}
