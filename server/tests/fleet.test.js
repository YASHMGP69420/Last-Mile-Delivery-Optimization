const request = require('supertest');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

describe('Fleet Management & 1:1 Pairing Rules Test Suite (server/tests/fleet.test.js)', () => {
  let managerToken;

  beforeEach(async () => {
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;
  });

  describe('Vehicle Registry CRUD & Validation', () => {
    test('TC-FLEET-1: Register Diesel Van with capacity and kmPerLitre returns 201', async () => {
      const payload = {
        vehicleId: 'OD-02-VAN-1001',
        makeModel: 'Tata Ace Gold Diesel',
        type: 'Van',
        capacityKg: 750.0,
        capacityM3: 2.8,
        fuelType: 'Diesel',
        kmPerLitre: 15.0,
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle.vehicleId).toBe('OD-02-VAN-1001');
      expect(res.body.data.vehicle.fuelType).toBe('Diesel');
      expect(res.body.data.vehicle.availability).toBe('AVAILABLE');
    });

    test('TC-FLEET-2: Register Electric 3-Wheeler with energyKWhPerKm returns 201', async () => {
      const payload = {
        vehicleId: 'OD-02-EV-2001',
        makeModel: 'Mahindra Treo Zor Cargo',
        type: 'Van',
        capacityKg: 500.0,
        fuelType: 'Electric',
        energyKWhPerKm: 0.12,
        batterySoC: 95,
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle.vehicleId).toBe('OD-02-EV-2001');
      expect(res.body.data.vehicle.fuelType).toBe('Electric');
      expect(res.body.data.vehicle.energyKWhPerKm).toBe(0.12);
    });

    test('TC-FLEET-3: Register Electric vehicle without energyKWhPerKm returns 400 Bad Request', async () => {
      const payload = {
        vehicleId: 'OD-02-EV-INVALID',
        makeModel: 'Invalid EV',
        type: 'Van',
        capacityKg: 600.0,
        fuelType: 'Electric',
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/energyKWhPerKm/i);
    });

    test('TC-FLEET-4: Register Diesel vehicle without kmPerLitre returns 400 Bad Request', async () => {
      const payload = {
        vehicleId: 'OD-02-DIESEL-INVALID',
        makeModel: 'Invalid Diesel',
        type: 'Van',
        capacityKg: 1000.0,
        fuelType: 'Diesel',
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/kmPerLitre/i);
    });
  });

  describe('1:1 Vehicle-Driver Mutual Exclusivity', () => {
    let driverA;
    let driverB;
    let vehicleA;
    let vehicleB;

    beforeEach(async () => {
      const uA = await createTestUser('DRIVER');
      const uB = await createTestUser('DRIVER');

      driverA = await createTestDriver(uA.user);
      driverB = await createTestDriver(uB.user);

      vehicleA = await createTestVehicle({ vehicleId: 'OD-02-V-AAAA' });
      vehicleB = await createTestVehicle({ vehicleId: 'OD-02-V-BBBB' });
    });

    test('TC-FLEET-5: Assigning available driver to available vehicle establishes mutual 1:1 pairing', async () => {
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.assignedVehicleId.toString()).toBe(vehicleA._id.toString());
      expect(res.body.data.vehicle.assignedDriverId.toString()).toBe(driverA._id.toString());
      expect(res.body.data.vehicle.availability).toBe('ASSIGNED');
    });

    test('TC-FLEET-6: Reassigning driver to new vehicle frees former vehicle back to AVAILABLE', async () => {
      // Step 1: Assign driverA to vehicleA
      await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });

      // Step 2: Assign driverA to vehicleB
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleB._id });

      expect(res.status).toBe(200);
      expect(res.body.data.driver.assignedVehicleId.toString()).toBe(vehicleB._id.toString());

      // Former vehicleA should now be AVAILABLE with assignedDriverId null
      const vA = await Vehicle.findById(vehicleA._id);
      expect(vA.assignedDriverId).toBeNull();
      expect(vA.availability).toBe('AVAILABLE');
    });

    test('TC-FLEET-7: Unassigning driver restores vehicle to AVAILABLE and clears link', async () => {
      // First assign
      await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });

      // Now unassign
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/unassign`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.driver.assignedVehicleId).toBeNull();
      expect(res.body.data.vehicle.availability).toBe('AVAILABLE');
      expect(res.body.data.vehicle.assignedDriverId).toBeNull();
    });

    test('TC-FLEET-8: Assigning retired vehicle is rejected with 400 Bad Request', async () => {
      vehicleA.availability = 'RETIRED';
      await vehicleA.save();

      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VEHICLE_UNAVAILABLE');
    });
  });

  describe('Driver CSV Bulk Import (POST /api/v1/drivers/import-csv)', () => {
    test('TC-FLEET-9: Dry-run validation (dryRun=true) returns row counts and previews without DB insert', async () => {
      const csv = `name,email,phone,licenseNumber,password
Suresh Kumar,suresh.dryrun@smartroute.internal,+91 94370 11111,OD-02-DL-DRY-01,driver123
Pravat Jena,pravat.dryrun@smartroute.internal,+91 94370 22222,OD-02-DL-DRY-02,driver123`;

      const res = await request(app)
        .post('/api/v1/drivers/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ csvContent: csv, dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dryRun).toBe(true);
      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.created).toBe(2);
      expect(res.body.data.errors).toHaveLength(0);

      // Verify no records inserted
      const driver = await Driver.findOne({ licenseNumber: 'OD-02-DL-DRY-01' });
      expect(driver).toBeNull();
    });

    test('TC-FLEET-10: Commit mode (dryRun=false) persists driver profiles and linked User accounts', async () => {
      const csv = `name,email,phone,licenseNumber,password
Bikash Mohanty,bikash.commit@smartroute.internal,+91 94370 33333,OD-02-DL-COM-01,secret123`;

      const res = await request(app)
        .post('/api/v1/drivers/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ csvContent: csv, dryRun: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dryRun).toBe(false);
      expect(res.body.data.created).toBe(1);
      expect(res.body.data.errors).toHaveLength(0);

      // Verify Driver and User in DB
      const driver = await Driver.findOne({ licenseNumber: 'OD-02-DL-COM-01' }).populate('userId');
      expect(driver).not.toBeNull();
      expect(driver.phone).toBe('+91 94370 33333');
      expect(driver.userId).not.toBeNull();
      expect(driver.userId.email).toBe('bikash.commit@smartroute.internal');
      expect(driver.userId.role).toBe('DRIVER');
    });

    test('TC-FLEET-11: Detects invalid email and intra-file duplicate license numbers', async () => {
      const csv = `name,email,phone,licenseNumber,password
Valid Driver,valid@smartroute.internal,+91 94370 44444,OD-02-DL-DUP-01,driver123
Bad Email Driver,invalid-email-format,+91 94370 55555,OD-02-DL-DUP-02,driver123
Duplicate License Driver,another@smartroute.internal,+91 94370 66666,OD-02-DL-DUP-01,driver123`;

      const res = await request(app)
        .post('/api/v1/drivers/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ csvContent: csv, dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(3);
      expect(res.body.data.errors.length).toBeGreaterThanOrEqual(2);

      const emailErr = res.body.data.errors.find((e) => e.field === 'email');
      expect(emailErr).toBeDefined();
      expect(emailErr.row).toBe(2);

      const licenseErr = res.body.data.errors.find((e) => e.field === 'licenseNumber');
      expect(licenseErr).toBeDefined();
      expect(licenseErr.row).toBe(3);
    });

    test('TC-FLEET-12: Rejects non-authorized DRIVER role with 403 Forbidden', async () => {
      const driverUser = await createTestUser('DRIVER');
      const csv = `name,email,phone,licenseNumber,password
Unauthorized,unauth@smartroute.internal,+91 94370 77777,OD-02-DL-UNAUTH,driver123`;

      const res = await request(app)
        .post('/api/v1/drivers/import-csv')
        .set('Authorization', `Bearer ${driverUser.token}`)
        .send({ csvContent: csv, dryRun: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
