import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearAuthSession,
} from '../api/client';

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  return { ...user, id: user.id || user._id };
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('fairshare_user');
    return raw ? normalizeUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem('fairshare_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fairshare_user');
    }
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const initialUser = getStoredUser();
  const [user, setUserState] = useState(initialUser);
  // If user has no credentials at all, loading is instantly false!
  const hasCredentials = Boolean(getAccessToken() || getRefreshToken());
  const [loading, setLoading] = useState(hasCredentials && !initialUser);

  function setUser(newUser) {
    const normalized = normalizeUser(newUser);
    setUserState(normalized);
    setStoredUser(normalized);
  }

  // Listen for global auth expiration (automatic logout)
  useEffect(() => {
    function onAuthExpired() {
      setUser(null);
    }
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      const currentAccess = getAccessToken();
      const currentRefresh = getRefreshToken();

      // If no credentials exist in storage, complete immediately without cold-start network hit!
      if (!currentAccess && !currentRefresh) {
        if (isMounted) setLoading(false);
        return;
      }

      // Try quick session restore
      try {
        if (!currentAccess && currentRefresh) {
          const refreshData = await api('/api/auth/refresh', { method: 'POST' });
          if (refreshData.accessToken) {
            setAccessToken(refreshData.accessToken);
          }
          if (refreshData.refreshToken) {
            setRefreshToken(refreshData.refreshToken);
          }
          if (refreshData.user && isMounted) {
            setUser(refreshData.user);
            setLoading(false);
            return;
          }
        }

        const data = await api('/api/auth/me');
        if (isMounted) {
          setUser(data.user);
        }
      } catch {
        if (isMounted) {
          clearAuthSession();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,

      async register(payload) {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAccessToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        setUser(data.user);
      },

      async login(payload) {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAccessToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        setUser(data.user);
      },

      async loginWithGoogle(idToken) {
        const data = await api('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ idToken }),
        });
        setAccessToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        setUser(data.user);
      },

      async sendOtp(mobile) {
        return api('/api/auth/otp/send', {
          method: 'POST',
          body: JSON.stringify({ mobile }),
        });
      },

      async verifyOtp(mobile, code, name) {
        const data = await api('/api/auth/otp/verify', {
          method: 'POST',
          body: JSON.stringify({ mobile, code, name }),
        });
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          if (data.refreshToken) setRefreshToken(data.refreshToken);
          setUser(data.user);
        }
        return data;
      },

      async logout() {
        try {
          await api('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: getRefreshToken() }),
          });
        } finally {
          clearAuthSession();
          setUser(null);
        }
      },

      updateUser(updates) {
        setUser((u) => (u ? { ...u, ...updates } : u));
      },

      async refreshUser() {
        try {
          const data = await api('/api/auth/me');
          const normalized = normalizeUser(data.user);
          setUser(normalized);
          return normalized;
        } catch {
          return null;
        }
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
