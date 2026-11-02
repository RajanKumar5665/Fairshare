const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://fairshare-6011.onrender.com'
    : 'http://localhost:4000')
).replace(/\/+$/, '');

let accessToken = sessionStorage.getItem('adminAccessToken') || '';

export function setAccessToken(token) {
  accessToken = token || '';
  if (accessToken) {
    sessionStorage.setItem('adminAccessToken', accessToken);
  } else {
    sessionStorage.removeItem('adminAccessToken');
  }
}

export function getAccessToken() {
  return accessToken;
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('admin:expired'));
  }

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}
