// server/src/services/csvFleetImportService.js
const Papa = require('papaparse');
const Fleet = require('../models/Fleet');
const { AppError } = require('../middleware/errorHandler');

/** Trim helper */
const safeTrim = (val, def = '') => (val === undefined || val === null ? def : String(val).trim());

/** Parse CSV text */
const parseCsv = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return { data: [], errors: [] };
  return Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
  });
};

/** Validate a single fleet row */
const validateRow = (row, rowIndex, existingNames) => {
  const errors = [];
  const name = safeTrim(row.name || row.Name || row.fleetName);
  if (!name) {
    errors.push({ row: rowIndex, field: 'name', message: 'Fleet name is required' });
  } else if (existingNames.has(name)) {
    errors.push({ row: rowIndex, field: 'name', message: `Duplicate fleet name '${name}' in file` });
  } else {
    existingNames.add(name);
  }
  const description = safeTrim(row.description || row.Description || row.desc, '');
  const ownerEmail = safeTrim(row.ownerEmail || row.owner_email || row.owner);
  return { errors, fleetData: { name, description, ownerEmail } };
};

/** Process CSV -> create Fleet records (dryRun optional) */
const processFleetCsv = async (csvText, options = {}) => {
  const { dryRun = true } = options;
  const { data: rows, errors: parseErrors } = parseCsv(csvText);
  const existingNames = new Set();
  const summary = { dryRun, totalRows: rows.length, created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const { errors, fleetData } = validateRow(rows[i], i + 1, existingNames);
    if (errors.length) {
      summary.errors.push(...errors);
      continue;
    }
    // Resolve ownerId if ownerEmail provided
    let ownerId = undefined;
    if (fleetData.ownerEmail) {
      const User = require('../models/User');
      const user = await User.findOne({ email: fleetData.ownerEmail.toLowerCase().trim() });
      if (!user) {
        summary.errors.push({ row: i + 1, field: 'ownerEmail', message: `Owner email '${fleetData.ownerEmail}' not found` });
        continue;
      }
      ownerId = user._id;
    }
    if (!dryRun) {
      const fleet = new Fleet({ name: fleetData.name, description: fleetData.description, ownerId });
      await fleet.save();
    }
    summary.created += 1;
  }
  if (parseErrors.length) summary.errors.push(...parseErrors.map(e => ({ row: e.row, field: 'parse', message: e.message })));
  return summary;
};

module.exports = { processFleetCsv };
