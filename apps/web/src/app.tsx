import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdministratorPage } from './features/administrator/administrator-page.js';
import { CaregiverPage } from './features/caregiver/caregiver-page.js';
import { DoctorPage } from './features/doctor/doctor-page.js';
import { PatientPage } from './features/patient/patient-page.js';
import { LoginPage } from './features/auth/login-page.js';
import { RegisterPage } from './features/auth/register-page.js';
import { ChangePasswordPage } from './features/auth/change-password-page.js';
import { DoctorPendingPage } from './features/doctor/doctor-pending-page.js';
import { PatientAccessPage } from './features/patient/patient-access-page.js';
import { LandingPage } from './features/landing/landing-page.js';
import { ProtectedRoute } from './shared/auth/protected-route.js';
import { AppLayout } from './shared/layout/app-layout.js';
import { Footer } from './shared/layout/footer.js';
import { useAuth } from './shared/auth/auth-context.js';
import { DesignPage } from './features/design/design-page.js';
import { ErrorBoundary, Skeleton } from './components/ui/index.js';

export function PageSuspenseFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate replace to="/" />;
  }
  return <Navigate replace to={`/${user.role}`} />;
}

export function RootRoute() {
  const { user, token } = useAuth();
  if (token && user) {
    return <Navigate replace to={`/${user.role}`} />;
  }
  return <LandingPage />;
}

export function App() {
  const { user, token } = useAuth();
  const location = useLocation();
  const isLanding = location.pathname === '/' && (!token || !user);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <main className="flex flex-1 flex-col">
        <ErrorBoundary level="app">
          <Suspense fallback={<PageSuspenseFallback />}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              {import.meta.env.DEV && (
                <Route path="/design" element={<DesignPage />} />
              )}

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route
                    path="/patient"
                    element={
                      <ProtectedRoute allowedRoles={['patient']}>
                        <PatientPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/caregiver"
                    element={
                      <ProtectedRoute allowedRoles={['caregiver']}>
                        <CaregiverPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/doctor"
                    element={
                      <ProtectedRoute allowedRoles={['doctor']}>
                        <DoctorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/doctor/pending"
                    element={
                      <ProtectedRoute allowedRoles={['doctor']}>
                        <DoctorPendingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/change-password"
                    element={<ChangePasswordPage />}
                  />
                  <Route
                    path="/patient/access"
                    element={
                      <ProtectedRoute allowedRoles={['patient']}>
                        <PatientAccessPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/administrator"
                    element={
                      <ProtectedRoute allowedRoles={['administrator']}>
                        <ErrorBoundary
                          level="admin"
                          overviewPath="/administrator"
                        >
                          <AdministratorPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<DashboardRedirect />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isLanding && <Footer />}
    </div>
  );
}
