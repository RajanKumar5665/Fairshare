const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `http://${window.location.hostname}:4000`
    : 'http://localhost:4000');

let accessToken = localStorage.getItem('accessToken') || null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
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

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
    try {
      const token = await refreshAccessToken();
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      setAccessToken(null);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}
