import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { requireRoomMember } from '../../middlewares/room.middleware.js';
import * as expenseController from './expense.controller.js';

const router = Router();
router.use(protect);

// ─── Expense CRUD (ownership/membership checked in the service) ──────────────
router.post('/', expenseController.createExpense);
router.get('/personal', expenseController.listPersonalExpenses);
router.get('/monthly-summary', expenseController.getMonthlySummary);
router.get('/pending-approvals', expenseController.listMyPendingApprovals);
router.post('/settlements', expenseController.recordSettlement);

// ─── Room-scoped endpoints (members only) ─────────────────────────────────────
router.get('/room/:roomId', requireRoomMember(), expenseController.listRoomExpenses);
router.get('/room/:roomId/balances', requireRoomMember(), expenseController.getRoomBalances);
router.get('/room/:roomId/suggestions', requireRoomMember(), expenseController.getSuggestedSettlements);
router.get('/room/:roomId/settlements', requireRoomMember(), expenseController.listRoomSettlements);
router.patch('/room/:roomId/settlements/:settlementId/confirm', requireRoomMember(), expenseController.confirmSettlement);
router.post('/room/:roomId/settlements/:settlementId/reverse', requireRoomMember(), expenseController.reverseSettlement);

router.get('/:expenseId', expenseController.getExpense);
router.patch('/:expenseId', expenseController.updateExpense);
router.delete('/:expenseId', expenseController.cancelExpense);

export default router;
