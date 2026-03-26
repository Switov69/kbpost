// api/parcels/delete.js — POST /api/parcels/delete (только admin)

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

  const { parcelId } = req.body || {};
  if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });

  try {
    const sql = getDB();
    const result = await sql`
      DELETE FROM parcels WHERE id = ${parcelId}::uuid RETURNING id
    `;
    if (!result.length) return res.status(404).json({ error: 'Посылка не найдена' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete parcel error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
