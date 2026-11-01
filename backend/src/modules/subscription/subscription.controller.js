import * as subscriptionService from './subscription.service.js';

export async function getSubscription(req, res, next) {
  try {
    const subscription = await subscriptionService.getRoomSubscription(req.params.roomId);
    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
}

export async function getMySubscription(req, res, next) {
  try {
    const data = await subscriptionService.getMySubscription(req.userId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function createRazorpayOrder(req, res, next) {
  try {
    const orderData = await subscriptionService.initiateRazorpaySubscription(req.userId, req.body);
    res.json({ success: true, ...orderData });
  } catch (err) {
    next(err);
  }
}

export async function verifyRazorpayPayment(req, res, next) {
  try {
    const result = await subscriptionService.confirmRazorpaySubscription(req.userId, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
} 

