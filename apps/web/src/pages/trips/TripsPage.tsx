import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips.js'
import { getUser } from '../../lib/auth.js'

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

export default function TripsPage() {
  const [tab, setTab] = useState('')
  const [onlyThisMonth, setOnlyThisMonth] = useState(false)
  const [search, setSearch] = useState('')
  const { data: allTrips = [], isLoading } = useTrips()
  const user = getUser()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const counts = useMemo(() => {
    const trips = allTrips as any[]
    return {
      '': trips.length,
      draft: trips.filter(t => t.status === 'draft').length,
      active: trips.filter(t => t.status === 'active').length,
      completed: trips.filter(t => t.status === 'completed').length,
      cancelled: trips.filter(t => t.status === 'cancelled').length,
    }
  }, [allTrips])

  const trips = useMemo(() => {
    let list = allTrips as any[]
    if (tab) list = list.filter(t => t.status === tab)
    if (onlyThisMonth) list = list.filter(t => {
      const d = tripDate(t)
      return d >= monthStart && d <= monthEnd
    })
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.originAddress?.toLowerCase().includes(q) ||
        t.destinationAddress?.toLowerCase().includes(q) ||
        t.driver?.name?.toLowerCase().includes(q) ||
        t.vehicle?.plate?.toLowerCase().includes(q)
      )
    }
    return list
  }, [allTrips, tab, onlyThisMonth, search])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Viagens</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOnlyThisMonth(v => !v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              onlyThisMonth ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {now.toLocaleString('pt-BR', { month: 'long' }).charAt(0).toUpperCase() +
              now.toLocaleString('pt-BR', { month: 'long' }).slice(1)}
          </button>
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
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === t.key ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {counts[t.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por rota, motorista ou placa..."
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm mb-4 placeholder-slate-500"
      />

      {isLoading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {trips.map((trip: any) => {
            const date = tripDate(trip)
            const kmTotal = trip.kmEnd != null ? trip.kmEnd - trip.kmStart : null
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
          {trips.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">Nenhuma viagem encontrada.</div>
          )}
        </div>
      )}
    </div>
  )
}
