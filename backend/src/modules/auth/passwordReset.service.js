import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { User } from '../../models/user.model.js';
import { PasswordReset } from '../../models/passwordReset.model.js';
import { revokeAllRefreshTokens } from '../../utils/refreshToken.service.js';
import { sendMail } from '../../utils/mailer.js';
import { logger } from '../../config/logger.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const CODE_MINUTES = 10; // how long the emailed code works
const RESET_MINUTES = 15; // time to choose a new password after the code is accepted
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function codeEmail(name, code) {
  const text =
    `Hi ${name || 'there'},\n\n` +
    `Your FairShare password reset code is: ${code}\n\n` +
    `It works for ${CODE_MINUTES} minutes. If you didn't ask to reset your password, you can ignore this email — your password stays the same.\n\n` +
    `— FairShare`;
  const html = `
  <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#172B4D">
    <h2 style="margin:0 0 8px">Reset your password</h2>
    <p style="margin:0 0 18px;color:#64748B">Hi ${String(name || 'there').replace(/[<>&"]/g, '')}, use this code in the FairShare app:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;padding:16px;border-radius:14px;background:#E8F1FF;color:#1253B5">${code}</div>
    <p style="margin:18px 0 0;color:#64748B;font-size:14px">The code works for ${CODE_MINUTES} minutes.<br>Didn't ask for this? Ignore this email — your password stays the same.</p>
  </div>`;
  return { text, html };
}

/**
 * Step 1 — email a 6-digit code. Always answers the same way, so nobody can use
 * this form to find out which emails have an account.
 */
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email, role: { $ne: 'admin' } }).select('name email');
  if (!user) {
    logger.info({ email }, '[reset] no account for this email');
    return;
  }

  // Don't spam: one new code per minute
  const recent = await PasswordReset.findOne({ userId: user._id, usedAt: null }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_SECONDS * 1000) return;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await PasswordReset.deleteMany({ userId: user._id, usedAt: null });
  const reset = await PasswordReset.create({
    userId: user._id,
    email: user.email,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });

  try {
    await sendMail({ to: user.email, subject: `${code} is your FairShare reset code`, ...codeEmail(user.name, code) });
  } catch (err) {
    await PasswordReset.deleteOne({ _id: reset._id }); // let them try again straight away
    throw err;
  }
}

/** Step 2 — check the code. Returns a one-time token for choosing the new password. */
export async function verifyResetCode(email, code) {
  const reset = await PasswordReset.findOne({ email, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!reset) throw new AppError('This code has expired. Please ask for a new one.', 400);
  if (reset.attempts >= MAX_ATTEMPTS) throw new AppError('Too many wrong tries. Please ask for a new code.', 429);

  if (!sameHash(sha256(code), reset.codeHash)) {
    reset.attempts += 1;
    await reset.save();
    const left = MAX_ATTEMPTS - reset.attempts;
    throw new AppError(
      left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please ask for a new code.',
      left > 0 ? 400 : 429,
    );
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  reset.verifiedAt = new Date();
  reset.resetTokenHash = sha256(resetToken);
  reset.expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await reset.save();
  return resetToken;
}

/** Step 3 — set the new password and sign out every device. */
export async function resetPassword(resetToken, password) {
  const reset = await PasswordReset.findOne({
    resetTokenHash: sha256(resetToken),
    verifiedAt: { $ne: null },
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!reset) throw new AppError('This reset link has expired. Please start again.', 400);

  const user = await User.findById(reset.userId);
  if (!user) throw new AppError('Account not found', 404);

  user.passwordHash = await bcrypt.hash(password, 10);
  if (!user.authProviders?.includes('local')) user.authProviders = [...(user.authProviders || []), 'local'];
  await user.save();

  reset.usedAt = new Date();
  await reset.save();
  await PasswordReset.deleteMany({ userId: user._id, usedAt: null });
  await revokeAllRefreshTokens(user._id); // log out old sessions everywhere
  return { email: user.email };
}
