import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { User, UserRole } from '../types';
import { vi } from 'vitest';

// Mock user data for testing
export const mockUsers = {
  admin: {
    id: 'admin-1',
    _id: 'admin-1',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'ADMIN' as UserRole,
    phone: '+91 98610 00001',
    licenseNumber: 'DL-ADMIN-001',
    isActive: true,
    createdAt: new Date().toISOString(),
  } as User,
  fleetManager: {
    id: 'fm-1',
    _id: 'fm-1',
    name: 'Test Fleet Manager',
    email: 'fm@test.com',
    role: 'FLEET_MANAGER' as UserRole,
    phone: '+91 98610 00002',
    licenseNumber: 'DL-FM-001',
    isActive: true,
    createdAt: new Date().toISOString(),
  } as User,
  driver: {
    id: 'driver-1',
    _id: 'driver-1',
    name: 'Test Driver',
    email: 'driver@test.com',
    role: 'DRIVER' as UserRole,
    phone: '+91 98610 00003',
    licenseNumber: 'DL-DRIVER-001',
    isActive: true,
    createdAt: new Date().toISOString(),
  } as User,
};

// Mock token
export const mockToken = 'mock-jwt-token-12345';

// Custom render wrapper with all providers (no BrowserRouter - App provides it)
interface WrapperProps {
  children: React.ReactNode;
  user?: User | null;
  initialToken?: string | null;
}

const TestWrapper: React.FC<WrapperProps> = ({
  children,
  user = mockUsers.fleetManager,
  initialToken = mockToken,
}) => {
  // Pre-populate localStorage for AuthProvider
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  if (initialToken) {
    localStorage.setItem('token', initialToken);
    localStorage.setItem('refreshToken', 'mock-refresh-token');
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
};

// Custom render function with providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: RenderOptions & { user?: User | null; initialToken?: string | null }
) => {
  const { user, initialToken, ...renderOptions } = options || {};
  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper user={user} initialToken={initialToken}>
        {children}
      </TestWrapper>
    ),
    ...renderOptions,
  });
};

// Mock API client for tests
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

// Re-export everything from testing-library for convenience
export * from '@testing-library/react';
export { renderWithProviders as render };