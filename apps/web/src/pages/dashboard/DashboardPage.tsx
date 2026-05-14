import { Link } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips.js'
import { getUser } from '../../lib/auth.js'

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const user = getUser()
  const { data: activeTrips = [] } = useTrips({ status: 'active' })
  const { data: allTrips = [] } = useTrips()

  const totalCosts = allTrips.flatMap((t: any) => t.costs ?? []).reduce((sum: number, c: any) => sum + Number(c.amount), 0)
  const completedToday = allTrips.filter((t: any) =>
    t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
        {user?.role === 'admin' && (
          <Link to="/trips/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Nova Viagem
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Viagens Ativas" value={activeTrips.length} color="text-blue-400" />
        <KpiCard label="Concluídas Hoje" value={completedToday.length} color="text-green-400" />
        <KpiCard label="Custos Totais" value={`R$ ${totalCosts.toFixed(2)}`} color="text-yellow-400" />
        <KpiCard label="Total de Viagens" value={allTrips.length} color="text-slate-200" />
      </div>

      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Viagens Recentes</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {allTrips.slice(0, 10).map((trip: any) => (
          <Link key={trip.id} to={`/trips/${trip.id}`}
            className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors"
          >
            <div>
              <div className="text-slate-100 font-medium text-sm">{trip.originAddress} → {trip.destinationAddress}</div>
              <div className="text-slate-400 text-xs mt-0.5">{trip.driver?.name} · {trip.vehicle?.plate}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              trip.status === 'active' ? 'bg-green-950 text-green-400' :
              trip.status === 'completed' ? 'bg-slate-800 text-slate-400' :
              trip.status === 'cancelled' ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'
            }`}>
              {trip.status.toUpperCase()}
            </span>
          </Link>
        ))}
        {allTrips.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhuma viagem encontrada.</div>
        )}
      </div>
    </div>
  )
}
