import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { getUser } from '../../lib/auth.js'
import { SkeletonList } from '../../components/Skeleton.js'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada',
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-950 text-blue-400',
  active: 'bg-green-950 text-green-400',
  completed: 'bg-slate-800 text-slate-400',
  cancelled: 'bg-red-950 text-red-400',
}

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'draft', label: 'Não Saíram' },
  { key: 'active', label: 'Em Curso' },
  { key: 'completed', label: 'Concluídas' },
  { key: 'cancelled', label: 'Canceladas' },
]

function tripDate(trip: any): Date {
  return new Date(trip.completedAt ?? trip.startedAt ?? trip.createdAt)
}

function fmt(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const LIMIT = 20

export default function TripsPage() {
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [page, setPage] = useState(1)
  const user = getUser()
  const { data: vehicles = [] } = useVehicles()

  const now = new Date()

  const { data: result, isLoading } = useTrips({
    status: tab || undefined,
    page,
    limit: LIMIT,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(vehicleId ? { vehicleId } : {}),
  })

  const trips = result?.data ?? []
  const total = result?.total ?? 0
  const pages = result?.pages ?? 1

  const filtered = search
    ? trips.filter((t: any) => {
        const q = search.toLowerCase()
        return (
          t.originAddress?.toLowerCase().includes(q) ||
          t.destinationAddress?.toLowerCase().includes(q) ||
          t.driver?.name?.toLowerCase().includes(q) ||
          t.vehicle?.plate?.toLowerCase().includes(q)
        )
      })
    : trips

  function handleTabChange(key: string) {
    setTab(key)
    setPage(1)
  }

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Viagens</h1>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs">{total} viagens</span>
          {user?.role === 'admin' && (
            <Link to="/trips/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Nova Viagem
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={vehicleId}
          onChange={e => { setVehicleId(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Todos os veículos</option>
          {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <input
          type="date" value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500"
          title="Data início"
        />
        <input
          type="date" value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500"
          title="Data fim"
        />
        {(vehicleId || startDate || endDate) && (
          <button onClick={() => { setVehicleId(''); setStartDate(''); setEndDate(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 border border-slate-700 rounded-lg">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por rota, motorista ou placa..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500"
        />
        <button onClick={handleSearch}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm">
          Buscar
        </button>
        {search && (
          <button onClick={() => { setSearch(''); setSearchInput('') }}
            className="text-slate-400 hover:text-slate-200 text-sm px-2">
            ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <SkeletonList rows={8} />
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {filtered.map((trip: any) => {
              const date = tripDate(trip)
              const kmTotal = trip.kmEnd != null ? trip.kmEnd - trip.kmStart : null
              const totalCosts = (trip.costs ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0)
              return (
                <Link
                  key={trip.id}
                  to={trip.status === 'active' ? `/trips/${trip.id}/active` : `/trips/${trip.id}`}
                  className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 font-medium text-sm truncate">
                      {trip.originAddress} → {trip.destinationAddress}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{trip.driver?.name}</span>
                      <span>·</span>
                      <span>{trip.vehicle?.plate}</span>
                      {kmTotal != null && (
                        <>
                          <span>·</span>
                          <span className="text-green-400">{kmTotal.toLocaleString('pt-BR')} km</span>
                        </>
                      )}
                      {trip.cartaFrete && (
                        <>
                          <span>·</span>
                          <span className="text-yellow-400">R$ {Number(trip.cartaFrete).toFixed(2)}</span>
                        </>
                      )}
                      {totalCosts > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-400">custos R$ {totalCosts.toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[trip.status]}`}>
                      {STATUS_LABELS[trip.status]}
                    </span>
                    <span className="text-slate-500 text-xs">{fmt(date)}</span>
                  </div>
                </Link>
              )
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">Nenhuma viagem encontrada.</div>
            )}
          </div>

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-500 text-xs">
                Página {page} de {pages} · {total} viagens
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition-colors"
                >
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
