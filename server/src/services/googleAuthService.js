const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');

let cachedClientId = null;
let cachedOAuthClient = null;

function getOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID) {
    return null;
  }
  if (!cachedOAuthClient || cachedClientId !== env.GOOGLE_CLIENT_ID) {
    cachedClientId = env.GOOGLE_CLIENT_ID;
    cachedOAuthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return cachedOAuthClient;
}

/**
 * Verifies a Google Identity Services ID token signature, expiry, issuer,
 * and audience against env.GOOGLE_CLIENT_ID.
 */
async function verifyGoogleIdToken(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new AppError('Google ID token credential is required', 400, 'INVALID_GOOGLE_AUTH');
  }

  const client = getOAuthClient();
  if (!client) {
    throw new AppError(
      'Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID).',
      503,
      'GOOGLE_AUTH_UNCONFIGURED'
    );
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    throw new AppError('Invalid or expired Google Sign-In credential', 401, 'INVALID_GOOGLE_TOKEN');
  }

  const payload = ticket && typeof ticket.getPayload === 'function' ? ticket.getPayload() : null;
  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError('Google account email is not verified', 401, 'GOOGLE_EMAIL_UNVERIFIED');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
    emailVerified: true,
  };
}

module.exports = {
  verifyGoogleIdToken,
};
