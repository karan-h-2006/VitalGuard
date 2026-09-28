import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type UserPayload = {
  userId: string;
  role: 'patient' | 'caregiver' | 'doctor' | 'administrator';
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

  const login = (newToken: string) => {
    const decoded = decodeToken(newToken);
    setToken(decoded ? newToken : null);
    setUser(decoded);
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
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
