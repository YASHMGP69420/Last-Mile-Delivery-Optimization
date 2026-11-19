import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DriverCockpitPage } from '../DriverCockpitPage';
import { DriverRoutePage } from '../DriverRoutePage';
import { useAuth } from '../../../context/AuthContext';
import { useDriverSocketContext } from '../../../context/DriverSocketContext';
import { DriverHudApi } from '../../../api/client';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../context/DriverSocketContext', () => ({
  useDriverSocketContext: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  DriverHudApi: {
    getDashboard: vi.fn(),
    getActiveRoute: vi.fn(),
    markDeliveryArrived: vi.fn(),
    completeDelivery: vi.fn(),
    failDelivery: vi.fn(),
  },
}));

vi.mock('../../../components/maps/InteractiveMap', () => ({
  InteractiveMap: () => <div data-testid="mock-interactive-map" />,
}));

vi.mock('../../../components/common/MotionPrimitives', () => ({
  useStaggerEntrance: vi.fn(),
}));

describe('DriverCockpitDemoBanner (DEMO-ISOLATION-02, D-04)', () => {
  const mockSocketContext = {
    joinRouteRoom: vi.fn(),
    leaveRouteRoom: vi.fn(),
    refreshKey: 0,
    triggerRefresh: vi.fn(),
    lastNotification: null,
    clearNotification: vi.fn(),
    notifications: [],
    unreadCount: 0,
    connectionStatus: 'connected',
    activeRouteId: 'route-1',
    driverId: 'driver-1',
    shiftStatus: 'IN_PROGRESS',
    markNotificationRead: vi.fn(),
    socket: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDriverSocketContext as any).mockReturnValue(mockSocketContext);
    (DriverHudApi.getDashboard as any).mockResolvedValue({
      data: {
        driver: { id: 'd-1', name: 'Rajesh Demo' },
        activeRoute: { id: 'r-1', routeCode: 'OD02-DEMO-01' },
        shift: { status: 'IN_PROGRESS' },
        vehicle: { id: 'v-1', registrationNumber: 'OD-02-DEMO-01' },
        metrics: { totalStops: 5, completedStops: 2, remainingStops: 3 },
      },
    });
    (DriverHudApi.getActiveRoute as any).mockResolvedValue({
      data: {
        route: {
          id: 'r-1',
          routeCode: 'OD02-DEMO-01',
          stops: [
            {
              id: 's-1',
              status: 'ARRIVED',
              orderReference: 'ORD-101',
              customer: { name: 'Alice' },
              address: { street: '123 Market St', zone: 'Bhubaneswar' },
            },
          ],
        },
      },
    });
  });

  it('renders sticky amber banner in DriverCockpitPage when logged in as a demo driver (isDemoData: true)', async () => {
    (useAuth as any).mockReturnValue({
      user: {
        id: 'u-demo-1',
        name: 'Demo Driver',
        email: 'driver.rajesh@smartroute.local',
        role: 'DRIVER',
        isDemoData: true,
      },
    });

    render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const banner = screen.getByTestId('demo-handheld-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('role', 'status');
      expect(banner).toHaveTextContent('Demo Driver Session — Simulated Handheld');
    });
  });

  it('renders sticky amber banner in DriverCockpitPage when email ends with @smartroute.local even if isDemoData is not set', async () => {
    (useAuth as any).mockReturnValue({
      user: {
        id: 'u-demo-2',
        name: 'Demo Driver Sunil',
        email: 'driver.sunil@smartroute.local',
        role: 'DRIVER',
      },
    });

    render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const banner = screen.getByTestId('demo-handheld-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('Demo Driver Session — Simulated Handheld');
    });
  });

  it('does NOT render demo banner in DriverCockpitPage when logged in as a production driver (isDemoData: false)', async () => {
    (useAuth as any).mockReturnValue({
      user: {
        id: 'u-prod-1',
        name: 'Real Driver',
        email: 'driver.real@logistics.com',
        role: 'DRIVER',
        isDemoData: false,
      },
    });

    render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('demo-handheld-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(/Demo Driver Session — Simulated Handheld/i)).not.toBeInTheDocument();
    });
  });

  it('renders sticky amber banner in DriverRoutePage with matching styling and role="status" when user is demo driver', async () => {
    (useAuth as any).mockReturnValue({
      user: {
        id: 'u-demo-1',
        name: 'Demo Driver',
        email: 'driver.rajesh@smartroute.local',
        role: 'DRIVER',
        isDemoData: true,
      },
    });

    render(
      <MemoryRouter>
        <DriverRoutePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const banner = screen.getByTestId('demo-handheld-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('role', 'status');
      expect(banner).toHaveTextContent('Demo Driver Session — Simulated Handheld');
    });
  });
});
