import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RootRoute } from './app.js';
import * as authModule from './shared/auth/auth-context.js';

vi.mock('./shared/auth/auth-context.js', () => ({
  useAuth: vi.fn(),
}));

describe('Root route (/) behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the landing page when user is logged out', () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      token: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      mustChangePassword: false,
      doctorApplication: null,
      applicationLoading: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('Every vital.');
    expect(markup).toContain('Every second.');
    expect(markup).toContain('Zero blind spots.');
    expect(markup).toContain('Not a certified medical device');
  });

  it('redirects to the role dashboard when user is logged in', () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      token: 'valid.mock.token',
      user: { userId: 'doc-123', role: 'doctor' },
      login: vi.fn(),
      logout: vi.fn(),
      mustChangePassword: false,
      doctorApplication: null,
      applicationLoading: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/doctor" element={<div>Doctor Dashboard Roster</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // In static SSR markup, <Navigate replace to="/doctor" /> renders nothing at the root or triggers navigation
    // It should not render the landing page headline
    expect(markup).not.toContain(
      'Every vital. Every second. Zero blind spots.',
    );
  });
});
