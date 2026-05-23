import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useVehicles } from '../../hooks/useVehicles.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'

const TYPE_LABELS: Record<string, string> = { caminhao: 'Caminhão', van: 'Van', utilitario: 'Utilitário', carreta: 'Carreta', outro: 'Outro' }
const emptyForm = { plate: '', brand: '', model: '', year: new Date().getFullYear(), currentKm: 0, type: 'caminhao' }

export default function VehiclesPage() {
  const { data: vehicles = [], isLoading } = useVehicles()
  const user = getUser()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/vehicles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setShowForm(false); setForm(emptyForm); setError('') },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Veículos</h1>
        {user?.role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Veículo
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Veículo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Placa</label>
              <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} className={inputClass} placeholder="ABC-1234" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Marca</label>
              <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inputClass} placeholder="Volvo" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Modelo</label>
              <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={inputClass} placeholder="FH 460" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ano</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">KM Atual</label>
              <input type="number" value={form.currentKm} onChange={e => setForm(f => ({ ...f, currentKm: Number(e.target.value) }))} className={inputClass} />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate(form)} disabled={create.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {create.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {(vehicles as any[]).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-slate-100 font-medium text-sm">{v.plate} — {v.brand} {v.model}</div>
                <div className="text-slate-400 text-xs mt-0.5">{v.year} · {TYPE_LABELS[v.type] ?? v.type} · KM {v.currentKm.toLocaleString('pt-BR')}</div>
              </div>
            </div>
          ))}
          {(vehicles as any[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum veículo cadastrado.</div>}
        </div>
      )}
    </div>
  )
}
