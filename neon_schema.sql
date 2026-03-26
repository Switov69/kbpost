-- ============================================================
-- KBPOST — Neon Postgres Schema
-- Вставь этот код в консоль Neon (SQL Editor)
-- ============================================================

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- bcrypt hash
  balance       INTEGER NOT NULL DEFAULT 0,
  telegram_id   TEXT UNIQUE,            -- @username без @
  citizenship   TEXT NOT NULL DEFAULT '',
  account       TEXT NOT NULL DEFAULT '',
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_username    ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);

-- 2. Посылки
CREATE TABLE IF NOT EXISTS parcels (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ttn                       TEXT UNIQUE NOT NULL,
  sender_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username           TEXT NOT NULL,
  receiver_username         TEXT NOT NULL,
  status                    INTEGER NOT NULL DEFAULT 1,
  status_history            JSONB NOT NULL DEFAULT '[]',
  description               TEXT NOT NULL DEFAULT '',
  from_branch_id            TEXT NOT NULL DEFAULT '',
  to_branch_id              TEXT,
  to_coordinates            TEXT,
  cash_on_delivery          BOOLEAN NOT NULL DEFAULT FALSE,
  cash_on_delivery_amount   INTEGER NOT NULL DEFAULT 0,
  cash_on_delivery_paid     BOOLEAN NOT NULL DEFAULT FALSE,
  cash_on_delivery_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_sender   ON parcels (sender_id);
CREATE INDEX IF NOT EXISTS idx_parcels_receiver ON parcels (receiver_id);
CREATE INDEX IF NOT EXISTS idx_parcels_ttn      ON parcels (LOWER(ttn));

-- 3. Отделения
CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY,
  number      INTEGER NOT NULL,
  region      TEXT NOT NULL,
  prefecture  TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT ''
);

-- 4. Временные токены (регистрация, привязка TG, сброс пароля)
CREATE TABLE IF NOT EXISTS pending_actions (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('link_tg', 'reset_password', 'register')),
  data        JSONB NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Индекс для чистки истёкших токенов
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_actions (expires_at);

-- 5. Сессии (JWT не нужны — используем httpOnly cookie, но для совместимости хранятся в sessions)
CREATE TABLE IF NOT EXISTS sessions (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions (expires_at);

-- ============================================================
-- Дефолтные данные
-- ============================================================

-- Отделения по умолчанию
INSERT INTO branches (id, number, region, prefecture, address)
VALUES
  ('br_stolica_1',   1, 'Столица',  'Holeland',     'аскб авеню, 6'),
  ('br_antegriya_1', 1, 'Антегрия', 'Данюшатаун',   '')
ON CONFLICT (id) DO NOTHING;

-- Аккаунт администратора
-- Пароль: admin8961 (bcrypt hash, сгенерирован с cost=10)
INSERT INTO users (id, username, password_hash, telegram_id, citizenship, account, is_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2b$10$YQfR.A/Bc0P1VeXvJ5k6oOb0YjnwJyGl.0EGQ8.bXWR1Mm/0j2Jny',
  'admin',
  'Столица',
  'Свит',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  username      = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  telegram_id   = EXCLUDED.telegram_id,
  is_admin      = TRUE;
