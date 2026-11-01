import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/refreshToken.model.js';
import { env } from '../config/env.js';

const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createRefreshToken(userId) {
  const family = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, fam: family }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
  await RefreshToken.create({
    userId,
    token,
    family,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });
  return token;
}

export async function rotateRefreshToken(oldToken) {
  let decoded;
  try {
    decoded = jwt.verify(oldToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const record = await RefreshToken.findOne({ token: oldToken });
  if (!record) {
    // Token not in DB — either already used or stolen. Invalidate entire family.
    await RefreshToken.deleteMany({ family: decoded.fam });
    throw Object.assign(new Error('Refresh token reuse detected. Please log in again.'), { statusCode: 401 });
  }

  // Invalidate old token
  await record.deleteOne();

  // Issue new token, same family
  const newToken = jwt.sign({ sub: decoded.sub, fam: record.family }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
  await RefreshToken.create({
    userId: decoded.sub,
    token: newToken,
    family: record.family,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });

  return { accessUserId: decoded.sub, newRefreshToken: newToken };
}

export async function revokeAllRefreshTokens(userId) {
  await RefreshToken.deleteMany({ userId });
}
