// api/user/manage.js — POST /api/user/manage (только admin)
// action: 'makeAdmin' | 'removeAdmin' | 'delete' | 'updateBalance'

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });
  if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });

  const { action, userId, balance } = req.body || {};
  if (!action || !userId) return res.status(400).json({ error: 'action и userId обязательны' });

  try {
    const sql = getDB();

    if (action === 'makeAdmin') {
      await sql`UPDATE users SET is_admin = TRUE WHERE id = ${userId}::uuid`;
      return res.status(200).json({ ok: true });
    }

    if (action === 'removeAdmin') {
      // Нельзя снять права у самого себя
      if (userId === session.userId) {
        return res.status(400).json({ error: 'Нельзя снять права у самого себя' });
      }
      await sql`UPDATE users SET is_admin = FALSE WHERE id = ${userId}::uuid`;
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      if (userId === session.userId) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
      }
      // Удаляем сессии, потом пользователя
      await sql`DELETE FROM sessions WHERE user_id = ${userId}::uuid`;
      const result = await sql`DELETE FROM users WHERE id = ${userId}::uuid RETURNING id`;
      if (!result.length) return res.status(404).json({ error: 'Пользователь не найден' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'updateBalance') {
      const newBalance = parseInt(balance, 10);
      if (isNaN(newBalance)) return res.status(400).json({ error: 'Неверный баланс' });
      await sql`UPDATE users SET balance = ${newBalance} WHERE id = ${userId}::uuid`;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
  } catch (err) {
    console.error('user manage error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
