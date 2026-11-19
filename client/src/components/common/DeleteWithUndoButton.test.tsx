import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteWithUndoButton } from './DeleteWithUndoButton';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('DeleteWithUndoButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial delete state correctly', () => {
    const onDelete = vi.fn();
    render(<DeleteWithUndoButton onDelete={onDelete} buttonLabel="Delete Batch" />);

    expect(screen.getByRole('button', { name: /delete batch/i })).toBeInTheDocument();
  });

  it('enters pending undo state with 3s timer on click', async () => {
    const onDelete = vi.fn();
    render(<DeleteWithUndoButton onDelete={onDelete} buttonLabel="Delete Item" countdownSeconds={3} />);

    const deleteBtn = screen.getByRole('button', { name: /delete item/i });
    act(() => {
      deleteBtn.click();
    });

    // Should immediately display Undo with 3s
    expect(screen.getByRole('button', { name: /undo delete/i })).toHaveTextContent(/Undo \(3s\)/i);

    // Advance 1s -> 2s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /undo delete/i })).toHaveTextContent(/Undo \(2s\)/i);

    // Advance 1s -> 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /undo delete/i })).toHaveTextContent(/Undo \(1s\)/i);
  });

  it('cancels deletion when Undo is clicked within the 3s timer', async () => {
    const onDelete = vi.fn();
    const onUndo = vi.fn();
    render(
      <DeleteWithUndoButton
        onDelete={onDelete}
        onUndo={onUndo}
        buttonLabel="Delete Consignment"
        countdownSeconds={3}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete consignment/i });
    act(() => {
      deleteBtn.click();
    });

    // Fast-forward 1.5 seconds
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const undoBtn = screen.getByRole('button', { name: /undo delete/i });
    act(() => {
      undoBtn.click();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);

    // Fast-forward remaining time past original 3s
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // onDelete should NEVER have been called
    expect(onDelete).not.toHaveBeenCalled();

    // Reverted back to initial Delete state
    expect(screen.getByRole('button', { name: /delete consignment/i })).toBeInTheDocument();
  });

  it('executes onDelete when the 3s timer elapses without undo', async () => {
    const onDelete = vi.fn();
    render(<DeleteWithUndoButton onDelete={onDelete} buttonLabel="Delete User" countdownSeconds={3} />);

    const deleteBtn = screen.getByRole('button', { name: /delete user/i });
    act(() => {
      deleteBtn.click();
    });

    // Fast-forward full 3000ms
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
