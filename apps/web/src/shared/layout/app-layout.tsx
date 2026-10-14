import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Activity, Bell, LogOut, CheckCheck } from 'lucide-react';
import { useAuth } from '../auth/auth-context.js';
import { Badge, Button } from '../../components/ui/index.js';

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
    if (token) {
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-1 flex-col bg-canvas text-slate-900 dark:bg-canvas-dark dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
                <Activity className="h-4 w-4" />
              </div>
              <span className="font-sans font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                VitalGuard
              </span>
            </Link>

            {user && (
              <Badge
                variant="bracketed"
                size="sm"
                className="hidden sm:inline-flex ml-2"
              >
                {user.role} workstation
              </Badge>
            )}
          </div>

          {/* User actions */}
          <nav aria-label="Dashboard navigation">
            <ul className="flex items-center gap-3 sm:gap-4">
              {/* Notification Bell */}
              {user && !mustChangePassword && (
                <li className="relative">
                  <button
                    aria-label={`Notifications, ${notices.length} unread`}
                    onClick={() => setOpen(!open)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Bell className="h-4 w-4" />
                    {notices.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[10px] font-bold text-white shadow-sm">
                        {notices.length}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Panel */}
                  {open && (
                    <div className="absolute right-0 top-12 z-40 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in-up">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <strong className="font-sans text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Notifications
                          </strong>
                          {notices.length > 0 && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              {notices.length} new
                            </span>
                          )}
                        </div>
                        {notices.length > 0 && (
                          <button
                            className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:text-brand-700 dark:text-brand-400"
                            onClick={() => {
                              void fetch('/api/notifications/read-all', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                              }).then(() => setNotices([]));
                            }}
                          >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      {notices.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            You're all caught up.
                          </p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            No unread notifications at this time.
                          </p>
                        </div>
                      ) : (
                        <ul className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800/80">
                          {notices.map((notice) => (
                            <li key={notice.id} className="py-2.5">
                              <button
                                className="w-full text-left rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
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
                                <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {notice.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {notice.body}
                                </span>
                                <span className="mt-1 block font-mono text-[10px] text-slate-400">
                                  {new Date(
                                    notice.createdAt,
                                  ).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
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

              {/* Sign Out Button */}
              {user && (
                <li>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    icon={<LogOut className="h-3.5 w-3.5" />}
                  >
                    Sign out
                  </Button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {children || <Outlet />}
      </div>
    </div>
  );
}
