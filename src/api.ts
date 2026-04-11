/**
 * KBPOST — API Client
 * Токен сессии хранится в памяти и в sessionStorage как резерв при перезагрузке.
 *
 * Новая структура бэкенда (три контроллера):
 *   POST /api/auth   — { action: 'login' | 'register' | 'logout' | 'checkToken' | 'confirm' | 'createToken' }
 *   GET  /api/user   — профиль текущего пользователя
 *   GET  /api/user?type=all — список всех пользователей (admin)
 *   POST /api/user   — { action: 'changePassword' | 'updateAccount' | 'makeAdmin' | 'removeAdmin' | 'delete' | 'updateBalance' }
 *   GET  /api/parcels          — список посылок
 *   POST /api/parcels          — { action: 'create' | 'update' | 'markPaid' | 'confirmPayment' | 'adminUpdate' }
 *   DELETE /api/parcels        — { parcelId } (admin)
 *   GET  /api/branches         — список отделений
 *   POST /api/branches/manage  — { action: 'create' | 'update' | 'delete' }
 */

const BASE = '/api';

let _token: string | null = null;

export function setToken(t: string | null) {
  _token = t;
  if (t) sessionStorage.setItem('kbpost_token', t);
  else sessionStorage.removeItem('kbpost_token');
}

export function getToken(): string | null {
  if (!_token) _token = sessionStorage.getItem('kbpost_token');
  return _token;
}

/**
 * Центральная функция для всех API-запросов.
 *
 * При получении 401 или 403 диспатчит кастомное событие 'auth:unauthorized',
 * которое перехватывает AppProvider и разлогинивает пользователя без
 * циклических повторных запросов.
 *
 * Исключение: запросы к /auth (login, register, confirm) — там 401/403
 * являются ожидаемыми ответами (неверный пароль и т.п.) и не должны
 * триггерить глобальный logout.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    // 401 / 403 на защищённых роутах (не /auth) → глобальный выход
    const isAuthEndpoint = path.startsWith('/auth');
    if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { status: res.status } }));
    }

    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

// ===== AUTH =====

export interface UserDTO {
  id: string;
  username: string;
  isAdmin: boolean;
  telegramId: string | null;
  telegramUsername: string;
  citizenship: string;
  account: string;
  balance: number;
  createdAt?: string;
  subscriptionActive: boolean;
  subscriptionExpires: string | null;
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: UserDTO }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username, password }),
  });
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch {}
  setToken(null);
}

export async function apiRegister(data: {
  username: string;
  password: string;
  telegramUsername: string;
  citizenship: string;
  account: string;
}): Promise<{ token: string; user: UserDTO }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'register', ...data }),
  });
}

// ===== TOKENS (pending_actions) =====

export async function apiCheckToken(
  token: string
): Promise<{ actionType: string; data: Record<string, string> }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'checkToken', token }),
  });
}

export async function apiConfirmToken(
  token: string,
  password?: string
): Promise<{ ok: boolean; action: string; token?: string; user?: UserDTO }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'confirm', token, password }),
  });
}

// ===== USER =====

export async function apiGetProfile(): Promise<UserDTO> {
  return apiFetch('/user');
}

export async function apiGetAllUsers(): Promise<UserDTO[]> {
  return apiFetch('/user?type=all');
}

export async function apiManageUser(
  action: string,
  userId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action, userId, ...extra }),
  });
}

export async function apiChangePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'changePassword', oldPassword, newPassword }),
  });
}

export async function apiUpdateAccount(account: string): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'updateAccount', account }),
  });
}

// ===== PARCELS =====

export interface ParcelDTO {
  id: string;
  ttn: string;
  description: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  status: number;
  statusHistory: { status: number; label: string; timestamp: string }[];
  fromBranchId: string;
  toBranchId: string | null;
  toCoordinates: string | null;
  cashOnDelivery: boolean;
  cashOnDeliveryAmount: number;
  cashOnDeliveryPaid: boolean;
  cashOnDeliveryConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiGetParcels(): Promise<ParcelDTO[]> {
  return apiFetch('/parcels');
}

export async function apiCreateParcel(data: {
  description: string;
  receiverUsername: string;
  fromBranchId: string;
  toBranchId?: string | null;
  toCoordinates?: string | null;
  cashOnDelivery: boolean;
  cashOnDeliveryAmount: number;
}): Promise<ParcelDTO> {
  return apiFetch('/parcels', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...data }),
  });
}

export async function apiUpdateParcel(
  parcelId: string,
  action: string,
  extra?: Record<string, unknown>
): Promise<ParcelDTO> {
  return apiFetch('/parcels', {
    method: 'POST',
    body: JSON.stringify({ action, parcelId, ...extra }),
  });
}

export async function apiDeleteParcel(parcelId: string): Promise<void> {
  await apiFetch('/parcels', {
    method: 'DELETE',
    body: JSON.stringify({ parcelId }),
  });
}

// ===== BRANCHES =====

export interface BranchDTO {
  id: string;
  number: number;
  region: string;
  prefecture: string;
  address: string;
}

export async function apiGetBranches(): Promise<BranchDTO[]> {
  return apiFetch('/branches');
}

export async function apiManageBranch(
  action: 'create' | 'update' | 'delete',
  data: Partial<BranchDTO>
): Promise<BranchDTO | { ok: boolean }> {
  return apiFetch('/branches/manage', {
    method: 'POST',
    body: JSON.stringify({ action, ...data }),
  });
}

// ===== SUBSCRIPTION =====

export interface SubscriptionRequestDTO {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: string;
  createdAt: string;
}

export async function apiRequestSubscription(): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'requestSubscription' }),
  });
}

export async function apiGetSubscriptionRequests(): Promise<SubscriptionRequestDTO[]> {
  return apiFetch('/user?type=subscriptionRequests');
}

export async function apiConfirmSubscription(requestId: string): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'confirmSubscription', requestId }),
  });
}

export async function apiRejectSubscription(requestId: string): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'rejectSubscription', requestId }),
  });
}
