import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';
import { useLanguage } from '../context/LanguageContext';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let initializedClientId = null;

export default function GoogleLoginButton({ redirectUrl = '/' }) {
  const { loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const tRef = useRef(t);
  const loginWithGoogleRef = useRef(loginWithGoogle);
  const redirectUrlRef = useRef(redirectUrl);
  const [ready, setReady] = useState(Boolean(window.google?.accounts?.id));
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isConfigured = Boolean(clientId && clientId !== 'your_google_oauth_client_id');

  useEffect(() => {
    loginWithGoogleRef.current = loginWithGoogle;
    redirectUrlRef.current = redirectUrl;
    tRef.current = t;
  }, [loginWithGoogle, redirectUrl, t]);

  useEffect(() => {
    if (!isConfigured || ready) return undefined;
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onLoad = () => setReady(true);
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, [isConfigured, ready]);

  useEffect(() => {
    if (!ready || !isConfigured) return;
    if (initializedClientId === clientId) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            await loginWithGoogleRef.current(credential);
            window.location.assign(redirectUrlRef.current);
          } catch (error) {
            toast.error(error.message || tRef.current('Google login failed'));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      initializedClientId = clientId;
    } catch (err) {
      console.warn('Google accounts initialize error:', err);
    }
  }, [ready, isConfigured, clientId]);

  function startGoogleLogin() {
    if (!isConfigured) {
      toast.error(t('Google Sign-In is not configured yet. Please use Mobile OTP or Email.'));
      return;
    }
    if (!ready) {
      toast(t('Google sign-in is still loading. Try again in a moment.'));
      return;
    }
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          toast.error(t('Google sign-in popup was blocked or unavailable. Use Mobile OTP or Email.'));
        }
      });
    } catch (err) {
      toast.error(t('Could not start Google sign-in. Use Mobile OTP or Email.'));
    }
  }

  return (
    <button
      className="google-login-button"
      type="button"
      onClick={startGoogleLogin}
      aria-label={t('Continue with Google')}
    >
      <span className="google-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <FcGoogle size={20} />
      </span>
      <span>{t('Continue with Google')}</span>
    </button>
  );
}
