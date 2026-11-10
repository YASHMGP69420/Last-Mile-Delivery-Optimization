const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    target: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    channel: {
      type: String,
      required: true,
      enum: ['EMAIL', 'PHONE'],
    },
    purpose: {
      type: String,
      required: true,
      enum: ['REGISTER', 'LOGIN'],
    },
    codeHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

otpTokenSchema.index({ target: 1, purpose: 1, createdAt: -1 });

const OtpToken = mongoose.model('OtpToken', otpTokenSchema);

module.exports = OtpToken;
