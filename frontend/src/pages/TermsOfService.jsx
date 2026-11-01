import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="legal-page flex min-h-dvh items-center justify-center p-5" style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-[var(--shadow)]" style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="brand">
            
            <span>FairShare</span>
          </div>
          <Link to="/" className="relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border-0 bg-[var(--brand)] px-[18px] py-[11px] text-[.95rem] font-semibold text-white transition-all hover:shadow-[0_4px_16px_var(--brand-glow)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--brand-soft)] text-[var(--brand)] shadow-none hover:bg-[var(--brand-soft)]" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
            ← Back to App
          </Link>
        </div>

        <h1 style={{ fontSize: '1.8rem', marginBottom: 8 }}>Terms of Service</h1>
        <p className="muted text-sm" style={{ marginBottom: 24 }}>
          Last updated: October 2026 • FairShare Terms & Conditions
        </p>

        <div className="stack" style={{ gap: 20, lineHeight: 1.6, color: 'var(--ink)' }}>
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>1. Acceptance of Terms</h2>
            <p className="text-sm">
              By accessing or using FairShare, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>2. Use of Service</h2>
            <p className="text-sm">
              FairShare is an expense management and bill calculation tool. You agree to use the service for legitimate financial tracking and expense sharing purposes only.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>3. Account Responsibility</h2>
            <p className="text-sm">
              You are responsible for maintaining the confidentiality of your credentials and OTP codes. You agree to notify us immediately of any unauthorized access to your account.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>4. Limitation of Liability</h2>
            <p className="text-sm">
              FairShare provides bill calculation tools as-is. We do not act as a banking institution or handle money transfers directly; payments settled between users are the sole responsibility of the respective parties.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>5. Modifications</h2>
            <p className="text-sm">
              We reserve the right to revise or replace these terms at any time. Continued use of FairShare after modifications signifies acceptance of the revised terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
