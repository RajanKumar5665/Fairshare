import Joi from 'joi';

export const noticeSchema = Joi.object({
  message: Joi.string().trim().min(10).max(1000).required(),
  targetUserId: Joi.string().hex().length(24).allow(null, ''),
});

export const subscriptionSchema = Joi.object({
  status: Joi.string().valid('none', 'active', 'expired').required(),
  validUntil: Joi.date().allow(null),
  amountPaid: Joi.number().min(0).optional(),
  plan: Joi.string().max(50).optional(),
}).unknown(false);
