import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useDrivers } from '../../hooks/useDrivers.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'

const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E']
const emptyForm = { name: '', cpf: '', cnhNumber: '', cnhCategory: 'B', cnhExpiresAt: '' }

function toDateInput(iso: string) {
  return iso ? iso.split('T')[0] : ''
}

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers()
  const user = getUser()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/drivers', { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); setShowForm(false); setForm(emptyForm); setError('') },
    onError: (e: any) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.patch(`/drivers/${id}`, { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); setEditingId(null); setEditError('') },
    onError: (e: any) => setEditError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/drivers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })

  function startEdit(d: any) {
    setEditingId(d.id)
    setEditForm({ name: d.name, cpf: d.cpf, cnhNumber: d.cnhNumber, cnhCategory: d.cnhCategory, cnhExpiresAt: toDateInput(d.cnhExpiresAt) })
    setEditError('')
  }

  const FormFields = ({ f, set }: { f: typeof emptyForm; set: (fn: (prev: typeof emptyForm) => typeof emptyForm) => void }) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs text-slate-400 mb-1">Nome</label>
        <input value={f.name} onChange={e => set(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="João da Silva" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">CPF (só números)</label>
        <input value={f.cpf} onChange={e => set(p => ({ ...p, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} className={inputClass} placeholder="12345678901" maxLength={11} />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Nº CNH</label>
        <input value={f.cnhNumber} onChange={e => set(p => ({ ...p, cnhNumber: e.target.value }))} className={inputClass} placeholder="12345678900" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Categoria CNH</label>
        <select value={f.cnhCategory} onChange={e => set(p => ({ ...p, cnhCategory: e.target.value }))} className={inputClass}>
          {CNH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Validade CNH</label>
        <input type="date" value={f.cnhExpiresAt} onChange={e => set(p => ({ ...p, cnhExpiresAt: e.target.value }))} className={inputClass} />
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Motoristas</h1>
        {user?.role === 'admin' && (
          <button onClick={() => { setShowForm(true); setEditingId(null) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Motorista
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Motorista</h2>
          <FormFields f={form} set={setForm} />
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
            <div key={d.id} className="border-b border-slate-800 last:border-0">
              {editingId === d.id ? (
                <div className="p-4">
                  <FormFields f={editForm} set={setEditForm} />
                  {editError && <p className="text-red-400 text-xs mt-3">{editError}</p>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => update.mutate({ id: d.id, data: editForm })} disabled={update.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                      {update.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-slate-100 font-medium text-sm">{d.name}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      CNH {d.cnhNumber} · Cat. {d.cnhCategory} · Válida até {new Date(d.cnhExpiresAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(d)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded">Editar</button>
                      <button onClick={() => confirm('Excluir este motorista?') && remove.mutate(d.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded">
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {(drivers as any[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum motorista cadastrado.</div>}
        </div>
      )}
    </div>
  )
}
