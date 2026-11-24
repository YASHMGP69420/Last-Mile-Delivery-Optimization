// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CurrentRouteCard } from '../CurrentRouteCard';
import { BaselineEvaluationResult } from '../../../types/route';

describe('RoutePlannerSkeleton — Reserved Skeleton Geometry (PERF-CLS-01)', () => {
  const mockBaseline: BaselineEvaluationResult = {
    stops: [],
    metrics: {
      totalDistanceKm: 42.5,
      drivingTimeMin: 95,
      serviceDurationMin: 60,
      totalDurationMin: 155,
      departureTime: '09:00',
      estimatedArrival: '11:35',
      fuelConsumed: 2.8,
      fuelUnit: 'L',
      costInr: 266.0,
      co2Kg: 9.7,
      stopsCount: 6,
      totalPayloadKg: 120,
      startingLocation: { name: 'Depot A', address: 'Rasulgarh, Bhubaneswar', lat: 20.2961, lng: 85.8245 },
      endingLocation: { name: 'Depot A', address: 'Rasulgarh, Bhubaneswar', lat: 20.2961, lng: 85.8245 },
      isElectric: false,
    },
    polylineCoords: [[85.8245, 20.2961]],
  };

  it('renders a stationary skeleton section with min-h-[290px] and animate-pulse when baseline and optResult are null (unloaded)', () => {
    const { container } = render(
      <CurrentRouteCard baseline={null} optResult={null} isLoading={false} />
    );

    // Must NOT return null / empty container
    const placeholder = screen.getByLabelText('Current Route Loading Placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.tagName.toLowerCase()).toBe('section');
    expect(placeholder.className).toContain('min-h-[290px]');
    expect(placeholder.className).toContain('animate-pulse');

    // Preserves 4-cell metric placeholder structure matching the live card box model
    const metricHolders = container.querySelectorAll('.h-20');
    expect(metricHolders.length).toBe(4);
  });

  it('renders the stationary skeleton section while evaluating baseline (isLoading: true, baseline: null)', () => {
    const { container } = render(
      <CurrentRouteCard baseline={null} optResult={null} isLoading={true} />
    );

    const placeholder = screen.getByLabelText('Current Route Loading Placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.className).toContain('min-h-[290px]');
    expect(placeholder.className).toContain('animate-pulse');

    const metricHolders = container.querySelectorAll('.h-20');
    expect(metricHolders.length).toBe(4);
  });

  it('replaces the stationary skeleton with active route card once baseline resolves', () => {
    const { rerender } = render(
      <CurrentRouteCard baseline={null} optResult={null} isLoading={true} />
    );

    expect(screen.getByLabelText('Current Route Loading Placeholder')).toBeInTheDocument();

    rerender(
      <CurrentRouteCard baseline={mockBaseline} optResult={null} isLoading={false} />
    );

    expect(screen.queryByLabelText('Current Route Loading Placeholder')).not.toBeInTheDocument();
    expect(screen.getByText(/Current Route — Before Optimization/i)).toBeInTheDocument();
    expect(screen.getByText('42.5 km')).toBeInTheDocument();
  });
});
