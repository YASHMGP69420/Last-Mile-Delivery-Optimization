import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '../api/client';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  phone?: string;
  licenseNumber?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterPayload) => Promise<User>;
  googleLogin: (credentialOrPayload: any, role?: string) => Promise<User>;
  logout: () => Promise<void>;
  quickLogin: (role: 'admin' | 'manager' | 'driver' | 'yashaswee') => Promise<User>;
  isAdmin: boolean;
  isFleetManager: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const persistAuthSession = (
    receivedToken: string,
    receivedRefreshToken: string | undefined,
    receivedUser: User
  ) => {
    localStorage.setItem('token', receivedToken);
    if (receivedRefreshToken) {
      localStorage.setItem('refreshToken', receivedRefreshToken);
    }
    localStorage.setItem('user', JSON.stringify(receivedUser));
    setToken(receivedToken);
    setUser(receivedUser);
  };

  useEffect(() => {
    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<{ token?: string }>;
      const updatedToken = customEvent.detail?.token || localStorage.getItem('token');
      if (updatedToken) {
        setToken(updatedToken);
      }
    };

    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('smartroute:token-refreshed', handleTokenRefreshed);
    window.addEventListener('smartroute:session-expired', handleSessionExpired);

    const verifySession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (storedToken || storedRefreshToken) {
        try {
          const res = await apiClient.get('/auth/me');
          if (res.data && res.data.data?.user) {
            setUser(res.data.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.data.user));
            const latestToken = localStorage.getItem('token');
            if (latestToken) setToken(latestToken);
          }
        } catch (err) {
          console.warn('Session verification failed:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    verifySession();

    return () => {
      window.removeEventListener('smartroute:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('smartroute:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } = res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/register', payload);
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } = res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (credentialOrPayload: any, role?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const body =
        typeof credentialOrPayload === 'string'
          ? { credential: credentialOrPayload, role }
          : { ...credentialOrPayload, role };

      const res = await apiClient.post('/auth/google', body);
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } = res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: 'admin' | 'manager' | 'driver' | 'yashaswee'): Promise<User> => {
    // Validate role to prevent accidental misuse
    const allowedRoles: Array<'admin' | 'manager' | 'driver' | 'yashaswee'> = ['admin', 'manager', 'driver', 'yashaswee'];
    if (!allowedRoles.includes(role)) {
      throw new Error(`Invalid role for quickLogin: ${role}`);
    }

    const credentials: Record<string, { email: string; password: string }> = {
      admin: { email: 'admin@example.com', password: 'admin123' },
      manager: { email: 'manager@example.com', password: 'manager123' },
      driver: { email: 'driver@example.com', password: 'driver123' },
      yashaswee: { email: 'mishrayashaswee6@gmail.com', password: 'driver123' },
    };
    const cred = credentials[role];
    if (!cred) {
      throw new Error(`No credentials configured for quickLogin role: ${role}`);
    }
    return login(cred.email, cred.password);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isFleetManager = user?.role === 'FLEET_MANAGER';
  const isDriver = user?.role === 'DRIVER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        googleLogin,
        logout,
        quickLogin,
        isAdmin,
        isFleetManager,
        isDriver,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
