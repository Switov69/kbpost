import { neon } from '@neondatabase/serverless';
import type { UserProfile, Parcel, CreateParcelData, TelegramUser, Citizenship } from './types';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL as string;

function getDb() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(DATABASE_URL);
}

export async function initDb(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS tg_sessions (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      nickname TEXT UNIQUE NOT NULL,
      citizenship TEXT NOT NULL,
      bank_account TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      notifications_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS parcels (
      id SERIAL PRIMARY KEY,
      ttn TEXT UNIQUE NOT NULL,
      sender_id BIGINT NOT NULL,
      receiver_id BIGINT NOT NULL,
      sender_nickname TEXT NOT NULL,
      receiver_nickname TEXT NOT NULL,
      description TEXT NOT NULL,
      from_branch TEXT NOT NULL,
      to_branch TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function upsertSession(user: TelegramUser): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO tg_sessions (telegram_id, first_name, last_name, username)
    VALUES (${user.id}, ${user.first_name}, ${user.last_name ?? null}, ${user.username ?? null})
    ON CONFLICT (telegram_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      username = EXCLUDED.username
  `;
}

export async function getUserByTelegramId(telegramId: number): Promise<UserProfile | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, telegram_id, nickname, citizenship, bank_account, notifications_enabled, created_at::text
    FROM users WHERE telegram_id = ${telegramId}
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    telegram_id: r.telegram_id,
    nickname: r.nickname,
    citizenship: r.citizenship as Citizenship,
    bank_account: r.bank_account,
    notifications_enabled: r.notifications_enabled,
    created_at: r.created_at,
  };
}

export async function getUserByNickname(nickname: string): Promise<UserProfile | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, telegram_id, nickname, citizenship, bank_account, notifications_enabled, created_at::text
    FROM users WHERE LOWER(nickname) = LOWER(${nickname})
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    telegram_id: r.telegram_id,
    nickname: r.nickname,
    citizenship: r.citizenship as Citizenship,
    bank_account: r.bank_account,
    notifications_enabled: r.notifications_enabled,
    created_at: r.created_at,
  };
}

function simpleHash(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export async function registerUser(
  telegramId: number,
  nickname: string,
  citizenship: Citizenship,
  bankAccount: string,
  pin: string
): Promise<UserProfile> {
  const sql = getDb();
  const pinHash = simpleHash(pin);
  const rows = await sql`
    INSERT INTO users (telegram_id, nickname, citizenship, bank_account, pin_hash)
    VALUES (${telegramId}, ${nickname}, ${citizenship}, ${bankAccount}, ${pinHash})
    RETURNING id, telegram_id, nickname, citizenship, bank_account, notifications_enabled, created_at::text
  `;
  const r = rows[0];
  return {
    id: r.id,
    telegram_id: r.telegram_id,
    nickname: r.nickname,
    citizenship: r.citizenship as Citizenship,
    bank_account: r.bank_account,
    notifications_enabled: r.notifications_enabled,
    created_at: r.created_at,
  };
}

export async function verifyPin(telegramId: number, pin: string): Promise<boolean> {
  const sql = getDb();
  const pinHash = simpleHash(pin);
  const rows = await sql`
    SELECT id FROM users WHERE telegram_id = ${telegramId} AND pin_hash = ${pinHash}
  `;
  return rows.length > 0;
}

export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT id FROM users WHERE LOWER(nickname) = LOWER(${nickname})
  `;
  return rows.length === 0;
}

function generateTTN(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `#${num}`;
}

export async function createParcel(
  senderTelegramId: number,
  data: CreateParcelData
): Promise<Parcel> {
  const sql = getDb();
  const sender = await getUserByTelegramId(senderTelegramId);
  if (!sender) throw new Error('Отправитель не найден');
  const receiver = await getUserByNickname(data.receiver_nickname);
  if (!receiver) throw new Error('Получатель не найден');
  if (sender.id === receiver.id) throw new Error('Нельзя отправить посылку самому себе');

  let ttn = generateTTN();
  let attempts = 0;
  while (attempts < 20) {
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn}`;
    if (!existing.length) break;
    ttn = generateTTN();
    attempts++;
  }

  const rows = await sql`
    INSERT INTO parcels (ttn, sender_id, receiver_id, sender_nickname, receiver_nickname, description, from_branch, to_branch)
    VALUES (${ttn}, ${sender.telegram_id}, ${receiver.telegram_id}, ${sender.nickname}, ${receiver.nickname}, ${data.description}, ${data.from_branch}, ${data.to_branch})
    RETURNING id, ttn, sender_id, receiver_id, sender_nickname, receiver_nickname, description, from_branch, to_branch, status, created_at::text, updated_at::text
  `;
  return mapParcel(rows[0]);
}

function mapParcel(r: Record<string, unknown>): Parcel {
  return {
    id: r.id as number,
    ttn: r.ttn as string,
    sender_id: r.sender_id as number,
    receiver_id: r.receiver_id as number,
    sender_nickname: r.sender_nickname as string,
    receiver_nickname: r.receiver_nickname as string,
    description: r.description as string,
    from_branch: r.from_branch as string,
    to_branch: r.to_branch as string,
    status: r.status as Parcel['status'],
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function getParcelsForUser(telegramId: number): Promise<Parcel[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, ttn, sender_id, receiver_id, sender_nickname, receiver_nickname, description, from_branch, to_branch, status, created_at::text, updated_at::text
    FROM parcels
    WHERE sender_id = ${telegramId} OR receiver_id = ${telegramId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapParcel);
}

export async function updateUserSettings(
  telegramId: number,
  updates: { bank_account?: string; notifications_enabled?: boolean; pin?: string }
): Promise<void> {
  const sql = getDb();
  if (updates.bank_account !== undefined) {
    await sql`UPDATE users SET bank_account = ${updates.bank_account} WHERE telegram_id = ${telegramId}`;
  }
  if (updates.notifications_enabled !== undefined) {
    await sql`UPDATE users SET notifications_enabled = ${updates.notifications_enabled} WHERE telegram_id = ${telegramId}`;
  }
  if (updates.pin !== undefined) {
    const pinHash = simpleHash(updates.pin);
    await sql`UPDATE users SET pin_hash = ${pinHash} WHERE telegram_id = ${telegramId}`;
  }
}
