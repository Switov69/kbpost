// api/user/update-account.js — POST /api/user/update-account

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const { account } = req.body || {};
  if (!account?.trim()) return res.status(400).json({ error: 'Укажите название счёта' });

  try {
    const sql = getDB();
    await sql`
      UPDATE users SET account = ${account.trim()} WHERE id = ${session.userId}::uuid
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('update-account error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
