import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnline } from '../hooks/useOnline';
import { flushOfflineQueue } from '../utils/offlineQueue';
import { api } from '../api/client';
import { useEffect } from 'react';
import Logo from './Logo';
import {
  refreshPendingApprovals,
  resetPendingApprovals,
  usePendingApprovals,
} from '../hooks/usePendingApprovals';
import {
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineExternalLink,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineWifi,
} from 'react-icons/hi';
import { HiSun, HiMoon } from 'react-icons/hi';


export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const online = useOnline();
  const { count: pendingCount } = usePendingApprovals({ enabled: Boolean(user) });
  const userId = user?._id || user?.id;

  useEffect(() => {
    resetPendingApprovals();
    if (userId) refreshPendingApprovals({ force: true });
  }, [userId]);

  const pendingBadge = pendingCount > 0 && (
    <span className="nav-badge" aria-label={t('{n} expenses waiting for your approval', { n: pendingCount })}>
      {pendingCount > 9 ? '9+' : pendingCount}
    </span>
  );

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  async function handleLogout() {
    await logout();
    toast.success(t('Logged out successfully'));
    navigate('/login');
  }

  // Phase 11: Auto-flush offline queue when back online
  useEffect(() => {
    if (online) {
      flushOfflineQueue(api).then(({ synced }) => {
        if (synced > 0) {
          toast.success(synced > 1 ? t('Synced {n} offline transactions!', { n: synced }) : t('Synced {n} offline transaction!', { n: synced }));
        }
      });
    }
  }, [online]);

  return (
    <div className="app-layout grid min-h-dvh grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] md:h-dvh">
      {/* ── Offline Banner ─────────────────────────────────────────── */}
      {!online && (
        <div className="offline-banner" role="alert">
          <HiOutlineWifi size={16} />
          {t("You're offline — some features may be limited")}
        </div>
      )}

      {/* ── Sidebar (desktop) ──────────────────────────────────────── */}
      <aside
        className="sticky top-0 z-10 hidden h-dvh flex-col gap-5 overflow-y-auto px-4 py-6 md:flex"
        style={{
          background: 'var(--sidebar-bg)',
          color: 'var(--sidebar-ink)',
        }}
        aria-label={t('Main navigation')}
      >
        <div className="brand">
          <span className="brand-mark sc-mark" aria-hidden="true"><Logo size={40} /></span>
          <span className="brand-copy">
            <strong>SplitCircle</strong>
            <small>{t('Split bills, stay even')}</small>
          </span>
        </div>

        <nav className="nav-links" aria-label={t('Site navigation')}>
          {user ? (
            <>
              <NavLink to="/" end id="nav-dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineHome size={20} />
                {t('navDashboard')}
              </NavLink>
              <NavLink to="/rooms" id="nav-rooms" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineUserGroup size={20} />
                {t('navRooms')}
                {pendingBadge}
              </NavLink>
              <NavLink to="/join" id="nav-join" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineExternalLink size={20} />
                {t('navJoin')}
              </NavLink>
              <NavLink to="/profile" id="nav-profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineUser size={20} />
                {t('navProfile')}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/join" id="nav-join" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineExternalLink size={20} />
                {t('navJoin')}
              </NavLink>
              <NavLink to="/login" id="nav-login" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineUser size={20} />
                {t('Sign in')}
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-user">
          {user ? (
            <>
              <div className="user-info">
                <div className="user-avatar">{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="user-name">{user?.name || t('User')}</div>
                  <div className="user-sub">{user?.email || user?.mobile || ''}</div>
                </div>
              </div>

              <button id="theme-toggle-btn" className="theme-toggle" onClick={toggle} aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}>
                {theme === 'dark' ? <HiSun size={18} /> : <HiMoon size={18} />}
                {theme === 'dark' ? t('Light mode') : t('Dark mode')}
                <div className="toggle-pill"><div className="toggle-knob" /></div>
              </button>

              <button id="logout-btn" className="logout-btn" style={{ width: '100%', marginTop: 8, justifyContent: 'center', fontSize: '0.9rem' }} onClick={handleLogout}>
                <HiOutlineLogout size={18} />
                {t('Log out')}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <NavLink to="/login" className="relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border-0 bg-[var(--brand)] px-[18px] py-[11px] text-[.95rem] font-semibold text-white transition-all hover:shadow-[0_4px_16px_var(--brand-glow)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50" style={{ justifyContent: 'center' }}>
                {t('Sign in')}
              </NavLink>
              <button
                id="theme-toggle-btn"
                className="theme-toggle"
                onClick={toggle}
                aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
              >
                {theme === 'dark' ? t('Light') : t('Dark')}
                <div className="toggle-pill"><div className="toggle-knob" /></div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="app-main">
        {children || <Outlet />}
      </main>

      {!user && (
        <button
          type="button"
          className="mobile-theme-chip md:hidden"
          onClick={toggle}
          aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
        >
          {theme === 'dark' ? <HiSun size={18} /> : <HiMoon size={18} />}
        </button>
      )}

      {/* ── Bottom Nav (mobile) ────────────────────────────────────── */}
      <nav className="bottom-nav md:hidden" aria-label={t('Mobile navigation')}>
        <div className={`bottom-nav-inner ${user ? '' : 'guest'}`}>
          {user ? (
            <>
              <NavLink to="/" end id="bottom-nav-dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineHome size={22} /><span>{t('Home')}</span>
              </NavLink>
              <NavLink to="/rooms" id="bottom-nav-rooms" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <span className="bottom-nav-icon"><HiOutlineUserGroup size={22} />{pendingBadge}</span><span>{t('Groups')}</span>
              </NavLink>
              <NavLink to="/join" id="bottom-nav-join" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineExternalLink size={22} /><span>{t('Join')}</span>
              </NavLink>
              <NavLink to="/profile" id="bottom-nav-profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineUser size={22} /><span>{t('You')}</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/join" id="bottom-nav-join" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineExternalLink size={22} /><span>{t('Join')}</span>
              </NavLink>
              <NavLink to="/login" id="bottom-nav-login" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <HiOutlineUser size={22} /><span>{t('Sign in')}</span>
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/* ── PWA Install Banner ─────────────────────────────────────── */}

    </div>
  );
}
