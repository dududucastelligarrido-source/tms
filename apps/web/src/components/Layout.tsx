import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clearTokens, getUser } from '../lib/auth.js'
import { api } from '../lib/api.js'
import { useOfflineStatus } from '../hooks/useOfflineStatus.js'
import { clearFailed } from '../lib/offlineQueue.js'
import {
  LayoutDashboard, Route, Truck, User, Users, BarChart2, Fuel, Wrench, ClipboardList, Gauge, Bell, Menu, X,
  WifiOff, RefreshCw, ScrollText, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

// pt-BR: "1 ação" / "N ações"
function acoes(n: number) {
  return n === 1 ? '1 ação' : `${n} ações`
}

function OfflineBanner() {
  const { online, pending, failed } = useOfflineStatus()
  const qc = useQueryClient()

  useEffect(() => {
    function onFlushed() { qc.invalidateQueries() }
    window.addEventListener('offline-queue-flushed', onFlushed)
    return () => window.removeEventListener('offline-queue-flushed', onFlushed)
  }, [qc])

  if (online && pending === 0 && failed === 0) return null

  return (
    <div className="text-xs font-medium">
      {!online && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-950/80 text-red-300">
          <WifiOff size={13} />
          Você está offline. {pending > 0 ? `${acoes(pending)} pendente${pending > 1 ? 's' : ''} ao reconectar.` : 'As ações de campo serão salvas localmente.'}
        </div>
      )}
      {online && pending > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-950/80 text-amber-300">
          <RefreshCw size={13} className="animate-spin" />
          Sincronizando {acoes(pending)} pendente{pending > 1 ? 's' : ''}...
        </div>
      )}
      {failed > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900/80 text-red-200">
          <AlertTriangle size={13} />
          {acoes(failed)} não pôde ser sincronizada (rejeitada pelo servidor).
          <button onClick={() => { clearFailed() }} className="underline hover:text-white ml-1">Dispensar</button>
        </div>
      )}
    </div>
  )
}

type NavItem = { to: string; label: string; icon: LucideIcon }
type NavGroup = { label: string | null; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/trips',    label: 'Viagens',    icon: Route  },
      { to: '/vehicles', label: 'Veículos',   icon: Truck  },
      { to: '/drivers',  label: 'Motoristas', icon: User   },
      { to: '/km-logs',  label: 'KM Logs',    icon: Gauge  },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/users',               label: 'Usuários',    icon: Users        },
      { to: '/reports',             label: 'Relatórios',  icon: BarChart2    },
      { to: '/fuel',                label: 'Combustível', icon: Fuel         },
      { to: '/maintenance',         label: 'Manutenções', icon: Wrench       },
      { to: '/checklist-templates', label: 'Checklists',  icon: ClipboardList },
      { to: '/audit-logs',          label: 'Auditoria',   icon: ScrollText   },
    ],
  },
]

function AlertsBadge() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get<any>('/reports/dashboard?period=30'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const cnhAlerts = (data?.alerts?.cnhExpirando ?? []) as any[]
  const maintAlerts = (data?.alerts?.manutencaoPendente ?? []) as any[]
  const total = cnhAlerts.length + maintAlerts.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        title="Alertas"
      >
        <Bell size={16} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">Alertas</span>
            {total === 0 && <span className="text-xs text-slate-500">Nenhum alerta</span>}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {cnhAlerts.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/50">
                  CNH
                </div>
                {cnhAlerts.map((a: any) => (
                  <button
                    key={a.name}
                    onClick={() => { navigate('/drivers'); setOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800 transition-colors text-left"
                  >
                    <span className="text-slate-300 text-sm">{a.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.expired ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}>
                      {a.expired ? 'Vencida' : `${a.daysLeft}d`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {maintAlerts.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/50">
                  Manutenção
                </div>
                {maintAlerts.map((v: any) => (
                  <button
                    key={v.plate}
                    onClick={() => { navigate(`/vehicles/${v.vehicleId}/maintenance`); setOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800 transition-colors text-left"
                  >
                    <span className="text-slate-300 text-sm">{v.plate} — {v.model}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(v.kmRestantes ?? 1) <= 0 ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}>
                      {(v.kmRestantes ?? 0) <= 0 ? 'Vencida' : `${v.kmRestantes?.toLocaleString('pt-BR')} km`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {total === 0 && (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                Tudo em dia ✓
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const user = getUser()
  const isAdmin = user?.role === 'admin'

  function logout() { clearTokens(); navigate('/login') }
  function closeOnMobile() { setSidebarOpen(false) }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.role?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 md:w-52
        bg-slate-900 border-r border-slate-800 flex flex-col p-3
        transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-2 mb-1">
          <span className="font-bold text-blue-400 text-lg">TMS</span>
          <div className="flex items-center gap-1">
            {isAdmin && <AlertsBadge />}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <nav className="flex flex-col flex-1 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-widest select-none">
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeOnMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-blue-950 text-blue-300' : 'text-slate-400 hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon size={15} className="shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 pt-3 space-y-0.5">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              {user?.name && (
                <div className="text-slate-200 text-xs font-medium truncate">{user.name}</div>
              )}
              <div className="text-slate-500 text-xs">{user?.role}</div>
            </div>
          </div>
          <NavLink
            to="/profile"
            onClick={closeOnMobile}
            className={({ isActive }) =>
              `block px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive ? 'bg-blue-950 text-blue-300' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            Meu Perfil
          </NavLink>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <OfflineBanner />
        {/* Topbar mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-20 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <Menu size={18} />
          </button>
          <span className="font-bold text-blue-400 text-sm">TMS</span>
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
