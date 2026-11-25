import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsPage } from '../AnalyticsPage';
import { AdminApi, DeliveriesApi } from '../../../api/client';
import * as clientModule from '../../../api/client';
import { renderWithProviders, mockUsers } from '../../../test/test-utils';

// Mock Socket
const mockSocketHandlers: Record<string, Function> = {};
const mockSocket = {
  connected: true,
  on: vi.fn((event: string, handler: Function) => {
    mockSocketHandlers[event] = handler;
  }),
  off: vi.fn((event: string) => {
    delete mockSocketHandlers[event];
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('../../../utils/socketClient', () => ({
  mountRealtimeSocket: vi.fn((_token: string, onConnect: (socket: any) => () => void) => {
    const cleanup = onConnect(mockSocket);
    return cleanup || (() => {});
  }),
}));

vi.mock('../../../hooks/useRealtimeCatchup', () => ({
  useRealtimeCatchup: vi.fn((callback: Function) => {
    // expose catchup trigger if needed
  }),
}));

describe('AnalyticsPage Real-Time KPI & Operational Analytics Updates', () => {
  const initialAnalytics = {
    totalDeliveries: 20,
    completedDeliveries: 12,
    activeDeliveries: 6,
    failedDeliveries: 2,
    unassignedDeliveries: 0,
    hasResolvedDeliveries: true,
    deliveryCompletionRatePct: 60.0,
    onTimeDeliveryRatePct: 91.7,
    averageDeliveryTimeMin: 24.5,
    avgPlannedStopDurationMin: 8.0,
    totalOperatingCostInr: 4520,
    fuelCostPerDeliveryInr: 35.5,
    routeEfficiencyScorePct: 88.5,
    costEfficiencyPct: 14.2,
    vehicleUtilizationRatePct: 75.0,
    cargoLoadPct: 82.0,
    activeCargoKg: 450,
    activeCapacityKg: 600,
    totalWeightKg: 1200,
    totalCo2AvoidedKg: 38.4,
    totalDistanceSavedKm: 42.1,
    fuelSavedInr: 1250,
    fuelSavedLitres: 12.8,
    energySavedKwh: 15.2,
    plannedVsActual: {
      plannedBaselineDistanceKm: 180,
      plannedOptimizedDistanceKm: 140,
      plannedFuelLitres: 18,
      plannedEnergyKwh: 22,
      plannedBaselineFuelLitres: 24,
      plannedCostInr: 2100,
      actualDistanceKm: 138,
      actualFuelLitres: 17.5,
      actualAvgBatteryUsedPct: 35,
      completedShiftsCount: 4,
      executedRoutesCount: 4,
      distanceVarianceKm: -2,
    },
    zoneBreakdown: [{ zone: 'Rasulgarh', count: 12, pct: 60 }],
    propulsionBreakdown: { electric: 2, diesel: 3, petrol: 1 },
    counts: {
      totalVehicles: 6,
      availableVehicles: 2,
      maintenanceVehicles: 0,
      nonRetiredVehicles: 6,
      activeVehicles: 4,
      nonDraftRoutesCount: 4,
    },
  };

  const updatedAnalytics = {
    ...initialAnalytics,
    completedDeliveries: 15,
    activeDeliveries: 3,
    deliveryCompletionRatePct: 75.0,
    onTimeDeliveryRatePct: 93.3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem('token', 'mock-admin-token-12345');

    vi.spyOn(AdminApi, 'getAnalytics').mockResolvedValue({
      success: true,
      data: initialAnalytics as any,
    });

    vi.spyOn(DeliveriesApi, 'list').mockResolvedValue({
      success: true,
      data: {
        deliveries: [
          { id: 'del-1', status: 'COMPLETED', weightKg: 20 },
          { id: 'del-2', status: 'OUT_FOR_DELIVERY', weightKg: 15 },
        ] as any,
      },
    });

    vi.spyOn(clientModule, 'clearInFlightCache');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('subscribes to real-time operational events and mounts socket on load', async () => {
    renderWithProviders(<AnalyticsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalRoutes')).toBeInTheDocument();
    });

    expect(mockSocket.on).toHaveBeenCalledWith('delivery:updated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('route:progress', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('fleet:vehicle_updated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('system:purged', expect.any(Function));
    expect(screen.getByTestId('live-sync-indicator')).toBeInTheDocument();
  });

  it('updates KPI values and invalidates cache when a delivery:updated event is received', async () => {
    renderWithProviders(<AnalyticsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-completedRoutes')).toHaveTextContent('12');
    });

    // Mock next response with updated delivery metrics
    vi.mocked(AdminApi.getAnalytics).mockResolvedValueOnce({
      success: true,
      data: updatedAnalytics as any,
    });

    // Simulate real-time socket event emission from field driver
    act(() => {
      mockSocketHandlers['delivery:updated']?.({
        deliveryId: 'del-2',
        status: 'COMPLETED',
      });
    });

    // Advance 300ms debounce timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Cache should be evicted right before fetching fresh analytics
    expect(clientModule.clearInFlightCache).toHaveBeenCalled();

    // Verify KPI card reflects new updated value (15)
    await waitFor(() => {
      expect(screen.getByTestId('kpi-completedRoutes')).toHaveTextContent('15');
    });
  });

  it('debounces burst socket events into a single refresh call', async () => {
    renderWithProviders(<AnalyticsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalRoutes')).toBeInTheDocument();
    });

    expect(AdminApi.getAnalytics).toHaveBeenCalledTimes(1);

    // Fire 5 rapid socket events within 100ms
    act(() => {
      mockSocketHandlers['delivery:updated']?.({ id: '1' });
      mockSocketHandlers['route:progress']?.({ id: 'r1' });
      mockSocketHandlers['delivery:updated']?.({ id: '2' });
      mockSocketHandlers['fleet:vehicle_updated']?.({ id: 'v1' });
      mockSocketHandlers['route:progress']?.({ id: 'r2' });
    });

    // Fast-forward 100ms (before the 300ms debounce expires)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // No extra fetch should have fired yet
    expect(AdminApi.getAnalytics).toHaveBeenCalledTimes(1);

    // Fast-forward past the 300ms window
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Exactly 1 additional fetch was triggered (2 total)
    expect(AdminApi.getAnalytics).toHaveBeenCalledTimes(2);
  });

  it('performs silent background hydration without flashing a loading spinner', async () => {
    renderWithProviders(<AnalyticsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalRoutes')).toBeInTheDocument();
    });

    // Trigger a live event
    act(() => {
      mockSocketHandlers['route:progress']?.({ routeId: 'r-101' });
    });

    // Advance debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // The KPI strip remains in the DOM continuously without being replaced by full-page skeleton
    expect(screen.getByTestId('kpi-totalRoutes')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-completedRoutes')).toBeInTheDocument();
  });
});
