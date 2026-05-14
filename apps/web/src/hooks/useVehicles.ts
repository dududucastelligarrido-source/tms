import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export function useVehicles() {
  return useQuery({ queryKey: ['vehicles'], queryFn: () => api.get<any[]>('/vehicles') })
}
