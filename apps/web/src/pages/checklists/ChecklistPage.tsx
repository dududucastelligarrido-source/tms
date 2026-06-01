import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChecklist, useRespondChecklist } from '../../hooks/useChecklists.js'
import { FileUpload } from '../../components/FileUpload.js'
import { useToast } from '../../components/Toast.js'

interface ItemState {
  passed: boolean | null
  notes: string
  photoUrl: string
}

const TYPE_LABEL: Record<string, string> = {
  departure: 'Checklist de Saída',
  arrival: 'Checklist de Chegada',
  driver_change: 'Checklist de Troca de Motorista',
}

export default function ChecklistPage() {
  const { tripId, checklistId } = useParams<{ tripId: string; checklistId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: checklist, isLoading } = useChecklist(checklistId)
  const respond = useRespondChecklist(checklistId!, tripId)

  const [state, setState] = useState<Record<string, ItemState>>({})

  if (isLoading) return <div className="p-6 text-slate-400">Carregando...</div>

  const items: any[] = checklist?.template?.items ?? []
  const completed = !!checklist?.completedAt
  const type = checklist?.type ?? 'departure'

  function get(itemId: string): ItemState {
    return state[itemId] ?? { passed: null, notes: '', photoUrl: '' }
  }
  function set(itemId: string, patch: Partial<ItemState>) {
    setState(s => ({ ...s, [itemId]: { ...get(itemId), ...patch } }))
  }

  const answered = items.filter(i => get(i.id).passed !== null).length
  const requiredIds = items.filter(i => i.isRequired).map(i => i.id)
  const allRequiredAnswered = requiredIds.every(id => get(id).passed !== null)
  const failedCount = items.filter(i => get(i.id).passed === false).length

  async function handleSubmit() {
    const responses = items
      .filter(i => get(i.id).passed !== null)
      .map(i => {
        const s = get(i.id)
        return {
          itemId: i.id,
          passed: s.passed as boolean,
          ...(s.notes ? { notes: s.notes } : {}),
          ...(s.photoUrl ? { photoUrl: s.photoUrl } : {}),
        }
      })
    try {
      await respond.mutateAsync(responses)
      toast.success('Checklist concluído!')
      navigate(`/trips/${tripId}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao salvar checklist')
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 max-w-md mx-auto">
        <h1 className="text-lg font-bold text-slate-100 mb-2">{checklist?.template?.name}</h1>
        <div className="bg-green-950/30 border border-green-800 rounded-xl p-4 text-green-300 text-sm mb-4">
          ✓ Este checklist já foi concluído em {new Date(checklist.completedAt).toLocaleString('pt-BR')}.
        </div>
        <button onClick={() => navigate(`/trips/${tripId}`)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl py-3 text-sm">
          Voltar à viagem
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 max-w-md mx-auto pb-28">
      <button onClick={() => navigate(`/trips/${tripId}`)} className="text-slate-400 hover:text-slate-200 text-sm mb-3">← Voltar</button>
      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{TYPE_LABEL[type] ?? type}</span>
      <h1 className="text-lg font-bold text-slate-100 mt-2 mb-1">{checklist?.template?.name}</h1>

      {/* Barra de progresso */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{answered} de {items.length} itens</span>
          {failedCount > 0 && <span className="text-red-400">{failedCount} reprovado{failedCount > 1 ? 's' : ''}</span>}
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item: any, idx: number) => {
          const s = get(item.id)
          return (
            <div key={item.id} className={`bg-slate-900 border rounded-xl p-4 transition-colors ${
              s.passed === true ? 'border-green-700' : s.passed === false ? 'border-red-700' : 'border-slate-800'
            }`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-slate-500 text-xs font-mono mt-0.5">{idx + 1}.</span>
                <span className="text-slate-200 text-sm flex-1">
                  {item.description}
                  {item.isRequired && <span className="text-red-400 ml-1">*</span>}
                </span>
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={() => set(item.id, { passed: true })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    s.passed === true ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  ✓ OK
                </button>
                <button onClick={() => set(item.id, { passed: false })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    s.passed === false ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  ✗ Problema
                </button>
              </div>

              {/* Notas e foto aparecem ao reprovar, ou opcionalmente sempre */}
              {s.passed === false && (
                <div className="space-y-3 pt-1">
                  <textarea
                    value={s.notes}
                    onChange={e => set(item.id, { notes: e.target.value })}
                    placeholder="Descreva o problema encontrado..."
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <FileUpload
                    context="checklist"
                    label="Foto do problema (opcional)"
                    existingUrl={s.photoUrl}
                    onUploaded={url => set(item.id, { photoUrl: url })}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Barra fixa de envio */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 p-4 max-w-md mx-auto">
        <button onClick={handleSubmit} disabled={!allRequiredAnswered || respond.isPending}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
          {respond.isPending ? 'Salvando...' : allRequiredAnswered ? 'Concluir Checklist' : `Responda os ${requiredIds.length} itens obrigatórios`}
        </button>
      </div>
    </div>
  )
}
