// Rules per group type
// ─ Room / Flat: runs in "months" (hisaab periods). A period stays open until the
//   OWNER taps "Settle now" — never automatically. Then its settle-up is frozen into
//   history, payments open for it, and the next period starts right away.
//   Pending expenses move to the next period.
// ─ Trip / Other group: no months. Settle up any time; the owner can "finish"
//   the trip to stop new expenses (and reopen it if needed).
import { Room } from '../../models/room.model.js';
import { RoomCycle } from '../../models/roomCycle.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { Expense } from '../../models/expense.model.js';
import { Settlement } from '../../models/settlement.model.js';
import { OPEN_END, cycleLabel, firstCycleStart } from '../../utils/cycle.js';
import { buildPeriodReport } from './room.service.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ROOM_FIELDS = 'type status createdAt cycleAnchor lastClosedCycle cyclesBackfilled isClosed';

/** Flats/rooms run in monthly cycles; trips and other groups are settled as a whole. */
export function usesCycles(room) {
  return Boolean(room) && (room.type || 'room') === 'room';
}

async function loadRoom(roomOrId) {
  if (roomOrId && typeof roomOrId === 'object' && roomOrId.createdAt) return roomOrId;
  return Room.findById(roomOrId).select(ROOM_FIELDS);
}

async function requireOwner(roomId, userId) {
  const member = await RoomMember.findOne({ roomId, userId, status: 'active' });
  if (!member || member.role !== 'owner') {
    throw new AppError('Only the person who created this group can do this', 403);
  }
}

/** Expenses/payments from before periods existed belong to the open period, once. */
async function backfillCycles(room) {
  const last = await RoomCycle.findOne({ roomId: room._id }).sort({ index: -1 }).select('index').lean();
  const open = last ? last.index + 1 : 1;
  await Expense.updateMany({ roomId: room._id, type: 'shared', cycle: null }, { $set: { cycle: open } });
  await Settlement.updateMany({ roomId: room._id, cycle: null }, { $set: { cycle: open } });
  await Room.updateOne(
    { _id: room._id },
    { $set: { cyclesBackfilled: true, cycleAnchor: room.cycleAnchor || room.createdAt } },
  );
}

/** The open month: starts where the last closed month ended. */
async function currentFromHistory(room) {
  const last = await RoomCycle.findOne({ roomId: room._id }).sort({ index: -1 }).select('index end').lean();
  const start = last ? last.end : firstCycleStart(room.cycleAnchor || room.createdAt);
  return { index: last ? last.index + 1 : 1, start, end: OPEN_END };
}

export async function getCycleReport(roomId, index, range, { isCurrent = false, closedEarly = false } = {}) {
  return buildPeriodReport(roomId, {
    key: `cycle-${index}`,
    label: cycleLabel(index, range.start, range.end),
    range,
    expenseMatch: { cycle: index },
    settlementMatch: { cycle: index },
    cycle: { index, start: range.start, end: range.end, isCurrent, isClosed: !isCurrent, closedEarly },
  });
}

/** Freeze a month: carry pending expenses forward, save the settle-up as history. */
async function closeCycle(room, index, start, end, { early = false, closedBy = null } = {}) {
  const carried = await Expense.updateMany(
    { roomId: room._id, cycle: index, status: 'pending_review' },
    { $set: { cycle: index + 1, carriedOver: true } },
  );
  const report = await getCycleReport(room._id, index, { start, end });
  try {
    await RoomCycle.create({
      roomId: room._id,
      index,
      label: cycleLabel(index, start, end),
      start,
      end,
      closedEarly: early,
      closedBy,
      status: report.transfers.length ? 'closed' : 'settled',
      settledAt: report.transfers.length ? null : new Date(),
      snapshot: {
        totalPaise: report.totals.approvedPaise,
        expenseCount: report.totals.approvedCount,
        headCount: report.headCount,
        equalSharePaise: report.equalSharePaise,
        carriedOverCount: carried.modifiedCount || 0,
        members: report.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          paidPaise: m.paidPaise,
          sharePaise: m.sharePaise,
          differencePaise: m.differencePaise,
        })),
        transfers: report.transfers,
        categories: report.categories,
      },
    });
  } catch (err) {
    if (err?.code !== 11000) throw err; // a parallel request already closed it
    return false;
  }
  await Room.updateOne({ _id: room._id, lastClosedCycle: { $lt: index } }, { $set: { lastClosedCycle: index } });
  return true;
}

/**
 * Prepare a flat's periods (one-time numbering of old data) and return the open
 * period { index, start, end } — or null for trips/groups. Never closes anything:
 * only the owner's "Settle now" does that.
 */
export async function ensureCycles(roomOrId) {
  const room = await loadRoom(roomOrId);
  if (!usesCycles(room) || room.status === 'archived') return null;
  if (!room.cyclesBackfilled) await backfillCycles(room);
  return currentFromHistory(room);
}

/** Report for a month: the open one or one from history. */
export async function getRoomCycleReport(roomId, index) {
  const current = await ensureCycles(roomId);
  if (!current) throw new AppError('This group is not split month by month', 400);
  if (index > current.index) throw new AppError('That month has not started yet', 400);
  if (index === current.index) return getCycleReport(roomId, index, current, { isCurrent: true });
  const doc = await RoomCycle.findOne({ roomId, index }).lean();
  if (!doc) throw new AppError('Month not found', 404);
  return getCycleReport(roomId, index, { start: doc.start, end: doc.end }, { closedEarly: doc.closedEarly });
}

/** Owner settles the open period; it goes to history and the next one starts now. */
export async function closeCurrentCycleNow(roomId, userId) {
  await requireOwner(roomId, userId);
  const room = await loadRoom(roomId);
  const current = await ensureCycles(room);
  if (!current) throw new AppError('Only flats/rooms have monthly cycles. Use "Finish trip" instead.', 400);

  const hasActivity =
    (await Expense.exists({ roomId, cycle: current.index, status: { $ne: 'cancelled' } })) ||
    (await Settlement.exists({ roomId, cycle: current.index }));
  if (!hasActivity) throw new AppError('Nothing to settle in this month yet', 400);

  const now = new Date();
  const closed = await closeCycle(room, current.index, current.start, now, { early: true, closedBy: userId });
  if (!closed) throw new AppError('This month was just closed', 409);
  return { closedIndex: current.index, next: await currentFromHistory(room) };
}

/** Trip / other group: owner finishes it (no more expenses) or reopens it. */
export async function setGroupFinished(roomId, userId, finished) {
  await requireOwner(roomId, userId);
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Group not found', 404);
  if (usesCycles(room)) {
    throw new AppError('Flats close month by month. Use "Close this month now" instead.', 400);
  }
  if (finished) {
    const pending = await Expense.countDocuments({ roomId, status: 'pending_review' });
    if (pending) {
      throw new AppError(`${pending} expense${pending > 1 ? 's are' : ' is'} still waiting for approval. Sort them out before finishing.`, 400);
    }
  }
  room.isClosed = finished;
  room.closedAt = finished ? new Date() : null;
  await room.save();
  return room;
}

/** Open month + history of closed months (with live payment status). */
export async function listCycles(roomId, userId) {
  const current = await ensureCycles(roomId);
  if (!current) return null;
  const me = String(userId);

  const docs = await RoomCycle.find({ roomId }).sort({ index: -1 }).lean();
  const cycles = [];
  for (const doc of docs) {
    let remaining = [];
    if (doc.status === 'closed') {
      const live = await getCycleReport(roomId, doc.index, { start: doc.start, end: doc.end });
      remaining = live.transfers;
      if (!remaining.length) {
        await RoomCycle.updateOne({ _id: doc._id }, { $set: { status: 'settled', settledAt: new Date() } });
        doc.status = 'settled';
      }
    }
    cycles.push({
      ...doc,
      remainingTransfers: remaining,
      remainingPaise: remaining.reduce((s, t) => s + t.amountPaise, 0),
      myToPayPaise: remaining.filter((t) => t.from === me).reduce((s, t) => s + t.amountPaise, 0),
      myToGetPaise: remaining.filter((t) => t.to === me).reduce((s, t) => s + t.amountPaise, 0),
    });
  }

  return {
    current: {
      index: current.index,
      label: cycleLabel(current.index, current.start, null),
      start: current.start,
      daysRunning: Math.max(1, Math.ceil((Date.now() - new Date(current.start).getTime()) / 86400000)),
    },
    cycles,
  };
}

/** Open month for a new expense/payment, or null for trips/groups. */
export async function currentCycleFor(roomId) {
  const current = await ensureCycles(roomId);
  return current ? { index: current.index, start: current.start } : null;
}

export async function assertCycleOpen(roomId, cycle, action = 'change it') {
  if (!cycle) return;
  const current = await ensureCycles(roomId);
  if (current && cycle < current.index) {
    throw new AppError(
      `Month ${cycle} is closed and saved in history, so you can't ${action}. Add a correction in this month instead.`,
      409,
    );
  }
}
