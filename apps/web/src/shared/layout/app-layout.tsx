import type { PropsWithChildren } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context.js';
import { useEffect, useState } from 'react';

type Notice = { id: string; title: string; body: string; createdAt: string };

export function AppLayout({ children }: PropsWithChildren) {
  const { user, token, logout, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token || mustChangePassword) return;
    const refresh = async () => {
      try {
        const response = await fetch('/api/notifications?unread=true', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) setNotices(await response.json());
      } catch {
        /* next poll will retry */
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [token, mustChangePassword]);

  const handleLogout = () => {
    if (token)
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a
            className="font-semibold text-xl tracking-tight text-indigo-600"
            href="/"
          >
            VitalGuard
          </a>
          <nav aria-label="Dashboard role">
            <ul className="flex items-center gap-6 text-sm">
              {user && !mustChangePassword && (
                <li className="relative">
                  <button
                    aria-label={`Notifications, ${notices.length} unread`}
                    onClick={() => setOpen(!open)}
                    className="relative rounded p-2 text-slate-600 hover:bg-slate-100"
                  >
                    <span aria-hidden="true">🔔</span>
                    {notices.length > 0 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
                        {notices.length}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="absolute right-6 top-16 z-20 w-80 rounded-lg border bg-white p-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm">Notifications</strong>
                        {notices.length > 0 && (
                          <button
                            className="text-xs text-indigo-700"
                            onClick={() => {
                              void fetch('/api/notifications/read-all', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                              }).then(() => setNotices([]));
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      {notices.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">
                          You’re all caught up.
                        </p>
                      ) : (
                        <ul className="mt-2 max-h-80 divide-y overflow-auto">
                          {notices.map((notice) => (
                            <li key={notice.id} className="py-2">
                              <button
                                className="text-left"
                                onClick={() => {
                                  void fetch(
                                    `/api/notifications/${notice.id}/read`,
                                    {
                                      method: 'POST',
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    },
                                  ).then(() =>
                                    setNotices((items) =>
                                      items.filter(
                                        (item) => item.id !== notice.id,
                                      ),
                                    ),
                                  );
                                }}
                              >
                                <span className="block text-sm font-medium">
                                  {notice.title}
                                </span>
                                <span className="block text-xs text-slate-600">
                                  {notice.body}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )}
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
