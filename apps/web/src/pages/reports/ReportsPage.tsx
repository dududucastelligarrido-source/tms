import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api.js'
import { exportPDF, exportExcel } from './reportExport.js'

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
            <button onClick={() => exportPDF(data)} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Exportar PDF
            </button>
            <button onClick={() => exportExcel(data)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
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

          {/* Custos por categoria */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Custos por Categoria</h2>
            <div className="space-y-2">
              {Object.entries(data.costs.byCategory).map(([cat, val]: any) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-slate-400">{COST_LABELS[cat] ?? cat}</span>
                  <span className="text-slate-200 font-medium">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {Object.keys(data.costs.byCategory).length === 0 && <p className="text-slate-500 text-sm">Nenhum custo no período.</p>}
            </div>
          </div>

          {/* KM por motorista */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">KM por Motorista</h2>
            <div className="space-y-2">
              {data.kmByDriver.map((d: any) => (
                <div key={d.name} className="flex justify-between text-sm">
                  <span className="text-slate-400">{d.name}</span>
                  <span className="text-slate-200 font-medium">{d.km.toLocaleString('pt-BR')} km</span>
                </div>
              ))}
              {data.kmByDriver.length === 0 && <p className="text-slate-500 text-sm">Nenhum dado no período.</p>}
            </div>
          </div>

          {/* KM por veículo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">KM por Veículo</h2>
            <div className="space-y-2">
              {data.kmByVehicle.map((v: any) => (
                <div key={v.plate} className="flex justify-between text-sm">
                  <span className="text-slate-400">{v.plate} — {v.model}</span>
                  <span className="text-slate-200 font-medium">{v.km.toLocaleString('pt-BR')} km</span>
                </div>
              ))}
              {data.kmByVehicle.length === 0 && <p className="text-slate-500 text-sm">Nenhum dado no período.</p>}
            </div>
          </div>

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
        </div>
      )}
    </div>
  )
}
