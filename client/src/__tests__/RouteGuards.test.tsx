import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: any) => children,
}));

// Route guard for Super Admin exclusive views (mirrors App.tsx)
const SuperAdminGuard: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/admin/deliveries" replace />;
  }
  return <Outlet />;
};

// AdminLayout guard (mirrors AdminLayout.tsx)
const AdminLayoutGuard: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
  return (
    <div>
      <div data-testid="admin-layout">AdminLayout</div>
      <Outlet />
    </div>
  );
};

// DriverLayout guard (mirrors DriverLayout.tsx)
const DriverLayoutGuard: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div>
      <div data-testid="driver-layout">DriverLayout</div>
      <Outlet />
    </div>
  );
};

// RootRedirect guard (mirrors App.tsx)
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
  return <Navigate to="/admin/control-center" replace />;
};

// Helper component to display current path
const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

// Mock Test App Router matching App.tsx routes exactly
const TestApp: React.FC = () => {
  return (
    <>
      <LocationDisplay />
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">LoginPage</div>} />

        {/* Admin & Fleet Operations Layout */}
        <Route path="/admin" element={<AdminLayoutGuard />}>
          <Route index element={<Navigate to="/admin/control-center" replace />} />
          <Route path="control-center" element={<div data-testid="control-center-page">ControlCenterPage</div>} />
          <Route path="deliveries" element={<div data-testid="deliveries-page">DeliveriesPage</div>} />
          <Route path="fleets" element={<div data-testid="fleets-page">FleetsPage</div>} />

          {/* Super Admin Exclusive */}
          <Route element={<SuperAdminGuard />}>
            <Route path="audit-logs" element={<div data-testid="audit-logs-page">AuditLogsPage</div>} />
            <Route path="users" element={<div data-testid="users-page">UserManagementPage</div>} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/control-center" replace />} />
        </Route>

        {/* Driver Cockpit Layout */}
        <Route path="/driver" element={<DriverLayoutGuard />}>
          <Route index element={<div data-testid="driver-cockpit-page">DriverCockpitPage</div>} />
          <Route path="home" element={<div data-testid="driver-cockpit-page">DriverCockpitPage</div>} />
          <Route path="deliveries" element={<div data-testid="driver-deliveries-page">DriverDeliveriesPage</div>} />
          <Route path="*" element={<Navigate to="/driver" replace />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  );
};

describe('Client Route Guards: Forced Browsing & Direct URL Immunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Suite 1: Unauthenticated Direct URL Access', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        token: null,
      } as any);
    });

    it('Test 1: Unauthenticated user typing /admin/control-center is redirected to /login', () => {
      render(
        <MemoryRouter initialEntries={['/admin/control-center']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('control-center-page')).not.toBeInTheDocument();
    });

    it('Test 2: Unauthenticated user typing /admin/users is redirected to /login', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    it('Test 3: Unauthenticated user typing /driver/home is redirected to /login', () => {
      render(
        <MemoryRouter initialEntries={['/driver/home']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('driver-cockpit-page')).not.toBeInTheDocument();
    });

    it('Test 4: Unauthenticated user typing an unknown URL /random-backdoor is redirected to /login via RootRedirect', () => {
      render(
        <MemoryRouter initialEntries={['/random-backdoor']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  describe('Suite 2: DRIVER Role Direct URL Forced Browsing', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'drv-1', role: 'DRIVER', name: 'Field Driver' },
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        token: 'driver-jwt',
      } as any);
    });

    it('Test 5: DRIVER typing /admin/control-center is immediately bounced to /driver', () => {
      render(
        <MemoryRouter initialEntries={['/admin/control-center']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/driver');
      expect(screen.getByTestId('driver-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('control-center-page')).not.toBeInTheDocument();
    });

    it('Test 6: DRIVER typing /admin/users is immediately bounced to /driver', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/driver');
      expect(screen.getByTestId('driver-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    it('Test 7: DRIVER typing /admin/fleets is immediately bounced to /driver', () => {
      render(
        <MemoryRouter initialEntries={['/admin/fleets']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/driver');
      expect(screen.getByTestId('driver-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('fleets-page')).not.toBeInTheDocument();
    });

    it('Test 8: DRIVER typing / (root) is routed to /driver', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/driver');
      expect(screen.getByTestId('driver-layout')).toBeInTheDocument();
    });
  });

  describe('Suite 3: FLEET_MANAGER Role Direct URL Forced Browsing', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'mgr-1', role: 'FLEET_MANAGER', name: 'Depot Fleet Manager' },
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        token: 'manager-jwt',
      } as any);
    });

    it('Test 9: FLEET_MANAGER typing /admin/users is intercepted by SuperAdminGuard and redirected to /admin/deliveries', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/admin/deliveries');
      expect(screen.getByTestId('deliveries-page')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    it('Test 10: FLEET_MANAGER typing /admin/audit-logs is intercepted by SuperAdminGuard and redirected to /admin/deliveries', () => {
      render(
        <MemoryRouter initialEntries={['/admin/audit-logs']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/admin/deliveries');
      expect(screen.getByTestId('deliveries-page')).toBeInTheDocument();
      expect(screen.queryByTestId('audit-logs-page')).not.toBeInTheDocument();
    });

    it('Test 11: FLEET_MANAGER typing /admin/control-center is allowed access', () => {
      render(
        <MemoryRouter initialEntries={['/admin/control-center']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/admin/control-center');
      expect(screen.getByTestId('control-center-page')).toBeInTheDocument();
    });
  });

  describe('Suite 4: ADMIN Role Full Access', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'adm-1', role: 'ADMIN', name: 'Super Admin' },
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        token: 'admin-jwt',
      } as any);
    });

    it('Test 12: ADMIN typing /admin/users passes SuperAdminGuard and renders UserManagementPage', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/admin/users');
      expect(screen.getByTestId('users-page')).toBeInTheDocument();
    });

    it('Test 13: ADMIN typing /admin/audit-logs passes SuperAdminGuard and renders AuditLogsPage', () => {
      render(
        <MemoryRouter initialEntries={['/admin/audit-logs']}>
          <TestApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('location-display')).toHaveTextContent('/admin/audit-logs');
      expect(screen.getByTestId('audit-logs-page')).toBeInTheDocument();
    });
  });
});
