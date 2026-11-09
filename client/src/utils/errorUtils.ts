/**
 * Centralized Non-Technical Semantic Error Translation Utility
 *
 * Translates raw backend errors, validation codes, and network exceptions
 * into clear, actionable, user-friendly plain English.
 */

const ERROR_CODE_TRANSLATIONS: Record<string, string> = {
  // Driver & Dispatch Errors
  DRIVER_UNAVAILABLE:
    'The selected driver is currently on another active delivery run. Please wait for them to complete their current route or select another available driver.',
  DRIVER_IN_ACTIVE_TRANSIT:
    'This driver is currently in transit on an active route. Please choose a driver who is currently available or wait for their route to conclude.',
  NO_DRIVERS_AVAILABLE:
    'No available drivers were found for assignment. Please ensure drivers have completed their previous shifts or onboard a driver to the fleet.',
  MISSING_DRIVER:
    'Please select an available driver before proceeding with dispatch.',

  // Vehicle & Capacity Errors
  VEHICLE_UNAVAILABLE:
    'This vehicle is currently assigned to another active run or undergoing maintenance. Please select an available vehicle.',
  VEHICLE_IN_ACTIVE_TRANSIT:
    'This vehicle is currently out for delivery on an active route. Please choose an available vehicle from the fleet.',
  NO_VEHICLES_AVAILABLE:
    'No available fleet vehicles were found. Please verify vehicle availability or wait for active routes to return to the hub.',
  CAPACITY_EXCEEDED:
    'The total package weight exceeds this vehicle’s maximum load limit. Please assign a larger vehicle or move some consignments to another batch.',
  OVERLOAD_DETECTED:
    'The consignments exceed the vehicle load limit. Please reduce the batch payload or choose a larger cargo capacity.',

  // Batch & Optimization Errors
  NO_DELIVERIES_TO_OPTIMIZE:
    'There are no ready or pending delivery consignments in this batch to optimize. Please add eligible consignments to the batch first.',
  MISSING_BATCH_ID:
    'A valid operational batch must be selected before optimizing or dispatching.',
  BATCH_NOT_FOUND:
    'The requested dispatch batch could not be located. It may have been archived or removed.',
  BATCH_CLOSED:
    'This dispatch batch is already closed and cannot accept new consignments or route adjustments.',
  INVALID_ROUTE_STATUS:
    'This route has already been dispatched or completed and cannot be re-dispatched.',

  // Delivery & State Errors
  DELIVERY_TERMINAL:
    'This consignment has already reached a completed or cancelled state and cannot be reassigned.',
  CONCURRENCY_CONFLICT:
    'This vehicle or driver was just updated by another dispatcher. The view has been refreshed to show the latest status.',
  DUPLICATE_KEY_CONFLICT:
    'A record with this identifier already exists. Please choose a unique name or reference code.',
};

/**
 * Returns a human-friendly, non-technical explanation for any API or application error.
 */
export function getFriendlyErrorMessage(err: any, fallbackMessage = 'An unexpected issue occurred. Please try again.'): string {
  if (!err) return fallbackMessage;

  // 1. Check for backend error code
  const code =
    err.response?.data?.error?.code ||
    err.response?.data?.code ||
    err.code;

  if (code && ERROR_CODE_TRANSLATIONS[code]) {
    return ERROR_CODE_TRANSLATIONS[code];
  }

  // 2. Check for backend error message
  const rawMsg: string =
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.message ||
    '';

  const lower = rawMsg.toLowerCase();

  // Pattern matching for known technical/backend phrasing
  if (lower.includes('assigneddriverid') || (lower.includes('resource with') && lower.includes('already exists'))) {
    return 'This driver is already assigned to a vehicle in the fleet. Please reassign the driver or choose another vehicle.';
  }
  if (lower.includes('another active route') || lower.includes('in transit on another')) {
    return 'The selected driver is currently assigned to another active delivery route. Please select another driver or wait for their route to complete.';
  }
  if (lower.includes('capacity') || lower.includes('exceeds weight')) {
    return 'The total consignment weight exceeds the assigned vehicle’s capacity limit. Please select a larger vehicle or remove some packages.';
  }
  if (lower.includes('batch has no deliveries') || lower.includes('no deliveries to optimize')) {
    return 'This batch has no pending consignments. Please add consignments to the batch before dispatching.';
  }
  if (lower.includes('already in status') || lower.includes('already dispatched')) {
    return 'This route has already been dispatched to the driver handheld and cannot be dispatched again.';
  }
  if (lower.includes('vehicle is currently in active transit')) {
    return 'This vehicle is currently out on a delivery run. Please select another available vehicle.';
  }
  if (lower.includes('driver is currently in active transit')) {
    return 'This driver is currently on an active route. Please select an available driver.';
  }
  if (lower.includes('cannot re-assign delivery in terminal status')) {
    return 'This delivery has already been marked as delivered or cancelled and cannot be reassigned.';
  }
  if (lower.includes('network error') || lower.includes('econnaborted') || lower.includes('timeout')) {
    return 'Unable to communicate with the central dispatch server. Please check your internet connection.';
  }

  // If the raw message is clean text (and NOT raw Axios status code text like "Request failed with status code 400")
  if (rawMsg && !lower.includes('status code') && !lower.includes('axioserror') && !lower.includes('objectid')) {
    return rawMsg;
  }

  return fallbackMessage;
}
