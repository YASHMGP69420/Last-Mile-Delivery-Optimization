const Papa = require('papaparse');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const { AppError } = require('../middleware/errorHandler');
const { PRIORITY_LEVELS, BHUBANESWAR_ZONES, AUDIT_EVENT_TYPES, DELIVERY_STATUS } = require('../config/constants');
const { recordAuditEvent } = require('./auditService');

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Safely coerces any value to trimmed string, falling back to defaultVal
 */
const safeTrim = (val, defaultVal = '') => {
  if (val === undefined || val === null) {
    return defaultVal;
  }
  return String(val).trim();
};

/**
 * Safely parse CSV text into row objects without throwing UndetectableDelimiter
 */
const parseCsv = (csvText) => {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return { data: [], errors: [] };
  }

  return Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
  });
};

/**
 * Validates a single row from the CSV manifest
 */
const validateRow = (row, rowIndex, existingOrderRefs) => {
  const errors = [];

  const rawOrderRef = (row.orderReference !== undefined && row.orderReference !== null)
    ? row.orderReference
    : (row['Order Reference'] !== undefined && row['Order Reference'] !== null)
      ? row['Order Reference']
      : (row.order_reference !== undefined && row.order_reference !== null)
        ? row.order_reference
        : '';
  const orderReference = safeTrim(rawOrderRef).toUpperCase();

  if (!orderReference) {
    errors.push({ row: rowIndex, field: 'orderReference', message: 'Order reference is required' });
  } else if (existingOrderRefs.has(orderReference)) {
    errors.push({ row: rowIndex, field: 'orderReference', message: `Duplicate order reference '${orderReference}' in file` });
  } else {
    existingOrderRefs.add(orderReference);
  }

  const customerName = safeTrim(
    row.customerName !== undefined && row.customerName !== null ? row.customerName :
    row['Customer Name'] !== undefined && row['Customer Name'] !== null ? row['Customer Name'] :
    row.customer_name
  );

  if (!customerName) {
    errors.push({ row: rowIndex, field: 'customerName', message: 'Customer name is required' });
  }

  const customerPhone = safeTrim(
    row.customerPhone !== undefined && row.customerPhone !== null ? row.customerPhone :
    row.phone !== undefined && row.phone !== null ? row.phone :
    row['Customer Phone'] !== undefined && row['Customer Phone'] !== null ? row['Customer Phone'] :
    row.customer_phone
  );

  if (!customerPhone) {
    errors.push({ row: rowIndex, field: 'phone', message: 'Customer phone number is required' });
  }

  const street = safeTrim(
    row.street !== undefined && row.street !== null ? row.street :
    row.address !== undefined && row.address !== null ? row.address :
    row.Address !== undefined && row.Address !== null ? row.Address :
    row.Street
  );

  if (!street) {
    errors.push({ row: rowIndex, field: 'address', message: 'Street address is required' });
  }

  const postalCode = safeTrim(
    row.postalCode !== undefined && row.postalCode !== null ? row.postalCode :
    row['Postal Code'] !== undefined && row['Postal Code'] !== null ? row['Postal Code'] :
    row.pincode !== undefined && row.pincode !== null ? row.pincode :
    row.Pincode,
    '751024'
  );

  const weightRaw = row.weightKg !== undefined ? row.weightKg : (row['Weight (kg)'] || row.weight || row.weight_kg);
  const weightKg = parseFloat(weightRaw);
  if (isNaN(weightKg) || weightKg <= 0) {
    errors.push({ row: rowIndex, field: 'weightKg', message: 'Weight must be a positive number (> 0)' });
  }

  const timeWindowStart = safeTrim(
    row.timeWindowStart !== undefined && row.timeWindowStart !== null ? row.timeWindowStart :
    row['Time Window Start'] !== undefined && row['Time Window Start'] !== null ? row['Time Window Start'] :
    row.time_window_start,
    '09:00'
  );

  if (!TIME_REGEX.test(timeWindowStart)) {
    errors.push({ row: rowIndex, field: 'timeWindowStart', message: 'Start time window must be HH:mm (e.g. 09:00)' });
  }

  const timeWindowEnd = safeTrim(
    row.timeWindowEnd !== undefined && row.timeWindowEnd !== null ? row.timeWindowEnd :
    row['Time Window End'] !== undefined && row['Time Window End'] !== null ? row['Time Window End'] :
    row.time_window_end,
    '17:00'
  );

  if (!TIME_REGEX.test(timeWindowEnd)) {
    errors.push({ row: rowIndex, field: 'timeWindowEnd', message: 'End time window must be HH:mm (e.g. 17:00)' });
  }

  // Check start < end
  if (TIME_REGEX.test(timeWindowStart) && TIME_REGEX.test(timeWindowEnd)) {
    if (timeWindowStart >= timeWindowEnd) {
      errors.push({ row: rowIndex, field: 'timeWindow', message: 'Start time window must precede end time window' });
    }
  }

  let priority = safeTrim(
    row.priority !== undefined && row.priority !== null ? row.priority : row.Priority,
    'Standard'
  );
  const validPriorities = Object.values(PRIORITY_LEVELS);
  if (!validPriorities.includes(priority)) {
    priority = PRIORITY_LEVELS.STANDARD;
  }

  let zone = safeTrim(
    row.zone !== undefined && row.zone !== null ? row.zone : row.Zone,
    'Other'
  );
  if (!BHUBANESWAR_ZONES.includes(zone)) {
    zone = 'Other';
  }

  const latRaw = parseFloat(row.latitude || row.lat || row.Lat);
  const lngRaw = parseFloat(row.longitude || row.lng || row.Lng);
  const hasCoordinates = !isNaN(latRaw) && !isNaN(lngRaw);

  const deliveryData = {
    orderReference,
    customer: {
      name: customerName,
      phone: customerPhone,
      email: safeTrim(row.customerEmail || row['Customer Email'] || row.customer_email) || null,
    },
    address: {
      street,
      city: safeTrim(row.city || row.City, 'Bhubaneswar'),
      zone,
      postalCode,
    },
    location: {
      type: 'Point',
      coordinates: hasCoordinates ? [lngRaw, latRaw] : [85.8645, 20.2961],
      geocoded: hasCoordinates,
      geocodingConfidence: hasCoordinates ? 1.0 : 0.0,
      geocodingSource: hasCoordinates ? 'MANUAL' : 'SIMULATED',
    },
    weightKg: isNaN(weightKg) ? 1.0 : weightKg,
    volumeM3: parseFloat(row.volumeM3 || row['Volume (m3)'] || 0.01) || 0.01,
    priority,
    timeWindow: {
      start: timeWindowStart,
      end: timeWindowEnd,
    },
    serviceDurationMinutes: parseInt(row.serviceDurationMinutes || row.service_duration || 10, 10) || 10,
    status: DELIVERY_STATUS.DRAFT,
  };

  return { errors, deliveryData };
};

/**
 * Process CSV string, buffer, or array of rows
 */
const processCsvManifest = async (input, options = {}) => {
  const { dryRun = true, batchId = null, actor = null } = options;

  let rows = [];
  if (Array.isArray(input)) {
    rows = input;
  } else if (input && typeof input === 'object' && Array.isArray(input.rows)) {
    rows = input.rows;
  } else {
    const rawText = input !== undefined && input !== null ? input.toString() : '';
    const parseResult = parseCsv(rawText);

    if (parseResult.errors && parseResult.errors.length > 0 && parseResult.data.length === 0) {
      throw new AppError(`CSV Parsing failed: ${parseResult.errors[0].message}`, 400, 'MALFORMED_CSV');
    }
    rows = parseResult.data;
  }

  if (rows.length === 0) {
    return {
      dryRun,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      validCount: 0,
      errorCount: 0,
      errors: [],
      preview: [],
    };
  }

  const fileOrderRefs = new Set();
  const allErrors = [];
  const validDeliveriesData = [];

  // Check existing orderReferences in DB to avoid collisions
  const incomingRefs = rows
    .map((r) => {
      const raw = (r.orderReference !== undefined && r.orderReference !== null)
        ? r.orderReference
        : (r['Order Reference'] !== undefined && r['Order Reference'] !== null)
          ? r['Order Reference']
          : (r.order_reference !== undefined && r.order_reference !== null)
            ? r.order_reference
            : '';
      return safeTrim(raw).toUpperCase();
    })
    .filter(Boolean);

  const dbCollisions = await Delivery.find({ orderReference: { $in: incomingRefs } }).select('orderReference');
  const dbCollisionSet = new Set(dbCollisions.map((d) => d.orderReference));

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-based + 1 for header / row numbering
    const { errors, deliveryData } = validateRow(row, rowNum, fileOrderRefs);

    if (dbCollisionSet.has(deliveryData.orderReference)) {
      errors.push({
        row: rowNum,
        field: 'orderReference',
        message: `Order reference '${deliveryData.orderReference}' already exists in database`,
      });
    }

    if (errors.length > 0) {
      allErrors.push(...errors);
    } else {
      if (batchId) {
        deliveryData.batchId = batchId;
      }
      validDeliveriesData.push(deliveryData);
    }
  });

  const invalidRowsCount = new Set(allErrors.map((e) => e.row)).size;

  const summary = {
    dryRun,
    totalRows: rows.length,
    validRows: validDeliveriesData.length,
    invalidRows: invalidRowsCount,
    validCount: validDeliveriesData.length,
    errorCount: allErrors.length,
    errors: allErrors,
    preview: validDeliveriesData.slice(0, 10),
  };

  if (dryRun) {
    return summary;
  }

  // If committing (dryRun === false)
  if (allErrors.length > 0) {
    const err = new Error(`CSV validation failed with ${allErrors.length} errors across rows`);
    err.details = allErrors;
    err.statusCode = 422;
    throw err;
  }

  const importedDeliveries = await Delivery.insertMany(validDeliveriesData);

  // If associated with a batch, update batch metrics
  if (batchId) {
    const deliveryIds = importedDeliveries.map((d) => d._id);
    const totalAddedWeight = validDeliveriesData.reduce((acc, d) => acc + d.weightKg, 0);

    await DeliveryBatch.findByIdAndUpdate(batchId, {
      $push: { deliveryIds: { $each: deliveryIds } },
      $inc: {
        'metrics.totalDeliveries': deliveryIds.length,
        'metrics.totalWeightKg': totalAddedWeight,
      },
    });
  }

  // Audit event
  if (actor) {
    await recordAuditEvent({
      batchId,
      type: AUDIT_EVENT_TYPES.CSV_IMPORTED,
      actorId: actor.id,
      actorRole: actor.role,
      action: `Imported ${importedDeliveries.length} deliveries via CSV manifest`,
      metadata: {
        totalRows: rows.length,
        importedCount: importedDeliveries.length,
        batchId,
      },
    });
  }

  return {
    ...summary,
    importedCount: importedDeliveries.length,
    importedDeliveries,
  };
};

module.exports = {
  processCsvManifest,
  validateRow,
  parseCsv,
};

