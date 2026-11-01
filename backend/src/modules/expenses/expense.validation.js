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

export const createExpenseSchema = Joi.object({
  title: Joi.string().min(2).max(100).required(),
  amountRupees: Joi.number().positive().required(),
  category: Joi.string().max(30).default('general'),
  receiptUrl: Joi.string()
    .pattern(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/)
    .max(2097152)
    .allow('', null)
    .optional(),

  type: Joi.string().valid('personal', 'shared').required(),

  roomId: Joi.string()
    .when('type', { is: 'shared', then: Joi.required(), otherwise: Joi.forbidden() }),

  splitMethod: Joi.string()
    .valid('equal', 'exact', 'percentage', 'shares')
    .default('equal')
    .when('type', { is: 'shared', then: Joi.optional(), otherwise: Joi.forbidden() }),

  participants: Joi.array()
    .items(participantBase)
    .when('type', { is: 'shared', then: Joi.optional(), otherwise: Joi.forbidden() }),
});

export const updateExpenseSchema = Joi.object({
  title: Joi.string().min(2).max(100),
  description: Joi.string().max(300).allow(''),
  category: Joi.string().max(30),
  expenseDate: Joi.date(),
  receiptUrl: Joi.string().max(2097152).allow('', null),
  status: Joi.string().valid('active', 'pending_review', 'disputed', 'cancelled'),
  // Allow updating split too (if type is shared)
  amountRupees: Joi.number().positive(),
  splitMethod: Joi.string().valid('equal', 'exact', 'percentage', 'shares'),
  participants: Joi.array().items(participantBase).min(1),
}).min(1);

export const recordSettlementSchema = Joi.object({
  roomId: Joi.string().required(),
  paidTo: Joi.string().required(),
  amountRupees: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('upi', 'cash', 'bank_transfer', 'other').default('upi'),
  transactionRef: Joi.string().max(100).allow('').optional(),
  status: Joi.string().valid('completed', 'pending').default('completed'),
  note: Joi.string().max(200).allow('').optional(),
  settledAt: Joi.date().optional(),
});

export const reverseSettlementSchema = Joi.object({
  reason: Joi.string().min(3).max(300).required(),
});

export const confirmSettlementSchema = Joi.object({
  note: Joi.string().max(200).allow('').optional(),
});