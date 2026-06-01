import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTrip, useCompleteTrip, useAddCost } from '../../hooks/useTrips.js'
import { FileUpload } from '../../components/FileUpload.js'
import { isQueued } from '../../lib/api.js'

export default function ActiveTripPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: trip, isLoading } = useTrip(id!)
  const completeTrip = useCompleteTrip()
  const addCost = useAddCost()

  const [showCostForm, setShowCostForm] = useState(false)
  const [kmEnd, setKmEnd] = useState('')
  const [photoOdometerUrl, setPhotoOdometerUrl] = useState('')
  const [cost, setCost] = useState({ category: 'fuel', description: '', amount: '' })

  async function handleComplete() {
    if (!kmEnd) return alert('Informe o KM final')
    await completeTrip.mutateAsync({
      id: id!,
      kmEnd: Number(kmEnd),
      ...(photoOdometerUrl ? { photoOdometerUrl } : {}),
    })
    navigate(`/trips/${id}`)
  }

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault()
    const result = await addCost.mutateAsync({ tripId: id!, ...cost, amount: Number(cost.amount), paidAt: new Date().toISOString() })
    setCost({ category: 'fuel', description: '', amount: '' })
    setShowCostForm(false)
    if (isQueued(result)) alert('Custo salvo offline — será enviado ao reconectar.')
  }

  if (isLoading) return <div className="p-6 text-slate-400">Carregando...</div>
  if (!trip) return <div className="p-6 text-slate-400">Viagem não encontrada.</div>

  const t = trip as any
  const elapsed = t.startedAt ? Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 60000) : 0
  const totalCosts = (t.costs ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0)

  return (
    <div className="min-h-screen bg-slate-950 p-4 max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <span className="bg-green-950 text-green-400 text-xs font-bold px-2 py-1 rounded-full">EM CURSO</span>
        <span className="text-slate-400 text-sm">{t.originAddress?.split(',')[0]} → {t.destinationAddress?.split(',')[0]}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-slate-400 text-xs mb-1">Tempo</div>
          <div className="text-slate-100 font-bold">{Math.floor(elapsed / 60)}h {elapsed % 60}m</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-slate-400 text-xs mb-1">KM Inicial</div>
          <div className="text-slate-100 font-bold">{t.kmStart?.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4">
        <div className="text-slate-400 text-xs mb-1">Custos lançados</div>
        <div className="text-green-400 font-bold text-lg">R$ {totalCosts.toFixed(2)}</div>
        {(t.costs ?? []).slice(0, 3).map((c: any) => (
          <div key={c.id} className="text-xs text-slate-500 mt-1">{c.description}: R$ {Number(c.amount).toFixed(2)}</div>
        ))}
      </div>

      {showCostForm ? (
        <form onSubmit={handleAddCost} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-slate-100 font-medium text-sm">Lançar Custo</h3>
          <select value={cost.category} onChange={e => setCost(c => ({ ...c, category: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
            <option value="fuel">Combustível</option>
            <option value="toll">Pedágio</option>
            <option value="meal">Alimentação</option>
            <option value="maintenance">Manutenção</option>
            <option value="other">Outro</option>
          </select>
          <input placeholder="Descrição" value={cost.description} onChange={e => setCost(c => ({ ...c, description: e.target.value }))} required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
          <input type="number" placeholder="Valor (R$)" value={cost.amount} onChange={e => setCost(c => ({ ...c, amount: e.target.value }))} required min={0} step={0.01}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCostForm(false)} className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-sm">Cancelar</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Salvar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowCostForm(true)}
          className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 text-blue-400 font-medium rounded-xl py-3 mb-3 text-sm transition-colors">
          + Lançar Custo
        </button>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">KM Final (para encerrar)</label>
          <input type="number" value={kmEnd} onChange={e => setKmEnd(e.target.value)} placeholder={`> ${t.kmStart}`} min={t.kmStart}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
        </div>
        <FileUpload
          context="odometer"
          onUploaded={setPhotoOdometerUrl}
          existingUrl={photoOdometerUrl}
        />
        <button onClick={handleComplete} disabled={completeTrip.isPending || !kmEnd}
          className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
          {completeTrip.isPending ? 'Encerrando...' : 'Encerrar Viagem'}
        </button>
      </div>
    </div>
  )
}
