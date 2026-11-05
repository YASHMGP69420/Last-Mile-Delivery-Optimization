import { useState, useEffect, useCallback } from 'react';
import { DeliveryBatch, Vehicle, Driver, Delivery } from '../types';
import { RouteStop, OptimizationResult } from '../types/route';
import { BatchesApi, FleetApi } from '../api/client';

export const useRoutePlanner = (initialBatchId?: string) => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => initialBatchId || new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('batchId') || '');
  const [selectedBatch, setSelectedBatch] = useState<DeliveryBatch | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);

  const [currentStops, setCurrentStops] = useState<RouteStop[]>([]);
  const [isComparisonDrawerOpen, setIsComparisonDrawerOpen] = useState<boolean>(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const mapDeliveriesToStops = useCallback((deliveryIds: any[]): RouteStop[] => {
    if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) return [];
    const first = deliveryIds[0];
    if (typeof first !== 'object' || first === null || !('location' in first)) return [];
    return (deliveryIds as Delivery[]).map((del, idx) => ({
      sequenceOrder: idx + 1,
      deliveryId: del.id,
      orderReference: del.orderReference,
      recipientName: del.customer?.name,
      recipientPhone: del.customer?.phone,
      streetAddress: del.address?.street,
      zone: del.address?.zone,
      coordinates: del.location?.coordinates || [85.8245, 20.2961],
      priority: del.priority,
      timeWindow: del.timeWindow,
      weightKg: del.weightKg || 1,
      volumeM3: del.volumeM3,
      distanceFromPreviousKm: 0,
      durationFromPreviousMin: 0,
    }));
  }, []);

  // Auto-select first batch when batches load
  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [batchRes, fleetRes, driverRes] = await Promise.all([
          BatchesApi.list(),
          FleetApi.getVehicles(),
          FleetApi.getDrivers(),
        ]);

        if (!isMounted) return;

        const batchList = batchRes.data?.batches || [];
        const vehicleList = fleetRes.data?.vehicles || [];
        const driverList = driverRes.data?.drivers || [];

        setBatches(batchList);
        setVehicles(vehicleList);
        setDrivers(driverList);

        // Auto-select batch from query param if available, otherwise first batch
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const queryBatchId = urlParams.get('batchId');
        if (queryBatchId && batchList.some((b: DeliveryBatch) => b.id === queryBatchId)) {
          setSelectedBatchId(queryBatchId);
        } else if (!selectedBatchId && batchList.length > 0) {
          setSelectedBatchId(batchList[0].id);
        }
      } catch (err) {
        console.error('Failed to load route planner prerequisites:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Sync Selected Batch & Vehicle
  useEffect(() => {
    if (!selectedBatchId) return;
    let isMounted = true;

    const fetchBatchDetails = async () => {
      try {
        const res = await BatchesApi.getById(selectedBatchId);
        if (!isMounted) return;

        const batch = res.data?.batch;
        setSelectedBatch(batch);
        setIsDispatched(['PLANNED', 'IN_PROGRESS', 'CLOSED'].includes(batch?.status || ''));

        // Pre-select vehicle if allocated
        if (batch?.vehicleIds && batch.vehicleIds.length > 0) {
          const firstVeh = batch.vehicleIds[0];
          const vId = typeof firstVeh === 'string' ? firstVeh : firstVeh.id;
          setSelectedVehicleId(vId);
        } else if (vehicles.length > 0) {
          setSelectedVehicleId((prev) => prev || vehicles[0].id);
        }

        // Initialize stops from batch deliveries
        if (batch?.deliveryIds && Array.isArray(batch.deliveryIds) && batch.deliveryIds.length > 0) {
          setCurrentStops(mapDeliveriesToStops(batch.deliveryIds));
        } else {
          setCurrentStops([]);
        }
      } catch (err) {
        console.error('Failed to load batch:', err);
      }
    };
    fetchBatchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedBatchId, vehicles, mapDeliveriesToStops]);

  // 3. Sync Driver when Vehicle is Selected
  useEffect(() => {
    if (!selectedVehicleId) {
      setAssignedDriver(null);
      return;
    }
    const v = vehicles.find((x) => x.id === selectedVehicleId || x.vehicleId === selectedVehicleId);
    if (v && v.assignedDriverId) {
      if (typeof v.assignedDriverId === 'object') {
        setAssignedDriver(v.assignedDriverId as Driver);
      } else {
        const foundDriver = drivers.find((d) => d.id === v.assignedDriverId);
        setAssignedDriver(foundDriver || null);
      }
    } else if (drivers.length > 0) {
      setAssignedDriver(drivers[0]);
    } else {
      setAssignedDriver(null);
    }
  }, [selectedVehicleId, vehicles, drivers]);

  // Resequence stops manually
  const reorderStops = useCallback((startIndex: number, endIndex: number) => {
    setCurrentStops((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((item, idx) => ({ ...item, sequenceOrder: idx + 1 }));
    });
  }, []);

  // Apply Optimization Result stops to workspace
  const applyOptimizationResult = useCallback((optResult: any) => {
    const rawStops = optResult?.optimized?.stops || (optResult?.routes && optResult.routes[0]?.stops);
    if (Array.isArray(rawStops) && rawStops.length > 0) {
      const normalizedStops: RouteStop[] = rawStops.map((s: any, idx: number) => {
        let coords: [number, number] = [85.8245, 20.2961];
        if (Array.isArray(s.coordinates) && s.coordinates.length >= 2) {
          coords = [Number(s.coordinates[0]), Number(s.coordinates[1])];
        } else if (s.location && typeof s.location.lng === 'number' && typeof s.location.lat === 'number') {
          coords = [s.location.lng, s.location.lat];
        } else if (Array.isArray(s.location?.coordinates) && s.location.coordinates.length >= 2) {
          coords = [Number(s.location.coordinates[0]), Number(s.location.coordinates[1])];
        }

        return {
          sequenceOrder: s.sequenceOrder ?? s.sequence ?? idx + 1,
          deliveryId: s.deliveryId ?? s._id ?? s.id,
          orderReference: s.orderReference ?? '',
          recipientName: s.recipientName ?? s.customer?.name ?? 'Customer',
          recipientPhone: s.recipientPhone ?? s.customer?.phone ?? '',
          streetAddress: s.streetAddress ?? s.address?.street ?? '',
          zone: s.zone ?? s.address?.zone ?? '',
          coordinates: coords,
          priority: s.priority ?? 'Standard',
          timeWindow: s.timeWindow,
          weightKg: s.weightKg ?? 1,
          volumeM3: s.volumeM3,
          estimatedArrival: s.estimatedArrival ?? s.eta ?? '',
          distanceFromPreviousKm: s.distanceFromPreviousKm ?? s.distanceFromPrevKm ?? 0,
          durationFromPreviousMin: s.durationFromPreviousMin ?? s.durationFromPrevMin ?? 0,
        };
      });
      setCurrentStops(normalizedStops);
    }
  }, []);

  // Reset stops back to initial un-optimized batch deliveries
  const resetBatchStops = useCallback(() => {
    if (!selectedBatch || !selectedBatch.deliveryIds) {
      setCurrentStops([]);
      return;
    }
    setCurrentStops(mapDeliveriesToStops(selectedBatch.deliveryIds));
  }, [selectedBatch, mapDeliveriesToStops]);

  return {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    drivers,
    assignedDriver,
    setAssignedDriver,
    currentStops,
    setCurrentStops,
    reorderStops,
    applyOptimizationResult,
    resetBatchStops,
    isComparisonDrawerOpen,
    setIsComparisonDrawerOpen,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    isDispatched,
    setIsDispatched,
    isLoading,
  };

};
