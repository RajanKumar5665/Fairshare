import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/refreshToken.model.js';
import { env } from '../config/env.js';

const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ROTATION_GRACE_MS = 30 * 1000; // 30 second grace period for concurrent requests

export async function createRefreshToken(userId) {
  const family = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, fam: family }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
  await RefreshToken.create({
    userId,
    token,
    family,
    used: false,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });
  return token;
}

export async function rotateRefreshToken(oldToken) {
  let decoded;
  try {
    decoded = jwt.verify(oldToken, env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  const record = await RefreshToken.findOne({ token: oldToken });

  if (!record) {
    // Check if there is an active token created recently in this family
    const activeRecent = await RefreshToken.findOne({
      family: decoded.fam,
      used: false,
      createdAt: { $gte: new Date(Date.now() - ROTATION_GRACE_MS) },
    }).sort({ createdAt: -1 });

    if (activeRecent) {
      return { accessUserId: decoded.sub, newRefreshToken: activeRecent.token };
    }

    // Truly unknown token - reuse detected, revoke family
    await RefreshToken.deleteMany({ family: decoded.fam });
    const err = new Error('Refresh token reuse detected. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  // If token is already marked used, check if within grace period
  if (record.used) {
    const timeSinceUsed = Date.now() - new Date(record.updatedAt).getTime();
    if (timeSinceUsed < ROTATION_GRACE_MS) {
      const activeRecent = await RefreshToken.findOne({
        family: record.family,
        used: false,
      }).sort({ createdAt: -1 });

      if (activeRecent) {
        return { accessUserId: decoded.sub, newRefreshToken: activeRecent.token };
      }
    }

    // Beyond grace window: revoke family
    await RefreshToken.deleteMany({ family: record.family });
    const err = new Error('Refresh token already used. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  // Mark current record as used
  record.used = true;
  await record.save();

  // Issue new token, same family
  const newToken = jwt.sign({ sub: decoded.sub, fam: record.family }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  await RefreshToken.create({
    userId: decoded.sub,
    token: newToken,
    family: record.family,
    used: false,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });

  return { accessUserId: decoded.sub, newRefreshToken: newToken };
}

export async function revokeAllRefreshTokens(userId) {
  await RefreshToken.deleteMany({ userId });
}
