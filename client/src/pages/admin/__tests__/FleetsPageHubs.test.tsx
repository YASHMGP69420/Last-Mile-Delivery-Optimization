import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FleetsPage } from '../FleetsPage';
import { FleetApi, HubsApi } from '../../../api/client';
import { renderWithProviders, mockUsers } from '../../../test/test-utils';

vi.mock('../../../hooks/useRealtimeCatchup', () => ({
  useRealtimeCatchup: vi.fn(),
}));

const mockHubs = [
  {
    id: 'hub-1',
    name: 'Rasulgarh Central Hub',
    code: 'HUB-RSL',
    address: 'Plot 12, Rasulgarh Industrial Estate, Bhubaneswar',
    location: { lat: 20.2961, lng: 85.8245 },
    contactPhone: '+91 674 258 1001',
    operatingHours: { open: '08:00', close: '20:00' },
    isActive: true,
    isCanonical: true,
  },
  {
    id: 'hub-2',
    name: 'Chandrasekharpur Depot',
    code: 'HUB-CSP',
    address: 'Near Infocity, Chandrasekharpur, Bhubaneswar',
    location: { lat: 20.3245, lng: 85.8162 },
    contactPhone: '+91 674 258 2002',
    operatingHours: { open: '08:00', close: '20:00' },
    isActive: true,
    isCanonical: false,
  },
];

const mockVehicles = [
  {
    id: 'veh-1',
    _id: 'veh-1',
    vehicleId: 'OD-02-AX-1001',
    makeModel: 'Tata Ace Gold',
    type: 'Van',
    capacityKg: 750,
    fuelType: 'Diesel',
    availability: 'AVAILABLE',
    homeHubId: 'hub-1',
    homeHub: mockHubs[0],
  },
  {
    id: 'veh-2',
    _id: 'veh-2',
    vehicleId: 'OD-02-AX-1002',
    makeModel: 'Mahindra Treo Zor',
    type: 'Van',
    capacityKg: 550,
    fuelType: 'Electric',
    availability: 'AVAILABLE',
    homeHubId: 'hub-2',
    homeHub: mockHubs[1],
  },
];

describe('FleetsPage Hubs Management (D-02, D-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(FleetApi, 'getVehicles').mockResolvedValue({
      success: true,
      data: {
        vehicles: mockVehicles as any,
        total: 2,
      },
    });

    vi.spyOn(HubsApi, 'getHubs').mockResolvedValue({
      success: true,
      data: {
        hubs: mockHubs as any,
        total: 2,
      },
    });
  });

  it('switches between Vehicles and Hubs & Depots tabs', async () => {
    renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    // Initial Vehicles view
    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
    });

    // Check tab buttons exist
    const vehiclesTab = screen.getByTestId('tab-vehicles');
    const hubsTab = screen.getByTestId('tab-hubs');
    expect(vehiclesTab).toBeInTheDocument();
    expect(hubsTab).toBeInTheDocument();

    // Switch to Hubs & Depots tab
    fireEvent.click(hubsTab);

    // Verify hubs are displayed
    await waitFor(() => {
      expect(screen.getByText('Rasulgarh Central Hub')).toBeInTheDocument();
      expect(screen.getByText('Chandrasekharpur Depot')).toBeInTheDocument();
    });

    // Primary badge for canonical hub
    expect(screen.getByText('Primary')).toBeInTheDocument();

    // Switch back to Vehicles tab
    fireEvent.click(vehiclesTab);
    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
    });
  });

  it('renders seeded Bhubaneswar hubs in Hubs & Depots table', async () => {
    renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    fireEvent.click(screen.getByTestId('tab-hubs'));

    await waitFor(() => {
      expect(screen.getByText('HUB-RSL')).toBeInTheDocument();
      expect(screen.getByText('HUB-CSP')).toBeInTheDocument();
      expect(screen.getByText('Plot 12, Rasulgarh Industrial Estate, Bhubaneswar')).toBeInTheDocument();
    });
  });

  it('opens Register Hub modal and submits new hub payload', async () => {
    const createHubSpy = vi.spyOn(HubsApi, 'createHub').mockResolvedValue({
      success: true,
      message: 'Hub created successfully',
      data: {
        hub: {
          id: 'hub-3',
          name: 'Khandagiri Hub',
          code: 'HUB-KDG',
          address: 'Near Caves, Khandagiri, Bhubaneswar',
          location: { lat: 20.2581, lng: 85.7832 },
          contactPhone: '+91 674 258 3003',
          operatingHours: { open: '08:00', close: '20:00' },
          isActive: true,
          isCanonical: false,
        } as any,
      },
    });

    renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    fireEvent.click(screen.getByTestId('tab-hubs'));

    await waitFor(() => {
      expect(screen.getByText('Rasulgarh Central Hub')).toBeInTheDocument();
    });

    const registerHubBtn = screen.getByRole('button', { name: /Register Hub/i });
    fireEvent.click(registerHubBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Register New Logistics Hub/i })).toBeInTheDocument();
    });

    const modal = screen.getByRole('dialog', { name: /Register New Logistics Hub/i });

    // Fill form
    fireEvent.change(within(modal).getByLabelText(/Hub Name/i), {
      target: { value: 'Khandagiri Hub' },
    });
    fireEvent.change(within(modal).getByLabelText(/Hub Code/i), {
      target: { value: 'HUB-KDG' },
    });
    fireEvent.change(within(modal).getByLabelText(/Address/i), {
      target: { value: 'Near Caves, Khandagiri, Bhubaneswar' },
    });
    fireEvent.change(within(modal).getByLabelText(/Latitude/i), {
      target: { value: '20.2581' },
    });
    fireEvent.change(within(modal).getByLabelText(/Longitude/i), {
      target: { value: '85.7832' },
    });

    // Submit form
    fireEvent.click(within(modal).getByRole('button', { name: /Register Hub/i }));

    await waitFor(() => {
      expect(createHubSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Khandagiri Hub',
          code: 'HUB-KDG',
          address: 'Near Caves, Khandagiri, Bhubaneswar',
          location: { lat: 20.2581, lng: 85.7832 },
        })
      );
    });
  });

  it('selects and updates Home Hub in vehicle edit modal (D-02)', async () => {
    const updateVehicleSpy = vi.spyOn(FleetApi, 'updateVehicle').mockResolvedValue({
      success: true,
      data: { vehicle: mockVehicles[0] as any },
    });

    renderWithProviders(<FleetsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
    });

    // Click Edit on first vehicle
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Edit Vehicle — OD-02-AX-1001/i })).toBeInTheDocument();
    });

    const modal = screen.getByRole('dialog', { name: /Edit Vehicle — OD-02-AX-1001/i });

    // Find Home Hub dropdown
    const homeHubSelect = within(modal).getByLabelText(/Home Hub/i);
    expect(homeHubSelect).toBeInTheDocument();

    // Change to Chandrasekharpur Depot (hub-2)
    fireEvent.change(homeHubSelect, { target: { value: 'hub-2' } });

    // Save changes
    fireEvent.click(within(modal).getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateVehicleSpy).toHaveBeenCalledWith(
        'veh-1',
        expect.objectContaining({
          homeHubId: 'hub-2',
        })
      );
    });
  });

  it('displays cascade protection notice in delete hub modal', async () => {
    renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    fireEvent.click(screen.getByTestId('tab-hubs'));

    await waitFor(() => {
      expect(screen.getByText('Chandrasekharpur Depot')).toBeInTheDocument();
    });

    // Find delete buttons - canonical hub (first row) delete button should be disabled
    const deleteButtons = screen.getAllByTitle(/Delete hub/i);
    // Click delete on the non-canonical hub
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Cascade Protections/i)).toBeInTheDocument();
      expect(screen.getByText(/Logistics hubs cannot be deleted if they are designated as the canonical primary hub/i)).toBeInTheDocument();
    });
  });
});
