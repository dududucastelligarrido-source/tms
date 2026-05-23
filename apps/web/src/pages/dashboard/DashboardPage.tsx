import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useTrips } from '../../hooks/useTrips.js'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

const PERIOD_OPTS = [
  { value: '7',  label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-950 text-blue-400',
  active: 'bg-green-950 text-green-400',
  completed: 'bg-slate-800 text-slate-400',
  cancelled: 'bg-red-950 text-red-400',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium ml-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function KpiCard({ label, value, sub, color, small, trend }: {
  label: string; value: string; sub?: string; color: string; small?: boolean; trend?: number | null
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-bold ${small ? 'text-xl' : 'text-2xl'} ${color} flex items-baseline flex-wrap gap-1`}>
        {value}
        {trend !== undefined && <TrendBadge pct={trend ?? null} />}
      </div>
      {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}


export default function DashboardPage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const [period, setPeriod] = useState('30')

  const { data: tripsResult } = useTrips({ limit: 6 })
  const allTrips = tripsResult?.data ?? []
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api.get<any>(`/reports/dashboard?period=${period}`),
    enabled: isAdmin,
  })

  const kpis = dash?.kpis
  const trends = dash?.trends
  const alerts = dash?.alerts
  const totalAlerts = (alerts?.cnhExpirando?.length ?? 0) + (alerts?.viagensLongas?.length ?? 0) + (alerts?.manutencaoPendente?.length ?? 0)

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          {totalAlerts > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalAlerts} alertas
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              {PERIOD_OPTS.map(o => (
                <button key={o.value} onClick={() => setPeriod(o.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === o.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
            <Link to="/trips/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Nova Viagem
            </Link>
          )}
        </div>
      </div>

      {/* Alertas */}
      {isAdmin && alerts && totalAlerts > 0 && (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 space-y-2">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Alertas</h2>
          <div className="space-y-2">
            {alerts.cnhExpirando.map((a: any) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">🪪 CNH de <strong>{a.name}</strong> vence em <strong>{a.daysLeft} dias</strong></span>
                <span className="text-red-400 text-xs">{new Date(a.cnhExpiresAt).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
            {alerts.viagensLongas.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">🚛 Viagem {v.origin} → {v.destination} ativa há <strong>{v.hoursActive}h</strong></span>
                <Link to={`/trips/${v.id}/active`} className="text-amber-400 text-xs hover:underline">Ver</Link>
              </div>
            ))}
            {alerts.manutencaoPendente?.map((m: any) => (
              <div key={m.vehicleId} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">🔧 <strong>{m.plate}</strong> — {m.kmRestantes <= 0 ? `manutenção ${Math.abs(m.kmRestantes).toLocaleString('pt-BR')} km atrasada` : `manutenção em ${m.kmRestantes.toLocaleString('pt-BR')} km`}</span>
                <Link to={`/vehicles/${m.vehicleId}/maintenance`} className="text-amber-400 text-xs hover:underline">Ver</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs Financeiros */}
      {isAdmin && kpis ? (
        <>
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Financeiro — últimos {period} dias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Faturamento" value={`R$ ${fmt(kpis.faturamento)}`} color="text-green-400" trend={trends?.faturamento} />
              <KpiCard label="Custos Totais" value={`R$ ${fmt(kpis.custosTotal)}`}
                sub={`Diretos R$ ${fmt(kpis.custosDiretos)} · Combustível R$ ${fmt(kpis.custosCombustivel)}`}
                color="text-red-400" small trend={trends?.custosTotal} />
              <KpiCard label="Margem Bruta" value={`R$ ${fmt(kpis.margem)}`}
                sub={`${kpis.margemPct.toFixed(1)}% do faturamento`}
                color={kpis.margem >= 0 ? 'text-blue-400' : 'text-red-400'} small trend={trends?.margem} />
              <KpiCard label="KM Rodados" value={kpis.kmRodados.toLocaleString('pt-BR')}
                sub={kpis.mediaKmL ? `Média ${kpis.mediaKmL} km/L` : undefined}
                color="text-amber-400" trend={trends?.kmRodados} />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Viagens — últimos {period} dias</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Total" value={String(kpis.viagens.total)} color="text-slate-200" />
              <KpiCard label="Concluídas" value={String(kpis.viagens.completed)} color="text-slate-400" />
              <KpiCard label="Em Curso" value={String(kpis.viagens.active)} color="text-green-400" />
              <KpiCard label="Rascunhos" value={String(kpis.viagens.draft)} color="text-blue-400" />
              <KpiCard label="Canceladas" value={String(kpis.viagens.cancelled)} color="text-red-400" />
            </div>
          </div>
        </>
      ) : !isAdmin ? (
        <div className="grid grid-cols-2 gap-4">
          <KpiCard label="Viagens Ativas" value={String((allTrips as any[]).filter((t: any) => t.status === 'active').length)} color="text-green-400" />
          <KpiCard label="Total de Viagens" value={String((allTrips as any[]).length)} color="text-slate-200" />
        </div>
      ) : (
        <div className="text-slate-500 text-sm">Carregando métricas...</div>
      )}

      {/* Resumo de Frota + Viagens Ativas */}
      {isAdmin && dash && !dashLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Resumo de Frota */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Resumo da Frota</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-slate-100">{dash.fleetSummary.total}</div>
                <div className="text-xs text-slate-400 mt-0.5">Veículos ativos</div>
              </div>
              <div className="bg-green-950/50 border border-green-900/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">{dash.fleetSummary.emViagem}</div>
                <div className="text-xs text-slate-400 mt-0.5">Em viagem</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-slate-400">{dash.fleetSummary.ociosos}</div>
                <div className="text-xs text-slate-400 mt-0.5">Ociosos</div>
              </div>
              <div className={`rounded-lg p-3 ${dash.fleetSummary.manutencaoPendente > 0 ? 'bg-amber-950/50 border border-amber-900/50' : 'bg-slate-800'}`}>
                <div className={`text-2xl font-bold ${dash.fleetSummary.manutencaoPendente > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{dash.fleetSummary.manutencaoPendente}</div>
                <div className="text-xs text-slate-400 mt-0.5">Manutenção pendente</div>
              </div>
            </div>
          </div>

          {/* Viagens Ativas em Destaque */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Viagens em Curso
              <span className="ml-2 bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{dash.activeTripsDetail.length}</span>
            </h2>
            {dash.activeTripsDetail.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">Nenhuma viagem ativa no momento.</p>
            ) : (
              <div className="space-y-2">
                {dash.activeTripsDetail.slice(0, 4).map((t: any) => (
                  <Link key={t.id} to={`/trips/${t.id}/active`}
                    className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-100 text-sm font-medium truncate">{t.origin} → {t.destination}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{t.driver} · {t.vehicle}</div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      {t.hoursActive !== null && (
                        <div className={`text-xs font-semibold ${t.hoursActive >= 48 ? 'text-amber-400' : 'text-green-400'}`}>
                          {t.hoursActive}h
                        </div>
                      )}
                      {t.cartaFrete && <div className="text-xs text-slate-400">R$ {fmt(t.cartaFrete)}</div>}
                    </div>
                  </Link>
                ))}
                {dash.activeTripsDetail.length > 4 && (
                  <Link to="/trips" className="block text-center text-xs text-blue-400 hover:underline pt-1">
                    +{dash.activeTripsDetail.length - 4} viagens →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráficos */}
      {isAdmin && dash && !dashLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <ChartCard title="Faturamento vs Custos">
            {dash.revenueVsCosts.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dash.revenueVsCosts} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `R$ ${fmt(Number(v))}`}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="custos" name="Custos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Viagens por Dia">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dash.tripsPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} interval={Math.floor(dash.tripsPerDay.length / 6)} />
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
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dash.costsByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {dash.costsByCategory.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `R$ ${fmt(Number(v))}`} itemStyle={{ color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="KM por Motorista">
            {dash.kmByDriver.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sem dados de KM no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dash.kmByDriver} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => `${v.toLocaleString('pt-BR')} km`} itemStyle={{ color: '#34d399' }} />
                  <Bar dataKey="km" name="KM" fill="#22c55e" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>
      )}

      {/* Ranking de Motoristas */}
      {isAdmin && dash?.driverRanking?.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ranking de Motoristas — últimos {period} dias</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Motorista</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Viagens</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">KM</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {dash.driverRanking.map((d: any, i: number) => (
                  <tr key={d.name} className="border-b border-slate-800 last:border-0">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{i + 1}º</td>
                    <td className="px-4 py-3 text-slate-100 font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{d.viagens}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{d.km.toLocaleString('pt-BR')} km</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">R$ {fmt(d.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Viagens Recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Viagens Recentes</h2>
          <Link to="/trips" className="text-blue-400 text-xs hover:underline">Ver todas →</Link>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {(allTrips as any[]).slice(0, 6).map((trip: any) => (
            <Link key={trip.id} to={trip.status === 'active' ? `/trips/${trip.id}/active` : `/trips/${trip.id}`}
              className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-slate-100 font-medium text-sm truncate">{trip.originAddress} → {trip.destinationAddress}</div>
                <div className="text-slate-400 text-xs mt-0.5">{trip.driver?.name} · {trip.vehicle?.plate}</div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                {trip.cartaFrete && <span className="text-green-400 text-xs font-medium">R$ {fmt(Number(trip.cartaFrete))}</span>}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[trip.status]}`}>
                  {STATUS_LABELS[trip.status]}
                </span>
              </div>
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
