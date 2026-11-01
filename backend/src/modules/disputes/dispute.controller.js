import * as disputeService from './dispute.service.js';

export async function raiseDispute(req, res, next) {
  try {
    const dispute = await disputeService.raiseDispute(
      req.userId,
      req.params.roomId,
      req.params.expenseId,
      req.body
    );
    res.status(201).json({ success: true, dispute });
  } catch (err) {
    next(err);
  }
}

export async function listDisputes(req, res, next) {
  try {
    const disputes = await disputeService.listDisputes(req.params.roomId);
    res.json({ success: true, disputes });
  } catch (err) {
    next(err);
  }
}

export async function addComment(req, res, next) {
  try {
    const dispute = await disputeService.addComment(
      req.userId,
      req.params.roomId,
      req.params.disputeId,
      req.body
    );
    res.json({ success: true, dispute });
  } catch (err) {
    next(err);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const dispute = await disputeService.resolveDispute(
      req.userId,
      req.params.roomId,
      req.params.disputeId,
      req.body
    );
    res.json({ success: true, dispute });
  } catch (err) {
    next(err);
  }
}
