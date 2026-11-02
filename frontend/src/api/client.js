
const API_URL = (
  import.meta.env.PROD
    ? 'https://backend-alpha-gules-21.vercel.app'
    : (import.meta.env.VITE_API_URL || 'http://localhost:4000')
).replace(/\/+$/, '');

function buildApiUrl(path) {
  return `${API_URL}/${String(path).replace(/^\/+/, '')}`;
}

let accessToken = localStorage.getItem('accessToken') || null;

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

async function refreshAccessToken() {
  const res = await fetch(buildApiUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setAccessToken(null);
    throw new Error(data.message || 'Session expired');
  }

  setAccessToken(data.accessToken);
  return data.accessToken;
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

  const isAuthRequest = path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/refresh');

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
      setAccessToken(null);
      throw new Error('Your session expired. Please log in again.');
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}
