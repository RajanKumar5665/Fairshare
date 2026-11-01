import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import * as subscriptionController from './subscription.controller.js';

const router = Router();

router.use(protect);

router.get('/status', subscriptionController.getMySubscription);
router.post('/create-order', subscriptionController.createRazorpayOrder);
router.post('/verify-payment', subscriptionController.verifyRazorpayPayment);

export default router;
