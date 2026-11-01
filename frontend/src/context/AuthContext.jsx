import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAccessToken, setAccessToken } from '../api/client';

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  return { ...user, id: user.id || user._id };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        try {
          const data = await api('/api/auth/refresh', { method: 'POST' });
          setAccessToken(data.accessToken);
        } catch {
          setLoading(false);
          return;
        }
      }
      try {
        const data = await api('/api/auth/me');
        setUser(normalizeUser(data.user));
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    boot();
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
        setUser(normalizeUser(data.user));
      },

      async login(payload) {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAccessToken(data.accessToken);
        setUser(normalizeUser(data.user));
      },

      async loginWithGoogle(idToken) {
        const data = await api('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ idToken }),
        });
        setAccessToken(data.accessToken);
        setUser(normalizeUser(data.user));
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
          setUser(normalizeUser(data.user));
        }
        return data;
      },

      async logout() {
        try {
          await api('/api/auth/logout', { method: 'POST' });
        } finally {
          setAccessToken(null);
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
