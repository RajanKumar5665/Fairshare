import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAccessToken, setAccessToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api('/api/auth/me');
        if (data.user?.role !== 'admin') throw new Error('Admin access required');
        setUser(data.user);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(mobile, password) {
      const data = await api('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ mobile, password }),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    async register(payload) {
      const data = await api('/api/auth/admin/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    logout() {
      setAccessToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
