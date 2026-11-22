import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DriverCockpitPage } from '../DriverCockpitPage';
import { useAuth } from '../../../context/AuthContext';
import { useDriverSocketContext } from '../../../context/DriverSocketContext';
import { DriverHudApi } from '../../../api/client';
import { useStaggerEntrance } from '../../../components/common/MotionPrimitives';

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
    startShift: vi.fn(),
    endShift: vi.fn(),
    claimRoute: vi.fn(),
  },
}));

vi.mock('../../../components/maps/InteractiveMap', () => ({
  InteractiveMap: () => <div data-testid="mock-interactive-map" />,
}));

vi.mock('../../../components/common/MotionPrimitives', () => ({
  useStaggerEntrance: vi.fn(),
}));

describe('DriverSilentHydration (D-RELOAD-02, D-RELOAD-03)', () => {
  let mockSocketContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocketContext = {
      joinRouteRoom: vi.fn(),
      leaveRouteRoom: vi.fn(),
      refreshKey: 0,
      triggerRefresh: vi.fn(),
      lastNotification: null,
      clearNotification: vi.fn(),
      notifications: [],
      unreadCount: 0,
      connectionStatus: 'connected',
      activeRouteId: 'r-1',
      driverId: 'd-1',
      shiftStatus: 'IN_PROGRESS',
      markNotificationRead: vi.fn(),
      socket: null,
    };

    (useDriverSocketContext as any).mockReturnValue(mockSocketContext);

    (useAuth as any).mockReturnValue({
      user: {
        id: 'u-1',
        name: 'Rajesh Driver',
        email: 'rajesh@smartroute.local',
        role: 'DRIVER',
      },
    });

    (DriverHudApi.getDashboard as any).mockResolvedValue({
      data: {
        driver: { id: 'd-1', name: 'Rajesh Driver' },
        activeRoute: { id: 'r-1', routeCode: 'OD02-01' },
        shift: { status: 'IN_PROGRESS' },
        vehicle: { id: 'v-1', registrationNumber: 'OD-02-1234' },
        metrics: { totalStops: 5, completedStops: 2, remainingStops: 3 },
      },
    });

    (DriverHudApi.getActiveRoute as any).mockResolvedValue({
      data: {
        route: {
          id: 'r-1',
          routeCode: 'OD02-01',
          stops: [
            {
              id: 's-1',
              status: 'ARRIVED',
              orderReference: 'ORD-101',
              customer: { name: 'Customer 1' },
              address: { street: '123 Market St', zone: 'Bhubaneswar' },
            },
          ],
        },
      },
    });
  });

  it('deduplicates initial mount effect: calls getDashboard and getActiveRoute exactly once on mount', async () => {
    render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Connecting to Rasulgarh Logistics Hub/i)).not.toBeInTheDocument();
      expect(screen.getByText('On Duty')).toBeInTheDocument();
    });

    expect(DriverHudApi.getDashboard).toHaveBeenCalledTimes(1);
    expect(DriverHudApi.getActiveRoute).toHaveBeenCalledTimes(1);
  });

  it('performs silent background hydration on refreshKey increment without flipping isLoading or showing loading spinner', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    // Initial load finishes
    await waitFor(() => {
      expect(screen.queryByText(/Connecting to Rasulgarh Logistics Hub/i)).not.toBeInTheDocument();
      expect(screen.getByText('On Duty')).toBeInTheDocument();
    });

    expect(DriverHudApi.getDashboard).toHaveBeenCalledTimes(1);

    // Mock an updated dashboard response with new metric for subsequent refresh
    (DriverHudApi.getDashboard as any).mockResolvedValue({
      data: {
        driver: { id: 'd-1', name: 'Rajesh Driver' },
        activeRoute: { id: 'r-1', routeCode: 'OD02-01' },
        shift: { status: 'IN_PROGRESS' },
        vehicle: { id: 'v-1', registrationNumber: 'OD-02-1234' },
        metrics: { totalStops: 6, completedStops: 3, remainingStops: 3 },
      },
    });

    // Simulate refreshKey increment from DriverSocketContext debounce
    (useDriverSocketContext as any).mockReturnValue({
      ...mockSocketContext,
      refreshKey: 1,
    });

    rerender(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    // After refreshKey update, APIs are called in the background
    await waitFor(() => {
      expect(DriverHudApi.getDashboard).toHaveBeenCalledTimes(2);
    });

    // Loading spinner must NEVER appear during background hydration
    expect(screen.queryByText(/Connecting to Rasulgarh Logistics Hub/i)).not.toBeInTheDocument();

    // Content stays mounted
    expect(screen.getByText('On Duty')).toBeInTheDocument();
  });

  it('protects GSAP useStaggerEntrance dependencies so animation does not re-trigger on background refresh', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('On Duty')).toBeInTheDocument();
    });

    // Check calls to useStaggerEntrance: dependency array was [isLoading]
    // Initial mount: [true] -> [false] after loading finishes
    const initialCalls = (useStaggerEntrance as any).mock.calls.length;

    // Trigger background refresh
    (useDriverSocketContext as any).mockReturnValue({
      ...mockSocketContext,
      refreshKey: 2,
    });

    rerender(
      <MemoryRouter>
        <DriverCockpitPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(DriverHudApi.getDashboard).toHaveBeenCalledTimes(2);
    });

    // The last call to useStaggerEntrance should still have [false] for isLoading, never toggling back to [true]
    const lastCallDeps = (useStaggerEntrance as any).mock.calls.slice(-1)[0][2];
    expect(lastCallDeps).toEqual([false]);
  });
});
