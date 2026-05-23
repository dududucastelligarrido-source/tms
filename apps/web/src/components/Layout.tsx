import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearTokens, getUser } from '../lib/auth.js'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trips', label: 'Viagens' },
  { to: '/vehicles', label: 'Veículos' },
  { to: '/drivers', label: 'Motoristas' },
  { to: '/users', label: 'Usuários' },
]

export default function Layout() {
  const navigate = useNavigate()
  const user = getUser()

  function logout() { clearTokens(); navigate('/login') }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col p-3">
        <div className="font-bold text-blue-400 text-lg p-2 mb-4">TMS</div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <NavLink
              key={item.to} to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-950 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 pt-3">
          <div className="text-xs text-slate-500 px-2 mb-1">{user?.role}</div>
          <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg">
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
