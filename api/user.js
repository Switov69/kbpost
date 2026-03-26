const bcrypt = require('bcryptjs');
const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const sql = getDB();

  try {
    // 1. GET — Профиль или список всех пользователей
    if (req.method === 'GET') {
      const { type } = req.query;

      // Если запрос на всех пользователей (из all.js)
      if (type === 'all') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const users = await sql`
          SELECT id, username, is_admin, telegram_id, citizenship, account, balance, created_at
          FROM users ORDER BY created_at ASC
        `;
        return res.status(200).json(users);
      }

      // Обычный запрос своего профиля (из profile.js)
      const rows = await sql`
        SELECT id, username, is_admin, telegram_id, citizenship, account, balance, created_at
        FROM users WHERE id = ${session.userId}::uuid LIMIT 1
      `;
      if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
      return res.status(200).json(rows[0]);
    }

    // 2. POST — Смена пароля, управление или обновление счета
    if (req.method === 'POST') {
      const { action } = req.body;

      // Смена пароля (из change-password.js)
      if (action === 'changePassword') {
        const { oldPassword, newPassword } = req.body;
        const rows = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}::uuid`;
        const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });
        
        const newHash = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${session.userId}::uuid`;
        return res.status(200).json({ ok: true });
      }

      // Обновление названия счета (из update-account.js)
      if (action === 'updateAccount') {
        const { account } = req.body;
        await sql`UPDATE users SET account = ${account.trim()} WHERE id = ${session.userId}::uuid`;
        return res.status(200).json({ ok: true });
      }

      // Управление пользователями (из manage.js) - ТОЛЬКО АДМИН
      if (['makeAdmin', 'removeAdmin', 'delete', 'updateBalance'].includes(action)) {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const { userId, balance } = req.body;

        if (action === 'makeAdmin') await sql`UPDATE users SET is_admin = TRUE WHERE id = ${userId}::uuid`;
        if (action === 'removeAdmin') await sql`UPDATE users SET is_admin = FALSE WHERE id = ${userId}::uuid`;
        if (action === 'updateBalance') await sql`UPDATE users SET balance = ${balance} WHERE id = ${userId}::uuid`;
        if (action === 'delete') {
            await sql`DELETE FROM sessions WHERE user_id = ${userId}::uuid`;
            await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
        }
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};