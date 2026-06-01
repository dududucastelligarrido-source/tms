import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFuelLogs, useCreateFuelLog, useUpdateFuelLog, useDeleteFuelLog } from '../../hooks/useFuelLogs.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useDrivers } from '../../hooks/useDrivers.js'
import { getUser } from '../../lib/auth.js'
import { useToast } from '../../components/Toast.js'
import { useConfirm } from '../../components/ConfirmModal.js'
import { SkeletonTable } from '../../components/Skeleton.js'
import { useSort, SortIcon } from '../../hooks/useSort.js'
import { FileUpload } from '../../components/FileUpload.js'
import { api, isQueued } from '../../lib/api.js'

const ANOMALY_LABELS: Record<string, string> = {
  low_efficiency: 'Consumo baixo',
  odometer_regression: 'Hodômetro inconsistente',
  volume_outlier: 'Volume atípico',
}

const EMPTY_FORM = {
  vehicleId: '', driverId: '', tripId: '',
  loggedAt: '', fuelType: 'diesel' as 'diesel' | 'arla',
  liters: '', pricePerLiter: '', station: '', kmAtFueling: '',
  receiptUrl: '',
}

const EMPTY_EDIT = { liters: '', pricePerLiter: '', station: '', kmAtFueling: '', loggedAt: '' }

export default function FuelPage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const [page, setPage] = useState(1)
  const [filterVehicleId, setFilterVehicleId] = useState('')
  const [filterDriverId, setFilterDriverId] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const { data: logsResult, isLoading } = useFuelLogs({
    page,
    limit: 50,
    ...(filterVehicleId ? { vehicleId: filterVehicleId } : {}),
    ...(filterDriverId ? { driverId: filterDriverId } : {}),
    ...(filterStartDate ? { startDate: filterStartDate } : {}),
    ...(filterEndDate ? { endDate: filterEndDate } : {}),
  })
  const logsRaw = logsResult?.data ?? []
  const logsPages = logsResult?.pages ?? 1
  const { sorted: logs, key: sortKey, dir: sortDir, toggle: sortToggle } = useSort(logsRaw as any[], 'loggedAt', 'desc')
  const { data: vehiclesPage } = useVehicles({ limit: 200 })
  const { data: driversPage } = useDrivers({ limit: 200 })
  const vehicles = vehiclesPage?.data ?? []
  const drivers = driversPage?.data ?? []
  const createLog = useCreateFuelLog()
  const updateLog = useUpdateFuelLog()
  const deleteLog = useDeleteFuelLog()

  const [showAnomalies, setShowAnomalies] = useState(false)
  const { data: anomaliesResult } = useQuery({
    queryKey: ['fuel-anomalies'],
    queryFn: () => api.get<{ data: any[]; total: number }>('/fuel-anomalies?days=90'),
    enabled: isAdmin,
  })
  const anomalies = anomaliesResult?.data ?? []

  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [editError, setEditError] = useState('')

  function startEdit(log: any) {
    setEditingId(log.id)
    setEditForm({
      liters: String(log.liters),
      pricePerLiter: String(log.pricePerLiter),
      station: log.station ?? '',
      kmAtFueling: String(log.kmAtFueling),
      loggedAt: new Date(log.loggedAt).toISOString().split('T')[0],
    })
    setEditError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    setEditError('')
    try {
      await updateLog.mutateAsync({
        id: editingId,
        data: {
          liters: Number(editForm.liters),
          pricePerLiter: Number(editForm.pricePerLiter),
          kmAtFueling: Number(editForm.kmAtFueling),
          loggedAt: new Date(editForm.loggedAt).toISOString(),
          ...(editForm.station ? { station: editForm.station } : {}),
        },
      })
      setEditingId(null)
      toast.success('Abastecimento atualizado!')
    } catch (e: any) {
      setEditError(e.message)
      toast.error(e.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const result = await createLog.mutateAsync({
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        ...(form.tripId ? { tripId: form.tripId } : {}),
        loggedAt: new Date(form.loggedAt).toISOString(),
        fuelType: form.fuelType,
        liters: Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        ...(form.station ? { station: form.station } : {}),
        ...(form.receiptUrl ? { receiptUrl: form.receiptUrl } : {}),
        kmAtFueling: Number(form.kmAtFueling),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success(isQueued(result) ? 'Salvo offline — será enviado ao reconectar.' : 'Abastecimento registrado!')
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Excluir abastecimento', message: 'Excluir este registro de combustível? Esta ação não pode ser desfeita.' })) return
    try {
      await deleteLog.mutateAsync(id)
      toast.success('Registro excluído.')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const fuelTypeLabel = (type: string) => type === 'diesel' ? 'Diesel' : 'Arla 32'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">Controle de Combustível</h1>
        <button onClick={() => setShowForm(s => !s)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          {showForm ? 'Fechar' : '+ Novo Abastecimento'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterVehicleId}
          onChange={e => { setFilterVehicleId(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">Todos os veículos</option>
          {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select
          value={filterDriverId}
          onChange={e => { setFilterDriverId(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">Todos os motoristas</option>
          {(drivers as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input
          type="date"
          value={filterStartDate}
          onChange={e => { setFilterStartDate(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          title="Data início"
        />
        <input
          type="date"
          value={filterEndDate}
          onChange={e => { setFilterEndDate(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          title="Data fim"
        />
        {(filterVehicleId || filterDriverId || filterStartDate || filterEndDate) && (
          <button
            onClick={() => { setFilterVehicleId(''); setFilterDriverId(''); setFilterStartDate(''); setFilterEndDate(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 border border-slate-700 rounded-lg"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Anomalias de consumo (admin) */}
      {isAdmin && anomalies.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl mb-6 overflow-hidden">
          <button
            onClick={() => setShowAnomalies(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-950/20"
          >
            <span className="text-sm font-semibold text-amber-300">
              ⚠️ {anomalies.length} anomalia{anomalies.length > 1 ? 's' : ''} de consumo detectada{anomalies.length > 1 ? 's' : ''} (últimos 90 dias)
            </span>
            <span className="text-amber-400 text-xs">{showAnomalies ? 'Ocultar ▲' : 'Ver ▼'}</span>
          </button>
          {showAnomalies && (
            <div className="border-t border-amber-900/60 divide-y divide-amber-900/30">
              {anomalies.map((a: any) => (
                <div key={`${a.logId}-${a.type}`} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${a.severity === 'high' ? 'bg-red-950 text-red-400' : 'bg-amber-900/60 text-amber-300'}`}>
                    {ANOMALY_LABELS[a.type] ?? a.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200">{a.plate} — {a.model} <span className="text-slate-500">· {a.driverName}</span></div>
                    <div className="text-slate-400 text-xs">{a.detail}</div>
                  </div>
                  <span className="text-slate-500 text-xs shrink-0">{new Date(a.loggedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

          <FileUpload
            context="receipt"
            onUploaded={url => setForm(f => ({ ...f, receiptUrl: url }))}
            existingUrl={form.receiptUrl}
          />

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
        <SkeletonTable rows={8} cols={9} />
      ) : (logs as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum abastecimento registrado.</p>
      ) : (
        <>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                {[
                  { label: 'Data', k: 'loggedAt', align: 'left' },
                  { label: 'Veículo', k: null, align: 'left' },
                  { label: 'Motorista', k: null, align: 'left' },
                  { label: 'Tipo', k: 'fuelType', align: 'left' },
                  { label: 'Litros', k: 'liters', align: 'right' },
                  { label: 'R$/L', k: 'pricePerLiter', align: 'right' },
                  { label: 'Total', k: 'totalAmount', align: 'right' },
                  { label: 'KM/L', k: 'kmPerLiter', align: 'right' },
                  { label: 'KM', k: 'kmAtFueling', align: 'right' },
                ].map(col => (
                  <th key={col.label}
                    className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.k ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                    onClick={() => col.k && sortToggle(col.k as any)}
                  >
                    {col.label}
                    {col.k && <SortIcon active={sortKey === col.k} dir={sortDir} />}
                  </th>
                ))}
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map((log: any) => (
                <>
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
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => editingId === log.id ? setEditingId(null) : startEdit(log)}
                            className="text-slate-400 hover:text-slate-200 text-xs">
                            {editingId === log.id ? 'Fechar' : 'Editar'}
                          </button>
                          <button onClick={() => handleDelete(log.id)} className="text-red-400 hover:text-red-300 text-xs">Excluir</button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {editingId === log.id && (
                    <tr key={`edit-${log.id}`} className="bg-slate-800/60 border-b border-slate-700">
                      <td colSpan={isAdmin ? 10 : 9} className="px-4 py-3">
                        {editError && <p className="text-red-400 text-xs mb-2">{editError}</p>}
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Data</label>
                            <input type="date" value={editForm.loggedAt} onChange={e => setEditForm(f => ({ ...f, loggedAt: e.target.value }))}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 w-32" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Litros</label>
                            <input type="number" step="0.001" value={editForm.liters} onChange={e => setEditForm(f => ({ ...f, liters: e.target.value }))}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 w-24" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">R$/L</label>
                            <input type="number" step="0.0001" value={editForm.pricePerLiter} onChange={e => setEditForm(f => ({ ...f, pricePerLiter: e.target.value }))}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 w-24" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">KM</label>
                            <input type="number" value={editForm.kmAtFueling} onChange={e => setEditForm(f => ({ ...f, kmAtFueling: e.target.value }))}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 w-28" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Posto</label>
                            <input type="text" value={editForm.station} onChange={e => setEditForm(f => ({ ...f, station: e.target.value }))}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 w-36" />
                          </div>
                          <button onClick={handleUpdate} disabled={updateLog.isPending}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5">
                            {updateLog.isPending ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        {logsPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-slate-500 text-xs">Página {page} de {logsPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(logsPages, p + 1))} disabled={page === logsPages}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg">
                Próxima →
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}
