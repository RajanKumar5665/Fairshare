
import { Otp } from '../../models/otp.model.js';
import { User } from '../../models/user.model.js';
import { env } from '../../config/env.js';

let twilioClient = null;

async function getTwilio() {
  if (twilioClient) return twilioClient;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials are missing');
  }

  const twilio = (await import('twilio')).default;

  twilioClient = twilio(
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN
  );

  return twilioClient;
}

function normalizeMobile(mobile) {
  const normalized = mobile.replace(/[^\d+]/g, '');

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw Object.assign(
      new Error('Enter a valid mobile number with country code'),
      { statusCode: 400 }
    );
  }

  return normalized;
}

export async function sendOtp(mobile) {
  const normalized = normalizeMobile(mobile);

  if (env.NODE_ENV === 'production') {
    const recent = await Otp.countDocuments({
      mobile: normalized,
      createdAt: {
        $gte: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    if (recent >= 5) {
      throw Object.assign(
        new Error('Too many OTP requests. Try again later.'),
        { statusCode: 429 }
      );
    }
  }

  const client = await getTwilio();

  const verification = await client.verify.v2
    .services(env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({
      to: normalized,
      channel: 'sms',
    });

  return {
    sent: verification.status === 'pending',
    status: verification.status,
    mobile: normalized,
  };
}

export async function verifyOtp(mobile, code) {
  const normalized = normalizeMobile(mobile);

  if (!/^\d{6}$/.test(String(code))) {
    throw Object.assign(
      new Error('Invalid OTP format'),
      { statusCode: 400 }
    );
  }

  const client = await getTwilio();

  const verificationCheck = await client.verify.v2
    .services(env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({
      to: normalized,
      code: String(code),
    });

  if (verificationCheck.status !== 'approved') {
    throw Object.assign(
      new Error('Invalid or expired OTP'),
      { statusCode: 400 }
    );
  }

  const user = await User.findOne({ mobile: normalized });

  if (!user) {
    return {
      verified: true,
      isNew: true,
      mobile: normalized,
    };
  }

  return {
    verified: true,
    isNew: false,
    user,
  };
}

export async function createMobileUser(mobile, name) {
  const normalized = normalizeMobile(mobile);

  const existing = await User.findOne({
    mobile: normalized,
  });

  if (existing) return existing;

  return User.create({
    name,
    mobile: normalized,
    mobileVerified: true,
    authProviders: ['mobile'],
  });
}
