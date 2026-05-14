import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips.js'

const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada' }
const STATUS_COLORS: Record<string, string> = { draft: 'bg-blue-950 text-blue-400', active: 'bg-green-950 text-green-400', completed: 'bg-slate-800 text-slate-400', cancelled: 'bg-red-950 text-red-400' }

export default function TripsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: trips = [], isLoading } = useTrips(statusFilter ? { status: statusFilter } : undefined)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Viagens</h1>
        <Link to="/trips/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Nova Viagem
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'active', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {s === '' ? 'Todas' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {trips.map((trip: any) => (
            <Link key={trip.id} to={trip.status === 'active' ? `/trips/${trip.id}/active` : `/trips/${trip.id}`}
              className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-slate-100 font-medium text-sm truncate">{trip.originAddress} → {trip.destinationAddress}</div>
                <div className="text-slate-400 text-xs mt-0.5">{trip.driver?.name} · {trip.vehicle?.plate} · KM {trip.kmStart}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ml-4 ${STATUS_COLORS[trip.status]}`}>
                {STATUS_LABELS[trip.status]}
              </span>
            </Link>
          ))}
          {trips.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Nenhuma viagem encontrada.</div>}
        </div>
      )}
    </div>
  )
}
