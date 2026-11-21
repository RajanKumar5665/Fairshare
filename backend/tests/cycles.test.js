import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_END, cycleLabel, firstCycleStart } from '../src/utils/cycle.js';

const ist = (d) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);

describe('Flat hisaab periods (IST, settled only by the owner)', () => {
  it('Month 1 starts at IST midnight of the creation day', () => {
    // created 15 Nov 2026, 4 PM IST
    const start = firstCycleStart(new Date('2026-11-15T10:30:00Z'));
    assert.equal(start.toISOString(), '2026-11-14T18:30:00.000Z');
    assert.equal(ist(start), '2026-11-15');
  });

  it('creation just after IST midnight still counts as that IST day', () => {
    // 1 Dec 2026, 00:30 IST == 30 Nov 19:00 UTC
    assert.equal(ist(firstCycleStart(new Date('2026-11-30T19:00:00Z'))), '2026-12-01');
  });

  it('the open month has no end date', () => {
    const start = firstCycleStart(new Date('2026-11-15T06:00:00Z'));
    assert.equal(cycleLabel(1, start, OPEN_END), 'Month 1 · since 15 Nov 2026');
    assert.equal(cycleLabel(1, start, null), 'Month 1 · since 15 Nov 2026');
  });

  it('a settled month shows the day it was settled, however long it ran', () => {
    const start = firstCycleStart(new Date('2026-11-15T06:00:00Z'));
    // settled after 40 days, on 25 Dec
    assert.equal(cycleLabel(1, start, new Date('2026-12-25T09:00:00Z')), 'Month 1 · 15 Nov – 25 Dec 2026');
  });
});
