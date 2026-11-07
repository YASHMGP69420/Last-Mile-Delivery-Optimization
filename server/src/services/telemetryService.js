const TelemetryPing = require('../models/TelemetryPing');
const TelemetryAlert = require('../models/TelemetryAlert');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Route = require('../models/Route');
const { emitTelemetryPing, emitTelemetryAlert } = require('./socketService');
const { AppError } = require('../middleware/errorHandler');

const URBAN_SPEED_LIMIT_KMH = 65.0;
const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Ingest and validate a telemetry ping from mobile handheld or hardware
 */
const recordTelemetry = async (payload, user = null) => {
  let {
    driverId,
    vehicleId,
    routeId,
    source = 'MOBILE_APP_GPS',
    coordinates,
    accuracyMeters = 5.0,
    speedKmh = 0.0,
    headingDegrees = 0.0,
    altitudeMeters = null,
    batteryPercent = null,
    hardwareSensors = null,
    timestamp = new Date(),
  } = payload;

  // Resolve driver if user is DRIVER
  if (!driverId && user && user.role === 'DRIVER') {
    const driverDoc = await Driver.findOne({ userId: user.id });
    if (driverDoc) {
      driverId = driverDoc._id;
      if (!vehicleId && driverDoc.assignedVehicleId) {
        vehicleId = driverDoc.assignedVehicleId;
      }
      if (!routeId && driverDoc.currentRouteId) {
        routeId = driverDoc.currentRouteId;
      }
    }
  }

  if (!driverId) {
    throw new AppError('Driver ID is required for telemetry ingestion', 400, 'MISSING_DRIVER_ID');
  }

  // Validate coordinates: [lng, lat]
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new AppError('Coordinates must be an array of [longitude, latitude]', 400, 'INVALID_COORDINATES');
  }

  const [lng, lat] = coordinates;
  if (
    typeof lng !== 'number' ||
    typeof lat !== 'number' ||
    isNaN(lng) ||
    isNaN(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    throw new AppError('Coordinates [lng, lat] are out of valid geographic range', 400, 'COORDINATES_OUT_OF_BOUNDS');
  }

  // Speed and heading validation
  const parsedSpeed = Number(speedKmh);
  if (isNaN(parsedSpeed) || parsedSpeed < 0) {
    throw new AppError('Speed must be a non-negative number in km/h', 400, 'INVALID_SPEED');
  }

  const parsedHeading = Number(headingDegrees);
  if (isNaN(parsedHeading) || parsedHeading < 0 || parsedHeading > 360) {
    throw new AppError('Heading must be between 0 and 360 degrees', 400, 'INVALID_HEADING');
  }

  // Hardware sensor integrity: strictly never fabricate vehicle OBD-II/CAN-bus data
  let sanitizedHardware = {
    connected: false,
    engineRpm: null,
    fuelLevelPercent: null,
    coolantTempC: null,
    odometerKm: null,
    diagnosticTroubleCodes: [],
  };

  if (hardwareSensors && hardwareSensors.connected === true) {
    sanitizedHardware = {
      connected: true,
      engineRpm: typeof hardwareSensors.engineRpm === 'number' ? hardwareSensors.engineRpm : null,
      fuelLevelPercent: typeof hardwareSensors.fuelLevelPercent === 'number' ? hardwareSensors.fuelLevelPercent : null,
      coolantTempC: typeof hardwareSensors.coolantTempC === 'number' ? hardwareSensors.coolantTempC : null,
      odometerKm: typeof hardwareSensors.odometerKm === 'number' ? hardwareSensors.odometerKm : null,
      diagnosticTroubleCodes: Array.isArray(hardwareSensors.diagnosticTroubleCodes)
        ? hardwareSensors.diagnosticTroubleCodes
        : [],
    };
  }

  // Create telemetry record
  const ping = new TelemetryPing({
    driverId,
    vehicleId: vehicleId || null,
    routeId: routeId || null,
    source,
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    accuracyMeters: Number(accuracyMeters) || 5.0,
    speedKmh: parsedSpeed,
    headingDegrees: parsedHeading,
    altitudeMeters: altitudeMeters ? Number(altitudeMeters) : null,
    batteryPercent: batteryPercent !== null && batteryPercent !== undefined ? Number(batteryPercent) : null,
    hardwareSensors: sanitizedHardware,
    timestamp: new Date(timestamp),
  });

  await ping.save();

  // Rule-based alert detection
  const generatedAlerts = [];

  // 1. Overspeed alert
  if (parsedSpeed > URBAN_SPEED_LIMIT_KMH) {
    const overspeedAlert = new TelemetryAlert({
      vehicleId: vehicleId || null,
      driverId,
      routeId: routeId || null,
      alertType: 'OVERSPEED',
      severity: 'CRITICAL',
      message: `Speed alert: ${parsedSpeed.toFixed(1)} km/h exceeds urban limit of ${URBAN_SPEED_LIMIT_KMH} km/h`,
      metadata: {
        speedKmh: parsedSpeed,
        speedLimitKmh: URBAN_SPEED_LIMIT_KMH,
        coordinates: [lng, lat],
      },
    });
    await overspeedAlert.save();
    generatedAlerts.push(overspeedAlert);
    emitTelemetryAlert(overspeedAlert);
  }

  // 2. Critical Mobile Battery alert
  if (batteryPercent !== null && batteryPercent !== undefined && Number(batteryPercent) < 15) {
    const batteryAlert = new TelemetryAlert({
      vehicleId: vehicleId || null,
      driverId,
      routeId: routeId || null,
      alertType: 'LOW_BATTERY',
      severity: 'WARNING',
      message: `Driver handheld device battery critically low (${Number(batteryPercent)}%)`,
      metadata: {
        batteryPercent: Number(batteryPercent),
      },
    });
    await batteryAlert.save();
    generatedAlerts.push(batteryAlert);
    emitTelemetryAlert(batteryAlert);
  }

  // Broadcast ping to realtime clients
  emitTelemetryPing(ping);

  return {
    ping,
    alerts: generatedAlerts,
  };
};

/**
 * Retrieve current real-time fleet snapshot with staleness and hardware device detection
 */
const getLiveFleetStatus = async () => {
  const [vehicles, drivers] = await Promise.all([
    Vehicle.find().populate({
      path: 'assignedDriverId',
      populate: { path: 'userId', select: 'name email phone' },
    }),
    Driver.find().populate('userId', 'name email phone'),
  ]);

  const now = Date.now();
  const fleetStatusList = await Promise.all(
    vehicles.map(async (vehicle) => {
      // Find latest telemetry ping for this vehicle or its assigned driver
      const driverId = vehicle.assignedDriverId?._id || vehicle.assignedDriverId;
      const query = {
        $or: [{ vehicleId: vehicle._id }],
      };
      if (driverId) {
        query.$or.push({ driverId });
      }

      const latestPing = await TelemetryPing.findOne(query).sort({ timestamp: -1 });

      let isStale = true;
      let lastSeenMinutesAgo = null;

      if (latestPing) {
        const pingTime = new Date(latestPing.timestamp).getTime();
        const diffMs = now - pingTime;
        lastSeenMinutesAgo = Math.floor(diffMs / 60000);
        isStale = diffMs > STALE_TIMEOUT_MS;
      }

      const hardwareConnected = latestPing?.hardwareSensors?.connected === true;

      return {
        vehicle: {
          id: vehicle._id.toString(),
          vehicleId: vehicle.vehicleId,
          makeModel: vehicle.makeModel,
          type: vehicle.type,
          capacityKg: vehicle.capacityKg,
          fuelType: vehicle.fuelType,
          availability: vehicle.availability,
          batterySoC: vehicle.batterySoC,
          kmPerLitre: vehicle.kmPerLitre,
          assignedDriver: vehicle.assignedDriverId,
        },
        telemetry: latestPing
          ? {
              id: latestPing._id.toString(),
              coordinates: latestPing.location.coordinates, // [lng, lat]
              accuracyMeters: latestPing.accuracyMeters,
              speedKmh: latestPing.speedKmh,
              headingDegrees: latestPing.headingDegrees,
              batteryPercent: latestPing.batteryPercent,
              timestamp: latestPing.timestamp,
              source: latestPing.source,
              isStale,
              lastSeenMinutesAgo,
            }
          : null,
        hardwareSensors: {
          connected: hardwareConnected,
          statusText: hardwareConnected
            ? 'OBD-II / CAN-Bus Active'
            : 'Vehicle telemetry device not connected',
          diagnostics: hardwareConnected ? latestPing.hardwareSensors : null,
        },
      };
    })
  );

  return fleetStatusList;
};

/**
 * Get historical GPS trail for a vehicle
 */
const getVehicleHistory = async (vehicleId, limit = 50) => {
  const pings = await TelemetryPing.find({ vehicleId })
    .sort({ timestamp: 1 })
    .limit(limit);

  return pings;
};

/**
 * List active or historical telemetry alerts
 */
const getAlerts = async (filter = {}) => {
  const query = {};
  if (filter.acknowledged !== undefined) {
    query.acknowledged = filter.acknowledged;
  }
  if (filter.alertType) {
    query.alertType = filter.alertType;
  }
  if (filter.vehicleId) {
    query.vehicleId = filter.vehicleId;
  }

  const alerts = await TelemetryAlert.find(query)
    .populate('driverId', 'licenseNumber phone')
    .populate('vehicleId', 'vehicleId makeModel')
    .populate('acknowledgedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  return alerts;
};

/**
 * Acknowledge an alert
 */
const acknowledgeAlert = async (alertId, userId) => {
  const alert = await TelemetryAlert.findById(alertId);
  if (!alert) {
    throw new AppError('Telemetry alert not found', 404, 'NOT_FOUND');
  }

  alert.acknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date();
  await alert.save();

  return alert;
};

module.exports = {
  recordTelemetry,
  getLiveFleetStatus,
  getVehicleHistory,
  getAlerts,
  acknowledgeAlert,
  URBAN_SPEED_LIMIT_KMH,
  STALE_TIMEOUT_MS,
};
