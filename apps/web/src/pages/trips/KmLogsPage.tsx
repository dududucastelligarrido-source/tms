import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useDrivers } from '../../hooks/useDrivers.js'
import { SkeletonTable } from '../../components/Skeleton.js'
import { useSort, SortIcon } from '../../hooks/useSort.js'

const EVENT_LABELS: Record<string, string> = {
  start: 'Saída',
  end: 'Chegada',
  driver_change: 'Troca de Motorista',
}

export default function KmLogsPage() {
  const navigate = useNavigate()
  const [filterVehicleId, setFilterVehicleId] = useState('')
  const [filterDriverId, setFilterDriverId] = useState('')

  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()

  const params = new URLSearchParams()
  if (filterVehicleId) params.set('vehicleId', filterVehicleId)
  if (filterDriverId) params.set('driverId', filterDriverId)
  const qs = params.toString()

  const { data: logsRaw = [], isLoading } = useQuery({
    queryKey: ['km-logs', filterVehicleId, filterDriverId],
    queryFn: () => api.get<any[]>(`/km-logs${qs ? `?${qs}` : ''}`),
  })
  const { sorted: logs, key: sortKey, dir: sortDir, toggle: sortToggle } = useSort(logsRaw as any[], 'loggedAt', 'desc')

  const totalKm = (logs as any[]).reduce((s, l) => s + ((l.kmEnd ?? 0) - (l.kmStart ?? 0)), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">Registros de KM</h1>
        {totalKm > 0 && (
          <span className="text-sm text-slate-400">Total: <strong className="text-slate-100">{totalKm.toLocaleString('pt-BR')} km</strong></span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterVehicleId}
          onChange={e => setFilterVehicleId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">Todos os veículos</option>
          {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select
          value={filterDriverId}
          onChange={e => setFilterDriverId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">Todos os motoristas</option>
          {(drivers as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {(filterVehicleId || filterDriverId) && (
          <button
            onClick={() => { setFilterVehicleId(''); setFilterDriverId('') }}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 border border-slate-700 rounded-lg"
          >
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : (logs as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum registro encontrado.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                {[
                  { label: 'Data', k: 'loggedAt', align: 'left' },
                  { label: 'Evento', k: 'eventType', align: 'left' },
                  { label: 'Veículo', k: null, align: 'left' },
                  { label: 'Motorista', k: null, align: 'left' },
                  { label: 'KM Inicial', k: 'kmStart', align: 'right' },
                  { label: 'KM Final', k: 'kmEnd', align: 'right' },
                  { label: 'Percorrido', k: null, align: 'right' },
                ].map(col => (
                  <th key={col.label}
                    className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.k ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                    onClick={() => col.k && sortToggle(col.k as any)}
                  >
                    {col.label}
                    {col.k && <SortIcon active={sortKey === col.k} dir={sortDir} />}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map((log: any) => {
                const percorrido = log.kmEnd != null ? log.kmEnd - log.kmStart : null
                return (
                  <tr key={log.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">{new Date(log.loggedAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        log.eventType === 'start' ? 'bg-blue-950 text-blue-400' :
                        log.eventType === 'end' ? 'bg-green-950 text-green-400' :
                        'bg-amber-950 text-amber-400'
                      }`}>
                        {EVENT_LABELS[log.eventType] ?? log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{log.vehicle?.plate}</td>
                    <td className="px-4 py-3 text-slate-300">{log.driver?.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{log.kmStart?.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{log.kmEnd != null ? log.kmEnd.toLocaleString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {percorrido != null ? (
                        <span className="text-yellow-400 font-medium">{percorrido.toLocaleString('pt-BR')} km</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.tripId && (
                        <button onClick={() => navigate(`/trips/${log.tripId}`)}
                          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 border border-slate-700 rounded">
                          Viagem
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
