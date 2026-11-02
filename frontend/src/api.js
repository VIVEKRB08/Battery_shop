export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function apiRequest(path, options = {}, adminKey = '') {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const error = new Error(detail?.detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
