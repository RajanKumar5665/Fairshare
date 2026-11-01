import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/admin.middleware.js';
import * as adminController from './admin.controller.js';

const router = Router();

router.use(protect, requireAdmin);
router.get('/overview', adminController.overview);
router.get('/rooms', adminController.rooms);
router.patch('/rooms/:roomId/subscription', adminController.updateSubscription);
router.post('/rooms/:roomId/notices', adminController.sendNotice);
router.delete('/rooms/:roomId/members/:userId', adminController.removeMember);
router.delete('/rooms/:roomId', adminController.archiveRoom);

export default router;
