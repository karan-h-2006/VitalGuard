import { Navigate, Outlet } from 'react-router-dom';
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
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their default dashboard if they try to access an unauthorized route
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children ?? <Outlet />;
}
