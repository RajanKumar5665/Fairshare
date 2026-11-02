const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://fairshare-6011.onrender.com'
    : 'http://localhost:4000')
).replace(/\/+$/, '');

function buildApiUrl(path) {
  return `${API_URL}/${String(path).replace(/^\/+/, '')}`;
}

let accessToken = localStorage.getItem('accessToken') || null;
let refreshToken = localStorage.getItem('refreshToken') || null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setRefreshToken(token) {
  refreshToken = token;
  if (token) {
    localStorage.setItem('refreshToken', token);
  } else {
    localStorage.removeItem('refreshToken');
  }
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearAuthSession() {
  setAccessToken(null);
  setRefreshToken(null);
  try {
    localStorage.removeItem('fairshare_user');
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (refreshToken) {
        headers['x-refresh-token'] = refreshToken;
      }

      const res = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        clearAuthSession();
        throw new Error(data.message || 'Session expired');
      }

      setAccessToken(data.accessToken);
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetch(buildApiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  const isAuthRequest =
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/otp') ||
    path.includes('/auth/google');

  if (res.status === 401 && !isAuthRequest) {
    try {
      const token = await refreshAccessToken();
      headers.Authorization = `Bearer ${token}`;

      res = await fetch(buildApiUrl(path), {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      clearAuthSession();
      throw new Error('Your session expired. Please log in again.');
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !isAuthRequest) {
      clearAuthSession();
    }
    throw new Error(data.message || 'Request failed');
  }

  return data;
}
