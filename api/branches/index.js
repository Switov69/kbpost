// api/branches/index.js — GET /api/branches (публичный)

const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDB();
    const branches = await sql`SELECT * FROM branches ORDER BY region, number`;
    return res.status(200).json(branches.map(b => ({
      id:         b.id,
      number:     b.number,
      region:     b.region,
      prefecture: b.prefecture,
      address:    b.address,
    })));
  } catch (err) {
    console.error('branches error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
