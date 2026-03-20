import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    headers['Authorization'] = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  hvacNonmag: (params: Record<string, number>) =>
    request('/api/hvac-nonmag/calculate', { method: 'POST', body: JSON.stringify(params) }),

  hvacMag: (params: Record<string, number>) =>
    request('/api/hvac-mag/calculate', { method: 'POST', body: JSON.stringify(params) }),

  dcBipole: (params: Record<string, number>) =>
    request('/api/dc-bipole/calculate', { method: 'POST', body: JSON.stringify(params) }),

  dcBipoleWmm: (lat: number, lon: number, date?: string) =>
    request('/api/dc-bipole/wmm-lookup', {
      method: 'POST',
      body: JSON.stringify({ lat, lon, date: date ?? '' }),
    }),

  wmmGrid: (params: Record<string, unknown>) =>
    request('/api/wmm/grid', { method: 'POST', body: JSON.stringify(params) }),

  wmmLine: (params: Record<string, unknown>) =>
    request('/api/wmm/line', { method: 'POST', body: JSON.stringify(params) }),

  cable3d: (params: Record<string, unknown>) =>
    request('/api/cable-3d/calculate', { method: 'POST', body: JSON.stringify(params) }),
};
