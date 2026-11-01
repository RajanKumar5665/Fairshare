import bcrypt from 'bcrypt';
import { User } from '../../models/user.model.js';
import { generateAccessToken } from '../../utils/token.js';
import { env } from '../../config/env.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    authProviders: ['local'],
  });

  return issueTokens(user);
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) throw new AppError('Invalid credentials', 401);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new AppError('Invalid credentials', 401);

  return issueTokens(user);
}

export async function registerAdmin({ name, mobile, password, registrationSecret }) {
  if (!env.ADMIN_REGISTRATION_SECRET || registrationSecret !== env.ADMIN_REGISTRATION_SECRET) {
    throw new AppError('Invalid admin registration secret', 403);
  }

  const existingAdmin = await User.exists({ role: 'admin' });
  if (existingAdmin) throw new AppError('Only one admin account is allowed', 409);

  const normalizedMobile = mobile.trim();
  const existingMobile = await User.findOne({ mobile: normalizedMobile });
  if (existingMobile) throw new AppError('Mobile number already registered', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({
      name,
      mobile: normalizedMobile,
      passwordHash,
      role: 'admin',
      authProviders: ['local'],
      mobileVerified: true,
    });
    return issueTokens(user);
  } catch (err) {
    if (err?.code === 11000) throw new AppError('Only one admin account is allowed', 409);
    throw err;
  }
}

export async function loginAdmin({ mobile, password }) {
  const user = await User.findOne({ mobile: mobile.trim(), role: 'admin' });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Invalid admin credentials', 401);
  }
  return issueTokens(user);
}

function issueTokens(user) {
  const accessToken = generateAccessToken(user._id.toString());
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      avatar: user.avatar,
      authProviders: user.authProviders,
      mobileVerified: user.mobileVerified,
      roomSubscription: user.roomSubscription || { status: 'none' },
    },
    accessToken,
  };
}

export async function getUserById(userId) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw new AppError('User not found', 404);
  return user;
}