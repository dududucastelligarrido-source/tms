import { Routes, Route, Navigate } from 'react-router-dom'
import { hasCredentials, isAccessTokenExpired, clearTokens, getRefreshToken } from './lib/auth.js'
import LoginPage from './pages/auth/LoginPage.js'
import DashboardPage from './pages/dashboard/DashboardPage.js'
import TripsPage from './pages/trips/TripsPage.js'
import TripDetailPage from './pages/trips/TripDetailPage.js'
import NewTripPage from './pages/trips/NewTripPage.js'
import ActiveTripPage from './pages/trips/ActiveTripPage.js'
import ChecklistPage from './pages/checklists/ChecklistPage.js'
import ChecklistTemplatesPage from './pages/checklists/ChecklistTemplatesPage.js'
import VehiclesPage from './pages/vehicles/VehiclesPage.js'
import DriversPage from './pages/drivers/DriversPage.js'
import UsersPage from './pages/users/UsersPage.js'
import ProfilePage from './pages/profile/ProfilePage.js'
import ReportsPage from './pages/reports/ReportsPage.js'
import FuelPage from './pages/fuel/FuelPage.js'
import MaintenancePage from './pages/maintenance/MaintenancePage.js'
import MaintenanceOverviewPage from './pages/maintenance/MaintenanceOverviewPage.js'
import KmLogsPage from './pages/trips/KmLogsPage.js'
import AuditLogPage from './pages/audit/AuditLogPage.js'
import Layout from './components/Layout.js'

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
  )
}
