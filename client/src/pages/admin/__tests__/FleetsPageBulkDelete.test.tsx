import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FleetsPage } from '../FleetsPage';
import { FleetApi } from '../../../api/client';
import { renderWithProviders, mockUsers } from '../../../test/test-utils';

vi.mock('../../../hooks/useRealtimeCatchup', () => ({
  useRealtimeCatchup: vi.fn(),
}));

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
  },
];

describe('FleetsPage Bulk Selection & Deletion Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(FleetApi, 'getVehicles').mockResolvedValue({
      success: true,
      data: {
        vehicles: mockVehicles as any,
        total: 2,
      },
    });
  });

  it('allows multi-selecting vehicles and soft-retiring or deleting them', async () => {
    vi.spyOn(FleetApi, 'deleteVehicle').mockResolvedValue({
      success: true,
      message: 'Vehicle retired successfully',
    });

    renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
      expect(screen.getByText('OD-02-AX-1002')).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText('Select all rows');
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('2 Vehicles Selected')).toBeInTheDocument();
    });

    const bulkActionBtn = screen.getByRole('button', { name: /Delete \/ Retire Selected \(2\)/i });
    fireEvent.click(bulkActionBtn);

    await waitFor(() => {
      expect(screen.getByText(/You are about to decommission/i)).toBeInTheDocument();
    });

    const modalDialog = screen.getByRole('dialog', { name: /Delete or Retire 2 Selected Vehicles/i });
    const retireBtn = within(modalDialog).getByRole('button', { name: /Retire 2 Vehicles/i });
    fireEvent.click(retireBtn);

    await waitFor(() => {
      expect(FleetApi.deleteVehicle).toHaveBeenCalledWith('veh-1', { permanent: false });
      expect(FleetApi.deleteVehicle).toHaveBeenCalledWith('veh-2', { permanent: false });
    });
  });

  it('does NOT render Edit or Delete buttons for Fleet Manager, but renders them for Admin', async () => {
    const { unmount } = renderWithProviders(<FleetsPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Maintenance/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Retire/i }).length).toBeGreaterThan(0);

    unmount();

    renderWithProviders(<FleetsPage />, { user: mockUsers.admin });

    await waitFor(() => {
      expect(screen.getByText('OD-02-AX-1001')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /^Edit$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Delete$/i }).length).toBeGreaterThan(0);
  });
});
