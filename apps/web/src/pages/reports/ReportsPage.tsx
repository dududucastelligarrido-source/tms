import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api.js'
import { exportPDF, exportExcel } from './reportExport.js'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada' }
const COST_LABELS: Record<string, string> = { fuel: 'Combustível', toll: 'Pedágio', meal: 'Refeição', maintenance: 'Manutenção', other: 'Outros' }

function today() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [queried, setQueried] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', startDate, endDate],
    queryFn: () => api.get<any>(`/reports/summary?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z`),
    enabled: queried,
  })

  function handleSearch() { setQueried(true); refetch() }

  const inputClass = 'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Relatórios</h1>
        {data && (
          <div className="flex gap-2">
            <button onClick={() => { exportPDF(data).catch(console.error) }} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Exportar PDF
            </button>
            <button onClick={() => { exportExcel(data).catch(console.error) }} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Exportar Excel
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data Início</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data Fim</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </div>
          <button onClick={handleSearch} disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {isLoading ? 'Buscando...' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {data && (
        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-100">{data.trips.length}</div>
              <div className="text-xs text-slate-400 mt-1">Total de Viagens</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">{data.trips.filter((t: any) => t.status === 'completed').length}</div>
              <div className="text-xs text-slate-400 mt-1">Concluídas</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">
                {data.trips.reduce((s: number, t: any) => s + (t.kmTotal ?? 0), 0).toLocaleString('pt-BR')} km
              </div>
              <div className="text-xs text-slate-400 mt-1">KM Total</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-400">
                R$ {data.costs.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Custo Total</div>
            </div>
          </div>

          {/* Gráfico — Custos por categoria */}
          {Object.keys(data.costs.byCategory).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Custos por Categoria</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(data.costs.byCategory).map(([cat, val]: any) => ({ name: COST_LABELS[cat] ?? cat, valor: Number(val) }))} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} formatter={(v: any) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {Object.entries(data.costs.byCategory).map(([cat, val]: any) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-slate-400">{COST_LABELS[cat] ?? cat}</span>
                    <span className="text-slate-200 font-medium">R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico — KM por motorista */}
          {data.kmByDriver.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">KM por Motorista</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.kmByDriver.map((d: any) => ({ name: d.name.split(' ')[0], km: d.km }))} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} formatter={(v: any) => [`${Number(v).toLocaleString('pt-BR')} km`, 'KM']} />
                  <Bar dataKey="km" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {data.kmByDriver.map((d: any) => (
                  <div key={d.name} className="flex justify-between text-sm">
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.km.toLocaleString('pt-BR')} km</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico — KM por veículo */}
          {data.kmByVehicle.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">KM por Veículo</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.kmByVehicle.map((v: any) => ({ name: v.plate, km: v.km }))} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} formatter={(v: any) => [`${Number(v).toLocaleString('pt-BR')} km`, 'KM']} />
                  <Bar dataKey="km" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {data.kmByVehicle.map((v: any) => (
                  <div key={v.plate} className="flex justify-between text-sm">
                    <span className="text-slate-400">{v.plate} — {v.model}</span>
                    <span className="text-slate-200 font-medium">{v.km.toLocaleString('pt-BR')} km</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tendência temporal — Viagens por dia */}
          {data.tripsByDay?.length > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Viagens por Dia</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.tripsByDay.map((d: any) => ({ ...d, date: d.date.slice(5) }))} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} formatter={(v: any) => [v, 'Viagens']} />
                  <Line dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Combustível */}
          {data.costs?.fuel && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Combustível</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-amber-400">{Number(data.costs.fuel.totalLiters).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</div>
                  <div className="text-xs text-slate-500 mt-1">Total Abastecido</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">R$ {Number(data.costs.fuel.totalSpend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-slate-500 mt-1">Gasto Total</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{data.costs.fuel.avgKmL ? `${Number(data.costs.fuel.avgKmL).toFixed(2)} km/L` : '—'}</div>
                  <div className="text-xs text-slate-500 mt-1">Média Diesel</div>
                </div>
              </div>
              {data.costs.fuel.byVehicle?.length > 0 && (
                <div className="space-y-2">
                  {data.costs.fuel.byVehicle.map((v: any) => (
                    <div key={v.plate} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800 last:border-0">
                      <span className="text-slate-400">{v.plate} — {v.model}</span>
                      <div className="flex gap-6 text-right">
                        <span className="text-amber-400">{Number(v.liters).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</span>
                        <span className="text-slate-200 font-medium w-28">R$ {Number(v.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custo por veículo */}
          {data.costByVehicle?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-slate-300">Custo por Veículo</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                    <th className="text-left px-4 py-3">Veículo</th>
                    <th className="text-right px-4 py-3">Custos Viagem</th>
                    <th className="text-right px-4 py-3">Combustível</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.costByVehicle.map((v: any) => (
                    <tr key={v.plate} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-300">{v.plate} — {v.model}</td>
                      <td className="px-4 py-3 text-right text-slate-400">R$ {Number(v.tripCosts).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-amber-400">R$ {Number(v.fuelCosts).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-100 font-semibold">R$ {Number(v.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Viagens */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300">Viagens no Período</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left p-3 text-xs text-slate-500">Data</th>
                    <th className="text-left p-3 text-xs text-slate-500">Motorista</th>
                    <th className="text-left p-3 text-xs text-slate-500">Veículo</th>
                    <th className="text-left p-3 text-xs text-slate-500">Origem → Destino</th>
                    <th className="text-right p-3 text-xs text-slate-500">KM</th>
                    <th className="text-right p-3 text-xs text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trips.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-800 last:border-0">
                      <td className="p-3 text-slate-400">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-slate-300">{t.driver}</td>
                      <td className="p-3 text-slate-400">{t.vehicle}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">{t.origin} → {t.destination}</td>
                      <td className="p-3 text-slate-300 text-right">{t.kmTotal != null ? `${t.kmTotal} km` : '-'}</td>
                      <td className="p-3 text-right"><span className="text-xs text-slate-400">{STATUS_LABELS[t.status]}</span></td>
                    </tr>
                  ))}
                  {data.trips.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma viagem no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance por Motorista */}
          {data.trips.length > 0 && (() => {
            const byDriver: Record<string, { name: string; total: number; completed: number; cancelled: number; km: number; costs: number }> = {}
            for (const t of data.trips) {
              if (!byDriver[t.driver]) byDriver[t.driver] = { name: t.driver, total: 0, completed: 0, cancelled: 0, km: 0, costs: 0 }
              byDriver[t.driver].total++
              if (t.status === 'completed') byDriver[t.driver].completed++
              if (t.status === 'cancelled') byDriver[t.driver].cancelled++
              byDriver[t.driver].km += t.kmTotal ?? 0
              byDriver[t.driver].costs += t.totalCosts ?? 0
            }
            const rows = Object.values(byDriver).sort((a, b) => b.km - a.km)
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-300">Performance por Motorista</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                      <th className="text-left px-4 py-3">Motorista</th>
                      <th className="text-right px-4 py-3">Viagens</th>
                      <th className="text-right px-4 py-3">Concluídas</th>
                      <th className="text-right px-4 py-3">Canceladas</th>
                      <th className="text-right px-4 py-3">Taxa</th>
                      <th className="text-right px-4 py-3">KM Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const taxa = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0
                      return (
                        <tr key={r.name} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-slate-100 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{r.total}</td>
                          <td className="px-4 py-3 text-right text-green-400">{r.completed}</td>
                          <td className="px-4 py-3 text-right text-red-400">{r.cancelled}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${taxa >= 80 ? 'text-green-400' : taxa >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {taxa}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-yellow-400 font-medium">{r.km.toLocaleString('pt-BR')} km</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
