import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { Settlement } from '../../models/settlement.model.js';
import { RecurringBill } from '../../models/recurringBill.model.js';
import { Dispute } from '../../models/dispute.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { getRoomBalances } from './room.service.js';

export async function getRoomDashboard(roomId) {
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const currentMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  const prevMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd = currentMonthStart;

  // 1. Current Month & Previous Month Spending
  const [currentMonthExpenses, prevMonthExpenses, allActiveExpenses] = await Promise.all([
    Expense.find({
      roomId,
      type: 'shared',
      status: { $ne: 'cancelled' },
      expenseDate: { $gte: currentMonthStart, $lt: currentMonthEnd },
    }).lean(),
    Expense.find({
      roomId,
      type: 'shared',
      status: { $ne: 'cancelled' },
      expenseDate: { $gte: prevMonthStart, $lt: prevMonthEnd },
    }).lean(),
    Expense.find({
      roomId,
      type: 'shared',
      status: { $ne: 'cancelled' },
    })
      .populate('paidBy', 'name mobile')
      .sort({ expenseDate: -1 })
      .limit(10)
      .lean(),
  ]);

  const currentMonthSpendingPaise = currentMonthExpenses.reduce((s, e) => s + e.amountInSmallestUnit, 0);
  const prevMonthSpendingPaise = prevMonthExpenses.reduce((s, e) => s + e.amountInSmallestUnit, 0);

  let momChangePercent = 0;
  if (prevMonthSpendingPaise > 0) {
    momChangePercent = Math.round(((currentMonthSpendingPaise - prevMonthSpendingPaise) / prevMonthSpendingPaise) * 100);
  }

  // 2. Category Breakdown (Current Month)
  const categoryMap = {};
  for (const exp of currentMonthExpenses) {
    const cat = exp.category || 'general';
    categoryMap[cat] = (categoryMap[cat] || 0) + exp.amountInSmallestUnit;
  }
  const categoryBreakdown = Object.entries(categoryMap).map(([category, amountPaise]) => ({
    category,
    amountPaise,
    percentage: currentMonthSpendingPaise > 0 ? Math.round((amountPaise / currentMonthSpendingPaise) * 100) : 0,
  }));

  // 3. Authoritative Balances & Ledger
  const balances = await getRoomBalances(roomId);

  // 4. Upcoming Bills (Due within 30 days)
  const upcomingBills = await RecurringBill.find({
    roomId,
    isActive: true,
  })
    .sort({ nextDueDate: 1 })
    .limit(5)
    .lean();

  // 5. Pending Settlements & Disputed Expenses
  const [pendingSettlements, openDisputes, recentSettlements] = await Promise.all([
    Settlement.find({ roomId, status: 'pending' })
      .populate('paidBy', 'name mobile')
      .populate('paidTo', 'name mobile')
      .lean(),
    Dispute.find({ roomId, status: 'open' })
      .populate('raisedBy', 'name')
      .populate('expenseId', 'title amountInSmallestUnit')
      .lean(),
    Settlement.find({ roomId })
      .populate('paidBy', 'name')
      .populate('paidTo', 'name')
      .sort({ settledAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // 6. Recent Member Activity
  const recentMembers = await RoomMember.find({ roomId })
    .populate('userId', 'name mobile avatar')
    .sort({ updatedAt: -1 })
    .limit(6)
    .lean();

  return {
    spending: {
      currentMonthSpendingPaise,
      currentMonthCount: currentMonthExpenses.length,
      prevMonthSpendingPaise,
      momChangePercent,
    },
    categoryBreakdown,
    balances: balances.map((b) => ({
      userId: b.userId,
      name: b.name,
      netPaise: b.netPaise,
      totalPaidPaise: b.totalPaidPaise,
      totalOwedPaise: b.totalOwedPaise,
      receivablePaise: b.receivablePaise,
      payablePaise: b.payablePaise,
      isCurrentMember: b.isCurrentMember,
    })),
    summary: balances.summary,
    upcomingBills,
    pendingSettlements,
    openDisputes,
    recentExpenses: allActiveExpenses,
    recentSettlements,
    recentMembers,
  };
}
