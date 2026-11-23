import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineEye, HiOutlineEyeOff, HiOutlineKey, HiOutlineMail, HiOutlineShieldCheck } from 'react-icons/hi';
import { api } from '../api/client';

const RESEND_SECONDS = 60;
const INPUT =
  'w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all';

/** Forgot password: 1) email → 2) 6-digit code from the email → 3) new password. */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState('email'); // email | code | password
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function sendCode(e) {
    e?.preventDefault();
    if (!email.trim()) return toast.error('Enter your email');
    setBusy(true);
    try {
      await api('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('code');
      setCode('');
      setWait(RESEND_SECONDS);
      toast.success('Code sent — check your email');
    } catch (err) {
      toast.error(err.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit code from the email');
    setBusy(true);
    try {
      const res = await api('/api/auth/password/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code }),
      });
      setResetToken(res.resetToken);
      setStep('password');
    } catch (err) {
      toast.error(err.message || 'Wrong code');
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== confirm) return toast.error('The two passwords don’t match');
    setBusy(true);
    try {
      const res = await api('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ resetToken, password }),
      });
      toast.success('Password changed! Log in with your new password.');
      navigate(`/login?email=${encodeURIComponent(res.email || email.trim())}`, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Could not change the password');
      if (/expired|start again/i.test(err.message || '')) setStep('email');
    } finally {
      setBusy(false);
    }
  }

  // Auto-submit when the 6th digit is typed or pasted
  useEffect(() => {
    if (step === 'code' && code.length === 6 && !busy) verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const strength =
    password.length === 0 ? null : password.length < 8 ? 'weak' : /[A-Z]/.test(password) && /\d/.test(password) && password.length >= 10 ? 'strong' : 'ok';

  const stepIndex = { email: 0, code: 1, password: 2 }[step];

  return (
    <div className="auth-page login-page flex min-h-dvh items-center justify-center p-5">
      <div className="auth-panel fp-panel w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--shadow)] sm:p-8">
        <Link to="/login" className="fp-back">
          <HiOutlineArrowLeft size={16} /> Back to login
        </Link>

        <div className="fp-icon" aria-hidden="true">
          {step === 'email' ? <HiOutlineMail size={26} /> : step === 'code' ? <HiOutlineShieldCheck size={26} /> : <HiOutlineKey size={26} />}
        </div>

        <h1 className="fp-title">
          {step === 'email' ? 'Forgot your password?' : step === 'code' ? 'Check your email' : 'Create a new password'}
        </h1>
        <p className="muted text-sm fp-sub">
          {step === 'email' && 'No problem. Enter the email you signed up with and we’ll send you a 6-digit code.'}
          {step === 'code' && (
            <>
              We sent a code to <strong className="fp-email">{email.trim()}</strong>. It works for 10 minutes. Can’t find it? Check
              your Spam folder.
            </>
          )}
          {step === 'password' && 'Choose a new password you don’t use anywhere else.'}
        </p>

        <ol className="fp-steps" aria-label="Progress">
          {['Email', 'Code', 'New password'].map((label, i) => (
            <li key={label} className={i < stepIndex ? 'done' : i === stepIndex ? 'on' : ''}>
              <span>{i < stepIndex ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {step === 'email' && (
          <form className="stack" onSubmit={sendCode}>
            <label htmlFor="fp-email">Email address</label>
            <input
              id="fp-email"
              className={INPUT}
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button className="btn-primary fp-btn" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> Sending…
                </>
              ) : (
                'Send code'
              )}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="stack" onSubmit={verifyCode}>
            <label htmlFor="fp-code">6-digit code</label>
            <input
              id="fp-code"
              ref={codeRef}
              className={`${INPUT} fp-code`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button className="btn-primary fp-btn" type="submit" disabled={busy || code.length !== 6}>
              {busy ? (
                <>
                  <span className="spinner" /> Checking…
                </>
              ) : (
                'Verify code'
              )}
            </button>
            <div className="fp-row">
              <button type="button" className="fp-link" onClick={() => setStep('email')}>
                Change email
              </button>
              {wait > 0 ? (
                <span className="muted text-sm">Resend in {wait}s</span>
              ) : (
                <button type="button" className="fp-link" onClick={sendCode} disabled={busy}>
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        {step === 'password' && (
          <form className="stack" onSubmit={savePassword}>
            <label htmlFor="fp-pass">New password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="fp-pass"
                className={INPUT}
                style={{ paddingRight: 44 }}
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <button
                type="button"
                className="fp-eye"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
              </button>
            </div>
            {strength && (
              <div className={`fp-strength ${strength}`}>
                <span />
                <small>
                  {strength === 'weak' ? 'Too short' : strength === 'ok' ? 'Good — add a capital letter and a number to make it stronger' : 'Strong password'}
                </small>
              </div>
            )}

            <label htmlFor="fp-confirm">Confirm new password</label>
            <input
              id="fp-confirm"
              className={INPUT}
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirm && confirm !== password && <small className="fp-err">The passwords don’t match yet</small>}

            <button className="btn-primary fp-btn" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> Saving…
                </>
              ) : (
                'Save new password'
              )}
            </button>
            <small className="muted text-xs" style={{ textAlign: 'center' }}>
              For your safety, you’ll be logged out on all other devices.
            </small>
          </form>
        )}
      </div>
    </div>
  );
}
