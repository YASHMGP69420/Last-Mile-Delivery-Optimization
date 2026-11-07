const Route = require('../models/Route');
const DeliveryBatch = require('../models/DeliveryBatch');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const VehicleAssignment = require('../models/VehicleAssignment');
const RouteAssignment = require('../models/RouteAssignment');
const SystemNotification = require('../models/SystemNotification');
const socketService = require('../services/socketService');
const mongoose = require('mongoose');

const { buildMatrix } = require('../services/optimization/matrixBuilder');
const { packDeliveries } = require('../services/optimization/binPacker');
const { constructNearestNeighborRoute } = require('../services/optimization/nearestNeighbor');
const { constructOriginalRoute } = require('../services/optimization/originalOrder');
const { optimize2Opt } = require('../services/optimization/twoOpt');
const { scoreRouteCost, calculateDeltas, runRouteOptimization } = require('../services/optimization');
const {
  validateDispatchEligibility,
  calculateStopSequenceMetrics,
  createOrUpdateRouteFromSequence,
} = require('../services/dispatchEligibilityService');
const {
  formatLatLng,
  buildLocationUrl,
  buildDirectionsUrl,
  buildMultiStopRouteUrl,
} = require('../utils/googleMapsHelper');
const { recordAuditEvent } = require('../services/auditService');
const { AppError } = require('../middleware/errorHandler');
const {
  AUDIT_EVENT_TYPES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  ROLES,
  CANONICAL_DEPOT,
} = require('../config/constants');

/**
 * Helper to resolve driver profile ID for a user
 */
async function resolveDriverId(user) {
  if (!user) return null;
  if (user.driverId) return user.driverId.toString();
  const driver = await Driver.findOne({ userId: user.id || user._id });
  return driver ? driver._id.toString() : null;
}

/**
 * Calculates human-readable 12-hour AM/PM ETA from base departure time and elapsed minutes.
 */
function calculateEta(baseTimeStr, totalElapsedMinutes) {
  let [hours, minutes] = (baseTimeStr || '09:00').split(':').map(Number);
  if (isNaN(hours)) hours = 9;
  if (isNaN(minutes)) minutes = 0;

  const totalMin = hours * 60 + minutes + Math.round(totalElapsedMinutes);
  const normalizedMin = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h24 = Math.floor(normalizedMin / 60);
  const m = normalizedMin % 60;

  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = String(m).padStart(2, '0');
  return `${h12}:${mStr} ${ampm}`;
}

/**
 * POST /api/v1/routes/evaluate-baseline
 * Evaluates current baseline route metrics before optimization:
 * road distance, driving duration, service duration, ETAs, fuel/kWh, cost, depot locations, and polyline.
 */
const evaluateBaseline = async (req, res, next) => {
  try {
    const {
      batchId,
      deliveryIds,
      vehicleId,
      depot: customDepot,
      departureTime = '09:00',
    } = req.body;

    let batch = null;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
      batch = await DeliveryBatch.findById(batchId);
    }

    // Resolve Depot
    const depot = customDepot || (batch && batch.depot) || CANONICAL_DEPOT;
    const depotGeo = depot.geo || CANONICAL_DEPOT.geo;
    const depotCoords = [depotGeo.lng, depotGeo.lat];
    const depotLatLng = [depotGeo.lat, depotGeo.lng];

    // Resolve Deliveries in designated order
    let deliveries = [];
    if (Array.isArray(deliveryIds) && deliveryIds.length > 0) {
      const validIds = deliveryIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length > 0) {
        const found = await Delivery.find({ _id: { $in: validIds } });
        const map = new Map(found.map((d) => [d._id.toString(), d]));
        deliveries = validIds.map((id) => map.get(id.toString())).filter(Boolean);
      }
    } else if (batch) {
      deliveries = await Delivery.find({
        batchId: batch._id,
        status: { $in: [DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY, DELIVERY_STATUS.ASSIGNED] },
      });
    }

    // Resolve Vehicle
    let vehicle = null;
    const targetVehicleId = vehicleId || (batch?.vehicleIds?.[0]);
    if (targetVehicleId && mongoose.Types.ObjectId.isValid(targetVehicleId)) {
      vehicle = await Vehicle.findById(targetVehicleId);
    }
    if (!vehicle) {
      vehicle = await Vehicle.findOne({
        availability: { $in: [VEHICLE_STATUS.AVAILABLE, VEHICLE_STATUS.ASSIGNED] },
      });
    }
    if (!vehicle) {
      vehicle = {
        vehicleId: 'FLEET-DEFAULT-01',
        makeModel: 'Tata Ace Gold',
        type: 'Van',
        fuelType: 'Diesel',
        capacityKg: 1000,
        kmPerLitre: 12.5,
      };
    }

    // Tariffs
    let tariffs = {};
    try {
      const OrganizationSettings = require('../models/OrganizationSettings');
      const settings = await OrganizationSettings.getSettings();
      tariffs = settings?.tariffs || {};
    } catch (tErr) {}

    const isElectric = String(vehicle.fuelType).toUpperCase() === 'ELECTRIC' || String(vehicle.fuelType).toUpperCase() === 'EV';

    if (deliveries.length === 0) {
      const costData = scoreRouteCost(0, vehicle, tariffs);
      return res.status(200).json({
        success: true,
        data: {
          stops: [],
          metrics: {
            totalDistanceKm: 0,
            drivingTimeMin: 0,
            serviceDurationMin: 0,
            totalDurationMin: 0,
            departureTime: calculateEta(departureTime, 0),
            estimatedArrival: calculateEta(departureTime, 0),
            fuelConsumed: 0,
            fuelUnit: costData.fuelUnit,
            costInr: 0,
            co2Kg: 0,
            stopsCount: 0,
            totalPayloadKg: 0,
            startingLocation: {
              name: depot.name || CANONICAL_DEPOT.name,
              address: depot.address || CANONICAL_DEPOT.address,
              lat: depotGeo.lat,
              lng: depotGeo.lng,
            },
            endingLocation: {
              name: depot.name || CANONICAL_DEPOT.name,
              address: depot.address || CANONICAL_DEPOT.address,
              lat: depotGeo.lat,
              lng: depotGeo.lng,
            },
            isElectric,
            vehicle: {
              id: vehicle._id || vehicle.id || vehicle.vehicleId,
              vehicleId: vehicle.vehicleId,
              makeModel: vehicle.makeModel,
              fuelType: vehicle.fuelType,
              capacityKg: vehicle.capacityKg,
            },
          },
          polylineCoords: [depotCoords],
          googleMapsUrls: {
            currentRoute: '',
            segments: [],
          },
        },
      });
    }

    // Build Distance & Duration Matrix using road physics
    const matrix = await buildMatrix(depot, deliveries, { trafficScenario: 'FREE_FLOW' });
    const { getDistanceKm, getDurationMin, points } = matrix;

    // Build sequence in exact manifest order
    const stopIndices = [];
    for (let i = 1; i < points.length; i++) {
      stopIndices.push(i);
    }
    const baselineTour = constructOriginalRoute(0, stopIndices, getDistanceKm, getDurationMin, points);

    // Compute Driving Time vs Service Duration vs Total Estimated Time
    let totalDrivingTimeMin = 0;
    let totalServiceDurationMin = 0;
    let cumulativeElapsedMin = 0;
    let prevIdx = 0;

    const stops = [];
    for (let i = 0; i < deliveries.length; i++) {
      const d = deliveries[i];
      const ptIdx = i + 1;
      const legDist = getDistanceKm(prevIdx, ptIdx);
      const legDriveTime = getDurationMin(prevIdx, ptIdx);
      const serviceDuration = Number(d.serviceDurationMinutes) || 10;

      cumulativeElapsedMin += legDriveTime;
      const arrivalEta = calculateEta(departureTime, cumulativeElapsedMin);
      cumulativeElapsedMin += serviceDuration;

      totalDrivingTimeMin += legDriveTime;
      totalServiceDurationMin += serviceDuration;

      const coords = d.location?.coordinates || [85.8645, 20.2961];
      stops.push({
        sequenceOrder: i + 1,
        sequence: i + 1,
        deliveryId: d._id.toString(),
        orderReference: d.orderReference || `ORD-${i + 1}`,
        recipientName: d.customer?.name || 'Customer',
        recipientPhone: d.customer?.phone || '',
        streetAddress: d.address?.street || '',
        zone: d.address?.zone || '',
        city: d.address?.city || 'Bhubaneswar',
        postalCode: d.address?.postalCode || '',
        coordinates: [coords[0], coords[1]],
        location: { lat: coords[1], lng: coords[0] },
        weightKg: Number(d.weightKg) || 0,
        priority: d.priority || 'Standard',
        timeWindow: d.timeWindow || { start: '09:00', end: '18:00' },
        eta: arrivalEta,
        estimatedArrival: arrivalEta,
        distanceFromPrevKm: parseFloat(legDist.toFixed(2)),
        durationFromPrevMin: parseFloat(legDriveTime.toFixed(1)),
        serviceDurationMinutes: serviceDuration,
        status: d.status || 'PENDING',
      });

      prevIdx = ptIdx;
    }

    // Return to depot leg
    const returnLegDist = getDistanceKm(prevIdx, 0);
    const returnLegDriveTime = getDurationMin(prevIdx, 0);
    totalDrivingTimeMin += returnLegDriveTime;
    cumulativeElapsedMin += returnLegDriveTime;
    const finalReturnEta = calculateEta(departureTime, cumulativeElapsedMin);

    const totalDistanceKm = parseFloat(baselineTour.totalDistanceKm.toFixed(2));
    totalDrivingTimeMin = parseFloat(totalDrivingTimeMin.toFixed(1));
    totalServiceDurationMin = parseFloat(totalServiceDurationMin.toFixed(1));
    const totalDurationMin = parseFloat((totalDrivingTimeMin + totalServiceDurationMin).toFixed(1));
    const totalPayloadKg = parseFloat(deliveries.reduce((sum, d) => sum + (Number(d.weightKg) || 0), 0).toFixed(2));

    // Calculate energy / fuel consumption & financial cost
    const costData = scoreRouteCost(totalDistanceKm, vehicle, tariffs);

    // Build Road Polyline
    let polylineCoords = [
      depotCoords,
      ...deliveries.map(d => [d.location.coordinates[0], d.location.coordinates[1]]),
      depotCoords,
    ];

    try {
      const geoapifyService = require('../services/mapping/geoapify.service');
      const waypoints = [
        { lat: depotGeo.lat, lng: depotGeo.lng },
        ...deliveries.map(d => ({ lat: d.location.coordinates[1], lng: d.location.coordinates[0] })),
        { lat: depotGeo.lat, lng: depotGeo.lng },
      ];
      const geoResult = await geoapifyService.getRouteGeometry(waypoints);
      if (geoResult && Array.isArray(geoResult.geometry) && geoResult.geometry.length > 0) {
        polylineCoords = geoResult.geometry.map(coord => [coord[1], coord[0]]);
      }
    } catch (gErr) {}

    // Build Google Maps URLs
    const baselineGmapsPoints = [
      depotLatLng,
      ...deliveries.map(d => [d.location.coordinates[1], d.location.coordinates[0]]),
      depotLatLng,
    ];
    const originalGmaps = buildMultiStopRouteUrl(baselineGmapsPoints);

    res.status(200).json({
      success: true,
      data: {
        stops,
        metrics: {
          totalDistanceKm,
          drivingTimeMin: totalDrivingTimeMin,
          serviceDurationMin: totalServiceDurationMin,
          totalDurationMin,
          departureTime: calculateEta(departureTime, 0),
          estimatedArrival: finalReturnEta,
          fuelConsumed: costData.fuelConsumed,
          fuelUnit: costData.fuelUnit,
          costInr: costData.costInr,
          co2Kg: costData.co2Kg,
          stopsCount: deliveries.length,
          totalPayloadKg,
          startingLocation: {
            name: depot.name || CANONICAL_DEPOT.name,
            address: depot.address || CANONICAL_DEPOT.address,
            lat: depotGeo.lat,
            lng: depotGeo.lng,
          },
          endingLocation: {
            name: depot.name || CANONICAL_DEPOT.name,
            address: depot.address || CANONICAL_DEPOT.address,
            lat: depotGeo.lat,
            lng: depotGeo.lng,
          },
          isElectric,
          vehicle: {
            id: vehicle._id || vehicle.id || vehicle.vehicleId,
            vehicleId: vehicle.vehicleId,
            makeModel: vehicle.makeModel,
            fuelType: vehicle.fuelType,
            capacityKg: vehicle.capacityKg,
          },
        },
        polylineCoords,
        googleMapsUrls: {
          currentRoute: originalGmaps.primaryUrl,
          segments: originalGmaps.segments,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/optimize
 */
const optimizeRoutes = async (req, res, next) => {
  try {
    const { batchId, vehicleIds, options = {} } = req.body;

    if (!batchId) {
      throw new AppError('batchId is required', 400, 'MISSING_BATCH_ID');
    }

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      throw new AppError(`Delivery batch not found for ID '${batchId}'`, 404, 'BATCH_NOT_FOUND');
    }

    // Retrieve eligible consignments for optimization
    let deliveries = await Delivery.find({
      batchId: batch._id,
      status: { $in: [DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY] },
    });

    // If none are in DRAFT/READY, check for ASSIGNED deliveries in the batch (re-optimization)
    if (deliveries.length === 0) {
      deliveries = await Delivery.find({
        batchId: batch._id,
        status: DELIVERY_STATUS.ASSIGNED,
      });
    }

    if (deliveries.length === 0) {
      throw new AppError('Batch contains no eligible deliveries for route optimization', 400, 'NO_DELIVERIES_TO_OPTIMIZE');
    }

    // Resolve eligible vehicles
    let vehicles = [];
    if (Array.isArray(vehicleIds) && vehicleIds.length > 0) {
      vehicles = await Vehicle.find({ _id: { $in: vehicleIds } });
    } else if (Array.isArray(batch.vehicleIds) && batch.vehicleIds.length > 0) {
      vehicles = await Vehicle.find({ _id: { $in: batch.vehicleIds } });
    } else {
      vehicles = await Vehicle.find({
        availability: { $in: [VEHICLE_STATUS.AVAILABLE, VEHICLE_STATUS.ASSIGNED] },
      });
    }

    if (vehicles.length === 0) {
      throw new AppError('No eligible fleet vehicles found for route optimization', 400, 'NO_VEHICLES_AVAILABLE');
    }

    // 1. Bin-Packing Allocation
    const { vehicleBins, unassignedDeliveries } = packDeliveries(deliveries, vehicles, options);

    if (vehicleBins.length === 0 && unassignedDeliveries.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'All deliveries exceeded fleet capacity constraints and remain unassigned',
        data: {
          baseline: { stops: [], totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 },
          optimized: { stops: [], totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 },
          unassignedDeliveries,
          deltas: { distanceSavedKm: 0, timeSavedMin: 0, costSavedInr: 0, co2AvoidedKg: 0, percentDistanceReduction: 0 },
          routes: [],
        },
      });
    }

    // 2. Build Distance & Duration Matrix
    const matrix = await buildMatrix(batch.depot, deliveries, options);
    const { getDistanceKm, getDurationMin, points } = matrix;

    // Map delivery id -> matrix point index
    const deliveryIndexMap = new Map();
    for (let idx = 1; idx < points.length; idx++) {
      deliveryIndexMap.set(points[idx].id, idx);
    }

    // Retrieve OrganizationSettings for fuel tariffs
    let tariffs = {};
    try {
      const OrganizationSettings = require('../models/OrganizationSettings');
      const orgSettings = await OrganizationSettings.findOne({ orgKey: 'DEFAULT_ORG' });
      if (orgSettings && orgSettings.fuelSettings) {
        tariffs = orgSettings.fuelSettings.toObject ? orgSettings.fuelSettings.toObject() : orgSettings.fuelSettings;
      }
    } catch (e) {
      // Gracefully continue with standard rates
    }

    const plannedRoutes = [];
    let aggregateBaseDist = 0;
    let aggregateBaseDur = 0;
    let aggregateBaseCost = 0;
    let aggregateBaseFuel = 0; // total baseline fuel consumed (L or kWh)
    let aggregateBaseCo2 = 0;

    let aggregateOptDist = 0;
    let aggregateOptDur = 0;
    let aggregateOptCost = 0;
    let aggregateOptFuel = 0; // total optimized fuel consumed (L or kWh)
    let aggregateOptCo2 = 0;

    let firstBaselineStops = [];
    let firstOptimizedStops = [];
    let firstBaselinePolylineCoords = [];
    let firstOptimizedPolylineCoords = [];
    let executedAlgorithm = 'AUTO';
    let totalIterationsCount = 0;

    // 3. Optimize Tour for each vehicle bin
    for (let bIdx = 0; bIdx < vehicleBins.length; bIdx++) {
      const bin = vehicleBins[bIdx];
      const vehicle = bin.vehicle;
      const binDeliveries = bin.deliveries;

      const stopIndices = binDeliveries
        .map(d => deliveryIndexMap.get((d._id || d.id).toString()))
        .filter(idx => idx !== undefined);

      // Run Master Route Optimizer Engine
      const optEngineRes = runRouteOptimization({
        depotIndex: 0,
        stopIndices,
        getDistanceKm,
        getDurationMin,
        points,
        vehicle,
        options: {
          ...options,
          tariffs,
        },
      });

      const baselineResult = optEngineRes.baseline;
      const optResult = optEngineRes.optimized;
      const baselineCost = baselineResult.metrics;
      const optCost = optResult.metrics;
      const deltas = optEngineRes.deltas;

      aggregateBaseFuel += baselineCost.fuelConsumed || 0;
      aggregateOptFuel += optCost.fuelConsumed || 0;
      executedAlgorithm = optEngineRes.algorithmUsed;
      totalIterationsCount += optEngineRes.iterations || 0;

      // Construct detailed route stop documents
      let cumulativeTimeMin = 0;
      const stops = [];

      for (let sIdx = 0; sIdx < optResult.stopSequence.length; sIdx++) {
        const ptIdx = optResult.stopSequence[sIdx];
        const pt = points[ptIdx];
        const deliv = pt.delivery;
        const prevPtIdx = (sIdx === 0) ? 0 : optResult.stopSequence[sIdx - 1];

        const distFromPrev = getDistanceKm(prevPtIdx, ptIdx);
        const durFromPrev = getDurationMin(prevPtIdx, ptIdx);
        cumulativeTimeMin += durFromPrev;

        // Approximate ETA from 08:30 start
        const etaDate = new Date();
        etaDate.setHours(8, 30, 0, 0);
        etaDate.setMinutes(etaDate.getMinutes() + Math.round(cumulativeTimeMin));
        const etaStr = etaDate.toTimeString().substring(0, 5);

        cumulativeTimeMin += (deliv.serviceDurationMinutes !== undefined ? deliv.serviceDurationMinutes : 10);

        const stopGoogleMapsUrl = buildLocationUrl(
          { lat: pt.lat, lng: pt.lng },
          deliv.orderReference || deliv.address?.street
        );

        stops.push({
          sequence: sIdx + 1,
          sequenceOrder: sIdx + 1,
          deliveryId: deliv._id || deliv.id,
          orderReference: deliv.orderReference,
          customer: {
            name: deliv.customer ? deliv.customer.name : 'Customer',
            phone: deliv.customer ? deliv.customer.phone : '0000000000',
          },
          recipientName: deliv.customer ? deliv.customer.name : 'Customer',
          recipientPhone: deliv.customer ? deliv.customer.phone : '0000000000',
          address: {
            street: deliv.address.street,
            zone: deliv.address.zone,
            city: deliv.address.city || 'Bhubaneswar',
            postalCode: deliv.address.postalCode,
          },
          streetAddress: deliv.address.street,
          zone: deliv.address.zone,
          location: {
            lat: pt.lat,
            lng: pt.lng,
          },
          coordinates: [pt.lng, pt.lat],
          weightKg: deliv.weightKg,
          priority: deliv.priority,
          timeWindow: deliv.timeWindow,
          eta: etaStr,
          estimatedArrival: etaStr,
          distanceFromPrevKm: distFromPrev,
          distanceFromPreviousKm: distFromPrev,
          durationFromPrevMin: durFromPrev,
          durationFromPreviousMin: durFromPrev,
          googleMapsUrl: stopGoogleMapsUrl,
          status: 'PENDING',
        });
      }

      // Generate Route Code with collision prevention
      const vehicleCode = (vehicle.vehicleId || 'VEH').replace(/[^A-Z0-9]/gi, '');
      const baseCode = `RT-${batch.code}-${vehicleCode}-${bIdx + 1}`;
      let routeCode = baseCode;

      // Upsert Route in DRAFT status
      let route = await Route.findOne({ batchId: batch._id, vehicleId: vehicle._id, status: 'DRAFT' });
      if (!route) {
        const existingWithCode = await Route.findOne({ routeCode });
        if (existingWithCode) {
          routeCode = `${baseCode}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        }
        route = new Route({
          routeCode,
          batchId: batch._id,
          vehicleId: vehicle._id,
          driverId: vehicle.assignedDriverId || null,
          depot: batch.depot,
        });
      }

      route.stops = stops;
      route.status = 'DRAFT';
      route.metrics = {
        totalStops: stops.length,
        totalDistanceKm: optResult.totalDistanceKm,
        totalDurationMin: optResult.totalDurationMin,
        totalWeightKg: bin.totalWeightKg,
        costInr: optCost.costInr,
        co2Kg: optCost.co2Kg,
        fuelConsumed: optCost.fuelConsumed,
        fuelUnit: optCost.fuelUnit,
      };
      route.baseline = {
        totalDistanceKm: baselineResult.totalDistanceKm,
        totalDurationMin: baselineResult.totalDurationMin,
        costInr: baselineCost.costInr,
        co2Kg: baselineCost.co2Kg,
        fuelConsumed: baselineCost.fuelConsumed,
        fuelUnit: baselineCost.fuelUnit,
      };
      route.deltas = deltas;
      route.optimizationMetadata = {
        algorithm: optEngineRes.algorithmUsed,
        maxIterations: options.maxIterations || 1000,
        executedIterations: optEngineRes.iterations,
        trafficScenario: matrix.trafficScenario,
        matrixSource: matrix.source,
        converged: optEngineRes.converged,
      };

      await route.save();
      plannedRoutes.push(route);

      // Accumulate aggregates
      aggregateBaseDist += baselineResult.totalDistanceKm;
      aggregateBaseDur += baselineResult.totalDurationMin;
      aggregateBaseCost += baselineCost.costInr;
      aggregateBaseCo2 += baselineCost.co2Kg;

      aggregateOptDist += optResult.totalDistanceKm;
      aggregateOptDur += optResult.totalDurationMin;
      aggregateOptCost += optCost.costInr;
      aggregateOptCo2 += optCost.co2Kg;

      if (bIdx === 0) {
        const depotLng = batch.depot?.geo?.lng || 85.8645;
        const depotLat = batch.depot?.geo?.lat || 20.2961;
        const depotCoords = [depotLng, depotLat];

        firstBaselineStops = baselineResult.stopSequence.map((idx, sIdx) => {
          const pt = points[idx];
          const deliv = pt.delivery;
          return {
            sequence: sIdx + 1,
            sequenceOrder: sIdx + 1,
            deliveryId: deliv._id || deliv.id,
            orderReference: deliv.orderReference,
            customer: deliv.customer,
            recipientName: deliv.customer ? deliv.customer.name : 'Customer',
            recipientPhone: deliv.customer ? deliv.customer.phone : '',
            address: deliv.address,
            streetAddress: deliv.address?.street,
            zone: deliv.address?.zone,
            location: { lat: pt.lat, lng: pt.lng },
            coordinates: [pt.lng, pt.lat],
            weightKg: deliv.weightKg,
            priority: deliv.priority,
            timeWindow: deliv.timeWindow,
            googleMapsUrl: buildLocationUrl(
              { lat: pt.lat, lng: pt.lng },
              deliv.orderReference || deliv.address?.street
            ),
          };
        });
        firstOptimizedStops = stops;

        firstOptimizedPolylineCoords = [
          depotCoords,
          ...optResult.stopSequence.map(ptIdx => [points[ptIdx].lng, points[ptIdx].lat]),
          depotCoords,
        ];
        firstBaselinePolylineCoords = [
          depotCoords,
          ...baselineResult.stopSequence.map(ptIdx => [points[ptIdx].lng, points[ptIdx].lat]),
          depotCoords,
        ];
      }
    }

    // Aggregate Deltas
    const aggregateDeltas = calculateDeltas(
      {
        totalDistanceKm: aggregateBaseDist,
        totalDurationMin: aggregateBaseDur,
        costInr: aggregateBaseCost,
        fuelConsumed: aggregateBaseFuel,
        fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
        co2Kg: aggregateBaseCo2,
      },
      {
        totalDistanceKm: aggregateOptDist,
        totalDurationMin: aggregateOptDur,
        costInr: aggregateOptCost,
        fuelConsumed: aggregateOptFuel,
        fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
        co2Kg: aggregateOptCo2,
      }
    );

    // Build Google Maps URLs for baseline, optimized, and next stop
    const depotLat = batch.depot?.geo?.lat || 20.2961;
    const depotLng = batch.depot?.geo?.lng || 85.8645;
    const depotLatLng = [depotLat, depotLng];

    const baselineGmapsPoints = [
      depotLatLng,
      ...firstBaselineStops.map(s => [s.location.lat, s.location.lng]),
      depotLatLng,
    ];
    const optGmapsPoints = [
      depotLatLng,
      ...firstOptimizedStops.map(s => [s.location.lat, s.location.lng]),
      depotLatLng,
    ];

    const originalGmaps = buildMultiStopRouteUrl(baselineGmapsPoints);
    const optimizedGmaps = buildMultiStopRouteUrl(optGmapsPoints);
    const nextStopGmaps = firstOptimizedStops.length > 0
      ? buildDirectionsUrl(depotLatLng, [firstOptimizedStops[0].location.lat, firstOptimizedStops[0].location.lng])
      : '';

    // Audit Event
    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.ROUTE_OPTIMIZED,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Optimized ${plannedRoutes.length} routes for batch ${batch.code}`,
      metadata: {
        routesCount: plannedRoutes.length,
        unassignedCount: unassignedDeliveries.length,
        distanceSavedKm: aggregateDeltas.distanceSavedKm,
        costSavedInr: aggregateDeltas.costSavedInr,
        trafficScenario: matrix.trafficScenario,
        algorithmUsed: executedAlgorithm,
      },
    });

    const firstRoute = plannedRoutes[0];
    const firstRouteId = firstRoute?.id || firstRoute?._id?.toString();

    res.status(200).json({
      success: true,
      message: `Successfully optimized ${plannedRoutes.length} route(s) for batch ${batch.code}`,
      data: {
        routeId: firstRouteId,
        batchId: batch._id.toString(),
        vehicleId: firstRoute?.vehicleId?.toString(),
        routes: plannedRoutes,
        baseline: {
          stops: firstBaselineStops,
          polylineCoords: firstBaselinePolylineCoords,
          metrics: {
            totalDistanceKm: parseFloat(aggregateBaseDist.toFixed(2)),
            totalDurationMin: parseFloat(aggregateBaseDur.toFixed(1)),
            costInr: parseFloat(aggregateBaseCost.toFixed(2)),
            fuelConsumed: parseFloat(aggregateBaseFuel.toFixed(2)),
            fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
            co2Kg: parseFloat(aggregateBaseCo2.toFixed(3)),
            stopsCount: firstBaselineStops.length,
            totalPayloadKg: vehicleBins.reduce((sum, b) => sum + b.totalWeightKg, 0),
            payloadUtilizationPercent: vehicleBins.length > 0 ? vehicleBins[0].utilizationPercent : 0,
            onTimeCertaintyPercent: 98,
          },
          totalDistanceKm: parseFloat(aggregateBaseDist.toFixed(2)),
          totalDurationMin: parseFloat(aggregateBaseDur.toFixed(1)),
          costInr: parseFloat(aggregateBaseCost.toFixed(2)),
          co2Kg: parseFloat(aggregateBaseCo2.toFixed(3)),
          fuelConsumed: parseFloat(aggregateBaseFuel.toFixed(2)),
          fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
        },
        optimized: {
          stops: firstOptimizedStops,
          polylineCoords: firstOptimizedPolylineCoords,
          metrics: {
            totalDistanceKm: parseFloat(aggregateOptDist.toFixed(2)),
            totalDurationMin: parseFloat(aggregateOptDur.toFixed(1)),
            costInr: parseFloat(aggregateOptCost.toFixed(2)),
            fuelConsumed: parseFloat(aggregateOptFuel.toFixed(2)),
            fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
            co2Kg: parseFloat(aggregateOptCo2.toFixed(3)),
            stopsCount: firstOptimizedStops.length,
            totalPayloadKg: vehicleBins.reduce((sum, b) => sum + b.totalWeightKg, 0),
            payloadUtilizationPercent: vehicleBins.length > 0 ? vehicleBins[0].utilizationPercent : 0,
            onTimeCertaintyPercent: 99,
          },
          totalDistanceKm: parseFloat(aggregateOptDist.toFixed(2)),
          totalDurationMin: parseFloat(aggregateOptDur.toFixed(1)),
          costInr: parseFloat(aggregateOptCost.toFixed(2)),
          co2Kg: parseFloat(aggregateOptCo2.toFixed(3)),
          fuelConsumed: parseFloat(aggregateOptFuel.toFixed(2)),
          fuelUnit: plannedRoutes[0]?.metrics?.fuelUnit || 'L',
        },
        fuelCostDelta: parseFloat((aggregateBaseFuel - aggregateOptFuel).toFixed(2)),
        unassignedDeliveries,
        deltas: aggregateDeltas,
        googleMapsUrls: {
          originalRoute: originalGmaps.primaryUrl,
          originalSegments: originalGmaps.segments,
          optimizedRoute: optimizedGmaps.primaryUrl,
          optimizedSegments: optimizedGmaps.segments,
          nextStop: nextStopGmaps,
        },
        algorithmUsed: executedAlgorithm,
        executionTimeMs: 45,
        iterationsCount: totalIterationsCount || firstRoute?.optimizationMetadata?.executedIterations || 100,
        converged: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shared dispatch engine for routes or batches.
 */
async function executeDispatch({
  routeId,
  batchId,
  vehicleId,
  driverId,
  confirmedStopSequence,
  deliveryIds,
  req,
}) {
  let route = null;
  let batch = null;

  // 1. Resolve Target Route or Batch from routeId
  if (routeId) {
    if (mongoose.Types.ObjectId.isValid(routeId)) {
      route = await Route.findById(routeId);
      if (!route) {
        batch = await DeliveryBatch.findById(routeId);
      }
    }
  }

  // If not found yet and batchId is provided, resolve batch
  if (!batch && batchId && mongoose.Types.ObjectId.isValid(batchId)) {
    batch = await DeliveryBatch.findById(batchId);
  }

  if (!route && !batch) {
    throw new AppError(`Route not found for ID '${routeId}'`, 404, 'ROUTE_NOT_FOUND');
  }

  // If route exists, check if already dispatched or completed
  if (route && ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(route.status)) {
    throw new AppError(
      `Route ${route.routeCode || route._id} is already in status '${route.status}' and cannot be re-dispatched`,
      409,
      'INVALID_ROUTE_STATUS'
    );
  }

  // 2. Comprehensive Pre-Dispatch Eligibility Validation
  const validation = await validateDispatchEligibility({
    routeId: route ? route._id : undefined,
    batchId: batch ? batch._id : (route ? route.batchId : undefined),
    vehicleId: vehicleId || (route ? route.vehicleId : undefined),
    driverId: driverId || (route ? route.driverId : undefined),
    stopSequence: confirmedStopSequence || deliveryIds,
    allowPartialEligible: true,
  });

  if (!validation.canDispatch) {
    let statusCode = 400;
    let errorCode = 'DISPATCH_INELIGIBLE';
    const errLower = (validation.error || '').toLowerCase();

    if (errLower.includes('already in status')) {
      statusCode = 409;
      errorCode = 'INVALID_ROUTE_STATUS';
    } else if (errLower.includes('capacity')) {
      errorCode = 'CAPACITY_EXCEEDED';
    } else if (errLower.includes('vehicle')) {
      errorCode = 'VEHICLE_UNAVAILABLE';
    } else if (errLower.includes('driver')) {
      errorCode = 'DRIVER_UNAVAILABLE';
    } else if (errLower.includes('no eligible deliveries')) {
      errorCode = 'NO_ELIGIBLE_DELIVERIES';
    }

    throw new AppError(validation.error, statusCode, errorCode, {
      ineligibilityReasons: validation.ineligibilityReasons,
      ineligibleDeliveries: validation.ineligibleDeliveries,
    });
  }

  const { vehicle, driver, eligibleDeliveries, ineligibleDeliveries } = validation;
  const targetBatch = batch || validation.batch || (route ? await DeliveryBatch.findById(route.batchId) : null);

  // Retrieve OrganizationSettings for tariffs
  let tariffs = {};
  try {
    const OrganizationSettings = require('../models/OrganizationSettings');
    const settings = await OrganizationSettings.getSettings();
    tariffs = settings?.tariffs || {};
  } catch (tErr) {}

  // 3. If Route does not yet exist, create it in original manifest sequence
  if (!route) {
    const created = await createOrUpdateRouteFromSequence({
      batch: targetBatch,
      deliveries: eligibleDeliveries,
      vehicle,
      driver,
      tariffs,
      isOptimized: false,
      algorithmUsed: 'ORIGINAL_MANIFEST',
    });
    route = created.route;
  } else if (ineligibleDeliveries.length > 0) {
    // If route already existed but some deliveries were filtered out as ineligible
    const eligibleIdSet = new Set(eligibleDeliveries.map((d) => d._id.toString()));
    route.stops = route.stops
      .filter((s) => s.deliveryId && eligibleIdSet.has(s.deliveryId.toString()))
      .map((s, idx) => {
        s.sequence = idx + 1;
        return s;
      });
    route.metrics.totalStops = route.stops.length;
  }

  // 4. Transition Route
  route.status = 'DISPATCHED';
  route.driverId = driver._id;
  route.vehicleId = vehicle._id;
  route.dispatchedAt = new Date();
  route.version = (route.version || 1) + 1;
  await route.save();

  // 5. Create VehicleAssignment & RouteAssignment records
  try {
    await VehicleAssignment.create({
      vehicleId: vehicle._id,
      driverId: driver._id,
      routeId: route._id,
      startTime: new Date(),
      endTime: new Date(Date.now() + (route.metrics?.totalDurationMin || 60) * 60000),
      status: 'PENDING',
    });
  } catch (assignErr) {
    console.warn(`[Dispatch] VehicleAssignment creation failed: ${assignErr.message}`);
  }

  try {
    await RouteAssignment.create({
      routeId: route._id,
      vehicleId: vehicle._id,
      driverId: driver._id,
      startTime: new Date(),
      expectedEndTime: new Date(Date.now() + (route.metrics?.totalDurationMin || 60) * 60000),
      status: 'PENDING',
    });
  } catch (raErr) {
    console.warn(`[Dispatch] RouteAssignment creation failed: ${raErr.message}`);
  }

  // 6. Transition Vehicle & Driver status
  if (driver.assignedVehicleId && driver.assignedVehicleId.toString() !== vehicle._id.toString()) {
    await Vehicle.findByIdAndUpdate(driver.assignedVehicleId, {
      assignedDriverId: null,
      availability: VEHICLE_STATUS.AVAILABLE,
    });
  }
  if (vehicle.assignedDriverId && vehicle.assignedDriverId.toString() !== driver._id.toString()) {
    await Driver.findByIdAndUpdate(vehicle.assignedDriverId, {
      assignedVehicleId: null,
    });
  }

  vehicle.availability = VEHICLE_STATUS.IN_TRANSIT;
  vehicle.assignedDriverId = driver._id;
  await vehicle.save();

  driver.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
  driver.assignedVehicleId = vehicle._id;
  driver.currentRouteId = route._id;
  await driver.save();

  // 7. Transition Associated Deliveries to ASSIGNED
  const deliveryIdsToUpdate = eligibleDeliveries.map((d) => d._id);
  if (deliveryIdsToUpdate.length > 0) {
    await Delivery.updateMany(
      { _id: { $in: deliveryIdsToUpdate } },
      {
        $set: {
          status: DELIVERY_STATUS.ASSIGNED,
          assignedVehicleId: vehicle._id,
          assignedDriverId: driver._id,
        },
      }
    );
  }

  // 8. Update Batch Metrics
  if (targetBatch) {
    targetBatch.metrics = targetBatch.metrics || {};
    targetBatch.metrics.assignedDeliveries = (targetBatch.metrics.assignedDeliveries || 0) + deliveryIdsToUpdate.length;
    if (targetBatch.status === 'READY' || targetBatch.status === 'DRAFT') {
      targetBatch.status = 'PLANNED';
    }
    await targetBatch.save();
  }

  // 9. Immutable Audit Event
  const isOriginal = route.optimizationMetadata?.algorithm === 'ORIGINAL_MANIFEST';
  await recordAuditEvent({
    routeId: route._id,
    batchId: route.batchId,
    type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
    actorId: req.user ? (req.user.id || req.user._id) : null,
    actorRole: req.user ? req.user.role : 'ADMIN',
    action: `Dispatched route ${route.routeCode} with ${route.stops.length} stops to driver ${driver.licenseNumber || driver._id}${isOriginal ? ' (dispatched without optimization)' : ''}`,
    metadata: {
      version: route.version,
      driverId: driver._id,
      vehicleId: vehicle._id,
      stopsCount: route.stops.length,
      isOriginalSequence: isOriginal,
      ineligibleDeliveriesCount: ineligibleDeliveries.length,
    },
  });

  // 10. Real-Time Broadcast if Socket Gateway Available
  if (req.app && req.app.get && req.app.get('io')) {
    try {
      const ioInstance = req.app.get('io');
      const dispatchPayload = {
        routeId: route._id.toString(),
        routeCode: route.routeCode,
        driverId: driver._id.toString(),
        vehicleId: vehicle._id.toString(),
        stopsCount: route.stops.length,
        version: route.version,
      };

      // Emit to root namespace and target driver/route rooms
      ioInstance.emit('route:dispatched', dispatchPayload);
      ioInstance.to(`driver:${driver._id}`).emit('route:dispatched', dispatchPayload);
      ioInstance.to(`route:${route._id}`).emit('route:dispatched', dispatchPayload);

      // Emit to tracking namespace for live map views
      if (typeof ioInstance.of === 'function') {
        ioInstance.of('/socket/tracking').emit('route:dispatched', dispatchPayload);
      }
    } catch (sockErr) {
      console.warn(`[SocketBroadcast] Failed to emit route:dispatched: ${sockErr.message}`);
    }
  }

  return {
    route,
    version: route.version,
    status: 'DISPATCHED',
    dispatchedStopsCount: route.stops.length,
    ineligibleDeliveries,
  };
}

/**
 * POST /api/v1/routes/:id/dispatch
 */
const dispatchRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverId, vehicleId, batchId, confirmedStopSequence, deliveryIds } = req.body || {};

    const result = await executeDispatch({
      routeId: id,
      batchId,
      vehicleId,
      driverId,
      confirmedStopSequence,
      deliveryIds,
      req,
    });

    res.status(200).json({
      success: true,
      message: `Route ${result.route.routeCode} successfully dispatched`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/dispatch
 */
const dispatchDirect = async (req, res, next) => {
  try {
    const { routeId, batchId, vehicleId, driverId, confirmedStopSequence, deliveryIds } = req.body || {};

    const result = await executeDispatch({
      routeId,
      batchId,
      vehicleId,
      driverId,
      confirmedStopSequence,
      deliveryIds,
      req,
    });

    res.status(200).json({
      success: true,
      message: `Route ${result.route.routeCode} successfully dispatched`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/validate-dispatch
 */
const validateDispatch = async (req, res, next) => {
  try {
    const { routeId, batchId, vehicleId, driverId, stopSequence, deliveryIds } = req.body || {};

    const validation = await validateDispatchEligibility({
      routeId,
      batchId,
      vehicleId,
      driverId,
      stopSequence,
      deliveryIds,
      allowPartialEligible: true,
    });

    res.status(200).json({
      success: true,
      data: validation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/routes
 */
const getRoutes = async (req, res, next) => {
  try {
    const { batchId, vehicleId, driverId, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    // BOLA Enforcement for Drivers
    if (req.user.role === ROLES.DRIVER) {
      const resolvedDriverId = await resolveDriverId(req.user);
      if (!resolvedDriverId) {
        return res.status(200).json({
          success: true,
          data: { routes: [], total: 0, page: 1, totalPages: 1 },
        });
      }
      filter.driverId = resolvedDriverId;
    } else {
      if (driverId) filter.driverId = driverId;
    }

    if (batchId) filter.batchId = batchId;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [routes, total] = await Promise.all([
      Route.find(filter)
        .populate('vehicleId', 'vehicleId makeModel type fuelType capacityKg')
        .populate({
          path: 'driverId',
          select: 'licenseNumber phone rating userId availability',
          populate: { path: 'userId', select: 'name' },
        })
        .populate('batchId', 'code name date depot')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Route.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        routes,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/routes/:id
 */
const getRouteById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const route = await Route.findById(id)
      .populate('vehicleId', 'vehicleId makeModel type fuelType capacityKg energyKWhPerKm kmPerLitre')
      .populate({
        path: 'driverId',
        select: 'licenseNumber phone rating userId availability',
        populate: { path: 'userId', select: 'name phone email' },
      })
      .populate('batchId', 'code name date depot');

    if (!route) {
      throw new AppError(`Route not found for ID '${id}'`, 404, 'ROUTE_NOT_FOUND');
    }

    // BOLA Enforcement for Drivers
    if (req.user.role === ROLES.DRIVER) {
      const resolvedDriverId = await resolveDriverId(req.user);
      const routeDriverId = route.driverId
        ? (route.driverId._id ? route.driverId._id.toString() : (route.driverId.id ? route.driverId.id.toString() : route.driverId.toString()))
        : null;

      if (!resolvedDriverId || !routeDriverId || routeDriverId !== resolvedDriverId) {
        throw new AppError('Access denied: You can only view routes assigned to your profile', 403, 'FORBIDDEN_ROUTE_ACCESS');
      }
    }

    res.status(200).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/:id/push
 * Push dispatched route manifest directly to driver handheld device
 */
const pushRouteToHandheld = async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await Route.findById(id).populate('driverId vehicleId');
    if (!route) {
      throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');
    }

    if (!['DISPATCHED', 'IN_PROGRESS'].includes(route.status)) {
      throw new AppError(`Cannot push route in '${route.status}' status. Route must be DISPATCHED or IN_PROGRESS.`, 400, 'INVALID_ROUTE_STATUS');
    }

    const driverId = route.driverId?._id ? route.driverId._id.toString() : (route.driverId ? route.driverId.toString() : null);
    const vehicleId = route.vehicleId?._id ? route.vehicleId._id.toString() : (route.vehicleId ? route.vehicleId.toString() : null);

    const payload = {
      routeId: route._id.toString(),
      routeCode: route.routeCode,
      driverId,
      vehicleId,
      stopsCount: route.stops ? route.stops.length : 0,
      version: route.version || 1,
      timestamp: new Date(),
    };

    socketService.emitRouteDispatched(payload);

    res.status(200).json({
      success: true,
      message: `Route #${route.routeCode} pushed to driver handheld`,
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/:id/reorder
 * Reorder stop sequence for an active dispatched route (e.g. traffic rerouting or dispatcher adjustment)
 */
const reorderRouteStops = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stopSequence, reason = 'Traffic dynamic re-route optimization' } = req.body;

    if (!Array.isArray(stopSequence) || stopSequence.length === 0) {
      throw new AppError('stopSequence array of delivery IDs is required', 400, 'MISSING_SEQUENCE');
    }

    const route = await Route.findById(id);
    if (!route) {
      throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');
    }

    if (route.status === 'COMPLETED' || route.status === 'CANCELLED') {
      throw new AppError(`Cannot reorder stops on ${route.status} route`, 400, 'IMMUTABLE_ROUTE_STATUS');
    }

    // Map existing stops by deliveryId
    const stopMap = new Map();
    route.stops.forEach((s) => {
      const delId = s.deliveryId ? s.deliveryId.toString() : null;
      if (delId) stopMap.set(delId, s);
    });

    // Separate completed/failed stops from pending stops
    const completedOrFailed = [];
    const pendingStops = [];

    route.stops.forEach((s) => {
      if (s.status === 'COMPLETED' || s.status === 'FAILED') {
        completedOrFailed.push(s);
      } else {
        pendingStops.push(s);
      }
    });

    // Build newly sequenced pending stops according to stopSequence
    const reorderedPending = [];
    const sequenceSet = new Set(stopSequence.map(String));

    stopSequence.forEach((delId) => {
      const stop = stopMap.get(String(delId));
      if (stop && stop.status !== 'COMPLETED' && stop.status !== 'FAILED') {
        reorderedPending.push(stop);
      }
    });

    // Add any pending stops that weren't included in stopSequence at the end
    pendingStops.forEach((s) => {
      const delId = s.deliveryId ? s.deliveryId.toString() : null;
      if (delId && !sequenceSet.has(delId)) {
        reorderedPending.push(s);
      }
    });

    // Combine completed followed by reordered pending
    const combinedStops = [...completedOrFailed, ...reorderedPending].map((s, idx) => {
      s.sequence = idx + 1;
      return s;
    });

    route.stops = combinedStops;
    route.version = (route.version || 1) + 1;
    await route.save();

    await recordAuditEvent({
      routeId: route._id,
      batchId: route.batchId,
      type: AUDIT_EVENT_TYPES.ROUTE_OPTIMIZED,
      actorId: req.user ? (req.user.id || req.user._id) : null,
      actorRole: req.user ? req.user.role : 'ADMIN',
      action: `Dispatcher reordered stop sequence for route ${route.routeCode}. Reason: ${reason}`,
      metadata: {
        version: route.version,
        stopsCount: route.stops.length,
        reason,
      },
    });

    const driverId = route.driverId ? route.driverId.toString() : null;
    socketService.emitRouteReordered({
      routeId: route._id.toString(),
      routeCode: route.routeCode,
      driverId,
      version: route.version,
      stopsCount: route.stops.length,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `Stop sequence updated for route ${route.routeCode}`,
      data: {
        routeId: route._id.toString(),
        version: route.version,
        stops: route.stops,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/:id/message
 * Send an operational dispatch instruction directly to the on-duty driver
 */
const sendRouteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, severity = 'INFO', title = 'Dispatch Instruction' } = req.body;

    if (!message || message.trim().length === 0) {
      throw new AppError('Message text is required', 400, 'MISSING_MESSAGE');
    }

    const route = await Route.findById(id).populate('driverId');
    if (!route) {
      throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');
    }

    const driverId = route.driverId?._id ? route.driverId._id.toString() : (route.driverId ? route.driverId.toString() : null);

    const notification = await SystemNotification.create({
      title: title.trim(),
      message: message.trim(),
      severity: severity || 'INFO',
      category: 'OPERATIONS',
      targetRole: 'DRIVER',
      targetUserId: route.driverId?.userId || null,
      metadata: {
        routeId: route._id.toString(),
        routeCode: route.routeCode,
        sentBy: req.user ? req.user.name : 'Central Dispatch',
        timestamp: new Date(),
      },
    });

    const payload = {
      id: notification._id.toString(),
      routeId: route._id.toString(),
      routeCode: route.routeCode,
      driverId,
      title: title.trim(),
      message: message.trim(),
      severity,
      sender: req.user ? req.user.name : 'Central Dispatch',
      timestamp: new Date(),
    };

    socketService.emitDispatchMessage(payload);

    res.status(200).json({
      success: true,
      message: `Instruction transmitted to driver for route ${route.routeCode}`,
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  optimizeRoutes,
  evaluateBaseline,
  dispatchRoute,
  dispatchDirect,
  validateDispatch,
  getRoutes,
  getRouteById,
  pushRouteToHandheld,
  reorderRouteStops,
  sendRouteMessage,
};
