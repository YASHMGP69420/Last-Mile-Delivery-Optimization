import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { DriverSocketProvider, useDriverSocketContext } from '../DriverSocketContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'driver-123', role: 'DRIVER', name: 'Test Driver' },
  })),
}));

vi.mock('../../api/client', () => ({
  DriverHudApi: {
    getDashboard: vi.fn().mockResolvedValue({ data: {} }),
    getNotifications: vi.fn().mockResolvedValue({ data: { notifications: [] } }),
    markNotificationRead: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../utils/socketClient', () => ({
  mountRealtimeSocket: vi.fn(() => () => {}),
}));

const TestConsumer: React.FC = () => {
  const { refreshKey, triggerRefresh } = useDriverSocketContext();
  return (
    <div>
      <span data-testid="refresh-key">{refreshKey}</span>
      <button data-testid="trigger-btn" onClick={triggerRefresh}>
        Trigger
      </button>
    </div>
  );
};

describe('DriverSocketContextDebounce (D-RELOAD-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('collapses rapid burst of triggerRefresh calls within 300ms into exactly one refreshKey increment', () => {
    render(
      <DriverSocketProvider>
        <TestConsumer />
      </DriverSocketProvider>
    );

    const keyElement = screen.getByTestId('refresh-key');
    const button = screen.getByTestId('trigger-btn');

    expect(keyElement.textContent).toBe('0');

    // Fire 5 triggers rapidly within 100ms
    act(() => {
      fireEvent.click(button); // t = 0ms
    });
    act(() => {
      vi.advanceTimersByTime(20);
      fireEvent.click(button); // t = 20ms
    });
    act(() => {
      vi.advanceTimersByTime(20);
      fireEvent.click(button); // t = 40ms
    });
    act(() => {
      vi.advanceTimersByTime(20);
      fireEvent.click(button); // t = 60ms
    });
    act(() => {
      vi.advanceTimersByTime(20);
      fireEvent.click(button); // t = 80ms
    });

    // At 200ms after last trigger (t = 280ms), debounce timer should not have resolved yet
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(keyElement.textContent).toBe('0');

    // At 300ms after the last trigger (advance by remaining 100ms -> t = 380ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(keyElement.textContent).toBe('1');

    // Further passage of time should NOT increment refreshKey again
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(keyElement.textContent).toBe('1');
  });

  it('allows subsequent debounced refresh cycles after the first cycle completes', () => {
    render(
      <DriverSocketProvider>
        <TestConsumer />
      </DriverSocketProvider>
    );

    const keyElement = screen.getByTestId('refresh-key');
    const button = screen.getByTestId('trigger-btn');

    expect(keyElement.textContent).toBe('0');

    // First cycle
    act(() => {
      fireEvent.click(button);
      vi.advanceTimersByTime(300);
    });
    expect(keyElement.textContent).toBe('1');

    // Second cycle
    act(() => {
      fireEvent.click(button);
      vi.advanceTimersByTime(300);
    });
    expect(keyElement.textContent).toBe('2');
  });

  it('cleans up active debounce timer on unmount without errors', () => {
    const { unmount } = render(
      <DriverSocketProvider>
        <TestConsumer />
      </DriverSocketProvider>
    );

    const button = screen.getByTestId('trigger-btn');
    act(() => {
      fireEvent.click(button);
    });

    // Unmount before 300ms passes
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();
  });
});
