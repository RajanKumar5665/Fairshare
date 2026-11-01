import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import {
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineArrowRight,
} from 'react-icons/hi';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const redirectParam = params.get('redirect');
  const redirectUrl = redirectParam
    ? decodeURIComponent(redirectParam)
    : (sessionStorage.getItem('pending_redirect') || '/');

  if (redirectParam) {
    sessionStorage.setItem('pending_redirect', redirectUrl);
  }

  if (user) return <Navigate to={redirectUrl} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    setBusy(true);
    try {
      await register(form);
      toast.success('Account created successfully! Welcome to FairShare 🎉');
      sessionStorage.removeItem('pending_redirect');
      navigate(redirectUrl);
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page register-page flex min-h-dvh items-center justify-center p-5">
      <div className="auth-panel w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--shadow)] sm:p-8">
        {/* Brand */}
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <div className="brand-mark" aria-hidden="true">F</div>
          <span style={{ color: 'var(--ink)' }}>FairShare</span>
        </div>

        <h1 style={{ textAlign: 'center', marginBottom: 6, fontSize: '1.4rem' }}>Create your account</h1>
        <p className="muted text-sm" style={{ textAlign: 'center', marginBottom: 20 }}>
          Start managing expenses and splitting bills with friends
        </p>

        <GoogleLoginButton redirectUrl={redirectUrl} />
        <div className="divider" style={{ margin: '18px 0' }}>or register with email</div>

        <form className="stack" onSubmit={onSubmit} id="register-form">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name">Full name</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <HiOutlineUser size={17} />
              </span>
              <input
                id="register-name"
                autoComplete="name"
                className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                style={{ paddingLeft: 38 }}
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-email">Email address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <HiOutlineMail size={17} />
              </span>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                style={{ paddingLeft: 38 }}
                placeholder="you@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-password">Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <HiOutlineLockClosed size={17} />
              </span>
              <input
                id="register-password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                style={{ paddingLeft: 38, paddingRight: 44 }}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
              </button>
            </div>
            <p className="text-xs muted" style={{ marginTop: 2 }}>
              Must be at least 8 characters long.
            </p>
          </div>

          <button
            id="register-submit-btn"
            className="btn-primary"
            type="submit"
            disabled={busy}
            style={{ justifyContent: 'center' }}
          >
            {busy ? (
              <><span className="spinner" /> Creating account…</>
            ) : (
              <>Create account <HiOutlineArrowRight size={17} /></>
            )}
          </button>

          <div className="stack" style={{ textAlign: 'center', marginTop: 12, gap: 8 }}>
            <p className="text-sm muted" style={{ textAlign: 'center' }}>
              Prefer mobile login?{' '}
              <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                Sign in with OTP →
              </Link>
            </p>
            <p className="text-sm muted" style={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
