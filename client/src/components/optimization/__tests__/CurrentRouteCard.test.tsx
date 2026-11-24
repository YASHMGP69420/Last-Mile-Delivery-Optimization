// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CurrentRouteCard } from '../CurrentRouteCard';
import { BaselineEvaluationResult, OptimizationResult } from '../../../types/route';

describe('CurrentRouteCard Component', () => {
  const mockBaseline: BaselineEvaluationResult = {
    stops: [],
    metrics: {
      totalDistanceKm: 67.52,
      drivingTimeMin: 162,
      serviceDurationMin: 100,
      totalDurationMin: 262,
      departureTime: '09:00',
      estimatedArrival: '13:22',
      fuelConsumed: 4.09,
      fuelUnit: 'L',
      costInr: 388.78,
      co2Kg: 14.18,
      stopsCount: 10,
      totalPayloadKg: 200,
      startingLocation: { name: 'Central Depot', address: 'Rasulgarh, Bhubaneswar', lat: 20.2961, lng: 85.8245 },
      endingLocation: { name: 'Central Depot', address: 'Rasulgarh, Bhubaneswar', lat: 20.2961, lng: 85.8245 },
      isElectric: false,
    },
    polylineCoords: [[85.8245, 20.2961]],
  };

  const mockOptResult: OptimizationResult = {
    batchId: 'batch-123',
    vehicleId: 'veh-123',
    vehicleAssignments: [],
    routes: [],
    baseline: {
      stops: [],
      metrics: {
        totalDistanceKm: 67.52,
        drivingTimeMin: 162,
        serviceDurationMin: 100,
        totalDurationMin: 262,
        costInr: 388.78,
        fuelConsumed: 4.09,
        fuelUnit: 'L',
        co2Kg: 14.18,
        stopsCount: 10,
        totalPayloadKg: 200,
        payloadUtilizationPercent: 50,
        onTimeCertaintyPercent: 98,
      },
    },
    optimized: {
      stops: [],
      metrics: {
        totalDistanceKm: 45.04,
        drivingTimeMin: 108,
        serviceDurationMin: 100,
        totalDurationMin: 208,
        costInr: 259.33,
        fuelConsumed: 2.73,
        fuelUnit: 'L',
        co2Kg: 9.46,
        stopsCount: 10,
        totalPayloadKg: 200,
        payloadUtilizationPercent: 50,
        onTimeCertaintyPercent: 99,
      },
    },
    deltas: {
      distanceSavedKm: 22.48,
      percentDistanceReduction: 33.3,
      timeSavedMin: 54,
      percentTimeReduction: 20.6,
      costSavedInr: 129.45,
      percentCostReduction: 33.3,
      fuelSaved: 1.36,
      percentFuelReduction: 33.25,
      fuelUnit: 'L',
      co2AvoidedKg: 4.72,
      isImproved: true,
      message: 'Optimization improved route.',
    },
    unassignedDeliveries: [],
    executionTimeMs: 45,
    iterationsCount: 100,
    converged: true,
  };

  it('renders live baseline metrics when route is not yet optimized', () => {
    render(<CurrentRouteCard baseline={mockBaseline} optResult={null} />);

    expect(screen.getByText(/Current Route — Before Optimization/i)).toBeInTheDocument();
    expect(screen.getByText('67.5 km')).toBeInTheDocument();
    expect(screen.getByText('162 min')).toBeInTheDocument();
    expect(screen.getByText(/Total Est: 4h 22m/i)).toBeInTheDocument();
  });

  it('displays accurate comparison table using optResult.baseline and optResult.optimized without degradation glitches', () => {
    // Simulate post-optimization state where the outer baseline prop might have been updated to the new stops
    const updatedBaselineProp: BaselineEvaluationResult = {
      ...mockBaseline,
      metrics: {
        ...mockBaseline.metrics,
        totalDistanceKm: 45.04,
        drivingTimeMin: 108,
        totalDurationMin: 208,
      },
    };

    render(<CurrentRouteCard baseline={updatedBaselineProp} optResult={mockOptResult} />);

    // Verify comparison section exists
    expect(screen.getByText(/Performance Comparison: Current Route vs Optimized Route/i)).toBeInTheDocument();

    // Verify Baseline vs Optimized Distance
    expect(screen.getByText('67.52 km')).toBeInTheDocument();
    expect(screen.getByText('45.04 km')).toBeInTheDocument();
    expect(screen.getByText(/-22.48 km \(33.3%\)/i)).toBeInTheDocument();

    // Verify Driving Time uses pure driving time (108 min), not total duration (208 min)
    expect(screen.getByText('108 min')).toBeInTheDocument();
    expect(screen.getAllByText(/-54 min/i).length).toBeGreaterThanOrEqual(1);

    // Verify Operating Cost savings format
    expect(screen.getByText('₹388.78')).toBeInTheDocument();
    expect(screen.getByText('₹259.33')).toBeInTheDocument();
    expect(screen.getByText(/₹129.45 saved \(33.3%\)/i)).toBeInTheDocument();
  });
});
