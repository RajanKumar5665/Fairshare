import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnline } from '../hooks/useOnline';
import { flushOfflineQueue } from '../utils/offlineQueue';
import { api } from '../api/client';
import { useEffect } from 'react';
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

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  async function handleLogout() {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  // Phase 11: Auto-flush offline queue when back online
  useEffect(() => {
    if (online) {
      flushOfflineQueue(api).then(({ synced }) => {
        if (synced > 0) {
          toast.success(`Synced ${synced} offline transaction${synced > 1 ? 's' : ''}! `);
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
          You're offline — some features may be limited
        </div>
      )}

      {/* ── Sidebar (desktop) ──────────────────────────────────────── */}
      <aside
        className="sticky top-0 z-10 hidden h-dvh flex-col gap-5 overflow-y-auto px-4 py-6 md:flex"
        style={{
          background: 'var(--sidebar-bg)',
          color: 'var(--sidebar-ink)',
        }}
        aria-label="Main navigation"
      >
        <div className="brand">
          <img className="brand-mark" src="/screenshot-wide.png" alt="" />
          FairShare
        </div>

        <nav className="nav-links" aria-label="Site navigation">
          <NavLink to="/" end id="nav-dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineHome size={20} />
            {t('navDashboard')}
          </NavLink>
          <NavLink to="/rooms" id="nav-rooms" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineUserGroup size={20} />
            {t('navRooms')}
          </NavLink>
          <NavLink to="/join" id="nav-join" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineExternalLink size={20} />
            {t('navJoin')}
          </NavLink>
          <NavLink to="/profile" id="nav-profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineUser size={20} />
            {t('navProfile')}
          </NavLink>
        </nav>

        <div className="sidebar-user">
          {user ? (
            <>
              <div className="user-info">
                <div className="user-avatar">{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="user-name">{user?.name || 'User'}</div>
                  <div className="user-sub">{user?.email || user?.mobile || ''}</div>
                </div>
              </div>

              <button id="theme-toggle-btn" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                {theme === 'dark' ? <HiSun size={18} /> : <HiMoon size={18} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                <div className="toggle-pill"><div className="toggle-knob" /></div>
              </button>

              <button id="logout-btn" className="logout-btn" style={{ width: '100%', marginTop: 8, justifyContent: 'center', fontSize: '0.9rem' }} onClick={handleLogout}>
                <HiOutlineLogout size={18} />
                Log out
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <NavLink to="/login" className="relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border-0 bg-[var(--brand)] px-[18px] py-[11px] text-[.95rem] font-semibold text-white transition-all hover:shadow-[0_4px_16px_var(--brand-glow)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50" style={{ justifyContent: 'center' }}>
                Sign In
              </NavLink>
              <button
                id="theme-toggle-btn"
                className="theme-toggle"
                onClick={toggle}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
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

      {/* ── Bottom Nav (mobile) ────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--card)]/95 shadow-[0_-4px_20px_rgba(0,0,0,.08)] backdrop-blur-lg md:hidden" aria-label="Mobile navigation">
        <div className="bottom-nav-inner">
          <NavLink to="/" end id="bottom-nav-dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineHome size={22} /><span>Home</span>
          </NavLink>
          <NavLink to="/rooms" id="bottom-nav-rooms" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineUserGroup size={22} /><span>Rooms</span>
          </NavLink>
          <NavLink to="/join" id="bottom-nav-join" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineExternalLink size={22} /><span>Join</span>
          </NavLink>
          <NavLink to="/profile" id="bottom-nav-profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <HiOutlineUser size={22} /><span>Profile</span>
          </NavLink>
          <button id="bottom-theme-toggle" className="bottom-nav-item" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <HiSun size={22} /> : <HiMoon size={22} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </nav>

      {/* ── PWA Install Banner ─────────────────────────────────────── */}

    </div>
  );
}
