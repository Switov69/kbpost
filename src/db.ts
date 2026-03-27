/**
 * db.ts — API-обёртки, совместимые с существующим кодом AdminPage, CreatePage и т.д.
 * Все функции теперь работают через Vercel API, не через localStorage.
 *
 * Синхронные функции заменены на async там, где это нужно.
 * Для обратной совместимости некоторые функции возвращают данные из локального кеша.
 */

import {
  apiGetParcels, apiGetAllUsers, apiCreateParcel,
  apiUpdateParcel, apiDeleteParcel,
  apiGetBranches, apiManageBranch,
  apiManageUser,
  type ParcelDTO, type UserDTO, type BranchDTO,
} from './api';
import { User, Parcel, Branch, STATUS_LABELS } from './types';

// ===== УТИЛИТЫ =====

function userDtoToModel(dto: UserDTO): User {
  return {
    id:               dto.id,
    username:         dto.username,
    telegramUsername: dto.telegramId ? `@${dto.telegramId}` : '',
    password:         '',
    citizenship:      dto.citizenship,
    account:          dto.account,
    isAdmin:          dto.isAdmin,
    createdAt:        dto.createdAt || new Date().toISOString(),
  };
}

function parcelDtoToModel(dto: ParcelDTO): Parcel {
  return {
    id:                       dto.id,
    ttn:                      dto.ttn,
    description:              dto.description,
    senderId:                 dto.senderId,
    receiverId:               dto.receiverId,
    senderUsername:           dto.senderUsername,
    receiverUsername:         dto.receiverUsername,
    status:                   dto.status,
    statusHistory:            dto.statusHistory,
    fromBranchId:             dto.fromBranchId,
    toBranchId:               dto.toBranchId,
    toCoordinates:            dto.toCoordinates,
    cashOnDelivery:           dto.cashOnDelivery,
    cashOnDeliveryAmount:     dto.cashOnDeliveryAmount,
    cashOnDeliveryPaid:       dto.cashOnDeliveryPaid,
    cashOnDeliveryConfirmed:  dto.cashOnDeliveryConfirmed,
    createdAt:                dto.createdAt,
    updatedAt:                dto.updatedAt,
  };
}

// ===== NO-OP initDB (больше не нужен, совместимость) =====
export function initDB(): void {}

// ===== BRANCHES =====

export async function getBranches(): Promise<Branch[]> {
  const dtos = await apiGetBranches();
  return dtos.map(b => ({ id: b.id, number: b.number, region: b.region, prefecture: b.prefecture, address: b.address }));
}

export async function getBranchById(id: string): Promise<Branch | undefined> {
  const branches = await getBranches();
  return branches.find(b => b.id === id);
}

export async function createBranch(data: Omit<Branch, 'id'>): Promise<Branch> {
  const result = await apiManageBranch('create', data) as BranchDTO;
  return { id: result.id, number: result.number, region: result.region, prefecture: result.prefecture, address: result.address };
}

export async function updateBranch(id: string, data: Partial<Branch>): Promise<Branch> {
  const result = await apiManageBranch('update', { id, ...data }) as BranchDTO;
  return { id: result.id, number: result.number, region: result.region, prefecture: result.prefecture, address: result.address };
}

export async function deleteBranch(id: string): Promise<boolean> {
  await apiManageBranch('delete', { id });
  return true;
}

// ===== USERS =====

export async function getUsers(): Promise<User[]> {
  const dtos = await apiGetAllUsers();
  return dtos.map(userDtoToModel);
}

export async function getUserById(id: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find(u => u.id === id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export async function getUserByTelegram(tg: string): Promise<User | undefined> {
  const users = await getUsers();
  const norm = tg.replace(/^@/, '').toLowerCase();
  return users.find(u => u.telegramUsername.replace(/^@/, '').toLowerCase() === norm);
}

export async function makeAdmin(userId: string): Promise<void> {
  await apiManageUser('makeAdmin', userId);
}

export async function removeAdmin(userId: string): Promise<void> {
  await apiManageUser('removeAdmin', userId);
}

export async function deleteUser(userId: string): Promise<boolean> {
  await apiManageUser('delete', userId);
  return true;
}

export async function updateUserBalance(userId: string, balance: number): Promise<void> {
  await apiManageUser('updateBalance', userId, { balance });
}

// ===== PARCELS =====

export async function getParcels(): Promise<Parcel[]> {
  const dtos = await apiGetParcels();
  return dtos.map(parcelDtoToModel);
}

export async function getParcelById(id: string): Promise<Parcel | undefined> {
  const parcels = await getParcels();
  return parcels.find(p => p.id === id);
}

export async function getParcelByTTN(ttn: string): Promise<Parcel | undefined> {
  const parcels = await getParcels();
  return parcels.find(p => p.ttn.toLowerCase() === ttn.toLowerCase());
}

export async function getUserParcels(userId: string): Promise<Parcel[]> {
  const all = await getParcels();
  return all.filter(p => p.senderId === userId || p.receiverId === userId);
}

export async function createParcel(data: {
  description: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  fromBranchId: string;
  toBranchId: string | null;
  toCoordinates: string | null;
  cashOnDelivery: boolean;
  cashOnDeliveryAmount: number;
}): Promise<Parcel> {
  const dto = await apiCreateParcel({
    description:          data.description,
    receiverUsername:     data.receiverUsername,
    fromBranchId:         data.fromBranchId,
    toBranchId:           data.toBranchId,
    toCoordinates:        data.toCoordinates,
    cashOnDelivery:       data.cashOnDelivery,
    cashOnDeliveryAmount: data.cashOnDeliveryAmount,
  });
  return parcelDtoToModel(dto);
}

export async function updateParcelStatus(id: string, newStatus: number): Promise<Parcel | undefined> {
  const dto = await apiUpdateParcel(id, 'updateStatus', { newStatus });
  return parcelDtoToModel(dto);
}

export async function markParcelPaid(id: string): Promise<Parcel | undefined> {
  const dto = await apiUpdateParcel(id, 'markPaid');
  return parcelDtoToModel(dto);
}

export async function confirmParcelPayment(id: string): Promise<Parcel | undefined> {
  const dto = await apiUpdateParcel(id, 'confirmPayment');
  return parcelDtoToModel(dto);
}

export async function updateParcel(id: string, data: {
  description?: string;
  fromBranchId?: string;
  toBranchId?: string | null;
  toCoordinates?: string | null;
}): Promise<Parcel | undefined> {
  const dto = await apiUpdateParcel(id, 'adminUpdate', data);
  return parcelDtoToModel(dto);
}

export async function deleteParcel(id: string): Promise<boolean> {
  await apiDeleteParcel(id);
  return true;
}

// ===== STATS =====

export async function getUserStats(userId: string): Promise<{ sent: number; received: number; active: number }> {
  const parcels = await getUserParcels(userId);
  return {
    sent:     parcels.filter(p => p.senderId === userId).length,
    received: parcels.filter(p => p.receiverId === userId).length,
    active:   parcels.filter(p => p.status < 7).length,
  };
}

// ===== TTN генерация — теперь на сервере, здесь заглушка =====
export function generateTTN(): string {
  return '#????'; // генерируется сервером при создании посылки
}
