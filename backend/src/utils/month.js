// Month helpers. FairShare is used in India, so a "month" is a calendar month
// in IST (UTC+05:30). Using server-local or UTC boundaries would put an expense
// added at 1 AM IST on the 1st into the previous month.
export const APP_TZ_OFFSET_MINUTES = 330;
const OFFSET_MS = APP_TZ_OFFSET_MINUTES * 60 * 1000;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(month) {
  return typeof month === 'string' && MONTH_RE.test(month);
}

/** 'YYYY-MM' for the given instant, in IST. */
export function monthKey(date = new Date()) {
  const shifted = new Date(new Date(date).getTime() + OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** UTC instants [start, end) covering the IST calendar month. */
export function monthRange(month) {
  if (!isValidMonth(month)) {
    throw Object.assign(new Error('Month must be in YYYY-MM format'), { statusCode: 400 });
  }
  const [y, m] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - OFFSET_MS),
  };
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
