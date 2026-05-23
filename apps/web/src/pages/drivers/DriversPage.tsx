import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useDrivers } from '../../hooks/useDrivers.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'

const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E']

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers()
  const user = getUser()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', cpf: '', cnhNumber: '', cnhCategory: 'B', cnhExpiresAt: '' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/drivers', { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); setShowForm(false); setForm({ name: '', cpf: '', cnhNumber: '', cnhCategory: 'B', cnhExpiresAt: '' }) },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Motoristas</h1>
        {user?.role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Motorista
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Motorista</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="João da Silva" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CPF (só números)</label>
              <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="12345678901" maxLength={11} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nº CNH</label>
              <input value={form.cnhNumber} onChange={e => setForm(f => ({ ...f, cnhNumber: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="12345678900" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoria CNH</label>
              <select value={form.cnhCategory} onChange={e => setForm(f => ({ ...f, cnhCategory: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                {CNH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Validade CNH</label>
              <input type="date" value={form.cnhExpiresAt} onChange={e => setForm(f => ({ ...f, cnhExpiresAt: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
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
          {(drivers as any[]).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-slate-100 font-medium text-sm">{d.name}</div>
                <div className="text-slate-400 text-xs mt-0.5">
                  CNH {d.cnhNumber} · Cat. {d.cnhCategory} · Válida até {new Date(d.cnhExpiresAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
          {(drivers as any[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum motorista cadastrado.</div>}
        </div>
      )}
    </div>
  )
}
