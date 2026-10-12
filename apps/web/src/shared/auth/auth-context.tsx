import { createContext, useContext, useState, useEffect } from 'react';
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

function decodeToken(token: string): UserPayload | null {
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

  useEffect(() => {
    if (token) {
      localStorage.setItem('vitalguard_token', token);
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        setToken(null);
        localStorage.removeItem('vitalguard_token');
      }
    } else {
      localStorage.removeItem('vitalguard_token');
      setUser(null);
    }
  }, [token]);

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

  const logout = () => {
    setToken(null);
    setDoctorApplication(null);
    setMustChangePassword(false);
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
