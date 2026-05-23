import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.js'

export default function ProfilePage() {
  const qc = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get<any>('/users/me') })

  const [infoForm, setInfoForm] = useState({ name: '', email: '' })
  const [infoEditing, setInfoEditing] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoSuccess, setInfoSuccess] = useState('')

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const updateInfo = useMutation({
    mutationFn: (data: { name: string; email: string }) => api.patch('/users/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); setInfoEditing(false); setInfoSuccess('Dados atualizados!'); setInfoError('') },
    onError: (e: any) => { setInfoError(e.message); setInfoSuccess('') },
  })

  const updatePw = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => api.patch('/users/me', data),
    onSuccess: () => { setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); setPwSuccess('Senha alterada!'); setPwError('') },
    onError: (e: any) => { setPwError(e.message); setPwSuccess('') },
  })

  function startEditInfo() {
    setInfoForm({ name: me?.name ?? '', email: me?.email ?? '' })
    setInfoEditing(true)
    setInfoSuccess('')
    setInfoError('')
  }

  function handlePwSubmit() {
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('As senhas não coincidem'); return }
    updatePw.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-bold text-slate-100 mb-6">Meu Perfil</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Dados Pessoais</h2>
          {!infoEditing && <button onClick={startEditInfo} className="text-xs text-blue-400 hover:text-blue-300">Editar</button>}
        </div>

        {infoEditing ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome</label>
                <input value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                <input type="email" value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
              </div>
            </div>
            {infoError && <p className="text-red-400 text-xs mt-3">{infoError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => updateInfo.mutate(infoForm)} disabled={updateInfo.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {updateInfo.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setInfoEditing(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm">Cancelar</button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div><span className="text-xs text-slate-500">Nome</span><p className="text-sm text-slate-200">{me?.name}</p></div>
            <div><span className="text-xs text-slate-500">E-mail</span><p className="text-sm text-slate-200">{me?.email}</p></div>
            <div><span className="text-xs text-slate-500">Perfil</span><p className="text-sm text-slate-200 capitalize">{me?.role}</p></div>
          </div>
        )}
        {infoSuccess && <p className="text-green-400 text-xs mt-3">{infoSuccess}</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Alterar Senha</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Senha Atual</label>
            <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nova Senha</label>
            <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} className={inputClass} placeholder="mínimo 6 caracteres" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Confirmar Nova Senha</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className={inputClass} />
          </div>
        </div>
        {pwError && <p className="text-red-400 text-xs mt-3">{pwError}</p>}
        {pwSuccess && <p className="text-green-400 text-xs mt-3">{pwSuccess}</p>}
        <button onClick={handlePwSubmit} disabled={updatePw.isPending}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {updatePw.isPending ? 'Salvando...' : 'Alterar Senha'}
        </button>
      </div>
    </div>
  )
}
