const mongoose = require('mongoose');
const Hub = require('../models/Hub');
const Delivery = require('../models/Delivery');
const { CANONICAL_DEPOT } = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

/**
 * Validates coordinate bounds: lat in [-90, 90], lng in [-180, 180]
 * Mitigates T-28-05: Coordinate numeric bound validation & NaN/null sanitization
 */
function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Extracts normalized { lat, lng } from various point formats:
 * - { lat, lng }
 * - { location: { coordinates: [lng, lat] } } (GeoJSON standard in Delivery)
 * - { location: { lat, lng } } (Hub schema)
 * - { coordinates: [lng, lat] }
 * - [lat, lng] or [lng, lat]
 */
function extractPointCoordinates(point) {
  if (!point) return null;

  // Direct lat / lng properties
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    if (isValidCoordinate(point.lat, point.lng)) {
      return { lat: point.lat, lng: point.lng };
    }
  }

  // Nested in location object
  if (point.location) {
    if (typeof point.location.lat === 'number' && typeof point.location.lng === 'number') {
      if (isValidCoordinate(point.location.lat, point.location.lng)) {
        return { lat: point.location.lat, lng: point.location.lng };
      }
    }
    if (Array.isArray(point.location.coordinates) && point.location.coordinates.length >= 2) {
      const [lng, lat] = point.location.coordinates;
      if (isValidCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  // GeoJSON coordinates array directly [lng, lat]
  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    const [lng, lat] = point.coordinates;
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  // Array format [a, b]
  if (Array.isArray(point) && point.length >= 2) {
    const [a, b] = point;
    // Check if [lat, lng] or [lng, lat]
    if (isValidCoordinate(a, b)) {
      // In Bhubaneswar, lat is ~20, lng is ~85
      if (b > 70 || a < 40) {
        return { lat: a, lng: b };
      }
    }
    if (isValidCoordinate(b, a)) {
      return { lat: b, lng: a };
    }
  }

  return null;
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Infinity;
  }
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(3));
}

/**
 * Finds the nearest active logistics hub to a given geographic point.
 * @param {Object|Array} point - Coordinate point or object with coordinates
 * @param {Array<Object>} activeHubs - Array of active Hub documents
 * @returns {{ hub: Object, distanceKm: number }|null}
 */
function findNearestHub(point, activeHubs = []) {
  const pCoords = extractPointCoordinates(point);
  if (!pCoords) {
    return null;
  }

  if (!Array.isArray(activeHubs) || activeHubs.length === 0) {
    return null;
  }

  let closestHub = null;
  let minDistance = Infinity;

  for (const hub of activeHubs) {
    const hCoords = extractPointCoordinates(hub);
    if (!hCoords) continue;

    const dist = haversineDistanceKm(pCoords.lat, pCoords.lng, hCoords.lat, hCoords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = hub;
    }
  }

  if (!closestHub) {
    return null;
  }

  return {
    hub: closestHub,
    distanceKm: minDistance,
  };
}

/**
 * Partitions an array of delivery documents into clusters mapped by their nearest active hub.
 * Computes cluster centroids, stops counts, and aggregate payload weights.
 * 
 * @param {Array<Object>} deliveries - Deliveries with geographic locations
 * @param {Array<Object>} activeHubs - Active logistics hubs
 * @returns {Array<Object>} Array of hub cluster objects
 */
function clusterConsignmentsByHub(deliveries = [], activeHubs = []) {
  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    return [];
  }

  if (!Array.isArray(activeHubs) || activeHubs.length === 0) {
    return [];
  }

  // Map of hubId -> cluster accumulator
  const clustersByHubId = new Map();

  for (const hub of activeHubs) {
    const hubIdStr = (hub._id || hub.id || '').toString();
    clustersByHubId.set(hubIdStr, {
      hubId: hub._id || hub.id,
      hub,
      hubName: hub.name,
      hubCode: hub.code,
      deliveries: [],
      deliveryIds: [],
      stopsCount: 0,
      count: 0,
      totalWeightKg: 0,
      latSum: 0,
      lngSum: 0,
    });
  }

  // Unassigned pool for deliveries with unresolvable coordinates
  const unassigned = [];

  for (const delivery of deliveries) {
    const coords = extractPointCoordinates(delivery);
    if (!coords) {
      unassigned.push(delivery);
      continue;
    }

    const nearest = findNearestHub(coords, activeHubs);
    if (!nearest || !nearest.hub) {
      unassigned.push(delivery);
      continue;
    }

    const hubIdStr = (nearest.hub._id || nearest.hub.id || '').toString();
    const cluster = clustersByHubId.get(hubIdStr);
    if (cluster) {
      cluster.deliveries.push(delivery);
      cluster.deliveryIds.push(delivery._id || delivery.id);
      cluster.stopsCount += 1;
      cluster.count += 1;
      cluster.totalWeightKg += Number(delivery.weightKg) || 0;
      cluster.latSum += coords.lat;
      cluster.lngSum += coords.lng;
    } else {
      unassigned.push(delivery);
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const clusters = [];

  for (const cluster of clustersByHubId.values()) {
    if (cluster.stopsCount > 0) {
      const avgLat = parseFloat((cluster.latSum / cluster.stopsCount).toFixed(6));
      const avgLng = parseFloat((cluster.lngSum / cluster.stopsCount).toFixed(6));

      const clusterObj = {
        hubId: cluster.hubId,
        hub: cluster.hub,
        hubName: cluster.hubName,
        hubCode: cluster.hubCode,
        deliveries: cluster.deliveries,
        deliveryIds: cluster.deliveryIds,
        stopsCount: cluster.stopsCount,
        count: cluster.count,
        totalWeightKg: parseFloat(cluster.totalWeightKg.toFixed(2)),
        centroid: { lat: avgLat, lng: avgLng },
        recommendedBatchName: `${cluster.hubName} Batch - ${todayStr}`,
      };

      clusters.push(clusterObj);
    }
  }

  // Attach byHubId map dictionary for direct key-based lookup
  const byHubId = {};
  for (const c of clusters) {
    byHubId[c.hubId.toString()] = c;
  }
  clusters.byHubId = byHubId;
  clusters.unassigned = unassigned;

  return clusters;
}

/**
 * Computes preview clusters for a list of delivery IDs by resolving deliveries
 * and partitioning across currently active hubs.
 * 
 * @param {Array<string>} deliveryIds - Delivery ObjectIds
 * @returns {Promise<{ clusters: Array<Object>, totalDeliveries: number, activeHubsCount: number }>}
 */
async function computeConsignmentClusterPreview(deliveryIds = []) {
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
    return {
      clusters: [],
      totalDeliveries: 0,
      activeHubsCount: 0,
    };
  }

  // T-28-06: Cap preview size to prevent Denial of Service
  if (deliveryIds.length > 500) {
    throw new AppError('Cannot preview clustering for more than 500 deliveries at once', 400, 'EXCESSIVE_PREVIEW_SIZE');
  }

  const validIds = deliveryIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) {
    return {
      clusters: [],
      totalDeliveries: 0,
      activeHubsCount: 0,
    };
  }

  const [deliveries, activeHubs] = await Promise.all([
    Delivery.find({ _id: { $in: validIds } }),
    Hub.find({ isActive: true }).sort({ isCanonical: -1, name: 1 }),
  ]);

  if (activeHubs.length === 0) {
    // If no active hubs in DB, synthesize fallback canonical hub
    activeHubs.push({
      _id: new mongoose.Types.ObjectId(),
      name: CANONICAL_DEPOT.name,
      code: 'RASULGARH-CANONICAL',
      address: CANONICAL_DEPOT.address,
      location: {
        lat: CANONICAL_DEPOT.geo.lat,
        lng: CANONICAL_DEPOT.geo.lng,
      },
      isActive: true,
      isCanonical: true,
    });
  }

  const clusters = clusterConsignmentsByHub(deliveries, activeHubs);

  return {
    clusters: Array.from(clusters),
    totalDeliveries: deliveries.length,
    activeHubsCount: activeHubs.length,
    unassignedCount: (clusters.unassigned || []).length,
  };
}

module.exports = {
  isValidCoordinate,
  extractPointCoordinates,
  haversineDistanceKm,
  findNearestHub,
  clusterConsignmentsByHub,
  computeConsignmentClusterPreview,
};
