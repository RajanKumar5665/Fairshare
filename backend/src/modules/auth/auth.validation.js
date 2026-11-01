import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required(),

  password: Joi.string()
    .min(8)
    .max(128)
    .required(),
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required(),

  password: Joi.string()
    .required(),
});

export const adminRegisterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  mobile: Joi.string().trim().pattern(/^\+?[1-9]\d{9,14}$/).required(),
  password: Joi.string().min(12).max(128).required(),
  registrationSecret: Joi.string().min(24).required(),
});

export const adminLoginSchema = Joi.object({
  mobile: Joi.string().trim().pattern(/^\+?[1-9]\d{9,14}$/).required(),
  password: Joi.string().required(),
});