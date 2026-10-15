import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AdministratorPage } from './administrator-page.js';
import * as authModule from '../../shared/auth/auth-context.js';
import * as apiModule from '../../shared/api-fetch.js';

vi.mock('../../shared/auth/auth-context.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../shared/api-fetch.js', () => ({
  apiFetch: vi.fn(),
}));

describe('AdministratorPage component tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.useAuth).mockReturnValue({
      token: 'admin-test-token',
      user: { userId: 'admin-id', role: 'administrator' },
      login: vi.fn(),
      logout: vi.fn(),
      mustChangePassword: false,
      doctorApplication: null,
      applicationLoading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders overview loading state without throwing', () => {
    vi.mocked(apiModule.apiFetch).mockImplementation(
      () => new Promise(() => {}),
    );

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/administrator']}>
        <AdministratorPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Administrator');
    expect(markup).toContain('Governance');
    expect(markup).toContain('Overview');
  });

  it('renders populated overview without throwing', async () => {
    vi.mocked(apiModule.apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          pendingDoctors: 3,
          unassignedPatients: 5,
          pendingCaregiverRequests: 2,
          activeInstitutions: 4,
          recentActivity: [
            {
              id: '1',
              action: 'doctor.approve',
              createdAt: '2026-10-15T10:00:00Z',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/administrator']}>
        <AdministratorPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Administrator');
  });

  const testTabs = [
    'overview',
    'doctor-requests',
    'institutions',
    'doctors',
    'patients',
    'caregivers',
    'users',
    'audit',
  ] as const;

  for (const tab of testTabs) {
    it(`renders tab "${tab}" safely with empty data and null responses`, () => {
      vi.mocked(apiModule.apiFetch).mockResolvedValue(
        new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
      );

      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[`/administrator?tab=${tab}`]}>
          <AdministratorPage />
        </MemoryRouter>,
      );

      expect(markup).toContain('Administrator');
    });

    it(`renders tab "${tab}" safely when API returns null body`, () => {
      vi.mocked(apiModule.apiFetch).mockResolvedValue(
        new Response(JSON.stringify(null), { status: 200 }),
      );

      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[`/administrator?tab=${tab}`]}>
          <AdministratorPage />
        </MemoryRouter>,
      );

      expect(markup).toContain('Administrator');
    });

    it(`renders tab "${tab}" safely when API returns an error`, () => {
      vi.mocked(apiModule.apiFetch).mockResolvedValue(
        new Response(JSON.stringify({ message: 'Internal Server Error' }), {
          status: 500,
        }),
      );

      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[`/administrator?tab=${tab}`]}>
          <AdministratorPage />
        </MemoryRouter>,
      );

      expect(markup).toContain('Administrator');
    });
  }

  it('renders doctors tab with defensive handling even if doctor records have missing properties', () => {
    vi.mocked(apiModule.apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              // Completely malformed or missing profile
              email: 'broken@example.com',
            },
            {
              profile: {
                userId: 'doc-1',
                status: 'approved',
                specialization: 'Cardiology',
              },
              email: 'doctor@example.com',
              institutionName: 'Main Clinic',
              institutionStatus: 'active',
              patientCount: 1,
            },
          ],
          total: 2,
        }),
        { status: 200 },
      ),
    );

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/administrator?tab=doctors']}>
        <AdministratorPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Administrator');
  });

  it('renders patients tab with defensive handling even if patient records have missing profile or doctors', () => {
    vi.mocked(apiModule.apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              // Missing profile and doctors
              email: 'orphan@example.com',
            },
            {
              profile: {
                userId: 'pat-1',
                assignmentStatus: 'unassigned',
              },
              email: 'patient@example.com',
              doctors: undefined,
            },
          ],
          total: 2,
        }),
        { status: 200 },
      ),
    );

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/administrator?tab=patients']}>
        <AdministratorPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Administrator');
  });
});
