import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './lib/auth.js'
import LoginPage from './pages/auth/LoginPage.js'
import DashboardPage from './pages/dashboard/DashboardPage.js'
import TripsPage from './pages/trips/TripsPage.js'
import TripDetailPage from './pages/trips/TripDetailPage.js'
import NewTripPage from './pages/trips/NewTripPage.js'
import ActiveTripPage from './pages/trips/ActiveTripPage.js'
import ChecklistPage from './pages/checklists/ChecklistPage.js'
import VehiclesPage from './pages/vehicles/VehiclesPage.js'
import DriversPage from './pages/drivers/DriversPage.js'
import Layout from './components/Layout.js'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
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
      </Route>
    </Routes>
  )
}
