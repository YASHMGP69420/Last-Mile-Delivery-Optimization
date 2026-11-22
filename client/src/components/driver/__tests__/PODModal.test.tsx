import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PODModal } from '../PODModal';

describe('PODModal (Refined Hallmark Standards: Camera & OTP without Signature)', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Camera/Photo and Customer OTP tabs, and does NOT render Signature tab or canvas', () => {
    render(
      <PODModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        deliveryId="del-123"
        customerPhone="9876543210"
        orderReference="ORD-101"
        recipientName="Rajesh Panda"
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/#ORD-101/i)).toBeInTheDocument();
    expect(screen.getByText(/Rajesh Panda/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /camera/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /otp/i })).toBeInTheDocument();

    // Verify signature is completely absent
    expect(screen.queryByRole('tab', { name: /signature/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('signature-canvas')).not.toBeInTheDocument();
  });

  it('allows capturing photo and submitting POD', () => {
    render(
      <PODModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        deliveryId="del-123"
      />
    );

    const submitBtn = screen.getByTestId('pod-submit');
    expect(submitBtn).toBeDisabled();

    // Click Capture Photo
    const captureBtn = screen.getByRole('button', { name: /capture photo/i });
    fireEvent.click(captureBtn);

    // After capture, submit button should be enabled
    expect(submitBtn).toBeEnabled();

    // Submit POD
    fireEvent.click(submitBtn);
    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        photo: expect.stringContaining('data:image/jpeg'),
      })
    );
  });

  it('allows OTP verification with 1-click dev quick fill', () => {
    render(
      <PODModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        deliveryId="del-123"
      />
    );

    // Switch to OTP tab
    const otpTab = screen.getByRole('tab', { name: /otp/i });
    fireEvent.click(otpTab);

    // Click Quick fill (123456)
    const quickFillBtn = screen.getByRole('button', { name: /quick fill/i });
    fireEvent.click(quickFillBtn);

    expect(screen.getByText(/Verified/i)).toBeInTheDocument();

    const submitBtn = screen.getByTestId('pod-submit');
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        otp: '123456',
        otpVerified: true,
      })
    );
  });

  it('allows clicking quick handover note chips and completing delivery', () => {
    render(
      <PODModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        deliveryId="del-123"
      />
    );

    // Click a quick note chip
    const chipBtn = screen.getByRole('button', { name: /\+ Handed directly to recipient/i });
    fireEvent.click(chipBtn);

    const notesInput = screen.getByTestId('pod-notes') as HTMLTextAreaElement;
    expect(notesInput.value).toBe('Handed directly to recipient');

    const submitBtn = screen.getByTestId('pod-submit');
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Handed directly to recipient',
      })
    );
  });
});
