import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';

function IconDownload({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconX({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function InstallPrompt() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const { canInstall, showInstallHelp, isIOS, install, dismiss } = usePWAInstall();
  const hasBottomNav = !['/login', '/register', '/privacy', '/terms'].includes(pathname)
    && !pathname.startsWith('/admin');

  if ((!canInstall && !showInstallHelp) || pathname.startsWith('/admin')) return null;

  async function handleInstall() {
    if (isIOS) {
      toast(t('Tap Share ↑, then choose "Add to Home Screen".'), { duration: 6500 });
      return;
    }
    const installed = await install();
    if (installed) toast.success(t('FairShare installed! 🎉'));
  }

  return (
    <aside className={`install-banner${hasBottomNav ? ' with-bottom-nav' : ''}`} aria-label={t('Install FairShare')}>
      <div className="install-banner-icon">
        <img src="/screenshot-wide.png" alt="FairShare" />
      </div>
      <div className="install-banner-text">
        <strong>{isIOS ? t('Add to Home Screen') : t('Install FairShare App')}</strong>
        <span>{isIOS ? t('Tap Share → Add to Home Screen') : t('Fast access, works offline!')}</span>
      </div>
      <button
        id="install-app-btn"
        className="install-action"
        type="button"
        onClick={handleInstall}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <IconDownload size={15} />
        {isIOS ? t('How') : t('Install')}
      </button>
      <button
        className="install-close"
        type="button"
        onClick={dismiss}
        aria-label={t('Dismiss install prompt')}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
      >
        <IconX size={13} />
        <span>{t('Later')}</span>
      </button>
    </aside>
  );
}
