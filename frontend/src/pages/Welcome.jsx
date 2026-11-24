import { Link } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlineHome, HiOutlineQrcode, HiOutlineScale, HiOutlineGlobe } from 'react-icons/hi';
import Logo from '../components/Logo';

const FEATURES = [
  {
    icon: HiOutlineHome,
    title: 'Roommates',
    text: 'Rent, groceries and bills — the month’s total is split equally among everyone who lived there.',
  },
  {
    icon: HiOutlineGlobe,
    title: 'Trips & friends',
    text: 'Whoever paid, add it. SplitCircle works out the fewest payments to settle everyone.',
  },
  {
    icon: HiOutlineCheckCircle,
    title: 'Everyone approves',
    text: 'An expense counts only after the people in it say “OK”. No more arguments later.',
  },
  {
    icon: HiOutlineQrcode,
    title: 'Join with a QR',
    text: 'Scan your friend’s group QR and you’re in. Export the hisaab as PDF or CSV anytime.',
  },
];

/** First screen for visitors who aren't logged in. */
export default function Welcome() {
  return (
    <div className="wc-page">
      <div className="wc-glow" aria-hidden="true" />
      <main className="wc-main">
        <header className="wc-hero">
          <Logo size={92} className="wc-logo" />
          <h1>
            Split bills fairly
            <br />
            with your <span>circle</span>
          </h1>
          <p>Roommates, trips and friend groups. Add expenses, approve them together, and see exactly who pays whom.</p>
        </header>

        <section className="wc-features" aria-label="What SplitCircle does">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="wc-feature">
              <span className="wc-feature-ico">
                <Icon size={22} />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </section>

        <div className="wc-proof" aria-hidden="true">
          <HiOutlineScale size={18} /> Fair shares, in paise — no rounding fights
        </div>
      </main>

      <footer className="wc-actions">
        <Link to="/register" className="btn-primary wc-cta sc-press">
          Get started — it’s free
        </Link>
        <Link to="/login" className="btn-ghost wc-cta sc-press">
          I already have an account
        </Link>
        <Link to="/join" className="wc-join">
          <HiOutlineQrcode size={16} /> Have a group code or QR? Join a group
        </Link>
        <nav className="wc-legal" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
