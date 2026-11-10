const nodemailer = require('nodemailer');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');

let cachedSignature = null;
let cachedTransporter = null;

function isSmtpConfigured() {
  return Boolean((env.SMTP_SERVICE || env.SMTP_HOST) && env.SMTP_USER && env.SMTP_PASS);
}

function getSmsProvider() {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    return 'TWILIO';
  }
  if (env.FAST2SMS_API_KEY) {
    return 'FAST2SMS';
  }
  if (env.SMS_WEBHOOK_URL) {
    return 'SMS_WEBHOOK';
  }
  return null;
}

function isSmsConfigured() {
  return Boolean(getSmsProvider());
}

function getOtpProviderStatus() {
  const emailConfigured = isSmtpConfigured();
  const smsProvider = getSmsProvider();
  return {
    emailConfigured,
    smsConfigured: Boolean(smsProvider),
    emailProvider: emailConfigured ? env.SMTP_SERVICE || env.SMTP_HOST : null,
    smsProvider,
  };
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;

  const signature = JSON.stringify([
    env.SMTP_SERVICE,
    env.SMTP_HOST,
    env.SMTP_PORT,
    env.SMTP_SECURE,
    env.SMTP_USER,
    env.SMTP_PASS,
  ]);

  if (!cachedTransporter || cachedSignature !== signature) {
    cachedSignature = signature;
    const transportConfig = env.SMTP_SERVICE
      ? {
          service: env.SMTP_SERVICE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        }
      : {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        };
    cachedTransporter = nodemailer.createTransport(transportConfig);
  }
  return cachedTransporter;
}

/**
 * Sends a 6-digit OTP code via configured SMTP provider (e.g., Gmail App Password,
 * Brevo, Resend). Throws 503 if unconfigured or 502 if SMTP delivery fails.
 */
async function sendEmailOtp(toEmail, code, purpose) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new AppError(
      'Email OTP delivery is not configured on the server. Set SMTP_USER and SMTP_PASS (with SMTP_SERVICE or SMTP_HOST) in server/.env.',
      503,
      'EMAIL_OTP_UNCONFIGURED'
    );
  }

  const actionLabel =
    purpose === 'REGISTER' ? 'verify your SmartRoute driver account' : 'sign in to SmartRoute';

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: toEmail,
      subject: `SmartRoute Verification Code: ${code}`,
      text: `Use verification code ${code} to ${actionLabel}. This code expires in ${env.OTP_TTL_MINUTES} minutes.`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="margin: 0 0 12px; color: #059669; font-size: 18px;">SmartRoute Logistics Verification</h2>
          <p style="margin: 0 0 16px; color: #334155; font-size: 14px;">Use the 6-digit code below to ${actionLabel}:</p>
          <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 14px 18px; background: #f1f5f9; border-radius: 8px; text-align: center; color: #0f172a;">
            ${code}
          </div>
          <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">Expires in ${env.OTP_TTL_MINUTES} minutes. If you did not request this code, ignore this message.</p>
        </div>
      `,
    });
    return { delivered: true, channel: 'EMAIL', mode: 'SMTP' };
  } catch (err) {
    throw new AppError(
      `Failed to send verification email via SMTP: ${err.message || 'transport error'}`,
      502,
      'OTP_DELIVERY_FAILED'
    );
  }
}

/**
 * Sends a 6-digit OTP code via configured SMS provider (Twilio REST API,
 * Fast2SMS, or SMS_WEBHOOK_URL). Throws 503 if unconfigured.
 */
async function sendSmsOtp(toPhone, code, purpose) {
  const provider = getSmsProvider();
  if (!provider) {
    throw new AppError(
      'SMS OTP delivery is not configured on the server. Configure Twilio, Fast2SMS, or SMS_WEBHOOK_URL in server/.env, or verify via Email OTP.',
      503,
      'SMS_OTP_UNCONFIGURED'
    );
  }

  const actionLabel = purpose === 'REGISTER' ? 'account registration' : 'sign in';
  const message = `SmartRoute OTP for ${actionLabel}: ${code}. Valid for ${env.OTP_TTL_MINUTES} min.`;

  try {
    if (provider === 'TWILIO') {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        env.TWILIO_ACCOUNT_SID
      )}/Messages.json`;
      const basicAuth = Buffer.from(
        `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
        'utf8'
      ).toString('base64');
      const formBody = new URLSearchParams({
        To: toPhone,
        From: env.TWILIO_FROM_NUMBER,
        Body: message,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Twilio API ${response.status}: ${errText || response.statusText}`);
      }
      return { delivered: true, channel: 'PHONE', mode: 'TWILIO' };
    }

    if (provider === 'FAST2SMS') {
      const digits = String(toPhone).replace(/\D/g, '');
      const localNumber = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
      const route = env.FAST2SMS_ROUTE || 'otp';
      const payload =
        route === 'otp'
          ? { route: 'otp', variables_values: code, numbers: localNumber }
          : { route, message, numbers: localNumber };

      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Fast2SMS API ${response.status}: ${errText || response.statusText}`);
      }
      return { delivered: true, channel: 'PHONE', mode: 'FAST2SMS' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (env.SMS_WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = env.SMS_WEBHOOK_SECRET;
    }
    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to: toPhone, code, purpose, message }),
    });
    if (!response.ok) {
      throw new Error(`SMS webhook failed with status ${response.status}`);
    }
    return { delivered: true, channel: 'PHONE', mode: 'SMS_WEBHOOK' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `Failed to deliver SMS verification code: ${err.message || 'gateway error'}`,
      502,
      'OTP_DELIVERY_FAILED'
    );
  }
}

module.exports = {
  sendEmailOtp,
  sendSmsOtp,
  isSmtpConfigured,
  isSmsConfigured,
  getSmsProvider,
  getOtpProviderStatus,
};
