import { useParams, useNavigate } from 'react-router-dom'
import { useTrip } from '../../hooks/useTrips.js'
import { api } from '../../lib/api.js'
import { useQueryClient } from '@tanstack/react-query'
import FreightCalculator from '../../components/FreightCalculator.js'

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: trip, isLoading } = useTrip(id!)

  async function cancelTrip() {
    if (!confirm('Cancelar esta viagem?')) return
    await api.patch(`/trips/${id}/cancel`)
    qc.invalidateQueries({ queryKey: ['trips'] })
    navigate('/trips')
  }

  if (isLoading) return <div className="p-6 text-slate-400">Carregando...</div>
  if (!trip) return <div className="p-6 text-slate-400">Viagem não encontrada.</div>

  const t = trip as any

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate('/trips')} className="text-slate-400 hover:text-slate-200 text-sm mb-4">← Voltar</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Detalhe da Viagem</h1>
        {(t.status === 'draft' || t.status === 'active') && (
          <button onClick={cancelTrip} className="text-red-400 hover:text-red-300 text-sm">Cancelar</button>
        )}
      </div>

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

        {t.costs?.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase mb-3">Custos</h2>
            {t.costs.map((cost: any) => (
              <div key={cost.id} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-300 text-sm">{cost.description}</span>
                <span className="text-green-400 text-sm font-medium">R$ {Number(cost.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold">
              <span className="text-slate-300 text-sm">Total</span>
              <span className="text-green-400 text-sm">R$ {t.costs.reduce((s: number, c: any) => s + Number(c.amount), 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
