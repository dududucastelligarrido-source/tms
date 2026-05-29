import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearTokens, getUser } from '../lib/auth.js'
import {
  LayoutDashboard, Route, Truck, User, Users, BarChart2, Fuel, Wrench, ClipboardList,
  type LucideIcon,
} from 'lucide-react'

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
      { to: '/trips',   label: 'Viagens',    icon: Route  },
      { to: '/vehicles', label: 'Veículos',  icon: Truck  },
      { to: '/drivers', label: 'Motoristas', icon: User   },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/users',   label: 'Usuários',   icon: Users    },
      { to: '/reports', label: 'Relatórios', icon: BarChart2 },
      { to: '/fuel',        label: 'Combustível', icon: Fuel    },
      { to: '/maintenance',         label: 'Manutenções', icon: Wrench        },
      { to: '/checklist-templates', label: 'Checklists',  icon: ClipboardList },
    ],
  },
]

export default function Layout() {
  const navigate = useNavigate()
  const user = getUser()

  function logout() { clearTokens(); navigate('/login') }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.role?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col p-3">
        <div className="font-bold text-blue-400 text-lg p-2 mb-1">TMS</div>

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

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
