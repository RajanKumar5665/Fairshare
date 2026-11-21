import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLedger, planSettlements, COUNTED_EXPENSE_STATUSES } from '../src/utils/settlementPlanner.js';
import { isValidMonth, monthKey, monthRange } from '../src/utils/month.js';
import { equalSplit } from '../src/utils/splitCalculator.js';

const members = [
  { userId: 'raj', name: 'Raj' },
  { userId: 'amit', name: 'Amit' },
  { userId: 'neha', name: 'Neha' },
];

/** Equal split of an expense across all three members. */
function sharedExpense(id, paidBy, amount) {
  const split = equalSplit(amount, members);
  return {
    expense: { _id: id, paidBy, amountInSmallestUnit: amount },
    participants: split.map((s) => ({ expenseId: id, userId: s.userId, owedAmountInSmallestUnit: s.amount })),
  };
}

describe('Month-end settle-up', () => {
  it('works out who spent more/less than their equal share', () => {
    // Raj ₹3000 groceries, Amit ₹600 wifi, Neha nothing. Total ₹3600 → ₹1200 each.
    const a = sharedExpense('e1', 'raj', 300000);
    const b = sharedExpense('e2', 'amit', 60000);
    const ledger = buildLedger({
      members,
      expenses: [a.expense, b.expense],
      participants: [...a.participants, ...b.participants],
    });

    assert.equal(ledger.get('raj').netPaise, 180000); // spent ₹1800 more than share
    assert.equal(ledger.get('amit').netPaise, -60000); // spent ₹600 less
    assert.equal(ledger.get('neha').netPaise, -120000); // spent ₹1200 less

    const sum = [...ledger.values()].reduce((s, l) => s + l.netPaise, 0);
    assert.equal(sum, 0, 'balances must always sum to zero');

    const transfers = planSettlements([...ledger.values()]);
    assert.deepEqual(
      transfers.map((t) => [t.from, t.to, t.amountPaise]),
      [
        ['neha', 'raj', 120000],
        ['amit', 'raj', 60000],
      ],
    );
  });

  it('confirmed settlements reduce what is left to pay', () => {
    const a = sharedExpense('e1', 'raj', 300000);
    const ledger = buildLedger({
      members,
      expenses: [a.expense],
      participants: a.participants,
      settlements: [{ paidBy: 'amit', paidTo: 'raj', amountInSmallestUnit: 100000 }],
    });
    assert.equal(ledger.get('amit').netPaise, 0);
    assert.equal(ledger.get('raj').netPaise, 100000);
    assert.deepEqual(
      planSettlements([...ledger.values()]).map((t) => [t.from, t.to, t.amountPaise]),
      [['neha', 'raj', 100000]],
    );
  });

  it('handles odd paise without losing money', () => {
    const a = sharedExpense('e1', 'raj', 100); // ₹1 among three → 34 + 33 + 33
    const ledger = buildLedger({ members, expenses: [a.expense], participants: a.participants });
    const transfers = planSettlements([...ledger.values()]);
    const paid = transfers.reduce((s, t) => s + t.amountPaise, 0);
    assert.equal(paid, 66);
    assert.equal([...ledger.values()].reduce((s, l) => s + l.netPaise, 0), 0);
  });

  it('includes members with no activity and returns no transfers when even', () => {
    const ledger = buildLedger({ members });
    assert.equal(ledger.size, 3);
    assert.deepEqual(planSettlements([...ledger.values()]), []);
  });

  it('never counts pending, rejected or cancelled expenses', () => {
    for (const s of ['pending_review', 'rejected', 'cancelled']) {
      assert.equal(COUNTED_EXPENSE_STATUSES.includes(s), false, `${s} must not be counted`);
    }
    assert.equal(COUNTED_EXPENSE_STATUSES.includes('active'), true);
  });
});

describe('IST month boundaries', () => {
  it('puts 1 AM IST on the 1st into the new month', () => {
    // 2026-11-30T19:30Z == 2026-12-01 01:00 IST
    assert.equal(monthKey(new Date('2026-11-30T19:30:00Z')), '2026-12');
    assert.equal(monthKey(new Date('2026-11-30T18:00:00Z')), '2026-11');
  });

  it('builds an IST month range', () => {
    const { start, end } = monthRange('2026-12');
    assert.equal(start.toISOString(), '2026-11-30T18:30:00.000Z');
    assert.equal(end.toISOString(), '2026-12-31T18:30:00.000Z');
  });

  it('validates month strings', () => {
    assert.equal(isValidMonth('2026-11'), true);
    assert.equal(isValidMonth('2026-13'), false);
    assert.equal(isValidMonth('2026-1'), false);
    assert.throws(() => monthRange('nope'));
  });
});
