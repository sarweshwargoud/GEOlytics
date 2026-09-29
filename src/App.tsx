import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AuditPage from '@/pages/AuditPage'
import SearchConsolePage from '@/pages/SearchConsolePage'
import GeoVisibilityPage from '@/pages/GeoVisibilityPage'
import RecommendationsPage from '@/pages/RecommendationsPage'
import ExperimentsPage from '@/pages/ExperimentsPage'
import MemoryPage from '@/pages/MemoryPage'
import ReportsPage from '@/pages/ReportsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import AutomationSettingsPage from '@/pages/AutomationSettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProjectProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated shell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/seo" element={<SearchConsolePage />} />
            <Route path="/geo" element={<GeoVisibilityPage />} />
            <Route path="/technical" element={<AuditPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/experiments" element={<ExperimentsPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<Navigate to="/settings/automation" replace />} />
            <Route path="/settings/automation" element={<AutomationSettingsPage />} />

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Placeholder catch-all for future routes */}
            <Route
              path="*"
              element={
                <div className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">
                  This section is coming in a future update.
                </div>
              }
            />
          </Route>
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  </AuthProvider>
  )
}
