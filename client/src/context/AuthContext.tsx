import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '../api/client';

export type OtpChannel = 'EMAIL' | 'PHONE';
export type OtpPurpose = 'REGISTER' | 'LOGIN';

export interface SendOtpPayload {
  identifier: string;
  channel?: OtpChannel;
  purpose: OtpPurpose;
}

export interface SendOtpResult {
  target: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  expiresInSeconds: number;
  deliveryMode: string;
  devPreviewCode?: string;
}

export interface VerifyOtpPayload {
  identifier: string;
  channel?: OtpChannel;
  purpose: OtpPurpose;
  code: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  target: string;
  channel: OtpChannel;
  verificationToken: string;
}

export interface OtpLoginPayload {
  identifier: string;
  channel?: OtpChannel;
  code: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  otpTarget: string;
  otpChannel: OtpChannel;
  verificationToken?: string;
  otp?: string;
  password?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  sendOtp: (payload: SendOtpPayload) => Promise<SendOtpResult>;
  verifyOtp: (payload: VerifyOtpPayload) => Promise<VerifyOtpResult>;
  loginWithOtp: (payload: OtpLoginPayload) => Promise<User>;
  register: (data: RegisterPayload) => Promise<User>;
  googleLogin: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
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

  const login = async (identifier: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email: identifier, password });
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } =
        res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (payload: SendOtpPayload): Promise<SendOtpResult> => {
    const res = await apiClient.post('/auth/otp/send', payload);
    return res.data.data;
  };

  const verifyOtp = async (payload: VerifyOtpPayload): Promise<VerifyOtpResult> => {
    const res = await apiClient.post('/auth/otp/verify', payload);
    return res.data.data;
  };

  const loginWithOtp = async (payload: OtpLoginPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/otp/login', payload);
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } =
        res.data.data;
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
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } =
        res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (credential: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/google', { credential });
      const { token: receivedToken, refreshToken: receivedRefreshToken, user: receivedUser } =
        res.data.data;
      persistAuthSession(receivedToken, receivedRefreshToken, receivedUser);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
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
        sendOtp,
        verifyOtp,
        loginWithOtp,
        register,
        googleLogin,
        logout,
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
