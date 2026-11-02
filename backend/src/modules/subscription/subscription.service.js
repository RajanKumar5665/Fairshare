import { Subscription } from '../../models/subscription.model.js';
import { User } from '../../models/user.model.js';
import { env } from '../../config/env.js';
import { createRazorpayOrder, verifyRazorpaySignature, isRazorpayReady } from '../../config/razorpay.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getRoomSubscription(roomId) {
  let sub = await Subscription.findOne({ roomId });
  if (!sub) {
    // Auto-initialize 30-day trial for room
    sub = await Subscription.create({
      roomId,
      plan: 'pro_room',
      priceInRupees: 50,
      status: 'trial',
      billingScope: 'room',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isTrial: true,
    });
  }

  // Check if trial or period has expired
  const now = new Date();
  if (sub.currentPeriodEnd < now && sub.status !== 'expired') {
    sub.status = 'expired';
    await sub.save();
  }

  return sub;
}

export async function getMySubscription(userId) {
  const user = await User.findById(userId).select('roomSubscription name email mobile');
  if (!user) throw new AppError('User not found', 404);

  const sub = user.roomSubscription || { status: 'none', amountPaid: 0 };
  const now = new Date();
  const isActive = sub.status === 'active' && sub.validUntil && new Date(sub.validUntil) > now;

  // First month: ₹1. Subsequent renewal: ₹50.
  const isFirstTime = !sub.amountPaid || sub.amountPaid === 0;
  const currentPrice = isFirstTime ? 1 : 50;

  return {
    status: isActive ? 'active' : (sub.status === 'active' ? 'expired' : 'none'),
    isActive,
    plan: isFirstTime ? 'starter_1rs' : 'standard_50rs',
    priceInRupees: currentPrice,
    isFirstTime,
    validUntil: sub.validUntil,
    paidAt: sub.paidAt,
  };
}

export async function initiateRazorpaySubscription(userId, { plan } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (!isRazorpayReady() && env.NODE_ENV !== 'test') {
    throw new AppError(
      'Razorpay is not configured on the server. Set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables on Render.',
      503
    );
  }

  const sub = user.roomSubscription || {};
  const isFirstTime = !sub.amountPaid || sub.amountPaid === 0;
  const priceInRupees = isFirstTime ? 1 : 50;
  const amountInPaise = priceInRupees * 100;

  const orderData = await createRazorpayOrder({
    amountInPaise,
    receipt: `sub_${user._id.toString().slice(-6)}_${Date.now()}`,
    notes: {
      userId: user._id.toString(),
      plan: isFirstTime ? 'starter_1rs' : 'standard_50rs',
    },
  });

  return {
    ...orderData,
    plan: isFirstTime ? 'starter_1rs' : 'standard_50rs',
    priceInRupees,
    isFirstTime,
    isRazorpayLive: isRazorpayReady(),
    user: {
      name: user.name,
      email: user.email || '',
      mobile: user.mobile || '',
    },
  };
}

export async function confirmRazorpaySubscription(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || (!razorpay_signature && env.NODE_ENV !== 'test')) {
    throw new AppError('Missing Razorpay payment identifiers. Payment cannot be verified.', 400);
  }

  const isValid = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isValid) {
    throw new AppError('Invalid payment signature. Subscription cannot be activated without verified payment.', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const sub = user.roomSubscription || {};
  const isFirstTime = !sub.amountPaid || sub.amountPaid === 0;
  const amountPaid = isFirstTime ? 1 : 50;

  const now = new Date();
  const startFrom = (sub.validUntil && new Date(sub.validUntil) > now) ? new Date(sub.validUntil) : now;
  const validUntil = new Date(startFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  user.roomSubscription = {
    status: 'active',
    plan: isFirstTime ? 'starter_1rs' : 'standard_50rs',
    amountPaid: (sub.amountPaid || 0) + amountPaid,
    validUntil,
    paymentMethod: 'Razorpay',
    razorpayPaymentId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id,
    razorpaySignature: razorpay_signature || '',
    paidAt: now,
  };

  await user.save();

  return {
    success: true,
    message: isFirstTime
      ? 'First month ₹1 payment successful! Room creation unlocked.'
      : '₹50 renewal successful! Room subscription active for 30 days.',
    subscription: user.roomSubscription,
  };
}
