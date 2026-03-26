// api/auth/register.js — POST /api/auth/register

const bcrypt = require('bcryptjs');
const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, telegramUsername, citizenship, account } = req.body || {};

  if (!username?.trim())         return res.status(400).json({ error: 'Введите никнейм' });
  if (!telegramUsername?.trim()) return res.status(400).json({ error: 'Привяжите Telegram' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Пароль должен быть от 4 символов' });
  if (!citizenship?.trim())      return res.status(400).json({ error: 'Выберите гражданство' });
  if (!account?.trim())          return res.status(400).json({ error: 'Укажите счёт' });

  try {
    const sql = getDB();

    // Проверяем уникальность никнейма
    const existing = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1
    `;
    if (existing.length) {
      return res.status(409).json({ error: 'Пользователь с таким никнеймом уже существует' });
    }

    // Нормализуем telegram_id (без @, нижний регистр)
    const tgNorm = telegramUsername.replace(/^@/, '').toLowerCase();

    // Проверяем что TG не занят
    const tgExisting = await sql`
      SELECT id FROM users WHERE telegram_id = ${tgNorm} LIMIT 1
    `;
    if (tgExisting.length) {
      return res.status(409).json({ error: 'Этот Telegram уже привязан к другому аккаунту' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await sql`
      INSERT INTO users (username, password_hash, telegram_id, citizenship, account, is_admin)
      VALUES (
        ${username.trim()},
        ${passwordHash},
        ${tgNorm},
        ${citizenship.trim()},
        ${account.trim()},
        FALSE
      )
      RETURNING id, username, is_admin, telegram_id, citizenship, account, balance
    `;
    const user = newUser[0];

    // Создаём сессию
    const sessionRows = await sql`
      INSERT INTO sessions (user_id) VALUES (${user.id}::uuid) RETURNING token
    `;
    const token = sessionRows[0].token;

    res.setHeader('Set-Cookie',
      `kbpost_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`
    );

    return res.status(201).json({
      token,
      user: {
        id:          user.id,
        username:    user.username,
        isAdmin:     user.is_admin,
        telegramId:  user.telegram_id,
        citizenship: user.citizenship,
        account:     user.account,
        balance:     user.balance,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
