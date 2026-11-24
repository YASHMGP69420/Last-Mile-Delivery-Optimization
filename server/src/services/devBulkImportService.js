const fs = require('fs');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');
const { processVehicleCsv } = require('./csvVehicleImportService');
const { processDriverCsv } = require('./csvDriverImportService');
const { processCsvManifest } = require('./csvImportService');
const socketService = require('./socketService');

/**
 * Finds the directory containing sample CSVs (vehicles.csv, drivers.csv, orders.csv).
 */
const findSampleDataDir = () => {
  const candidateDirs = [
    path.resolve(__dirname, '../../../sample_data/csv'),
    path.resolve(__dirname, '../../../client/public/sample_data'),
    path.resolve(process.cwd(), 'sample_data/csv'),
    path.resolve(process.cwd(), '../sample_data/csv'),
    path.resolve(process.cwd(), 'client/public/sample_data'),
    path.resolve(process.cwd(), '../client/public/sample_data'),
  ];

  for (const dir of candidateDirs) {
    if (
      fs.existsSync(dir) &&
      fs.existsSync(path.join(dir, 'vehicles.csv')) &&
      fs.existsSync(path.join(dir, 'drivers.csv')) &&
      fs.existsSync(path.join(dir, 'orders.csv'))
    ) {
      return dir;
    }
  }

  // Fallback to checking individually if separated
  return null;
};

/**
 * Loads content of a specific sample CSV.
 */
const readSampleCsv = (filename) => {
  const candidatePaths = [
    path.resolve(__dirname, '../../../sample_data/csv', filename),
    path.resolve(__dirname, '../../../client/public/sample_data', filename),
    path.resolve(process.cwd(), 'sample_data/csv', filename),
    path.resolve(process.cwd(), '../sample_data/csv', filename),
    path.resolve(process.cwd(), 'client/public/sample_data', filename),
    path.resolve(process.cwd(), '../client/public/sample_data', filename),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  throw new AppError(
    `Sample CSV file "${filename}" could not be located on disk.`,
    404,
    'SAMPLE_CSV_NOT_FOUND'
  );
};

/**
 * Executes a full bulk import of the sample Bhubaneswar CSV datasets:
 * 1. Fleet Vehicles (vehicles.csv)
 * 2. Commercial Drivers & Login Users (drivers.csv)
 * 3. Consignment Orders (orders.csv)
 *
 * @param {Object} actor - The user initiating the import (req.user)
 * @returns {Promise<Object>} Import summary with counts
 */
const bulkImportSampleData = async (actor) => {
  const vehiclesContent = readSampleCsv('vehicles.csv');
  const driversContent = readSampleCsv('drivers.csv');
  const ordersContent = readSampleCsv('orders.csv');

  // 1. Import Vehicles
  const vehicleResult = await processVehicleCsv(vehiclesContent, { dryRun: false });

  // 2. Import Drivers
  const driverResult = await processDriverCsv(driversContent, {
    dryRun: false,
    actor,
  });

  // 3. Import Consignment Orders
  const deliveryResult = await processCsvManifest(ordersContent, {
    dryRun: false,
    actor,
    skipDuplicates: true,
  });

  const vehiclesCount = vehicleResult.validCount ?? vehicleResult.totalRows ?? 0;
  const driversCount = driverResult.created ?? driverResult.validCount ?? driverResult.totalRows ?? 0;
  const deliveriesCount = deliveryResult.importedCount ?? deliveryResult.validCount ?? 0;
  const totalImported = vehiclesCount + driversCount + deliveriesCount;

  // Broadcast real-time events to sync active sessions
  try {
    socketService.emitToRole?.('ADMIN', 'fleet:updated', { source: 'dev_bulk_import' });
    socketService.emitToRole?.('ADMIN', 'delivery:created', { source: 'dev_bulk_import' });
  } catch (err) {
    console.warn('[devBulkImportService] Socket notification warning:', err.message);
  }

  return {
    vehiclesCount,
    driversCount,
    deliveriesCount,
    totalImported,
    details: {
      vehicles: vehicleResult,
      drivers: driverResult,
      deliveries: {
        validCount: deliveryResult.validCount,
        importedCount: deliveriesCount,
        errors: deliveryResult.errors || [],
      },
    },
  };
};

module.exports = {
  findSampleDataDir,
  readSampleCsv,
  bulkImportSampleData,
};
