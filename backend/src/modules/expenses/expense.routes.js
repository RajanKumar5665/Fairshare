import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import * as expenseController from './expense.controller.js';

const router = Router();
router.use(protect);

// ─── Expense CRUD ─────────────────────────────────────────────────────────────
router.post('/', expenseController.createExpense);
router.get('/personal', expenseController.listPersonalExpenses);
router.get('/monthly-summary', expenseController.getMonthlySummary);
router.get('/:expenseId', expenseController.getExpense);
router.patch('/:expenseId', expenseController.updateExpense);
router.delete('/:expenseId', expenseController.cancelExpense);

// ─── Room-scoped endpoints ────────────────────────────────────────────────────
router.get('/room/:roomId', expenseController.listRoomExpenses);
router.get('/room/:roomId/balances', expenseController.getRoomBalances);
router.get('/room/:roomId/suggestions', expenseController.getSuggestedSettlements);
router.get('/room/:roomId/settlements', expenseController.listRoomSettlements);
router.post('/settlements', expenseController.recordSettlement);
router.patch('/room/:roomId/settlements/:settlementId/confirm', expenseController.confirmSettlement);
router.post('/room/:roomId/settlements/:settlementId/reverse', expenseController.reverseSettlement);

export default router;