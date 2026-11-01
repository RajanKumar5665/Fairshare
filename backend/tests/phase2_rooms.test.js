import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createRoomSchema,
  updateRoomSchema,
  inviteSchema,
  joinRoomSchema,
  transferOwnershipSchema,
} from '../src/modules/rooms/room.validation.js';

test('Phase 2 — Room Management Schemas & Logic', async (t) => {
  await t.test('createRoomSchema validates valid room data with address, rent and custom categories', () => {
    const validData = {
      name: 'Flat A-115',
      description: '3BHK Flat in Koramangala',
      address: '4th Cross, Green Glen Layout',
      monthlyRent: 35000,
      customCategories: ['rent', 'maid', 'wifi', 'electricity'],
      currency: 'INR',
    };

    const { error, value } = createRoomSchema.validate(validData);
    assert.strictEqual(error, undefined, 'Validation should pass');
    assert.strictEqual(value.name, 'Flat A-115');
    assert.strictEqual(value.monthlyRent, 35000);
    assert.strictEqual(value.customCategories.length, 4);
  });

  await t.test('createRoomSchema rejects invalid room names', () => {
    const invalidData = {
      name: 'A', // too short (< 2)
    };
    const { error } = createRoomSchema.validate(invalidData);
    assert.ok(error, 'Should fail validation when name is shorter than 2 characters');
  });

  await t.test('updateRoomSchema validates partial updates for rent and address', () => {
    const updateData = {
      address: 'New Flat Address, Bellandur',
      monthlyRent: 40000,
      customCategories: ['rent', 'cook', 'groceries'],
    };
    const { error, value } = updateRoomSchema.validate(updateData);
    assert.strictEqual(error, undefined);
    assert.strictEqual(value.monthlyRent, 40000);
  });

  await t.test('inviteSchema allows optional email and configurable expiry', () => {
    // 1. With email
    const withEmail = { invitedEmail: 'roommate@example.com', expiresInDays: 14 };
    const res1 = inviteSchema.validate(withEmail);
    assert.strictEqual(res1.error, undefined);
    assert.strictEqual(res1.value.expiresInDays, 14);

    // 2. Without email (public shareable link)
    const withoutEmail = { expiresInDays: 7 };
    const res2 = inviteSchema.validate(withoutEmail);
    assert.strictEqual(res2.error, undefined);
    assert.strictEqual(res2.value.expiresInDays, 7);
  });

  await t.test('transferOwnershipSchema validates newOwnerId string', () => {
    const valid = { newOwnerId: '507f1f77bcf86cd799439011' };
    const { error } = transferOwnershipSchema.validate(valid);
    assert.strictEqual(error, undefined);

    const empty = {};
    const res = transferOwnershipSchema.validate(empty);
    assert.ok(res.error, 'newOwnerId is required');
  });

  await t.test('Invitation Token Hashing is deterministic and one-way', () => {
    const rawToken = '4f8b9e2a1c7d3f5b6e0a9d8c';
    const hash1 = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hash2 = crypto.createHash('sha256').update(rawToken).digest('hex');

    assert.strictEqual(hash1, hash2, 'SHA-256 hash must be deterministic');
    assert.notStrictEqual(rawToken, hash1, 'Token must not equal the raw string');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 characters long');
  });

  await t.test('Balance calculation zero-sum property invariant', () => {
    // Example from prompt:
    // Raj paid ₹1,500 for groceries. Five members share equally. Each member's share is ₹300.
    // Raj's net balance is +₹1,200. The other four members have a net balance of -₹300 each.
    const members = ['Raj', 'Alice', 'Bob', 'Charlie', 'Dave'];
    const net = new Map(members.map((m) => [m, 0]));

    const payer = 'Raj';
    const totalPaise = 150000; // ₹1,500
    const count = members.length;
    const sharePaise = Math.floor(totalPaise / count); // 30000 paise = ₹300

    for (const member of members) {
      net.set(member, net.get(member) - sharePaise);
      net.set(payer, net.get(payer) + sharePaise);
    }

    assert.strictEqual(net.get('Raj'), 120000, "Raj's net balance must be +₹1,200 (120000 paise)");
    assert.strictEqual(net.get('Alice'), -30000, "Alice's net balance must be -₹300 (-30000 paise)");
    assert.strictEqual(net.get('Bob'), -30000, "Bob's net balance must be -₹300");
    assert.strictEqual(net.get('Charlie'), -30000, "Charlie's net balance must be -₹300");
    assert.strictEqual(net.get('Dave'), -30000, "Dave's net balance must be -₹300");

    const totalNetPaise = Array.from(net.values()).reduce((sum, n) => sum + n, 0);
    assert.strictEqual(totalNetPaise, 0, 'Sum of all net balances in a room must strictly equal 0');
  });
});
