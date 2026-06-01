import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export interface ChecklistResponse {
  itemId: string
  passed: boolean
  notes?: string
  photoUrl?: string
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get<any[]>('/checklist-templates'),
  })
}

export function useChecklist(checklistId: string | undefined) {
  return useQuery({
    queryKey: ['checklists', checklistId],
    queryFn: () => api.get<any>(`/checklists/${checklistId}`),
    enabled: !!checklistId,
  })
}

export function useCreateChecklist(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { templateId: string; type: string }) =>
      api.post<any>(`/trips/${tripId}/checklists`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', tripId] })
      qc.invalidateQueries({ queryKey: ['trip', tripId] })
    },
  })
}

export function useRespondChecklist(checklistId: string, tripId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (responses: ChecklistResponse[]) =>
      api.patch(`/checklists/${checklistId}/respond`, { responses }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists', checklistId] })
      if (tripId) {
        qc.invalidateQueries({ queryKey: ['trips', tripId] })
        qc.invalidateQueries({ queryKey: ['trip', tripId] })
      }
    },
  })
}
