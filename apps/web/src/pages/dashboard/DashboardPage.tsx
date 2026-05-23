import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { useTrips } from '../../hooks/useTrips.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const { data: activeTrips = [] } = useTrips({ status: 'active' })
  const { data: allTrips = [] } = useTrips()
  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<any>('/reports/dashboard'),
    enabled: isAdmin,
  })

  const totalCosts = (allTrips as any[]).flatMap((t: any) => t.costs ?? []).reduce((sum: number, c: any) => sum + Number(c.amount), 0)
  const completedToday = (allTrips as any[]).filter((t: any) =>
    t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
        {isAdmin && (
          <Link to="/trips/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Nova Viagem
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Viagens Ativas" value={(activeTrips as any[]).length} color="text-blue-400" />
        <KpiCard label="Concluídas Hoje" value={completedToday.length} color="text-green-400" />
        <KpiCard label="Custos Totais" value={`R$ ${totalCosts.toFixed(2)}`} color="text-yellow-400" />
        <KpiCard label="Total de Viagens" value={(allTrips as any[]).length} color="text-slate-200" />
      </div>

      {isAdmin && dash && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Viagens por Dia (30 dias)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dash.tripsPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Bar dataKey="count" name="Viagens" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Custos por Categoria">
            {dash.costsByCategory.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sem custos no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dash.costsByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dash.costsByCategory.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `R$ ${Number(v).toFixed(2)}`}
                    itemStyle={{ color: '#94a3b8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="KM por Motorista (30 dias)">
            {dash.kmByDriver.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sem dados de KM no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dash.kmByDriver} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `${v.toLocaleString('pt-BR')} km`}
                    itemStyle={{ color: '#34d399' }}
                  />
                  <Bar dataKey="km" name="KM" fill="#22c55e" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Eficiência de Combustível (KM/L)">
            {dash.fuelTrend.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sem dados de combustível no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dash.fuelTrend} margin={{ top: 0, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `${v} km/L`}
                    itemStyle={{ color: '#f59e0b' }}
                  />
                  <Line dataKey="kmPerLiter" name="KM/L" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Viagens Recentes</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {(allTrips as any[]).slice(0, 8).map((trip: any) => (
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
          {(allTrips as any[]).length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">Nenhuma viagem encontrada.</div>
          )}
        </div>
      </div>
    </div>
  )
}
