import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.js'

type User = { id: string; name: string; email: string; role: string; createdAt: string }

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', motorista: 'Motorista' }

export default function UsersPage() {
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'motorista' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setForm({ name: '', email: '', password: '', role: 'motorista' }); setError('') },
    onError: (e: any) => setError(e.message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Usuários</h1>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Usuário</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="João da Silva" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="joao@empresa.com" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Senha</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Perfil</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                <option value="motorista">Motorista</option>
                <option value="admin">Admin</option>
              </select>
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
          {(users as User[]).map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-slate-100 font-medium text-sm">{u.name}</div>
                <div className="text-slate-400 text-xs mt-0.5">{u.email} · {ROLE_LABELS[u.role] ?? u.role}</div>
              </div>
              <button onClick={() => deactivate.mutate(u.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded">
                Remover
              </button>
            </div>
          ))}
          {(users as User[]).length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhum usuário cadastrado.</div>}
        </div>
      )}
    </div>
  )
}
