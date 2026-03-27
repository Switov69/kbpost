-- ============================================================
-- KBPOST — Neon Postgres Schema (v2 — с подпиской)
-- Выполни весь этот файл в консоли Neon (SQL Editor)
-- ============================================================

-- 1. Пользователи (добавлены поля подписки)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  balance           INTEGER NOT NULL DEFAULT 0,
  telegram_id       TEXT UNIQUE,
  citizenship       TEXT NOT NULL DEFAULT '',
  account           TEXT NOT NULL DEFAULT '',
  is_admin          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Подписка
  subscription_active   BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_expires  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем колонки подписки если таблица уже существует (безопасный ALTER)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_active  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_username    ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);

-- 2. Посылки
CREATE TABLE IF NOT EXISTS parcels (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ttn                        TEXT UNIQUE NOT NULL,
  sender_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username            TEXT NOT NULL,
  receiver_username          TEXT NOT NULL,
  status                     INTEGER NOT NULL DEFAULT 1,
  status_history             JSONB NOT NULL DEFAULT '[]',
  description                TEXT NOT NULL DEFAULT '',
  from_branch_id             TEXT NOT NULL DEFAULT '',
  to_branch_id               TEXT,
  to_coordinates             TEXT,
  cash_on_delivery           BOOLEAN NOT NULL DEFAULT FALSE,
  cash_on_delivery_amount    INTEGER NOT NULL DEFAULT 0,
  cash_on_delivery_paid      BOOLEAN NOT NULL DEFAULT FALSE,
  cash_on_delivery_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- 4. Временные токены
CREATE TABLE IF NOT EXISTS pending_actions (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_actions (expires_at);

-- 5. Сессии
CREATE TABLE IF NOT EXISTS sessions (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- 6. Сессии бота (chat_id + флаг отключения рекламы)
CREATE TABLE IF NOT EXISTS bot_sessions (
  tg_username TEXT PRIMARY KEY,
  chat_id     BIGINT NOT NULL,
  no_ads      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS no_ads BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. Запросы на оплату подписки
CREATE TABLE IF NOT EXISTS subscription_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  amount      INTEGER NOT NULL DEFAULT 5,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_requests_user   ON subscription_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON subscription_requests (status);

-- ============================================================
-- Дефолтные данные
-- ============================================================
INSERT INTO branches (id, number, region, prefecture, address)
VALUES
  ('br_stolica_1',   1, 'Столица',  'Holeland',   'аскб авеню, 6'),
  ('br_antegriya_1', 1, 'Антегрия', 'Данюшатаун', '')
ON CONFLICT (id) DO NOTHING;

-- Аккаунт администратора (admin / admin8961)
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
