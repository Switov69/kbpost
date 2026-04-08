const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${path} failed`);
  return res.json();
}

export const kbApi = {
  // Users
  getUserByTg: (tgId: string) => api(`/users/by-tg/${tgId}`),
  getUserByNick: (nick: string) => api(`/users/by-nick/${encodeURIComponent(nick)}`),
  getUser: (id: string) => api(`/users/${id}`),
  createUser: (user: any) => api('/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: string, patch: any) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  listUsers: () => api('/users'),
  
  // TG tracking
  trackTg: (tgId: string, username?: string) => api('/tg/track', { method: 'POST', body: JSON.stringify({ tgId, username }) }),
  
  // Link tokens
  createLinkToken: (userId: string, nickname: string) => api('/link-token', { method: 'POST', body: JSON.stringify({ userId, nickname }) }),
  getLinkToken: (token: string) => api(`/link-token/${token}`),
  consumeLinkToken: (token: string, tgId: string, tgUsername?: string) => 
    api('/link-token/consume', { method: 'POST', body: JSON.stringify({ token, tgId, tgUsername }) }),
  
  // Branches
  listBranches: () => api('/branches'),
  createBranch: (name: string, city: string) => api('/branches', { method: 'POST', body: JSON.stringify({ name, city }) }),
  updateBranch: (id: string, patch: any) => api(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteBranch: (id: string) => api(`/branches/${id}`, { method: 'DELETE' }),
  
  // Parcels
  listParcels: (userId: string) => api(`/parcels?userId=${userId}`),
  createParcel: (parcel: any) => api('/parcels', { method: 'POST', body: JSON.stringify(parcel) }),
  updateParcel: (id: string, patch: any) => api(`/parcels/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  payParcel: (id: string) => api(`/parcels/${id}/pay`, { method: 'POST' }),
  
  // PIN reset
  requestPinReset: (userId: string) => api('/pin-reset/request', { method: 'POST', body: JSON.stringify({ userId }) }),
  completePinReset: (userId: string, pin: string) => api('/pin-reset/complete', { method: 'POST', body: JSON.stringify({ userId, pin }) }),
  getPinResetPending: (userId: string) => api(`/pin-reset/pending/${userId}`),
};