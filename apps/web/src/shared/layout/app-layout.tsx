import type { PropsWithChildren } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context.js';

export function AppLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a className="font-semibold text-xl tracking-tight text-indigo-600" href="/">
            VitalGuard
          </a>
          <nav aria-label="Dashboard role">
            <ul className="flex items-center gap-6 text-sm">
              {user && (
                <li>
                  <span className="text-slate-500 font-medium capitalize">
                    {user.role} Dashboard
                  </span>
                </li>
              )}
              {user && (
                <li>
                  <button 
                    onClick={handleLogout}
                    className="text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Sign out
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        {children || <Outlet />}
      </main>
    </div>
  );
}
