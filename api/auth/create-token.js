// api/auth/create-token.js — POST /api/auth/create-token
// Вызывается Telegram ботом для создания pending_action
// Требует секретного ключа BOT_SECRET (задаётся в env)

const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Проверяем секрет бота
  const secret = req.headers['x-bot-secret'];
  if (!secret || secret !== process.env.BOT_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { actionType, data } = req.body || {};
  const validTypes = ['link_tg', 'reset_password', 'register'];
  if (!actionType || !validTypes.includes(actionType)) {
    return res.status(400).json({ error: 'Неверный actionType' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data должен быть объектом' });
  }

  try {
    const sql = getDB();
    const rows = await sql`
      INSERT INTO pending_actions (action_type, data)
      VALUES (${actionType}, ${JSON.stringify(data)}::jsonb)
      RETURNING token
    `;
    return res.status(201).json({ token: rows[0].token });
  } catch (err) {
    console.error('create-token error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
