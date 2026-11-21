// Monthly "hisaab" periods for flats (IST).
// A period starts when the room is created (or when the previous one was settled)
// and stays open until the OWNER taps "Settle now" — there is no automatic close,
// so a flat can settle after 25 days or after 40, whatever suits them.
const OFFSET_MS = 330 * 60 * 1000;

/** Far-future end used for the open period (it has no end until it is settled). */
export const OPEN_END = new Date(8640000000000000);

function istParts(date) {
  const d = new Date(new Date(date).getTime() + OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/** Month 1 starts at IST midnight of the day the room was created. */
export function firstCycleStart(anchor) {
  const a = istParts(anchor);
  return new Date(Date.UTC(a.y, a.m, a.d) - OFFSET_MS);
}

const fmt = (date, withYear) =>
  new Date(new Date(date).getTime() + OFFSET_MS).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

/** "Month 2 · 15 Dec – 20 Jan 2027" for a settled period, "Month 3 · since 20 Jan 2027" for the open one. */
export function cycleLabel(index, start, end) {
  if (!end || new Date(end).getTime() >= OPEN_END.getTime()) return `Month ${index} · since ${fmt(start, true)}`;
  return `Month ${index} · ${fmt(start)} – ${fmt(end, true)}`;
}
