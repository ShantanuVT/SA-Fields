import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/context/auth-context"
import { ThemeProvider } from "@/context/theme-context"
import { Toaster } from "sonner"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Auth pages
import LoginPage from "@/pages/auth/login"
import SignupPage from "@/pages/auth/signup"
import ResetPasswordPage from "@/pages/auth/reset-password"

// Dashboard layout
import DashboardLayout from "@/components/layout/dashboard-layout"

// Route protection
import ProtectedRoute from "@/components/layout/protected-route"

// Dashboard pages
import DashboardOverview from "@/pages/dashboard/overview"
import AdminsPage from "@/pages/dashboard/admins"
import EngineersPage from "@/pages/dashboard/engineers"
import CustomersPage from "@/pages/dashboard/customers"
import MachinesPage from "@/pages/dashboard/machines"
import PartsPage from "@/pages/dashboard/parts"
import IssuesPage from "@/pages/dashboard/issues"
import AssignmentsPage from "@/pages/dashboard/assignments"
import ServiceReportsPage from "@/pages/dashboard/service-reports"
import ServiceHistoryPage from "@/pages/dashboard/history"
import MyMachinesPage from "@/pages/dashboard/my-machines"
import NotificationsPage from "@/pages/dashboard/notifications"
import SettingsPage from "@/pages/dashboard/settings"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth routes - public */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignupPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

              {/* Dashboard routes - require authentication */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardOverview />} />
                <Route path="overview" element={<DashboardOverview />} />
                {/* Super Admin only */}
                <Route path="admins" element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminsPage />
                  </ProtectedRoute>
                } />
                {/* Admin + Super Admin */}
                <Route path="engineers" element={
                  <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
                    <EngineersPage />
                  </ProtectedRoute>
                } />
                <Route path="customers" element={
                  <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
                    <CustomersPage />
                  </ProtectedRoute>
                } />
                {/* All roles */}
                <Route path="machines" element={<MachinesPage />} />
                <Route path="parts" element={<PartsPage />} />
                <Route path="issues" element={<IssuesPage />} />
                {/* Engineer only */}
                <Route path="assignments" element={
                  <ProtectedRoute allowedRoles={["engineer"]}>
                    <AssignmentsPage />
                  </ProtectedRoute>
                } />
                {/* All roles */}
                <Route path="reports" element={<ServiceReportsPage />} />
                <Route path="history" element={<ServiceHistoryPage />} />
                {/* Customer only */}
                <Route path="my-machines" element={
                  <ProtectedRoute allowedRoles={["customer"]}>
                    <MyMachinesPage />
                  </ProtectedRoute>
                } />
                {/* All roles */}
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: "border-border",
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
