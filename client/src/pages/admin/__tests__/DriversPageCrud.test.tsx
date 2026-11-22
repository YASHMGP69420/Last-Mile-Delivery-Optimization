import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriversPage } from '../DriversPage';
import { FleetApi } from '../../../api/client';
import { renderWithProviders, mockUsers } from '../../../test/test-utils';

vi.mock('../../../hooks/useRealtimeCatchup', () => ({
  useRealtimeCatchup: vi.fn(),
}));

const mockDrivers = [
  {
    id: 'drv-1',
    _id: 'drv-1',
    userId: {
      id: 'usr-1',
      _id: 'usr-1',
      name: 'Ashok Kumar',
      email: 'ashok.kumar@smartroute.internal',
      role: 'DRIVER',
    },
    licenseNumber: 'OD-02-DL-2024-001',
    phone: '+91 94370 12345',
    availability: 'AVAILABLE',
    rating: 4.9,
    onTimeRuns: 12,
    assignedVehicleId: null,
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
  },
];

describe('DriversPage Edit & Delete CRUD Workflows (client/src/pages/admin/__tests__/DriversPageCrud.test.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(FleetApi, 'getDrivers').mockResolvedValue({
      success: true,
      data: {
        drivers: mockDrivers as any,
        total: 1,
      },
    });

    vi.spyOn(FleetApi, 'getVehicles').mockResolvedValue({
      success: true,
      data: {
        vehicles: mockVehicles as any,
        total: 1,
      },
    });

    vi.spyOn(FleetApi, 'updateDriver').mockResolvedValue({
      success: true,
      message: 'Driver updated successfully',
      data: {
        driver: { ...mockDrivers[0], phone: '+91 94370 99999' } as any,
      },
    });

    vi.spyOn(FleetApi, 'deleteDriver').mockResolvedValue({
      success: true,
      message: 'Driver deleted successfully',
      data: {
        message: 'Driver deleted successfully',
      },
    });
  });

  it('renders Edit and Delete action buttons for drivers in the table', async () => {
    renderWithProviders(<DriversPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('Ashok Kumar')).toBeInTheDocument();
    });

    expect(screen.getByTitle('Edit driver')).toBeInTheDocument();
    expect(screen.getByTitle('Delete driver')).toBeInTheDocument();
  });

  it('opens EditDriverModal, allows updating driver info, and submits via FleetApi.updateDriver', async () => {
    renderWithProviders(<DriversPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('Ashok Kumar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit driver'));

    // Verify modal appears with populated fields
    expect(screen.getByText('Edit Driver — Ashok Kumar')).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveValue('Ashok Kumar');

    const phoneInput = screen.getByLabelText(/Phone Number/i);
    expect(phoneInput).toHaveValue('+91 94370 12345');

    // Update inputs
    fireEvent.change(nameInput, { target: { value: 'Ashok Kumar Patra' } });
    fireEvent.change(phoneInput, { target: { value: '+91 94370 99999' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(FleetApi.updateDriver).toHaveBeenCalledWith(
        'drv-1',
        expect.objectContaining({
          name: 'Ashok Kumar Patra',
          phone: '+91 94370 99999',
        })
      );
    });
  });

  it('opens DeleteDriverModal and safely deletes an idle driver', async () => {
    renderWithProviders(<DriversPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('Ashok Kumar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Delete driver'));

    // Verify confirmation modal
    expect(screen.getByText('Delete Driver — Ashok Kumar')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete driver/i)).toBeInTheDocument();

    // Confirm deletion
    const deleteBtn = screen.getByRole('button', { name: /^Delete Driver$/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(FleetApi.deleteDriver).toHaveBeenCalledWith('drv-1');
    });
  });

  it('intercepts 409 ACTIVE_OPERATION_CONFLICT and allows force-reassigning active orders', async () => {
    vi.mocked(FleetApi.deleteDriver)
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'ACTIVE_OPERATION_CONFLICT',
              message: 'Cannot delete driver: an active route is running.',
              details: {
                hasActiveOperations: true,
                routeCode: 'RT-ACTIVE-999',
                activeDeliveryCount: 4,
                driverName: 'Ashok Kumar',
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Driver deleted successfully',
        data: { message: 'Driver deleted successfully' },
      });

    renderWithProviders(<DriversPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('Ashok Kumar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Delete driver'));

    await waitFor(() => {
      expect(screen.getByText('Delete Driver — Ashok Kumar')).toBeInTheDocument();
    });

    const modalDialog = screen.getByRole('dialog', { name: /Delete Driver — Ashok Kumar/i });
    const deleteBtn = within(modalDialog).getByRole('button', { name: /Delete Driver/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(FleetApi.deleteDriver).toHaveBeenCalledWith('drv-1');
    });

    // ActiveOperationConflictModal should appear
    await waitFor(() => {
      expect(screen.getByText(/Cannot delete driver with active in-transit operations/i)).toBeInTheDocument();
      expect(screen.getByText('RT-ACTIVE-999')).toBeInTheDocument();
      expect(screen.getAllByText(/active deliveries/i).length).toBeGreaterThan(0);
    });

    // Click Reassign Active Orders & Delete
    const rescueBtn = screen.getByRole('button', { name: /Reassign Active Orders & Delete/i });
    fireEvent.click(rescueBtn);

    await waitFor(() => {
      expect(FleetApi.deleteDriver).toHaveBeenCalledWith('drv-1', { forceReassign: true });
    });
  });

  it('supports selecting multiple drivers and deleting them via bulk action modal', async () => {
    vi.spyOn(FleetApi, 'deleteDriver').mockResolvedValue({
      success: true,
      message: 'Driver deleted successfully',
      data: { message: 'Driver deleted successfully' },
    });

    renderWithProviders(<DriversPage />, { user: mockUsers.fleetManager });

    await waitFor(() => {
      expect(screen.getByText('Ashok Kumar')).toBeInTheDocument();
    });

    const rowCheckbox = screen.getByLabelText('Select row drv-1');
    fireEvent.click(rowCheckbox);

    await waitFor(() => {
      expect(screen.getByText('1 Drivers Selected')).toBeInTheDocument();
    });

    const bulkDeleteBtn = screen.getByRole('button', { name: /Delete Selected \(1\)/i });
    fireEvent.click(bulkDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
    });

    const confirmModal = screen.getByRole('dialog', { name: /Delete 1 Selected Driver/i });
    const confirmBtn = within(confirmModal).getByRole('button', { name: /Delete 1 Driver/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(FleetApi.deleteDriver).toHaveBeenCalledWith('drv-1');
    });
  });
});
