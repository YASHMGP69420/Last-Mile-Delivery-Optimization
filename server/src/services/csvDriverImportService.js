// server/src/services/csvDriverImportService.js
const Papa = require('papaparse');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { ROLES, DRIVER_AVAILABILITY, AUDIT_EVENT_TYPES } = require('../config/constants');
const { recordAuditEvent } = require('./auditService');

/** Helper to safely trim string values */
const safeTrim = (val, def = '') => (val === undefined || val === null ? def : String(val).trim());

/** Parse CSV text into rows */
const parseCsv = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return { data: [], errors: [] };
  return Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
  });
};

/** Validate a single driver row */
const validateRow = async (row, rowIndex, existingEmails, existingLicenses) => {
  const errors = [];

  // Name
  const name = safeTrim(row.name || row.Name || row.driverName || row.fullName);
  if (!name || name.length < 2) {
    errors.push({ row: rowIndex, field: 'name', message: 'Driver name is required (min 2 characters)' });
  }

  // Email
  const email = safeTrim(row.email || row.Email || row.emailAddress).toLowerCase();
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!email) {
    errors.push({ row: rowIndex, field: 'email', message: 'Email address is required' });
  } else if (!emailRegex.test(email)) {
    errors.push({ row: rowIndex, field: 'email', message: `Invalid email format '${email}'` });
  } else if (existingEmails.has(email)) {
    errors.push({ row: rowIndex, field: 'email', message: `Duplicate email '${email}' in CSV file` });
  } else {
    existingEmails.add(email);
  }

  // Phone
  const phone = safeTrim(row.phone || row.Phone || row.phoneNumber || row.contact);
  if (!phone) {
    errors.push({ row: rowIndex, field: 'phone', message: 'Phone number is required' });
  }

  // License Number
  const licenseNumber = safeTrim(
    row.licenseNumber || row.license || row.License || row.dlNumber || row.drivingLicense
  ).toUpperCase();
  if (!licenseNumber) {
    errors.push({ row: rowIndex, field: 'licenseNumber', message: 'Commercial license number is required' });
  } else if (existingLicenses.has(licenseNumber)) {
    errors.push({
      row: rowIndex,
      field: 'licenseNumber',
      message: `Duplicate licenseNumber '${licenseNumber}' in CSV file`,
    });
  } else {
    existingLicenses.add(licenseNumber);
  }

  // Password (optional, default 'driver123')
  const password = safeTrim(row.password || row.Password, 'driver123');

  // Check database collisions if intra-row checks passed
  if (email && emailRegex.test(email)) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const existingDriver = await Driver.findOne({ userId: existingUser._id });
      if (existingDriver) {
        errors.push({
          row: rowIndex,
          field: 'email',
          message: `User with email '${email}' is already registered as an active driver`,
        });
      }
    }
  }

  if (licenseNumber) {
    const existingDriverByLicense = await Driver.findOne({ licenseNumber });
    if (existingDriverByLicense) {
      errors.push({
        row: rowIndex,
        field: 'licenseNumber',
        message: `License number '${licenseNumber}' is already registered in the system`,
      });
    }
  }

  const driverData = {
    name,
    email,
    phone,
    licenseNumber,
    password,
  };

  return { errors, driverData };
};

/**
 * Process Driver CSV – bulk create drivers with user accounts (dryRun supported)
 */
const processDriverCsv = async (csvText, options = {}) => {
  const { dryRun = true, actor = null } = options;
  const { data: rows, errors: parseErrors } = parseCsv(csvText);

  const existingEmails = new Set();
  const existingLicenses = new Set();
  const summary = {
    dryRun,
    totalRows: rows.length,
    created: 0,
    errors: [],
    preview: [],
  };

  if (!rows || rows.length === 0) {
    if (parseErrors.length) {
      summary.errors.push(...parseErrors.map((e) => ({ row: e.row || 0, field: 'parse', message: e.message })));
    }
    return summary;
  }

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 1;
    const { errors, driverData } = await validateRow(rows[i], rowIndex, existingEmails, existingLicenses);

    if (errors.length > 0) {
      summary.errors.push(...errors);
      continue;
    }

    if (dryRun) {
      // In dryRun, keep preview up to first 10 valid records
      if (summary.preview.length < 10) {
        summary.preview.push({
          row: rowIndex,
          name: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          licenseNumber: driverData.licenseNumber,
        });
      }
      summary.created += 1;
    } else {
      // Write mode: find or create User, then create Driver
      let user = await User.findOne({ email: driverData.email });
      if (!user) {
        const passwordHash = await bcrypt.hash(driverData.password || 'driver123', 10);
        user = new User({
          name: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          role: ROLES.DRIVER,
          passwordHash,
        });
        await user.save();
      } else {
        if (!user.phone && driverData.phone) {
          user.phone = driverData.phone;
          await user.save();
        }
      }

      const driver = new Driver({
        userId: user._id,
        licenseNumber: driverData.licenseNumber,
        phone: driverData.phone,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
      });
      await driver.save();

      if (actor) {
        await recordAuditEvent({
          type: AUDIT_EVENT_TYPES.CSV_IMPORTED,
          actorId: actor.id || actor._id,
          actorRole: actor.role,
          action: `Imported driver ${driverData.name} (${driverData.licenseNumber}) via CSV`,
          metadata: { driverId: driver._id, licenseNumber: driver.licenseNumber, email: driverData.email },
        });
      }

      summary.created += 1;
    }
  }

  // Merge Papa Parse formatting warnings/errors
  if (parseErrors.length) {
    summary.errors.push(...parseErrors.map((e) => ({ row: e.row || 0, field: 'parse', message: e.message })));
  }

  return summary;
};

module.exports = {
  processDriverCsv,
};
