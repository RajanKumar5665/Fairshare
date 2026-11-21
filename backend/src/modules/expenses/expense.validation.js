import Joi from 'joi';

// ─── Participant schemas per split method ──────────────────────────────────────

const participantBase = Joi.object({
  userId: Joi.string().required(),
  // Exact split: per-participant share in rupees
  amountRupees: Joi.number().min(0),
  // Percentage split: 0-100
  percentage: Joi.number().min(0).max(100),
  // Shares split: positive integer/decimal
  shares: Joi.number().positive(),
});

// Allow back-dating (e.g. adding last week's groceries) but not future dates.
// 36h of slack: a date-only value like "2026-11-20" parses as UTC midnight, which
// is still "tomorrow" for a server clock shortly after midnight IST.
const expenseDate = Joi.date()
  .custom((value, helpers) =>
    value.getTime() > Date.now() + 36 * 60 * 60 * 1000 ? helpers.error('date.future') : value,
  )
  .messages({ 'date.future': 'Expense date cannot be in the future' });

export const createExpenseSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100).required(),
  amountRupees: Joi.number().positive().max(10000000).precision(2).required(),
  category: Joi.string().max(30).default('general'),
  description: Joi.string().max(300).allow('').optional(),
  expenseDate: expenseDate.optional(),
  receiptUrl: Joi.string()
    .pattern(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/)
    .max(2097152)
    .allow('', null)
    .optional(),

  type: Joi.string().valid('personal', 'shared').required(),

  roomId: Joi.string()
    .when('type', { is: 'shared', then: Joi.required(), otherwise: Joi.forbidden() }),

  // Who actually paid (defaults to the person adding it) — e.g. "Amit paid for dinner"
  paidBy: Joi.string()
    .when('type', { is: 'shared', then: Joi.optional(), otherwise: Joi.forbidden() }),

  splitMethod: Joi.string()
    .valid('equal', 'exact', 'percentage', 'shares')
    .default('equal')
    .when('type', { is: 'shared', then: Joi.optional(), otherwise: Joi.forbidden() }),

  participants: Joi.array()
    .items(participantBase)
    .unique('userId')
    .when('type', { is: 'shared', then: Joi.optional(), otherwise: Joi.forbidden() }),
});

// Status is not client-editable: it is driven by approvals, disputes and delete.
export const updateExpenseSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100),
  description: Joi.string().max(300).allow(''),
  category: Joi.string().max(30),
  expenseDate,
  receiptUrl: Joi.string()
    .pattern(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/)
    .max(2097152)
    .allow('', null),
  amountRupees: Joi.number().positive().max(10000000).precision(2),
  splitMethod: Joi.string().valid('equal', 'exact', 'percentage', 'shares'),
  participants: Joi.array().items(participantBase).min(1).unique('userId'),
}).min(1);

export const reviewExpenseSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  note: Joi.string().trim().max(300).allow('').default('').when('action', {
    is: 'reject',
    then: Joi.string().trim().min(3).required().messages({
      'any.required': 'Please tell your roommates why you are rejecting this',
      'string.empty': 'Please tell your roommates why you are rejecting this',
      'string.min': 'Please tell your roommates why you are rejecting this',
    }),
  }),
});

export const periodQuerySchema = Joi.object({
  cycle: Joi.number().integer().min(1),
  month: Joi.alternatives().try(Joi.string().valid('all'), Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/)),
})
  .or('cycle', 'month')
  .messages({ 'object.missing': 'Send a cycle number or a month' })
  .unknown(true);

export const monthQuerySchema = Joi.object({
  month: Joi.alternatives()
    .try(Joi.string().valid('all'), Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/))
    .required()
    .messages({ 'alternatives.match': 'Month must be YYYY-MM or "all"' }),
}).unknown(true);

export const recordSettlementSchema = Joi.object({
  roomId: Joi.string().required(),
  paidTo: Joi.string().required(),
  // Set when the receiver records money they got; defaults to the current user.
  paidBy: Joi.string().optional(),
  cycle: Joi.number().integer().min(1).optional(), // room month this payment settles
  forMonth: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).allow(null, '').optional(),
  amountRupees: Joi.number().positive().max(10000000).precision(2).required(),
  paymentMethod: Joi.string().valid('upi', 'cash', 'bank_transfer', 'other').default('upi'),
  transactionRef: Joi.string().max(100).allow('').optional(),
  status: Joi.string().valid('completed', 'pending').optional(), // ignored: decided server-side
  note: Joi.string().max(200).allow('').optional(),
  settledAt: Joi.date().optional(),
});

export const reverseSettlementSchema = Joi.object({
  reason: Joi.string().min(3).max(300).required(),
});

export const confirmSettlementSchema = Joi.object({
  note: Joi.string().max(200).allow('').optional(),
});