class SplitError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// distributes leftover paise (from rounding) one-by-one to the first N participants
function distributeRemainder(amounts, remainder) {
  for (let i = 0; i < remainder; i++) {
    amounts[i % amounts.length].amount += 1;
  }
  return amounts;
}

export function equalSplit(totalPaise, participants) {
  const count = participants.length;
  const base = Math.floor(totalPaise / count);
  const remainder = totalPaise - base * count;

  const amounts = participants.map((p) => ({ userId: p.userId, amount: base }));
  return distributeRemainder(amounts, remainder);
}

export function exactSplit(totalPaise, participants) {
  const sum = participants.reduce((acc, p) => acc + p.amountPaise, 0);
  if (sum !== totalPaise) {
    throw new SplitError(`Exact split amounts (${sum}) must equal total expense (${totalPaise})`);
  }
  return participants.map((p) => ({ userId: p.userId, amount: p.amountPaise }));
}

export function percentageSplit(totalPaise, participants) {
  const sumPercent = participants.reduce((acc, p) => acc + p.percentage, 0);
  if (Math.abs(sumPercent - 100) > 0.001) {
    throw new SplitError(`Percentages must sum to 100 (got ${sumPercent})`);
  }

  const rawAmounts = participants.map((p) => ({
    userId: p.userId,
    amount: Math.floor((totalPaise * p.percentage) / 100),
  }));

  const allocated = rawAmounts.reduce((acc, a) => acc + a.amount, 0);
  return distributeRemainder(rawAmounts, totalPaise - allocated);
}

export function sharesSplit(totalPaise, participants) {
  const invalid = participants.some((p) => p.shares <= 0);
  if (invalid) throw new SplitError('Shares must be positive numbers');

  const totalShares = participants.reduce((acc, p) => acc + p.shares, 0);

  const rawAmounts = participants.map((p) => ({
    userId: p.userId,
    amount: Math.floor((totalPaise * p.shares) / totalShares),
  }));

  const allocated = rawAmounts.reduce((acc, a) => acc + a.amount, 0);
  return distributeRemainder(rawAmounts, totalPaise - allocated);
}

export function calculateSplit(method, totalPaise, participants) {
  switch (method) {
    case 'equal':
      return equalSplit(totalPaise, participants);
    case 'exact':
      return exactSplit(totalPaise, participants);
    case 'percentage':
      return percentageSplit(totalPaise, participants);
    case 'shares':
      return sharesSplit(totalPaise, participants);
    default:
      throw new SplitError(`Unknown split method: ${method}`);
  }
}