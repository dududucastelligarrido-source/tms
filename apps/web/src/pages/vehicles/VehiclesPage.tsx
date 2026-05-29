import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useVehicles } from '../../hooks/useVehicles.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'
import { useToast } from '../../components/Toast.js'
import { useConfirm } from '../../components/ConfirmModal.js'

const TYPE_LABELS: Record<string, string> = { caminhao: 'Caminhão', van: 'Van', utilitario: 'Utilitário', carreta: 'Carreta', outro: 'Outro' }
const emptyForm = { plate: '', brand: '', model: '', year: new Date().getFullYear(), currentKm: 0, type: 'caminhao' }

export default function VehiclesPage() {
  const navigate = useNavigate()
  const { data: vehicles = [], isLoading } = useVehicles()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editError, setEditError] = useState('')

  const toast = useToast()
  const confirm = useConfirm()
  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/vehicles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setShowForm(false); setForm(emptyForm); setError(''); toast.success('Veículo cadastrado!') },
    onError: (e: any) => { setError(e.message); toast.error(e.message) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) => api.patch(`/vehicles/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setEditingId(null); setEditError(''); toast.success('Veículo atualizado!') },
    onError: (e: any) => { setEditError(e.message); toast.error(e.message) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.success('Veículo removido.') },
    onError: (e: any) => toast.error(e.message),
  })

  function startEdit(v: any) {
    setEditingId(v.id)
    setEditForm({ plate: v.plate, brand: v.brand, model: v.model, year: v.year, currentKm: v.currentKm, type: v.type })
    setEditError('')
  }

  const FormFields = ({ f, set }: { f: typeof emptyForm; set: (fn: (prev: typeof emptyForm) => typeof emptyForm) => void }) => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Placa</label>
        <input value={f.plate} onChange={e => set(p => ({ ...p, plate: e.target.value }))} className={inputClass} placeholder="ABC-1234" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Marca</label>
        <input value={f.brand} onChange={e => set(p => ({ ...p, brand: e.target.value }))} className={inputClass} placeholder="Volvo" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Modelo</label>
        <input value={f.model} onChange={e => set(p => ({ ...p, model: e.target.value }))} className={inputClass} placeholder="FH 460" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Tipo</label>
        <select value={f.type} onChange={e => set(p => ({ ...p, type: e.target.value }))} className={inputClass}>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Ano</label>
        <input type="number" value={f.year} onChange={e => set(p => ({ ...p, year: Number(e.target.value) }))} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">KM Atual</label>
        <input type="number" value={f.currentKm} onChange={e => set(p => ({ ...p, currentKm: Number(e.target.value) }))} className={inputClass} />
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">Veículos</h1>
        {isAdmin && (
          <button onClick={() => { setShowForm(true); setEditingId(null) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Veículo
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por placa, marca ou modelo..."
        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 mb-4"
      />

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Veículo</h2>
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
          {(vehicles as any[])
            .filter((v: any) => {
              if (!search) return true
              const q = search.toLowerCase()
              return v.plate?.toLowerCase().includes(q) || v.brand?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q)
            })
            .map((v: any) => (
            <div key={v.id} className="border-b border-slate-800 last:border-0">
              {editingId === v.id ? (
                <div className="p-4">
                  <FormFields f={editForm} set={setEditForm} />
                  {editError && <p className="text-red-400 text-xs mt-3">{editError}</p>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => update.mutate({ id: v.id, data: editForm })} disabled={update.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                      {update.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-slate-100 font-medium text-sm">{v.plate} — {v.brand} {v.model}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{v.year} · {TYPE_LABELS[v.type] ?? v.type} · KM {v.currentKm.toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/vehicles/${v.id}/maintenance`)}
                      className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 border border-slate-700 rounded-lg transition-colors">
                      Manutenções
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => startEdit(v)}
                          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded">
                          Editar
                        </button>
                        <button onClick={async () => { if (await confirm({ title: 'Excluir veículo', message: `Excluir ${v.plate}? Esta ação não pode ser desfeita.` })) remove.mutate(v.id) }}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded">
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(vehicles as any[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum veículo cadastrado.</div>}
          {(vehicles as any[]).length > 0 && (vehicles as any[]).filter((v: any) => { if (!search) return true; const q = search.toLowerCase(); return v.plate?.toLowerCase().includes(q) || v.brand?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q) }).length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">Nenhum veículo encontrado para "{search}".</div>
          )}
        </div>
      )}
    </div>
  )
}
