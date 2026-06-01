import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { SkeletonTable } from '../../components/Skeleton.js'

const TYPE_LABELS: Record<string, string> = {
  troca_oleo: 'Troca de Óleo', pneu: 'Pneu', freio: 'Freio', filtro: 'Filtro',
  correia: 'Correia', revisao_geral: 'Revisão Geral', eletrica: 'Elétrica', outro: 'Outro',
}

const STATUS_CONFIG = {
  overdue: { label: 'Vencida', cls: 'bg-red-950 text-red-400 border-red-800' },
  warning: { label: 'Próxima', cls: 'bg-amber-950 text-amber-400 border-amber-800' },
  ok: { label: 'Em dia', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
}

export default function MaintenanceOverviewPage() {
  const navigate = useNavigate()
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['maintenance-overview'],
    queryFn: () => api.get<any[]>('/maintenance'),
  })

  const overdue = (items as any[]).filter(i => i.status === 'overdue')
  const warning = (items as any[]).filter(i => i.status === 'warning')
  const ok = (items as any[]).filter(i => i.status === 'ok')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Manutenções</h1>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{overdue.length}</div>
          <div className="text-xs text-red-400/70 mt-1">Vencidas</div>
        </div>
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{warning.length}</div>
          <div className="text-xs text-amber-400/70 mt-1">Próximas (&lt; 5.000 km / 30 dias)</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-300">{ok.length}</div>
          <div className="text-xs text-slate-500 mt-1">Em dia</div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (items as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum veículo cadastrado.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Veículo</th>
                <th className="text-left px-4 py-3">KM Atual</th>
                <th className="text-left px-4 py-3">Última Manutenção</th>
                <th className="text-left px-4 py-3">Próxima (KM)</th>
                <th className="text-left px-4 py-3">Próxima (Data)</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {[...overdue, ...warning, ...ok].map((item: any) => {
                const { vehicle, latest, kmRestantes, diasRestantes, status } = item
                const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
                return (
                  <tr key={vehicle.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="text-slate-100 font-medium">{vehicle.plate}</div>
                      <div className="text-slate-500 text-xs">{vehicle.brand} {vehicle.model} · {vehicle.year}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{vehicle.currentKm.toLocaleString('pt-BR')} km</td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <>
                          <div className="text-slate-300">{TYPE_LABELS[latest.type] ?? latest.type}</div>
                          <div className="text-slate-500 text-xs">{new Date(latest.performedAt).toLocaleDateString('pt-BR')}</div>
                        </>
                      ) : (
                        <span className="text-slate-600 text-xs">Nenhuma registrada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {latest?.nextServiceKm ? (
                        <div>
                          <div className="text-slate-300">{latest.nextServiceKm.toLocaleString('pt-BR')} km</div>
                          {kmRestantes !== null && (
                            <div className={`text-xs ${kmRestantes <= 0 ? 'text-red-400' : kmRestantes <= 5000 ? 'text-amber-400' : 'text-slate-500'}`}>
                              {kmRestantes > 0 ? `faltam ${kmRestantes.toLocaleString('pt-BR')} km` : `${Math.abs(kmRestantes).toLocaleString('pt-BR')} km atrasada`}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {latest?.nextServiceDate ? (
                        <div>
                          <div className="text-slate-300">{new Date(latest.nextServiceDate).toLocaleDateString('pt-BR')}</div>
                          {diasRestantes !== null && (
                            <div className={`text-xs ${diasRestantes <= 0 ? 'text-red-400' : diasRestantes <= 30 ? 'text-amber-400' : 'text-slate-500'}`}>
                              {diasRestantes > 0 ? `em ${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrasada`}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => navigate(`/vehicles/${vehicle.id}/maintenance`)}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-slate-700">
                        Detalhes
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
