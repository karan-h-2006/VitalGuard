import { Navigate, Route, Routes } from 'react-router-dom';
import { AdministratorPage } from './features/administrator/administrator-page.js';
import { CaregiverPage } from './features/caregiver/caregiver-page.js';
import { DoctorPage } from './features/doctor/doctor-page.js';
import { PatientPage } from './features/patient/patient-page.js';
import { LoginPage } from './features/auth/login-page.js';
import { RegisterPage } from './features/auth/register-page.js';
import { ProtectedRoute } from './shared/auth/protected-route.js';
import { AppLayout } from './shared/layout/app-layout.js';
import { useAuth } from './shared/auth/auth-context.js';

function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate replace to={`/${user!.role}`} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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
            path="/administrator"
            element={
              <ProtectedRoute allowedRoles={['administrator']}>
                <AdministratorPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<DashboardRedirect />} />
          <Route path="*" element={<DashboardRedirect />} />
        </Route>
      </Route>
    </Routes>
  );
}
