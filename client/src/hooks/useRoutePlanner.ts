import { useState, useEffect, useCallback } from 'react';
import { DeliveryBatch, Vehicle, Driver, Delivery } from '../types';
import { RouteStop, OptimizationResult } from '../types/route';
import { BatchesApi, FleetApi } from '../api/client';

export const useRoutePlanner = (initialBatchId?: string) => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
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

        // Auto-select first batch if none specified
        if (!selectedBatchId && batchList.length > 0) {
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

        // Pre-select vehicle if allocated
        if (batch?.vehicleIds && batch.vehicleIds.length > 0) {
          const firstVeh = batch.vehicleIds[0];
          const vId = typeof firstVeh === 'string' ? firstVeh : firstVeh.id;
          setSelectedVehicleId(vId);
        } else if (vehicles.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(vehicles[0].id);
        }

        // Initialize stops from batch deliveries if currentStops is empty
        if (batch?.deliveryIds && Array.isArray(batch.deliveryIds) && batch.deliveryIds.length > 0) {
          const firstDelivery = batch.deliveryIds[0];
          if (typeof firstDelivery === 'object' && firstDelivery !== null && 'location' in firstDelivery) {
            const rawDeliveries = batch.deliveryIds as Delivery[];
            const mappedStops: RouteStop[] = rawDeliveries.map((del, idx) => ({
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
            setCurrentStops(mappedStops);
          }
        }
      } catch (err) {
        console.error('Failed to load batch:', err);
      }
    };
    fetchBatchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedBatchId, vehicles]);

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
  const applyOptimizationResult = useCallback((optResult: OptimizationResult) => {
    if (optResult?.optimized?.stops) {
      setCurrentStops(optResult.optimized.stops);
    }
  }, []);

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
    isComparisonDrawerOpen,
    setIsComparisonDrawerOpen,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    isDispatched,
    setIsDispatched,
    isLoading,
  };

};
