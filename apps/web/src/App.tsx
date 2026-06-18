import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { hasCredentials, isAccessTokenExpired, clearTokens, getRefreshToken } from './lib/auth.js'
import LoginPage from './pages/auth/LoginPage.js'
import Layout from './components/Layout.js'

// Páginas carregadas sob demanda (code-splitting por rota): cada uma vira um
// chunk separado, mantendo o bundle inicial enxuto. Libs pesadas que só vivem
// em páginas específicas (recharts no dashboard/relatórios) saem do bundle base.
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.js'))
const TripsPage = lazy(() => import('./pages/trips/TripsPage.js'))
const TripDetailPage = lazy(() => import('./pages/trips/TripDetailPage.js'))
const NewTripPage = lazy(() => import('./pages/trips/NewTripPage.js'))
const ActiveTripPage = lazy(() => import('./pages/trips/ActiveTripPage.js'))
const ChecklistPage = lazy(() => import('./pages/checklists/ChecklistPage.js'))
const ChecklistTemplatesPage = lazy(() => import('./pages/checklists/ChecklistTemplatesPage.js'))
const VehiclesPage = lazy(() => import('./pages/vehicles/VehiclesPage.js'))
const DriversPage = lazy(() => import('./pages/drivers/DriversPage.js'))
const UsersPage = lazy(() => import('./pages/users/UsersPage.js'))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage.js'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage.js'))
const FuelPage = lazy(() => import('./pages/fuel/FuelPage.js'))
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage.js'))
const MaintenanceOverviewPage = lazy(() => import('./pages/maintenance/MaintenanceOverviewPage.js'))
const KmLogsPage = lazy(() => import('./pages/trips/KmLogsPage.js'))
const AuditLogPage = lazy(() => import('./pages/audit/AuditLogPage.js'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  // Sem nenhuma credencial armazenada → login
  if (!hasCredentials()) return <Navigate to="/login" replace />
  // Access token expirado e sem refresh token → sessão encerrada
  if (isAccessTokenExpired() && !getRefreshToken()) {
    clearTokens()
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-400 text-sm">Carregando…</div>}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/new" element={<NewTripPage />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="trips/:id/active" element={<ActiveTripPage />} />
        <Route path="trips/:tripId/checklists/:checklistId" element={<ChecklistPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="fuel" element={<FuelPage />} />
        <Route path="maintenance" element={<MaintenanceOverviewPage />} />
        <Route path="checklist-templates" element={<ChecklistTemplatesPage />} />
        <Route path="km-logs" element={<KmLogsPage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
        <Route path="vehicles/:vehicleId/maintenance" element={<MaintenancePage />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
