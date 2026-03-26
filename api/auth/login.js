// api/auth/login.js — POST /api/auth/login
// Принимает { username, password }, возвращает сессионный токен

const bcrypt = require('bcryptjs');
const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    const sql = getDB();

    // Ищем пользователя
    const rows = await sql`
      SELECT id, username, password_hash, is_admin, telegram_id, citizenship, account, balance
      FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(401).json({ error: 'Неверный никнейм или пароль' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный никнейм или пароль' });
    }

    // Создаём сессию (30 дней)
    const sessionRows = await sql`
      INSERT INTO sessions (user_id)
      VALUES (${user.id}::uuid)
      RETURNING token
    `;
    const token = sessionRows[0].token;

    // Устанавливаем httpOnly cookie
    res.setHeader('Set-Cookie',
      `kbpost_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`
    );

    return res.status(200).json({
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
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
