// api/auth/check-token.js — POST /api/auth/check-token
// Проверяет UUID-токен из таблицы pending_actions
// Возвращает { actionType, data }

const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Токен не указан' });

  try {
    const sql = getDB();
    const rows = await sql`
      SELECT token, action_type, data
      FROM pending_actions
      WHERE token = ${token}::uuid
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: 'Токен недействителен или истёк' });
    }

    return res.status(200).json({
      actionType: rows[0].action_type,
      data:       rows[0].data,
    });
  } catch (err) {
    console.error('check-token error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
