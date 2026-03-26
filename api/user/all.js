// api/user/all.js — GET /api/user/all (только для admin)

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });
  if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });

  try {
    const sql = getDB();
    const users = await sql`
      SELECT id, username, is_admin, telegram_id, citizenship, account, balance, created_at
      FROM users
      ORDER BY created_at ASC
    `;
    return res.status(200).json(users.map(u => ({
      id:          u.id,
      username:    u.username,
      isAdmin:     u.is_admin,
      telegramId:  u.telegram_id,
      telegramUsername: u.telegram_id ? `@${u.telegram_id}` : '',
      citizenship: u.citizenship,
      account:     u.account,
      balance:     u.balance,
      createdAt:   u.created_at,
    })));
  } catch (err) {
    console.error('all users error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
