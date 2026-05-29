import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useMaintenance, useCreateMaintenance, useUpdateMaintenance, useDeleteMaintenance } from '../../hooks/useMaintenance.js'
import { getUser } from '../../lib/auth.js'
import { useToast } from '../../components/Toast.js'

const TYPE_LABELS: Record<string, string> = {
  troca_oleo: 'Troca de Óleo',
  pneu: 'Pneu',
  freio: 'Freio',
  filtro: 'Filtro',
  correia: 'Correia',
  revisao_geral: 'Revisão Geral',
  eletrica: 'Elétrica',
  outro: 'Outro',
}

const EMPTY_FORM = {
  type: 'revisao_geral',
  description: '',
  performedAt: '',
  kmAtService: '',
  cost: '',
  nextServiceKm: '',
  nextServiceDate: '',
  notes: '',
}

export default function MaintenancePage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const user = getUser()
  const isAdmin = user?.role === 'admin'

  const { data: vehicles = [] } = useVehicles()
  const { data: records = [], isLoading } = useMaintenance(vehicleId!)
  const create = useCreateMaintenance(vehicleId!)
  const update = useUpdateMaintenance(vehicleId!)
  const remove = useDeleteMaintenance(vehicleId!)

  const vehicle = (vehicles as any[]).find((v: any) => v.id === vehicleId)
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState('')

  function startEdit(r: any) {
    setEditingId(r.id)
    setEditForm({
      type: r.type,
      description: r.description,
      performedAt: new Date(r.performedAt).toISOString().split('T')[0],
      kmAtService: String(r.kmAtService),
      cost: r.cost ? String(r.cost) : '',
      nextServiceKm: r.nextServiceKm ? String(r.nextServiceKm) : '',
      nextServiceDate: r.nextServiceDate ? new Date(r.nextServiceDate).toISOString().split('T')[0] : '',
      notes: r.notes ?? '',
    })
    setEditError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    setEditError('')
    try {
      await update.mutateAsync({
        id: editingId,
        data: {
          type: editForm.type,
          description: editForm.description,
          performedAt: new Date(editForm.performedAt).toISOString(),
          kmAtService: Number(editForm.kmAtService),
          ...(editForm.cost ? { cost: Number(editForm.cost) } : {}),
          ...(editForm.nextServiceKm ? { nextServiceKm: Number(editForm.nextServiceKm) } : {}),
          ...(editForm.nextServiceDate ? { nextServiceDate: new Date(editForm.nextServiceDate).toISOString() } : {}),
          ...(editForm.notes ? { notes: editForm.notes } : {}),
        },
      })
      setEditingId(null)
      toast.success('Manutenção atualizada!')
    } catch (e: any) {
      setEditError(e.message)
      toast.error(e.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({
        type: form.type,
        description: form.description,
        performedAt: new Date(form.performedAt).toISOString(),
        kmAtService: Number(form.kmAtService),
        ...(form.cost ? { cost: Number(form.cost) } : {}),
        ...(form.nextServiceKm ? { nextServiceKm: Number(form.nextServiceKm) } : {}),
        ...(form.nextServiceDate ? { nextServiceDate: new Date(form.nextServiceDate).toISOString() } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success('Manutenção registrada!')
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100'

  // Próxima manutenção
  const lastRecord = (records as any[])[0]
  const kmRestantes = lastRecord?.nextServiceKm && vehicle
    ? lastRecord.nextServiceKm - vehicle.currentKm
    : null
  const proximaVencida = kmRestantes !== null && kmRestantes <= 0
  const proximaAlerta = kmRestantes !== null && kmRestantes <= 5000

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => navigate('/vehicles')} className="text-slate-400 hover:text-slate-200 text-sm mb-4">← Veículos</button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : 'Manutenções'}
          </h1>
          {vehicle && (
            <p className="text-slate-400 text-sm mt-0.5">KM atual: {vehicle.currentKm.toLocaleString('pt-BR')}</p>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(s => !s)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {showForm ? 'Fechar' : '+ Registrar Manutenção'}
          </button>
        )}
      </div>

      {/* Alerta próxima revisão */}
      {lastRecord?.nextServiceKm && kmRestantes !== null && (
        <div className={`rounded-xl p-4 mb-6 border ${proximaVencida ? 'bg-red-950/40 border-red-800' : proximaAlerta ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 ${proximaVencida ? 'text-red-400' : proximaAlerta ? 'text-amber-400' : 'text-slate-400'}">
                {proximaVencida ? '⚠️ Manutenção vencida' : proximaAlerta ? '⚠️ Manutenção próxima' : '✓ Próxima manutenção'}
              </p>
              <p className="text-slate-200 text-sm">
                KM previsto: <strong>{lastRecord.nextServiceKm.toLocaleString('pt-BR')}</strong>
                {kmRestantes > 0
                  ? <span className="text-slate-400"> · faltam {kmRestantes.toLocaleString('pt-BR')} km</span>
                  : <span className="text-red-400"> · {Math.abs(kmRestantes).toLocaleString('pt-BR')} km atrasada</span>}
              </p>
            </div>
            {lastRecord.nextServiceDate && (
              <p className="text-slate-400 text-xs">Data: {new Date(lastRecord.nextServiceDate).toLocaleDateString('pt-BR')}</p>
            )}
          </div>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Registrar Manutenção</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Data Realizada</label>
              <input type="date" required value={form.performedAt} onChange={e => setForm(f => ({ ...f, performedAt: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Descrição</label>
            <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Troca de óleo 15W40 + filtro"
              className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">KM na Revisão</label>
              <input type="number" required min="0" value={form.kmAtService} onChange={e => setForm(f => ({ ...f, kmAtService: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Custo (R$)</label>
              <input type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className={inputCls} placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Próxima Revisão (KM)</label>
              <input type="number" min="0" value={form.nextServiceKm} onChange={e => setForm(f => ({ ...f, nextServiceKm: e.target.value }))} className={inputCls} placeholder="Ex: 325000" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Próxima Revisão (Data)</label>
              <input type="date" value={form.nextServiceDate} onChange={e => setForm(f => ({ ...f, nextServiceDate: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Observações</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Opcional" />
          </div>

          <button type="submit" disabled={create.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm">
            {create.isPending ? 'Salvando...' : 'Salvar Manutenção'}
          </button>
        </form>
      )}

      {/* Histórico */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (records as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma manutenção registrada.</p>
      ) : (
        <div className="space-y-3">
          {(records as any[]).map((r: any) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              {editingId === r.id ? (
                <div className="space-y-3">
                  {editError && <p className="text-red-400 text-xs">{editError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Tipo</label>
                      <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Data Realizada</label>
                      <input type="date" value={editForm.performedAt} onChange={e => setEditForm(f => ({ ...f, performedAt: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Descrição</label>
                    <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">KM na Revisão</label>
                      <input type="number" value={editForm.kmAtService} onChange={e => setEditForm(f => ({ ...f, kmAtService: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Custo (R$)</label>
                      <input type="number" step="0.01" value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} className={inputCls} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Próxima Revisão (KM)</label>
                      <input type="number" value={editForm.nextServiceKm} onChange={e => setEditForm(f => ({ ...f, nextServiceKm: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Próxima Revisão (Data)</label>
                      <input type="date" value={editForm.nextServiceDate} onChange={e => setEditForm(f => ({ ...f, nextServiceDate: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Observações</label>
                    <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Opcional" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} disabled={update.isPending}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5">
                      {update.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="text-slate-400 text-xs">{new Date(r.performedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-slate-100 text-sm">{r.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-400">
                      <span>KM: {r.kmAtService.toLocaleString('pt-BR')}</span>
                      {r.cost && <span className="text-green-400">R$ {Number(r.cost).toFixed(2)}</span>}
                      {r.nextServiceKm && <span>Próxima: {r.nextServiceKm.toLocaleString('pt-BR')} km</span>}
                      {r.nextServiceDate && <span>ou {new Date(r.nextServiceDate).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {r.notes && <p className="text-slate-500 text-xs mt-1">{r.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <button onClick={() => startEdit(r)} className="text-slate-400 hover:text-slate-200 text-xs">Editar</button>
                      <button onClick={() => confirm('Excluir registro?') && remove.mutate(r.id, { onSuccess: () => toast.success('Registro excluído.'), onError: (e: any) => toast.error(e.message) })}
                        className="text-red-400 hover:text-red-300 text-xs">
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
