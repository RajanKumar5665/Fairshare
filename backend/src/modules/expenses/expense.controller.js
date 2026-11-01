import {
  createExpenseSchema,
  updateExpenseSchema,
  recordSettlementSchema,
  confirmSettlementSchema,
  reverseSettlementSchema,
} from './expense.validation.js';
import * as expenseService from './expense.service.js';

// ─── Create Expense ───────────────────────────────────────────────────────────

export async function createExpense(req, res, next) {
  try {
    const { error, value } = createExpenseSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const expense = await expenseService.createExpense(req.userId, value);
    res.status(201).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
}

// ─── Get Single Expense ───────────────────────────────────────────────────────

export async function getExpense(req, res, next) {
  try {
    const data = await expenseService.getExpenseById(req.params.expenseId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// ─── List Personal Expenses ───────────────────────────────────────────────────

export async function listPersonalExpenses(req, res, next) {
  try {
    const { category, from, to } = req.query;
    const expenses = await expenseService.getPersonalExpenses(req.userId, { category, from, to });
    res.json({ success: true, expenses });
  } catch (err) {
    next(err);
  }
}

export async function getMonthlySummary(req, res, next) {
  try {
    const summary = await expenseService.getUserMonthlySpendSummary(req.userId, req.query.month);
    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
}


// ─── List Room Expenses ───────────────────────────────────────────────────────

export async function listRoomExpenses(req, res, next) {
  try {
    const { month, status, page, limit } = req.query;
    const expenses = await expenseService.getRoomExpenses(req.params.roomId, {
      month,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json({ success: true, expenses });
  } catch (err) {
    next(err);
  }
}

// ─── Update Expense ────────────────────────────────────────────────────────────

export async function updateExpense(req, res, next) {
  try {
    const { error, value } = updateExpenseSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const expense = await expenseService.updateExpense(req.params.expenseId, req.userId, value);
    res.json({ success: true, expense });
  } catch (err) {
    next(err);
  }
}

// ─── Cancel Expense ────────────────────────────────────────────────────────────

export async function cancelExpense(req, res, next) {
  try {
    const expense = await expenseService.cancelExpense(req.params.expenseId, req.userId);
    res.json({ success: true, expense });
  } catch (err) {
    next(err);
  }
}

// ─── Room Balances ─────────────────────────────────────────────────────────────

export async function getRoomBalances(req, res, next) {
  try {
    const balances = await expenseService.getRoomBalances(req.params.roomId, req.query);
    res.json({
      success: true,
      balances,
      summary: balances.summary || null,
      month: balances.month || null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Suggested Settlements ─────────────────────────────────────────────────────

export async function getSuggestedSettlements(req, res, next) {
  try {
    const suggestions = await expenseService.getSuggestedSettlements(req.params.roomId);
    res.json({ success: true, suggestions });
  } catch (err) {
    next(err);
  }
}

// ─── Record Settlement ─────────────────────────────────────────────────────────

export async function recordSettlement(req, res, next) {
  try {
    // Accept roomId from URL params (room-scoped route) or request body
    const body = req.params.roomId
      ? { ...req.body, roomId: req.params.roomId }
      : req.body;

    const { error, value } = recordSettlementSchema.validate(body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const settlement = await expenseService.recordSettlement(req.userId, value);
    res.status(201).json({ success: true, settlement });
  } catch (err) {
    next(err);
  }
}

// ─── Confirm Settlement ───────────────────────────────────────────────────────

export async function confirmSettlement(req, res, next) {
  try {
    const { error, value } = confirmSettlementSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const settlement = await expenseService.confirmSettlement(
      req.userId,
      req.params.roomId,
      req.params.settlementId,
      value
    );
    res.json({ success: true, settlement });
  } catch (err) {
    next(err);
  }
}

// ─── Reverse Settlement (Audit Correction) ───────────────────────────────────

export async function reverseSettlement(req, res, next) {
  try {
    const { error, value } = reverseSettlementSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const settlement = await expenseService.reverseSettlement(
      req.userId,
      req.params.roomId,
      req.params.settlementId,
      value
    );
    res.json({ success: true, settlement });
  } catch (err) {
    next(err);
  }
}

// ─── List Room Settlements ─────────────────────────────────────────────────────

export async function listRoomSettlements(req, res, next) {
  try {
    const settlements = await expenseService.getRoomSettlements(req.params.roomId, req.query);
    res.json({ success: true, settlements });
  } catch (err) {
    next(err);
  }
}