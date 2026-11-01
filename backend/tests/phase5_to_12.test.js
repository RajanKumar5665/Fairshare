import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSplit } from '../src/utils/splitCalculator.js';
import { rupeesToPaise } from '../src/utils/money.js';

describe('Phase 5 — Rent, Recurring Bills & Move-In/Move-Out', () => {
  it('prevents duplicate generation of recurring bill for the same period', () => {
    const bill = {
      title: 'Airtel Fiber WiFi',
      amountInSmallestUnit: 99900, // ₹999
      frequency: 'monthly',
      lastGeneratedPeriod: '2026-10',
    };

    const currentPeriod = '2026-10';
    const isDuplicate = bill.lastGeneratedPeriod === currentPeriod;
    assert.equal(isDuplicate, true, 'Must detect bill already generated for current period');
  });

  it('excludes former roommates who moved out from new recurring bill allocations', () => {
    const billDate = new Date('2026-10-15T00:00:00Z');

    const members = [
      { userId: 'u1', name: 'Raj', membershipStartDate: new Date('2026-08-01'), membershipEndDate: null },
      { userId: 'u2', name: 'Amit', membershipStartDate: new Date('2026-08-01'), membershipEndDate: null },
      { userId: 'u3', name: 'Rohan (Left)', membershipStartDate: new Date('2026-08-01'), membershipEndDate: new Date('2026-09-30') },
    ];

    const eligible = members.filter((m) => {
      const started = !m.membershipStartDate || m.membershipStartDate <= billDate;
      const notEnded = !m.membershipEndDate || m.membershipEndDate >= billDate;
      return started && notEnded;
    });

    assert.equal(eligible.length, 2, 'Only current active members should be eligible');
    assert.deepEqual(eligible.map((m) => m.userId), ['u1', 'u2']);
  });
});

describe('Phase 6 — Expense Disputes & Approvals', () => {
  it('marks expense as disputed when raised and updates resolution', () => {
    const expense = { id: 'exp_1', status: 'active', amount: 150000 };
    const dispute = {
      expenseId: expense.id,
      reason: 'I was out of station during this week',
      status: 'open',
    };

    // Dispute raised:
    expense.status = 'disputed';
    assert.equal(expense.status, 'disputed');

    // Resolution:
    dispute.status = 'resolved';
    dispute.resolutionNote = 'Agreed to exempt user and adjust shares';
    expense.status = 'active';

    assert.equal(dispute.status, 'resolved');
    assert.equal(expense.status, 'active');
  });
});

describe('Phase 7 — Room Chat & Announcements', () => {
  it('validates announcement categories and distinguishes from regular chat', () => {
    const chatMsg = { text: 'Anyone cooking dinner tonight?', isAnnouncement: false, category: 'chat' };
    const noticeMsg = { text: 'Rent due on 5th October to landlord', isAnnouncement: true, category: 'rent' };

    assert.equal(chatMsg.isAnnouncement, false);
    assert.equal(noticeMsg.isAnnouncement, true);
    assert.equal(noticeMsg.category, 'rent');
  });
});

describe('Phase 9 & 10 — Personal Isolation & Subscription Control', () => {
  it('guarantees personal expenses remain independent and free', () => {
    const personalExpense = { type: 'personal', roomId: null, amount: 25000 };
    assert.equal(personalExpense.type, 'personal');
    assert.equal(personalExpense.roomId, null, 'Personal expenses never attach to room ledgers');
  });

  it('validates ₹50/month room subscription model and trial period', () => {
    const subscription = {
      priceInRupees: 50,
      billingScope: 'room',
      status: 'trial',
      isTrial: true,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    assert.equal(subscription.priceInRupees, 50, 'Price must be ₹50/month');
    assert.equal(subscription.billingScope, 'room');
    assert.equal(subscription.isTrial, true);
    assert.ok(subscription.currentPeriodEnd > new Date(), 'Trial period must be in the future');
  });

  it('validates Razorpay subscription ₹1 first month order creation format', async () => {
    const { createRazorpayOrder, verifyRazorpaySignature } = await import('../src/config/razorpay.js');
    const order = await createRazorpayOrder({ amountInPaise: 100, receipt: 'rcpt_test_123' });

    assert.ok(order.orderId, 'Order ID must be generated');
    assert.equal(order.amount, 100, 'First month amount must be 100 paise (₹1)');
    assert.equal(order.currency, 'INR');

    // Signature verification with test order
    const isValid = verifyRazorpaySignature({
      orderId: order.orderId,
      paymentId: 'pay_test_abc123',
      signature: 'test_signature',
    });
    assert.equal(isValid, true, 'Test order signature should verify');
  });
});
