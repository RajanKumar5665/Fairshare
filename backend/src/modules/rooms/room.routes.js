import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { requireRoomMember } from '../../middlewares/room.middleware.js';
import * as roomController from './room.controller.js';
import * as expenseController from '../expenses/expense.controller.js';
import * as recurringController from '../recurring/recurring.controller.js';
import * as disputeController from '../disputes/dispute.controller.js';
import * as chatController from '../chat/chat.controller.js';
import * as subscriptionController from '../subscription/subscription.controller.js';

const router = Router();

// Public invitation preview route (safe preview, no authentication required)
router.get('/invitations/info', roomController.getInvitationInfo);

// All following routes require authentication
router.use(protect);

router.post('/', roomController.createRoom);
router.get('/', roomController.listRooms);
router.post('/join', roomController.join);

router.get('/:roomId', requireRoomMember(), roomController.getRoom);
router.patch('/:roomId', requireRoomMember(['owner', 'admin']), roomController.updateRoom);
router.delete('/:roomId', requireRoomMember(['owner']), roomController.deleteRoom);
router.post('/:roomId/leave', requireRoomMember(), roomController.leaveRoom);
router.post('/:roomId/transfer-ownership', requireRoomMember(['owner']), roomController.transferOwnership);

router.get('/:roomId/expenses', requireRoomMember(), roomController.listExpenses);
router.get('/:roomId/balances', requireRoomMember(), roomController.getBalances);
router.get('/:roomId/suggestions', requireRoomMember(), expenseController.getSuggestedSettlements);
router.get('/:roomId/settlements', requireRoomMember(), expenseController.listRoomSettlements);
router.post('/:roomId/settlements', requireRoomMember(), expenseController.recordSettlement);
router.patch('/:roomId/settlements/:settlementId/confirm', requireRoomMember(), expenseController.confirmSettlement);
router.post('/:roomId/settlements/:settlementId/reverse', requireRoomMember(), expenseController.reverseSettlement);

// ─── Dashboard (Phase 8) ──────────────────────────────────────────────────────
router.get('/:roomId/dashboard', requireRoomMember(), roomController.getDashboard);

// ─── Recurring Bills & Move-In/Move-Out (Phase 5) ─────────────────────────────
router.post('/:roomId/recurring', requireRoomMember(['owner', 'admin']), recurringController.createRecurringBill);
router.get('/:roomId/recurring', requireRoomMember(), recurringController.listRecurringBills);
router.patch('/:roomId/recurring/:billId', requireRoomMember(['owner', 'admin']), recurringController.updateRecurringBill);
router.delete('/:roomId/recurring/:billId', requireRoomMember(['owner', 'admin']), recurringController.deleteRecurringBill);
router.post('/:roomId/recurring/:billId/generate', requireRoomMember(), recurringController.generateDueExpense);

// ─── Expense Disputes & Approvals (Phase 6) ───────────────────────────────────
router.post('/:roomId/expenses/:expenseId/disputes', requireRoomMember(), disputeController.raiseDispute);
router.get('/:roomId/disputes', requireRoomMember(), disputeController.listDisputes);
router.post('/:roomId/disputes/:disputeId/comments', requireRoomMember(), disputeController.addComment);
router.post('/:roomId/disputes/:disputeId/resolve', requireRoomMember(), disputeController.resolveDispute);

// ─── Room Chat & Announcements (Phase 7) ──────────────────────────────────────
router.post('/:roomId/messages', requireRoomMember(), chatController.sendMessage);
router.get('/:roomId/messages', requireRoomMember(), chatController.getMessages);
router.post('/:roomId/messages/:messageId/pin', requireRoomMember(), chatController.pinMessage);

// ─── Subscription & Payment Control (Phase 10) ────────────────────────────────
router.get('/:roomId/subscription', requireRoomMember(), subscriptionController.getSubscription);
router.post('/:roomId/subscription/pay', requireRoomMember(['owner', 'admin']), subscriptionController.processPayment);

router.get('/:roomId/members', requireRoomMember(), roomController.listMembers);
router.delete('/:roomId/members/:userId', requireRoomMember(['owner', 'admin']), roomController.removeMember);
router.patch('/:roomId/members/:userId/role', requireRoomMember(['owner']), roomController.updateMemberRole);

router.post('/:roomId/invitations', requireRoomMember(['owner']), roomController.invite);
router.get('/:roomId/invitations', requireRoomMember(['owner']), roomController.listInvitations);
router.delete('/:roomId/invitations/:invitationId', requireRoomMember(['owner']), roomController.revokeInvitation);

export default router;