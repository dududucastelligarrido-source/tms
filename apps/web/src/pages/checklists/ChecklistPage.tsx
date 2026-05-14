import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.js'

export default function ChecklistPage() {
  const { tripId, checklistId } = useParams<{ tripId: string; checklistId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['checklists', checklistId],
    queryFn: () => api.get<any>(`/checklists/${checklistId}`),
  })

  const [responses, setResponses] = useState<Record<string, boolean>>({})

  const submit = useMutation({
    mutationFn: () => api.patch(`/checklists/${checklistId}/respond`, {
      responses: Object.entries(responses).map(([itemId, passed]) => ({ itemId, passed })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', tripId] })
      navigate(`/trips/${tripId}/active`)
    },
  })

  if (isLoading) return <div className="p-6 text-slate-400">Carregando...</div>

  const items = checklist?.template?.items ?? []
  const requiredIds = items.filter((i: any) => i.isRequired).map((i: any) => i.id)
  const allRequiredAnswered = requiredIds.every((id: string) => id in responses)

  return (
    <div className="min-h-screen bg-slate-950 p-4 max-w-sm mx-auto">
      <h1 className="text-lg font-bold text-slate-100 mb-1">{checklist?.template?.name}</h1>
      <p className="text-slate-400 text-sm mb-6">
        {Object.keys(responses).length} de {items.length} itens respondidos
      </p>

      <div className="space-y-2 mb-6">
        {items.map((item: any) => (
          <div key={item.id}
            className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${
              item.id in responses
                ? responses[item.id] ? 'border-green-700 bg-green-950/20' : 'border-red-700 bg-red-950/20'
                : 'border-slate-800'
            }`}
            onClick={() => setResponses(r => ({ ...r, [item.id]: !(r[item.id] ?? false) }))}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${
              item.id in responses
                ? responses[item.id] ? 'bg-green-600 border-green-600 text-white' : 'bg-red-600 border-red-600 text-white'
                : 'border-slate-600'
            }`}>
              {item.id in responses && (responses[item.id] ? '✓' : '✗')}
            </div>
            <span className="text-slate-200 text-sm flex-1">{item.description}</span>
            {item.isRequired && <span className="text-red-400 text-xs">*</span>}
          </div>
        ))}
      </div>

      <button onClick={() => submit.mutate()} disabled={!allRequiredAnswered || submit.isPending}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
        {submit.isPending ? 'Confirmando...' : 'Confirmar Checklist'}
      </button>
    </div>
  )
}
