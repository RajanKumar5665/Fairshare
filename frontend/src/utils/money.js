export function formatINR(paise = 0) {
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const CATEGORIES = [
  'food',
  'travel',
  'shopping',
  'bills',
  'rent',
  'entertainment',
  'health',
  'general',
  'other',
];
