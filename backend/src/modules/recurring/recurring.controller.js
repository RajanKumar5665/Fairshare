import * as recurringService from './recurring.service.js';

export async function createRecurringBill(req, res, next) {
  try {
    const bill = await recurringService.createRecurringBill(
      req.userId,
      req.params.roomId,
      req.body
    );
    res.status(201).json({ success: true, bill });
  } catch (err) {
    next(err);
  }
}

export async function listRecurringBills(req, res, next) {
  try {
    const bills = await recurringService.listRecurringBills(req.params.roomId);
    res.json({ success: true, bills });
  } catch (err) {
    next(err);
  }
}

export async function updateRecurringBill(req, res, next) {
  try {
    const bill = await recurringService.updateRecurringBill(
      req.userId,
      req.params.roomId,
      req.params.billId,
      req.body
    );
    res.json({ success: true, bill });
  } catch (err) {
    next(err);
  }
}

export async function deleteRecurringBill(req, res, next) {
  try {
    const result = await recurringService.deleteRecurringBill(
      req.userId,
      req.params.roomId,
      req.params.billId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function generateDueExpense(req, res, next) {
  try {
    const expense = await recurringService.generateDueExpense(
      req.userId,
      req.params.roomId,
      req.params.billId
    );
    res.status(201).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
}
