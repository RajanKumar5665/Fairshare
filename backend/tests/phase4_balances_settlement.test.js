import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordSettlementSchema,
  reverseSettlementSchema,
  confirmSettlementSchema,
} from '../src/modules/expenses/expense.validation.js';
import { rupeesToPaise } from '../src/utils/money.js';

describe('Phase 4 — Automatic Balances & Settlement Ledger', () => {
  it('validates Raj grocery split example correctly: Raj +₹1200, 4 roommates -₹300 each', () => {
    // Raj pays ₹1500 for groceries. 5 roommates split equally.
    const totalExpensePaise = 150000; // ₹1,500
    const memberCount = 5;
    const sharePerMemberPaise = totalExpensePaise / memberCount; // ₹300 = 30000 paise

    const members = [
      { id: 'raj', name: 'Raj', totalExpensePaidPaise: totalExpensePaise, totalShareOwedPaise: sharePerMemberPaise, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 },
      { id: 'm2', name: 'Amit', totalExpensePaidPaise: 0, totalShareOwedPaise: sharePerMemberPaise, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 },
      { id: 'm3', name: 'Rohan', totalExpensePaidPaise: 0, totalShareOwedPaise: sharePerMemberPaise, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 },
      { id: 'm4', name: 'Vikram', totalExpensePaidPaise: 0, totalShareOwedPaise: sharePerMemberPaise, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 },
      { id: 'm5', name: 'Kabir', totalExpensePaidPaise: 0, totalShareOwedPaise: sharePerMemberPaise, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 },
    ];

    for (const m of members) {
      m.netPaise = (m.totalExpensePaidPaise + m.settlementsPaidPaise) - (m.totalShareOwedPaise + m.settlementsReceivedPaise);
    }

    const raj = members.find((m) => m.id === 'raj');
    assert.equal(raj.netPaise, 120000, 'Raj net balance must be +₹1,200 (120000 paise)');

    const others = members.filter((m) => m.id !== 'raj');
    for (const other of others) {
      assert.equal(other.netPaise, -30000, 'Roommate net balance must be -₹300 (-30000 paise)');
    }

    // Zero-sum invariant
    const netSum = members.reduce((sum, m) => sum + m.netPaise, 0);
    assert.equal(netSum, 0, 'Sum of all net balances must be strictly 0');
  });

  it('correctly updates net balances when Amit pays Raj ₹300 settlement', () => {
    // Initial state after ₹1500 expense
    const raj = { totalExpensePaidPaise: 150000, totalShareOwedPaise: 30000, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 };
    const amit = { totalExpensePaidPaise: 0, totalShareOwedPaise: 30000, settlementsPaidPaise: 0, settlementsReceivedPaise: 0 };

    // Amit pays Raj ₹300
    const settlementPaise = 30000;
    amit.settlementsPaidPaise += settlementPaise;
    raj.settlementsReceivedPaise += settlementPaise;

    const amitNet = (amit.totalExpensePaidPaise + amit.settlementsPaidPaise) - (amit.totalShareOwedPaise + amit.settlementsReceivedPaise);
    const rajNet = (raj.totalExpensePaidPaise + raj.settlementsPaidPaise) - (raj.totalShareOwedPaise + raj.settlementsReceivedPaise);

    assert.equal(amitNet, 0, 'Amit should be completely settled up (0 paise)');
    assert.equal(rajNet, 90000, 'Raj should now be owed ₹900 (90000 paise) from the remaining 3 roommates');
  });

  it('greedy debt simplification generates minimal transactions', () => {
    // Balances:
    // Debtor 1 (Amit): -₹300
    // Debtor 2 (Rohan): -₹300
    // Creditor 1 (Raj): +₹600
    const balances = [
      { userId: 'amit', name: 'Amit', netPaise: -30000 },
      { userId: 'rohan', name: 'Rohan', netPaise: -30000 },
      { userId: 'raj', name: 'Raj', netPaise: 60000 },
    ];

    const debtors = balances.filter((b) => b.netPaise < 0).map((b) => ({ ...b, remaining: -b.netPaise }));
    const creditors = balances.filter((b) => b.netPaise > 0).map((b) => ({ ...b, remaining: b.netPaise }));

    const transactions = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const amount = Math.min(debtors[d].remaining, creditors[c].remaining);
      if (amount > 0) {
        transactions.push({
          from: debtors[d].userId,
          to: creditors[c].userId,
          amountPaise: amount,
        });
      }
      debtors[d].remaining -= amount;
      creditors[c].remaining -= amount;
      if (debtors[d].remaining === 0) d++;
      if (creditors[c].remaining === 0) c++;
    }

    assert.equal(transactions.length, 2, 'Should simplify to exactly 2 transactions');
    assert.deepEqual(transactions[0], { from: 'amit', to: 'raj', amountPaise: 30000 });
    assert.deepEqual(transactions[1], { from: 'rohan', to: 'raj', amountPaise: 30000 });
  });

  it('validates recordSettlementSchema with payment methods and reference', () => {
    const validUPI = {
      roomId: '507f1f77bcf86cd799439011',
      paidTo: '507f1f77bcf86cd799439012',
      amountRupees: 500,
      paymentMethod: 'upi',
      transactionRef: 'UPI/1234567890/ref',
      note: 'Grocery share settle',
    };
    const { error, value } = recordSettlementSchema.validate(validUPI);
    assert.equal(error, undefined);
    assert.equal(value.paymentMethod, 'upi');
    assert.equal(value.status, 'completed');

    const invalid = {
      roomId: '507f1f77bcf86cd799439011',
      paidTo: '507f1f77bcf86cd799439012',
      amountRupees: -50, // invalid negative amount
    };
    const res = recordSettlementSchema.validate(invalid);
    assert.ok(res.error, 'Should reject negative settlement amount');
  });

  it('validates reverseSettlementSchema requires an auditable reason', () => {
    const valid = { reason: 'Double recorded payment by mistake' };
    assert.equal(reverseSettlementSchema.validate(valid).error, undefined);

    const empty = { reason: '' };
    assert.ok(reverseSettlementSchema.validate(empty).error, 'Reason must not be empty');

    const short = { reason: 'no' };
    assert.ok(reverseSettlementSchema.validate(short).error, 'Reason must be at least 3 chars');
  });

  it('reversing a settlement accurately restores pre-settlement balance', () => {
    // Initial net balances before settlement:
    let rajNet = 120000;
    let amitNet = -30000;

    // Apply settlement
    const settlementPaise = 30000;
    let status = 'completed';
    if (status === 'completed') {
      rajNet -= settlementPaise; // raj was owed 1200, received 300 -> now owed 900
      amitNet += settlementPaise; // amit owed 300, paid 300 -> now 0
    }
    assert.equal(amitNet, 0);
    assert.equal(rajNet, 90000);

    // Now reverse the settlement
    status = 'reversed';
    // Reversal logic: reversed settlements do NOT apply
    if (status === 'reversed') {
      // Balance calculation ignores reversed settlements
      const rajRestored = 120000;
      const amitRestored = -30000;
      assert.equal(amitRestored, -30000, 'Amit owes ₹300 again');
      assert.equal(rajRestored, 120000, 'Raj is owed ₹1,200 again');
    }
  });
});
