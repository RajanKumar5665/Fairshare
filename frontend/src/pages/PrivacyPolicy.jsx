import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
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

        <h1 style={{ fontSize: '1.8rem', marginBottom: 8 }}>Privacy Policy</h1>
        <p className="muted text-sm" style={{ marginBottom: 24 }}>
          Last updated: October 2026 • Compliant with Google Play Store Policies & Data Privacy Regulations
        </p>

        <div className="stack" style={{ gap: 20, lineHeight: 1.6, color: 'var(--ink)' }}>
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>1. Overview</h2>
            <p className="text-sm">
              FairShare (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) respects your privacy. This Privacy Policy describes how we collect, use, and protect your information when you access or use the FairShare web and mobile Progressive Web App (PWA).
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>2. Information We Collect</h2>
            <ul className="text-sm stack" style={{ gap: 6, paddingLeft: 20 }}>
              <li><strong>Account Information:</strong> Name, email address, or mobile phone number provided during registration or OTP login.</li>
              <li><strong>Financial & Expense Records:</strong> Transaction titles, amounts, categories, dates, and split percentages for personal or group rooms.</li>
              <li><strong>Device & Usage Data:</strong> Minimal device diagnostics, browser type, and network status to provide offline PWA capabilities.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>3. How We Use Your Data</h2>
            <p className="text-sm">
              Your data is exclusively used to:
            </p>
            <ul className="text-sm stack" style={{ gap: 6, paddingLeft: 20 }}>
              <li>Compute personal expense statistics and room bill splitting calculations.</li>
              <li>Authenticate your account securely via OTP or encrypted passwords.</li>
              <li>Enable offline data sync and installable Progressive Web App functionality.</li>
              <li>We never sell, rent, or trade your personal data with third-party advertisers.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>4. Security & Storage</h2>
            <p className="text-sm">
              We employ strict security measures including Content Security Policies (CSP), HTTP-only secure cookie tokens with automatic rotation, bcrypt password hashing, and MongoDB injection filtering.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>5. Account Deletion & Rights</h2>
            <p className="text-sm">
              You have the right to request deletion of your account and associated expense records at any time from your Profile settings or by contacting our support team.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--brand)' }}>6. Contact Us</h2>
            <p className="text-sm">
              If you have any questions about this Privacy Policy, please reach out to us at <code>support@fairshare.app</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
