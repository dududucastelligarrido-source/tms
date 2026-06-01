import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'
import { SkeletonTable } from '../../components/Skeleton.js'

const ACTION_LABELS: Record<string, string> = {
  create: 'Criou', update: 'Editou', delete: 'Excluiu',
  start: 'Iniciou', complete: 'Concluiu', cancel: 'Cancelou',
  respond: 'Respondeu', 'change-driver': 'Trocou motorista', 'send-now': 'Enviou alertas',
}
const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-950 text-green-400',
  update: 'bg-blue-950 text-blue-400',
  delete: 'bg-red-950 text-red-400',
  start: 'bg-emerald-950 text-emerald-400',
  complete: 'bg-slate-800 text-slate-300',
  cancel: 'bg-red-950 text-red-400',
}
const ENTITY_LABELS: Record<string, string> = {
  trips: 'Viagem', vehicles: 'Veículo', drivers: 'Motorista', users: 'Usuário',
  'fuel-logs': 'Combustível', maintenance: 'Manutenção', costs: 'Custo',
  checklists: 'Checklist', 'checklist-templates': 'Template de checklist',
}

function label(map: Record<string, string>, key: string) {
  return map[key] ?? key
}

export default function AuditLogPage() {
  const user = getUser()
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: facets } = useQuery({
    queryKey: ['audit-facets'],
    queryFn: () => api.get<{ entities: string[]; actions: string[] }>('/audit-logs/facets'),
    enabled: user?.role === 'admin',
  })

  const params = new URLSearchParams({ page: String(page), limit: '50' })
  if (entity) params.set('entity', entity)
  if (action) params.set('action', action)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  const { data: result, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entity, action, startDate, endDate],
    queryFn: () => api.get<any>(`/audit-logs?${params.toString()}`),
    enabled: user?.role === 'admin',
  })

  const logs = result?.data ?? []
  const pages = result?.pages ?? 1
  const total = result?.total ?? 0

  function resetFilters() {
    setEntity(''); setAction(''); setStartDate(''); setEndDate(''); setPage(1)
  }
  const hasFilters = entity || action || startDate || endDate

  if (user?.role !== 'admin') {
    return <div className="p-6 text-slate-400">Acesso restrito a administradores.</div>
  }

  const selectCls = 'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-4">Log de Auditoria</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">Todos os tipos</option>
          {(facets?.entities ?? []).map(en => <option key={en} value={en}>{label(ENTITY_LABELS, en)}</option>)}
        </select>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">Todas as ações</option>
          {(facets?.actions ?? []).map(ac => <option key={ac} value={ac}>{label(ACTION_LABELS, ac)}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={selectCls} />
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={selectCls} />
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 border border-slate-700 rounded-lg">
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={10} cols={4} />
      ) : logs.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum registro de auditoria encontrado.</p>
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                    <th className="px-4 py-3 text-left">Data/Hora</th>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">Ação</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-slate-300">{log.user?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-slate-800 text-slate-400'}`}>
                          {label(ACTION_LABELS, log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {label(ENTITY_LABELS, log.entity)}
                        {log.entityId && <span className="text-slate-600 text-xs ml-1 font-mono">#{String(log.entityId).slice(0, 8)}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title={log.summary ?? ''}>
                        {log.summary ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-500 text-xs">{total} registros · Página {page} de {pages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg">
                  ← Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg">
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
