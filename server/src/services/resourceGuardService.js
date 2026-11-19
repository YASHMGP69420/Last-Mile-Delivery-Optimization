const DriverShift = require('../models/DriverShift');
const Route = require('../models/Route');
const Driver = require('../models/Driver');
const { AppError } = require('../middleware/errorHandler');
const { SHIFT_STATUS } = require('../config/constants');

const ACTIVE_ROUTE_STATUSES = ['DISPATCHED', 'IN_PROGRESS'];

/**
 * Deduplicates non-empty ObjectId/string identifiers.
 */
const normalizeIdList = (ids = []) => {
  const seen = new Map();
  for (const id of ids) {
    if (id === undefined || id === null || id === '') continue;
    const key = id.toString();
    if (!seen.has(key)) {
      seen.set(key, id);
    }
  }
  return Array.from(seen.values());
};

/**
 * Query detailed active route and shift metadata to return rich 409 conflict payload
 */
const getActiveDriverOrVehicleOperations = async ({ driverIds = [], vehicleIds = [] } = {}) => {
  const uniqueDriverIds = normalizeIdList(driverIds);
  const uniqueVehicleIds = normalizeIdList(vehicleIds);

  if (uniqueDriverIds.length === 0 && uniqueVehicleIds.length === 0) {
    return null;
  }

  const orConditions = [];
  if (uniqueDriverIds.length > 0) {
    orConditions.push({ driverId: { $in: uniqueDriverIds } });
  }
  if (uniqueVehicleIds.length > 0) {
    orConditions.push({ vehicleId: { $in: uniqueVehicleIds } });
  }

  const [activeShift, activeRoute] = await Promise.all([
    DriverShift.findOne({
      status: SHIFT_STATUS.IN_PROGRESS,
      $or: orConditions,
    }),
    Route.findOne({
      status: { $in: ACTIVE_ROUTE_STATUSES },
      $or: orConditions,
    }).populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name email' },
    }),
  ]);

  if (!activeShift && !activeRoute) {
    return null;
  }

  const activeDeliveryCount = activeRoute && Array.isArray(activeRoute.stops)
    ? activeRoute.stops.filter((s) => ['PENDING', 'ARRIVED'].includes(s.status)).length
    : 0;

  let driverName = null;
  if (activeRoute?.driverId) {
    driverName = activeRoute.driverId.userId?.name || activeRoute.driverId.name || null;
  }

  if (!driverName && activeShift?.driverId) {
    const shiftDriver = await Driver.findById(activeShift.driverId).populate('userId', 'name');
    driverName = shiftDriver?.userId?.name || null;
  }

  return {
    hasActiveOperations: true,
    routeId: activeRoute?._id?.toString() || null,
    routeCode: activeRoute?.routeCode || null,
    activeDeliveryCount,
    driverName,
    shiftId: activeShift?._id?.toString() || null,
  };
};

/**
 * Blocks retiring, deleting, or re-pairing a vehicle or driver while an IN_PROGRESS shift
 * or DISPATCHED/IN_PROGRESS route is running on any involved entity.
 */
const assertNoActiveDriverOrVehicleOperations = async ({
  driverIds = [],
  vehicleIds = [],
  actionLabel = 'modify resource',
} = {}) => {
  const conflict = await getActiveDriverOrVehicleOperations({ driverIds, vehicleIds });

  if (conflict) {
    throw new AppError(
      `Cannot ${actionLabel}: an active shift or DISPATCHED/IN_PROGRESS route is currently running.`,
      409,
      'ACTIVE_OPERATION_CONFLICT',
      conflict
    );
  }
};

module.exports = {
  getActiveDriverOrVehicleOperations,
  assertNoActiveDriverOrVehicleOperations,
};
