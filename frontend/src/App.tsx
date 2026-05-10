import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppProvider, useAppContext } from './context/AppContext'
import { AuthGuard } from './components/auth/AuthGuard'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { MainNavigation } from './components/layout/MainNavigation'
import { FloatingActionMenu } from './components/ui/FloatingActionMenu'
import { CommandPalette, useCommandPalette } from './components/ui/CommandPalette'
import { SkipLink } from './components/ui/SkipLink'
import { Breadcrumbs } from './components/ui/Breadcrumbs'
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'

// ─── Lazy pages ───────────────────────────────────────────────────────────────
const ForgotPassword     = lazy(() => import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword      = lazy(() => import('./pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const Onboarding         = lazy(() => import('./pages/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })))
const Dashboard          = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const ContentHub         = lazy(() => import('./pages/content/ContentHub').then((m) => ({ default: m.ContentHub })))
const Calendar           = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })))
const Analytics          = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))
const WorkflowDashboard  = lazy(() => import('./pages/workflow/WorkflowDashboard').then((m) => ({ default: m.WorkflowDashboard })))
const AutopilotDashboard = lazy(() => import('./pages/autopilot/AutopilotDashboard').then((m) => ({ default: m.AutopilotDashboard })))
const Settings           = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Team               = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })))
const AffiliatePage      = lazy(() => import('./pages/affiliate/AffiliatePage').then((m) => ({ default: m.AffiliatePage })))
const AddCredits         = lazy(() => import('./pages/credits/AddCredits').then((m) => ({ default: m.AddCredits })))
const TransactionHistory = lazy(() => import('./pages/credits/TransactionHistory').then((m) => ({ default: m.TransactionHistory })))
const UsageHistory       = lazy(() => import('./pages/credits/UsageHistory').then((m) => ({ default: m.UsageHistory })))
const Notifications      = lazy(() => import('./pages/notifications/Notifications').then((m) => ({ default: m.Notifications })))
const UserProfile        = lazy(() => import('./pages/profile/UserProfile').then((m) => ({ default: m.UserProfile })))
const SocialAccounts     = lazy(() => import('./pages/SocialAccounts').then((m) => ({ default: m.SocialAccounts })))
const MediaGallery       = lazy(() => import('./pages/MediaGallery').then((m) => ({ default: m.MediaGallery })))

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#3FE0A5]" />
  </div>
)

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  )
}

function AppShell() {
  const { isDarkMode } = useAppContext()
  const commandPalette = useCommandPalette()

  return (
    <BrowserRouter>
      <div className="relative min-h-screen w-full bg-gray-50 dark:bg-[#0A0E14] transition-colors duration-300">
        <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />

        <Routes>
          {/* Public */}
          <Route path="/auth/login"           element={<Login />} />
          <Route path="/auth/register"        element={<Register />} />
          <Route path="/auth/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
          <Route path="/auth/reset-password"  element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />

          {/* Protected */}
          <Route
            path="/*"
            element={
              <AuthGuard>
                <ErrorBoundary>
                  <SkipLink targetId="main-content" />
                  <MainNavigation onOpenCommandPalette={commandPalette.open} />

                  <div className="flex min-h-screen w-full pt-20">
                    <div className="flex-1 flex flex-col min-w-0 w-full">
                      <main
                        id="main-content"
                        className="flex-1 w-full px-4 py-4 md:py-6 max-w-screen-2xl mx-auto mb-16 md:mb-0 page-transition"
                        role="main"
                        aria-label="Main content"
                      >
                        <Breadcrumbs autoGenerate className="hidden md:block" />
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/onboarding"              element={<Onboarding />} />
                            <Route path="/"                        element={<Dashboard />} />
                            <Route path="/profile"                 element={<UserProfile />} />
                            <Route path="/notifications"           element={<Notifications />} />
                            <Route path="/content/*"               element={<ContentHub />} />
                            <Route path="/autopilot/*"             element={<AutopilotDashboard />} />
                            <Route path="/workflow"                element={<WorkflowDashboard />} />
                            <Route path="/analytics/*"             element={<Analytics />} />
                            <Route path="/calendar"                element={<Calendar />} />
                            <Route path="/team"                    element={<Team />} />
                            <Route path="/social-accounts"         element={<SocialAccounts />} />
                            <Route path="/media"                   element={<MediaGallery />} />
                            <Route path="/affiliate"               element={<AffiliatePage />} />
                            <Route path="/credits/add"             element={<AddCredits />} />
                            <Route path="/credits/transactions"    element={<TransactionHistory />} />
                            <Route path="/credits/usage"           element={<UsageHistory />} />
                            <Route path="/settings"                element={<Settings />} />
                            <Route path="*"                        element={<Navigate to="/" replace />} />
                          </Routes>
                        </Suspense>
                      </main>
                    </div>
                  </div>

                  <FloatingActionMenu position="bottom-right" />
                </ErrorBoundary>
              </AuthGuard>
            }
          />
        </Routes>

        <Toaster
          position="top-right"
          theme={isDarkMode ? 'dark' : 'light'}
          toastOptions={{
            style: {
              background: isDarkMode ? '#1A2234' : '#FFFFFF',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              borderRadius: '0.75rem',
              color: isDarkMode ? '#F3F4F6' : '#1F2937',
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}
