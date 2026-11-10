const crypto = require('crypto');
const OtpToken = require('../models/OtpToken');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const otpDeliveryService = require('./otpDeliveryService');

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function normalizePhone(rawPhone) {
  const trimmed = String(rawPhone || '').trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Resolves identifier & channel into canonical `{ target, channel }`.
 */
function normalizeOtpTarget(identifier, explicitChannel) {
  const raw = String(identifier || '').trim();
  if (!raw) {
    throw new AppError('Email address or phone number is required', 400, 'MISSING_IDENTIFIER');
  }

  const inferredChannel = explicitChannel
    ? String(explicitChannel).toUpperCase()
    : raw.includes('@')
      ? 'EMAIL'
      : 'PHONE';

  if (inferredChannel === 'EMAIL') {
    const email = raw.toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError('Invalid email address format', 400, 'INVALID_IDENTIFIER');
    }
    return { target: email, channel: 'EMAIL' };
  }

  if (inferredChannel === 'PHONE') {
    const phone = normalizePhone(raw);
    if (!phone) {
      throw new AppError('Invalid phone number format (10–15 digits required)', 400, 'INVALID_IDENTIFIER');
    }
    return { target: phone, channel: 'PHONE' };
  }

  throw new AppError('OTP channel must be EMAIL or PHONE', 400, 'INVALID_CHANNEL');
}

function hashValue(value) {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(String(value))
    .digest('hex');
}

function constantTimeHexMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

async function issueOtp({ identifier, channel, purpose }) {
  if (!['REGISTER', 'LOGIN'].includes(purpose)) {
    throw new AppError('Invalid OTP purpose', 400, 'INVALID_OTP_PURPOSE');
  }

  const normalized = normalizeOtpTarget(identifier, channel);
  const cooldownSeconds = Math.max(0, Number(env.OTP_RESEND_COOLDOWN_SECONDS) || 0);

  if (cooldownSeconds > 0) {
    const recentToken = await OtpToken.findOne({
      target: normalized.target,
      purpose,
      verifiedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (recentToken) {
      const elapsedSeconds = (Date.now() - recentToken.createdAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        const retryAfter = Math.ceil(cooldownSeconds - elapsedSeconds);
        throw new AppError(
          `Please wait ${retryAfter}s before requesting another verification code.`,
          429,
          'OTP_RESEND_COOLDOWN'
        );
      }
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const ttlMinutes = Math.max(1, env.OTP_TTL_MINUTES || 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Invalidate prior active OTP records for same target & purpose
  await OtpToken.deleteMany({
    target: normalized.target,
    purpose,
  });

  const tokenDoc = await OtpToken.create({
    target: normalized.target,
    channel: normalized.channel,
    purpose,
    codeHash: hashValue(`${normalized.target}:${purpose}:${code}`),
    attempts: 0,
    maxAttempts: Math.max(1, env.OTP_MAX_ATTEMPTS || 5),
    expiresAt,
  });

  let deliveryResult;
  try {
    deliveryResult =
      normalized.channel === 'EMAIL'
        ? await otpDeliveryService.sendEmailOtp(normalized.target, code, purpose)
        : await otpDeliveryService.sendSmsOtp(normalized.target, code, purpose);
  } catch (err) {
    // Roll back persisted OTP token if out-of-band delivery fails or provider is unconfigured
    await OtpToken.deleteOne({ _id: tokenDoc._id });
    throw err;
  }

  return {
    target: normalized.target,
    channel: normalized.channel,
    purpose,
    expiresInSeconds: ttlMinutes * 60,
    deliveryMode: deliveryResult.mode,
  };
}

async function verifyOtpCode({ identifier, channel, purpose, code }) {
  if (!['REGISTER', 'LOGIN'].includes(purpose)) {
    throw new AppError('Invalid OTP purpose', 400, 'INVALID_OTP_PURPOSE');
  }

  const normalized = normalizeOtpTarget(identifier, channel);
  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new AppError('A 6-digit verification code is required', 400, 'INVALID_OTP_FORMAT');
  }

  const record = await OtpToken.findOne({
    target: normalized.target,
    purpose,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new AppError('Verification code is invalid or has expired', 401, 'OTP_EXPIRED_OR_INVALID');
  }

  if (record.attempts >= record.maxAttempts) {
    await OtpToken.deleteOne({ _id: record._id });
    throw new AppError('Too many failed verification attempts. Request a new code.', 429, 'OTP_MAX_ATTEMPTS');
  }

  const expectedHash = hashValue(`${normalized.target}:${purpose}:${cleanCode}`);
  if (!constantTimeHexMatch(record.codeHash, expectedHash)) {
    record.attempts += 1;
    if (record.attempts >= record.maxAttempts) {
      await OtpToken.deleteOne({ _id: record._id });
      throw new AppError('Too many failed verification attempts. Request a new code.', 429, 'OTP_MAX_ATTEMPTS');
    }
    await record.save();
    throw new AppError('Incorrect verification code', 401, 'INVALID_OTP_CODE');
  }

  const verificationToken = crypto.randomBytes(24).toString('hex');
  record.verifiedAt = new Date();
  record.verificationTokenHash = hashValue(verificationToken);
  await record.save();

  return {
    verified: true,
    target: normalized.target,
    channel: normalized.channel,
    verificationToken,
  };
}

/**
 * Validates and consumes a previously verified OTP (`verificationToken`) OR
 * verifies & consumes a raw 6-digit `otp` code atomically during registration/login.
 */
async function consumeVerifiedOtp({ identifier, channel, purpose, verificationToken, code }) {
  const normalized = normalizeOtpTarget(identifier, channel);

  if (verificationToken && typeof verificationToken === 'string') {
    const tokenHash = hashValue(verificationToken.trim());
    const record = await OtpToken.findOneAndDelete({
      target: normalized.target,
      purpose,
      verificationTokenHash: tokenHash,
      verifiedAt: { $ne: null },
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      throw new AppError('OTP verification session expired or invalid. Please verify again.', 401, 'OTP_VERIFICATION_REQUIRED');
    }
    return { target: record.target, channel: record.channel };
  }

  if (code) {
    const verified = await verifyOtpCode({ identifier, channel, purpose, code });
    await OtpToken.deleteMany({ target: verified.target, purpose });
    return { target: verified.target, channel: verified.channel };
  }

  throw new AppError('Verified OTP proof is required before continuing', 400, 'OTP_VERIFICATION_REQUIRED');
}

module.exports = {
  normalizeOtpTarget,
  normalizePhone,
  issueOtp,
  verifyOtpCode,
  consumeVerifiedOtp,
};
