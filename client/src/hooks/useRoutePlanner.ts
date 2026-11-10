import { useState, useEffect, useCallback } from 'react';
import { DeliveryBatch, Vehicle, Driver, Delivery } from '../types';
import { RouteStop } from '../types/route';
import { BatchesApi, FleetApi } from '../api/client';
import { RoutesApi } from '../api/routeApi';

export const useRoutePlanner = (initialBatchId?: string) => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => initialBatchId || new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('batchId') || '');
  const [selectedBatch, setSelectedBatch] = useState<DeliveryBatch | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

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

        // Detect if this batch already has a live DISPATCHED / IN_PROGRESS route
        let detectedActiveRouteId: string | null = null;
        try {
          const routesRes = await RoutesApi.list({ batchId: selectedBatchId });
          if (isMounted) {
            const existingRoutes = routesRes.data?.routes || [];
            const liveRoute = existingRoutes.find((r: any) =>
              ['DISPATCHED', 'IN_PROGRESS'].includes(String(r.status || '').toUpperCase())
            );
            if (liveRoute) {
              detectedActiveRouteId = liveRoute.id || (liveRoute as any)._id || null;
            }
          }
        } catch {
          // Non-fatal
        }
        if (!isMounted) return;
        setActiveRouteId(detectedActiveRouteId);
        setIsDispatched(
          Boolean(detectedActiveRouteId) ||
            ['PLANNED', 'IN_PROGRESS', 'CLOSED'].includes(batch?.status || '')
        );

        // Pre-select vehicle if allocated, otherwise pick an available vehicle that fits the batch payload
        let initialVehId = '';
        if (batch?.vehicleIds && batch.vehicleIds.length > 0) {
          const firstVeh = batch.vehicleIds[0];
          initialVehId = typeof firstVeh === 'string' ? firstVeh : firstVeh.id || (firstVeh as any)._id;
        } else if (vehicles.length > 0) {
          const batchWeightKg = Array.isArray(batch?.deliveryIds)
            ? batch.deliveryIds.reduce(
                (sum: number, d: any) => sum + (typeof d === 'object' ? Number(d?.weightKg || 0) : 0),
                0
              )
            : 0;
          const eligibleVehicles = vehicles.filter(
            (v) => v.availability !== 'MAINTENANCE' && v.availability !== 'RETIRED'
          );
          const pool = eligibleVehicles.length > 0 ? eligibleVehicles : vehicles;
          const fitting = pool
            .filter((v) => (v.capacityKg || 0) >= batchWeightKg)
            .sort((a, b) => (a.capacityKg || 0) - (b.capacityKg || 0));
          const fallbackLargest = [...pool].sort((a, b) => (b.capacityKg || 0) - (a.capacityKg || 0));
          const chosen = fitting[0] || fallbackLargest[0];
          initialVehId = chosen.id || (chosen as any)._id;
        }
        setSelectedVehicleId(initialVehId);

        // Pre-select driver if allocated to batch
        if (batch?.driverIds && batch.driverIds.length > 0) {
          const firstDrv = batch.driverIds[0];
          const dId = typeof firstDrv === 'string' ? firstDrv : firstDrv.id || (firstDrv as any)._id;
          const foundDriver = drivers.find((d) => d.id === dId || (d as any)._id === dId);
          if (foundDriver) {
            setAssignedDriver(foundDriver);
          } else if (typeof firstDrv === 'object' && firstDrv !== null) {
            setAssignedDriver(firstDrv as Driver);
          }
        } else if (initialVehId) {
          // If no batch driver, check if selected vehicle has a default assigned driver
          const v = vehicles.find((x) => x.id === initialVehId || x.vehicleId === initialVehId || (x as any)._id === initialVehId);
          if (v && v.assignedDriverId) {
            const foundDriver = typeof v.assignedDriverId === 'object'
              ? (v.assignedDriverId as Driver)
              : drivers.find((d) => d.id === v.assignedDriverId || (d as any)._id === v.assignedDriverId);
            setAssignedDriver(foundDriver || null);
          } else {
            setAssignedDriver(null);
          }
        } else {
          setAssignedDriver(null);
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
  }, [selectedBatchId, vehicles, drivers, mapDeliveriesToStops]);

  // Resequence stops manually
  const reorderStops = useCallback((startIndex: number, endIndex: number) => {
    setCurrentStops((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((item, idx) => ({ ...item, sequenceOrder: idx + 1 }));
    });
  }, []);

  // Apply Optimization Result stops to workspace (preserves all routes' stops across multi-vehicle bins)
  const applyOptimizationResult = useCallback((optResult: any) => {
    const multiRoutes = Array.isArray(optResult?.routes) && optResult.routes.length > 1 ? optResult.routes : null;
    const rawStops = multiRoutes
      ? multiRoutes.flatMap((r: any) => (Array.isArray(r?.stops) ? r.stops : []))
      : optResult?.optimized?.stops || (optResult?.routes && optResult.routes[0]?.stops);
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
          sequenceOrder: multiRoutes ? idx + 1 : s.sequenceOrder ?? s.sequence ?? idx + 1,
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

  // User explicitly selects vehicle -> updates local state without duplicate background network calls
  const updateSelectedVehicle = useCallback((vehId: string) => {
    setSelectedVehicleId(vehId);
    if (vehId) {
      const v = vehicles.find((x) => x.id === vehId || x.vehicleId === vehId || (x as any)._id === vehId);
      if (v && v.assignedDriverId) {
        const foundDriver = typeof v.assignedDriverId === 'object'
          ? (v.assignedDriverId as Driver)
          : drivers.find((d) => d.id === v.assignedDriverId || (d as any)._id === v.assignedDriverId);
        if (foundDriver) {
          setAssignedDriver(foundDriver);
        }
      }
    }
  }, [vehicles, drivers]);

  // User explicitly selects driver -> updates local state without duplicate background network calls
  const updateAssignedDriver = useCallback((driver: Driver | null) => {
    setAssignedDriver(driver);
  }, []);

  return {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    updateSelectedVehicle,
    drivers,
    assignedDriver,
    setAssignedDriver,
    updateAssignedDriver,
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
    activeRouteId,
    isLoading,
  };

};
