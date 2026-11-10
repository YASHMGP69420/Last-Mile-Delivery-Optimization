const nodemailer = require('nodemailer');
const env = require('../config/env');

let cachedTransporter = null;

function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return cachedTransporter;
}

/**
 * Sends a 6-digit OTP code via SMTP email when configured, or falls back
 * cleanly to non-production dev console logging.
 */
async function sendEmailOtp(toEmail, code, purpose) {
  const actionLabel = purpose === 'REGISTER' ? 'verify your SmartRoute account' : 'sign in to SmartRoute';
  const transporter = getTransporter();

  if (transporter) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
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
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('SMTP delivery credentials are not configured for production OTP email delivery.');
  }

  if (env.NODE_ENV !== 'test') {
    console.info(`[OTP-DEV][EMAIL] ${toEmail} (${purpose}) => ${code}`);
  }
  return { delivered: true, channel: 'EMAIL', mode: 'DEV_CONSOLE' };
}

/**
 * Sends a 6-digit OTP code via configured SMS webhook gateway, or falls back
 * cleanly to non-production dev console logging.
 */
async function sendSmsOtp(toPhone, code, purpose) {
  const actionLabel = purpose === 'REGISTER' ? 'account registration' : 'sign in';
  if (env.SMS_WEBHOOK_URL) {
    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toPhone,
        code,
        purpose,
        message: `SmartRoute OTP for ${actionLabel}: ${code} (valid ${env.OTP_TTL_MINUTES} min).`,
      }),
    });
    if (!response.ok) {
      throw new Error(`SMS webhook failed with status ${response.status}`);
    }
    return { delivered: true, channel: 'PHONE', mode: 'SMS_WEBHOOK' };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('SMS_WEBHOOK_URL is not configured for production OTP SMS delivery.');
  }

  if (env.NODE_ENV !== 'test') {
    console.info(`[OTP-DEV][SMS] ${toPhone} (${purpose}) => ${code}`);
  }
  return { delivered: true, channel: 'PHONE', mode: 'DEV_CONSOLE' };
}

module.exports = {
  sendEmailOtp,
  sendSmsOtp,
  isSmtpConfigured,
};
