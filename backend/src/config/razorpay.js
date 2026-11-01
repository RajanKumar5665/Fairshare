
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from './env.js';

// Only test and live modes are supported
const mode = env.RAZORPAY_MODE;

if (!['test', 'live'].includes(mode)) {
  throw new Error('RAZORPAY_MODE must be either test or live');
}

// Validate credentials
if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
  throw new Error('Razorpay API credentials are missing');
}

// Ensure credentials match selected environment
if (
  mode === 'test' &&
  !env.RAZORPAY_KEY_ID.startsWith('rzp_test_')
) {
  throw new Error('Test mode requires rzp_test_ credentials');
}

if (
  mode === 'live' &&
  !env.RAZORPAY_KEY_ID.startsWith('rzp_live_')
) {
  throw new Error('Live mode requires rzp_live_ credentials');
}

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export function isRazorpayReady() {
  return Boolean(razorpay);
}

export function getRazorpayKeyId() {
  return env.RAZORPAY_KEY_ID;
}

/**
 * Create a real Razorpay order
 */
export async function createRazorpayOrder({
  amountInPaise,
  receipt,
  notes = {},
}) {
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise <= 0
  ) {
    throw new Error('Invalid payment amount');
  }

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: String(receipt || `rcpt_${Date.now()}`),
    notes,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
    isMock: false,
  };
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest();

    const receivedSignature = Buffer.from(signature, 'hex');

    if (receivedSignature.length !== generatedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      generatedSignature,
      receivedSignature
    );
  } catch (err) {
    console.error(
      'Razorpay signature verification error:',
      err.message
    );
    return false;
  }
}
