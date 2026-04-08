import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS tg_users (
      tg_id TEXT PRIMARY KEY,
      username TEXT,
      first_seen BIGINT NOT NULL,
      last_seen BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT UNIQUE NOT NULL,
      tg_id TEXT REFERENCES tg_users(tg_id),
      tg_username TEXT,
      avatar_url TEXT,
      citizenship TEXT,
      bank_account TEXT,
      pin TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS parcels (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      sender_id TEXT REFERENCES users(id) NOT NULL,
      recipient_id TEXT REFERENCES users(id) NOT NULL,
      from_branch_id TEXT REFERENCES branches(id) NOT NULL,
      to_branch_id TEXT REFERENCES branches(id) NOT NULL,
      cod_enabled BOOLEAN DEFAULT FALSE,
      cod_amount INTEGER,
      cod_paid BOOLEAN DEFAULT FALSE,
      status TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS link_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pin_reset_requests (
      user_id TEXT PRIMARY KEY,
      requested_at BIGINT NOT NULL
    )
  `;

  // Seed branches
  const existing = await sql`SELECT COUNT(*) as count FROM branches`;
  if (Number(existing[0].count) === 0) {
    await sql`
      INSERT INTO branches (id, name, city) VALUES
      ('st-1', 'Отделение №1 (Центр)', 'Столица'),
      ('st-2', 'Отделение №2 (Север)', 'Столица'),
      ('st-3', 'Отделение №3 (Юг)', 'Столица'),
      ('an-1', 'Отделение №1 (Порт)', 'Антегрия'),
      ('an-2', 'Отделение №2 (Рынок)', 'Антегрия')
    `;
  }
}

export { sql };