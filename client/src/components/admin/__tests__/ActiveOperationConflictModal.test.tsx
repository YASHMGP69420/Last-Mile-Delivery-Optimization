import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ActiveOperationConflictModal,
  ActiveOperationConflictDetails,
} from '../ActiveOperationConflictModal';

describe('ActiveOperationConflictModal', () => {
  const defaultConflict: ActiveOperationConflictDetails = {
    routeId: 'route-123',
    routeCode: 'RT-2026-0042',
    activeDeliveryCount: 5,
    driverName: 'John Doe',
  };

  it('renders active route code, driver name, and active delivery count from conflict details per D-01', () => {
    render(
      <ActiveOperationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflict={defaultConflict}
        onConfirmReassignAndDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/Cannot delete driver with active in-transit operations/i)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('RT-2026-0042')).toBeInTheDocument();
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/active deliveries/i).length).toBeGreaterThan(0);
  });

  it('renders explanatory warning text outlining that uncompleted orders will be rescued to READY with Urgent priority, completed POD preserved, and vehicle locks released per D-01, D-02, D-03', () => {
    render(
      <ActiveOperationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflict={defaultConflict}
        onConfirmReassignAndDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/rescued to READY pool/i)).toBeInTheDocument();
    expect(screen.getByText(/Urgent priority/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed POD signatures and audit trails preserved/i)).toBeInTheDocument();
    expect(screen.getByText(/Vehicle reservation released/i)).toBeInTheDocument();
  });

  it('calls onClose callback when clicking Cancel', async () => {
    const handleClose = vi.fn();
    render(
      <ActiveOperationConflictModal
        isOpen={true}
        onClose={handleClose}
        conflict={defaultConflict}
        onConfirmReassignAndDelete={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirmReassignAndDelete and displays loading state during submission per D-01', async () => {
    const handleConfirm = vi.fn().mockImplementation(() => Promise.resolve());
    const { rerender } = render(
      <ActiveOperationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflict={defaultConflict}
        onConfirmReassignAndDelete={handleConfirm}
        isSubmitting={false}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /Reassign Active Orders & Delete/i,
    });
    expect(confirmButton).not.toBeDisabled();

    await userEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    // Rerender with isSubmitting = true
    rerender(
      <ActiveOperationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflict={defaultConflict}
        onConfirmReassignAndDelete={handleConfirm}
        isSubmitting={true}
      />
    );

    const submittingButton = screen.getByRole('button', {
      name: /Rescuing Orders & Deleting.../i,
    });
    expect(submittingButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });
});
