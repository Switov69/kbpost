// api/user/profile.js — GET /api/user/profile

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const sql = getDB();
    const rows = await sql`
      SELECT id, username, is_admin, telegram_id, citizenship, account, balance, created_at
      FROM users
      WHERE id = ${session.userId}::uuid
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });

    const u = rows[0];
    return res.status(200).json({
      id:          u.id,
      username:    u.username,
      isAdmin:     u.is_admin,
      telegramId:  u.telegram_id,
      citizenship: u.citizenship,
      account:     u.account,
      balance:     u.balance,
      createdAt:   u.created_at,
    });
  } catch (err) {
    console.error('profile error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
