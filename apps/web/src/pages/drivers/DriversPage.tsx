import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useDrivers } from '../../hooks/useDrivers.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'
import { useToast } from '../../components/Toast.js'
import { useConfirm } from '../../components/ConfirmModal.js'
import { isValidCPF } from '../../lib/validation.js'

const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E']
const emptyForm = { name: '', cpf: '', cnhNumber: '', cnhCategory: 'B', cnhExpiresAt: '' }

function validateDriverForm(f: typeof emptyForm): string | null {
  if (!f.name.trim()) return 'Nome é obrigatório'
  if (f.cpf.length !== 11) return 'CPF deve ter 11 dígitos'
  if (!isValidCPF(f.cpf)) return 'CPF inválido — verifique os dígitos'
  if (!f.cnhNumber.trim()) return 'Número da CNH é obrigatório'
  if (!f.cnhExpiresAt) return 'Validade da CNH é obrigatória'
  return null
}

function toDateInput(iso: string) {
  return iso ? iso.split('T')[0] : ''
}

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers()
  const user = getUser()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')

  const toast = useToast()
  const confirm = useConfirm()
  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/drivers', { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); setShowForm(false); setForm(emptyForm); setError(''); toast.success('Motorista cadastrado!') },
    onError: (e: any) => { setError(e.message); toast.error(e.message) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.patch(`/drivers/${id}`, { ...data, cnhExpiresAt: new Date(data.cnhExpiresAt).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); setEditingId(null); setEditError(''); toast.success('Motorista atualizado!') },
    onError: (e: any) => { setEditError(e.message); toast.error(e.message) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/drivers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success('Motorista removido.') },
    onError: (e: any) => toast.error(e.message),
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">Motoristas</h1>
        {user?.role === 'admin' && (
          <button onClick={() => { setShowForm(true); setEditingId(null) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Motorista
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nome, CPF ou CNH..."
        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 mb-4"
      />

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Motorista</h2>
          <FormFields f={form} set={setForm} />
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={() => { const err = validateDriverForm(form); if (err) { setError(err); return } create.mutate(form) }} disabled={create.isPending}
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
        <>
        {/* Painel de alertas de CNH */}
        {(() => {
          const hoje = Date.now()
          const vencidas = (drivers as any[]).filter(d => new Date(d.cnhExpiresAt).getTime() < hoje)
          const proximas = (drivers as any[]).filter(d => {
            const diff = (new Date(d.cnhExpiresAt).getTime() - hoje) / 86400000
            return diff >= 0 && diff <= 30
          })
          if (vencidas.length === 0 && proximas.length === 0) return null
          return (
            <div className="space-y-2 mb-4">
              {vencidas.length > 0 && (
                <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
                  ⚠️ <strong>{vencidas.length}</strong> CNH vencida{vencidas.length > 1 ? 's' : ''}: {vencidas.map((d: any) => d.name).join(', ')}
                </div>
              )}
              {proximas.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-300">
                  ⚠️ <strong>{proximas.length}</strong> CNH vence em até 30 dias: {proximas.map((d: any) => d.name).join(', ')}
                </div>
              )}
            </div>
          )
        })()}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {(drivers as any[])
            .filter((d: any) => {
              if (!search) return true
              const q = search.toLowerCase()
              return d.name?.toLowerCase().includes(q) || d.cpf?.includes(q) || d.cnhNumber?.toLowerCase().includes(q)
            })
            .map((d: any) => {
            const hoje = Date.now()
            const expiryMs = new Date(d.cnhExpiresAt).getTime()
            const diffDias = Math.ceil((expiryMs - hoje) / 86400000)
            const cnhStatus = diffDias < 0 ? 'expired' : diffDias <= 30 ? 'warning' : 'ok'
            return (
            <div key={d.id} className="border-b border-slate-800 last:border-0">
              {editingId === d.id ? (
                <div className="p-4">
                  <FormFields f={editForm} set={setEditForm} />
                  {editError && <p className="text-red-400 text-xs mt-3">{editError}</p>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { const err = validateDriverForm(editForm); if (err) { setEditError(err); return } update.mutate({ id: d.id, data: editForm }) }} disabled={update.isPending}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-400 text-xs">
                        CNH {d.cnhNumber} · Cat. {d.cnhCategory} · Válida até {new Date(d.cnhExpiresAt).toLocaleDateString('pt-BR')}
                      </span>
                      {cnhStatus === 'expired' && (
                        <span className="text-xs font-semibold bg-red-950 text-red-400 px-1.5 py-0.5 rounded-full">Vencida</span>
                      )}
                      {cnhStatus === 'warning' && (
                        <span className="text-xs font-semibold bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded-full">Vence em {diffDias}d</span>
                      )}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(d)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded">Editar</button>
                      <button onClick={async () => { if (await confirm({ title: 'Excluir motorista', message: `Excluir ${d.name}? Esta ação não pode ser desfeita.` })) remove.mutate(d.id) }}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded">
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
          })}
          {(drivers as any[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum motorista cadastrado.</div>}
          {(drivers as any[]).length > 0 && search && (drivers as any[]).filter((d: any) => { const q = search.toLowerCase(); return d.name?.toLowerCase().includes(q) || d.cpf?.includes(q) || d.cnhNumber?.toLowerCase().includes(q) }).length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">Nenhum motorista encontrado para "{search}".</div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
