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

// Было: POST /api/auth/login
// Стало: POST /api/auth  { action: 'login', username, password }
export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: UserDTO }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username, password }),
  });
}

// Было: POST /api/auth/logout
// Стало: POST /api/auth  { action: 'logout' }
export async function apiLogout(): Promise<void> {
  try {
    await apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch {}
  setToken(null);
}

// Было: POST /api/auth/register
// Стало: POST /api/auth  { action: 'register', ...data }
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

// Было: POST /api/auth/check-token  { token }
// Стало: POST /api/auth  { action: 'checkToken', token }
export async function apiCheckToken(
  token: string
): Promise<{ actionType: string; data: Record<string, string> }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'checkToken', token }),
  });
}

// Было: POST /api/auth/confirm  { token, password? }
// Стало: POST /api/auth  { action: 'confirm', token, password? }
export async function apiConfirmToken(
  token: string,
  password?: string
): Promise<{ ok: boolean; action: string; tgUsername?: string }> {
  return apiFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'confirm', token, password }),
  });
}

// ===== USER =====

// Было: GET /api/user/profile
// Стало: GET /api/user
export async function apiGetProfile(): Promise<UserDTO> {
  return apiFetch('/user');
}

// Было: GET /api/user/all
// Стало: GET /api/user?type=all
export async function apiGetAllUsers(): Promise<UserDTO[]> {
  return apiFetch('/user?type=all');
}

// Было: POST /api/user/manage  { action, userId, ...extra }
// Стало: POST /api/user  { action, userId, ...extra }
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

// Было: POST /api/user/change-password  { oldPassword, newPassword }
// Стало: POST /api/user  { action: 'changePassword', oldPassword, newPassword }
export async function apiChangePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'changePassword', oldPassword, newPassword }),
  });
}

// Было: POST /api/user/update-account  { account }
// Стало: POST /api/user  { action: 'updateAccount', account }
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

// Было: GET /api/parcels
// Стало: GET /api/parcels  (без изменений)
export async function apiGetParcels(): Promise<ParcelDTO[]> {
  return apiFetch('/parcels');
}

// Было: POST /api/parcels/create  { ...data }
// Стало: POST /api/parcels  { action: 'create', ...data }
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

// Было: POST /api/parcels/update  { parcelId, action, ...extra }
// Стало: POST /api/parcels  { action: 'update', parcelId, ...extra }
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

// Было: POST /api/parcels/delete  { parcelId }
// Стало: DELETE /api/parcels  { parcelId }
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

// Без изменений — /api/branches не трогался
export async function apiGetBranches(): Promise<BranchDTO[]> {
  return apiFetch('/branches');
}

// Без изменений — /api/branches/manage не трогался
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

// Пользователь отправляет запрос на подтверждение оплаты подписки
export async function apiRequestSubscription(): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'requestSubscription' }),
  });
}

// Получить список pending-запросов на подписку (admin)
export async function apiGetSubscriptionRequests(): Promise<SubscriptionRequestDTO[]> {
  return apiFetch('/user?type=subscriptionRequests');
}

// Подтвердить подписку (admin)
export async function apiConfirmSubscription(requestId: string): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'confirmSubscription', requestId }),
  });
}

// Отклонить подписку (admin)
export async function apiRejectSubscription(requestId: string): Promise<void> {
  await apiFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ action: 'rejectSubscription', requestId }),
  });
}
