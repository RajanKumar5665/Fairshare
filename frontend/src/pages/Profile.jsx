import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { openRazorpaySubscriptionCheckout } from '../utils/razorpay';
import {
  HiOutlineGlobe,
  HiOutlineCreditCard,
  HiOutlineCheck,
  HiOutlineLogout,
  HiSun,
  HiMoon,
} from 'react-icons/hi';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const sub = user?.roomSubscription || {};
  const isSubActive =
    sub.status === 'active' &&
    sub.validUntil &&
    new Date(sub.validUntil) > new Date();

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await api('/api/expenses/monthly-summary');
        setSummary(res.summary);
      } catch (err) {
        console.error('Failed to load monthly summary', err);
      } finally {
        setLoadingSummary(false);
      }
    }
    fetchSummary();
  }, []);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscriptionPayment() {
    setSubscribing(true);
    try {
      const orderRes = await api('/api/subscription/create-order', {
        method: 'POST',
        body: JSON.stringify({ plan: isSubActive ? 'standard_50rs' : 'starter_1rs' }),
      });

      await openRazorpaySubscriptionCheckout({
        orderData: orderRes,
        user,
        onSuccess: async (razorpayResponse) => {
          try {
            const verifyRes = await api('/api/subscription/verify-payment', {
              method: 'POST',
              body: JSON.stringify(razorpayResponse),
            });
            toast.success(verifyRes.message || 'Payment successful!');
            await refreshUser();
          } catch (err) {
            toast.error(err.message || 'Payment verification failed');
          } finally {
            setSubscribing(false);
          }
        },
        onError: (err) => {
          toast.error(err?.description || err?.message || 'Payment was not completed');
          setSubscribing(false);
        },
        onDismiss: () => {
          setSubscribing(false);
        },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to initiate payment');
      setSubscribing(false);
    }
  }

  const languages = [
    { code: 'en', label: 'English', sub: 'Default' },
    { code: 'hinglish', label: 'Hinglish', sub: 'Mix Hindi' },
    { code: 'hi', label: 'हिंदी', sub: 'Pure Hindi' },
  ];

  return (
    <section className="profile-page">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1>{t('profileTitle')}</h1>
          <p className="muted subtitle">{t('profileSubtitle')}</p>
        </div>
      </div>

      <div
        className="profile-panel app-card"
        style={{ maxWidth: 960, margin: '0 auto' }}
      >
        {/* Avatar & User Details */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="profile-avatar-lg">{initials}</div>
          <h2 style={{ marginBottom: 4 }}>{user?.name}</h2>
          <p className="muted text-sm">
            {user?.email || user?.mobile || 'No contact info'}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              marginTop: 10,
              flexWrap: 'wrap',
            }}
          >
            {user?.authProviders?.map((p) => (
              <span key={p} className="badge" style={{ textTransform: 'capitalize' }}>
                {p}
              </span>
            ))}
            {user?.mobileVerified && (
              <span className="badge success">Mobile Verified</span>
            )}
          </div>
        </div>

        <div className="profile-content stack" style={{ gap: 16 }}>
          {/* ── Language Selection Section ────────────────────── */}
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 16,
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <HiOutlineGlobe size={18} style={{ color: 'var(--brand)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {t('languageTitle')}
                </div>
                <div className="text-xs muted">{t('languageSubtitle')}</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: 8,
              }}
            >
              {languages.map((item) => {
                const isSelected = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLang(item.code)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '12px 8px',
                      borderRadius: 12,
                      border: isSelected
                        ? '2px solid var(--brand)'
                        : '1px solid var(--line)',
                      background: isSelected ? 'var(--brand-soft)' : 'var(--card)',
                      color: isSelected ? 'var(--brand)' : 'var(--ink)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <span style={{ fontSize: '0.95rem' }}>{item.label}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: isSelected ? 'var(--brand)' : 'var(--muted)',
                      }}
                    >
                      {item.sub}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 8,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <HiOutlineCheck size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Monthly Spending Card ────────────────────────── */}
          <div
            style={{
              background: 'var(--brand-soft)',
              border: '1px solid var(--brand)',
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                className="text-xs"
                style={{
                  color: 'var(--brand)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t('monthlySpendTitle')} ({summary?.monthName || 'Current Month'})
              </div>
            </div>

            {loadingSummary ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <span className="spinner" />
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: '1.9rem',
                    fontWeight: 800,
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  ₹{(summary?.totalExpensesRupees || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    background: 'var(--card-bg)',
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div>
                    <div className="text-xs muted">{t('roomSpendLabel')}</div>
                    <strong style={{ fontSize: '1rem', color: 'var(--brand)' }}>
                      ₹{(summary?.roomExpensesRupees || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                  <div>
                    <div className="text-xs muted">{t('personalSpendLabel')}</div>
                    <strong style={{ fontSize: '1rem', color: '#10b981' }}>
                      ₹{(summary?.personalExpensesRupees || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Subscription Plan Card ───────────────────────── */}
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 16,
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <HiOutlineCreditCard size={18} style={{ color: 'var(--brand)' }} />
              <span
                className="text-xs"
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted)',
                }}
              >
                {t('roomSubTitle')}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    className={`badge ${isSubActive ? 'success' : 'neutral'}`}
                    style={{ fontSize: '0.82rem', padding: '4px 10px' }}
                  >
                    {isSubActive ? t('activeSubBadge') : t('standardSubBadge')}
                  </span>
                  {isSubActive && sub.validUntil && (
                    <span className="text-xs muted">
                      Valid until:{' '}
                      {new Date(sub.validUntil).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <div className="text-xs muted">{t('subPricingDesc')}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubscriptionPayment}
                  disabled={subscribing}
                >
                  {subscribing
                    ? 'Processing…'
                    : isSubActive
                    ? t('renewPlanBtn')
                    : t('activatePlanBtn')}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => navigate('/rooms')}
                >
                  {t('viewRoomsBtn')}
                </button>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 16,
              border: '1px solid var(--line)',
            }}
          >
            <div
              className="text-xs muted"
              style={{
                marginBottom: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('accountInfoTitle')}
            </div>
            {user?.email && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span className="text-sm muted">{t('emailLabel')}</span>
                <span className="text-sm font-bold">{user.email}</span>
              </div>
            )}
            {user?.mobile && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span className="text-sm muted">{t('mobileLabel')}</span>
                <span className="text-sm font-bold">{user.mobile}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
              }}
            >
              <span className="text-sm muted">{t('memberSinceLabel')}</span>
              <span className="text-sm font-bold">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Theme Toggle */}
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid var(--line)',
            }}
            onClick={toggle}
            role="button"
            tabIndex={0}
            id="profile-theme-toggle"
            onKeyDown={(e) => e.key === 'Enter' && toggle()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {theme === 'dark' ? <HiSun size={20} /> : <HiMoon size={20} />}
              <div>
                <div className="text-sm font-bold">
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </div>
                <div className="text-xs muted">Click to switch theme</div>
              </div>
            </div>
            <div
              className="toggle-pill"
              style={{
                background: theme === 'dark' ? 'var(--brand)' : 'rgba(0,0,0,0.1)',
              }}
            >
              <div
                className="toggle-knob"
                style={{
                  transform: theme === 'dark' ? 'translateX(16px)' : 'none',
                }}
              />
            </div>
          </div>

          {/* Logout */}
          <button
            id="profile-logout-btn"
            type="button"
            className="btn-ghost"
            style={{
              width: '100%',
              justifyContent: 'center',
              color: 'var(--danger)',
              borderColor: 'var(--danger-soft)',
              background: 'var(--danger-soft)',
            }}
            onClick={handleLogout}
            disabled={busy}
          >
            <HiOutlineLogout size={18} />
            {t('logoutBtn')}
          </button>
        </div>
      </div>
    </section>
  );
}
