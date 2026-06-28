import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AppartementsPage from '@/pages/AppartementsPage'
import MembersPage from '@/pages/MembersPage'
import FinancialPage from '@/pages/FinancialPage'
import MeetingsPage from '@/pages/MeetingsPage'
import AdminPage from '@/pages/AdminPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="appartementen" element={<AppartementsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="financial" element={<FinancialPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
