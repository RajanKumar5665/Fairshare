// Shared helpers for the room screens. Months are IST calendar months to match the API.
const IST_OFFSET_MS = 330 * 60 * 1000;

export const ROOM_CATS = [
  { id: 'groceries', emoji: '🛒', label: 'Groceries' },
  { id: 'food', emoji: '🍔', label: 'Food' },
  { id: 'wifi', emoji: '📶', label: 'WiFi' },
  { id: 'utilities', emoji: '💡', label: 'Utilities' },
  { id: 'rent', emoji: '🏠', label: 'Rent' },
  { id: 'maid', emoji: '🧹', label: 'Maid' },
  { id: 'maintenance', emoji: '🔧', label: 'Repair' },
  { id: 'general', emoji: '📦', label: 'General' },
];

export const TRIP_CATS = [
  { id: 'food', emoji: '🍔', label: 'Food' },
  { id: 'stay', emoji: '🏨', label: 'Stay' },
  { id: 'travel', emoji: '🚕', label: 'Travel' },
  { id: 'fuel', emoji: '⛽', label: 'Fuel' },
  { id: 'tickets', emoji: '🎟️', label: 'Tickets' },
  { id: 'drinks', emoji: '🥤', label: 'Drinks' },
  { id: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { id: 'general', emoji: '📦', label: 'Other' },
];

export const GROUP_CATS = [
  { id: 'food', emoji: '🍔', label: 'Food' },
  { id: 'groceries', emoji: '🛒', label: 'Groceries' },
  { id: 'travel', emoji: '🚕', label: 'Travel' },
  { id: 'tickets', emoji: '🎟️', label: 'Tickets' },
  { id: 'gifts', emoji: '🎁', label: 'Gifts' },
  { id: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { id: 'utilities', emoji: '💡', label: 'Bills' },
  { id: 'general', emoji: '📦', label: 'Other' },
];

export function catsFor(type) {
  if (type === 'trip') return TRIP_CATS;
  if (type === 'group') return GROUP_CATS;
  return ROOM_CATS;
}

export const CAT_EMOJI = Object.fromEntries(
  [...GROUP_CATS, ...TRIP_CATS, ...ROOM_CATS].map((c) => [c.id, c.emoji]),
);

export const GROUP_TYPES = [
  { id: 'room', emoji: '🏠', label: 'Flat / Room', hint: 'Roommates — monthly bills & rent', noun: 'room' },
  { id: 'trip', emoji: '✈️', label: 'Trip', hint: 'Travel with friends — split everything', noun: 'trip' },
  { id: 'group', emoji: '👥', label: 'Other group', hint: 'Party, office, family, anything', noun: 'group' },
];

export const typeMeta = (type) => GROUP_TYPES.find((t) => t.id === type) || GROUP_TYPES[0];

/** "ABCDEFGHJK" → "ABCD-EFGH-JK" for easy reading/typing. */
export function formatInviteCode(code = '') {
  return /^[A-Z2-9]{10}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}` : code;
}

export function currentMonthKey() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

export function todayIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthTitle(month, style = 'long') {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Date picker value → API value. Today = "now"; other days = midday IST. */
export function toApiDate(dateStr) {
  if (!dateStr || dateStr === todayIST()) return undefined;
  return `${dateStr}T12:00:00+05:30`;
}

export function toInputDate(value) {
  if (!value) return todayIST();
  return new Date(new Date(value).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function initials(name = '?') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export const STATUS_META = {
  active: { label: 'Approved', tone: 'success' },
  settled: { label: 'Approved', tone: 'success' },
  disputed: { label: 'Disputed', tone: 'danger' },
  pending_review: { label: 'Pending approval', tone: 'warn' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank_transfer', label: 'Bank' },
  { id: 'other', label: 'Other' },
];
