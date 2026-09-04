import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { label: 'Patient', to: '/patient' },
  { label: 'Caregiver', to: '/caregiver' },
  { label: 'Doctor / Triage', to: '/doctor' },
  { label: 'Administrator', to: '/administrator' },
] as const;

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a className="font-semibold tracking-tight" href="/patient">
            VitalGuard
          </a>
          <nav aria-label="Dashboard role">
            <ul className="flex gap-4 text-sm">
              {navigationItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    className={({ isActive }) =>
                      isActive
                        ? 'font-medium text-blue-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
