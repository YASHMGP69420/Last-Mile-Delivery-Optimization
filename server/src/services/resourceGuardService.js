const DriverShift = require('../models/DriverShift');
const Route = require('../models/Route');
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
 * Blocks retiring, deleting, or re-pairing a vehicle or driver while an IN_PROGRESS shift
 * or DISPATCHED/IN_PROGRESS route is running on any involved entity.
 */
const assertNoActiveDriverOrVehicleOperations = async ({
  driverIds = [],
  vehicleIds = [],
  actionLabel = 'modify resource',
} = {}) => {
  const uniqueDriverIds = normalizeIdList(driverIds);
  const uniqueVehicleIds = normalizeIdList(vehicleIds);

  if (uniqueDriverIds.length === 0 && uniqueVehicleIds.length === 0) {
    return;
  }

  const orConditions = [];
  if (uniqueDriverIds.length > 0) {
    orConditions.push({ driverId: { $in: uniqueDriverIds } });
  }
  if (uniqueVehicleIds.length > 0) {
    orConditions.push({ vehicleId: { $in: uniqueVehicleIds } });
  }

  const [activeShift, activeRoute] = await Promise.all([
    DriverShift.exists({
      status: SHIFT_STATUS.IN_PROGRESS,
      $or: orConditions,
    }),
    Route.exists({
      status: { $in: ACTIVE_ROUTE_STATUSES },
      $or: orConditions,
    }),
  ]);

  if (activeShift || activeRoute) {
    throw new AppError(
      `Cannot ${actionLabel}: an active shift or DISPATCHED/IN_PROGRESS route is currently running.`,
      409,
      'ACTIVE_OPERATION_CONFLICT'
    );
  }
};

module.exports = {
  assertNoActiveDriverOrVehicleOperations,
};
