import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DeveloperDangerZoneCard } from '../DeveloperDangerZoneCard';
import { AdminApi } from '../../../api/client';
import { toast } from 'sonner';

vi.mock('../../../api/client', () => ({
  AdminApi: {
    purgeAllOperationalData: vi.fn(),
    bulkImportSampleCsvs: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DeveloperDangerZoneCard Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: Renders Developer Danger Zone card with high-contrast warning elements and Purge button', () => {
    render(<DeveloperDangerZoneCard />);

    expect(screen.getByText(/Developer Danger Zone/i)).toBeInTheDocument();
    expect(screen.getByText(/Hard Reset & Database Purge/i)).toBeInTheDocument();
    expect(screen.getByText(/Permanently deletes all operational data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purge All Operational Data/i })).toBeInTheDocument();
  });

  it('Test 2: Clicking Purge opens Step 1 modal displaying affected operational collections', () => {
    render(<DeveloperDangerZoneCard />);

    const purgeButton = screen.getByRole('button', { name: /Purge All Operational Data/i });
    fireEvent.click(purgeButton);

    expect(screen.getByText(/Step 1 of 2: Review affected operational collections/i)).toBeInTheDocument();
    expect(screen.getByText(/Deliveries & Consignments/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Batches & Schedulers/i)).toBeInTheDocument();
    expect(screen.getByText(/Fleet Vehicles & Vehicle Assignments/i)).toBeInTheDocument();
    expect(screen.getByText(/Drivers & Driver User Logins/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator Account Safety/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Final Confirmation/i })).toBeInTheDocument();
  });

  it('Test 3: Clicking Proceed transitions to Step 2 and starts the countdown timer; confirm button remains disabled until timer elapses', () => {
    render(<DeveloperDangerZoneCard />);

    // Open Modal
    fireEvent.click(screen.getByRole('button', { name: /Purge All Operational Data/i }));

    // Proceed to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Final Confirmation/i }));

    expect(screen.getByText(/Step 2 of 2: Safety countdown lock/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you absolutely sure you want to purge all operational data\?/i)).toBeInTheDocument();

    // Confirm button is initially locked in countdown
    const confirmButton = screen.getByRole('button', { name: /Unlocking in 3s\.\.\./i });
    expect(confirmButton).toBeDisabled();

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /Unlocking in 2s\.\.\./i })).toBeDisabled();

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /Unlocking in 1s\.\.\./i })).toBeDisabled();

    // Advance 1 second (countdown reaches 0)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const unlockedButton = screen.getByRole('button', { name: /Confirm Database Purge/i });
    expect(unlockedButton).not.toBeDisabled();
  });

  it('Test 4: Clicking confirm calls AdminApi.purgeAllOperationalData and shows green success toast', async () => {
    vi.mocked(AdminApi.purgeAllOperationalData).mockResolvedValueOnce({
      success: true,
      message: 'Purged',
      data: { deletedCount: 42 },
    });

    const onPurgedMock = vi.fn();
    render(<DeveloperDangerZoneCard onPurged={onPurgedMock} />);

    // Step 1
    fireEvent.click(screen.getByRole('button', { name: /Purge All Operational Data/i }));
    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Final Confirmation/i }));

    // Elapse timer (advance 1s three times to allow state updates and subsequent useEffect timers)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const unlockedButton = screen.getByRole('button', { name: /Confirm Database Purge/i });
    expect(unlockedButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(unlockedButton);
    });

    expect(AdminApi.purgeAllOperationalData).toHaveBeenCalledWith(true);
    expect(toast.success).toHaveBeenCalledWith('Database operational data successfully purged and reset');
    expect(onPurgedMock).toHaveBeenCalled();
  });

  it('Test 5: Renders Bulk Import Sample CSVs button adjacent to Purge button', () => {
    render(<DeveloperDangerZoneCard />);
    expect(screen.getByRole('button', { name: /Bulk Import Sample CSVs/i })).toBeInTheDocument();
  });

  it('Test 6: Clicking Bulk Import opens modal showing dataset breakdown (vehicles, drivers, orders)', () => {
    render(<DeveloperDangerZoneCard />);
    fireEvent.click(screen.getByRole('button', { name: /Bulk Import Sample CSVs/i }));

    expect(screen.getByText(/Bulk Import Sample CSV Datasets/i)).toBeInTheDocument();
    expect(screen.getByText(/vehicles\.csv/i)).toBeInTheDocument();
    expect(screen.getByText(/drivers\.csv/i)).toBeInTheDocument();
    expect(screen.getByText(/orders\.csv/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Bulk Import/i })).toBeInTheDocument();
  });

  it('Test 7: Clicking Confirm Bulk Import calls AdminApi.bulkImportSampleCsvs and notifies user with counts', async () => {
    vi.mocked(AdminApi.bulkImportSampleCsvs).mockResolvedValueOnce({
      success: true,
      message: 'Imported',
      data: {
        vehiclesCount: 20,
        driversCount: 20,
        deliveriesCount: 50,
        totalImported: 90,
      },
    });

    const onPurgedMock = vi.fn();
    render(<DeveloperDangerZoneCard onPurged={onPurgedMock} />);

    // Open import modal
    fireEvent.click(screen.getByRole('button', { name: /Bulk Import Sample CSVs/i }));

    // Confirm import
    const confirmBtn = screen.getByRole('button', { name: /Confirm Bulk Import/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(AdminApi.bulkImportSampleCsvs).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      'Successfully imported sample datasets (20 vehicles, 20 drivers, 50 orders)'
    );
    expect(onPurgedMock).toHaveBeenCalled();
  });
});
