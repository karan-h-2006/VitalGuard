import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type UserPayload = {
  userId: string;
  role: 'patient' | 'caregiver' | 'doctor' | 'administrator';
};

function decodeToken(token: string): UserPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return {
      userId: decoded.userId,
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

  const [user, setUser] = useState<UserPayload | null>(null);

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
    setToken(newToken);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
