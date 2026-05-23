import { useState } from 'react'
import { useFuelLogs, useCreateFuelLog, useDeleteFuelLog } from '../../hooks/useFuelLogs.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useDrivers } from '../../hooks/useDrivers.js'
import { getUser } from '../../lib/auth.js'

const EMPTY_FORM = {
  vehicleId: '', driverId: '', tripId: '',
  loggedAt: '', fuelType: 'diesel' as 'diesel' | 'arla',
  liters: '', pricePerLiter: '', station: '', kmAtFueling: '',
}

export default function FuelPage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const { data: logs = [], isLoading } = useFuelLogs()
  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()
  const createLog = useCreateFuelLog()
  const deleteLog = useDeleteFuelLog()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createLog.mutateAsync({
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        ...(form.tripId ? { tripId: form.tripId } : {}),
        loggedAt: new Date(form.loggedAt).toISOString(),
        fuelType: form.fuelType,
        liters: Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        ...(form.station ? { station: form.station } : {}),
        kmAtFueling: Number(form.kmAtFueling),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro de combustível?')) return
    await deleteLog.mutateAsync(id)
  }

  const fuelTypeLabel = (type: string) => type === 'diesel' ? 'Diesel' : 'Arla 32'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Controle de Combustível</h1>
        <button onClick={() => setShowForm(s => !s)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          {showForm ? 'Fechar' : '+ Novo Abastecimento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Registrar Abastecimento</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Veículo</label>
              <select required value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                <option value="">Selecionar...</option>
                {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Motorista</label>
              <select required value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                <option value="">Selecionar...</option>
                {(drivers as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Data / Hora</label>
              <input type="datetime-local" required value={form.loggedAt} onChange={e => setForm(f => ({ ...f, loggedAt: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo de Combustível</label>
              <select value={form.fuelType} onChange={e => setForm(f => ({ ...f, fuelType: e.target.value as any }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                <option value="diesel">Diesel</option>
                <option value="arla">Arla 32</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Litros</label>
              <input type="number" step="0.001" min="0.001" required value={form.liters} onChange={e => setForm(f => ({ ...f, liters: e.target.value }))}
                placeholder="0,000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Preço/Litro (R$)</label>
              <input type="number" step="0.0001" min="0.0001" required value={form.pricePerLiter} onChange={e => setForm(f => ({ ...f, pricePerLiter: e.target.value }))}
                placeholder="0,0000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">KM no Abastecimento</label>
              <input type="number" min="0" required value={form.kmAtFueling} onChange={e => setForm(f => ({ ...f, kmAtFueling: e.target.value }))}
                placeholder="000000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Posto (opcional)</label>
            <input type="text" value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))}
              placeholder="Nome do posto"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
            />
          </div>

          {form.liters && form.pricePerLiter && (
            <p className="text-sm text-slate-400">
              Total estimado: <span className="text-green-400 font-semibold">R$ {(Number(form.liters) * Number(form.pricePerLiter)).toFixed(2)}</span>
            </p>
          )}

          <button type="submit" disabled={createLog.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm">
            {createLog.isPending ? 'Salvando...' : 'Registrar Abastecimento'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : (logs as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum abastecimento registrado.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Veículo</th>
                <th className="text-left px-4 py-3">Motorista</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">R$/L</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">KM/L</th>
                <th className="text-right px-4 py-3">KM</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map((log: any) => (
                <tr key={log.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-300">{new Date(log.loggedAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-slate-300">{log.vehicle?.plate}</td>
                  <td className="px-4 py-3 text-slate-300">{log.driver?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.fuelType === 'diesel' ? 'bg-amber-950 text-amber-400' : 'bg-blue-950 text-blue-400'}`}>
                      {fuelTypeLabel(log.fuelType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{Number(log.liters).toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{Number(log.pricePerLiter).toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-medium">R$ {Number(log.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{log.kmPerLiter ? Number(log.kmPerLiter).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{log.kmAtFueling.toLocaleString('pt-BR')}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(log.id)} className="text-red-400 hover:text-red-300 text-xs">Excluir</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
