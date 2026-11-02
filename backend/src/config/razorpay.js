import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from './env.js';

function cleanCredential(value) {
  const cleaned = String(value || '').trim();
  if (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    return cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

const rawKeyId = cleanCredential(env.RAZORPAY_KEY_ID);
const rawKeySecret = cleanCredential(env.RAZORPAY_KEY_SECRET);

// Auto-detect mode if not explicitly set or if key prefix dictates it
let mode = (env.RAZORPAY_MODE || '').trim().toLowerCase();
if (rawKeyId.startsWith('rzp_live_')) {
  mode = 'live';
} else if (rawKeyId.startsWith('rzp_test_')) {
  mode = 'test';
} else if (!mode) {
  mode = 'test';
}

const isMockCredential =
  env.NODE_ENV === 'test' ||
  !rawKeyId ||
  rawKeyId.includes('placeholder') ||
  rawKeySecret.includes('placeholder');

let razorpay = null;
if (rawKeyId && rawKeySecret && !isMockCredential) {
  try {
    razorpay = new Razorpay({
      key_id: rawKeyId,
      key_secret: rawKeySecret,
    });
  } catch (err) {
    console.error('Failed to initialize Razorpay SDK:', err.message);
  }
}

export function isRazorpayReady() {
  return Boolean(razorpay) && !isMockCredential;
}

export function getRazorpayKeyId() {
  return rawKeyId;
}

/**
 * Create a real or test Razorpay order
 */
export async function createRazorpayOrder({
  amountInPaise,
  receipt,
  notes = {},
}) {
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
    const err = new Error('Invalid payment amount. Amount must be a positive integer in paise.');
    err.statusCode = 400;
    throw err;
  }

  // Fallback to mock in development/test if keys not yet configured
  if (isMockCredential || !razorpay) {
    if (env.NODE_ENV === 'production' && !isMockCredential) {
      const err = new Error('Razorpay is not properly configured on server. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      err.statusCode = 400;
      throw err;
    }

    return {
      orderId: `order_test_${crypto.randomBytes(12).toString('hex')}`,
      amount: amountInPaise,
      currency: 'INR',
      keyId: rawKeyId || 'rzp_test_mock',
      isMock: true,
    };
  }

  try {
    // Razorpay receipt max length is 40 characters
    const cleanReceipt = String(receipt || `rcpt_${Date.now()}`).slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: cleanReceipt,
      notes,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: rawKeyId,
      isMock: false,
    };
  } catch (apiErr) {
    console.error('Razorpay API order creation failed:', apiErr);
    const detail =
      apiErr?.error?.description ||
      apiErr?.error?.message ||
      apiErr?.description ||
      apiErr?.message ||
      'Razorpay order creation failed';
    const message = /authentication failed/i.test(detail)
      ? 'Razorpay authentication failed. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be a matching pair from the same Razorpay mode (test or live).'
      : `Razorpay Error: ${detail}`;
    const err = new Error(message);
    err.statusCode = 400; // Returns 400 so production errorHandler does not mask it as 500 Internal server error
    throw err;
  }
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

  if (isMockCredential) {
    return true;
  }

  if (!rawKeySecret) {
    return false;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', rawKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature.toLowerCase() === String(signature).toLowerCase();
  } catch (err) {
    console.error('Razorpay signature verification error:', err.message);
    return false;
  }
}
