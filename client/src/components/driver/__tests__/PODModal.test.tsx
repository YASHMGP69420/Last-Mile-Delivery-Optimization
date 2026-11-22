import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PODModal } from '../PODModal';

describe('PODModal (Camera & OTP without Signature, Dev Mode)', () => {
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
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /camera/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /otp/i })).toBeInTheDocument();

    // Verify signature is completely absent
    expect(screen.queryByRole('tab', { name: /signature/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('signature-canvas')).not.toBeInTheDocument();
  });

  it('allows completing delivery when photo is captured', () => {
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

    // Click Capture Photo (fallback canvas generates in mock environment)
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

  it('allows OTP auto-verify with dev code (123456) without security friction', () => {
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

    // Click Auto-Verify (123456)
    const autoVerifyBtn = screen.getByRole('button', { name: /auto-verify/i });
    fireEvent.click(autoVerifyBtn);

    expect(screen.getByText(/OTP Verified Successfully/i)).toBeInTheDocument();

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

  it('allows completing with delivery notes when skipping OTP in dev mode', () => {
    render(
      <PODModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        deliveryId="del-123"
      />
    );

    const notesInput = screen.getByTestId('pod-notes');
    fireEvent.change(notesInput, { target: { value: 'Left with security guard' } });

    const submitBtn = screen.getByTestId('pod-submit');
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Left with security guard',
      })
    );
  });
});
