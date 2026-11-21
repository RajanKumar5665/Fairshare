import Joi from 'joi';

export const createRoomSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  type: Joi.string().valid('room', 'trip', 'group').default('room'),
  startDate: Joi.date().allow(null).optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null).optional(),
  description: Joi.string().max(300).allow('').optional(),
  address: Joi.string().max(200).allow('').optional(),
  monthlyRent: Joi.number().min(0).optional(),
  customCategories: Joi.array().items(Joi.string().trim().max(30)).optional(),
  currency: Joi.string().length(3).default('INR'),
  settings: Joi.object({
    allowMemberInvite: Joi.boolean().default(true),
    requireApproval: Joi.boolean().default(true),
    defaultSplitMethod: Joi.string().valid('equal', 'exact', 'percentage', 'shares').default('equal'),
  }).optional(),
});

export const updateRoomSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  type: Joi.string().valid('room', 'trip', 'group'),
  startDate: Joi.date().allow(null),
  endDate: Joi.date().allow(null),
  description: Joi.string().max(300).allow(''),
  address: Joi.string().max(200).allow(''),
  monthlyRent: Joi.number().min(0),
  customCategories: Joi.array().items(Joi.string().trim().max(30)),
  status: Joi.string().valid('active', 'archived'),
  settings: Joi.object({
    allowMemberInvite: Joi.boolean(),
    requireApproval: Joi.boolean(),
    defaultSplitMethod: Joi.string().valid('equal', 'exact', 'percentage', 'shares'),
  }).min(1),
}).min(1);

export const inviteSchema = Joi.object({
  invitedEmail: Joi.string().email().allow('', null).optional(),
  expiresInDays: Joi.number().min(1).max(90).optional(),
  reset: Joi.boolean().default(false), // owner/admin: revoke the current link and make a new one
});

export const joinRoomSchema = Joi.object({
  token: Joi.string().required(),
});

export const updateRoleSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member').required(),
});

export const transferOwnershipSchema = Joi.object({
  newOwnerId: Joi.string().required(),
});