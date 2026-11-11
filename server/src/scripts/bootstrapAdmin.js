require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const WEAK_ADMIN_PASSWORDS = new Set([
  'admin123',
  'password123',
  'changeme',
  'your_admin_password_here',
  'password',
  'admin',
  '1234567890',
  'smartroute123',
]);

/**
 * Validate and normalize admin bootstrap environment configuration before any DB connection.
 * @param {Record<string, string | undefined>} [sourceEnv=process.env]
 * @returns {{ email: string, password: string, name: string }}
 */
function validateBootstrapConfig(sourceEnv = process.env) {
  const envSource = sourceEnv || {};

  const rawEmail = typeof envSource.ADMIN_EMAIL === 'string' ? envSource.ADMIN_EMAIL.trim().toLowerCase() : '';
  if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }

  const rawPassword = envSource.ADMIN_PASSWORD;
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    throw new Error('ADMIN_PASSWORD is required');
  }
  const trimmedPassword = rawPassword.trim();
  if (rawPassword.length < 10 || trimmedPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 non-whitespace characters');
  }
  const loweredPassword = trimmedPassword.toLowerCase();
  if (
    WEAK_ADMIN_PASSWORDS.has(loweredPassword) ||
    loweredPassword.includes('your_admin_password') ||
    loweredPassword.includes('changeme')
  ) {
    throw new Error('ADMIN_PASSWORD must not be a weak or placeholder password');
  }

  const rawName = typeof envSource.ADMIN_NAME === 'string' ? envSource.ADMIN_NAME.trim() : '';
  const name = rawName || 'SmartRoute Admin';
  if (name.length < 2 || name.length > 100) {
    throw new Error('ADMIN_NAME must be between 2 and 100 characters');
  }

  return {
    email: rawEmail,
    password: rawPassword,
    name,
  };
}

/**
 * Idempotently create the initial non-demo ADMIN user via Mongoose User hooks.
 * @param {Record<string, string | undefined>} [sourceEnv=process.env]
 */
async function bootstrapAdmin(sourceEnv = process.env) {
  const { email, password, name } = validateBootstrapConfig(sourceEnv);

  const existing = await User.findOne({
    $or: [{ email }, { role: ROLES.ADMIN, isDemoData: false, active: true }],
  }).select('_id email role isDemoData active');

  if (existing) {
    const reason = existing.email === email ? 'matching_email' : 'existing_non_demo_admin';
    console.log(
      `[BootstrapAdmin] Skipping creation (${reason}): existing ${existing.role} (${existing.email}) preserved without modifying or overwriting passwords.`
    );
    return {
      created: false,
      skipped: true,
      reason,
      user: existing,
    };
  }

  const user = await User.create({
    name,
    email,
    passwordHash: password,
    role: ROLES.ADMIN,
    emailVerified: true,
    active: true,
    accountStatus: 'ACTIVE',
    isDemoData: false,
  });

  console.log(`[BootstrapAdmin] Created non-demo ADMIN user ${user.email} (id=${user._id}).`);

  return {
    created: true,
    skipped: false,
    reason: 'created',
    user,
  };
}

/**
 * CLI entrypoint: validate credentials before opening MongoDB, then execute idempotent bootstrap.
 */
async function runCli() {
  try {
    validateBootstrapConfig(process.env);
    await connectDB();
    await bootstrapAdmin(process.env);
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`[BootstrapAdmin] Error: ${err.message}`);
    try {
      await disconnectDB();
    } catch {
      // Ignore disconnect cleanup error
    }
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  validateBootstrapConfig,
  bootstrapAdmin,
  runCli,
  WEAK_ADMIN_PASSWORDS,
};
