import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingPage, GRACE_PERIOD_MS } from '../TrackingPage';
import { FleetApi, DeliveriesApi, TelemetryApi, apiClient } from '../../../api/client';
import { RoutesApi } from '../../../api/routeApi';
import { renderWithProviders, mockUsers } from '../../../test/test-utils';

// Mock InteractiveMap to inspect props
vi.mock('../../../components/maps/InteractiveMap', () => ({
  default: (props: any) => (
    <div
      data-testid="mock-interactive-map"
      data-has-traversed={props.traversedPath !== undefined ? 'true' : 'false'}
      data-has-remaining={props.remainingPath !== undefined ? 'true' : 'false'}
      data-stops-count={props.stops?.length ?? 0}
      data-disable-stops-polyline={props.disableStopsPolyline ? 'true' : 'false'}
    />
  ),
}));

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
  emit: vi.fn((event: string, data: any, ack?: Function) => {
    if (event === 'telemetry:request_ping' && ack) {
      ack({ success: true, message: 'Sync ping transmitted to driver device' });
    }
  }),
  disconnect: vi.fn(),
};

vi.mock('../../../utils/socketClient', () => ({
  mountRealtimeSocket: vi.fn((_token: string, onConnect: (socket: any) => () => void) => {
    const cleanup = onConnect(mockSocket);
    return cleanup || (() => {});
  }),
}));

vi.mock('../../../hooks/useRealtimeCatchup', () => ({
  useRealtimeCatchup: vi.fn(),
}));

describe('Phase 23: TrackingPage Completed Routes, 30m Auto-Discard, Archived Tab & Maintenance', () => {
  const now = Date.now();
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const thirtyFiveMinutesAgo = new Date(now - 35 * 60 * 1000).toISOString();

  const mockVehicles = [
    {
      id: 'v-grace',
      _id: 'v-grace',
      vehicleId: 'OD-02-GRACE',
      makeModel: 'Tata Ace Electric',
      type: 'Van',
      fuelType: 'Electric',
      capacityKg: 800,
      availability: 'AVAILABLE',
      assignedDriverId: 'd-1',
    },
    {
      id: 'v-expired',
      _id: 'v-expired',
      vehicleId: 'OD-02-EXPIRED',
      makeModel: 'Mahindra Bolero Maxi',
      type: 'Van',
      fuelType: 'Diesel',
      capacityKg: 1000,
      availability: 'AVAILABLE',
      assignedDriverId: 'd-2',
    },
    {
      id: 'v-active',
      _id: 'v-active',
      vehicleId: 'OD-02-ACTIVE',
      makeModel: 'Ashok Leyland Dost',
      type: 'Van',
      fuelType: 'Diesel',
      capacityKg: 1200,
      availability: 'IN_TRANSIT',
      assignedDriverId: 'd-3',
    },
  ];

  const mockDrivers = [
    { id: 'd-1', _id: 'd-1', userId: { name: 'Driver Grace' }, licenseNumber: 'DL-01' },
    { id: 'd-2', _id: 'd-2', userId: { name: 'Driver Expired' }, licenseNumber: 'DL-02' },
    { id: 'd-3', _id: 'd-3', userId: { name: 'Driver Active' }, licenseNumber: 'DL-03' },
  ];

  const mockRoutes = [
    {
      id: 'r-grace',
      _id: 'r-grace',
      routeCode: 'RT-GRACE',
      vehicleId: 'v-grace',
      driverId: 'd-1',
      status: 'COMPLETED',
      completedAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
      depot: { coordinates: [85.8645, 20.2961] },
      stops: [
        { sequenceOrder: 1, coordinates: [85.85, 20.3], status: 'COMPLETED' },
      ],
    },
    {
      id: 'r-expired',
      _id: 'r-expired',
      routeCode: 'RT-EXPIRED',
      vehicleId: 'v-expired',
      driverId: 'd-2',
      status: 'COMPLETED',
      completedAt: thirtyFiveMinutesAgo,
      updatedAt: thirtyFiveMinutesAgo,
      depot: { coordinates: [85.8645, 20.2961] },
      stops: [
        { sequenceOrder: 1, coordinates: [85.82, 20.28], status: 'COMPLETED' },
      ],
    },
    {
      id: 'r-active',
      _id: 'r-active',
      routeCode: 'RT-ACTIVE',
      vehicleId: 'v-active',
      driverId: 'd-3',
      status: 'IN_PROGRESS',
      depot: { coordinates: [85.8645, 20.2961] },
      stops: [
        { sequenceOrder: 1, coordinates: [85.83, 20.27], status: 'PENDING' },
      ],
    },
  ];

  const mockTelemetryLive = [
    {
      vehicle: { id: 'v-grace' },
      telemetry: {
        coordinates: [85.85, 20.3],
        accuracyMeters: 5,
        speedKmh: 0,
        headingDegrees: 90,
        batteryPercent: 88,
        timestamp: new Date().toISOString(),
        source: 'MOBILE_APP_GPS',
        isStale: false,
        lastSeenMinutesAgo: 1,
      },
    },
    {
      vehicle: { id: 'v-expired' },
      telemetry: {
        coordinates: [85.82, 20.28],
        accuracyMeters: 5,
        speedKmh: 0,
        headingDegrees: 0,
        batteryPercent: 50,
        timestamp: thirtyFiveMinutesAgo,
        source: 'MOBILE_APP_GPS',
        isStale: true,
        lastSeenMinutesAgo: 35,
      },
    },
    {
      vehicle: { id: 'v-active' },
      telemetry: {
        coordinates: [85.84, 20.29],
        accuracyMeters: 5,
        speedKmh: 35,
        headingDegrees: 180,
        batteryPercent: 92,
        timestamp: new Date().toISOString(),
        source: 'MOBILE_APP_GPS',
        isStale: false,
        lastSeenMinutesAgo: 0,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/auth/me') {
        return { data: { success: true, data: { user: mockUsers.admin } } } as any;
      }
      return { data: { success: true } } as any;
    });

    vi.spyOn(FleetApi, 'getVehicles').mockResolvedValue({
      success: true,
      data: { vehicles: mockVehicles as any, total: mockVehicles.length },
    } as any);

    vi.spyOn(FleetApi, 'getDrivers').mockResolvedValue({
      success: true,
      data: { drivers: mockDrivers as any },
    } as any);

    vi.spyOn(DeliveriesApi, 'list').mockResolvedValue({
      success: true,
      data: { deliveries: [], total: 0, page: 1, totalPages: 1 },
    } as any);

    vi.spyOn(RoutesApi, 'list').mockResolvedValue({
      success: true,
      data: { routes: mockRoutes },
    } as any);

    vi.spyOn(TelemetryApi, 'getLive').mockResolvedValue({
      success: true,
      data: { fleet: mockTelemetryLive },
    } as any);

    vi.spyOn(TelemetryApi, 'getAlerts').mockResolvedValue({
      success: true,
      data: { alerts: [] },
    } as any);

    vi.spyOn(FleetApi, 'updateVehicle').mockResolvedValue({
      success: true,
      data: { vehicle: mockVehicles[0] as any },
    } as any);
  });

  it('1. Completed route completed 10 minutes ago is displayed in active list with grace indicator', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Grace badge is present
    expect(screen.getByText('COMPLETED (GRACE)')).toBeInTheDocument();
    expect(screen.getByText(/Completed 10m ago • Auto-hides in/i)).toBeInTheDocument();

    // Expired vehicle (35m) is auto-hidden from the active All tab
    expect(screen.queryByText('OD-02-EXPIRED')).not.toBeInTheDocument();

    // Active in-progress vehicle is visible
    expect(screen.getByText('OD-02-ACTIVE')).toBeInTheDocument();
  });

  it('2. Completed route completed 35 minutes ago is visible under ARCHIVED tab', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Click Archived tab
    const archivedTab = screen.getByRole('button', { name: /Archived/i });
    expect(archivedTab).toBeInTheDocument();
    fireEvent.click(archivedTab);

    // Both completed vehicles (within grace and expired) appear under Archived tab
    expect(screen.getByText('OD-02-EXPIRED')).toBeInTheDocument();
    expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();

    // Purely active in-transit vehicle without completed route is excluded from Archived
    expect(screen.queryByText('OD-02-ACTIVE')).not.toBeInTheDocument();
  });

  it('3. Selecting an archived/completed vehicle clears traversedPath and remainingPath from map', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Switch to Archived tab and select expired vehicle
    fireEvent.click(screen.getByRole('button', { name: /Archived/i }));
    fireEvent.click(screen.getByText('OD-02-EXPIRED'));

    const map = screen.getByTestId('mock-interactive-map');
    // Polyline paths must evaluate to undefined
    expect(map.getAttribute('data-has-traversed')).toBe('false');
    expect(map.getAttribute('data-has-remaining')).toBe('false');
    expect(map.getAttribute('data-disable-stops-polyline')).toBe('true');
  });

  it('4. Status dropdown renders transitions and opens maintenance modal on selecting MAINTENANCE', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Select the available vehicle
    fireEvent.click(screen.getByText('OD-02-GRACE'));

    const statusSelect = screen.getByLabelText('Vehicle Status') as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe('AVAILABLE');

    // Select MAINTENANCE
    fireEvent.change(statusSelect, { target: { value: 'MAINTENANCE' } });

    // Maintenance Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Place OD-02-GRACE into Maintenance/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Tire puncture / repair')).toBeInTheDocument();
    expect(screen.getByText('Scheduled 10,000 km service')).toBeInTheDocument();

    // Select reason and submit
    fireEvent.click(screen.getByText('Tire puncture / repair'));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Maintenance/i }));

    await waitFor(() => {
      expect(FleetApi.updateVehicle).toHaveBeenCalledWith(
        'v-grace',
        expect.objectContaining({
          availability: 'MAINTENANCE',
          maintenanceNotes: expect.stringContaining('Tire puncture / repair'),
        })
      );
    });
  });

  it('5. fleet:vehicle_updated socket event synchronizes vehicle state in real-time', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Simulate incoming socket event from another dispatcher
    const handler = mockSocketHandlers['fleet:vehicle_updated'];
    expect(handler).toBeDefined();

    handler({
      vehicle: {
        _id: 'v-grace',
        vehicleId: 'OD-02-GRACE',
        availability: 'MAINTENANCE',
        maintenanceNotes: 'Brake pad replacement • Workshop #12',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Brake pad replacement/i)).toBeInTheDocument();
    });
  });

  it('6. Clicking "Ping Driver" emits telemetry:request_ping over socket', async () => {
    renderWithProviders(<TrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('OD-02-GRACE')).toBeInTheDocument();
    });

    // Select vehicle with driver
    fireEvent.click(screen.getByText('OD-02-GRACE'));

    const pingBtn = screen.getByRole('button', { name: /Ping Driver/i });
    expect(pingBtn).toBeInTheDocument();

    fireEvent.click(pingBtn);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'telemetry:request_ping',
      expect.objectContaining({
        vehicleId: 'v-grace',
      }),
      expect.any(Function)
    );

    await waitFor(() => {
      expect(screen.getByText(/Sync ping transmitted to driver device/i)).toBeInTheDocument();
    });
  });
});
