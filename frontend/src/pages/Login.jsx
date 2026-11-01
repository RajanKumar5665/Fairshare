
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import {
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineDeviceMobile,
  HiOutlineMail,
} from 'react-icons/hi';

// ─── Coming Soon Mobile Login ────────────────────────────────────────────────
function MobileLoginComingSoon() {
  return (
    <div
      className="stack"
      role="status"
      aria-live="polite"
      style={{ textAlign: 'center', padding: '28px 16px' }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 58,
          height: 58,
          margin: '0 auto 14px',
          borderRadius: 18,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
        }}
      >
        <HiOutlineDeviceMobile size={27} />
      </div>

      <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ink)' }}>
        Coming Soon
      </h2>

      <p className="muted text-sm" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
        Mobile OTP login is temporarily unavailable. Please use Google or Email
        to sign in.
      </p>
    </div>
  );
}

// ─── Email Login ─────────────────────────────────────────────────────────────
function EmailLogin({ redirectUrl }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      await login(form);

      toast.success('Welcome back! 👋');
      sessionStorage.removeItem('pending_redirect');

      navigate(redirectUrl || '/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} id="email-login-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-input">Email address</label>

        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 13,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              display: 'flex',
            }}
          >
            <HiOutlineMail size={17} />
          </span>

          <input
            id="email-input"
            className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
            style={{ paddingLeft: 38 }}
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password-input">Password</label>

        <div style={{ position: 'relative' }}>
          <input
            id="password-input"
            className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
            required
            style={{ paddingRight: 44 }}
          />

          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? (
              <HiOutlineEyeOff size={18} />
            ) : (
              <HiOutlineEye size={18} />
            )}
          </button>
        </div>
      </div>

      <button
        id="email-login-btn"
        className="btn-primary"
        type="submit"
        disabled={busy}
        style={{ justifyContent: 'center' }}
      >
        {busy ? (
          <>
            <span className="spinner" /> Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </button>

      <p className="text-sm muted" style={{ textAlign: 'center' }}>
        Don't have an account?{' '}
        <Link
          to={`/register${
            redirectUrl
              ? `?redirect=${encodeURIComponent(redirectUrl)}`
              : ''
          }`}
          style={{ color: 'var(--brand)', fontWeight: 600 }}
        >
          Create one
        </Link>
      </p>
    </form>
  );
}

// ─── Main Login Page ─────────────────────────────────────────────────────────
export default function Login() {
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [tab, setTab] = useState('mobile');

  const redirectParam = params.get('redirect');

  const redirectUrl = redirectParam
    ? decodeURIComponent(redirectParam)
    : sessionStorage.getItem('pending_redirect') || '/';

  if (redirectParam) {
    sessionStorage.setItem('pending_redirect', redirectUrl);
  }

  if (user) {
    return <Navigate to={redirectUrl} replace />;
  }

  return (
    <div className="auth-page login-page flex min-h-dvh items-center justify-center p-5">
      <div className="auth-panel w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--shadow)] sm:p-8">

        {/* Brand */}
        <div
          className="brand"
          style={{ justifyContent: 'center', marginBottom: 24 }}
        >
          <div className="brand-mark" aria-hidden="true">
            F
          </div>

          <span style={{ color: 'var(--ink)' }}>
            FairShare
          </span>
        </div>

        <h1
          style={{
            textAlign: 'center',
            marginBottom: 6,
            fontSize: '1.4rem',
          }}
        >
          Welcome back 👋
        </h1>

        <p
          className="muted text-sm"
          style={{ textAlign: 'center', marginBottom: 20 }}
        >
          Sign in to track expenses and split bills
        </p>

        {/* Google Login */}
        <GoogleLoginButton redirectUrl={redirectUrl} />

        <div className="divider" style={{ margin: '18px 0' }}>
          or continue with
        </div>

        {/* Login Tabs */}
        <div className="auth-tabs" style={{ marginBottom: 20 }}>
          <button
            id="tab-mobile"
            className={`auth-tab ${tab === 'mobile' ? 'active' : ''}`}
            onClick={() => setTab('mobile')}
            type="button"
          >
            <HiOutlineDeviceMobile size={16} />
            Mobile OTP
          </button>

          <button
            id="tab-email"
            className={`auth-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => setTab('email')}
            type="button"
          >
            <HiOutlineMail size={16} />
            Email
          </button>
        </div>

        {/* Login Content */}
        {tab === 'mobile' ? (
          <MobileLoginComingSoon />
        ) : (
          <EmailLogin redirectUrl={redirectUrl} />
        )}

      </div>
    </div>
  );
}
