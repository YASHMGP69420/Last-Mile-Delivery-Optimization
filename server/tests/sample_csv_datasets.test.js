const fs = require('fs');
const path = require('path');
const { processCsvManifest } = require('../src/services/csvImportService');
const { processDriverCsv } = require('../src/services/csvDriverImportService');
const { processVehicleCsv } = require('../src/services/csvVehicleImportService');

describe('Sample Multi-Entity CSV Datasets Ingestion Validation (Phase 25)', () => {
  const rootCsvDir = path.resolve(__dirname, '../../sample_data/csv');

  describe('1. Orders CSV Manifest (orders.csv)', () => {
    test('TC-CSV-ORDERS-1: loads 50 valid orders with zero errors in dry-run mode', async () => {
      const filePath = path.join(rootCsvDir, 'orders.csv');
      expect(fs.existsSync(filePath)).toBe(true);

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const result = await processCsvManifest(csvContent, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.errorCount).toBe(0);
      expect(result.totalRows).toBe(50);
      expect(result.validCount).toBe(50);
      expect(result.preview.length).toBeGreaterThanOrEqual(1);
    });

    test('TC-CSV-ORDERS-2: all phone numbers strictly follow non-real test series (+91 99999 ...)', () => {
      const filePath = path.join(rootCsvDir, 'orders.csv');
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      const header = lines[0].split(',');
      const phoneIndex = header.indexOf('customerPhone');
      expect(phoneIndex).toBeGreaterThanOrEqual(0);

      const rows = lines.slice(1);
      expect(rows.length).toBe(50);

      rows.forEach((row, idx) => {
        const cols = row.split(',');
        const phone = cols[phoneIndex]?.trim();
        expect(phone).toMatch(/^\+91\s*99999\s*\d{5}$/);
      });
    });
  });

  describe('2. Drivers CSV Roster (drivers.csv)', () => {
    test('TC-CSV-DRIVERS-1: loads 20 commercial drivers with zero errors in dry-run mode', async () => {
      const filePath = path.join(rootCsvDir, 'drivers.csv');
      expect(fs.existsSync(filePath)).toBe(true);

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const result = await processDriverCsv(csvContent, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.totalRows).toBe(20);
      expect(result.preview.length).toBeGreaterThanOrEqual(1);
    });

    test('TC-CSV-DRIVERS-2: all phone numbers strictly follow non-real test series (+91 91111 ...)', () => {
      const filePath = path.join(rootCsvDir, 'drivers.csv');
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      const header = lines[0].split(',');
      const phoneIndex = header.indexOf('phone');
      expect(phoneIndex).toBeGreaterThanOrEqual(0);

      const rows = lines.slice(1);
      expect(rows.length).toBe(20);

      rows.forEach((row, idx) => {
        const cols = row.split(',');
        const phone = cols[phoneIndex]?.trim();
        expect(phone).toMatch(/^\+91\s*91111\s*\d{5}$/);
      });
    });
  });

  describe('3. Vehicles CSV Fleet (vehicles.csv)', () => {
    test('TC-CSV-VEHICLES-1: loads 20 diverse vehicles with zero errors in dry-run mode', async () => {
      const filePath = path.join(rootCsvDir, 'vehicles.csv');
      expect(fs.existsSync(filePath)).toBe(true);

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const result = await processVehicleCsv(csvContent, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.totalRows).toBe(20);
    });

    test('TC-CSV-VEHICLES-2: vehicle specifications conform to combustion vs electric rules', () => {
      const filePath = path.join(rootCsvDir, 'vehicles.csv');
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      const header = lines[0].split(',');
      const fuelIndex = header.indexOf('fuelType');
      const kmPerLitreIndex = header.indexOf('kmPerLitre');
      const energyIndex = header.indexOf('energyKWhPerKm');

      const rows = lines.slice(1);
      expect(rows.length).toBe(20);

      rows.forEach((row) => {
        const cols = row.split(',');
        const fuelType = cols[fuelIndex]?.trim();
        const kmPerLitre = cols[kmPerLitreIndex]?.trim();
        const energyKWhPerKm = cols[energyIndex]?.trim();

        if (fuelType === 'Electric') {
          expect(Number(energyKWhPerKm)).toBeGreaterThan(0);
          expect(kmPerLitre).toBe('');
        } else {
          expect(Number(kmPerLitre)).toBeGreaterThan(0);
          expect(energyKWhPerKm).toBe('');
        }
      });
    });
  });
});
