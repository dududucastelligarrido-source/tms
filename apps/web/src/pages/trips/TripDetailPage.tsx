import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTrip } from '../../hooks/useTrips.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useDrivers } from '../../hooks/useDrivers.js'
import { api } from '../../lib/api.js'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import FreightCalculator from '../../components/FreightCalculator.js'
import { getUser } from '../../lib/auth.js'

const COST_CATEGORIES: Record<string, string> = {
  fuel: 'Combustível', toll: 'Pedágio', meal: 'Alimentação', maintenance: 'Manutenção', other: 'Outro',
}

const emptyCostForm = { category: 'toll' as keyof typeof COST_CATEGORIES, description: '', amount: '', paidAt: '' }

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const { data: trip, isLoading } = useTrip(id!)
  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()
  const [showCostForm, setShowCostForm] = useState(false)
  const [costForm, setCostForm] = useState(emptyCostForm)
  const [costError, setCostError] = useState('')
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    originAddress: '', destinationAddress: '', driverId: '', vehicleId: '',
    kmStart: '', cartaFrete: '', adiantamento: '', pesoCarga: '', notes: '',
  })
  const [editError, setEditError] = useState('')

  const updateTrip = useMutation({
    mutationFn: (data: typeof editForm) => api.patch(`/trips/${id}`, {
      originAddress: data.originAddress,
      destinationAddress: data.destinationAddress,
      driverId: data.driverId,
      vehicleId: data.vehicleId,
      kmStart: Number(data.kmStart),
      ...(data.cartaFrete ? { cartaFrete: Number(data.cartaFrete) } : {}),
      ...(data.adiantamento ? { adiantamento: Number(data.adiantamento) } : {}),
      ...(data.pesoCarga ? { pesoCarga: Number(data.pesoCarga) } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trip', id] }); setShowEditForm(false); setEditError('') },
    onError: (e: any) => setEditError(e.message),
  })

  function startEdit(t: any) {
    setEditForm({
      originAddress: t.originAddress ?? '',
      destinationAddress: t.destinationAddress ?? '',
      driverId: t.driverId ?? '',
      vehicleId: t.vehicleId ?? '',
      kmStart: String(t.kmStart ?? ''),
      cartaFrete: t.cartaFrete ? String(t.cartaFrete) : '',
      adiantamento: t.adiantamento ? String(t.adiantamento) : '',
      pesoCarga: t.pesoCarga ? String(t.pesoCarga) : '',
      notes: t.notes ?? '',
    })
    setShowEditForm(true)
    setEditError('')
  }

  const addCost = useMutation({
    mutationFn: (data: typeof costForm) =>
      api.post(`/trips/${id}/costs`, {
        category: data.category,
        description: data.description,
        amount: Number(data.amount),
        paidAt: new Date(data.paidAt).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip', id] })
      setCostForm(emptyCostForm)
      setShowCostForm(false)
      setCostError('')
    },
    onError: (e: any) => setCostError(e.message),
  })

  const deleteCost = useMutation({
    mutationFn: (costId: string) => api.delete(`/trips/${id}/costs/${costId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip', id] }),
  })

  async function cancelTrip() {
    if (!confirm('Cancelar esta viagem?')) return
    await api.patch(`/trips/${id}/cancel`)
    qc.invalidateQueries({ queryKey: ['trips'] })
    navigate('/trips')
  }

  if (isLoading) return <div className="p-6 text-slate-400">Carregando...</div>
  if (!trip) return <div className="p-6 text-slate-400">Viagem não encontrada.</div>

  const t = trip as any
  const canAddCost = t.status === 'draft' || t.status === 'active'
  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate('/trips')} className="text-slate-400 hover:text-slate-200 text-sm mb-4">← Voltar</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Detalhe da Viagem</h1>
        <div className="flex items-center gap-3">
          {isAdmin && t.status === 'draft' && (
            <button onClick={() => showEditForm ? setShowEditForm(false) : startEdit(t)}
              className="text-sm text-slate-400 hover:text-slate-200">
              {showEditForm ? 'Fechar edição' : 'Editar'}
            </button>
          )}
          {(t.status === 'draft' || t.status === 'active') && (
            <button onClick={cancelTrip} className="text-red-400 hover:text-red-300 text-sm">Cancelar</button>
          )}
        </div>
      </div>

      {showEditForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Editar Viagem</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Motorista</label>
                <select value={editForm.driverId} onChange={e => setEditForm(f => ({ ...f, driverId: e.target.value }))} className={inputCls}>
                  <option value="">Selecionar...</option>
                  {(drivers as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Veículo</label>
                <select value={editForm.vehicleId} onChange={e => setEditForm(f => ({ ...f, vehicleId: e.target.value }))} className={inputCls}>
                  <option value="">Selecionar...</option>
                  {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Origem</label>
              <input value={editForm.originAddress} onChange={e => setEditForm(f => ({ ...f, originAddress: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Destino</label>
              <input value={editForm.destinationAddress} onChange={e => setEditForm(f => ({ ...f, destinationAddress: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">KM Inicial</label>
                <input type="number" value={editForm.kmStart} onChange={e => setEditForm(f => ({ ...f, kmStart: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Carta de Frete (R$)</label>
                <input type="number" step="0.01" value={editForm.cartaFrete} onChange={e => setEditForm(f => ({ ...f, cartaFrete: e.target.value }))} className={inputCls} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Adiantamento (R$)</label>
                <input type="number" step="0.01" value={editForm.adiantamento} onChange={e => setEditForm(f => ({ ...f, adiantamento: e.target.value }))} className={inputCls} placeholder="0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Peso da Carga (ton)</label>
                <input type="number" step="0.001" value={editForm.pesoCarga} onChange={e => setEditForm(f => ({ ...f, pesoCarga: e.target.value }))} className={inputCls} placeholder="0,000" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Observações</label>
                <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Opcional" />
              </div>
            </div>
            {editError && <p className="text-red-400 text-xs">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={() => updateTrip.mutate(editForm)} disabled={updateTrip.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
                {updateTrip.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button onClick={() => setShowEditForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg px-4 py-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div><span className="text-slate-400 text-xs uppercase">Origem</span><p className="text-slate-100">{t.originAddress}</p></div>
          <div><span className="text-slate-400 text-xs uppercase">Destino</span><p className="text-slate-100">{t.destinationAddress}</p></div>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-slate-400 text-xs uppercase">Motorista</span><p className="text-slate-100">{t.driver?.name}</p></div>
            <div><span className="text-slate-400 text-xs uppercase">Veículo</span><p className="text-slate-100">{t.vehicle?.plate}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-slate-400 text-xs uppercase">KM Inicial</span><p className="text-slate-100">{t.kmStart}</p></div>
            <div><span className="text-slate-400 text-xs uppercase">KM Final</span><p className="text-slate-100">{t.kmEnd ?? '—'}</p></div>
          </div>
          <div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              t.status === 'active' ? 'bg-green-950 text-green-400' :
              t.status === 'completed' ? 'bg-slate-800 text-slate-400' :
              t.status === 'cancelled' ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'
            }`}>{t.status.toUpperCase()}</span>
          </div>
        </div>

        {(t.cartaFrete || t.adiantamento || t.pesoCarga) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">Financeiro</h2>
            <div className="grid grid-cols-2 gap-4">
              {t.cartaFrete && <div><span className="text-slate-400 text-xs uppercase">Carta de Frete</span><p className="text-slate-100">R$ {Number(t.cartaFrete).toFixed(2)}</p></div>}
              {t.adiantamento && <div><span className="text-slate-400 text-xs uppercase">Adiantamento</span><p className="text-slate-100">R$ {Number(t.adiantamento).toFixed(2)}</p></div>}
              {t.cartaFrete && t.adiantamento && (
                <div><span className="text-slate-400 text-xs uppercase">Saldo a Pagar</span>
                  <p className="text-green-400 font-semibold">R$ {(Number(t.cartaFrete) - Number(t.adiantamento)).toFixed(2)}</p>
                </div>
              )}
              {t.pesoCarga && <div><span className="text-slate-400 text-xs uppercase">Peso da Carga</span><p className="text-slate-100">{Number(t.pesoCarga).toFixed(3)} ton</p></div>}
            </div>
          </div>
        )}

        <FreightCalculator currentCartaFrete={t.cartaFrete ? Number(t.cartaFrete) : undefined} />

        {/* Custos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase">Custos</h2>
            {canAddCost && (
              <button onClick={() => setShowCostForm(s => !s)}
                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-slate-700">
                {showCostForm ? 'Fechar' : '+ Adicionar'}
              </button>
            )}
          </div>

          {showCostForm && (
            <div className="mb-4 space-y-3 border border-slate-700 rounded-lg p-3">
              {costError && <p className="text-red-400 text-xs">{costError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Categoria</label>
                  <select value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value as any }))} className={inputCls}>
                    {Object.entries(COST_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Data</label>
                  <input type="date" required value={costForm.paidAt} onChange={e => setCostForm(f => ({ ...f, paidAt: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Descrição</label>
                <input required value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Pedágio Rodovia Anhanguera"
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" required value={costForm.amount}
                  onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00" className={inputCls} />
              </div>
              <button onClick={() => addCost.mutate(costForm)} disabled={addCost.isPending || !costForm.description || !costForm.amount || !costForm.paidAt}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2">
                {addCost.isPending ? 'Salvando...' : 'Salvar Custo'}
              </button>
            </div>
          )}

          {t.costs?.length > 0 ? (
            <>
              {t.costs.map((cost: any) => (
                <div key={cost.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <span className="text-slate-300 text-sm">{cost.description}</span>
                    <span className="text-slate-500 text-xs ml-2">{COST_CATEGORIES[cost.category] ?? cost.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-400 text-sm font-medium">R$ {Number(cost.amount).toFixed(2)}</span>
                    {isAdmin && (
                      <button onClick={() => confirm('Excluir este custo?') && deleteCost.mutate(cost.id)}
                        className="text-red-400 hover:text-red-300 text-xs">
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-bold">
                <span className="text-slate-300 text-sm">Total</span>
                <span className="text-green-400 text-sm">R$ {t.costs.reduce((s: number, c: any) => s + Number(c.amount), 0).toFixed(2)}</span>
              </div>
            </>
          ) : (
            !showCostForm && <p className="text-slate-500 text-sm text-center py-2">Nenhum custo registrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
