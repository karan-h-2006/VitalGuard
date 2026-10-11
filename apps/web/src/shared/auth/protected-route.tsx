import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth-context.js';

type ProtectedRouteProps = {
  allowedRoles?: ('patient' | 'caregiver' | 'doctor' | 'administrator')[];
  children?: ReactNode;
};

export function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const {
    token,
    user,
    mustChangePassword,
    doctorApplication,
    applicationLoading,
  } = useAuth();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  if (!mustChangePassword && location.pathname === '/change-password')
    return <Navigate to={`/${user.role}`} replace />;

  if (user.role === 'doctor') {
    if (applicationLoading)
      return (
        <div className="p-8 text-slate-600">Checking doctor application…</div>
      );
    if (location.pathname === '/doctor/pending') {
      if (doctorApplication?.status === 'approved')
        return <Navigate to="/doctor" replace />;
    } else if (!doctorApplication || doctorApplication.status !== 'approved') {
      return <Navigate to="/doctor/pending" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their default dashboard if they try to access an unauthorized route
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children ?? <Outlet />;
}
