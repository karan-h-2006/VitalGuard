import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';

export type UserPayload = {
  userId: string;
  role: 'patient' | 'caregiver' | 'doctor' | 'administrator';
};
export type DoctorApplication = {
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejectionReason: string | null;
  reapplicationCount: number;
  mayReapply: boolean;
};

// eslint-disable-next-line react-refresh/only-export-components
export function decodeToken(token: string): UserPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    );
    if (
      typeof decoded.sub !== 'string' ||
      !['patient', 'caregiver', 'doctor', 'administrator'].includes(
        decoded.role,
      ) ||
      (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now())
    )
      return null;
    return {
      userId: decoded.sub,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

interface AuthContextType {
  token: string | null;
  user: UserPayload | null;
  login: (token: string) => void;
  logout: () => void;
  mustChangePassword: boolean;
  doctorApplication: DoctorApplication | null;
  applicationLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('vitalguard_token');
  });

  const [user, setUser] = useState<UserPayload | null>(() => {
    const storedToken = localStorage.getItem('vitalguard_token');
    return storedToken ? decodeToken(storedToken) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [doctorApplication, setDoctorApplication] =
    useState<DoctorApplication | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setDoctorApplication(null);
    setMustChangePassword(false);
    localStorage.removeItem('vitalguard_token');
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('vitalguard_token', token);
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        // Expired token in storage
        logout();
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          const returnUrl = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?expired=true&returnUrl=${returnUrl}`;
        }
      }
    } else {
      localStorage.removeItem('vitalguard_token');
      setUser(null);
    }
  }, [token, logout]);

  // Listen to centralized session events from apiFetch
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      logout();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login')
      ) {
        const detail = (
          event as CustomEvent<{ pathname?: string; message?: string }>
        ).detail;
        const returnUrl = encodeURIComponent(
          detail?.pathname || window.location.pathname,
        );
        window.location.href = `/login?expired=true&returnUrl=${returnUrl}`;
      }
    };

    const handlePasswordChangeRequired = () => {
      setMustChangePassword(true);
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/change-password'
      ) {
        window.location.href = '/change-password';
      }
    };

    window.addEventListener('vitalguard:session-expired', handleSessionExpired);
    window.addEventListener(
      'vitalguard:password-change-required',
      handlePasswordChangeRequired,
    );
    return () => {
      window.removeEventListener(
        'vitalguard:session-expired',
        handleSessionExpired,
      );
      window.removeEventListener(
        'vitalguard:password-change-required',
        handlePasswordChangeRequired,
      );
    };
  }, [logout]);

  useEffect(() => {
    if (!token || !user) {
      setMustChangePassword(false);
      setDoctorApplication(null);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    void fetch('/api/auth/me', { headers })
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => setMustChangePassword(Boolean(me?.mustChangePassword)))
      .catch(() => undefined);
    if (user.role !== 'doctor') {
      setDoctorApplication(null);
      return;
    }
    setApplicationLoading(true);
    void fetch('/api/doctors/me/application', { headers })
      .then((response) => (response.ok ? response.json() : null))
      .then((profile) => setDoctorApplication(profile))
      .catch(() => setDoctorApplication(null))
      .finally(() => setApplicationLoading(false));
  }, [token, user]);

  const login = (newToken: string) => {
    const decoded = decodeToken(newToken);
    setToken(decoded ? newToken : null);
    setUser(decoded);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        mustChangePassword,
        doctorApplication,
        applicationLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
