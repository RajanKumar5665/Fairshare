import { useState } from 'react';
import { toast } from 'react-hot-toast';
import Brand from '../components/Brand';
import { useAuth } from '../auth';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', password: '', registrationSecret: '' });
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (registerMode) await register(form);
      else await login(form.mobile, form.password);
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally { setBusy(false); }
  }

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  return <main className="auth-shell">
    <section className="auth-visual"><Brand /><div><p className="eyebrow">SECURE OPERATIONS</p><h1>One place to keep<br /><em>every room</em> accountable.</h1><p>Manage subscriptions, members and platform activity with clear, auditable controls.</p></div><span className="visual-foot">Protected admin workspace · FairShare</span></section>
    <section className="auth-form-wrap"><form className="auth-card" onSubmit={submit}>
      <div className="mobile-brand"><Brand /></div><p className="eyebrow">{registerMode ? 'FIRST-TIME SETUP' : 'ADMIN PORTAL'}</p><h2>{registerMode ? 'Create administrator' : 'Welcome back'}</h2><p className="muted">{registerMode ? 'Only one admin account can ever be created.' : 'Sign in to continue to the control center.'}</p>
      {registerMode && <Field label="Full name" value={form.name} onChange={(value) => update('name', value)} />}
      <Field label="Mobile number" type="tel" value={form.mobile} onChange={(value) => update('mobile', value)} />
      <Field label="Password" type="password" minLength={12} value={form.password} onChange={(value) => update('password', value)} />
      {registerMode && <Field label="Server registration secret" type="password" minLength={24} value={form.registrationSecret} onChange={(value) => update('registrationSecret', value)} />}
      <button className="button button-primary full" disabled={busy}>{busy ? 'Please wait…' : registerMode ? 'Create secure account' : 'Sign in securely'}</button>
      <button type="button" className="link-button" onClick={() => setRegisterMode((value) => !value)}>{registerMode ? 'Already set up? Sign in' : 'First setup? Create admin account'}</button>
    </form></section>
  </main>;
}

function Field({ label, type = 'text', value, onChange, minLength }) {
  return <label className="field"><span>{label}</span><input required type={type} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
