import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export function useDrivers() {
  return useQuery({ queryKey: ['drivers'], queryFn: () => api.get<any[]>('/drivers') })
}
