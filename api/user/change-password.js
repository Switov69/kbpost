// api/user/change-password.js — POST /api/user/change-password

const bcrypt = require('bcryptjs');
const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const { oldPassword, newPassword } = req.body || {};

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Новый пароль должен быть от 4 символов' });
  }

  try {
    const sql = getDB();

    // Получаем текущий хеш
    const rows = await sql`
      SELECT password_hash FROM users WHERE id = ${session.userId}::uuid LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });

    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await sql`
      UPDATE users SET password_hash = ${newHash} WHERE id = ${session.userId}::uuid
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
