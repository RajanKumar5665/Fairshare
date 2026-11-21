// Pure money logic for room balances and month-end settle-up. All amounts are
// integer paise. Kept free of Mongo so it can be unit-tested directly.

/**
 * Expense statuses that count towards balances. `pending_review` (waiting for
 * roommates' approval), `rejected` and `cancelled` never move money.
 * `disputed` stays counted: it was approved earlier and a dispute is open on it.
 */
export const COUNTED_EXPENSE_STATUSES = ['active', 'disputed', 'settled'];

function emptyLine(userId, info = {}) {
  return {
    userId,
    name: info.name || 'Former member',
    paidPaise: 0, // expenses this person paid for
    sharePaise: 0, // this person's fair share of those expenses
    settlementsPaidPaise: 0, // money sent to roommates (confirmed)
    settlementsReceivedPaise: 0, // money received from roommates (confirmed)
    netPaise: 0, // > 0: should receive, < 0: should pay
    ...info,
  };
}

/**
 * @param {object} input
 * @param {Array<{userId:string}>} input.members  people to always include (may have extra info fields)
 * @param {Array<{_id, paidBy, amountInSmallestUnit}>} input.expenses  counted expenses only
 * @param {Array<{expenseId, userId, owedAmountInSmallestUnit}>} input.participants
 * @param {Array<{paidBy, paidTo, amountInSmallestUnit}>} input.settlements  completed settlements only
 * @returns {Map<string, object>} ledger lines keyed by userId
 */
export function buildLedger({ members = [], expenses = [], participants = [], settlements = [] }) {
  const lines = new Map();
  const ensure = (id) => {
    const key = String(id);
    if (!lines.has(key)) lines.set(key, emptyLine(key));
    return lines.get(key);
  };

  for (const m of members) {
    const key = String(m.userId);
    lines.set(key, emptyLine(key, { ...m, userId: key }));
  }

  for (const e of expenses) {
    ensure(e.paidBy).paidPaise += e.amountInSmallestUnit;
  }
  for (const p of participants) {
    ensure(p.userId).sharePaise += p.owedAmountInSmallestUnit;
  }
  for (const s of settlements) {
    ensure(s.paidBy).settlementsPaidPaise += s.amountInSmallestUnit;
    ensure(s.paidTo).settlementsReceivedPaise += s.amountInSmallestUnit;
  }

  for (const line of lines.values()) {
    line.netPaise =
      line.paidPaise + line.settlementsPaidPaise - line.sharePaise - line.settlementsReceivedPaise;
  }
  return lines;
}

/**
 * Minimal-ish set of transfers that brings everyone to zero (greedy: largest
 * debtor pays largest creditor). Deterministic for a given input.
 * @param {Array<{userId, name, netPaise}>} lines
 * @returns {Array<{from, fromName, to, toName, amountPaise}>}
 */
export function planSettlements(lines) {
  const byAmountDesc = (a, b) => b.remaining - a.remaining || String(a.userId).localeCompare(String(b.userId));
  const debtors = lines
    .filter((l) => l.netPaise < 0)
    .map((l) => ({ ...l, remaining: -l.netPaise }))
    .sort(byAmountDesc);
  const creditors = lines
    .filter((l) => l.netPaise > 0)
    .map((l) => ({ ...l, remaining: l.netPaise }))
    .sort(byAmountDesc);

  const transfers = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].remaining, creditors[c].remaining);
    if (amount > 0) {
      transfers.push({
        from: String(debtors[d].userId),
        fromName: debtors[d].name,
        to: String(creditors[c].userId),
        toName: creditors[c].name,
        amountPaise: amount,
      });
    }
    debtors[d].remaining -= amount;
    creditors[c].remaining -= amount;
    if (debtors[d].remaining === 0) d++;
    if (creditors[c].remaining === 0) c++;
  }
  return transfers;
}
