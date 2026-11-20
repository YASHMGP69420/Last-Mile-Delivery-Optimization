import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraController, CameraFocusTarget } from '../CameraController';

const mockFlyTo = vi.fn();
const mockPanTo = vi.fn();
const mockSetView = vi.fn();
const mockStop = vi.fn();
const eventHandlers: Record<string, () => void> = {};
const mockOn = vi.fn((event: string, handler: () => void) => {
  eventHandlers[event] = handler;
});
const mockOff = vi.fn((event: string) => {
  delete eventHandlers[event];
});

const mockMap = {
  flyTo: mockFlyTo,
  panTo: mockPanTo,
  setView: mockSetView,
  stop: mockStop,
  on: mockOn,
  off: mockOff,
};

vi.mock('react-leaflet', () => ({
  useMap: () => mockMap,
}));

describe('CameraController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k]);
  });

  it('attaches dragstart and zoomstart listeners on mount and removes them on unmount', () => {
    const onUserPan = vi.fn();
    const { unmount } = render(
      <CameraController
        focusTarget={null}
        autoFollow={false}
        followCoordinates={null}
        onUserPan={onUserPan}
      />
    );

    expect(mockOn).toHaveBeenCalledWith('dragstart', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('zoomstart', expect.any(Function));

    unmount();
    expect(mockOff).toHaveBeenCalledWith('dragstart', expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith('zoomstart', expect.any(Function));
    expect(mockStop).toHaveBeenCalled();
  });

  it('calls onUserPan when dragstart or zoomstart fires', () => {
    const onUserPan = vi.fn();
    render(
      <CameraController
        focusTarget={null}
        autoFollow={true}
        followCoordinates={[20.2961, 85.8245]}
        onUserPan={onUserPan}
      />
    );

    expect(eventHandlers['dragstart']).toBeDefined();
    eventHandlers['dragstart']();
    expect(onUserPan).toHaveBeenCalledTimes(1);

    expect(eventHandlers['zoomstart']).toBeDefined();
    eventHandlers['zoomstart']();
    expect(onUserPan).toHaveBeenCalledTimes(2);
  });

  it('invokes map.flyTo with target coordinates and zoom level 16 when focusTarget is provided', () => {
    const onUserPan = vi.fn();
    const focusTarget: CameraFocusTarget = {
      coordinates: [20.2961, 85.8245],
      timestamp: Date.now(),
      zoom: 16,
    };

    render(
      <CameraController
        focusTarget={focusTarget}
        autoFollow={false}
        followCoordinates={null}
        onUserPan={onUserPan}
      />
    );

    expect(mockFlyTo).toHaveBeenCalledWith([20.2961, 85.8245], 16, {
      animate: true,
      duration: 1.2,
    });
  });

  it('falls back to map.setView if map.flyTo throws an error', () => {
    mockFlyTo.mockImplementationOnce(() => {
      throw new Error('Animation error');
    });

    const onUserPan = vi.fn();
    const focusTarget: CameraFocusTarget = {
      coordinates: [20.2961, 85.8245],
      timestamp: Date.now(),
      zoom: 16,
    };

    render(
      <CameraController
        focusTarget={focusTarget}
        autoFollow={false}
        followCoordinates={null}
        onUserPan={onUserPan}
      />
    );

    expect(mockFlyTo).toHaveBeenCalled();
    expect(mockSetView).toHaveBeenCalledWith([20.2961, 85.8245], 16);
  });

  it('streams map.panTo when autoFollow is true and new coordinates arrive', () => {
    const onUserPan = vi.fn();
    const { rerender } = render(
      <CameraController
        focusTarget={null}
        autoFollow={true}
        followCoordinates={[20.2961, 85.8245]}
        onUserPan={onUserPan}
      />
    );

    expect(mockPanTo).toHaveBeenCalledWith([20.2961, 85.8245], {
      animate: true,
      duration: 0.8,
    });

    // Re-rendering with same coordinates should deduplicate
    rerender(
      <CameraController
        focusTarget={null}
        autoFollow={true}
        followCoordinates={[20.2961, 85.8245]}
        onUserPan={onUserPan}
      />
    );
    expect(mockPanTo).toHaveBeenCalledTimes(1);

    // Re-rendering with new coordinates calls panTo again
    rerender(
      <CameraController
        focusTarget={null}
        autoFollow={true}
        followCoordinates={[20.2975, 85.826]}
        onUserPan={onUserPan}
      />
    );
    expect(mockPanTo).toHaveBeenCalledWith([20.2975, 85.826], {
      animate: true,
      duration: 0.8,
    });
    expect(mockPanTo).toHaveBeenCalledTimes(2);
  });

  it('does not invoke panTo if autoFollow is false', () => {
    const onUserPan = vi.fn();
    render(
      <CameraController
        focusTarget={null}
        autoFollow={false}
        followCoordinates={[20.2961, 85.8245]}
        onUserPan={onUserPan}
      />
    );

    expect(mockPanTo).not.toHaveBeenCalled();
  });

  it('safely ignores NaN or invalid coordinates mitigating T-22-02 DoS', () => {
    const onUserPan = vi.fn();
    const focusTarget: CameraFocusTarget = {
      coordinates: [NaN, 85.8245],
      timestamp: Date.now(),
    };

    render(
      <CameraController
        focusTarget={focusTarget}
        autoFollow={true}
        followCoordinates={[20.2961, NaN]}
        onUserPan={onUserPan}
      />
    );

    expect(mockFlyTo).not.toHaveBeenCalled();
    expect(mockPanTo).not.toHaveBeenCalled();
  });
});
