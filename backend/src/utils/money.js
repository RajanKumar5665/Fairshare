// Always work in paise (smallest unit) internally — never floating point rupees.
export function rupeesToPaise(rupees) {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise) {
  return paise / 100;
}