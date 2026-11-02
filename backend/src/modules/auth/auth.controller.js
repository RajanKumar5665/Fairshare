import { registerSchema, loginSchema, adminRegisterSchema, adminLoginSchema } from './auth.validation.js';
import { registerUser, loginUser, registerAdmin, loginAdmin, getUserById } from './auth.service.js';
import { sendOtp, verifyOtp, createMobileUser } from './otp.service.js';
import { generateAccessToken } from '../../utils/token.js';
import { createRefreshToken, rotateRefreshToken, revokeAllRefreshTokens } from '../../utils/refreshToken.service.js';
import { User } from '../../models/user.model.js';
import { env } from '../../config/env.js';

const isSecureDeployment = env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const cookieOptions = {
  httpOnly: true,
  secure: isSecureDeployment,
  sameSite: isSecureDeployment ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

if (env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' && !process.env.VERCEL) {
  cookieOptions.domain = env.COOKIE_DOMAIN;
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, cookieOptions);
}

// ─── Email/password register ───────────────────────────────────────────────
export async function register(req, res, next) {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { user, accessToken } = await registerUser(value);
    const refreshToken = await createRefreshToken(user.id.toString());
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

// ─── Email/password login ──────────────────────────────────────────────────
export async function login(req, res, next) {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { user, accessToken } = await loginUser(value);
    const refreshToken = await createRefreshToken(user.id.toString());
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

export async function adminRegister(req, res, next) {
  try {
    const { error, value } = adminRegisterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const { user, accessToken } = await registerAdmin(value);
    const refreshToken = await createRefreshToken(user.id.toString());
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

export async function adminLogin(req, res, next) {
  try {
    const { error, value } = adminLoginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const { user, accessToken } = await loginAdmin(value);
    const refreshToken = await createRefreshToken(user.id.toString());
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────
export async function logout(req, res) {
  const token = req.cookies?.refreshToken || req.body?.refreshToken || req.headers['x-refresh-token'];
  if (token) {
    try {
      // revoke the specific token from DB (best-effort)
      const { RefreshToken } = await import('../../models/refreshToken.model.js');
      await RefreshToken.deleteOne({ token });
    } catch { /* ignore */ }
  }
  res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
  res.json({ success: true, message: 'Logged out' });
}

// ─── Refresh (with rotation) ───────────────────────────────────────────────
export async function refresh(req, res, next) {
  try {
    const oldToken = req.cookies?.refreshToken || req.body?.refreshToken || req.headers['x-refresh-token'];
    if (!oldToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const { accessUserId, newRefreshToken } = await rotateRefreshToken(oldToken);
    const accessToken = generateAccessToken(accessUserId);

    setRefreshCookie(res, newRefreshToken);
    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
    res.status(401).json({ success: false, message: err.message || 'Invalid refresh token' });
  }
}

// ─── Me ────────────────────────────────────────────────────────────────────
export async function me(req, res, next) {
  try {
    const user = await getUserById(req.userId);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

// ─── OTP: Send ────────────────────────────────────────────────────────────
export async function otpSend(req, res, next) {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ success: false, message: 'Mobile number required' });
    const result = await sendOtp(mobile);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────
export async function googleAuth(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'idToken required' });
    if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID === 'your_google_oauth_client_id') {
      return res.status(503).json({ success: false, message: 'Google login is not configured on the server' });
    }
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const validIssuer = payload?.iss === 'https://accounts.google.com' || payload?.iss === 'accounts.google.com';
    if (!payload?.sub || !payload.email || payload.email_verified !== true || !validIssuer) {
      return res.status(401).json({ success: false, message: 'Google account email is not verified' });
    }
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || 'Google User';
    // Find or create user
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        if (!Array.isArray(user.authProviders)) user.authProviders = [];
        if (!user.authProviders.includes('google')) user.authProviders.push('google');
        if (payload.picture && !user.avatar) user.avatar = payload.picture;
        await user.save();
      } else {
        user = await User.create({
          name,
          email,
          googleId,
          avatar: payload.picture || '',
          authProviders: ['google'],
        });
      }
    }
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = await createRefreshToken(user._id.toString());
    setRefreshCookie(res, refreshToken);
    const u = { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
    return res.json({ success: true, user: u, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

// ─── OTP: Verify ──────────────────────────────────────────────────────────
export async function otpVerify(req, res, next) {
  try {
    const { mobile, code, name } = req.body;
    if (!mobile || !code) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP required' });
    }

    const result = await verifyOtp(mobile, code);

    if (result.isNew) {
      // New user — need a name
      if (!name || name.trim().length < 2) {
        return res.status(200).json({ success: true, needsName: true, mobile });
      }
      const user = await createMobileUser(mobile, name.trim());
      const { Otp } = await import('../../models/otp.model.js');
      await Otp.deleteMany({ mobile: user.mobile });
      const accessToken = generateAccessToken(user._id.toString());
      const refreshToken = await createRefreshToken(user._id.toString());
      setRefreshCookie(res, refreshToken);
      const u = { id: user._id, name: user.name, mobile: user.mobile, avatar: user.avatar };
      return res.status(201).json({ success: true, user: u, accessToken, refreshToken });
    }

    // Existing user
    const u = result.user;
    const accessToken = generateAccessToken(u._id.toString());
    const refreshToken = await createRefreshToken(u._id.toString());
    setRefreshCookie(res, refreshToken);
    return res.json({
      success: true,
      user: { id: u._id, name: u.name, mobile: u.mobile, email: u.email, avatar: u.avatar },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}
