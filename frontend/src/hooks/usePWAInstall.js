import { useEffect, useRef, useState } from 'react';

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const deferredPrompt = useRef(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa-install-dismissed') === '1');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt.current) return false;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    if (outcome === 'accepted') setCanInstall(false);
    return outcome === 'accepted';
  }

  function dismiss() {
    setCanInstall(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
  }

  return {
    canInstall: canInstall && !dismissed,
    showInstallHelp: isIOS && !isInstalled && !dismissed,
    isIOS,
    isInstalled,
    install,
    dismiss,
  };
}
